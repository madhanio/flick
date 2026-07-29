// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use arboard::Clipboard;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, State, WindowEvent,
};

use flick_core::{send_flick, set_incoming_handler, start_node};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlickDesktopItem {
    pub id: String,
    pub msg_type: String,
    pub content: String,
    pub preview: String,
    pub sensitive: bool,
    pub from_device_id: String,
    pub from_device_name: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairedDeviceStatus {
    pub id: String,
    pub name: String,
    pub online: bool,
    pub last_seen: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopNodeInfo {
    pub node_id: String,
    pub device_id: String,
    pub device_name: String,
}

pub struct AppState {
    pub node_info: Mutex<Option<DesktopNodeInfo>>,
    pub recent_flicks: Mutex<Vec<FlickDesktopItem>>,
    pub paired_devices: Mutex<Vec<PairedDeviceStatus>>,
    pub last_copied: Mutex<String>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            node_info: Mutex::new(None),
            recent_flicks: Mutex::new(Vec::new()),
            paired_devices: Mutex::new(Vec::new()),
            last_copied: Mutex::new(String::new()),
        }
    }
}

fn is_sensitive(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.len() > 20 && !trimmed.contains(' ') {
        trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "+/=!@#$%^&*-_".contains(c))
    } else {
        false
    }
}

fn generate_preview(text: &str, sensitive: bool) -> String {
    if sensitive {
        "🔒 Sensitive content — tap to reveal".to_string()
    } else if text.chars().count() > 40 {
        format!("{}...", text.chars().take(40).collect::<String>())
    } else {
        text.to_string()
    }
}

#[tauri::command]
fn get_node_info(state: State<'_, Arc<AppState>>) -> Option<DesktopNodeInfo> {
    state.node_info.lock().unwrap().clone()
}

#[tauri::command]
fn get_paired_devices(state: State<'_, Arc<AppState>>) -> Vec<PairedDeviceStatus> {
    state.paired_devices.lock().unwrap().clone()
}

#[tauri::command]
fn get_recent_flicks(state: State<'_, Arc<AppState>>) -> Vec<FlickDesktopItem> {
    state.recent_flicks.lock().unwrap().clone()
}

#[tauri::command]
async fn send_flick_command(
    content: String,
    state: State<'_, Arc<AppState>>,
    app_handle: tauri::AppHandle,
) -> Result<FlickDesktopItem, String> {
    if content.trim().is_empty() {
        return Err("Content cannot be empty".to_string());
    }

    let sensitive = is_sensitive(&content);
    let preview = generate_preview(&content, sensitive);
    let (device_id, device_name) = {
        let info = state.node_info.lock().unwrap();
        if let Some(ref i) = *info {
            (i.device_id.clone(), i.device_name.clone())
        } else {
            ("dev_pc".to_string(), "Windows PC".to_string())
        }
    };

    let item = FlickDesktopItem {
        id: format!("flick_{}", Utc::now().timestamp_millis()),
        msg_type: "clipboard".to_string(),
        content: content.clone(),
        preview,
        sensitive,
        from_device_id: device_id.clone(),
        from_device_name: device_name.clone(),
        timestamp: Utc::now().timestamp(),
    };

    // Update last copied so clipboard watcher doesn't re-broadcast
    {
        let mut last = state.last_copied.lock().unwrap();
        *last = content.clone();
    }

    // Broadcast via Rust Core
    let _ = send_flick(content.clone(), device_id, device_name).await;

    // Store in recent flicks
    {
        let mut flicks = state.recent_flicks.lock().unwrap();
        flicks.insert(0, item.clone());
        if flicks.len() > 50 {
            flicks.pop();
        }
    }

    let _ = app_handle.emit("flick-updated", item.clone());
    Ok(item)
}

