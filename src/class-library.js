/* ============================================================
   FEATURES — import 5e.tools class-*.json / races.json / feats.json,
   show the features your Race+Subrace and Classes table (name / subclass /
   level) entitle you to. For any class/subclass feature literally named
   "Ability Score Improvement", also offer a feat picker (from feats.json)
   whose text displays in place of the ASI's own boilerplate once chosen.
   Reads getClasses() + the char-race/char-subrace fields and re-renders on
   any change. Reuses stripTags / flattenEntries / escapeHtml (defined in
   spell-library.js) at render time. FEAT_CHOICES is persisted as part of
   the character (see persistence.js), not just cached locally, since it's
   a character choice, not imported data.
   ============================================================ */
const CLASS_SCHEMA = 1;
// { className: { name, source, hd, caster, feats:[{name,level,source,text}],
//                subs:{ shortName:{name,shortName,source,feats:[...]} } } }
let CLASS_LIB = {};
const RACE_SCHEMA = 1;
// { raceName: { name, source, entries:[{name,text,source}],
//               subs:{ subName:{name,source,entries:[{name,text,source,overwrite}]} } } }
let RACE_LIB = {};
const FEAT_SCHEMA = 1;
// { featName: { name, source, text } }
let FEAT_LIB = {};
// ASI feat picks, keyed by the same string used for that ASI feature's feat-link (see fkeyFor).
// Persisted as part of the character (collectState/applyState in persistence.js).
let FEAT_CHOICES = {};
// Limited-use tracking, keyed by the same feature key as FEAT_CHOICES/feat-link.
// { used: number, pendingRests: number|null } — pendingRests is only set for the
// "until you finish NdN long/short rests" delayed-recharge pattern (see parseUses).
// Persisted as part of the character (collectState/applyState in persistence.js).
let USES_STATE = {};
// Populated at render time: featureKey -> the exact text that was displayed for it
// (the class/subclass/race trait text, or — for an ASI slot with a feat chosen — the
// feat's text). Used by the rest buttons to re-scan for limited-use features without
// re-walking the whole render tree.
let FEATURE_TEXT_BY_KEY = {};

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
function parseRaceEntries(entries) {
  // Only named trait blocks are features; skip any plain-string flavor text.
  return (entries || []).filter(e => e && e.name && e.entries)
    .map(e => ({ name: e.name, source: e.source, text: stripTags(flattenEntries(e.entries)), overwrite: e.data && e.data.overwrite }));
}
function parseRaceFile(j) {
  (j.race || []).forEach(r => {
    const existing = RACE_LIB[r.name];
    RACE_LIB[r.name] = { name: r.name, source: r.source, entries: parseRaceEntries(r.entries), subs: (existing && existing.subs) || {} };
  });
  (j.subrace || []).forEach(s => {
    if (s._copy) return; // reprinted/variant subraces using 5e.tools' copy-inheritance system aren't resolved
    const raceName = s.raceName || (s._copy && s._copy.raceName);
    const rec = RACE_LIB[raceName]; if (!rec) return;
    rec.subs[s.name] = { name: s.name, source: s.source, entries: parseRaceEntries(s.entries) };
  });
}
function parseFeatFile(j) {
  (j.feat || []).forEach(f => { FEAT_LIB[f.name] = { name: f.name, source: f.source, text: stripTags(flattenEntries(f.entries)) }; });
}
function loadClassFiles(files) {
  // Files are auto-detected by content: class-*.json / races.json / feats.json can all be dropped in together.
  let done = 0; const total = files.length, errs = [];
  [...files].forEach(file => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        let matched = false;
        if (j.class || j.classFeature || j.subclass || j.subclassFeature) { parseClassFile(j); matched = true; }
        if (j.race || j.subrace) { parseRaceFile(j); matched = true; }
        if (j.feat) { parseFeatFile(j); matched = true; }
        if (!matched) errs.push(file.name + ": not a recognized class/race/feat file");
      } catch (e) { errs.push(file.name + ": " + e); }
      if (++done === total) { saveClassLib(); saveRaceLib(); saveFeatLib(); renderClassLibrary(); if (errs.length) alert("Some files failed:\n" + errs.join("\n")); }
    };
    rd.readAsText(file);
  });
}
/* ----- auto-load from a local data/ folder (a copy of 5e.tools' own data/ dir, dropped next to the sheet) -----
   Only works when served over http(s) — browsers block fetch() of local files opened via file://. */
