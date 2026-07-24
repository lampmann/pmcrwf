/* ============================================================
   layout.js — free-form module layout: move, resize, snap-to-grid,
   snap-to-modules. Self-contained: injects its own CSS + control bar,
   operates on any `.modules > .module`, persists to localStorage.
   Off by default (normal flow); toggle "Free" to arrange.
   ============================================================ */
(function () {
  "use strict";
  const LKEY = "charsheet-layout";
  const state = { free: false, grid: 8, snapGrid: true, snapEdge: true, map: {} };
  try { const d = JSON.parse(localStorage.getItem(LKEY)); if (d) Object.assign(state, d); } catch (e) {}

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
      .modules.lay-free { position: relative; }
      .modules.lay-free > .module { position: absolute; margin: 0 !important; overflow: auto; }
      .modules.lay-free > .module > h2 { cursor: move; user-select: none; }
      .modules.lay-free > .module.lay-dragging { opacity: .92; box-shadow: 0 3px 12px rgba(0,0,0,.35); z-index: 10; }
      .lay-resize { display: none; }
      .modules.lay-free > .module > .lay-resize { display: block; position: absolute; right: 0; bottom: 0;
        width: 16px; height: 16px; cursor: nwse-resize; z-index: 5;
        background: linear-gradient(135deg, transparent 45%, #999 45%, #999 55%, transparent 55%, transparent 70%, #999 70%, #999 80%, transparent 80%); }`;
    document.head.appendChild(s);
  }

  function addHandles() {
    modules().forEach(m => {
      if (!m.querySelector(":scope > .lay-resize")) { const h = document.createElement("div"); h.className = "lay-resize"; m.appendChild(h); }
    });
  }

  /* ---- positions ---- */
  function ensurePositions() {   // fill any missing entries from the current flow layout
    const crect = container().getBoundingClientRect();
    modules().forEach(m => {
      if (!state.map[key(m)]) {
        const r = m.getBoundingClientRect();
        state.map[key(m)] = { x: Math.max(0, Math.round(r.left - crect.left)), y: Math.max(0, Math.round(r.top - crect.top)), w: Math.round(r.width), h: 0 };
      }
    });
  }
  function applyPos(m) { const p = state.map[key(m)]; if (!p) return; m.style.left = p.x + "px"; m.style.top = p.y + "px"; m.style.width = p.w + "px"; m.style.height = p.h ? p.h + "px" : ""; }
  function clearPos(m) { m.style.left = m.style.top = m.style.width = m.style.height = ""; }
  function sizeContainer() {
    const c = container();
    if (!state.free) { c.style.minHeight = ""; return; }
    let max = 0; modules().forEach(m => { const p = state.map[key(m)]; const bottom = (p ? p.y : 0) + m.offsetHeight; if (bottom > max) max = bottom; });
    c.style.minHeight = (max + 24) + "px";
  }
  function apply() {
    const c = container();
    c.classList.toggle("lay-free", state.free);
    if (state.free) { ensurePositions(); modules().forEach(applyPos); sizeContainer(); }
    else { modules().forEach(clearPos); c.style.minHeight = ""; }
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
        if (Math.abs(x - p.x) < T) x = p.x;                          // left ↔ left
        if (Math.abs(x - (p.x + ow)) < T) x = p.x + ow;              // my left ↔ its right (adjacent)
        if (Math.abs((x + w) - (p.x + ow)) < T) x = p.x + ow - w;    // right ↔ right
        if (Math.abs((x + w) - p.x) < T) x = p.x - w;                // my right ↔ its left (adjacent)
        if (Math.abs(y - p.y) < T) y = p.y;                          // top ↔ top
        if (Math.abs(y - (p.y + oh)) < T) y = p.y + oh;              // my top ↔ its bottom (stack)
        if (Math.abs((y + h) - (p.y + oh)) < T) y = p.y + oh - h;    // bottom ↔ bottom
        if (Math.abs((y + h) - p.y) < T) y = p.y - h;                // my bottom ↔ its top (stack)
      });
    }
    return { x: Math.max(0, x), y: Math.max(0, y) };
  }

  /* ---- drag / resize ---- */
  function startDrag(m, e) {
    e.preventDefault();
    const p = state.map[key(m)]; if (!p) return;
    const sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y;
    document.body.style.userSelect = "none"; m.classList.add("lay-dragging");
    function mv(ev) { const s = snapMove(m, ox + (ev.clientX - sx), oy + (ev.clientY - sy)); p.x = s.x; p.y = s.y; m.style.left = s.x + "px"; m.style.top = s.y + "px"; }
    function up() { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.body.style.userSelect = ""; m.classList.remove("lay-dragging"); sizeContainer(); save(); }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  }
  function startResize(m, e) {
    e.preventDefault(); e.stopPropagation();
    const p = state.map[key(m)]; if (!p) return;
    const sx = e.clientX, sy = e.clientY, ow = p.w || m.offsetWidth, oh = p.h || m.offsetHeight;
    document.body.style.userSelect = "none";
    function mv(ev) {
      let w = ow + (ev.clientX - sx), h = oh + (ev.clientY - sy);
      if (state.snapGrid) { const g = state.grid; w = Math.round(w / g) * g; h = Math.round(h / g) * g; }
      p.w = Math.max(140, w); p.h = Math.max(56, h); m.style.width = p.w + "px"; m.style.height = p.h + "px";
    }
    function up() { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.body.style.userSelect = ""; sizeContainer(); save(); }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  }
  document.addEventListener("pointerdown", e => {
    if (!state.free) return;
    const rh = e.target.closest(".lay-resize"); if (rh) { startResize(rh.closest(".module"), e); return; }
    const h2 = e.target.closest("h2"), m = e.target.closest(".module");
    if (h2 && m && h2.parentElement === m && m.parentElement && m.parentElement.classList.contains("modules")) startDrag(m, e);
  });

  /* ---- control bar ---- */
  function updateHint() { const el = byId("lay-hint"); if (el) el.textContent = state.free ? "— drag a module's title to move; drag its bottom-right corner to resize" : ""; }
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
    byId("lay-grid").addEventListener("change", e => { state.snapGrid = e.target.checked; save(); });
    byId("lay-edge").addEventListener("change", e => { state.snapEdge = e.target.checked; save(); });
    byId("lay-gridsize").addEventListener("change", e => { state.grid = Math.max(1, Math.min(64, Number(e.target.value) || 8)); e.target.value = state.grid; save(); });
    byId("lay-reset").addEventListener("click", () => {
      if (confirm("Reset module layout back to the default flow?")) { state.map = {}; state.free = false; byId("lay-free").checked = false; apply(); save(); updateHint(); }
    });
    updateHint();
  }

  document.addEventListener("DOMContentLoaded", () => { injectCSS(); buildBar(); addHandles(); apply(); });
  window.__layout = { state, apply, snapMove, modules, ensurePositions, save };  // debug/test hook
})();
