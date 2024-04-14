// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use libsnotes::show_notes;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// get ALL notes in the Database. If you don't want this, set show_notes(false)
#[tauri::command]
fn get_notes_list() -> String {
    let notes = show_notes(true, "").unwrap();
    notes.to_string()
}

#[tauri::command]
fn create_note(content: &str, tag: &str) -> bool {
    println!("reached");
    libsnotes::create_note(&content.to_string(), &tag.to_string()).unwrap();

    true
}

#[tauri::command]
fn delete_specific_note(id: u32) -> bool {
    println!("reched Delete");

    libsnotes::delete_specific_note(id.try_into().unwrap()).is_ok()
}

#[tauri::command]
fn update_specific_note(id: u32, content: &str, tag: &str) -> bool {
    println!("update specific note");

    libsnotes::edit_specific_note(id.try_into().unwrap(), tag, content).is_ok()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            get_notes_list,
            create_note,
            delete_specific_note,
            update_specific_note
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
