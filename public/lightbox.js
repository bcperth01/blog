(function () {
  function init() {
  // ── Build overlay DOM ──────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.id = "lb-overlay";
  overlay.innerHTML = `
    <div id="lb-window">
      <div id="lb-canvas"></div>
      <div id="lb-toolbar">
        <button id="lb-zoom-in"  title="Zoom in">+</button>
        <button id="lb-zoom-out" title="Zoom out">−</button>
        <button id="lb-reset"    title="Fit to screen">⊙</button>
        <span id="lb-title"></span>
        <button id="lb-close"    title="Close">✕</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const canvas  = document.getElementById("lb-canvas");
  const toolbar = document.getElementById("lb-toolbar");

  let img    = null;   // current <img> element
  let state  = {};

  function applyTransform() {
    img.style.transform =
      `translate(calc(-50% + ${state.x}px), calc(-50% + ${state.y}px)) scale(${state.scale})`;
  }

  function fitScale() {
    return Math.min(
      canvas.clientWidth  * 0.92 / img.naturalWidth,
      canvas.clientHeight * 0.92 / img.naturalHeight,
      1
    );
  }

  function reset() {
    state.scale = fitScale();
    state.x = 0;
    state.y = 0;
    applyTransform();
  }

  function zoomBy(factor, cx, cy) {
    const next = Math.max(0.05, Math.min(20, state.scale * factor));
    if (cx !== undefined) {
      const r  = canvas.getBoundingClientRect();
      const ox = cx - r.left  - r.width  / 2;
      const oy = cy - r.top   - r.height / 2;
      state.x  = ox + (state.x - ox) * (next / state.scale);
      state.y  = oy + (state.y - oy) * (next / state.scale);
    }
    state.scale = next;
    applyTransform();
  }

  // ── Toolbar ────────────────────────────────────────────────
  document.getElementById("lb-zoom-in") .addEventListener("click", e => { e.stopPropagation(); zoomBy(1.3); });
  document.getElementById("lb-zoom-out").addEventListener("click", e => { e.stopPropagation(); zoomBy(1 / 1.3); });
  document.getElementById("lb-reset")   .addEventListener("click", e => { e.stopPropagation(); reset(); });
  document.getElementById("lb-close")   .addEventListener("click", close);

  // ── Close on backdrop click (but not after a drag) ─────────
  let wasDragged = false;
  overlay.addEventListener("click", e => {
    if (wasDragged) { wasDragged = false; return; }
    if (e.target === overlay) close();
  });

  // ── Keyboard ───────────────────────────────────────────────
  document.addEventListener("keydown", e => {
    if (overlay.style.display === "none" || !overlay.style.display === "") return;
    if (e.key === "Escape")               close();
    if (e.key === "+" || e.key === "=")   zoomBy(1.3);
    if (e.key === "-")                    zoomBy(1 / 1.3);
    if (e.key === "0")                    reset();
  });

  // ── Mouse-wheel zoom toward cursor ─────────────────────────
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY);
  }, { passive: false });

  // ── Drag to pan ────────────────────────────────────────────
  let drag = null;
  canvas.addEventListener("mousedown", e => {
    if (toolbar.contains(e.target)) return;
    drag = { sx: e.clientX - state.x, sy: e.clientY - state.y };
    wasDragged = false;
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  });
  window.addEventListener("mousemove", e => {
    if (!drag) return;
    wasDragged = true;
    state.x = e.clientX - drag.sx;
    state.y = e.clientY - drag.sy;
    applyTransform();
  });
  window.addEventListener("mouseup", () => { drag = null; canvas.style.cursor = "grab"; });

  // ── Close ──────────────────────────────────────────────────
  function close() {
    overlay.style.display = "none";
    if (img) { img.src = ""; canvas.innerHTML = ""; img = null; }
  }

  // ── Public API ─────────────────────────────────────────────
  window.openLightbox = function (src, title) {
    document.getElementById("lb-title").textContent = title || "";
    canvas.innerHTML = "";
    img = document.createElement("img");
    img.id = "lb-img";
    img.draggable = false;
    canvas.appendChild(img);

    state = { scale: 1, x: 0, y: 0 };
    applyTransform();
    overlay.style.display = "flex";

    img.onload = reset;
    img.src    = src;
  };
  } // end init

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
