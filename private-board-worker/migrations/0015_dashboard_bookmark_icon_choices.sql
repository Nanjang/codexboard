ALTER TABLE dashboard_widgets ADD COLUMN icon_url TEXT;
ALTER TABLE dashboard_widgets ADD COLUMN icon_color TEXT NOT NULL DEFAULT 'green'
  CHECK (icon_color IN ('green', 'blue', 'purple', 'orange', 'rose'));
