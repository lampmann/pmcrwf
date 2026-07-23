/* ============================================================
   CLASS LIBRARY — import 5e.tools class-*.json, show the features
   your Classes table (name / subclass / level) entitles you to.
   Self-contained: reads getClasses() and re-renders on any change,
   so it touches no other module. Reuses stripTags / flattenEntries /
   escapeHtml (defined in spell-library.js) at render time.
   ============================================================ */
const CLASS_SCHEMA = 1;
// { className: { name, source, hd, caster, feats:[{name,level,source,text}],
//                subs:{ shortName:{name,shortName,source,feats:[...]} } } }
let CLASS_LIB = {};

function parseClassFile(j) {
  // A class-*.json is authoritative for its class(es); (re)build each fresh.
  (j.class || []).forEach(c => {
    CLASS_LIB[c.name] = {
      name: c.name, source: c.source,
      hd: c.hd ? ("d" + c.hd.faces) : "",
      caster: c.casterProgression || "",
      feats: (j.classFeature || []).filter(f => f.className === c.name)
        .map(f => ({ name: f.name, level: f.level, source: f.source, text: stripTags(flattenEntries(f.entries)) }))
        .sort((a, b) => a.level - b.level),
      subs: {},
    };
  });
  (j.subclass || []).forEach(sc => {
    const r = CLASS_LIB[sc.className];
    if (r) r.subs[sc.shortName] = { name: sc.name, shortName: sc.shortName, source: sc.source, feats: [] };
  });
  (j.subclassFeature || []).forEach(f => {
    const r = CLASS_LIB[f.className]; if (!r) return;
    const s = r.subs[f.subclassShortName]; if (!s) return;
    s.feats.push({ name: f.name, level: f.level, source: f.source, text: stripTags(flattenEntries(f.entries)) });
  });
  Object.values(CLASS_LIB).forEach(r => Object.values(r.subs).forEach(s => s.feats.sort((a, b) => a.level - b.level)));
}
function loadClassFiles(files) {
  let done = 0; const total = files.length, errs = [];
  [...files].forEach(file => {
    const rd = new FileReader();
    rd.onload = () => {
      try { parseClassFile(JSON.parse(rd.result)); } catch (e) { errs.push(file.name + ": " + e); }
      if (++done === total) { saveClassLib(); renderClassLibrary(); if (errs.length) alert("Some class files failed:\n" + errs.join("\n")); }
    };
    rd.readAsText(file);
  });
}
/* ----- auto-load from a local data/ folder (a copy of 5e.tools' own data/ dir, dropped next to the sheet) -----
   Only works when served over http(s) — browsers block fetch() of local files opened via file://.
   5e.tools' data/class/ has no index.json, so we probe the known 2014-class filenames directly. */
const CLASS_DATA_FILES = ["artificer", "barbarian", "bard", "cleric", "druid", "fighter", "monk", "mystic",
  "paladin", "ranger", "rogue", "sidekick", "sorcerer", "warlock", "wizard"].map(n => "data/class/class-" + n + ".json");
async function autoLoadClasses() {
  let found = false, blocked = false, filesLoaded = 0;
  for (const url of CLASS_DATA_FILES) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      found = true;
      parseClassFile(await res.json());
      filesLoaded++;
    } catch (e) { blocked = true; }
  }
  if (filesLoaded) saveClassLib();
  return { found, blocked, filesLoaded, filesTotal: CLASS_DATA_FILES.length };
}
function saveClassLib() {
  try { localStorage.setItem("charsheet-classlib", JSON.stringify({ v: CLASS_SCHEMA, lib: CLASS_LIB })); }
  catch (e) { console.warn("Class library too large for localStorage; kept in memory for this session only.", e); }
}
function loadClassLib() {
  try {
    const d = JSON.parse(localStorage.getItem("charsheet-classlib"));
    if (d && d.v === CLASS_SCHEMA) CLASS_LIB = d.lib || {};
    else { CLASS_LIB = {}; if (d) localStorage.removeItem("charsheet-classlib"); }
  } catch (e) { CLASS_LIB = {}; }
}
function ciFindClass(name) { const q = (name || "").trim().toLowerCase(); const k = Object.keys(CLASS_LIB).find(x => x.toLowerCase() === q); return k ? CLASS_LIB[k] : null; }
function ciFindSub(rec, name) { const q = (name || "").trim().toLowerCase(); if (!q) return null; return Object.values(rec.subs).find(s => s.shortName.toLowerCase() === q || s.name.toLowerCase() === q) || null; }

