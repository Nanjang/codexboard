CREATE TABLE devlog_image_cache_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_hash TEXT NOT NULL
    CHECK (length(image_hash) = 64),
  extension TEXT NOT NULL
    CHECK (extension IN ('jpg', 'png', 'webp', 'gif', 'avif')),
  method TEXT NOT NULL
    CHECK (method IN ('GET', 'HEAD')),
  cache_status TEXT NOT NULL
    CHECK (cache_status IN ('HIT', 'MISS')),
  response_status INTEGER NOT NULL
    CHECK (response_status BETWEEN 100 AND 599),
  duration_ms INTEGER NOT NULL
    CHECK (duration_ms >= 0),
  colo TEXT
    CHECK (colo IS NULL OR length(colo) BETWEEN 1 AND 16),
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_devlog_image_cache_requests_file_id
  ON devlog_image_cache_requests(image_hash, extension, id DESC);

CREATE TABLE devlog_image_cache_file_stats (
  image_hash TEXT NOT NULL
    CHECK (length(image_hash) = 64),
  extension TEXT NOT NULL
    CHECK (extension IN ('jpg', 'png', 'webp', 'gif', 'avif')),
  hit_count INTEGER NOT NULL DEFAULT 0
    CHECK (hit_count >= 0),
  miss_count INTEGER NOT NULL DEFAULT 0
    CHECK (miss_count >= 0),
  request_count INTEGER NOT NULL DEFAULT 0
    CHECK (request_count >= 0),
  last_cache_status TEXT NOT NULL
    CHECK (last_cache_status IN ('HIT', 'MISS')),
  last_response_status INTEGER NOT NULL
    CHECK (last_response_status BETWEEN 100 AND 599),
  last_accessed_at INTEGER NOT NULL,
  PRIMARY KEY (image_hash, extension)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_devlog_image_cache_file_stats_last_access
  ON devlog_image_cache_file_stats(last_accessed_at DESC);
