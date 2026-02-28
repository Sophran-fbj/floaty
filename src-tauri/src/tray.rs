use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let new_note = MenuItemBuilder::with_id("new_note", "新建便签").build(app)?;
    let show_all = MenuItemBuilder::with_id("show_all", "显示全部").build(app)?;
    let hide_all = MenuItemBuilder::with_id("hide_all", "隐藏全部").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&new_note)
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
                "show_all" => handle_show_all(app),
                "hide_all" => handle_hide_all(app),
                "quit" => std::process::exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|_tray, _event| {})
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
        let id = note.id.clone();
        let state_clone = app.state::<crate::state::AppState>();
        let _ = crate::commands::windows::open_note_window(app.clone(), state_clone, id);
    }
}

/// Show ALL notes — opens windows for every note in DB
fn handle_show_all(app: &AppHandle) {
    let state = app.state::<crate::state::AppState>();
    let notes = {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        crate::db::notes::get_all_notes(&conn).unwrap_or_default()
    };

    // Batch update: mark all notes as visible in one lock
    {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
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
    }

    // Then show/create windows
    for note in &notes {
        let label = format!("note-{}", note.id);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.show();
            let _ = window.set_focus();
        } else {
            let url = WebviewUrl::App(format!("index.html?id={}", note.id).into());
            let _ = WebviewWindowBuilder::new(app, &label, url)
                .title("Floaty Note")
                .inner_size(note.width, note.height)
                .min_inner_size(280.0, 200.0)
                .position(note.pos_x, note.pos_y)
                .decorations(false)
                .always_on_top(note.is_pinned)
                .skip_taskbar(true)
                .visible(false)
                .build();
        }
    }
}

/// Hide all note windows and update DB is_visible to false
fn handle_hide_all(app: &AppHandle) {
    let state = app.state::<crate::state::AppState>();
    let notes = {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
        crate::db::notes::get_all_notes(&conn).unwrap_or_default()
    };
    // Batch DB update: mark all as not visible
    {
        let conn = state.db.lock().unwrap_or_else(|e| e.into_inner());
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
    }
    // Then hide windows
    for note in &notes {
        let label = format!("note-{}", note.id);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.hide();
        }
    }
}
