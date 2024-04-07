use chrono::Local;
use home::home_dir;
use rusqlite::{Connection, Result};

pub struct Note {
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

pub fn show_notes(all: bool, tag: &String) -> Result<String, String> {
    let home = home_dir().unwrap().join(".snotes.db");
    let connection = Connection::open(home).unwrap();

    let mut query = String::from("SELECT * FROM notes LIMIT 10");

    if all {
        query = String::from("SELECT * FROM notes");
    }

    if tag != &String::new() {
        query = format!("SELECT * FROM notes WHERE tag IS '{}'", tag);
    }

    let mut prepare = connection.prepare(&query).unwrap();

    let notes = prepare.query_map([], |row| {
        Ok(Note {
            content: row.get(1)?,
            date: row.get(2)?,
            tag: row.get(3)?,
        })
    }).unwrap();

    let mut noteresult = String::new(); // Initialize an empty result string

    for note in notes {
        let unwrapped = note.unwrap();
        // Append each note to the result string
        noteresult.push_str(&format!(
            "{0} #{2}: {1}\n",
            &unwrapped.date, &unwrapped.content, &unwrapped.tag
        ));
    }

    Ok(noteresult) // Return the concatenated result string
}

pub fn delete_latest_note() -> Result<()> {
    let home = home_dir().unwrap().join(".snotes.db");
    let connection = Connection::open(home)?;

    let query = String::from("DELETE FROM NOTES WHERE nid = (SELECT MAX(nid) FROM notes)");

    match connection.execute(&query, []) {
        Ok(v) => println!("DELETE OK {}", v),
        Err(e) => println!("DELETE ERR {}", e),
    }

    Ok(())
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
