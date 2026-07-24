/* ============================================================
   layout.js — free-form module layout.
   Move, resize (8 handles), snap-to-grid, snap-to-modules, persistent
   z-order, grid overlay, marquee multi-select (group move + group resize),
   scroll-follow + edge auto-scroll while dragging, save/load layout file.

   Model: `activated` = modules absolutely positioned (arrangement persists);
   `free` = EDIT mode (drag/resize/select, inputs disabled, grid overlay).
   Styles live in css/layout.css. Only HTML dependency is the script tag +
   the css/layout.css <link>.
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
  const moduleByKey = k => modules().find(m => key(m) === k) || null;
  const sX = () => window.scrollX || window.pageXOffset || 0;
  const sY = () => window.scrollY || window.pageYOffset || 0;
  function save() { try { localStorage.setItem(LKEY, JSON.stringify(state)); } catch (e) {} }

  /* ---- selection ---- */
  const selected = new Set();
  const selectedModules = () => [...selected].map(moduleByKey).filter(Boolean);
  function clearSelection() { selected.clear(); updateSelectionUI(); }
  function selectAdd(m) { selected.add(key(m)); }
  function toggleSelect(m) { if (selected.has(key(m))) selected.delete(key(m)); else selected.add(key(m)); updateSelectionUI(); }
  function updateSelectionUI() {
    modules().forEach(m => m.classList.toggle("lay-selected", selected.has(key(m))));
    updateSelbox();
  }

  /* ---- handles ---- */
  function addHandles() {
    modules().forEach(m => {
      if (m.querySelector(":scope > .lay-h")) return;
      DIRS.forEach(d => { const h = document.createElement("div"); h.className = "lay-h " + d; h.dataset.dir = d; m.appendChild(h); });
    });
  }

  /* ---- positions ---- */
  function ensurePositions() {
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
  function bumpZ(m) { const p = state.map[key(m)]; if (!p) return; state.zTop = (state.zTop || 0) + 1; p.z = state.zTop; m.style.zIndex = p.z; }
  function sizeContainer() {
    const c = container(); if (!state.activated) { c.style.minHeight = ""; return; }
    let max = 0; modules().forEach(m => { const p = state.map[key(m)]; const b = (p ? p.y : 0) + m.offsetHeight; if (b > max) max = b; });
    c.style.minHeight = (max + 24) + "px";
  }
  function updateGrid() {
    const on = state.free && state.snapGrid && state.activated;
    const c = container(); c.classList.toggle("lay-grid-on", on);
    if (on) { let g = byId("lay-grid-overlay"); if (!g) { g = document.createElement("div"); g.id = "lay-grid-overlay"; c.appendChild(g); } g.style.backgroundSize = state.grid + "px " + state.grid + "px"; }
  }
  function apply() {
    const c = container();
    if (state.free) state.activated = true;
    if (state.activated) { ensurePositions(); c.classList.add("lay-active"); modules().forEach(applyPos); sizeContainer(); }
    else { c.classList.remove("lay-active"); modules().forEach(clearPos); c.style.minHeight = ""; clearSelection(); }
    c.classList.toggle("lay-free", state.free);
    if (!state.free) clearSelection();
    updateGrid(); updateSelbox();
  }

  /* ---- snapping ---- */
  function snapGridOnly(x, y) { if (state.snapGrid) { const g = state.grid; x = Math.round(x / g) * g; y = Math.round(y / g) * g; } return { x: Math.max(0, x), y: Math.max(0, y) }; }
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
  function snapResizeEdges(m, dir, left, top, right, bottom) {
    if (state.snapGrid) {
      const g = state.grid;
      if (dir.includes("e")) right = Math.round(right / g) * g;
      if (dir.includes("w")) left = Math.round(left / g) * g;
      if (dir.includes("s")) bottom = Math.round(bottom / g) * g;
      if (dir.includes("n")) top = Math.round(top / g) * g;
    }
    if (state.snapEdge) {
      const T = 7;
      modules().forEach(o => {
        if (o === m) return; const p = state.map[key(o)]; if (!p) return;
        const ow = o.offsetWidth, oh = o.offsetHeight, ex = [p.x, p.x + ow], ey = [p.y, p.y + oh];
        if (dir.includes("e")) ex.forEach(v => { if (Math.abs(right - v) < T) right = v; });
        if (dir.includes("w")) ex.forEach(v => { if (Math.abs(left - v) < T) left = v; });
        if (dir.includes("s")) ey.forEach(v => { if (Math.abs(bottom - v) < T) bottom = v; });
        if (dir.includes("n")) ey.forEach(v => { if (Math.abs(top - v) < T) top = v; });
      });
    }
    return { left, top, right, bottom };
  }

  /* ---- edge auto-scroll ---- */
  function edgeScrollSpeed(cx, cy) {
    const EDGE = 70, MAX = 24; let x = 0, y = 0;
    if (cy < EDGE) y = -Math.ceil((EDGE - cy) / EDGE * MAX);
    else if (cy > innerHeight - EDGE) y = Math.ceil((cy - (innerHeight - EDGE)) / EDGE * MAX);
    if (cx < EDGE) x = -Math.ceil((EDGE - cx) / EDGE * MAX);
    else if (cx > innerWidth - EDGE) x = Math.ceil((cx - (innerWidth - EDGE)) / EDGE * MAX);
    return { x, y };
  }

  /* ---- drag (single or group) with scroll-follow + auto-scroll ---- */
  function startDrag(primary, e) {
    e.preventDefault();
    bumpZ(primary);
    const grp = (selected.has(key(primary)) && selected.size > 1) ? selectedModules() : [primary];
    const isGroup = grp.length > 1;
    grp.forEach(m => m.classList.add("lay-dragging"));
    const origins = new Map(grp.map(m => [m, { ...state.map[key(m)] }]));
    const startPX = e.clientX + sX(), startPY = e.clientY + sY();
    let lastCX = e.clientX, lastCY = e.clientY;
    document.body.style.userSelect = "none";
    function update() {
      const dx = (lastCX + sX()) - startPX, dy = (lastCY + sY()) - startPY;
      const po = origins.get(primary);
      const s = isGroup ? snapGridOnly(po.x + dx, po.y + dy) : snapMove(primary, po.x + dx, po.y + dy);
      const adx = s.x - po.x, ady = s.y - po.y;
      grp.forEach(m => { const o = origins.get(m), p = state.map[key(m)]; p.x = Math.max(0, o.x + adx); p.y = Math.max(0, o.y + ady); m.style.left = p.x + "px"; m.style.top = p.y + "px"; });
      if (isGroup) updateSelbox();
    }
    function mv(ev) { lastCX = ev.clientX; lastCY = ev.clientY; update(); }
    function onScroll() { update(); }
    let raf = requestAnimationFrame(function tick() { const sp = edgeScrollSpeed(lastCX, lastCY); if (sp.x || sp.y) { scrollBy(sp.x, sp.y); update(); } raf = requestAnimationFrame(tick); });
    function up() {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); removeEventListener("scroll", onScroll);
      document.body.style.userSelect = ""; grp.forEach(m => m.classList.remove("lay-dragging")); sizeContainer(); save();
    }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- single-module resize (8 handles) ---- */
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
      ({ left, top, right, bottom } = snapResizeEdges(m, dir, left, top, right, bottom));
      if (right - left < MINW) { if (dir.includes("w")) left = right - MINW; else right = left + MINW; }
      if (bottom - top < MINH) { if (dir.includes("n")) top = bottom - MINH; else bottom = top + MINH; }
      left = Math.max(0, left); top = Math.max(0, top);
      p.x = left; p.y = top; p.w = right - left; p.h = bottom - top;
      m.style.left = p.x + "px"; m.style.top = p.y + "px"; m.style.width = p.w + "px"; m.style.height = p.h + "px";
    }
    function up() { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.body.style.userSelect = ""; sizeContainer(); save(); }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  }

  /* ---- group selection box + proportional group resize ---- */
  function selectionRect() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedModules().forEach(m => { const p = state.map[key(m)]; const w = p.w || m.offsetWidth, h = p.h || m.offsetHeight; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + w); maxY = Math.max(maxY, p.y + h); });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function updateSelbox() {
    let box = byId("lay-selbox");
    if (!state.free || selected.size < 2) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "lay-selbox"; DIRS.forEach(d => { const h = document.createElement("div"); h.className = "lay-sh " + d; h.dataset.dir = d; box.appendChild(h); }); container().appendChild(box); }
    const r = selectionRect(); box.style.left = r.x + "px"; box.style.top = r.y + "px"; box.style.width = r.w + "px"; box.style.height = r.h + "px";
  }
  function startGroupResize(dir, e) {
    e.preventDefault(); e.stopPropagation();
    const mods = selectedModules(); const box0 = selectionRect();
    const origins = new Map(mods.map(m => [m, { x: state.map[key(m)].x, y: state.map[key(m)].y, w: state.map[key(m)].w || m.offsetWidth, h: state.map[key(m)].h || m.offsetHeight }]));
    const sx = e.clientX, sy = e.clientY;
    document.body.style.userSelect = "none";
    function mv(ev) {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let left = box0.x, top = box0.y, right = box0.x + box0.w, bottom = box0.y + box0.h;
      if (dir.includes("e")) right = box0.x + box0.w + dx;
      if (dir.includes("w")) left = box0.x + dx;
      if (dir.includes("s")) bottom = box0.y + box0.h + dy;
      if (dir.includes("n")) top = box0.y + dy;
      left = Math.max(0, left); top = Math.max(0, top);
      const nW = Math.max(60, right - left), nH = Math.max(40, bottom - top);
      const scX = nW / box0.w, scY = nH / box0.h;
      mods.forEach(m => {
        const o = origins.get(m), p = state.map[key(m)];
        p.x = Math.round(left + (o.x - box0.x) * scX); p.y = Math.round(top + (o.y - box0.y) * scY);
        p.w = Math.max(60, Math.round(o.w * scX)); p.h = Math.max(40, Math.round(o.h * scY));
        m.style.left = p.x + "px"; m.style.top = p.y + "px"; m.style.width = p.w + "px"; m.style.height = p.h + "px";
      });
      updateSelbox();
    }
    function up() { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.body.style.userSelect = ""; sizeContainer(); save(); }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  }

  /* ---- marquee ---- */
  function startMarquee(e, cont) {
    clearSelection();
    const band = document.createElement("div"); band.id = "lay-marquee"; cont.appendChild(band);
    const ox = e.clientX, oy = e.clientY;
    function bounds(ev) { return { x1: Math.min(ox, ev.clientX), y1: Math.min(oy, ev.clientY), x2: Math.max(ox, ev.clientX), y2: Math.max(oy, ev.clientY) }; }
    function mv(ev) { const b = bounds(ev), cr = cont.getBoundingClientRect(); band.style.left = (b.x1 - cr.left) + "px"; band.style.top = (b.y1 - cr.top) + "px"; band.style.width = (b.x2 - b.x1) + "px"; band.style.height = (b.y2 - b.y1) + "px"; }
    function up(ev) {
      const b = bounds(ev); document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); band.remove();
      modules().forEach(m => { const r = m.getBoundingClientRect(); if (r.right > b.x1 && r.left < b.x2 && r.bottom > b.y1 && r.top < b.y2) selectAdd(m); });
      updateSelectionUI();
    }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  }

  /* ---- pointer routing ---- */
  document.addEventListener("pointerdown", e => {
    if (!state.free || e.button !== 0) return;
    const sh = e.target.closest("#lay-selbox .lay-sh"); if (sh) { startGroupResize(sh.dataset.dir, e); return; }
    const rh = e.target.closest(".lay-h"); if (rh) { const m = rh.closest(".module"); if (m) startResize(m, e, rh.dataset.dir); return; }
    const m = e.target.closest(".module");
    if (m && m.parentElement && m.parentElement.classList.contains("modules")) {
      if (e.shiftKey) { toggleSelect(m); return; }
      if (!selected.has(key(m))) clearSelection();
      startDrag(m, e); return;
    }
    const cont = e.target.closest(".modules"); if (cont) startMarquee(e, cont);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && state.free) clearSelection(); });

  /* ---- save / load layout file ---- */
  function exportLayout() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pmcrwf-layout.json"; a.click();
  }
  function importLayout(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result); if (typeof d !== "object" || !d.map) throw new Error("not a layout file");
        Object.assign(state, { free: false }, d, { free: false });
        syncControls(); apply(); save();
      } catch (err) { alert("Bad layout file: " + err); }
    };
    rd.readAsText(file);
  }

  /* ---- control bar ---- */
  function syncControls() {
    if (byId("lay-free")) byId("lay-free").checked = state.free;
    if (byId("lay-grid")) byId("lay-grid").checked = state.snapGrid;
    if (byId("lay-edge")) byId("lay-edge").checked = state.snapEdge;
    if (byId("lay-gridsize")) byId("lay-gridsize").value = state.grid;
  }
  function updateHint() { const el = byId("lay-hint"); if (el) el.textContent = state.free ? "— drag anywhere to move (drag-box to multi-select); edges/corners resize" : (state.activated ? "— arrangement kept; enable Free to edit" : ""); }
  function buildBar() {
    if (byId("lay-bar")) return;
    const bar = document.createElement("div"); bar.id = "lay-bar";
    bar.innerHTML = `<b>Layout:</b>
      <label><input type="checkbox" id="lay-free"> Free (move/resize)</label>
      <label><input type="checkbox" id="lay-grid"> snap to grid</label>
      <label>grid <input type="number" id="lay-gridsize" min="1" max="64" style="width:3rem"></label>
      <label><input type="checkbox" id="lay-edge"> snap to modules</label>
      <button id="lay-reset">reset</button>
      <button id="lay-save">save file</button>
      <label>load <input type="file" id="lay-load" accept="application/json" style="width:8.5rem"></label>
      <span class="hint" id="lay-hint"></span>`;
    const c = container(); c.parentNode.insertBefore(bar, c);
    syncControls();
    byId("lay-free").addEventListener("change", e => { state.free = e.target.checked; apply(); save(); updateHint(); });
    byId("lay-grid").addEventListener("change", e => { state.snapGrid = e.target.checked; updateGrid(); save(); });
    byId("lay-edge").addEventListener("change", e => { state.snapEdge = e.target.checked; save(); });
    byId("lay-gridsize").addEventListener("change", e => { state.grid = Math.max(1, Math.min(64, Number(e.target.value) || 8)); e.target.value = state.grid; updateGrid(); save(); });
    byId("lay-reset").addEventListener("click", () => { if (confirm("Reset module layout back to the default flow?")) { state.map = {}; state.free = false; state.activated = false; state.zTop = 0; clearSelection(); syncControls(); apply(); save(); updateHint(); } });
    byId("lay-save").addEventListener("click", exportLayout);
    byId("lay-load").addEventListener("change", e => { if (e.target.files[0]) importLayout(e.target.files[0]); e.target.value = ""; });
    updateHint();
  }

  document.addEventListener("DOMContentLoaded", () => { buildBar(); addHandles(); apply(); });
  window.__layout = { state, apply, snapMove, modules, ensurePositions, save, selected, selectAdd, updateSelectionUI, selectionRect };
})();
