CREATE TABLE IF NOT EXISTS user_preferences (
 owner_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 sections jsonb NOT NULL DEFAULT '[]'::jsonb
);
