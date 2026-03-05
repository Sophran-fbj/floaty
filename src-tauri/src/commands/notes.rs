use crate::db::notes::{self, Note, UpdateNote};
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};

/// Emit a global event so the manager window can refresh its list.
pub fn emit_notes_changed(app: &AppHandle) {
    let _ = app.emit("notes-changed", ());
}

#[tauri::command]
pub fn create_note(app: AppHandle, state: State<'_, AppState>) -> Result<Note, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let note = notes::create_note(&conn).map_err(|e| e.to_string())?;
    emit_notes_changed(&app);
    Ok(note)
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: String) -> Result<Note, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notes::get_note(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notes::get_all_notes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    data: UpdateNote,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notes::update_note(&conn, &id, &data).map_err(|e| e.to_string())?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notes::delete_note(&conn, &id).map_err(|e| e.to_string())?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn reorder_notes(app: AppHandle, state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notes::reorder_notes(&conn, &ids).map_err(|e| e.to_string())?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn get_deleted_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notes::get_deleted_notes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_note(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notes::restore_note(&conn, &id).map_err(|e| e.to_string())?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn empty_trash(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    // Delete all notes in trash
    let deleted = notes::get_deleted_notes(&conn).map_err(|e| e.to_string())?;
    for note in &deleted {
        notes::delete_note(&conn, &note.id).map_err(|e| e.to_string())?;
    }
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_note(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    notes::delete_note(&conn, &id).map_err(|e| e.to_string())?;
    emit_notes_changed(&app);
    Ok(())
}
