mod commands;
mod db;
mod state;
mod tray;

use state::AppState;
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the first available window when a second instance is launched
            if let Some(window) = app.webview_windows().values().next() {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            // Initialize DB
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            let conn = db::init_db(&app_data_dir).expect("failed to initialize database");
            let app_state = AppState {
                db: Mutex::new(conn),
            };
            app.manage(app_state);

            // Auto-purge trash notes older than 7 days
            {
                let state = app.state::<AppState>();
                let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
                let _ = db::notes::purge_old_deleted_notes(&conn, 7);
            }

            // Create system tray
            let handle = app.handle().clone();
            tray::create_tray(&handle).expect("failed to create tray");

            // Pre-create manager window (hidden) — avoids slow WebView2 init on first open
            let manager_url = WebviewUrl::App("index.html?view=manager".into());
            let _ = WebviewWindowBuilder::new(&handle, "manager", manager_url)
                .title("Floaty - 管理便签")
                .inner_size(480.0, 560.0)
                .min_inner_size(380.0, 400.0)
                .decorations(false)
                .center()
                .visible(false)
                .build();

            // Restore visible notes on startup
            // We're on the main thread here, so build_note_window (sync) is safe.
            let state = handle.state::<AppState>();
            let notes = {
                let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
                db::notes::get_all_notes(&conn).unwrap_or_default()
            };

            let mut has_visible = false;
            for note in &notes {
                if note.is_visible {
                    has_visible = true;
                    let _ = commands::windows::build_note_window(&handle, note);
                }
            }

            // If no visible notes and DB is empty, create one so the user sees something
            if !has_visible && notes.is_empty() {
                let result = {
                    let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
                    db::notes::create_note(&conn)
                };
                if let Ok(note) = result {
                    let _ = commands::windows::build_note_window(&handle, &note);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::create_note,
            commands::notes::get_note,
            commands::notes::get_all_notes,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::reorder_notes,
            commands::notes::get_deleted_notes,
            commands::notes::restore_note,
            commands::notes::empty_trash,
            commands::notes::permanently_delete_note,
            commands::windows::open_note_window,
            commands::windows::show_note_window,
            commands::windows::close_note_window,
            commands::windows::delete_note_and_close,
            commands::windows::set_note_pinned,
            commands::windows::open_manager_window,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // Keep the app alive when all windows are closed (tray stays active).
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
