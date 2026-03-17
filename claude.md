# How Claude Built This Blog

This document describes how this blog application was built through a series of conversations with Claude (Anthropic's AI). The app was built incrementally, starting from a basic Node.js server and growing into a fully deployed, production-ready blog platform.

---

## The Stack

- **Backend:** Node.js + Express REST API
- **Database:** PostgreSQL with full-text search
- **Storage:** AWS S3 (three image sizes: thumbnail, card, full)
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework)
- **Infrastructure:** AWS EC2 (t3.micro) provisioned with AWS CDK
- **Deployment:** GitHub Actions → SSH → Docker Compose
- **Reverse proxy:** Nginx with Let's Encrypt HTTPS

---

## Steps

### 1. Core Application

The first step was building the basic blog: a Node.js/Express server with PostgreSQL, JWT authentication, and a simple admin panel.

> *"I want to build a blog app with Node.js and PostgreSQL. I need an admin panel to write posts and a public page to read them."*

Key decisions:
- PostgreSQL with parameterised queries (no ORM)
- JWT stored in `localStorage`, sent as `Authorization: Bearer` header
- Admin and contributor roles
- Markdown rendering with `marked.js`

Login endpoint with JWT signing:

```js
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await db.query(
    "SELECT * FROM users WHERE username = $1", [username]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});
```

---

### 2. Search

Full-text search was added using PostgreSQL's native `tsvector` and `GIN` index, with a `websearch_to_tsquery` query parser.

> *"its even more strange now. a finds no documents, ad finds Test 4, add reverts to no documents..."*
> *"thats much cleaner"*

The search was initially live (search-as-you-type with debounce), but this caused confusing partial-match behaviour. It was changed to trigger on Enter key or a Search button press.

The search vector is kept up to date automatically via a PostgreSQL trigger:

```sql
CREATE OR REPLACE FUNCTION posts_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title,   '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(NEW.title,   '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

And queried with ranking:

```js
if (search) {
  params.push(search);
  searchParamIdx = params.length;
  conditions.push(
    `p.search_vector @@ websearch_to_tsquery('english', $${searchParamIdx})`
  );
}
const orderBy = searchParamIdx
  ? `ts_rank(p.search_vector, websearch_to_tsquery('english', $${searchParamIdx})) DESC, p.created_at DESC`
  : `p.created_at DESC`;
```

---

### 3. Image Management

Images are uploaded to AWS S3 and automatically resized into three versions using the `sharp` library:

- **Thumbnail** — small preview used in the admin image grid
- **Card** — medium size used on the home page post cards
- **Full** — original size used in post content

Proxy endpoints (`/api/images/proxy/:key`) were added so images are served via the app server rather than with expiring S3 presigned URLs.

> *"The next problem is signed URL expiry. We are only refreshing them when a document is saved..."*

The proxy generates a fresh presigned URL on every request:

```js
router.get("/proxy/*", async (req, res) => {
  const key = req.params[0];
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });
  res.redirect(302, url);
});
```

---

### 4. Lightbox

A custom lightbox was built to replace the third-party Viewer.js library. It supports pan by dragging and zoom by scroll wheel, with the image filename shown in the toolbar.

> *"the lightbox is still not right though. the first problem is that when you pan the image, on mouse release it closes the lightbox"*
> *"Can you make the lightbox take about 3/4 of the area and be centered"*

A `wasDragged` flag prevents the lightbox closing on mouseup after a pan gesture:

```js
img.addEventListener("mousedown", (e) => {
  dragging = true;
  wasDragged = false;
  startX = e.clientX - translateX;
  startY = e.clientY - translateY;
});

img.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  wasDragged = true;
  translateX = e.clientX - startX;
  translateY = e.clientY - startY;
  applyTransform();
});

overlay.addEventListener("click", () => {
  if (!wasDragged) overlay.style.display = "none";
});
```

---

### 5. Dockerisation

The app was containerised with Docker so it could run identically in development and production.

> *"can we first dockerise the node app locally and get it working before we move to deployment"*

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

The `docker-compose.yml` wires the app and database together, with the app waiting for the DB healthcheck before starting:

```yaml
services:
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bloguser -d blogdb"]
      interval: 5s
      retries: 10

  app:
    build: .
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      db:
        condition: service_healthy
    env_file: .env
```

---

### 6. AWS Infrastructure with CDK

AWS CDK (TypeScript) was used to define the EC2 infrastructure as code in the `/infra` directory.

> *"I want you to create a CDK program to define any resources we need on AWS — only the EC2 for now"*

```typescript
const instance = new ec2.Instance(this, "BlogInstance", {
  vpc,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  machineImage: ec2.MachineImage.latestAmazonLinux2023(),
  securityGroup: sg,
  keyName: keyPairName,
  userData,
  blockDevices: [{
    deviceName: "/dev/xvda",
    volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3 }),
  }],
});

