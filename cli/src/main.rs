use anyhow::{anyhow, Result};
use crossterm::{
    event::{self, Event, EventStream, KeyCode, KeyModifiers},
    terminal::{disable_raw_mode, enable_raw_mode},
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    env,
    io::{stdout, Write},
};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ControlMessage {
    PtyInput { data: String },
    PtyOutput { data: String },
    PtyResize { rows: u16, cols: u16 },
}

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        print_usage();
        return Ok(());
    }

    let first_arg = args[1].trim_matches(['\'', '"', ' '].as_ref());
    match first_arg {
        "connect" => {
            if args.len() < 3 {
                println!("Error: Missing server address. Usage: remote-cli <SERVER_IP>:[PORT]");
                return Ok(());
            }
            let server_target = args[2].trim_matches(['\'', '"', ' '].as_ref());
            connect_direct(server_target).await?;
        }
        "help" | "-h" | "--help" => print_usage(),
        target => {
            // Support passing IP directly: e.g. remote-cli 46.225.58.185
            connect_direct(target).await?;
        }
    }

    Ok(())
}

fn print_usage() {
    println!("=== APEX DIRECT SSH REMOTE CLI TOOL ===");
    println!("Usage:");
    println!("  remote-cli connect <SERVER_IP>:[PORT]   Connect directly to remote_agent service");
    println!("Examples:");
    println!("  remote-cli connect 192.168.1.50");
    println!("  remote-cli connect 192.168.1.50:23");
}

async fn connect_direct(target: &str) -> Result<()> {
    let host_port = if target.contains(':') {
        target.to_string()
    } else {
        format!("{}:23", target)
    };

    let ws_url = format!("ws://{}/ws/terminal", host_port);
    println!("[*] Connecting directly to Remote Agent Service at {}...", ws_url);

    let (ws_stream, _) = connect_async(&ws_url).await.map_err(|e| {
        anyhow!("Failed to connect to Remote Agent at '{}'. Ensure remote_agent service is running. Error: {}", ws_url, e)
    })?;

    println!("[+] Connection established! Entering Direct PTY Terminal Session...");
    println!("[+] Press Ctrl+Q to exit session.\n");

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Send initial terminal dimensions to remote PTY so htop/top/vim know exact screen size
    if let Ok((cols, rows)) = crossterm::terminal::size() {
        let resize_msg = ControlMessage::PtyResize { rows, cols };
        if let Ok(json) = serde_json::to_string(&resize_msg) {
            let _ = ws_sender.send(Message::Text(json)).await;
        }
    }

    // Enable Raw Mode for Terminal Keyboard Pass-through
    enable_raw_mode()?;

    // Task 1: Read Remote Agent WebSocket Output -> Write to Local Stdout
    let output_task = tokio::spawn(async move {
        let mut stdout = stdout();
        while let Some(msg_result) = ws_receiver.next().await {
            match msg_result {
                Ok(Message::Text(text)) => {
                    if let Ok(ControlMessage::PtyOutput { data }) = serde_json::from_str::<ControlMessage>(&text) {
                        let _ = stdout.write_all(data.as_bytes());
                        let _ = stdout.flush();
                    }
                }
                Ok(Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }
    });

    // Task 2: Async EventStream for Keyboard & Terminal Resize Events
    let mut reader = EventStream::new();

    tokio::select! {
        _ = output_task => {
            // Output task finished because WebSocket closed on server exit
        }
        _ = async {
            while let Some(Ok(event)) = reader.next().await {
                match event {
                    Event::Resize(cols, rows) => {
                        // Forward window resize to Remote PTY
                        let resize_msg = ControlMessage::PtyResize { rows, cols };
                        if let Ok(json) = serde_json::to_string(&resize_msg) {
                            let _ = ws_sender.send(Message::Text(json)).await;
                        }
                    }
                    Event::Key(key_event) => {
                        // Ignore KeyRelease / Repeat events to prevent character duplication on Windows
                        if key_event.kind != event::KeyEventKind::Press {
                            continue;
                        }

                        // Ctrl+Q to exit raw session
                        if key_event.modifiers.contains(KeyModifiers::CONTROL) && key_event.code == KeyCode::Char('q') {
                            break;
                        }

                        let mut input_data = String::new();
                        match key_event.code {
                            KeyCode::Char(c) => {
                                if key_event.modifiers.contains(KeyModifiers::CONTROL) {
                                    if c == 'c' {
                                        input_data.push('\x03'); // Ctrl+C ETX
                                    } else if c == 'd' {
                                        input_data.push('\x04'); // Ctrl+D EOT
                                    } else if c == 'z' {
                                        input_data.push('\x1a'); // Ctrl+Z SUB
                                    }
                                } else {
                                    input_data.push(c);
                                }
                            }
                            KeyCode::Enter => input_data.push('\r'),
                            KeyCode::Backspace => input_data.push('\x08'),
                            KeyCode::Tab => input_data.push('\t'),
                            KeyCode::Esc => input_data.push('\x1b'),
                            KeyCode::Up => input_data.push_str("\x1b[A"),
                            KeyCode::Down => input_data.push_str("\x1b[B"),
                            KeyCode::Right => input_data.push_str("\x1b[C"),
                            KeyCode::Left => input_data.push_str("\x1b[D"),
                            _ => {}
                        }

                        if !input_data.is_empty() {
                            let msg = ControlMessage::PtyInput { data: input_data };
                            if let Ok(json) = serde_json::to_string(&msg) {
                                if ws_sender.send(Message::Text(json)).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        } => {}
    }

    // Disable raw mode on exit
    disable_raw_mode()?;
    println!("\n[-] Session closed successfully.");
    Ok(())
}
