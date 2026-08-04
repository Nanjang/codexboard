CREATE TABLE ticket_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  ticket_id INTEGER NOT NULL,
  ticket_title TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'moved', 'updated', 'deleted', 'restored', 'purged')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_ticket_logs_owner_created
  ON ticket_logs(owner_id, created_at DESC, id DESC);
