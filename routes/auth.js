const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const db      = require("../db");
const { verifyToken, signToken } = require("../middleware/auth");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "username and password are required" });
  try {
    const { rows } = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = rows[0];
    // Don't distinguish "user not found" from "wrong password" (security best practice)
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", verifyToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, username, email, role, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
