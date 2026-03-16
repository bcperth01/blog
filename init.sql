-- ── Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'contributor',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Posts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) UNIQUE NOT NULL,
  content       TEXT NOT NULL,
  excerpt       TEXT,
  published     BOOLEAN DEFAULT false,
  author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  search_vector tsvector,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tags ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL
);

-- ── Post tags ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- ── GIN index for full-text search ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_fts ON posts USING GIN(search_vector);

-- ── Auto-update updated_at on post changes ──────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Auto-update search_vector on post insert/update ─────────
CREATE OR REPLACE FUNCTION posts_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title,   '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(NEW.title,   '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('simple',  coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C') ||
    setweight(to_tsvector('simple',  coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
