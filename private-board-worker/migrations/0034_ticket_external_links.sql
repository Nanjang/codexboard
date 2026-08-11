ALTER TABLE tickets
ADD COLUMN external_links_enabled INTEGER NOT NULL DEFAULT 0
CHECK (external_links_enabled IN (0, 1));

CREATE TABLE ticket_external_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  url TEXT NOT NULL CHECK (length(url) BETWEEN 1 AND 2048),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_ticket_external_links_ticket_order
  ON ticket_external_links(ticket_id, sort_order, id);
