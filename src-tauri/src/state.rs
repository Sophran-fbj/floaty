use std::sync::atomic::AtomicBool;

use crate::db::DbConn;

pub struct AppState {
    pub db: DbConn,
    pub should_exit: AtomicBool,
}