function renderClassLibrary() {
  const names = Object.keys(CLASS_LIB).sort();
  $("class-lib-count").textContent = names.length ? (names.length + " loaded: " + names.join(", ")) : "no classes loaded";
  renderClassFeatures();
}
function renderClassFeatures() {
  const el = $("class-feat-results"); if (!el) return;
  if (!Object.keys(CLASS_LIB).length) { el.innerHTML = "<div class='hint'>No classes loaded — auto-loads from <code>data/class/</code>, or import <code>class-*.json</code> above.</div>"; return; }
  const classes = getClasses().filter(c => c.name.trim());
  if (!classes.length) { el.innerHTML = "<div class='hint'>Add a class name in the Character module to see its features.</div>"; return; }
  el.innerHTML = classes.map(c => {
    const rec = ciFindClass(c.name), lvl = c.lvl || 0;
    if (!rec) return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(c.name)} ${lvl}</b> <span class="hint">— not imported (load its class-*.json)</span></div>`;
    const list = rec.feats.filter(f => f.level <= lvl).slice();
    const sub = ciFindSub(rec, c.sub);
    if (sub) sub.feats.filter(f => f.level <= lvl).forEach(f => list.push(f));
    list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const subNote = sub ? ` <span class="hint">/ ${escapeHtml(sub.name)}</span>`
      : (c.sub.trim() ? ` <span class="hint">/ ${escapeHtml(c.sub)} — subclass not found</span>` : "");
    const items = list.map(f =>
      `<div><a class="feat-link" data-fkey="${(rec.name + "|" + f.name + "|" + f.level).replace(/"/g, "&quot;")}"><b>${f.level}</b> ${escapeHtml(f.name)}</a> <span class="hint">${f.source}</span></div>`
    ).join("") || "<div class='hint'>&nbsp;&nbsp;no features by this level</div>";
    return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(rec.name)} ${lvl}</b>${subNote}</div>${items}`;
  }).join("");
}
function toggleFeatDetail(link) {
  const div = link.closest("div");
  if (div.nextElementSibling && div.nextElementSibling.classList.contains("feat-detail")) { div.nextElementSibling.remove(); return; }
  const [cls, name, lvl] = link.dataset.fkey.split("|");
  const rec = CLASS_LIB[cls]; if (!rec) return;
  let f = rec.feats.find(x => x.name === name && String(x.level) === lvl);
  if (!f) for (const s of Object.values(rec.subs)) { f = s.feats.find(x => x.name === name && String(x.level) === lvl); if (f) break; }
  if (!f) return;
  const d = document.createElement("div"); d.className = "feat-detail";
  d.innerHTML = escapeHtml(f.text).replace(/\n/g, "<br>");
  div.after(d);
}
function runClassAutoLoad() {
  $("class-lib-autostatus").textContent = "loading from data/ …";
  autoLoadClasses().then(res => { renderClassLibrary(); $("class-lib-autostatus").textContent = autoStatusText(res, "class features"); });
}
document.addEventListener("DOMContentLoaded", () => {
  loadClassLib();
  $("class-import").addEventListener("change", e => { if (e.target.files.length) loadClassFiles(e.target.files); e.target.value = ""; });
  $("class-lib-clear").addEventListener("click", () => {
    if (confirm("Clear the imported class library? (does not affect your character)")) { CLASS_LIB = {}; localStorage.removeItem("charsheet-classlib"); renderClassLibrary(); }
  });
  $("class-lib-reload").addEventListener("click", runClassAutoLoad);
  runClassAutoLoad();
  $("class-feat-results").addEventListener("click", e => { const l = e.target.closest(".feat-link"); if (l) { e.preventDefault(); toggleFeatDetail(l); } });
  // Re-render when the Classes table changes: MutationObserver for row add/remove, input for value edits.
  const cr = $("class-rows");
  if (cr) new MutationObserver(() => renderClassFeatures()).observe(cr, { childList: true });
  document.addEventListener("input", e => { if (e.target.closest && e.target.closest("#class-rows")) renderClassFeatures(); });
  renderClassLibrary();
});
