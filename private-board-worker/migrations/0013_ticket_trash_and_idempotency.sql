ALTER TABLE tickets
ADD COLUMN create_request_id TEXT
CHECK (
  create_request_id IS NULL
  OR length(create_request_id) = 36
);

ALTER TABLE tickets
ADD COLUMN deleted_at INTEGER
CHECK (deleted_at IS NULL OR deleted_at > 0);

ALTER TABLE tickets
ADD COLUMN purge_after INTEGER
CHECK (
  (deleted_at IS NULL AND purge_after IS NULL)
  OR (deleted_at IS NOT NULL AND purge_after > deleted_at)
);

CREATE UNIQUE INDEX idx_tickets_owner_create_request
  ON tickets(owner_id, create_request_id)
  WHERE create_request_id IS NOT NULL;

CREATE INDEX idx_tickets_owner_trash_purge
  ON tickets(owner_id, purge_after, id)
  WHERE deleted_at IS NOT NULL;