const eip = new ec2.CfnEIP(this, "BlogEIP", { instanceId: instance.instanceId });
```

Deployed with: `cdk deploy --context keyPairName=blog-key`

---

### 7. GitHub Actions Deployment Pipeline

A GitHub Actions workflow (`.github/workflows/deploy.yml`) was created to automatically deploy on every push to `main`.

> *"I want to focus on setting up an automated deployment pipeline"*

```yaml
- name: Deploy to EC2
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ${{ secrets.EC2_USER }}
    key: ${{ secrets.SSH_PRIVATE_KEY }}
    script: |
      cd $HOME/app
      git pull https://${{ secrets.GH_TOKEN }}@github.com/${{ github.repository }} main
      sudo docker compose up -d --build
      for f in $HOME/app/migrations/*.sql; do
        [ -f "$f" ] && sudo docker compose exec -T db psql -U bloguser -d blogdb < "$f" || true
      done
```

Several deployment issues were debugged iteratively through the GitHub Actions logs:

> *"it says err: fatal: could not create work tree dir '/app': Permission denied"*
> *"err: compose build requires buildx 0.17.0 or later"*

---

### 8. Nginx and HTTPS

Nginx was configured as a reverse proxy, forwarding public traffic to the app container on port 3000.

```nginx
server {
    listen 80 default_server;
    server_name blog.bcperth.com;
    client_max_body_size 25M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Let's Encrypt SSL certificates are obtained automatically via certbot on first deploy. The workflow checks whether a certificate already exists before running certbot, so subsequent deploys don't overwrite the certbot-managed config.

---

### 9. Security Hardening

Several security improvements were added after the initial deployment.

> *"OK lets fix the security headers and the rate limiting"*

```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "cdn.jsdelivr.net", "'unsafe-inline'"],
      styleSrc:   ["'self'", "https:", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({ origin: process.env.CORS_ORIGIN || "https://blog.bcperth.com" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts, please try again later" },
});
app.use("/api/auth/login", loginLimiter);
```

---

### 10. Post Cards and Home Page

The home page was redesigned from a single-column list to a responsive card grid.

> *"I want to add like and hit counts to each article"*
> *"I want to add an image to display in the card"*

New database columns were added via a migration:

```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS approved   BOOLEAN DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS likes      INT     DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hits       INT     DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS card_image TEXT;
```

The post list was changed to a CSS grid so cards flow into multiple columns on wide screens:

```css
.post-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}
```

The like button calls the API and disables itself after clicking:

```js
async function likePost(id, btn) {
  const res = await fetch(`${API}/posts/${id}/like`, { method: "POST" });
  if (res.ok) {
    const data = await res.json();
    btn.querySelector("span").textContent = data.likes;
    btn.disabled = true;
  }
}
```

---

### 11. Syntax Highlighting

Code blocks in Markdown posts are syntax highlighted using `highlight.js` with the Atom One Dark theme.

> *"I want to include code highlighting to the MD documents"*

A custom `marked.use()` renderer overrides the default code block output:

```js
marked.use({
  renderer: {
    code(code, lang) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      const highlighted = hljs.highlight(code, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    }
  }
});
```

Note: the `cdn-release` GitHub CDN path must be used for highlight.js, not the `npm` path — the npm path resolves to the Node.js build which does not expose a global `hljs` in the browser.

---

### 12. SEO Improvements

Meta tags, Open Graph, canonical links, and a dynamic sitemap were added.

> *"can we add the seo improvements now"*

Each post page dynamically sets its SEO tags after the post loads:

```js
document.querySelector("meta[name='description']").setAttribute("content", post.excerpt);
document.querySelector("meta[property='og:title']").setAttribute("content", post.title + " — Brendan's Blog");
document.querySelector("meta[property='og:image']").setAttribute("content", window.location.origin + post.card_image);
document.querySelector("link[rel='canonical']").setAttribute("href", canonical);
```

A `/sitemap.xml` endpoint was added to `server.js`, dynamically generated from all published and approved posts:

```js
app.get("/sitemap.xml", async (req, res) => {
  const { rows } = await db.query(
    "SELECT slug, updated_at, created_at FROM posts WHERE published = true AND approved = true"
  );
  // ... builds XML and returns with Content-Type: application/xml
});
```

Post slug suffixes were changed from a raw timestamp (`Date.now()`) to base-36 (`Date.now().toString(36)`) — e.g. `-lk73ds0` instead of `-1742212800000`.

---

### 13. Card Layout and Tag Overflow

Two usability fixes were made to the post card grid.

> *"can we change the cards so that they display correctly with a lot of tags"*
> *"the same problem happening when the excerpts are multiline"*

Tags beyond the first two are hidden behind a `+N` chip that expands in-place on click:

```js
function renderTags(tags) {
  const LIMIT = 2;
  if (tags.length <= LIMIT) return visible.join("");
  const hidden = tags.slice(LIMIT).map(t => `<span class="tag tag-hidden" ...>`);
  const more = `<span class="tag tag-more" onclick="expandTags(this)">+${hidden.length}</span>`;
  return [...visible, more, ...hidden].join("");
}
function expandTags(el) {
  el.parentElement.querySelectorAll(".tag-hidden").forEach(t => t.classList.remove("tag-hidden"));
  el.remove();
}
```

Cards were made flex-column with the footer pinned to the bottom so likes, views and the Read button always align across the grid regardless of excerpt length or tag count:

```css
.post-card { display: flex; flex-direction: column; }
.post-card .card-footer { margin-top: auto; }
.post-card .card-footer .tag-list { width: 100%; min-height: 1.8rem; }
```

---

### 14. Security Hardening (Round 2)

Several further security improvements were made after the initial hardening in step 9.

> *"can we now complete the security improvements listed in todo.md"*

**DOMPurify** was added to sanitise `marked.js` HTML output before it is set as `innerHTML`, preventing XSS from malicious post content:

```js
postBody.innerHTML = DOMPurify.sanitize(marked.parse(post.content || ""));
```

**JWT refresh tokens** — access tokens were reduced from 7 days to 2 hours. A 30-day refresh token is now returned on login and stored in `localStorage`. An `apiFetch` wrapper in `admin.html` silently refreshes the access token on any 401 response and retries the original request:

```js
async function apiFetch(url, options = {}) {
  // ... sends request, on 401 calls POST /api/auth/refresh, retries
}
```

**Verbose error suppression** — a shared `lib/errors.js` helper returns `"Internal server error"` in production instead of exposing raw database error messages.

**Input length limits** — server-side validation added to all write endpoints (title 200, excerpt 500, content 200k, username 50, email 255, tag 50), with matching `maxlength` attributes on all admin forms.

**Attack path blocking** — common probe paths (`.env`, `wp-admin`, `.php`, `xmlrpc`, etc.) now return 404 instead of falling through to the SPA catch-all and returning 200:

```js
const BLOCKED_PATHS = /\.(env|git|sql|bak|log|...)$|wp-admin|wp-login|phpmyadmin|.../i;
app.use((req, res, next) => {
  if (BLOCKED_PATHS.test(req.path)) return res.status(404).end();
  next();
});
```

---

### 15. fail2ban

fail2ban was installed on the EC2 to block IPs with repeated failed SSH login attempts.

> *"yes add it"*

Added to both `deploy.yml` (installs on existing EC2 on next deploy) and the CDK user data (included on fresh installs). Configuration bans an IP for 1 hour after 5 failed attempts within 10 minutes:

```
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
```

The decision was made not to restrict SSH to a specific IP in the AWS Security Group because the GitHub Actions deploy pipeline also connects via SSH, making IP whitelisting impractical.

---

### 16. Admin Log Viewer

An admin-only log viewer was added to the admin panel, reading the Nginx access log directly from the host.

> *"ok go ahead with the log viewer"*

The Express app runs inside Docker so the host's `/var/log` directory is mounted read-only into the container via `docker-compose.yml`:

```yaml
app:
  volumes:
    - /var/log:/host-logs:ro
```

A new `GET /api/logs` endpoint (admin only) in `routes/logs.js` parses the nginx combined log format, applies filters, and returns stats:

```js
function parseLine(line) {
  const m = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d+) (\d+) "[^"]*" "([^"]*)"/);
  if (!m) return null;
  return { ip: m[1], time: m[2], method: m[3], path: m[4], status: parseInt(m[5]), ... };
}
```

The admin panel Logs view shows: summary stats (total requests, unique IPs, attack probes, errors, banned IPs), top 10 IPs by request volume, and a colour-coded request table. Filter buttons: All / Suspicious / 404s / Banned IPs. Attack path rows are highlighted in red. Currently banned IPs are read from `fail2ban.log`.

---

## Typical Workflow

The development process followed a consistent pattern:

1. A feature or problem was described in plain English
2. Claude read the relevant source files, proposed a plan, and implemented it
3. The change was tested locally (`npm run dev` + Docker for the DB)
4. Once working, it was committed and pushed — triggering an automatic deploy to EC2

> *"ok commit"* — the standard sign-off after testing a change locally

---

## Repository Structure

```
blog/
├── server.js              # Express app entry point
├── db.js                  # PostgreSQL connection pool
├── routes/
│   ├── auth.js            # Login, /me, /refresh
│   ├── posts.js           # CRUD, like, hit endpoints
│   ├── tags.js
│   ├── users.js
│   ├── images.js          # Upload, proxy, delete
│   └── logs.js            # Nginx log viewer (admin only)
├── lib/
│   └── errors.js          # Production-safe error helper
├── middleware/
│   └── auth.js            # JWT verify/sign, requireRole, refresh tokens
├── public/
│   ├── index.html         # Home page (post cards)
│   ├── post.html          # Single post view
│   ├── admin.html         # Admin panel
│   ├── login.html         # Login form
│   ├── lightbox.js        # Custom pan/zoom lightbox
│   └── style.css
├── migrations/
│   └── 001_add_post_columns.sql
├── init.sql               # DB schema (runs on fresh install)
├── Dockerfile
├── docker-compose.yml
├── nginx/
│   └── blog.conf
├── infra/                 # AWS CDK stack
│   └── lib/blog-stack.ts
└── .github/
    └── workflows/
        └── deploy.yml
```
