-- Better Auth owns the user, account, session, verification and rateLimit tables.
-- Run its migration before this file.
CREATE TABLE IF NOT EXISTS catalog_entries (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('duas','hadiths','quotes')),
  title text NOT NULL,
  text text NOT NULL,
  arabic text,
  source text,
  author text,
  category text NOT NULL DEFAULT 'General',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_entries_kind_idx ON catalog_entries(kind);

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  author text,
  description text,
  palette text NOT NULL CHECK (palette IN ('burgundy','plum','forest','navy','brown','sand')),
  format text NOT NULL CHECK (format IN ('pdf','docx')),
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 52428800),
  blob_path text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS books_owner_idx ON books(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  parent_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  color text NOT NULL DEFAULT '#b99279',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS folders_owner_idx ON folders(owner_id);

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled note',
  body text NOT NULL DEFAULT '',
  template text NOT NULL DEFAULT 'plain' CHECK (template IN ('plain','lined','dotted')),
  strokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  favorite boolean NOT NULL DEFAULT false,
  trashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_owner_idx ON notes(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, name)
);
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_kind text NOT NULL CHECK (item_kind IN ('duas','hadiths','quotes','books')),
  item_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(collection_id, item_kind, item_id)
);
CREATE TABLE IF NOT EXISTS favorites (
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  item_kind text NOT NULL CHECK (item_kind IN ('duas','hadiths','quotes','books')),
  item_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, item_kind, item_id)
);
CREATE TABLE IF NOT EXISTS reading_progress (
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  location text NOT NULL DEFAULT '',
  reflection text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, book_id)
);
