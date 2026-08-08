ALTER TABLE tickets
ADD COLUMN checklist_enabled INTEGER NOT NULL DEFAULT 0
CHECK (checklist_enabled IN (0, 1));

CREATE TABLE ticket_checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_ticket_checklist_items_ticket_order
  ON ticket_checklist_items(ticket_id, sort_order, id);
