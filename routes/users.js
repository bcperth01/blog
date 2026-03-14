const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const db      = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

// All user routes require admin
router.use(verifyToken, requireRole("admin"));

// GET /api/users
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post("/", async (req, res) => {
  const { username, email, password, role = "contributor" } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "username, email and password are required" });
  if (!["admin", "contributor"].includes(role))
    return res.status(400).json({ error: "role must be admin or contributor" });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, username, email, role, created_at",
      [username, email, hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Username or email already exists" });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put("/:id", async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const hash = password ? await bcrypt.hash(password, 12) : null;
    const { rows } = await db.query(
      `UPDATE users SET
        username      = COALESCE($1, username),
        email         = COALESCE($2, email),
        password_hash = COALESCE($3, password_hash),
        role          = COALESCE($4, role)
       WHERE id = $5
       RETURNING id, username, email, role, created_at`,
      [username || null, email || null, hash, role || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Username or email already exists" });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: "Cannot delete your own account" });
  try {
    await db.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
