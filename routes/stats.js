const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const serverError = require("../lib/errors");

// ── POST /api/stats/hit  (public — called on every page load)
router.post("/hit", async (req, res) => {
  try {
    await db.query(
      `INSERT INTO site_hits (date, count) VALUES (CURRENT_DATE, 1)
       ON CONFLICT (date) DO UPDATE SET count = site_hits.count + 1`
    );
    res.json({ ok: true });
  } catch (err) {
    return serverError(res, err);
  }
});

// ── GET /api/stats  (admin only — returns last 30 days of daily hits)
router.get("/", verifyToken, requireRole("admin", "contributor"), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date, count FROM site_hits
       WHERE date >= CURRENT_DATE - INTERVAL '29 days'
       ORDER BY date ASC`
    );
    res.json(rows);
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
