ALTER TABLE books DROP CONSTRAINT IF EXISTS books_byte_size_check;
ALTER TABLE books ADD CONSTRAINT books_byte_size_check CHECK(byte_size > 0 AND byte_size <= 262144000);
ALTER TABLE catalog_entries ADD COLUMN IF NOT EXISTS owner_id text REFERENCES "user"(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS catalog_owner_idx ON catalog_entries(owner_id,kind);
