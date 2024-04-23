use chrono::Local;
use home::home_dir;
use rusqlite::{Connection, Result};
use serde_json::json;
use std::fs;
use std::path::PathBuf;

pub struct Note {
    id: i32,
    content: String,
    date: String,
    tag: String,
}

fn get_db_dir() -> PathBuf {
    let dir = home_dir().unwrap().join(".snotes-data");
    dbg!(&dir);
    if !&dir.exists() {
        fs::create_dir(&dir).unwrap();
    }

    dir.join(".snotes.db")
}

pub fn init_db() -> Result<()> {
    let db = get_db_dir();
    let connection = Connection::open(db)?;

    let query_table = "
        CREATE TABLE IF NOT EXISTS notes (
            nid INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            date TEXT NOT NULL,
            tag TEXT
        );
    ";

    match connection.execute(query_table, []) {
        Ok(_) => (),
        Err(e) => println!("INIT ERR {}", e),
    };

    Ok(())
}

pub fn create_note(content: &String, tag: &String) -> Result<()> {
    let db = get_db_dir();
    let connection = Connection::open(db)?;
    let date = Local::now();
    let date_string = date.format("%m-%d-%y %H:%M").to_string();
    let tag_string = if *tag == String::new() {
        String::from("quick")
    } else {
        tag.to_string()
    };

    let query_insert = "INSERT INTO notes (content, date, tag) VALUES (?1, ?2, ?3)";

    match connection.execute(query_insert, [&content, &date_string, &tag_string]) {
        Ok(v) => println!("CREATE OK {}", v),
        Err(e) => println!("CREATE ERR {}", e),
    };

    Ok(())
}

pub fn show_notes(all: bool, tag: &str) -> Result<String, String> {
    let db = get_db_dir();
    let connection = Connection::open(db).unwrap();

    let mut query = "SELECT * FROM notes LIMIT 10".to_string();

    if all {
        query = "SELECT * FROM notes".to_string();
    }

    if !tag.is_empty() {
        query = format!("SELECT * FROM notes WHERE tag IS '{tag}'");
    }

    let mut prepare = connection.prepare(&query).unwrap();

    let notes = prepare
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                date: row.get(2)?,
                tag: row.get(3)?,
            })
        })
        .unwrap();

    let mut json_array = Vec::new();

    for note in notes {
        let unwrapped = note.unwrap();
        let note_json = json!({
            "id": unwrapped.id,
            "date": unwrapped.date,
            "content": unwrapped.content,
            "tag": unwrapped.tag
        });
        json_array.push(note_json);
    }

    let json_string = serde_json::to_string(&json_array).unwrap();

    Ok(json_string)
}

pub fn delete_latest_note() -> Result<(), String> {
    let db = get_db_dir();
    let connection = Connection::open(db).map_err(|e| format!("Database Error: {e}"))?;

    let query = String::from("DELETE FROM NOTES WHERE nid = (SELECT MAX(nid) FROM notes)");

    match connection.execute(&query, []) {
        Ok(v) => {
            println!("DELETE OK {}", v);
            Ok(())
        }
        Err(e) => Err(format!("Delete Error: {e}")),
    }
}

pub fn delete_specific_note(id: i32) -> Result<(), String> {
    let db = get_db_dir();
    let connection = Connection::open(db).map_err(|e| format!("Database Error: {e}"))?;

    let query = "DELETE FROM notes WHERE nid = ?1";
    match connection.execute(query, [id]) {
        Ok(1) => Ok(()), // 1 row affected means the note was deleted successfully
        Ok(_) => Err("No note with the provided ID found.".to_string()),
        Err(e) => Err(format!("Delete Error: {e}")),
    }
}

pub fn edit_specific_note(id: i32, tag: &str, content: &str) -> Result<(), String> {
    let db = get_db_dir();
    let connection = Connection::open(db).map_err(|e| format!("Database Error: {}", e))?;

    let query = "UPDATE notes SET tag = ?1, content = ?2 WHERE nid = ?3";
    match connection.execute(query, [&tag, &content, &id.to_string().as_str()]) {
        Ok(1) => Ok(()), // 1 row affected means the note was updated successfully
        Ok(_) => Err("No note with the provided ID found.".to_string()),
        Err(e) => Err(format!("Edit Error: {}", e)),
    }
}

