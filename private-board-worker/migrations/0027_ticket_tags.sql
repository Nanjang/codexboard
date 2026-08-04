CREATE TABLE ticket_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 32),
  color TEXT NOT NULL CHECK (color IN ('coral', 'orange', 'green', 'blue', 'purple')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (owner_id, name)
) STRICT;

CREATE INDEX idx_ticket_tags_owner_name
  ON ticket_tags(owner_id, name, id);

CREATE UNIQUE INDEX idx_ticket_tags_owner_name_ci
  ON ticket_tags(owner_id, name COLLATE NOCASE);

CREATE TABLE ticket_tag_links (
  ticket_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES ticket_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, tag_id)
) STRICT;

CREATE INDEX idx_ticket_tag_links_tag_id
  ON ticket_tag_links(tag_id, ticket_id);
