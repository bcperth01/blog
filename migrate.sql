-- Run this once against your existing database to add auth support.
-- docker exec -i <container_name> psql -U bloguser -d blogdb < migrate.sql

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'contributor'
                  CHECK (role IN ('admin', 'contributor')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
