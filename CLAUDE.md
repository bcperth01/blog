# Brendan's Blog — Claude Context

## Stack
- **Backend:** Node.js + Express, PostgreSQL, AWS S3
- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Infrastructure:** AWS EC2 (t3.micro, Amazon Linux 2023), Docker Compose, Nginx, Let's Encrypt
- **Deployment:** push to `main` → GitHub Actions → SSH → `docker compose up -d --build`

## Running Locally
```bash
docker compose up -d        # starts postgres on port 5432
npm run dev                 # starts Express on port 3000
```
Migrations run automatically on EC2 deploy. To run locally:
```powershell
docker compose exec db psql -U bloguser -d blogdb -c "<SQL here>"
```
Note: the `<` redirect does not work on Windows — use `-c` flag or copy SQL inline.

## Key Conventions

### Auth
- JWT access token (2h) + refresh token (30d), both stored in `localStorage`
- All admin API calls use `apiFetch()` in admin.html — it auto-refreshes on 401
- Middleware: `verifyToken`, `requireRole("admin")`, `requireRole("admin", "contributor")`

### Error handling
- Always use `lib/errors.js` `serverError(res, err)` — hides error details in production

### Database migrations
- Add new `.sql` files to `migrations/` — they run automatically on every deploy (idempotent, use `IF NOT EXISTS`)
- Current migrations: `001_add_post_columns.sql`, `002_site_hits.sql`

### Images
- Three S3 sizes per upload: thumbnail (300px), card (800px), full (original)
- Always served via `/api/images/proxy/:key` — never direct S3 URLs (they expire)
- Filenames in S3 are UUIDs; some older images may have original names

### Routes
- `routes/posts.js` — CRUD, like, hit counter
- `routes/images.js` — upload, proxy, delete, usage check, in-use batch check
- `routes/auth.js` — login, /me, /refresh
- `routes/stats.js` — daily site hit counter
- `routes/backups.js` — pg_dump to S3, list backups
- `routes/logs.js` — nginx access log viewer (admin only)

## Deployment Notes
- Nginx config is managed by certbot after first SSL run — don't overwrite `/etc/nginx/conf.d/blog.conf`
- Docker volume `/var/log:/host-logs:ro` gives the app read access to nginx logs
- fail2ban bans IPs after 5 failed SSH attempts for 1 hour
- Daily DB backup runs at 2am UTC via cron (`~/backup.sh` → S3 `backups/` prefix, 30-day retention)

## Admin Panel Views
Posts, Tags, Users, Images, Backups, Traffic, Logs — all in `public/admin.html`
- Admin sees all posts; contributors see only their own
- Posts table has a ⋮ row action menu (Edit, Publish, Approve, Delete, View)

## Notable Gotchas
- `highlight.js` must load from `cdn-release` GitHub CDN path, not the `npm` CDN path (npm path is the Node.js build, no global `hljs` in browser)
- `crontab` requires `cronie` package on Amazon Linux 2023
- fail2ban jail config in `deploy.yml` uses `printf` not heredoc (heredoc breaks YAML parsing)
- `--success` CSS variable is not defined — use `#28a745` directly
- `--card` CSS variable is not defined — use `--surface` instead
