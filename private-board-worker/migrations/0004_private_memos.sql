CREATE TABLE user_memo_settings (
  user_id TEXT PRIMARY KEY,
  numeric_prefix TEXT NOT NULL DEFAULT '' CHECK (length(numeric_prefix) <= 1000),
  numeric_suffix TEXT NOT NULL DEFAULT '' CHECK (length(numeric_suffix) <= 1000),
  text_prefix TEXT NOT NULL DEFAULT '' CHECK (length(text_prefix) <= 1000),
  text_suffix TEXT NOT NULL DEFAULT '' CHECK (length(text_suffix) <= 1000),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE private_memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  memo TEXT NOT NULL CHECK (length(memo) BETWEEN 1 AND 240),
  value TEXT NOT NULL CHECK (length(value) BETWEEN 1 AND 500),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_private_memos_owner_id
  ON private_memos(owner_id, id DESC);
