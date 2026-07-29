-- Keep image-service objects independent from user and post lifecycle.
-- A private_images row is only a user's ownership/catalog record; deleting it
-- must never be interpreted as permission to remove the underlying object.

ALTER TABLE private_images RENAME TO private_images_legacy;

CREATE TABLE private_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  object_key TEXT
    CHECK (object_key IS NULL OR length(object_key) BETWEEN 1 AND 512),
  image_hash TEXT
    CHECK (
      image_hash IS NULL OR (
        length(image_hash) = 64
        AND image_hash NOT GLOB '*[^0-9a-f]*'
      )
    ),
  extension TEXT
    CHECK (extension IS NULL OR extension IN ('jpg', 'png', 'webp', 'gif', 'avif')),
  original_name TEXT NOT NULL CHECK (length(original_name) BETWEEN 1 AND 180),
  content_type TEXT NOT NULL
    CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready')),
  copied_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    status = 'pending'
    OR object_key IS NOT NULL
    OR (image_hash IS NOT NULL AND extension IS NOT NULL)
  ),
  CHECK (
    image_hash IS NULL
    OR extension = CASE content_type
      WHEN 'image/jpeg' THEN 'jpg'
      WHEN 'image/png' THEN 'png'
      WHEN 'image/webp' THEN 'webp'
      WHEN 'image/gif' THEN 'gif'
      WHEN 'image/avif' THEN 'avif'
    END
  ),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

INSERT INTO private_images (
  id,
  owner_id,
  object_key,
  image_hash,
  extension,
  original_name,
  content_type,
  size_bytes,
  status,
  copied_at,
  created_at,
  updated_at
)
SELECT
  id,
  owner_id,
  object_key,
  NULL,
  CASE content_type
    WHEN 'image/jpeg' THEN 'jpg'
    WHEN 'image/png' THEN 'png'
    WHEN 'image/webp' THEN 'webp'
    WHEN 'image/gif' THEN 'gif'
    WHEN 'image/avif' THEN 'avif'
  END,
  original_name,
  content_type,
  size_bytes,
  status,
  copied_at,
  created_at,
  updated_at
FROM private_images_legacy;

DROP TABLE private_images_legacy;

CREATE INDEX idx_private_images_owner_status_id
  ON private_images(owner_id, status, id DESC);

CREATE INDEX idx_private_images_pending_created
  ON private_images(status, created_at);

-- Deliberately not unique: two users may own catalog rows for the same
-- content-addressed image-service object.
CREATE INDEX idx_private_images_public_id
  ON private_images(image_hash, extension, status);

CREATE TABLE post_image_links (
  post_id INTEGER NOT NULL,
  private_image_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, private_image_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (private_image_id) REFERENCES private_images(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_post_image_links_private_image
  ON post_image_links(private_image_id, post_id);
