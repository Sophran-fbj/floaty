use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub pos_x: f64,
    pub pos_y: f64,
    pub width: f64,
    pub height: f64,
    pub font_size: f64,
    pub is_visible: bool,
    pub is_pinned: bool,
    pub sort_order: i32,
    pub opacity: f64,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateNote {
    pub title: Option<String>,
    pub content: Option<String>,
    pub pos_x: Option<f64>,
    pub pos_y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub font_size: Option<f64>,
    pub is_visible: Option<bool>,
    pub is_pinned: Option<bool>,
    pub sort_order: Option<i32>,
    pub opacity: Option<f64>,
}

const SELECT_COLS: &str =
    "id, title, content, pos_x, pos_y, width, height, font_size, is_visible, is_pinned, sort_order, opacity, deleted_at, created_at, updated_at";

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        pos_x: row.get(3)?,
        pos_y: row.get(4)?,
        width: row.get(5)?,
        height: row.get(6)?,
        font_size: row.get(7)?,
        is_visible: row.get::<_, i32>(8)? != 0,
        is_pinned: row.get::<_, i32>(9)? != 0,
        sort_order: row.get(10)?,
        opacity: row.get(11)?,
        deleted_at: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

pub fn create_note(conn: &Connection) -> Result<Note, rusqlite::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let offset_x: f64 = (rand::random::<u32>() % 200) as f64 + 100.0;
    let offset_y: f64 = (rand::random::<u32>() % 200) as f64 + 100.0;
    conn.execute(
        "INSERT INTO notes (id, pos_x, pos_y) VALUES (?1, ?2, ?3)",
        params![id, offset_x, offset_y],
    )?;
    get_note(conn, &id)
}

pub fn get_note(conn: &Connection, id: &str) -> Result<Note, rusqlite::Error> {
    conn.query_row(
        &format!("SELECT {} FROM notes WHERE id = ?1", SELECT_COLS),
        params![id],
        row_to_note,
    )
}

pub fn get_all_notes(conn: &Connection) -> Result<Vec<Note>, rusqlite::Error> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM notes WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at DESC",
        SELECT_COLS
    ))?;
    let notes = stmt.query_map([], row_to_note)?;
    notes.collect()
}

pub fn get_deleted_notes(conn: &Connection) -> Result<Vec<Note>, rusqlite::Error> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
        SELECT_COLS
    ))?;
    let notes = stmt.query_map([], row_to_note)?;
    notes.collect()
}

pub fn soft_delete_note(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE notes SET deleted_at = datetime('now'), is_visible = 0 WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn restore_note(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE notes SET deleted_at = NULL WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn purge_old_deleted_notes(conn: &Connection, days: i32) -> Result<usize, rusqlite::Error> {
    let count = conn.execute(
        "DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?1)",
        params![format!("-{} days", days)],
    )?;
    Ok(count)
}

/// Fire-and-forget update — does NOT return the updated note.
/// This prevents the content-overwrite bug where a returned note's
/// stale content would clobber the editor's current state.
pub fn update_note(
    conn: &Connection,
    id: &str,
    data: &UpdateNote,
) -> Result<(), rusqlite::Error> {
    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref title) = data.title {
        sets.push("title = ?");
        values.push(Box::new(title.clone()));
    }
    if let Some(ref content) = data.content {
        sets.push("content = ?");
        values.push(Box::new(content.clone()));
    }
    if let Some(pos_x) = data.pos_x {
        sets.push("pos_x = ?");
        values.push(Box::new(pos_x));
    }
    if let Some(pos_y) = data.pos_y {
        sets.push("pos_y = ?");
        values.push(Box::new(pos_y));
    }
    if let Some(width) = data.width {
        sets.push("width = ?");
        values.push(Box::new(width));
    }
    if let Some(height) = data.height {
        sets.push("height = ?");
        values.push(Box::new(height));
    }
    if let Some(font_size) = data.font_size {
        sets.push("font_size = ?");
        values.push(Box::new(font_size));
    }
    if let Some(is_visible) = data.is_visible {
        sets.push("is_visible = ?");
        values.push(Box::new(is_visible as i32));
    }
    if let Some(is_pinned) = data.is_pinned {
        sets.push("is_pinned = ?");
        values.push(Box::new(is_pinned as i32));
    }
    if let Some(sort_order) = data.sort_order {
        sets.push("sort_order = ?");
        values.push(Box::new(sort_order));
    }
    if let Some(opacity) = data.opacity {
        sets.push("opacity = ?");
        values.push(Box::new(opacity));
    }

    if !sets.is_empty() {
        sets.push("updated_at = datetime('now')");
        let sql = format!("UPDATE notes SET {} WHERE id = ?", sets.join(", "));
        values.push(Box::new(id.to_string()));
        let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params.as_slice())?;
    }

    Ok(())
}

pub fn delete_note(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn reorder_notes(conn: &Connection, ids: &[String]) -> Result<(), rusqlite::Error> {
    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE notes SET sort_order = ?1 WHERE id = ?2",
            params![i as i32, id],
        )?;
    }
    Ok(())
}
