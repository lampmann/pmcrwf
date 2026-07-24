/* ============================================================
   layout.js — free-form module layout: move, resize (8 handles),
   snap-to-grid, snap-to-modules, persistent z-order, grid overlay.

   Model: two independent things —
     • "activated": modules are absolutely positioned (the arrangement).
       Once you enter Free mode it stays activated until Reset, so the
       arrangement is kept even after you leave edit mode.
     • "free": EDIT mode — drag/resize handles, inputs disabled, grid overlay.
   Self-contained: injects its own CSS + control bar, operates on any
   `.modules > .module`, persists to localStorage. Only HTML dependency
   is the script tag.
   ============================================================ */
(function () {
  "use strict";
  const LKEY = "charsheet-layout";
  const state = { free: false, activated: false, grid: 8, snapGrid: true, snapEdge: true, zTop: 0, map: {} };
  try { const d = JSON.parse(localStorage.getItem(LKEY)); if (d) Object.assign(state, d); } catch (e) {}

  const DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  const byId = id => document.getElementById(id);
  const container = () => document.querySelector(".modules");
  const modules = () => [...document.querySelectorAll(".modules > .module")];
  const key = m => m.dataset.module || "";
  function save() { try { localStorage.setItem(LKEY, JSON.stringify(state)); } catch (e) {} }

  function injectCSS() {
    if (byId("lay-style")) return;
    const s = document.createElement("style"); s.id = "lay-style";
    s.textContent = `
      #lay-bar { margin: 0 0 .75rem; padding: .35rem .55rem; border: 1px solid #888; display: flex;
        gap: .7rem; align-items: center; flex-wrap: wrap; font-size: .85rem; }
      #lay-bar label { display: inline-flex; align-items: center; gap: .25rem; }
      /* positioning (arrangement) */
      .modules.lay-active { position: relative; }
      .modules.lay-active > .module { position: absolute; margin: 0 !important; overflow: hidden; }
      /* edit mode */
      .modules.lay-free > .module { cursor: move; user-select: none; outline: 1px dashed #999; }
      .modules.lay-free > .module input, .modules.lay-free > .module button,
      .modules.lay-free > .module select, .modules.lay-free > .module textarea,
      .modules.lay-free > .module a { pointer-events: none; }
      .modules.lay-free > .module.lay-dragging { opacity: .92; box-shadow: 0 3px 14px rgba(0,0,0,.4); }
      /* resize handles (8), inset so overflow:hidden doesn't clip them */
      .lay-h { position: absolute; display: none; z-index: 6; }
      .modules.lay-free > .module > .lay-h { display: block; }
      .lay-h.n { top: 0; left: 0; right: 0; height: 6px; cursor: ns-resize; }
      .lay-h.s { bottom: 0; left: 0; right: 0; height: 6px; cursor: ns-resize; }
      .lay-h.e { right: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
      .lay-h.w { left: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
      .lay-h.ne, .lay-h.nw, .lay-h.se, .lay-h.sw { width: 12px; height: 12px; z-index: 7; background: rgba(120,120,120,.5); }
      .lay-h.ne { top: 0; right: 0; cursor: nesw-resize; }
      .lay-h.nw { top: 0; left: 0; cursor: nwse-resize; }
      .lay-h.se { bottom: 0; right: 0; cursor: nwse-resize; }
      .lay-h.sw { bottom: 0; left: 0; cursor: nesw-resize; }
      /* grid overlay */
      #lay-grid { position: absolute; inset: 0; pointer-events: none; z-index: 9999; display: none;
        background-image: linear-gradient(to right, rgba(120,120,120,.28) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(120,120,120,.28) 1px, transparent 1px); }
      .modules.lay-grid-on #lay-grid { display: block; }`;
    document.head.appendChild(s);
  }

  function addHandles() {
    modules().forEach(m => {
      if (m.querySelector(":scope > .lay-h")) return;
      DIRS.forEach(d => { const h = document.createElement("div"); h.className = "lay-h " + d; h.dataset.dir = d; m.appendChild(h); });
    });
  }

  /* ---- positions ---- */
  function ensurePositions() {   // fill missing entries from the current on-screen layout (call while still in flow)
    const crect = container().getBoundingClientRect();
    modules().forEach(m => {
      if (!state.map[key(m)]) {
        const r = m.getBoundingClientRect();
        state.map[key(m)] = { x: Math.max(0, Math.round(r.left - crect.left)), y: Math.max(0, Math.round(r.top - crect.top)), w: Math.round(r.width), h: 0, z: 0 };
      }
    });
  }
  function applyPos(m) {
    const p = state.map[key(m)]; if (!p) return;
    m.style.left = p.x + "px"; m.style.top = p.y + "px"; m.style.width = p.w + "px";
    m.style.height = p.h ? p.h + "px" : ""; if (p.z) m.style.zIndex = p.z;
  }
  function clearPos(m) { m.style.left = m.style.top = m.style.width = m.style.height = m.style.zIndex = ""; }
  function bumpZ(m) { const p = state.map[key(m)]; state.zTop = (state.zTop || 0) + 1; p.z = state.zTop; m.style.zIndex = p.z; }
  function sizeContainer() {
    const c = container(); if (!state.activated) { c.style.minHeight = ""; return; }
    let max = 0; modules().forEach(m => { const p = state.map[key(m)]; const b = (p ? p.y : 0) + m.offsetHeight; if (b > max) max = b; });
    c.style.minHeight = (max + 24) + "px";
  }
  function updateGrid() {
    const on = state.free && state.snapGrid && state.activated;
    const c = container(); c.classList.toggle("lay-grid-on", on);
    if (on) { let g = byId("lay-grid"); if (!g) { g = document.createElement("div"); g.id = "lay-grid"; c.appendChild(g); } g.style.backgroundSize = state.grid + "px " + state.grid + "px"; }
  }
  function apply() {
    const c = container();
    if (state.free) state.activated = true;              // entering edit mode activates the arrangement
    if (state.activated) { ensurePositions(); c.classList.add("lay-active"); modules().forEach(applyPos); sizeContainer(); }
    else { c.classList.remove("lay-active"); modules().forEach(clearPos); c.style.minHeight = ""; }
    c.classList.toggle("lay-free", state.free);
    updateGrid();
  }

  /* ---- snapping ---- */
  function snapMove(m, x, y) {
    const w = m.offsetWidth, h = m.offsetHeight;
    if (state.snapGrid) { const g = state.grid; x = Math.round(x / g) * g; y = Math.round(y / g) * g; }
    if (state.snapEdge) {
      const T = 7;
      modules().forEach(o => {
        if (o === m) return; const p = state.map[key(o)]; if (!p) return;
        const ow = o.offsetWidth, oh = o.offsetHeight;
        if (Math.abs(x - p.x) < T) x = p.x;
        if (Math.abs(x - (p.x + ow)) < T) x = p.x + ow;
        if (Math.abs((x + w) - (p.x + ow)) < T) x = p.x + ow - w;
        if (Math.abs((x + w) - p.x) < T) x = p.x - w;
        if (Math.abs(y - p.y) < T) y = p.y;
        if (Math.abs(y - (p.y + oh)) < T) y = p.y + oh;
        if (Math.abs((y + h) - (p.y + oh)) < T) y = p.y + oh - h;
        if (Math.abs((y + h) - p.y) < T) y = p.y - h;
      });
    }
    return { x: Math.max(0, x), y: Math.max(0, y) };
  }

  /* ---- drag / resize ---- */
  function startDrag(m, e) {
    e.preventDefault();
    const p = state.map[key(m)]; if (!p) return;
    bumpZ(m);
    const sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y;
    document.body.style.userSelect = "none"; m.classList.add("lay-dragging");
    function mv(ev) { const s = snapMove(m, ox + (ev.clientX - sx), oy + (ev.clientY - sy)); p.x = s.x; p.y = s.y; m.style.left = s.x + "px"; m.style.top = s.y + "px"; }
    function up() { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.body.style.userSelect = ""; m.classList.remove("lay-dragging"); sizeContainer(); save(); }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  }
  function startResize(m, e, dir) {
    e.preventDefault(); e.stopPropagation();
    const p = state.map[key(m)]; if (!p) return;
    bumpZ(m);
    const sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y, ow = p.w || m.offsetWidth, oh = p.h || m.offsetHeight;
    const MINW = 140, MINH = 48;
    document.body.style.userSelect = "none";
    function mv(ev) {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let left = ox, top = oy, right = ox + ow, bottom = oy + oh;
      if (dir.includes("e")) right = ox + ow + dx;
      if (dir.includes("w")) left = ox + dx;
      if (dir.includes("s")) bottom = oy + oh + dy;
      if (dir.includes("n")) top = oy + dy;
      if (state.snapGrid) {
        const g = state.grid;
        if (dir.includes("e")) right = Math.round(right / g) * g;
        if (dir.includes("w")) left = Math.round(left / g) * g;
        if (dir.includes("s")) bottom = Math.round(bottom / g) * g;
        if (dir.includes("n")) top = Math.round(top / g) * g;
      }
      if (right - left < MINW) { if (dir.includes("w")) left = right - MINW; else right = left + MINW; }
      if (bottom - top < MINH) { if (dir.includes("n")) top = bottom - MINH; else bottom = top + MINH; }
      left = Math.max(0, left); top = Math.max(0, top);
      p.x = left; p.y = top; p.w = right - left; p.h = bottom - top;
      m.style.left = p.x + "px"; m.style.top = p.y + "px"; m.style.width = p.w + "px"; m.style.height = p.h + "px";
    }
    function up() { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.body.style.userSelect = ""; sizeContainer(); save(); }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  }
  document.addEventListener("pointerdown", e => {
    if (!state.free) return;
    const h = e.target.closest(".lay-h");
    if (h) { const m = h.closest(".module"); if (m) startResize(m, e, h.dataset.dir); return; }
    const m = e.target.closest(".module");
    if (m && m.parentElement && m.parentElement.classList.contains("modules")) startDrag(m, e);
  });

  /* ---- control bar ---- */
  function updateHint() { const el = byId("lay-hint"); if (el) el.textContent = state.free ? "— drag anywhere on a module to move; drag an edge/corner to resize" : (state.activated ? "— arrangement kept; enable Free to edit" : ""); }
  function buildBar() {
    if (byId("lay-bar")) return;
    const bar = document.createElement("div"); bar.id = "lay-bar";
    bar.innerHTML = `<b>Layout:</b>
      <label><input type="checkbox" id="lay-free"> Free (move/resize)</label>
      <label><input type="checkbox" id="lay-grid"> snap to grid</label>
      <label>grid <input type="number" id="lay-gridsize" min="1" max="64" style="width:3rem"></label>
      <label><input type="checkbox" id="lay-edge"> snap to modules</label>
      <button id="lay-reset">reset layout</button>
      <span class="hint" id="lay-hint"></span>`;
    const c = container(); c.parentNode.insertBefore(bar, c);
    byId("lay-free").checked = state.free; byId("lay-grid").checked = state.snapGrid;
    byId("lay-edge").checked = state.snapEdge; byId("lay-gridsize").value = state.grid;
    byId("lay-free").addEventListener("change", e => { state.free = e.target.checked; apply(); save(); updateHint(); });
    byId("lay-grid").addEventListener("change", e => { state.snapGrid = e.target.checked; updateGrid(); save(); });
    byId("lay-edge").addEventListener("change", e => { state.snapEdge = e.target.checked; save(); });
    byId("lay-gridsize").addEventListener("change", e => { state.grid = Math.max(1, Math.min(64, Number(e.target.value) || 8)); e.target.value = state.grid; updateGrid(); save(); });
    byId("lay-reset").addEventListener("click", () => {
      if (confirm("Reset module layout back to the default flow?")) { state.map = {}; state.free = false; state.activated = false; state.zTop = 0; byId("lay-free").checked = false; apply(); save(); updateHint(); }
    });
    updateHint();
  }

  document.addEventListener("DOMContentLoaded", () => { injectCSS(); buildBar(); addHandles(); apply(); });
  window.__layout = { state, apply, snapMove, modules, ensurePositions, save };  // debug/test hook
})();
