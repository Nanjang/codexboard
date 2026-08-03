CREATE TABLE private_memos_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  memo TEXT NOT NULL CHECK (length(memo) BETWEEN 1 AND 240),
  value TEXT NOT NULL CHECK (length(value) BETWEEN 1 AND 500),
  link_mode TEXT NOT NULL DEFAULT 'auto'
    CHECK (link_mode IN ('none', 'link', 'auto', 'custom')),
  pattern_id INTEGER REFERENCES memo_url_patterns(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

INSERT INTO private_memos_new (
  id,
  owner_id,
  memo,
  value,
  link_mode,
  pattern_id,
  created_at,
  updated_at
)
SELECT
  id,
  owner_id,
  memo,
  value,
  link_mode,
  pattern_id,
  created_at,
  updated_at
FROM private_memos;

DROP TABLE private_memos;
ALTER TABLE private_memos_new RENAME TO private_memos;

CREATE INDEX idx_private_memos_owner_id
  ON private_memos(owner_id, id DESC);

CREATE INDEX idx_private_memos_pattern
  ON private_memos(pattern_id);
