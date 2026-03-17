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

### Security improvements ✅
- ✅ **CORS**: Restricted to `https://blog.bcperth.com` via `cors()` middleware
- ✅ **Rate limiting**: Login endpoint limited to 20 requests per 15 minutes
- ✅ **Security headers**: helmet.js with custom CSP, HSTS, X-Frame-Options
- ✅ **XSS via marked.js**: DOMPurify added to sanitise marked.js HTML output in post.html and admin.html preview
- ✅ **JWT expiry**: Access token reduced to 2h; 30d refresh token returned on login; `POST /api/auth/refresh` endpoint; `apiFetch` in admin.html silently refreshes on 401
- ✅ **Verbose error messages**: `lib/errors.js` hides `err.message` in production behind "Internal server error"
- ✅ **Input length limits**: Server-side validation on title (200), excerpt (500), content (200k), username (50), email (255), tag name (50); matching `maxlength` attributes on all admin forms

---

### Database backup ✅
- ✅ Daily `pg_dump` to S3 at 2am UTC via cron (`scripts/backup.sh`), 30-day retention
- ✅ `POST /api/backups` — trigger a backup on demand from the admin panel
- ✅ `GET /api/backups` — lists recent backups with size and date
- ✅ Admin Backups view with "Backup Now" button, backup list, and restore instructions
- Restore must be done manually via SSH (intentional — too risky to automate via UI)

---

### Site visit counter
Add a global visit counter displayed somewhere on the home page or in the admin dashboard.
Options:
- A `site_stats` table with a single `total_hits` counter, incremented on each public page load
- Or track daily counts in a `site_hits (date, count)` table for a simple traffic graph in admin

---

### Log viewer for hack attempts ✅
- ✅ Admin log viewer added — parses `/var/log/nginx/access.log` via `GET /api/logs`
- ✅ Filters: All, Suspicious (attack paths + 429/5xx), 404s, Banned IPs
- ✅ Stats summary: total requests, unique IPs, attack probes, errors, currently banned IPs
- ✅ Top 10 IPs by request volume displayed
- ✅ Rows highlighted for known attack paths (wp-admin, .env, .php, xmlrpc, etc.)
- ✅ fail2ban installed on the EC2 to automatically block IPs with repeated failed SSH login attempts
