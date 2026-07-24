// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    println!("⚡ Flick Desktop Native App starting...");
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
