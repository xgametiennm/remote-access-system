#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
};
use tokio::net::TcpListener;
use tokio_tungstenite::{accept_hdr_async, connect_async, tungstenite::Message};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ControlMessage {
    PtyInput { data: String },
    PtyOutput { data: String },
    PtyResize { rows: u16, cols: u16 },
}

struct SshConnectionParams {
    target: String,
    auth_type: String, // "agent" or "password"
    username: String,
    password: Option<String>,
}

async fn run_proxy_server() {
    let addr: SocketAddr = "127.0.0.1:18888".parse().unwrap();
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[-] Proxy listener bind failed: {}", e);
            return;
        }
    };

    println!("[+] Native Tauri WS Proxy running on ws://127.0.0.1:18888");

    while let Ok((stream, _)) = listener.accept().await {
        stream.set_nodelay(true).ok();
        tokio::spawn(async move {
            let mut params_opt: Option<SshConnectionParams> = None;

            let callback = |req: &tokio_tungstenite::tungstenite::handshake::server::Request,
                            resp: tokio_tungstenite::tungstenite::handshake::server::Response| {
                let uri = req.uri();
                let full_url = format!("http://localhost{}", uri);
                if let Ok(parsed) = Url::parse(&full_url) {
                    let mut target = String::new();
                    let mut auth_type = "agent".to_string();
                    let mut username = "root".to_string();
                    let mut password = None;

                    for (k, v) in parsed.query_pairs() {
                        if k == "target" {
                            target = v.to_string();
                        } else if k == "auth" {
                            auth_type = v.to_string();
                        } else if k == "user" {
                            username = v.to_string();
                        } else if k == "pass" {
                            password = Some(v.to_string());
                        }
                    }

                    if !target.is_empty() {
                        params_opt = Some(SshConnectionParams {
                            target,
                            auth_type,
                            username,
                            password,
                        });
                    }
                }
                Ok(resp)
            };

            let ws_stream = match accept_hdr_async(stream, callback).await {
                Ok(ws) => ws,
                Err(_) => return,
            };

            let params = match params_opt {
                Some(p) => p,
                None => return,
            };

            if params.auth_type == "password" {
                handle_ssh_password_proxy(ws_stream, params).await;
            } else {
                handle_agent_direct_proxy(ws_stream, params.target).await;
            }
        });
    }
}

async fn handle_agent_direct_proxy(
    ws_stream: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    target: String,
) {
    let target_url = format!("ws://{}/ws/terminal", target);
    let (remote_ws, _) = match connect_async(&target_url).await {
        Ok(res) => res,
        Err(e) => {
            eprintln!("[-] Failed to connect to remote PTY {}: {}", target_url, e);
            return;
        }
    };

    let (mut client_tx, mut client_rx) = ws_stream.split();
    let (mut remote_tx, mut remote_rx) = remote_ws.split();

    let fwd_remote_to_client = async move {
        while let Some(Ok(msg)) = remote_rx.next().await {
            if client_tx.send(msg).await.is_err() {
                break;
            }
        }
    };

    let fwd_client_to_remote = async move {
        while let Some(Ok(msg)) = client_rx.next().await {
            if remote_tx.send(msg).await.is_err() {
                break;
            }
        }
    };

    tokio::select! {
        _ = fwd_remote_to_client => {},
        _ = fwd_client_to_remote => {},
    }
}

async fn handle_ssh_password_proxy(
    ws_stream: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    params: SshConnectionParams,
) {
    let (mut client_tx, mut client_rx) = ws_stream.split();

    let target = params.target.clone();
    let username = params.username.clone();
    let password = params.password.unwrap_or_default();

    // Perform blocking SSH connect in a dedicated thread
    let (tx_output, mut rx_output) = tokio::sync::mpsc::unbounded_channel::<String>();
    let (tx_input, mut rx_input) = tokio::sync::mpsc::unbounded_channel::<ControlMessage>();

    let ssh_task = tokio::task::spawn_blocking(move || {
        let tcp = match TcpStream::connect(&target) {
            Ok(t) => t,
            Err(e) => {
                let _ = tx_output.send(format!(
                    "\x1b[31m[-] Failed to connect TCP to SSH server {}: {}\x1b[0m\r\n",
                    target, e
                ));
                return;
            }
        };

        let mut sess = match Session::new() {
            Ok(s) => s,
            Err(e) => {
                let _ = tx_output.send(format!("\x1b[31m[-] SSH Session init failed: {}\x1b[0m\r\n", e));
                return;
            }
        };

        sess.set_tcp_stream(tcp);
        if let Err(e) = sess.handshake() {
            let _ = tx_output.send(format!("\x1b[31m[-] SSH Handshake failed: {}\x1b[0m\r\n", e));
            return;
        }

        if let Err(e) = sess.userauth_password(&username, &password) {
            let _ = tx_output.send(format!(
                "\x1b[31m[-] SSH Authentication failed for user '{}': {}\x1b[0m\r\n",
                username, e
            ));
            return;
        }

        let mut channel = match sess.channel_session() {
            Ok(c) => c,
            Err(e) => {
                let _ = tx_output.send(format!("\x1b[31m[-] SSH Channel open failed: {}\x1b[0m\r\n", e));
                return;
            }
        };

        if let Err(e) = channel.request_pty("xterm-256color", None, Some((80, 24, 0, 0))) {
            let _ = tx_output.send(format!("\x1b[31m[-] SSH PTY Request failed: {}\x1b[0m\r\n", e));
            return;
        }

        if let Err(e) = channel.shell() {
            let _ = tx_output.send(format!("\x1b[31m[-] SSH Shell request failed: {}\x1b[0m\r\n", e));
            return;
        }

        let _ = tx_output.send("\x1b[32m[+] SSH Authentication Successful! Terminal session active.\x1b[0m\r\n".to_string());

        // Make channel non-blocking for I/O loop
        sess.set_blocking(false);

        let mut buf = [0u8; 4096];
        loop {
            // Read from SSH channel
            match channel.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    if tx_output.send(data).is_err() {
                        break;
                    }
                }
                Ok(_) => {}
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                Err(_) => break,
            }

            // Process incoming commands from client
            while let Ok(msg) = rx_input.try_recv() {
                match msg {
                    ControlMessage::PtyInput { data } => {
                        let _ = channel.write_all(data.as_bytes());
                        let _ = channel.flush();
                    }
                    ControlMessage::PtyResize { rows, cols } => {
                        let _ = channel.request_pty_size(cols as u32, rows as u32, None, None);
                    }
                    _ => {}
                }
            }

            if channel.eof() {
                break;
            }

            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    });

    // Forward SSH Output -> WebSocket Client
    let send_task = async move {
        while let Some(data) = rx_output.recv().await {
            let msg = ControlMessage::PtyOutput { data };
            if let Ok(json) = serde_json::to_string(&msg) {
                if client_tx.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    };

    // Forward WebSocket Client Input -> SSH Channel
    let recv_task = async move {
        while let Some(Ok(msg)) = client_rx.next().await {
            if let Message::Text(text) = msg {
                if let Ok(ctrl) = serde_json::from_str::<ControlMessage>(&text) {
                    if tx_input.send(ctrl).is_err() {
                        break;
                    }
                }
            }
        }
    };

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
        _ = ssh_task => {},
    }
}

fn main() {
    std::thread::spawn(|| {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(run_proxy_server());
    });

    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
