use crate::commands::notes::emit_notes_changed;
use crate::db::notes;
use crate::state::AppState;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// Internal helper: build a note window on the current thread.
/// Safe to call from the main thread (tray handlers, setup).
/// Do NOT call from a sync #[tauri::command] on Windows — use the async version.
pub fn build_note_window(app: &AppHandle, note: &notes::Note) -> Result<(), String> {
    let label = format!("note-{}", note.id);

    // If window already exists, just show and focus it
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = WebviewUrl::App(format!("index.html?id={}", note.id).into());

    let builder = WebviewWindowBuilder::new(app, &label, url)
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

/// Open (or focus) a note window.
/// MUST be async — on Windows/WebView2, synchronous WebviewWindowBuilder::build()
/// from a thread-pool invoke handler deadlocks because build() dispatches to
/// the main thread while the sync handler blocks waiting for a result.
#[tauri::command]
pub async fn open_note_window(
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

    emit_notes_changed(&app);
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

/// Close a note window and mark it as not visible.
/// Uses destroy() instead of close() — destroy() is synchronous and removes
/// the window immediately, avoiding stale handles in the window registry.
#[tauri::command]
pub async fn close_note_window(
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
        window.destroy().map_err(|e| e.to_string())?;
    }
    emit_notes_changed(&app);
    Ok(())
}

/// Delete a note from DB and close its window
#[tauri::command]
pub async fn delete_note_and_close(
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
        window.destroy().map_err(|e| e.to_string())?;
    }
    emit_notes_changed(&app);
    Ok(())
}

/// Toggle always-on-top for a note window and persist to DB
#[tauri::command]
pub async fn set_note_pinned(
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
    emit_notes_changed(&app);
    Ok(())
}

/// Open the manager window (or focus it if already open)
#[tauri::command]
pub async fn open_manager_window(app: AppHandle) -> Result<(), String> {
    let label = "manager";

    if let Some(window) = app.get_webview_window(label) {
        // Unminimize if minimized
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?view=manager".into());

    WebviewWindowBuilder::new(&app, label, url)
        .title("Floaty - 管理便签")
        .inner_size(480.0, 560.0)
        .min_inner_size(380.0, 400.0)
        .decorations(false)
        .center()
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
