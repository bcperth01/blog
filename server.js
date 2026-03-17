require("dotenv").config();

const express   = require("express");
const path      = require("path");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt    = require("bcryptjs");
const db        = require("./db");

const postsRouter  = require("./routes/posts");
const tagsRouter   = require("./routes/tags");
const authRouter   = require("./routes/auth");
const usersRouter  = require("./routes/users");
const imagesRouter = require("./routes/images");
const logsRouter   = require("./routes/logs");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "cdn.jsdelivr.net", "'unsafe-inline'"],
      styleSrc:   ["'self'", "https:", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
      fontSrc:    ["'self'", "https:", "data:"],
      connectSrc: ["'self'", "cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      objectSrc:  ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || "https://blog.bcperth.com" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth",   authRouter);
app.use("/api/users",  usersRouter);
app.use("/api/posts",  postsRouter);
app.use("/api/tags",   tagsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/logs",   logsRouter);

// Sitemap
app.get("/sitemap.xml", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT slug, updated_at, created_at FROM posts WHERE published = true AND approved = true ORDER BY created_at DESC"
    );
    const base = process.env.SITE_URL || "https://blog.bcperth.com";
    const postUrls = rows.map(p => {
      const lastmod = (p.updated_at || p.created_at).toISOString().split("T")[0];
      return `  <url><loc>${base}/post.html?slug=${p.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`;
    }).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
${postUrls}
</urlset>`;
    res.set("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    res.status(500).send("Error generating sitemap");
  }
});

// Serve index.html for any unmatched route (SPA fallback)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Seed a default admin if no admin user exists yet
async function seedAdmin() {
  try {
    const { rows } = await db.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
    if (rows.length) return;
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "Admin1234!";
    const email    = process.env.ADMIN_EMAIL    || "admin@example.com";
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,'admin') ON CONFLICT DO NOTHING",
      [username, email, hash]
    );
    console.log(`\n✅ Default admin created — username: ${username}  password: ${password}`);
    if (password === "Admin1234!") console.log("⚠️  Change this password in the Users admin panel!\n");
  } catch (err) {
    console.error("Admin seed error:", err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`Blog server running at http://localhost:${PORT}`);
  await seedAdmin();
});
