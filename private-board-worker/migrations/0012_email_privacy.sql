ALTER TABLE users
ADD COLUMN email_hidden INTEGER NOT NULL DEFAULT 1
CHECK (email_hidden IN (0, 1));
