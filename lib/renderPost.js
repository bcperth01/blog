const { marked } = require("marked");

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function renderCardHand(codesStr) {
  const SUITS = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const RED = new Set(["H", "D"]);
  const cards = codesStr.trim().split(/\s+/).map(code => {
    code = code.toUpperCase();
    const suit = code.slice(-1), rank = code.slice(0, -1);
    if (!SUITS[suit] || !["A","2","3","4","5","6","7","8","9","T","J","Q","K"].includes(rank)) return "";
    const cls = RED.has(suit) ? "playing-card red" : "playing-card";
    return `<div class="${cls}"><span class="card-rank">${rank}</span><span class="card-suit">${SUITS[suit]}</span></div>`;
  }).join("");
  return `<div class="card-hand">${cards}</div>`;
}

function renderContent(markdown) {
  const processed = (markdown || "").replace(
    /\[cards:\s*([^\]]+)\]/g,
    (_, codes) => renderCardHand(codes)
  );
  return marked.parse(processed);
}

function renderPostHtml(post, siteUrl) {
  const canonical  = `${siteUrl}/posts/${post.slug}`;
  const pageTitle  = `${post.title} \u2014 Brendan's Blog`;
  const desc       = post.excerpt || "";
  const ogImage    = post.card_image ? `${siteUrl}${post.card_image}` : "";
  const noindex    = post.noindex ? '<meta name="robots" content="noindex, nofollow" />' : "";
  const tagsHtml   = (post.tags || [])
    .map(t => `<a href="/?tag=${escHtml(t.slug)}" class="tag">${escHtml(t.name)}</a>`)
    .join(" ");
  const bodyHtml   = renderContent(post.content);
  const ldJson     = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: desc,
    image: ogImage || undefined,
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    url: canonical,
    author: { "@type": "Person", name: post.author_username || "Brendan" },
    publisher: { "@type": "Organization", name: "Brendan's Blog", url: siteUrl }
  }).replace(/<\/script>/gi, "<\\/script>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(pageTitle)}</title>
  ${noindex}
  <meta name="description" content="${escHtml(desc)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Brendan's Blog" />
  <meta property="og:title" content="${escHtml(pageTitle)}" />
  <meta property="og:description" content="${escHtml(desc)}" />
  <meta property="og:image" content="${escHtml(ogImage)}" />
  <meta property="og:url" content="${escHtml(canonical)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escHtml(desc)}" />
  <meta name="twitter:image" content="${escHtml(ogImage)}" />
  <link rel="canonical" href="${escHtml(canonical)}" />
  <script type="application/ld+json">${ldJson}</script>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <header>
    <div class="header-inner">
      <a class="site-title" href="/">Brendan's Blog</a>
      <nav>
        <a href="/">Home</a>
        <a href="/games.html">Games</a>
        <a href="/admin.html" id="nav-admin" style="display:none">Admin</a>
        <a href="/login.html" id="nav-login">Login</a>
      </nav>
      <button id="theme-toggle" title="Toggle dark mode">🌙</button>
    </div>
  </header>
  <script>
    (function() {
      const saved = localStorage.getItem("theme");
      if (saved) document.documentElement.setAttribute("data-theme", saved);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches)
        document.documentElement.setAttribute("data-theme", "dark");
    })();
  </script>

  <main class="container">
    <article>
      <div class="post-header">
        <h1>${escHtml(post.title)}</h1>
        <div class="meta">
          <span>${formatDate(post.created_at)}</span>
          <span style="margin-left:0.75rem">${tagsHtml}</span>
        </div>
      </div>
      <div class="post-body">${bodyHtml}</div>
      <div style="margin-top:2rem">
        <a href="/" class="btn btn-secondary">\u2190 Back to posts</a>
      </div>
    </article>
  </main>

  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css" />
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
  <script src="/lightbox.js"></script>
  <script>
    // Syntax highlight code blocks
    document.querySelectorAll("pre code").forEach(el => hljs.highlightElement(el));

    // Lightbox for images
    document.querySelectorAll(".post-body img").forEach(img => {
      const filename = decodeURIComponent(img.src.split("/").pop().split("?")[0]);
      const fullSrc = "/api/images/proxy/images/" + encodeURIComponent(filename);
      img.style.cursor = "zoom-in";
      img.addEventListener("click", () => openLightbox(fullSrc, img.alt || filename));
    });

    // Show admin nav link if logged in
    if (localStorage.getItem("authToken")) {
      document.getElementById("nav-admin").style.display = "";
      document.getElementById("nav-login").style.display = "none";
    }

    // Theme toggle
    const btn = document.getElementById("theme-toggle");
    function applyTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      btn.textContent = theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
      localStorage.setItem("theme", theme);
    }
    const current = document.documentElement.getAttribute("data-theme") || "light";
    btn.textContent = current === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
    btn.addEventListener("click", () => {
      applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });

    // Hit counters (fire-and-forget)
    fetch("/api/posts/${post.id}/hit", { method: "POST" });
    fetch("/api/stats/hit", { method: "POST" });
  </script>
</body>
</html>`;
}

module.exports = { renderPostHtml };
