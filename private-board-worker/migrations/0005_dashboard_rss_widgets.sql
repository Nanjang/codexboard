CREATE TABLE dashboard_widgets_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  widget_type TEXT NOT NULL
    CHECK (widget_type IN ('free-board', 'bookmark', 'rss')),
  title TEXT,
  url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  created_at INTEGER NOT NULL,
  CHECK (
    (widget_type = 'free-board' AND title IS NULL AND url IS NULL)
    OR
    (
      widget_type IN ('bookmark', 'rss')
      AND length(title) BETWEEN 1 AND 60
      AND length(url) BETWEEN 8 AND 2048
    )
  ),
  FOREIGN KEY (user_id) REFERENCES user_dashboards(user_id) ON DELETE CASCADE
) STRICT;

INSERT INTO dashboard_widgets_next
  (id, user_id, widget_type, title, url, sort_order, created_at)
SELECT
  id, user_id, widget_type, title, url, sort_order, created_at
FROM dashboard_widgets;

DROP TABLE dashboard_widgets;
ALTER TABLE dashboard_widgets_next RENAME TO dashboard_widgets;

CREATE INDEX idx_dashboard_widgets_user_order
  ON dashboard_widgets(user_id, sort_order, widget_type);

CREATE UNIQUE INDEX idx_dashboard_widgets_free_board
  ON dashboard_widgets(user_id, widget_type)
  WHERE widget_type = 'free-board';
