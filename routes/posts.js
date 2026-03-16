const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { verifyToken, optionalAuth, requireRole } = require("../middleware/auth");

function toSlug(str) {
  return str.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function withTags(posts) {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const { rows } = await db.query(
    `SELECT pt.post_id, t.id, t.name, t.slug
     FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
     WHERE pt.post_id = ANY($1)`,
    [ids]
  );
  const tagMap = {};
  rows.forEach((r) => {
    if (!tagMap[r.post_id]) tagMap[r.post_id] = [];
    tagMap[r.post_id].push({ id: r.id, name: r.name, slug: r.slug });
  });
  return posts.map((p) => ({ ...p, tags: tagMap[p.id] || [] }));
}

// GET /api/posts?search=&tag=&page=&limit=&published=
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { search = "", tag = "", page = 1, limit = 10, published } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (published !== undefined) {
      params.push(published === "true");
      conditions.push(`p.published = $${params.length}`);
    }
    let searchParamIdx = null;
    if (search) {
      params.push(search);
      searchParamIdx = params.length;
      conditions.push(`p.search_vector @@ websearch_to_tsquery('english', $${searchParamIdx})`);
    }
    if (tag) {
      params.push(tag);
      conditions.push(`EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.slug = $${params.length})`);
    }
    // Non-admin users only see approved posts
    if (req.user?.role !== "admin") {
      conditions.push(`p.approved = true`);
    }
    // Contributors only see their own posts
    if (req.user?.role === "contributor") {
      params.push(req.user.id);
      conditions.push(`p.author_id = $${params.length}`);
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const countRes = await db.query(`SELECT COUNT(*)::int FROM posts p ${where}`, params);
    const total = countRes.rows[0].count;

    params.push(parseInt(limit), offset);
    const orderBy = searchParamIdx
      ? `ts_rank(p.search_vector, websearch_to_tsquery('english', $${searchParamIdx})) DESC, p.created_at DESC`
      : `p.created_at DESC`;
    const { rows } = await db.query(
      `SELECT p.id, p.title, p.slug, p.excerpt, p.published, p.approved, p.likes, p.hits, p.card_image, p.created_at, p.updated_at, p.author_id
       FROM posts p ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const posts = await withTags(rows);
    res.json({ total, page: parseInt(page), limit: parseInt(limit), posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/:slug
router.get("/:slug", optionalAuth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM posts WHERE slug = $1", [req.params.slug]);
    if (!rows.length) return res.status(404).json({ error: "Post not found" });
    const post = rows[0];
    // Non-authenticated users can only read published, approved posts
    if ((!post.published || !post.approved) && !req.user)
      return res.status(404).json({ error: "Post not found" });
    // Contributors can only read their own drafts; unapproved posts are admin-only
    if (req.user?.role === "contributor") {
      if (!post.published && post.author_id !== req.user.id)
        return res.status(404).json({ error: "Post not found" });
      if (!post.approved)
        return res.status(404).json({ error: "Post not found" });
    }
    const [result] = await withTags([post]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts — admin or contributor
router.post("/", verifyToken, requireRole("admin", "contributor"), async (req, res) => {
  const { title, content, excerpt = "", published = false, card_image = null, tags = [] } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title and content are required" });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const slug = toSlug(title) + "-" + Date.now();
    const { rows } = await client.query(
      "INSERT INTO posts (title, slug, content, excerpt, published, card_image, author_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [title, slug, content, excerpt, published, card_image, req.user.id]
    );
    const post = rows[0];

    if (tags.length) {
      for (const tagId of tags) {
        await client.query(
          "INSERT INTO post_tags (post_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [post.id, tagId]
        );
      }
    }

    await client.query("COMMIT");
    const [result] = await withTags([post]);
    res.status(201).json(result);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/posts/:id — admin or post owner
router.put("/:id", verifyToken, requireRole("admin", "contributor"), async (req, res) => {
  // Contributors can only edit their own posts
  if (req.user.role === "contributor") {
    const { rows } = await db.query("SELECT author_id FROM posts WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Post not found" });
    if (rows[0].author_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  }

  const { title, content, excerpt, published, tags } = req.body;
  const approved   = req.user.role === "admin" ? req.body.approved : undefined;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Build SET clause dynamically so card_image can be explicitly cleared (set to null)
    const sets   = [
      `title     = COALESCE($1, title)`,
      `content   = COALESCE($2, content)`,
      `excerpt   = COALESCE($3, excerpt)`,
      `published = COALESCE($4, published)`,
      `approved  = COALESCE($5, approved)`,
    ];
    const params = [title, content, excerpt, published, approved];
    if ("card_image" in req.body) {
      params.push(req.body.card_image || null);
      sets.push(`card_image = $${params.length}`);
    }
    params.push(req.params.id);

    const { rows } = await client.query(
      `UPDATE posts SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Post not found" }); }
    const post = rows[0];

    if (Array.isArray(tags)) {
      await client.query("DELETE FROM post_tags WHERE post_id = $1", [post.id]);
      for (const tagId of tags) {
        await client.query(
          "INSERT INTO post_tags (post_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [post.id, tagId]
        );
      }
    }

    await client.query("COMMIT");
    const [result] = await withTags([post]);
    res.json(result);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/posts/:id — admin or post owner
router.delete("/:id", verifyToken, requireRole("admin", "contributor"), async (req, res) => {
  if (req.user.role === "contributor") {
    const { rows } = await db.query("SELECT author_id FROM posts WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Post not found" });
    if (rows[0].author_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  }
  try {
    await db.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/:id/like — public, increments like count
router.post("/:id/like", async (req, res) => {
  try {
    const { rows } = await db.query(
      "UPDATE posts SET likes = likes + 1 WHERE id = $1 RETURNING likes",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Post not found" });
    res.json({ likes: rows[0].likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/:id/hit — public, increments view count
router.post("/:id/hit", async (req, res) => {
  try {
    const { rows } = await db.query(
      "UPDATE posts SET hits = hits + 1 WHERE id = $1 RETURNING hits",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Post not found" });
    res.json({ hits: rows[0].hits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
