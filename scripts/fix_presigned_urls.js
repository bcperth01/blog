/**
 * Replaces expired S3 presigned URLs in post content with permanent proxy URLs.
 * Run once: node scripts/fix_presigned_urls.js
 */

require("dotenv").config();
const db = require("../db");

// Matches: ![alt](https://bucket.s3.region.amazonaws.com/key?X-Amz-...)
const PRESIGNED_RE = /!\[([^\]]*)\]\(https?:\/\/[^.]+\.s3\.[^/]+\.amazonaws\.com\/([^?]+)\?X-Amz-[^)]+\)/g;
// Matches existing proxy URLs (may be double-encoded from a previous bad migration run)
const PROXY_RE     = /!\[([^\]]*)\]\(\/api\/images\/proxy\/([^)]+)\)/g;

function toProxyUrl(s3Key) {
  // Decode until stable (handles single or double encoding), then encode each segment once
  let decoded = s3Key;
  try {
    let prev;
    do { prev = decoded; decoded = decodeURIComponent(decoded); } while (decoded !== prev);
  } catch (_) {}
  const encoded = decoded.split("/").map(encodeURIComponent).join("/");
  return `/api/images/proxy/${encoded}`;
}

async function run() {
  const { rows: posts } = await db.query("SELECT id, title, content FROM posts");
  console.log(`Checking ${posts.length} posts…`);

  let fixed = 0;
  for (const post of posts) {
    const original = post.content || "";
    // Fix presigned URLs
    let updated = original.replace(PRESIGNED_RE, (_, alt, key) => {
      console.log(`  Post "${post.title}": replacing presigned URL for key: ${key}`);
      return `![${alt}](${toProxyUrl(key)})`;
    });
    // Fix any double-encoded proxy URLs left from a previous run
    updated = updated.replace(PROXY_RE, (_, alt, key) => {
      const fixed_url = toProxyUrl(key);
      const current   = `/api/images/proxy/${key}`;
      if (fixed_url !== current) {
        console.log(`  Post "${post.title}": fixing double-encoded proxy URL for key: ${key}`);
      }
      return `![${alt}](${fixed_url})`;
    });

    if (updated !== original) {
      await db.query("UPDATE posts SET content = $1 WHERE id = $2", [updated, post.id]);
      console.log(`  ✓ Post "${post.title}" updated.`);
      fixed++;
    }
  }

  console.log(`\nDone. ${fixed} post(s) updated.`);
  await db.end();
}

run().catch(err => { console.error(err); process.exit(1); });
