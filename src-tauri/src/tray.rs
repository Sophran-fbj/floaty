use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};

use crate::commands::notes::emit_notes_changed;

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let new_note = MenuItemBuilder::with_id("new_note", "新建便签").build(app)?;
    let manage = MenuItemBuilder::with_id("manage", "管理便签").build(app)?;
    let show_all = MenuItemBuilder::with_id("show_all", "显示全部").build(app)?;
    let hide_all = MenuItemBuilder::with_id("hide_all", "隐藏全部").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&new_note)
        .item(&manage)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&show_all)
        .item(&hide_all)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&quit)
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Floaty - 悬浮便签")
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(move |app: &AppHandle, event| {
            let id = event.id().as_ref();
            match id {
                "new_note" => handle_new_note(app),
                "manage" => handle_manage(app),
                "show_all" => handle_show_all(app),
                "hide_all" => handle_hide_all(app),
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                handle_manage(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn handle_new_note(app: &AppHandle) {
    let state = app.state::<crate::state::AppState>();
    let result = {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        crate::db::notes::create_note(&conn)
    };
    if let Ok(note) = result {
        // We're on the main thread, so build_note_window (sync) is safe.
        let _ = crate::commands::windows::build_note_window(app, &note);
        emit_notes_changed(app);
    }
}

fn handle_manage(app: &AppHandle) {
    let label = "manager";

    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let url = WebviewUrl::App("index.html?view=manager".into());

    let _ = WebviewWindowBuilder::new(app, label, url)
        .title("Floaty - 管理便签")
        .inner_size(480.0, 560.0)
        .min_inner_size(380.0, 400.0)
        .decorations(false)
        .center()
        .visible(false)
        .build();
}

/// Show ALL notes — opens windows for every note in DB.
/// Uses build_note_window for consistent window creation.
fn handle_show_all(app: &AppHandle) {
    let state = app.state::<crate::state::AppState>();
    let notes = {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        let notes = crate::db::notes::get_all_notes(&conn).unwrap_or_default();
        for note in &notes {
            let _ = crate::db::notes::update_note(
                &conn,
                &note.id,
                &crate::db::notes::UpdateNote {
                    is_visible: Some(true),
                    ..Default::default()
                },
            );
        }
        notes
    };

    for note in &notes {
        let _ = crate::commands::windows::build_note_window(app, note);
    }
    emit_notes_changed(app);
}

/// Hide all note windows and update DB is_visible to false
fn handle_hide_all(app: &AppHandle) {
    let state = app.state::<crate::state::AppState>();
    let notes = {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        let notes = crate::db::notes::get_all_notes(&conn).unwrap_or_default();
        for note in &notes {
            let _ = crate::db::notes::update_note(
                &conn,
                &note.id,
                &crate::db::notes::UpdateNote {
                    is_visible: Some(false),
                    ..Default::default()
                },
            );
        }
        notes
    };

    for note in &notes {
        let label = format!("note-{}", note.id);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.hide();
        }
    }
    emit_notes_changed(app);
}
