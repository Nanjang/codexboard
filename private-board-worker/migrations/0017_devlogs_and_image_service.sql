ALTER TABLE posts
ADD COLUMN body_format TEXT NOT NULL DEFAULT 'plain'
  CHECK (body_format IN ('plain', 'rich'));

ALTER TABLE posts
ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('public', 'private'));

CREATE INDEX idx_posts_devlog_author_visibility_id
  ON posts(board_id, author_id, visibility, status, id DESC);

CREATE TABLE image_service_settings (
  singleton_id INTEGER PRIMARY KEY
    CHECK (singleton_id = 1),
  base_url TEXT NOT NULL
    CHECK (length(base_url) BETWEEN 12 AND 2048),
  token_ciphertext TEXT NOT NULL
    CHECK (length(token_ciphertext) BETWEEN 32 AND 4096),
  enabled INTEGER NOT NULL DEFAULT 0
    CHECK (enabled IN (0, 1)),
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id)
) STRICT;

UPDATE boards
SET
  name = '개발일지',
  description = '사용자별 개발 기록을 공개하거나 비공개로 관리하는 블로그입니다.'
WHERE slug = 'development';
