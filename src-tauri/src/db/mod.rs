pub mod notes;

use rusqlite::Connection;
use std::sync::Mutex;

pub type DbConn = Mutex<Connection>;

pub fn init_db(app_data_dir: &std::path::Path) -> Result<Connection, rusqlite::Error> {
    std::fs::create_dir_all(app_data_dir).ok();
    let db_path = app_data_dir.join("floaty.db");
    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    // Compatible with old schema (extra columns are ignored).
    // For fresh installs, creates the minimal table.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            pos_x REAL NOT NULL DEFAULT 200.0,
            pos_y REAL NOT NULL DEFAULT 200.0,
            width REAL NOT NULL DEFAULT 360.0,
            height REAL NOT NULL DEFAULT 400.0,
            font_size REAL NOT NULL DEFAULT 14.0,
            is_visible INTEGER NOT NULL DEFAULT 1,
            is_pinned INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;

    // Ensure title column exists for DBs created without it
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''", []);

    // Ensure font_size column exists for DBs created without it
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN font_size REAL NOT NULL DEFAULT 14.0", []);

    // Ensure is_pinned column exists for DBs created without it
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 1", []);

    // Ensure sort_order column exists for DBs created without it
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0", []);

    // Ensure opacity column exists for DBs created without it
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN opacity REAL NOT NULL DEFAULT 1.0", []);

    // Ensure deleted_at column exists for soft-delete (trash) support
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN deleted_at TEXT DEFAULT NULL", []);

    Ok(conn)
}
