CREATE TABLE feature_settings (
  feature_key TEXT PRIMARY KEY
    CHECK (feature_key IN ('private_images')),
  enabled INTEGER NOT NULL DEFAULT 0
    CHECK (enabled IN (0, 1)),
  updated_by TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) STRICT;

INSERT INTO feature_settings (feature_key, enabled, updated_by, updated_at)
VALUES ('private_images', 0, NULL, strftime('%s', 'now') * 1000);
