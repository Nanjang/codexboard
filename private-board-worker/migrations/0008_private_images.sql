CREATE TABLE private_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 512),
  original_name TEXT NOT NULL CHECK (length(original_name) BETWEEN 1 AND 180),
  content_type TEXT NOT NULL
    CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready')),
  copied_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_private_images_owner_status_id
  ON private_images(owner_id, status, id DESC);

CREATE INDEX idx_private_images_pending_created
  ON private_images(status, created_at);
