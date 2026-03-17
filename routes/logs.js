const express = require("express");
const router  = express.Router();
const fs      = require("fs");
const { verifyToken, requireRole } = require("../middleware/auth");
const serverError = require("../lib/errors");

const LOG_FILE    = process.env.NGINX_LOG_PATH   || "/host-logs/nginx/access.log";
const F2B_LOG     = process.env.FAIL2BAN_LOG_PATH || "/host-logs/fail2ban.log";
const MAX_LINES   = 2000;

// Paths that indicate attack/probe traffic
const ATTACK_RE = /wp-admin|\.env|phpmyadmin|\.php(\?|$)|xmlrpc|\.git\/|config\.|cmd\.exe|\.asp|\.jsp|eval-stdin|setup\.cgi|\/etc\/passwd/i;

function readLastLines(filepath, n) {
  try {
    const content = fs.readFileSync(filepath, "utf8");
    const lines = content.split("\n").filter(l => l.trim());
    return lines.slice(-n);
  } catch {
    return null;
  }
}

// Parse nginx combined log format
function parseLine(line) {
  const m = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d+) (\d+) "[^"]*" "([^"]*)"/);
  if (!m) return null;
  return {
    ip:     m[1],
    time:   m[2],
    method: m[3],
    path:   m[4],
    status: parseInt(m[5]),
    bytes:  parseInt(m[6]),
    ua:     m[7],
  };
}

// GET /api/logs?filter=all|suspicious|404s|banned&limit=200
router.get("/", verifyToken, requireRole("admin"), (req, res) => {
  try {
    const filter = req.query.filter || "all";
    const limit  = Math.min(parseInt(req.query.limit) || 200, 1000);

    const rawLines = readLastLines(LOG_FILE, MAX_LINES);
    if (!rawLines) {
      return res.json({ available: false, entries: [], stats: null });
    }

    const parsed = rawLines.map(parseLine).filter(Boolean);

    // IP frequency map
    const ipCounts = {};
    parsed.forEach(e => { ipCounts[e.ip] = (ipCounts[e.ip] || 0) + 1; });
    const topIPs = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    // Currently banned IPs from fail2ban log (Ban without subsequent Unban)
    let bannedIPs = [];
    const f2bLines = readLastLines(F2B_LOG, 1000);
    if (f2bLines) {
      const bans   = new Set();
      const unbans = new Set();
      f2bLines.forEach(l => {
        const b = l.match(/NOTICE\s+\[sshd\] Ban (\S+)/);
        const u = l.match(/NOTICE\s+\[sshd\] Unban (\S+)/);
        if (b) bans.add(b[1]);
        if (u) unbans.add(u[1]);
      });
      bannedIPs = [...bans].filter(ip => !unbans.has(ip));
    }

    // Apply filter
    const bannedSet = new Set(bannedIPs);
    let entries = parsed;
    if (filter === "suspicious") {
      entries = parsed.filter(e => ATTACK_RE.test(e.path) || e.status === 429 || e.status >= 500);
    } else if (filter === "404s") {
      entries = parsed.filter(e => e.status === 404);
    } else if (filter === "banned") {
      entries = parsed.filter(e => bannedSet.has(e.ip));
    }

    // Most recent first, capped at limit
    entries = entries.slice(-limit).reverse();

    const stats = {
      total:      parsed.length,
      uniqueIPs:  Object.keys(ipCounts).length,
      suspicious: parsed.filter(e => ATTACK_RE.test(e.path)).length,
      errors:     parsed.filter(e => e.status >= 400).length,
      topIPs,
      bannedIPs,
    };

    res.json({ available: true, entries, stats });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
