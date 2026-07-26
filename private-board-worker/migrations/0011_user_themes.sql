CREATE TABLE custom_themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  background TEXT NOT NULL CHECK (length(background) = 7 AND substr(background, 1, 1) = '#' AND substr(background, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  surface TEXT NOT NULL CHECK (length(surface) = 7 AND substr(surface, 1, 1) = '#' AND substr(surface, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  surface_muted TEXT NOT NULL CHECK (length(surface_muted) = 7 AND substr(surface_muted, 1, 1) = '#' AND substr(surface_muted, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  text TEXT NOT NULL CHECK (length(text) = 7 AND substr(text, 1, 1) = '#' AND substr(text, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  text_muted TEXT NOT NULL CHECK (length(text_muted) = 7 AND substr(text_muted, 1, 1) = '#' AND substr(text_muted, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  border TEXT NOT NULL CHECK (length(border) = 7 AND substr(border, 1, 1) = '#' AND substr(border, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  border_strong TEXT NOT NULL CHECK (length(border_strong) = 7 AND substr(border_strong, 1, 1) = '#' AND substr(border_strong, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  primary_color TEXT NOT NULL CHECK (length(primary_color) = 7 AND substr(primary_color, 1, 1) = '#' AND substr(primary_color, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  primary_hover TEXT NOT NULL CHECK (length(primary_hover) = 7 AND substr(primary_hover, 1, 1) = '#' AND substr(primary_hover, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  primary_soft TEXT NOT NULL CHECK (length(primary_soft) = 7 AND substr(primary_soft, 1, 1) = '#' AND substr(primary_soft, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  danger TEXT NOT NULL CHECK (length(danger) = 7 AND substr(danger, 1, 1) = '#' AND substr(danger, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  danger_hover TEXT NOT NULL CHECK (length(danger_hover) = 7 AND substr(danger_hover, 1, 1) = '#' AND substr(danger_hover, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  danger_soft TEXT NOT NULL CHECK (length(danger_soft) = 7 AND substr(danger_soft, 1, 1) = '#' AND substr(danger_soft, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  success_soft TEXT NOT NULL CHECK (length(success_soft) = 7 AND substr(success_soft, 1, 1) = '#' AND substr(success_soft, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  share_code TEXT UNIQUE
    CHECK (
      share_code IS NULL
      OR (
        length(share_code) = 18
        AND share_code GLOB 'THEME-[0-9A-F]*'
        AND substr(share_code, 7) NOT GLOB '*[^0-9A-F]*'
      )
    ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_custom_themes_owner_updated
  ON custom_themes(owner_id, updated_at DESC, id DESC);

CREATE TABLE user_shared_themes (
  user_id TEXT NOT NULL,
  theme_id INTEGER NOT NULL,
  imported_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, theme_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES custom_themes(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_user_shared_themes_theme
  ON user_shared_themes(theme_id, user_id);

CREATE TABLE user_theme_preferences (
  user_id TEXT PRIMARY KEY,
  selected_kind TEXT NOT NULL DEFAULT 'builtin'
    CHECK (selected_kind IN ('builtin', 'owned', 'shared')),
  selected_builtin_key TEXT
    CHECK (selected_builtin_key IS NULL OR selected_builtin_key IN ('default', 'midnight', 'forest')),
  selected_theme_id INTEGER,
  orphan_notice_pending INTEGER NOT NULL DEFAULT 0
    CHECK (orphan_notice_pending IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (selected_kind = 'builtin' AND selected_builtin_key IS NOT NULL AND selected_theme_id IS NULL)
    OR
    (selected_kind IN ('owned', 'shared') AND selected_builtin_key IS NULL AND selected_theme_id IS NOT NULL)
  ),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_theme_id) REFERENCES custom_themes(id) ON DELETE SET NULL
) STRICT;

CREATE TRIGGER custom_themes_before_delete
BEFORE DELETE ON custom_themes
BEGIN
  UPDATE user_theme_preferences
  SET
    selected_kind = 'builtin',
    selected_builtin_key = 'default',
    selected_theme_id = NULL,
    orphan_notice_pending = CASE
      WHEN user_id <> OLD.owner_id THEN 1
      ELSE orphan_notice_pending
    END,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE selected_theme_id = OLD.id;
END;