/// Looks for matches in both content and tag.
pub fn search_notes(query: &str) -> Result<String, String> {
    let db = get_db_dir();
    let connection = Connection::open(db).map_err(|e| format!("Database Error: {}", e))?;

    let query = format!(
        "SELECT * FROM notes WHERE nid LIKE '%{}%' OR content LIKE '%{}%' OR tag LIKE '%{}%'",
        query, query, query
    );

    let mut prepare = connection
        .prepare(&query)
        .map_err(|e| format!("Query Error: {}", e))?;

    let notes = prepare
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                date: row.get(2)?,
                tag: row.get(3)?,
            })
        })
        .map_err(|e| format!("Mapping Error: {}", e))?;

    let mut json_array = Vec::new();

    for note in notes {
        let unwrapped = note.map_err(|e| format!("Note Error: {}", e))?;
        let note_json = json!({
            "id": unwrapped.id,
            "date": unwrapped.date,
            "content": unwrapped.content,
            "tag": unwrapped.tag
        });
        json_array.push(note_json);
    }

    let json_string =
        serde_json::to_string(&json_array).map_err(|e| format!("JSON Error: {}", e))?;

    Ok(json_string)
}

/// get latest note
/// Returns a json array string of size 1
pub fn get_latest_note() -> Result<String, String> {
    let db = get_db_dir();
    let connection = Connection::open(db).map_err(|e| format!("Database Error: {}", e))?;

    let query = "SELECT * FROM notes WHERE ROWID IN (SELECT max(ROWID) FROM notes);
    "
    .to_string();
    let mut prepare = connection
        .prepare(&query)
        .map_err(|e| format!("Query Error: {}", e))?;

    let notes = prepare
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                date: row.get(2)?,
                tag: row.get(3)?,
            })
        })
        .map_err(|e| format!("Mapping Error: {}", e))?;

    let mut json_array = Vec::new();

    for note in notes {
        let unwrapped = note.map_err(|e| format!("Note Error: {}", e))?;
        let note_json = json!({
            "id": unwrapped.id,
            "date": unwrapped.date,
            "content": unwrapped.content,
            "tag": unwrapped.tag
        });
        json_array.push(note_json);
    }

    let json_string =
        serde_json::to_string(&json_array).map_err(|e| format!("JSON Error: {}", e))?;
    println!("{}", json_string);
    Ok(json_string)
}

pub fn get_note_by_id(id: u32) -> Result<String, String> {
    let db = get_db_dir();
    let connection = Connection::open(db).map_err(|e| format!("Database Error: {}", e))?;

    let query = format!("SELECT * FROM notes WHERE nid IS {};", id.to_string());
    let mut prepare = connection
        .prepare(&query)
        .map_err(|e| format!("Query Error: {}", e))?;

    let notes = prepare
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                date: row.get(2)?,
                tag: row.get(3)?,
            })
        })
        .map_err(|e| format!("Mapping Error: {}", e))?;

    let mut json_array = Vec::new();

    for note in notes {
        let unwrapped = note.map_err(|e| format!("Note Error: {}", e))?;
        let note_json = json!({
            "id": unwrapped.id,
            "date": unwrapped.date,
            "content": unwrapped.content,
            "tag": unwrapped.tag
        });
        json_array.push(note_json);
    }

    let json_string =
        serde_json::to_string(&json_array).map_err(|e| format!("JSON Error: {}", e))?;
    println!("{}", json_string);
    Ok(json_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = init_db();
        assert_eq!(result, Ok(()));
    }

    #[test]
    #[ignore = "debug thing"]
    fn test_id_10() {
        let result = get_note_by_id(10).unwrap();
        println!("{}", result);
        assert!(true)
    }
}
