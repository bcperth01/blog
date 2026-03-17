# Todo

## Future Considerations

### Check image usage before deletion
When deleting an image, warn the user if it is referenced in any posts.
Two places to check:
- `card_image` column — direct DB query: `SELECT title FROM posts WHERE card_image LIKE '%filename%'`
- Post `content` field — best-effort `LIKE` search through markdown content for the image URL

If matches are found, list the affected post titles in the confirm dialog before proceeding.
Note: URL encoding in content fields makes matching tricky and the content search could be slow on large datasets.

---

### Firewall (AWS Security Group hardening)
- Decided against restricting SSH to a specific IP — the GitHub Actions deploy pipeline also connects via SSH, making IP whitelisting impractical without also managing GitHub's IP ranges.
- ✅ Added fail2ban as the primary SSH defence — bans IPs after 5 failed attempts for 1 hour.
- Consider adding AWS WAF (Web Application Firewall) in front of the EC2 instance if traffic grows.

---

### SEO improvements ✅
- ✅ Add `<meta name="description">` to each post page using the post excerpt
- ✅ Add `<meta property="og:*">` Open Graph tags (title, description, image) for social sharing previews
- ✅ Add a `sitemap.xml` endpoint generated dynamically from published posts
- ✅ Add `<link rel="canonical">` to post pages
- ✅ Ensure post slugs are human-readable (changed timestamp suffix to base-36, e.g. `-lk73ds0`)

---

### Security improvements
- ✅ **CORS**: Restricted to `https://blog.bcperth.com` via `cors()` middleware
- ✅ **Rate limiting**: Login endpoint limited to 20 requests per 15 minutes
- ✅ **Security headers**: helmet.js with custom CSP, HSTS, X-Frame-Options
- **XSS via marked.js**: Add DOMPurify to sanitise rendered HTML from post content
- **JWT expiry**: Reduce token lifetime from 7 days to 1–2 hours with a refresh token mechanism
- **Verbose error messages**: Strip DB error details from API responses in production
- **Input length limits**: Add max-length validation on post title, excerpt, username, etc.

---

### Database backup
The PostgreSQL data lives in a Docker volume on the EC2. If the instance is lost the data is gone.
Options:
- **Scheduled pg_dump to S3** — add a cron job on the EC2 that runs `pg_dump` daily and uploads the result to S3. Simple and reliable.
- **AWS RDS** — migrate from the containerised Postgres to RDS for managed backups, snapshots, and multi-AZ. Higher cost but zero maintenance.

Recommended starting point: daily `pg_dump` to S3 with a 30-day retention policy.

---

### Site visit counter
Add a global visit counter displayed somewhere on the home page or in the admin dashboard.
Options:
- A `site_stats` table with a single `total_hits` counter, incremented on each public page load
- Or track daily counts in a `site_hits (date, count)` table for a simple traffic graph in admin

---

### Log viewer for hack attempts
Add an admin page to view server and Nginx access logs, filtered for suspicious activity such as:
- Repeated failed login attempts (rate limiter hits)
- 404s on common attack paths (e.g. `/wp-admin`, `/.env`, `/phpmyadmin`)
- Unusual request volumes from a single IP

Implementation options:
- Parse `/var/log/nginx/access.log` on the EC2 via a new admin API endpoint
- Or add structured logging to the Express app (e.g. `morgan` middleware) and expose a log viewer in the admin panel
- ✅ fail2ban installed on the EC2 to automatically block IPs with repeated failed SSH or login attempts
