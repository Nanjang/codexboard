PRAGMA foreign_keys = OFF;

CREATE TABLE tickets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
  lane TEXT NOT NULL DEFAULT 'todo'
    CHECK (lane IN ('long-term', 'todo', 'doing', 'done', 'preserved')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  create_request_id TEXT
    CHECK (
      create_request_id IS NULL
      OR length(create_request_id) = 36
    ),
  deleted_at INTEGER
    CHECK (deleted_at IS NULL OR deleted_at > 0),
  purge_after INTEGER
    CHECK (
      (deleted_at IS NULL AND purge_after IS NULL)
      OR (deleted_at IS NOT NULL AND purge_after > deleted_at)
    ),
  checklist_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (checklist_enabled IN (0, 1)),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

INSERT INTO tickets_new (
  id,
  owner_id,
  title,
  note,
  lane,
  sort_order,
  created_at,
  updated_at,
  create_request_id,
  deleted_at,
  purge_after,
  checklist_enabled
)
SELECT
  id,
  owner_id,
  title,
  note,
  lane,
  sort_order,
  created_at,
  updated_at,
  create_request_id,
  deleted_at,
  purge_after,
  checklist_enabled
FROM tickets;

DROP TABLE tickets;
ALTER TABLE tickets_new RENAME TO tickets;

CREATE INDEX idx_tickets_owner_lane_order
  ON tickets(owner_id, lane, sort_order, id);

CREATE UNIQUE INDEX idx_tickets_owner_create_request
  ON tickets(owner_id, create_request_id)
  WHERE create_request_id IS NOT NULL;

CREATE INDEX idx_tickets_owner_trash_purge
  ON tickets(owner_id, purge_after, id)
  WHERE deleted_at IS NOT NULL;

UPDATE tickets
SET lane = 'preserved', deleted_at = NULL, purge_after = NULL
WHERE deleted_at IS NOT NULL;

PRAGMA foreign_keys = ON;
