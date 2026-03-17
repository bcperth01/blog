const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "blog-dev-secret-change-in-production";

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET env var not set. Using insecure default. Set it in production!");
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.user = jwt.verify(auth.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Decodes token if present but never blocks the request
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try { req.user = jwt.verify(auth.slice(7), SECRET); } catch { /* ignore */ }
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: "2h" }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: "refresh" },
    SECRET,
    { expiresIn: "30d" }
  );
}

module.exports = { verifyToken, optionalAuth, requireRole, signToken, signRefreshToken };
