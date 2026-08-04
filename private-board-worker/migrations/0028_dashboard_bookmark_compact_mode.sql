ALTER TABLE dashboard_widgets ADD COLUMN compact_mode INTEGER NOT NULL DEFAULT 0
  CHECK (compact_mode IN (0, 1));
