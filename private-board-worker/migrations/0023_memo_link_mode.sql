ALTER TABLE private_memos
  ADD COLUMN link_mode TEXT NOT NULL DEFAULT 'auto'
  CHECK (link_mode IN ('none', 'auto', 'custom'));
