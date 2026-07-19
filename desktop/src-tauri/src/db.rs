use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:tasktrack.db";

pub fn migrations() -> Vec<Migration> {
  vec![Migration {
    version: 1,
    description: "offline activity chat outbox",
    sql: r#"
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_samples (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  local_status TEXT NOT NULL DEFAULT 'synced',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_activity_samples_sync
  ON activity_samples(synced, session_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON conversations(user_id, updated_at);
"#,
    kind: MigrationKind::Up,
  }]
}
