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
Review whether SSH (port 22) should remain open to the world or be restricted to a known IP address.
Consider adding AWS WAF (Web Application Firewall) in front of the EC2 instance if traffic grows.
Current CDK stack opens SSH to `0.0.0.0/0` — fine for now but should be locked down in production:
```typescript
// Replace anyIpv4() with your specific IP:
sg.addIngressRule(ec2.Peer.ipv4("YOUR.IP.HERE/32"), ec2.Port.tcp(22), "SSH from my IP");
```

---

### SEO improvements
- Add `<meta name="description">` to each post page using the post excerpt
- Add `<meta property="og:*">` Open Graph tags (title, description, image) for social sharing previews
- Add a `sitemap.xml` endpoint generated dynamically from published posts
- Add `<link rel="canonical">` to post pages
- Ensure post slugs are human-readable (currently append a timestamp — could be cleaner)

---

### Security improvements
- **CORS**: Review and tighten if additional domains are added
- **XSS via marked.js**: Add DOMPurify to sanitise rendered HTML from post content
- **JWT expiry**: Reduce token lifetime from 7 days to 1–2 hours with a refresh token mechanism
- **Verbose error messages**: Strip DB error details from API responses in production
- **Input length limits**: Add max-length validation on post title, excerpt, username, etc.
- **Rate limiting**: Extend rate limiting beyond just login — consider limiting image uploads and post creation

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
- Consider `fail2ban` on the EC2 to automatically block IPs with repeated failed SSH or login attempts
