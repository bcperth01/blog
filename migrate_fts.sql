-- Full-text search migration
-- Run once: docker exec -i <container> psql -U bloguser -d blogdb < migrate_fts.sql

-- Add search vector column
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing posts
-- Title = weight A (highest), excerpt = weight B, content = weight C
UPDATE posts SET search_vector =
  setweight(to_tsvector('english', coalesce(title,   '')), 'A') ||
  setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C');

-- GIN index for fast full-text lookups
CREATE INDEX IF NOT EXISTS idx_posts_fts ON posts USING GIN(search_vector);

-- Trigger function: keep search_vector in sync on insert/update
CREATE OR REPLACE FUNCTION posts_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title,   '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
