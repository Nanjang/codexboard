CREATE TABLE memo_url_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 60),
  prefix TEXT NOT NULL DEFAULT '' CHECK (length(prefix) <= 1000),
  suffix TEXT NOT NULL DEFAULT '' CHECK (length(suffix) <= 1000),
  sort_order INTEGER NOT NULL DEFAULT 1000,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_memo_url_patterns_user_order
  ON memo_url_patterns(user_id, sort_order, id);

ALTER TABLE private_memos
  ADD COLUMN pattern_id INTEGER REFERENCES memo_url_patterns(id) ON DELETE SET NULL;

CREATE INDEX idx_private_memos_pattern
  ON private_memos(pattern_id);