#[tokio::main]
async fn main() {
    let state = Arc::new(AppState::new());

    tauri::Builder::default()
        .manage(state.clone())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let state_clone = state.clone();

            // Initialize Rust Core engine & register incoming flicks handler
            let app_handle_incoming = app_handle.clone();
            let state_incoming = state.clone();

            tauri::async_runtime::spawn(async move {
                let device_name = "Windows PC".to_string();
                match start_node(device_name.clone()).await {
                    Ok(node_id) => {
                        let dev_id = format!("dev_{}", &node_id[..8.min(node_id.len())]);
                        let info = DesktopNodeInfo {
                            node_id: node_id.clone(),
                            device_id: dev_id,
                            device_name: device_name.clone(),
                        };
                        {
                            let mut node_slot = state_clone.node_info.lock().unwrap();
                            *node_slot = Some(info);
                        }

                        let app_h = app_handle_incoming.clone();
                        let st_h = state_incoming.clone();
                        set_incoming_handler(move |payload| {
                            let item = FlickDesktopItem {
                                id: format!("flick_{}", Utc::now().timestamp_millis()),
                                msg_type: payload.msg_type.clone(),
                                content: payload.content.clone(),
                                preview: payload.preview.clone(),
                                sensitive: payload.sensitive,
                                from_device_id: payload.from_device_id.clone(),
                                from_device_name: payload.from_device_name.clone(),
                                timestamp: payload.ts,
                            };

                            // Store in recent flicks
                            {
                                let mut flicks = st_h.recent_flicks.lock().unwrap();
                                flicks.insert(0, item.clone());
                                if flicks.len() > 50 {
                                    flicks.pop();
                                }
                            }

                            // Emit events to frontend UI
                            let _ = app_h.emit("flick-incoming", item.clone());
                            let _ = app_h.emit("flick-updated", item.clone());
                        }).await;
                    }
                    Err(e) => {
                        eprintln!("⚠️ Failed to initialize Rust Core: {}", e);
                    }
                }
            });


            // System Tray Menu Setup
            let toggle_item = MenuItem::with_id(app, "toggle", "Show Flick", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Flick", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Background Clipboard Polling Loop (Interval: 750ms)
            let poll_state = state.clone();
            let poll_handle = app_handle.clone();
            std::thread::spawn(move || {
                let mut clipboard = match Clipboard::new() {
                    Ok(cb) => cb,
                    Err(e) => {
                        eprintln!("⚠️ Failed to initialize Clipboard watcher: {}", e);
                        return;
                    }
                };

                loop {
                    std::thread::sleep(Duration::from_millis(750));

                    if let Ok(current_text) = clipboard.get_text() {
                        let text = current_text.trim().to_string();
                        if text.is_empty() {
                            continue;
                        }

                        let mut last = poll_state.last_copied.lock().unwrap();
                        if *last != text {
                            *last = text.clone();
                            drop(last);

                            let sensitive = is_sensitive(&text);
                            let preview = generate_preview(&text, sensitive);

                            let (dev_id, dev_name) = {
                                let info = poll_state.node_info.lock().unwrap();
                                if let Some(ref i) = *info {
                                    (i.device_id.clone(), i.device_name.clone())
                                } else {
                                    ("dev_pc".to_string(), "Windows PC".to_string())
                                }
                            };

                            let flick_item = FlickDesktopItem {
                                id: format!("flick_{}", Utc::now().timestamp_millis()),
                                msg_type: "clipboard".to_string(),
                                content: text.clone(),
                                preview,
                                sensitive,
                                from_device_id: dev_id.clone(),
                                from_device_name: dev_name.clone(),
                                timestamp: Utc::now().timestamp(),
                            };

                            // Broadcast payload asynchronously
                            let content_clone = text.clone();
                            let dev_id_clone = dev_id.clone();
                            let dev_name_clone = dev_name.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = send_flick(content_clone, dev_id_clone, dev_name_clone).await;
                            });

                            // Store history & emit event to UI
                            {
                                let mut flicks = poll_state.recent_flicks.lock().unwrap();
                                flicks.insert(0, flick_item.clone());
                                if flicks.len() > 50 {
                                    flicks.pop();
                                }
                            }

                            let _ = poll_handle.emit("flick-updated", flick_item);
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray instead of quitting app
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_node_info,
            get_paired_devices,
            get_recent_flicks,
            send_flick_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
