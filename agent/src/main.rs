use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    env,
    io::{Read, Write},
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tower_http::cors::CorsLayer;
use tracing::{error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub hostname: String,
    pub os: String,
    pub service_name: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ControlMessage {
    PtyInput { data: String },
    PtyOutput { data: String },
    PtyResize { rows: u16, cols: u16 },
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let port = env::var("PORT").unwrap_or_else(|_| "23".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);

    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/api/info", get(info_handler))
        .route("/ws/terminal", get(ws_terminal_handler))
        .layer(cors);

    info!("============================================================");
    info!("   APEX REMOTE AGENT SERVICE - DIRECT SSH DAEMON            ");
    info!("   Listening directly on: http://{}", bind_addr);
    info!("   WebSocket Terminal Endpoint: ws://{}/ws/terminal", bind_addr);
    info!("============================================================");

    let addr: SocketAddr = bind_addr.parse().expect("Invalid bind address");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn info_handler() -> Json<SystemInfo> {
    let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown-host".to_string());
    let os = std::env::consts::OS.to_string();

    Json(SystemInfo {
        hostname,
        os,
        service_name: "remote-agent".to_string(),
        status: "active".to_string(),
    })
}

async fn ws_terminal_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_terminal_socket)
}

async fn handle_terminal_socket(socket: WebSocket) {
    info!("[+] Incoming Direct Client PTY Connection!");

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Spawn Native PTY Shell
    let pty_system = native_pty_system();
    let pair = match pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }) {
        Ok(p) => p,
        Err(e) => {
            error!("[-] Failed to open PTY session: {}", e);
            return;
        }
    };

    #[cfg(target_os = "windows")]
    let cmd = CommandBuilder::new("powershell.exe");
    #[cfg(not(target_os = "windows"))]
    let mut cmd = CommandBuilder::new("/bin/bash");
    #[cfg(not(target_os = "windows"))]
    {
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
    }

    if let Err(e) = pair.slave.spawn_command(cmd) {
        error!("[-] Failed to spawn shell command: {}", e);
        return;
    }

    let master_arc = Arc::new(Mutex::new(pair.master));
    let pty_writer = match master_arc.lock().unwrap().take_writer() {
        Ok(w) => Arc::new(Mutex::new(w)),
        Err(e) => {
            error!("[-] Failed to take PTY writer: {}", e);
            return;
        }
    };

    let mut pty_reader = match master_arc.lock().unwrap().try_clone_reader() {
        Ok(r) => r,
        Err(e) => {
            error!("[-] Failed to clone PTY reader: {}", e);
            return;
        }
    };

    // Channel for PTY Output -> WebSocket
    let (tx_output, mut rx_output) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Dedicated Thread to read PTY output
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match pty_reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    if tx_output.send(data).is_err() {
                        break;
                    }
                }
                _ => break,
            }
        }
    });

    // Task 1: Forward PTY Output -> Client WebSocket
    let ws_send_task = tokio::spawn(async move {
        while let Some(data) = rx_output.recv().await {
            let msg = ControlMessage::PtyOutput { data };
            if let Ok(json) = serde_json::to_string(&msg) {
                if ws_sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
        // Send close frame when PTY shell exits
        let _ = ws_sender.send(Message::Close(None)).await;
    });

    let master_resize = master_arc.clone();

    // Task 2: Process Incoming Client WebSocket Input -> PTY
    tokio::select! {
        _ = ws_send_task => {
            info!("[-] PTY shell process exited (e.g. user typed 'exit').");
        }
        _ = async move {
            while let Some(Ok(msg)) = ws_receiver.next().await {
                if let Message::Text(text) = msg {
                    if let Ok(cmd) = serde_json::from_str::<ControlMessage>(&text) {
                        match cmd {
                            ControlMessage::PtyInput { data } => {
                                let mut writer = pty_writer.lock().unwrap();
                                let _ = writer.write_all(data.as_bytes());
                                let _ = writer.flush();
                            }
                            ControlMessage::PtyResize { rows, cols } => {
                                let lock = master_resize.lock().unwrap();
                                let _ = lock.resize(PtySize {
                                    rows,
                                    cols,
                                    pixel_width: 0,
                                    pixel_height: 0,
                                });
                            }
                            _ => {}
                        }
                    }
                }
            }
        } => {}
    }

    info!("[-] Direct Client PTY Connection Disconnected.");
}
