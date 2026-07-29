ALTER TABLE posts
ADD COLUMN preview_image_url TEXT
  CHECK (
    preview_image_url IS NULL
    OR length(preview_image_url) BETWEEN 1 AND 2048
  );
