CREATE TABLE ticket_tags_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 32),
  color TEXT NOT NULL CHECK (color IN ('coral', 'orange', 'green', 'blue', 'purple', 'yellow', 'gray-light', 'gray', 'gray-dark')),
  background_hex TEXT
    CHECK (
      background_hex IS NULL
      OR (
        length(background_hex) = 7
        AND substr(background_hex, 1, 1) = '#'
        AND substr(background_hex, 2) NOT GLOB '*[^0-9A-Fa-f]*'
      )
    ),
  text_color TEXT NOT NULL DEFAULT 'white'
    CHECK (text_color IN ('white', 'black')),
  text_hex TEXT
    CHECK (
      text_hex IS NULL
      OR (
        length(text_hex) = 7
        AND substr(text_hex, 1, 1) = '#'
        AND substr(text_hex, 2) NOT GLOB '*[^0-9A-Fa-f]*'
      )
    ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (owner_id, name)
) STRICT;

INSERT INTO ticket_tags_new (id, owner_id, name, color, created_at, updated_at)
SELECT id, owner_id, name, color, created_at, updated_at
FROM ticket_tags;

CREATE TABLE ticket_tag_links_new (
  ticket_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES ticket_tags_new(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, tag_id)
) STRICT;

INSERT INTO ticket_tag_links_new (ticket_id, tag_id)
SELECT ticket_id, tag_id
FROM ticket_tag_links;

DROP TABLE ticket_tag_links;
DROP TABLE ticket_tags;

ALTER TABLE ticket_tags_new RENAME TO ticket_tags;
ALTER TABLE ticket_tag_links_new RENAME TO ticket_tag_links;

CREATE INDEX idx_ticket_tags_owner_name
  ON ticket_tags(owner_id, name, id);

CREATE UNIQUE INDEX idx_ticket_tags_owner_name_ci
  ON ticket_tags(owner_id, name COLLATE NOCASE);

CREATE INDEX idx_ticket_tag_links_tag_id
  ON ticket_tag_links(tag_id, ticket_id);
