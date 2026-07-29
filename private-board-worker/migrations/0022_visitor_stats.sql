CREATE TABLE visitor_page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_day TEXT NOT NULL,
  visited_at INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  referer TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  path TEXT NOT NULL,
  user_id TEXT,
  response_status INTEGER NOT NULL
) STRICT;

CREATE TABLE visitor_daily_uniques (
  visit_day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY (visit_day, visitor_hash)
) STRICT, WITHOUT ROWID;

CREATE TABLE visitor_daily_counts (
  visit_day TEXT PRIMARY KEY,
  unique_count INTEGER NOT NULL DEFAULT 0
    CHECK (unique_count >= 0),
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE visitor_total_stats (
  singleton_id INTEGER PRIMARY KEY
    CHECK (singleton_id = 1),
  unique_count INTEGER NOT NULL DEFAULT 0
    CHECK (unique_count >= 0),
  updated_at INTEGER NOT NULL
) STRICT;

INSERT INTO visitor_total_stats (singleton_id, unique_count, updated_at)
VALUES (1, 0, 0);

CREATE TRIGGER visitor_daily_unique_insert
AFTER INSERT ON visitor_daily_uniques
BEGIN
  INSERT INTO visitor_daily_counts (visit_day, unique_count, updated_at)
  VALUES (NEW.visit_day, 1, NEW.first_seen_at)
  ON CONFLICT(visit_day) DO UPDATE SET
    unique_count = unique_count + 1,
    updated_at = excluded.updated_at;

  UPDATE visitor_total_stats
  SET unique_count = unique_count + 1,
      updated_at = NEW.first_seen_at
  WHERE singleton_id = 1;
END;
