PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(nickname) BETWEEN 2 AND 24),
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'blocked')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE auth_accounts (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  email_verified INTEGER NOT NULL DEFAULT 0
    CHECK (email_verified IN (0, 1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_subject),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE UNIQUE INDEX idx_auth_accounts_provider_email
  ON auth_accounts(provider, email);
CREATE INDEX idx_auth_accounts_user
  ON auth_accounts(user_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_sessions_user_expires
  ON sessions(user_id, expires_at);
CREATE INDEX idx_sessions_expires
  ON sessions(expires_at);

CREATE TABLE boards (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL
) STRICT;

INSERT INTO boards (id, slug, name, description, sort_order) VALUES
  (1, 'free', '자유게시판', '로그인한 모든 회원이 자유롭게 글과 댓글을 나누는 공간입니다.', 1),
  (2, 'inquiry', '문의', '로그인한 모든 회원이 함께 확인할 수 있는 공용 문의 게시판입니다.', 2);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden')),
  comment_count INTEGER NOT NULL DEFAULT 0
    CHECK (comment_count >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (board_id) REFERENCES boards(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
) STRICT;

CREATE INDEX idx_posts_board_status_id
  ON posts(board_id, status, id DESC);
CREATE INDEX idx_posts_author_id
  ON posts(author_id, id DESC);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
) STRICT;

CREATE INDEX idx_comments_post_status_id
  ON comments(post_id, status, id);
CREATE INDEX idx_comments_author_id
  ON comments(author_id, id DESC);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
  lane TEXT NOT NULL DEFAULT 'todo'
    CHECK (lane IN ('todo', 'doing', 'done')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_tickets_owner_lane_order
  ON tickets(owner_id, lane, sort_order, id);
