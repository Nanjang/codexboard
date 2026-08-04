CREATE TABLE IF NOT EXISTS weather_daily (
  location_id TEXT NOT NULL,
  station_id INTEGER NOT NULL,
  station_type TEXT NOT NULL CHECK (station_type IN ('ASOS', 'AWS')),
  date_kst TEXT NOT NULL,
  max_c REAL,
  min_c REAL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'provisional')),
  source_updated_at TEXT,
  fetched_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (location_id, date_kst)
);

CREATE INDEX IF NOT EXISTS idx_weather_daily_location_date
  ON weather_daily (location_id, date_kst);

CREATE INDEX IF NOT EXISTS idx_weather_daily_location_status_date
  ON weather_daily (location_id, status, date_kst);
