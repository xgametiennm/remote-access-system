#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio_tungstenite::{accept_hdr_async, connect_async};
use url::Url;

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
            let mut target_url_opt: Option<String> = None;

            let callback = |req: &tokio_tungstenite::tungstenite::handshake::server::Request,
                            resp: tokio_tungstenite::tungstenite::handshake::server::Response| {
                let uri = req.uri();
                let full_url = format!("http://localhost{}", uri);
                if let Ok(parsed) = Url::parse(&full_url) {
                    for (k, v) in parsed.query_pairs() {
                        if k == "target" {
                            target_url_opt = Some(format!("ws://{}/ws/terminal", v));
                        }
                    }
                }
                Ok(resp)
            };

            let ws_stream = match accept_hdr_async(stream, callback).await {
                Ok(ws) => ws,
                Err(_) => return,
            };

            let target_url = match target_url_opt {
                Some(url) => url,
                None => return,
            };

            // Connect native Tokio TCP WebSocket to target server on Port 23
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
        });
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
