# User Manual — Brendan's Blog

This manual covers how to use the blog as a **reader**, a **contributor**, and an **admin**.

---

## Table of Contents

1. [Reading the Blog (Public)](#1-reading-the-blog-public)
2. [Games](#2-games)
3. [Logging In](#3-logging-in)
4. [Contributors — Writing Posts](#4-contributors--writing-posts)
5. [Contributors — Managing Images](#5-contributors--managing-images)
6. [Admins — Managing Posts](#6-admins--managing-posts)
7. [Admins — Managing Users](#7-admins--managing-users)
8. [Admins — Managing Tags](#8-admins--managing-tags)
9. [Admins — Images](#9-admins--images)
10. [Admins — Traffic](#10-admins--traffic)
11. [Admins — Backups](#11-admins--backups)
12. [Admins — Logs](#12-admins--logs)

---

## 1. Reading the Blog (Public)

No login is required to read the blog.

### Browsing Posts
The home page shows a grid of post cards. Each card displays:
- The post image (if set)
- Title and excerpt
- Tags
- Like count, view count, and a **Read** button

Click **Read** or the post title to open the full post.

### Searching
Type a search term into the search box and press **Enter** or click **Search**. The search covers post titles, excerpts, and content. Clear the box and search again to reset.

### Filtering by Tag
Click any tag in the tag list on the home page to filter posts to that tag. Click the tag again or click **All** to clear the filter.

### Liking a Post
Click the ♡ button on a post card or post page to like it. You can only like each post once per browser session.

### Dark Mode
Click the moon/sun icon in the top-right corner to toggle between light and dark mode. Your preference is saved in the browser.

---

## 2. Games

Click **Games** in the navigation bar to open the Games page. No login is required.

### Four in a Row
A classic strategy game played on a 7×6 grid. You play as **red**, the computer plays as **yellow**.

- Click the **▼ arrow** above a column (or anywhere within the column) to drop your disc.
- The first player to connect four discs in a row — horizontally, vertically, or diagonally — wins.
- The winning discs will pulse to highlight the winning line.
- Click **New Game** to reset the board at any time.
- Use the **Difficulty** selector to choose Easy, Medium, or Hard before starting a new game.

---

## 3. Logging In

Navigate to `/login.html` or click **Admin** in the navigation bar.

Enter your username and password and click **Login**. You will be redirected to the admin panel on success.

Your session uses a 2-hour access token that is automatically refreshed in the background — you will not be logged out unexpectedly during normal use. The refresh token lasts 30 days.

To log out, click **Logout** in the top-right corner of the admin panel.

---

## 4. Contributors — Writing Posts

### Creating a New Post
1. Click **+ New Post** in the admin panel toolbar.
2. Fill in the fields:
   - **Title** — required, max 200 characters
   - **Excerpt** — brief description shown on the post card, max 500 characters
   - **Content** — the full post body, written in Markdown (see below)
   - **Tags** — type a tag name and press Enter or click **Add Tag**; click a tag to remove it
   - **Card Image** — click **Choose Image** to select from the image library; click **✕ Clear** to remove
   - **Published** — tick to make the post visible to the public; leave unticked to save as a draft
3. Click **Save Post**.

### Markdown Guide
The content field accepts standard Markdown:

| Syntax | Result |
|---|---|
| `# Heading` | H1 heading |
| `## Heading` | H2 heading |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | inline code |
| `[text](url)` | hyperlink |
| `![alt](url)` | image |
| ` ```js ` … ` ``` ` | syntax-highlighted code block |

To embed an image from the image library, go to **Images**, find the image, and click **Copy MD** — this copies the correct Markdown snippet to your clipboard. Paste it into the content field.

### Markdown Right-Click Menu
Right-clicking inside the content editor opens a formatting menu with shortcuts for common Markdown syntax:

| Menu item | Inserts |
|---|---|
| **Bold** | `**selected text**` |
| **Italic** | `*selected text*` |
| **Inline code** | `` `selected text` `` |
| **Code block** | ` ```\nselected text\n``` ` |
| **Heading** | `## selected text` |
| **Bullet list** | `- selected text` |
| **Link** | `[selected text](url)` |
| **Image** | `![alt](url)` |
| **Blockquote** | `> selected text` |
| **Horizontal rule** | `---` |

If you have text selected when you right-click, the menu will wrap or prefix that selection. Otherwise the syntax is inserted at the cursor position.

### Previewing a Post
Click **👁 Preview** above the content area to toggle a rendered preview of your Markdown. Click again to return to the editor.

### Editing a Post
Click the **⋮** menu on any of your posts in the posts table, then select **Edit**.

### Publishing / Unpublishing
Use the **⋮** menu → **Publish** or **Unpublish**. Published posts are visible to the public; unpublished posts are drafts only visible to you and admins.

### Deleting a Post
Use the **⋮** menu → **Delete**. You will be asked to confirm. Only admins and the post's author can delete a post.

---

## 5. Contributors — Managing Images

Click **Images** in the admin toolbar to open the image library.

### Uploading Images
Click **Upload Image** and select one or more image files (max 20 MB each). A progress bar shows upload status. Each image is automatically resized into three versions: thumbnail, card, and full size.

### Finding an Image
Use the search box to filter images by filename.

### Using an Image in a Post
Click **Copy MD** on an image card to copy a Markdown image snippet to your clipboard. Paste it into any post's content field.

### Zooming In
Click an image thumbnail to open it in the lightbox viewer. You can pan by dragging and zoom with the scroll wheel.

### In Use Badge
Images that are currently referenced in one or more posts show a green **In use** badge. This is useful before deciding whether to delete an image.

---

## 6. Admins — Managing Posts

Admins see all posts from all users in the posts table. The table columns are:

| Column | Meaning |
|---|---|
| **Title** | Post title |
| **Pub** | Green ✓ = published, Red ✗ = draft |
| **App** | Green ✓ = approved, Red ✗ = pending approval |
| **Created** | Date created |
| **Tags** | Tags assigned to the post |
| **Author** | The user who created the post |
| **Actions** | ⋮ dropdown menu |

### Approving / Unapproving Posts
Use the **⋮** menu → **Approve** or **Unapprove**. Only approved posts are visible to the public (even if published). Use this to review contributor submissions before they go live.

> **Workflow:** A contributor creates a post and publishes it. The admin reviews it and clicks **Approve** to make it publicly visible.

---

## 7. Admins — Managing Users

Click **Manage Users** in the admin toolbar (admin only).

### Adding a User
Click **+ New User** and fill in:
- **Username** — max 50 characters
- **Email** — max 255 characters
- **Password**
- **Role** — `admin` or `contributor`

Click **Save**.

### Editing a User
Click **Edit** next to the user. You can change their username, email, role, or password. Leave the password field blank to keep the existing password.

### Deleting a User
Click **Delete** next to the user. If the user has posts, those posts will remain but will show no author. You will be asked to confirm.

> You cannot delete your own account.

---

## 8. Admins — Managing Tags

Click **Manage Tags** in the admin toolbar.

### Adding a Tag
Type a tag name (max 50 characters) in the input box and click **Add Tag** or press Enter.

### Deleting a Tag
Click **Delete** next to the tag. The tag will be removed from all posts that use it. You will be asked to confirm.

---

## 9. Admins — Images

Admins have full access to the image library including the ability to delete images.

### Deleting an Image
Click the **Delete** button on an image card. Before asking for confirmation, the system checks whether the image is referenced in any post (as a card image or embedded in content).

- If the image **is referenced**, the confirm dialog lists the affected post titles and warns that deleting will break them.
- If the image **is not referenced**, the confirm dialog notes it is safe to delete.

Click **Delete** in the dialog to confirm, or **Cancel** to abort.

---

## 10. Admins — Traffic

Click **Traffic** in the admin toolbar (admin only) to view site page view statistics.

The Traffic view shows:
- **Total views** — total page views recorded in the last 30 days
- **Today** — page views recorded today
- **Active days** — number of days with at least one view in the last 30 days
- **Bar chart** — daily page views for the last 30 days; today's bar is highlighted

A page view is recorded whenever a visitor loads the home page or opens a post. Admin panel visits are not counted.

Click **↻ Refresh** to reload the data.

---

## 11. Admins — Backups

Click **Backups** in the admin toolbar (admin only) to manage database backups.

### Automatic Backups
A full database backup (`pg_dump`) runs automatically every day at **2am UTC**. Backups are stored in S3 and retained for 30 days.

### Manual Backup
Click **⬆ Backup Now** to trigger an immediate backup. The backup will appear in the list when complete.

### Viewing Backups
The backup list shows each backup's filename, size, and creation date. Click **↻ Refresh** to reload the list.

### Restoring a Backup
Restores must be done manually via SSH into the EC2 server:

```bash
aws s3 cp s3://BUCKET/backups/FILENAME.sql.gz - | gunzip | docker compose exec -T db psql -U bloguser blogdb
```

Replace `BUCKET` and `FILENAME` with the values shown in the backup list.

---

## 12. Admins — Logs

Click **Logs** in the admin toolbar (admin only) to view the Nginx access log.

### Summary Stats
The top of the Logs view shows:
- Total requests, unique IPs, attack probes, errors
- Currently banned IPs (blocked by fail2ban after repeated failed attempts)
- Top 10 IPs by request volume

### Filters
| Filter | Shows |
|---|---|
| **All** | Every request |
| **Suspicious** | Known attack paths (wp-admin, .env, .php, etc.) and 4xx/5xx responses |
| **404s** | Not-found requests only |
| **Banned IPs** | Requests from IPs currently banned by fail2ban |

### Row Colours
- **Red** — known attack probe paths (e.g. `wp-admin`, `xmlrpc.php`, `.env`)
- Normal — regular requests

Click **↻ Refresh** to reload the log.
