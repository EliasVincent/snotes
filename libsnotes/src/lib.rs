use chrono::Local;
use home::home_dir;
use rusqlite::{Connection, Result};
use serde_json::json;

pub struct Note {
    id: i32,
    content: String,
    date: String,
    tag: String,
}

pub fn init_db() -> Result<()> {
    let home = home_dir().unwrap().join(".snotes.db");
    let connection = Connection::open(home)?;

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
    let home = home_dir().unwrap().join(".snotes.db");
    let connection = Connection::open(home)?;
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
    let home = home_dir().unwrap().join(".snotes.db");
    let connection = Connection::open(home).unwrap();

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
    let home = home_dir().unwrap().join(".snotes.db");
    let connection = Connection::open(home).map_err(|e| format!("Database Error: {e}"))?;

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
    let home = home_dir().unwrap().join(".snotes.db");
    let connection = Connection::open(home).map_err(|e| format!("Database Error: {e}"))?;

    let query = "DELETE FROM notes WHERE nid = ?1";
    match connection.execute(query, [id]) {
        Ok(1) => Ok(()), // 1 row affected means the note was deleted successfully
        Ok(_) => Err("No note with the provided ID found.".to_string()),
        Err(e) => Err(format!("Delete Error: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = init_db();
        assert_eq!(result, Ok(()));
    }
}
