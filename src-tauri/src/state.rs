use crate::db::DbConn;

pub struct AppState {
    pub db: DbConn,
}
