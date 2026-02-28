mod commands;
mod db;
mod state;
mod tray;

use state::AppState;
use std::sync::Mutex;
use tauri::Manager;

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

            // Create system tray
            let handle = app.handle().clone();
            tray::create_tray(&handle).expect("failed to create tray");

            // Restore visible notes on startup
            let state = handle.state::<AppState>();
            let notes = {
                let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
                db::notes::get_all_notes(&conn).unwrap_or_default()
            };

            let mut has_visible = false;
            for note in &notes {
                if note.is_visible {
                    has_visible = true;
                    let state_ref = handle.state::<AppState>();
                    let _ = commands::windows::open_note_window(
                        handle.clone(),
                        state_ref,
                        note.id.clone(),
                    );
                }
            }

            // If no visible notes, create one so the user sees something
            if !has_visible && notes.is_empty() {
                let state_ref = handle.state::<AppState>();
                let result = {
                    let conn = state_ref.db.lock().unwrap_or_else(|e| e.into_inner());
                    db::notes::create_note(&conn)
                };
                if let Ok(note) = result {
                    let state_ref2 = handle.state::<AppState>();
                    let _ = commands::windows::open_note_window(
                        handle.clone(),
                        state_ref2,
                        note.id.clone(),
                    );
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::create_note,
            commands::notes::get_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::windows::open_note_window,
            commands::windows::show_note_window,
            commands::windows::close_note_window,
            commands::windows::delete_note_and_close,
            commands::windows::set_note_pinned,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // Keep the app alive when all windows are closed (tray stays active).
            // The tray "退出" calls app.exit(0) which bypasses this handler.
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
