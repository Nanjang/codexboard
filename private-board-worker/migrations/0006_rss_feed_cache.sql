CREATE TABLE rss_feed_cache (
  url_hash TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (length(url_hash) = 64),
  CHECK (length(source_url) BETWEEN 8 AND 2048),
  CHECK (length(payload) BETWEEN 2 AND 65536)
) STRICT;
