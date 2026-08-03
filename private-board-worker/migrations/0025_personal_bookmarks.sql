CREATE TABLE personal_bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL
    CHECK (length(content) BETWEEN 1 AND 240),
  url TEXT NOT NULL
    CHECK (length(url) BETWEEN 8 AND 2048),
  icon_content_type TEXT NOT NULL
    CHECK (icon_content_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif')),
  icon_data BLOB NOT NULL
    CHECK (length(icon_data) BETWEEN 1 AND 131072),
  sort_order INTEGER NOT NULL,
  create_request_id TEXT NOT NULL
    CHECK (length(create_request_id) = 36),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, create_request_id)
) STRICT;

CREATE INDEX idx_personal_bookmarks_user_order
  ON personal_bookmarks(user_id, sort_order, id);