// 5e.tools' data/class/ has no index.json, so we probe the known 2014-class filenames directly.
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
async function autoLoadOne(url, parseFn, save) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { found: false, blocked: false, filesLoaded: 0, filesTotal: 1 };
    parseFn(await res.json());
    save();
    return { found: true, blocked: false, filesLoaded: 1, filesTotal: 1 };
  } catch (e) { return { found: false, blocked: true, filesLoaded: 0, filesTotal: 1 }; }
}
function autoLoadRaces() { return autoLoadOne("data/races.json", parseRaceFile, saveRaceLib); }
function autoLoadFeats() { return autoLoadOne("data/feats.json", parseFeatFile, saveFeatLib); }
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
function saveRaceLib() {
  try { localStorage.setItem("charsheet-racelib", JSON.stringify({ v: RACE_SCHEMA, lib: RACE_LIB })); }
  catch (e) { console.warn("Race library too large for localStorage; kept in memory for this session only.", e); }
}
function loadRaceLib() {
  try {
    const d = JSON.parse(localStorage.getItem("charsheet-racelib"));
    if (d && d.v === RACE_SCHEMA) RACE_LIB = d.lib || {};
    else { RACE_LIB = {}; if (d) localStorage.removeItem("charsheet-racelib"); }
  } catch (e) { RACE_LIB = {}; }
}
function saveFeatLib() {
  try { localStorage.setItem("charsheet-featlib", JSON.stringify({ v: FEAT_SCHEMA, lib: FEAT_LIB })); }
  catch (e) { console.warn("Feat library too large for localStorage; kept in memory for this session only.", e); }
}
function loadFeatLib() {
  try {
    const d = JSON.parse(localStorage.getItem("charsheet-featlib"));
    if (d && d.v === FEAT_SCHEMA) FEAT_LIB = d.lib || {};
    else { FEAT_LIB = {}; if (d) localStorage.removeItem("charsheet-featlib"); }
  } catch (e) { FEAT_LIB = {}; }
}
function ciFind(lib, name) { const q = (name || "").trim().toLowerCase(); const k = Object.keys(lib).find(x => x.toLowerCase() === q); return k ? lib[k] : null; }
function ciFindClass(name) { return ciFind(CLASS_LIB, name); }
function ciFindSub(rec, name) { const q = (name || "").trim().toLowerCase(); if (!q) return null; return Object.values(rec.subs).find(s => s.shortName.toLowerCase() === q || s.name.toLowerCase() === q) || null; }
function ciFindRaceSub(rec, name) { const q = (name || "").trim().toLowerCase(); if (!q) return null; return Object.values(rec.subs).find(s => s.name.toLowerCase() === q) || null; }
function isASI(name) { return (name || "").trim().toLowerCase() === "ability score improvement"; }
function fkeyFor(className, name, level) { return (className + "|" + name + "|" + level).replace(/"/g, "&quot;"); }
function raceFkey(raceName, entryName) { return ("race||" + raceName + "||" + entryName).replace(/"/g, "&quot;"); }

/* ----- limited-use detection: parse feature/feat text for finite-use + recharge patterns -----
   Handles (see DOCS for the exact phrasings this was built against):
     "a number of times equal to your proficiency bonus" / "...your <Ability> modifier (a minimum of X)"
     "you can use this ability/feature/reaction twice" (word numbers: once/twice/three times/...)
     "once per day"
     "once you use this ..., you can't ... again until you finish [Nd?d? long/short rests]"
   Recharges on "when you finish a short/long/short-or-long rest", or the delayed
   "until you finish 1d4 long rests" variant (tracked via USES_STATE[key].pendingRests). */
const USE_NUM_WORDS = { once: 1, twice: 2, thrice: 3, "three times": 3, "four times": 4, "five times": 5, "six times": 6 };
const USE_ABILITY_NAMES = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
function parseUses(text) {
  if (!text) return null;
  const t = text;
  let max = null;
  if (/number of times equal to your proficiency bonus/i.test(t)) max = { type: "prof" };
  if (!max) {
    const am = t.match(/number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i);
    if (am) {
      max = { type: "abilitymod", ability: USE_ABILITY_NAMES[am[1].toLowerCase()] };
      const mm = t.match(/minimum of (once|twice|\d+)/i);
      if (mm) max.min = USE_NUM_WORDS[mm[1].toLowerCase()] || Number(mm[1]) || 1;
    }
  }
  if (!max) {
    const wm = t.match(/use (?:this|it) (?:ability|feature|reaction|trait)?\s*(once|twice|thrice|three times|four times|five times|six times)\b/i);
    if (wm) max = { type: "fixed", n: USE_NUM_WORDS[wm[1].toLowerCase()] };
  }
  if (!max && /once per day/i.test(t)) max = { type: "fixed", n: 1 };
  if (!max && /once you use (?:this|it)\b.*can[’']?t (?:do so|use (?:this|it)) again/i.test(t)) max = { type: "fixed", n: 1 };
  if (!max) return null;

  let per = null, delayed = null;
  const dm = t.match(/until you finish (\d*d\d+|a|an) (long|short) rests?/i);
  if (dm) {
    const restType = dm[2].toLowerCase() === "long" ? "lr" : "sr";
    if (/^\d*d\d+$/i.test(dm[1])) { delayed = { restType, expr: dm[1].toLowerCase() }; per = restType; }
    else per = restType;
  }
  if (!per) {
    const pm = t.match(/when you finish a (short or long|long or short|short|long) rest/i);
    if (pm) per = pm[1].toLowerCase().includes("short") ? "sr" : "lr";
  }
  if (!per) per = "lr";
  return { max, per, delayed };
}
function computeUsesMax(maxSpec) {
  if (maxSpec.type === "fixed") return maxSpec.n;
  if (maxSpec.type === "prof") return profBonus();
  if (maxSpec.type === "abilitymod") {
    const raw = mod($("score-" + maxSpec.ability).value);
    return maxSpec.min != null ? Math.max(raw, maxSpec.min) : raw;
  }
  return 0;
}
function rollDiceExpr(expr) {
  const m = /^(\d*)d(\d+)$/i.exec(expr || ""); if (!m) return 1;
  const count = Number(m[1] || 1), sides = Number(m[2]);
  let sum = 0; for (let i = 0; i < count; i++) sum += rollDie(sides);
  return sum;
}
function renderUsesTracker(key, usesSpec) {
  const max = Math.max(0, computeUsesMax(usesSpec.max));
  const st = USES_STATE[key] || (USES_STATE[key] = { used: 0, pendingRests: null });
  const used = Math.min(st.used, max);
  const periodLabel = usesSpec.delayed ? `long rest (${usesSpec.delayed.expr} once expended)` : usesSpec.per === "sr" ? "short/long rest" : "long rest";
  const pips = Array.from({ length: max }, (_, i) =>
    `<button type="button" class="use-pip${i < used ? " used" : ""}" data-useskey="${key}" data-i="${i}" title="click to set uses">${i < used ? "●" : "○"}</button>`
  ).join("");
  const pendingHint = (usesSpec.delayed && st.pendingRests != null)
    ? ` <span class="hint">(${st.pendingRests} more long rest${st.pendingRests === 1 ? "" : "s"} to recharge)</span>` : "";
  return ` <span class="uses-tracker" data-useskey="${key}">${pips} <span class="hint">${used}/${max} · ${periodLabel}</span>${pendingHint}</span>`;
}
function togglePip(pip) {
  const key = pip.dataset.useskey, i = Number(pip.dataset.i);
  const st = USES_STATE[key] || (USES_STATE[key] = { used: 0, pendingRests: null });
  st.used = i < st.used ? i : i + 1;
  scheduleSave(); renderClassFeatures();
}
function applyRest(kind) {   // kind: "sr" or "lr"
  Object.entries(FEATURE_TEXT_BY_KEY).forEach(([key, text]) => {
    const u = parseUses(text); if (!u) return;
    const st = USES_STATE[key]; if (!st) return;
    if (u.delayed) {
      if (kind !== "lr") return;   // delayed recovery is only ever counted in long rests
      const max = Math.max(0, computeUsesMax(u.max));
      if (st.used < max) return;   // not fully expended yet, nothing to count down
      if (st.pendingRests == null) st.pendingRests = rollDiceExpr(u.delayed.expr);
      st.pendingRests -= 1;
      if (st.pendingRests <= 0) { st.used = 0; st.pendingRests = null; }
    } else if (u.per === "sr") {
      st.used = 0;   // short-rest recovery also happens on a long rest
    } else if (kind === "lr") {
      st.used = 0;
    }
  });
  scheduleSave(); renderClassFeatures();
}

function renderClassLibrary() {
  const counts = [];
  if (Object.keys(CLASS_LIB).length) counts.push(Object.keys(CLASS_LIB).length + " class(es)");
  if (Object.keys(RACE_LIB).length) counts.push(Object.keys(RACE_LIB).length + " race(s)");
  if (Object.keys(FEAT_LIB).length) counts.push(Object.keys(FEAT_LIB).length + " feat(s)");
  $("class-lib-count").textContent = counts.length ? counts.join(", ") + " loaded" : "nothing loaded";
  renderClassFeatures();
}
function renderRaceSection() {
  const raceName = ($("char-race") && $("char-race").value || "").trim();
  if (!raceName) return "";
  const rec = ciFindRace(raceName);
  if (!rec) return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(raceName)}</b> <span class="hint">— not imported (load races.json)</span></div>`;
  const subName = ($("char-subrace") && $("char-subrace").value || "").trim();
  const sub = ciFindRaceSub(rec, subName);
  const list = rec.entries.slice();
  if (sub) sub.entries.forEach(e => {
    const i = e.overwrite ? list.findIndex(x => x.name === e.overwrite) : -1;
    if (i >= 0) list[i] = e; else list.push(e);
  });
  const subNote = sub ? ` <span class="hint">/ ${escapeHtml(sub.name)}</span>`
    : (subName ? ` <span class="hint">/ ${escapeHtml(subName)} — subrace not found</span>` : "");
  const items = list.map(e => {
    const key = raceFkey(rec.name, e.name);
    FEATURE_TEXT_BY_KEY[key] = e.text;
    const usesSpec = parseUses(e.text), tracker = usesSpec ? renderUsesTracker(key, usesSpec) : "";
    return `<div><a class="feat-link" data-fkey="${key}"><b>${escapeHtml(e.name)}</b></a> <span class="hint">${e.source || rec.source}</span>${tracker}</div>`;
  }).join("") || "<div class='hint'>&nbsp;&nbsp;no traits</div>";
  return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(rec.name)}</b>${subNote}</div>${items}`;
}
function ciFindRace(name) { return ciFind(RACE_LIB, name); }
function renderClassFeatures() {
  const el = $("class-feat-results"); if (!el) return;
  const raceName = ($("char-race") && $("char-race").value || "").trim();
  const classes = getClasses().filter(c => c.name.trim());
  if (!Object.keys(CLASS_LIB).length && !Object.keys(RACE_LIB).length) {
    el.innerHTML = "<div class='hint'>No data loaded — auto-loads from <code>data/</code> (class/race/feat files), or import files above.</div>"; return;
  }
  if (!raceName && !classes.length) { el.innerHTML = "<div class='hint'>Add a race and/or class name in the Character module to see its features.</div>"; return; }
  FEATURE_TEXT_BY_KEY = {};
  const raceHtml = renderRaceSection();
  const classHtml = classes.map(c => {
    const rec = ciFindClass(c.name), lvl = c.lvl || 0;
    if (!rec) return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(c.name)} ${lvl}</b> <span class="hint">— not imported (load its class-*.json)</span></div>`;
    const list = rec.feats.filter(f => f.level <= lvl).slice();
    const sub = ciFindSub(rec, c.sub);
    if (sub) sub.feats.filter(f => f.level <= lvl).forEach(f => list.push(f));
    list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const subNote = sub ? ` <span class="hint">/ ${escapeHtml(sub.name)}</span>`
      : (c.sub.trim() ? ` <span class="hint">/ ${escapeHtml(c.sub)} — subclass not found</span>` : "");
    const items = list.map(f => {
      const fkey = fkeyFor(rec.name, f.name, f.level);
      const link = `<a class="feat-link" data-fkey="${fkey}"><b>${f.level}</b> ${escapeHtml(f.name)}</a> <span class="hint">${f.source}</span>`;
      if (!isASI(f.name)) {
        FEATURE_TEXT_BY_KEY[fkey] = f.text;
        const usesSpec = parseUses(f.text), tracker = usesSpec ? renderUsesTracker(fkey, usesSpec) : "";
        return `<div>${link}${tracker}</div>`;
      }
      const featNames = Object.keys(FEAT_LIB).sort();
      const chosen = FEAT_CHOICES[fkey] || "";
      const opts = `<option value="">— no feat chosen —</option>` +
        featNames.map(n => `<option value="${escapeHtml(n)}" ${n === chosen ? "selected" : ""}>${escapeHtml(n)}</option>`).join("");
      let tracker = "";
      if (chosen && FEAT_LIB[chosen]) {
        FEATURE_TEXT_BY_KEY[fkey] = FEAT_LIB[chosen].text;
        const usesSpec = parseUses(FEAT_LIB[chosen].text);
        if (usesSpec) tracker = renderUsesTracker(fkey, usesSpec);
      }
      return `<div>${link} &nbsp;<label class="hint">Feat: <select class="asi-select" data-asikey="${fkey}" ${featNames.length ? "" : "disabled"}>${opts}</select></label>${tracker}</div>`;
    }).join("") || "<div class='hint'>&nbsp;&nbsp;no features by this level</div>";
    return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(rec.name)} ${lvl}</b>${subNote}</div>${items}`;
  }).join("");
  el.innerHTML = raceHtml + classHtml;
}
function toggleFeatDetail(link) {
  const div = link.closest("div");
  if (div.nextElementSibling && div.nextElementSibling.classList.contains("feat-detail")) { div.nextElementSibling.remove(); return; }
  const fkey = link.dataset.fkey;
  let text = null;
  if (fkey.startsWith("race||")) {
    const [, raceName, entryName] = fkey.split("||");
    const rec = ciFindRace(raceName);
    if (rec) {
      const subName = ($("char-subrace") && $("char-subrace").value || "").trim();
      const sub = ciFindRaceSub(rec, subName);
      let e = (sub && sub.entries.find(x => x.name === entryName)) || rec.entries.find(x => x.name === entryName);
      text = e && e.text;
    }
  } else {
    const [cls, name, lvl] = fkey.split("|");
    const rec = CLASS_LIB[cls]; if (!rec) return;
    let f = rec.feats.find(x => x.name === name && String(x.level) === lvl);
    if (!f) for (const s of Object.values(rec.subs)) { f = s.feats.find(x => x.name === name && String(x.level) === lvl); if (f) break; }
    if (!f) return;
    if (isASI(f.name) && FEAT_CHOICES[link.dataset.fkey]) {
      const feat = FEAT_LIB[FEAT_CHOICES[link.dataset.fkey]];
      text = feat ? ("Feat: " + feat.name + "\n" + feat.text) : f.text;
    } else text = f.text;
  }
  if (text == null) return;
  const d = document.createElement("div"); d.className = "feat-detail";
  d.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
  div.after(d);
}
function runClassAutoLoad() {
  $("class-lib-autostatus").textContent = "loading from data/ …";
  Promise.all([autoLoadClasses(), autoLoadRaces(), autoLoadFeats()]).then(([cls, race, feat]) => {
    renderClassLibrary();
    const parts = [
      cls.filesLoaded ? `${cls.filesLoaded}/${cls.filesTotal} class file(s)` : (cls.blocked ? "classes blocked" : "no class data"),
      race.found ? "races" : (race.blocked ? "races blocked" : "no races.json"),
      feat.found ? "feats" : (feat.blocked ? "feats blocked" : "no feats.json"),
    ];
    $("class-lib-autostatus").textContent = "auto-loaded: " + parts.join(", ");
  });
}
document.addEventListener("DOMContentLoaded", () => {
  loadClassLib(); loadRaceLib(); loadFeatLib();
  $("class-import").addEventListener("change", e => { if (e.target.files.length) loadClassFiles(e.target.files); e.target.value = ""; });
  $("class-lib-clear").addEventListener("click", () => {
    if (confirm("Clear the imported class/race/feat library? (does not affect your character)")) {
      CLASS_LIB = {}; RACE_LIB = {}; FEAT_LIB = {};
      localStorage.removeItem("charsheet-classlib"); localStorage.removeItem("charsheet-racelib"); localStorage.removeItem("charsheet-featlib");
      renderClassLibrary();
    }
  });
  $("class-lib-reload").addEventListener("click", runClassAutoLoad);
  runClassAutoLoad();
  $("class-feat-results").addEventListener("click", e => {
    const pip = e.target.closest(".use-pip"); if (pip) { togglePip(pip); return; }
    const l = e.target.closest(".feat-link"); if (l) { e.preventDefault(); toggleFeatDetail(l); }
  });
  $("btn-short-rest").addEventListener("click", () => applyRest("sr"));
  $("btn-long-rest").addEventListener("click", () => applyRest("lr"));
  $("class-feat-results").addEventListener("change", e => {
    const sel = e.target.closest(".asi-select"); if (!sel) return;
    if (sel.value) FEAT_CHOICES[sel.dataset.asikey] = sel.value; else delete FEAT_CHOICES[sel.dataset.asikey];
    scheduleSave(); renderClassFeatures();
  });
  // Re-render when the Classes table or race/subrace fields change: MutationObserver for row add/remove, input for value edits.
  const cr = $("class-rows");
  if (cr) new MutationObserver(() => renderClassFeatures()).observe(cr, { childList: true });
  document.addEventListener("input", e => {
    if (e.target.closest && (e.target.closest("#class-rows") || e.target.id === "char-race" || e.target.id === "char-subrace")) renderClassFeatures();
  });
  renderClassLibrary();
});
