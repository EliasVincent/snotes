// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use libsnotes::show_notes;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_notes_list() -> String {
    let notes = show_notes(false, &String::new()).unwrap();
    format!("{}", notes)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, get_notes_list])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
