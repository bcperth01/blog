const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const serverError = require("../lib/errors");

function toSlug(str) {
  return str.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// GET /api/tags — public
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT t.*, COUNT(pt.post_id)::int AS post_count FROM tags t LEFT JOIN post_tags pt ON t.id = pt.tag_id GROUP BY t.id ORDER BY t.name"
    );
    res.json(rows);
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/tags — admin or contributor
router.post("/", verifyToken, requireRole("admin", "contributor"), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  if (name.length > 50) return res.status(400).json({ error: "Tag name must be 50 characters or fewer" });
  try {
    const slug = toSlug(name);
    const { rows } = await db.query(
      "INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING *",
      [name.trim(), slug]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    return serverError(res, err);
  }
});

// DELETE /api/tags/:id — admin only
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    await db.query("DELETE FROM tags WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
