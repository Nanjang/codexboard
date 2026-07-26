CREATE TABLE user_dashboards (
  user_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE dashboard_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  widget_type TEXT NOT NULL
    CHECK (widget_type IN ('free-board', 'bookmark')),
  title TEXT,
  url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  created_at INTEGER NOT NULL,
  CHECK (
    (widget_type = 'free-board' AND title IS NULL AND url IS NULL)
    OR
    (
      widget_type = 'bookmark'
      AND length(title) BETWEEN 1 AND 60
      AND length(url) BETWEEN 8 AND 2048
    )
  ),
  FOREIGN KEY (user_id) REFERENCES user_dashboards(user_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_dashboard_widgets_user_order
  ON dashboard_widgets(user_id, sort_order, widget_type);

CREATE UNIQUE INDEX idx_dashboard_widgets_free_board
  ON dashboard_widgets(user_id, widget_type)
  WHERE widget_type = 'free-board';
