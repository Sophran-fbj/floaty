use crate::db::notes;
use crate::state::AppState;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub fn open_note_window(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let label = format!("note-{}", id);

    // If window already exists, just show and focus it
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let note = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        notes::get_note(&conn, &id).map_err(|e| e.to_string())?
    };

    // Mark as visible in DB so it restores on next startup
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        notes::update_note(
            &conn,
            &id,
            &notes::UpdateNote {
                is_visible: Some(true),
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())?;
    }

    let url = WebviewUrl::App(format!("index.html?id={}", id).into());

    // Create window hidden — frontend calls show_note_window once rendered
    let builder = WebviewWindowBuilder::new(&app, &label, url)
        .title("Floaty Note")
        .inner_size(note.width, note.height)
        .min_inner_size(280.0, 200.0)
        .position(note.pos_x, note.pos_y)
        .decorations(false)
        .always_on_top(note.is_pinned)
        .skip_taskbar(true)
        .visible(false);

    builder.build().map_err(|e| e.to_string())?;

    Ok(())
}

/// Called by the frontend once the note UI has rendered
#[tauri::command]
pub async fn show_note_window(app: AppHandle, id: String) -> Result<(), String> {
    let label = format!("note-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Close a note window and mark it as not visible
#[tauri::command]
pub fn close_note_window(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        notes::update_note(
            &conn,
            &id,
            &notes::UpdateNote {
                is_visible: Some(false),
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())?;
    }

    let label = format!("note-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Delete a note from DB and close its window
#[tauri::command]
pub fn delete_note_and_close(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        notes::delete_note(&conn, &id).map_err(|e| e.to_string())?;
    }

    let label = format!("note-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Toggle always-on-top for a note window and persist to DB
#[tauri::command]
pub fn set_note_pinned(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        notes::update_note(
            &conn,
            &id,
            &notes::UpdateNote {
                is_pinned: Some(pinned),
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())?;
    }

    let label = format!("note-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        window
            .set_always_on_top(pinned)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
