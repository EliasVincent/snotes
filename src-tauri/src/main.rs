// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;

use home::home_dir;
use libsnotes::show_notes;

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn init_db() {
    libsnotes::init_db().unwrap();
    println!("initted")
}

/// get ALL notes in the Database. If you don't want this, set show_notes(false)
#[tauri::command]
fn get_notes_list() -> String {
    let notes = show_notes(true, "").unwrap();
    notes.to_string()
}

#[tauri::command]
fn get_latest_note() -> String {
    let note = libsnotes::get_latest_note().unwrap();
    note.to_string()
}

#[tauri::command]
fn get_note_by_id(id: u32) -> String {
    libsnotes::get_note_by_id(id).unwrap()
}

#[tauri::command]
fn search_notes(query: &str) -> String {
    let results = libsnotes::search_notes(query).unwrap();
    results.to_string()
}

#[tauri::command]
fn create_note(content: &str, tag: &str) -> bool {
    libsnotes::create_note(&content.to_string(), &tag.to_string()).unwrap();
    true
}

#[tauri::command]
fn delete_specific_note(id: u32) -> bool {
    libsnotes::delete_specific_note(id.try_into().unwrap()).is_ok()
}

#[tauri::command]
fn update_specific_note(id: u32, content: &str, tag: &str) -> bool {
    libsnotes::edit_specific_note(id.try_into().unwrap(), tag, content).is_ok()
}

#[tauri::command]
fn load_settings() -> String {
    let settings_string = fs::read_to_string(
        home_dir()
            .unwrap()
            .join(".snotes-data/snotes-settings.json"),
    )
    .unwrap_or(String::from(""))
    .parse()
    .unwrap_or(String::from(""));
    dbg!(&settings_string);
    settings_string
}

#[tauri::command]
fn init_settings() {
    let dir = home_dir().unwrap().join(".snotes-data");
    dbg!(&dir);
    if !dir.exists() {
        fs::create_dir(dir).unwrap();
    }

    let settings = r#"
    {
        "fontSize": "16px",
        "ocrLanguage": "eng",
    }
    "#;

    fs::write(
        home_dir()
            .unwrap()
            .join(".snotes-data/snotes-settings.json"),
        settings,
    )
    .unwrap();
}

#[tauri::command]
fn save_settings(settings: String) {
    fs::write(
        home_dir()
            .unwrap()
            .join(".snotes-data/snotes-settings.json"),
        settings,
    )
    .unwrap();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            init_db,
            get_notes_list,
            get_latest_note,
            get_note_by_id,
            search_notes,
            create_note,
            delete_specific_note,
            update_specific_note,
            init_settings,
            load_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
