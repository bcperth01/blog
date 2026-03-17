const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const db      = require("../db");
const { verifyToken, signToken, signRefreshToken } = require("../middleware/auth");
const serverError = require("../lib/errors");

const SECRET = process.env.JWT_SECRET || "blog-dev-secret-change-in-production";

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
    const refreshToken = signRefreshToken(user);
    res.json({ token, refreshToken, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });
  try {
    const payload = jwt.verify(refreshToken, SECRET);
    if (payload.type !== "refresh") return res.status(401).json({ error: "Invalid token type" });
    const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [payload.id]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ token: signToken(user) });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
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
    return serverError(res, err);
  }
});

module.exports = router;
