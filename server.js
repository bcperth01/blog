require("dotenv").config();

const express = require("express");
const path    = require("path");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const db      = require("./db");

const postsRouter  = require("./routes/posts");
const tagsRouter   = require("./routes/tags");
const authRouter   = require("./routes/auth");
const usersRouter  = require("./routes/users");
const imagesRouter = require("./routes/images");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth",   authRouter);
app.use("/api/users",  usersRouter);
app.use("/api/posts",  postsRouter);
app.use("/api/tags",   tagsRouter);
app.use("/api/images", imagesRouter);

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
