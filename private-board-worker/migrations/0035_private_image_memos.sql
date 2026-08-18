ALTER TABLE private_images
  ADD COLUMN memo TEXT NOT NULL DEFAULT '' CHECK (length(memo) <= 240);
