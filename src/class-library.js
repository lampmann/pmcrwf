/* ============================================================
   FEATURES — import 5e.tools class-*.json / races.json / feats.json,
   show the features your Race+Subrace and Classes table (name / subclass /
   level) entitle you to. For any class/subclass feature literally named
   "Ability Score Improvement", also offer a feat picker (from feats.json)
   whose text displays in place of the ASI's own boilerplate once chosen.
   Reads getClasses() + the char-race/char-subrace fields and re-renders on
   any change. Reuses stripTags / flattenEntries (text-utils.js) and
   escapeHtml (spell-library.js) at render time. FEAT_CHOICES is persisted as part of
   the character (see persistence.js), not just cached locally, since it's
   a character choice, not imported data.
   ============================================================ */
const CLASS_SCHEMA = 1;
// { className: { name, source, hd, caster, feats:[{name,level,source,text}],
//                subs:{ shortName:{name,shortName,source,feats:[...]} } } }
let CLASS_LIB = {};
const RACE_SCHEMA = 2;   // bumped when `ability` (racial ASI) was added to the parsed shape
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
// { used: number, pendingRests: number|null } — pendingRests is only set for a DB entry's
// `uses.delayed` ("until you finish NdN long rests") recharge. The uses spec itself (whether a
// feature has limited uses at all, and its max/recharge) comes from EFFECTS_DB (see usesSpecFor in
// effects.js) — declared per-entry, not guessed from the feature's text at render time.
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
    if (r) r.subs[sc.shortName] = { name: sc.name, shortName: sc.shortName, source: sc.source, feats: [], grantedSpells: sc.additionalSpells || [] };
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
    RACE_LIB[r.name] = { name: r.name, source: r.source, entries: parseRaceEntries(r.entries), grantedSpells: r.additionalSpells || [], ability: r.ability || [], subs: (existing && existing.subs) || {} };
  });
  (j.subrace || []).forEach(s => {
    if (s._copy) return; // reprinted/variant subraces using 5e.tools' copy-inheritance system aren't resolved
    const raceName = s.raceName || (s._copy && s._copy.raceName);
    const rec = RACE_LIB[raceName]; if (!rec) return;
    rec.subs[s.name] = { name: s.name, source: s.source, entries: parseRaceEntries(s.entries), grantedSpells: s.additionalSpells || [], ability: s.ability || [] };
  });
}
/* ----- granted spells (Cleric domain spells, Mark of X subraces, Eldritch Knight/Divine Soul/
   Warlock-patron/Wizard-subschool spell-list expansions, etc.) -----
   5e.tools' "additionalSpells" blocks come in a few shapes — "prepared"/"known"/"innate" keyed
   by the level (class level for a subclass, character level for a subrace) at which the spell
   unlocks, values either a flat name array or nested one level deeper (e.g. innate "daily"/"rest"
   counts); these are auto-granted and free (no slot, no preparation). "expanded" keyed by spell
   level ("s1","s2",...) means something different — "added to your spell list" — the spell is
   merely *eligible* to be learned/prepared through the class's own normal mechanic, same as any
   other spell on that list; it still costs a known/prepared slot. Some grants list the same spell
   in both shapes (e.g. Mark of Warding's "alarm" is both innately known AND list-expanded) — the
   free/innate version wins in that case, since it's strictly better. collectNames() recurses
   through either shape uniformly. */
/* A grant's leaves are usually literal spell names, but 5e.tools also uses *filter objects* —
   { all: "level=0|class=Wizard" } ("every spell matching this is added to your list", e.g. Eldritch
   Knight, Chronurgy Magic's "source=EGW") and { choose: "level=0;1;2;3", count: 1 } ("pick this many
   from the matching spells", e.g. College of Lore, Death Domain). Those aren't spells, so they can't
   be click-to-add links; collectNames must yield strings only (it used to return arrays verbatim,
   so a filter object reached escapeHtml and threw), and collectFilters picks them up separately so
   the grant is still described rather than silently dropped. */
function isSpellFilterObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v) && (typeof v.all === "string" || typeof v.choose === "string");
}
function collectNames(v) {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(collectNames);
  if (v && typeof v === "object" && !isSpellFilterObj(v)) return Object.values(v).flatMap(collectNames);
  return [];
}
function collectFilters(v) {
  if (isSpellFilterObj(v)) return [{ spec: v.all || v.choose, count: Number(v.count) || 0, choose: typeof v.choose === "string" }];
  if (Array.isArray(v)) return v.flatMap(collectFilters);
  if (v && typeof v === "object") return Object.values(v).flatMap(collectFilters);
  return [];
}
/* "level=0|class=Wizard" -> "any Wizard cantrip". Categories are |-separated (AND), alternatives
   within one are ;-separated (OR). Falls back to the raw spec so nothing is ever lost. */
function describeSpellFilter(spec) {
  const cats = {};
  String(spec || "").split("|").forEach(part => {
    const i = part.indexOf("=");
    if (i < 0) return;
    const key = part.slice(0, i).trim().toLowerCase();
    const vals = part.slice(i + 1).split(";").map(s => s.trim()).filter(Boolean);
    if (vals.length) cats[key] = (cats[key] || []).concat(vals);
  });
  const nums = (cats.level || []).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
  const contiguous = nums.length > 1 && nums[nums.length - 1] - nums[0] === nums.length - 1;
  const cantripOnly = nums.length === 1 && nums[0] === 0;
  let lvlAdj = "";
  if (nums.length && !cantripOnly) lvlAdj = "level " + (contiguous ? nums[0] + "–" + nums[nums.length - 1] : nums.join("/"));
  const schools = (cats.school || []).map(s => (typeof SPELL_SCHOOLS === "object" && SPELL_SCHOOLS[s.toUpperCase()]) || s);
  const srcs = (cats.source || []).map(s => (typeof SOURCE_NAMES === "object" && SOURCE_NAMES[s.toUpperCase()]) || s);
  const words = [lvlAdj, (cats.class || []).join("/"), schools.join("/")].filter(Boolean).join(" ");
  const noun = cantripOnly ? "cantrip" : "spell";
  const phrase = ("any " + (words ? words + " " : "") + noun + (srcs.length ? " from " + srcs.join("/") : "")).replace(/\s+/g, " ").trim();
  return phrase === "any spell" && spec ? "any spell matching " + spec : phrase;
}
function flattenGrantedSpells(additionalSpells) {
  const free = new Map(); // name -> lowest minLevel (auto-granted, no prep needed)
  const expandedNames = new Set(); // name -> merely added to the spell list; still needs normal prep
  const filters = new Map(); // spec -> { spec, count, choose, expanded, minLevel } (not literal spells)
  const addFilters = (val, expanded, minLevel) => collectFilters(val).forEach(f => {
    const prev = filters.get(f.spec);
    if (!prev || minLevel < prev.minLevel) filters.set(f.spec, { ...f, expanded, minLevel });
  });
  (additionalSpells || []).forEach(block => {
    Object.entries(block).forEach(([key, val]) => {
      // Skip the block's scalar metadata ("ability", "name": "Magical Secrets", "resourceName": "Ki").
      // Only the keyed spell groups (prepared/known/innate/expanded) are objects; Object.entries on a
      // string would otherwise spread it into single characters and list them as "spells".
      if (!val || typeof val !== "object") return;
      if (key === "expanded") {
        collectNames(val).forEach(n => expandedNames.add(n));
        addFilters(val, true, 0);
        return;
      }
      Object.entries(val).forEach(([lvlKey, namesOrObj]) => {
        const lvlNum = Number(lvlKey) || 0;
        collectNames(namesOrObj).forEach(n => { if (!free.has(n) || lvlNum < free.get(n)) free.set(n, lvlNum); });
        addFilters(namesOrObj, false, lvlNum);
      });
    });
  });
  const out = [...free.entries()].map(([name, minLevel]) => ({ name, minLevel, expanded: false }));
  expandedNames.forEach(n => { if (!free.has(n)) out.push({ name: n, minLevel: 0, expanded: true }); });
  filters.forEach(f => out.push(f));
  return out;
}
function grantedSpellsHtml(spells, header, cls) {
  if (!spells.length) return "";
  const links = spells.map(g => {
    if (g.spec !== undefined) {   // a filter, not a spell: describe it, don't offer click-to-add
      const label = describeSpellFilter(g.spec) + (g.choose && g.count ? ` (choose ${g.count})` : "");
      return `<i title="${escapeHtml(g.choose ? "choose from these yourself, then add them from the Spell Library" : "all of these are added to your spell list — add the ones you use from the Spell Library")}">${escapeHtml(label)}${g.expanded ? "*" : ""}</i>`;
    }
    const cls2 = "feat-link gsp-link" + (g.expanded ? " gsp-expanded" : "");
    const title = g.expanded ? ` title="added to your spell list — still needs to be prepared/known normally, via a class"` : "";
    return `<a class="${cls2}" data-name="${escapeHtml(g.name)}" data-cls="${escapeHtml(cls || "")}" data-header="${escapeHtml(header)}" data-expanded="${g.expanded ? "1" : "0"}"${title}>${escapeHtml(g.name)}${g.expanded ? "*" : ""}</a>`;
  }).join(", ");
  const anyClickable = spells.some(g => g.spec === undefined);
  const note = anyClickable
    ? "click to add — <code>*</code> = list expansion, still needs normal preparation"
    : "added to your spell list — add the ones you use from the Spell Library";
  return `<div class="hint" style="margin:.15rem 0 .3rem 1.2rem">${escapeHtml(header)} spells (${note}): ${links}</div>`;
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
function ciFindFeat(name) { return ciFind(FEAT_LIB, name); }
function ciFindSub(rec, name) { const q = (name || "").trim().toLowerCase(); if (!q) return null; return Object.values(rec.subs).find(s => s.shortName.toLowerCase() === q || s.name.toLowerCase() === q) || null; }
function ciFindRaceSub(rec, name) { const q = (name || "").trim().toLowerCase(); if (!q) return null; return Object.values(rec.subs).find(s => s.name.toLowerCase() === q) || null; }
function isASI(name) { return (name || "").trim().toLowerCase() === "ability score improvement"; }
function fkeyFor(className, name, level) { return (className + "|" + name + "|" + level).replace(/"/g, "&quot;"); }
function raceFkey(raceName, entryName) { return ("race||" + raceName + "||" + entryName).replace(/"/g, "&quot;"); }

/* ----- the single source of truth for "what features does this character currently have" -----
   Used by renderClassFeatures()/renderRaceSection() (to build the Features panel), by applyRest()
   (to re-scan for limited-use recovery), and by the effects engine (effects.js) to know which
   EFFECTS_DB entries are live. None of those three depends on either of the others having run —
   each calls this fresh. Race/subrace-trait entries always carry text; class/subclass features do
   too, except an "Ability Score Improvement" slot with no feat chosen yet, whose `text` is null
   (isAsi is true either way, so callers can still render its picker). */
function activeFeatures() {
  const out = [];
  const raceName = ($("char-race") && $("char-race").value || "").trim();
  if (raceName) {
    const rec = ciFindRace(raceName);
    if (rec) {
      const subName = ($("char-subrace") && $("char-subrace").value || "").trim();
      const sub = ciFindRaceSub(rec, subName);
      const list = rec.entries.map(e => ({ e, fromSub: false }));
      if (sub) sub.entries.forEach(e => {
        const i = e.overwrite ? list.findIndex(x => x.e.name === e.overwrite) : -1;
        const item = { e, fromSub: true };
        if (i >= 0) list[i] = item; else list.push(item);
      });
      list.forEach(({ e, fromSub }) => {
        const fkey = raceFkey(rec.name, e.name);
        const origin = fromSub
          ? { kind: "subrace", raceName: rec.name, subraceName: sub.name }
          : { kind: "race", raceName: rec.name };
        out.push({ fkey, effKey: effKeyFor(origin, e.name), name: e.name, level: 0,
          source: e.source || rec.source, text: e.text, isAsi: false, origin });
      });
    }
  }
  getClasses().filter(c => c.name.trim()).forEach(c => {
    const rec = ciFindClass(c.name); if (!rec) return;
    const lvl = c.lvl || 0;
    const sub = ciFindSub(rec, c.sub);
    const list = rec.feats.filter(f => f.level <= lvl).map(f => ({ f, fromSub: false }));
    if (sub) sub.feats.filter(f => f.level <= lvl).forEach(f => list.push({ f, fromSub: true }));
    list.sort((a, b) => a.f.level - b.f.level || a.f.name.localeCompare(b.f.name));
    list.forEach(({ f, fromSub }) => {
      const fkey = fkeyFor(rec.name, f.name, f.level);
      const origin = fromSub
        ? { kind: "subclass", className: rec.name, subclassName: sub.name }
        : { kind: "class", className: rec.name };
      if (!isASI(f.name)) {
        out.push({ fkey, effKey: effKeyFor(origin, f.name), name: f.name, level: f.level,
          source: f.source, text: f.text, isAsi: false, origin });
        return;
      }
      const chosen = FEAT_CHOICES[fkey] || "";
      const featRec = chosen ? ciFindFeat(chosen) : null;
      out.push({
        fkey, effKey: featRec ? effKeyFor({ kind: "feat" }, featRec.name) : null,
        name: featRec ? featRec.name : f.name, level: f.level, source: featRec ? featRec.source : f.source,
        text: featRec ? featRec.text : null, isAsi: true, asiFeatName: f.name, asiChosen: chosen, origin,
      });
    });
  });
  return out;
}

/* ----- limited-use tracker rendering: the *spec* (whether a feature has finite uses, its max, and
   its recharge) comes from the feature's EFFECTS_DB entry via usesSpecFor() (src/effects.js) — see
   effects/tools/conversion-guide.md's "Limited uses" section for the schema. This is purely the
   render/state half: pip UI and the delayed-recharge dice roll. */
function rollDiceExpr(expr) {
  const m = /^(\d*)d(\d+)$/i.exec(expr || ""); if (!m) return 1;
  const count = Number(m[1] || 1), sides = Number(m[2]);
  let sum = 0; for (let i = 0; i < count; i++) sum += rollDie(sides);
  return sum;
}
function renderUsesTracker(feature, usesSpec) {
  const key = feature.fkey;
  const max = usesMaxFor(feature, usesSpec.max);
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
  // Deliberately scoped to ONLY feature-effect uses trackers (limited-use pips) — everything else a
  // rest actually does (current/temp HP, Hit Dice, spell slots, the PHB p186 "no benefit below 1 HP"
  // guard) lives in performRest() (src/rest.js), which wraps this function and is what the two Rest
  // buttons actually call. Keeping this narrow matches its own tests, which call it directly.
  //
  // Iterates activeFeatures() directly rather than a render-time cache, so Short/Long Rest still
  // works even if the Features panel hasn't rendered since the library/character last changed.
  //
  // Returns how many features actually got uses back, so performRest() can report it in the event
  // log — counted rather than inferred, since "recovered" means a tracker that was genuinely spent.
  let recovered = 0;
  activeFeatures().forEach(feature => {
    const key = feature.fkey;
    const u = usesSpecFor(feature); if (!u) return;
    const st = USES_STATE[key]; if (!st) return;
    const before = st.used;
    if (u.delayed) {
      if (kind !== "lr") return;   // delayed recovery is only ever counted in long rests
      const max = usesMaxFor(feature, u.max);
      if (st.used < max) return;   // not fully expended yet, nothing to count down
      if (st.pendingRests == null) st.pendingRests = rollDiceExpr(u.delayed.expr);
      st.pendingRests -= 1;
      if (st.pendingRests <= 0) { st.used = 0; st.pendingRests = null; }
    } else if (u.per === "sr") {
      st.used = 0;   // short-rest recovery also happens on a long rest
    } else if (kind === "lr") {
      st.used = 0;
    }
    if (st.used < before) recovered++;
  });
  scheduleSave(); recompute(); renderClassFeatures();
  return recovered;
}

function renderClassLibrary() {
  const counts = [];
  if (Object.keys(CLASS_LIB).length) counts.push(Object.keys(CLASS_LIB).length + " class(es)");
  if (Object.keys(RACE_LIB).length) counts.push(Object.keys(RACE_LIB).length + " race(s)");
  if (Object.keys(FEAT_LIB).length) counts.push(Object.keys(FEAT_LIB).length + " feat(s)");
  $("class-lib-count").textContent = counts.length ? counts.join(", ") + " loaded" : "nothing loaded";
  renderClassFeatures();
}
function renderRaceSection(all) {
  const raceName = ($("char-race") && $("char-race").value || "").trim();
  if (!raceName) return "";
  const rec = ciFindRace(raceName);
  if (!rec) return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(raceName)}</b> <span class="hint">— not imported (load races.json)</span></div>`;
  const subName = ($("char-subrace") && $("char-subrace").value || "").trim();
  const sub = ciFindRaceSub(rec, subName);
  const subNote = sub ? ` <span class="hint">/ ${escapeHtml(sub.name)}</span>`
    : (subName ? ` <span class="hint">/ ${escapeHtml(subName)} — subrace not found</span>` : "");
  const entries = all.filter(a => (a.origin.kind === "race" || a.origin.kind === "subrace")
    && a.origin.raceName.toLowerCase() === rec.name.toLowerCase());
  const items = entries.map(e => {
    FEATURE_TEXT_BY_KEY[e.fkey] = e.text;
    const usesSpec = usesSpecFor(e), tracker = usesSpec ? renderUsesTracker(e, usesSpec) : "";
    return `<div><a class="feat-link" data-fkey="${e.fkey}"><b>${escapeHtml(e.name)}</b></a> <span class="hint">${e.source}</span>${tracker}${renderEffectControls(e)}</div>`;
  }).join("") || "<div class='hint'>&nbsp;&nbsp;no traits</div>";
  const grantedSrc = (sub && sub.grantedSpells && sub.grantedSpells.length) ? sub.grantedSpells
    : (rec.grantedSpells && rec.grantedSpells.length) ? rec.grantedSpells : null;
  const grantedHeader = sub && sub.grantedSpells && sub.grantedSpells.length ? sub.name : rec.name;
  const grantedHtml = grantedSrc ? grantedSpellsHtml(flattenGrantedSpells(grantedSrc).filter(g => g.minLevel <= totalLevel()), grantedHeader, "") : "";
  return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(rec.name)}</b>${subNote}</div>${items}${grantedHtml}`;
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
  const all = activeFeatures();
  const raceHtml = renderRaceSection(all);
  const classHtml = classes.map(c => {
    const rec = ciFindClass(c.name), lvl = c.lvl || 0;
    if (!rec) return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(c.name)} ${lvl}</b> <span class="hint">— not imported (load its class-*.json)</span></div>`;
    const sub = ciFindSub(rec, c.sub);
    const subNote = sub ? ` <span class="hint">/ ${escapeHtml(sub.name)}</span>`
      : (c.sub.trim() ? ` <span class="hint">/ ${escapeHtml(c.sub)} — subclass not found</span>` : "");
    const entries = all.filter(a => (a.origin.kind === "class" || a.origin.kind === "subclass")
      && a.origin.className.toLowerCase() === rec.name.toLowerCase());
    const items = entries.map(e => {
      const link = `<a class="feat-link" data-fkey="${e.fkey}"><b>${e.level}</b> ${escapeHtml(e.isAsi ? e.asiFeatName : e.name)}</a> <span class="hint">${e.source || ""}</span>`;
      if (!e.isAsi) {
        FEATURE_TEXT_BY_KEY[e.fkey] = e.text;
        const usesSpec = usesSpecFor(e), tracker = usesSpec ? renderUsesTracker(e, usesSpec) : "";
        return `<div>${link}${tracker}${renderEffectControls(e)}</div>`;
      }
      let tracker = "";
      if (e.text != null) {
        FEATURE_TEXT_BY_KEY[e.fkey] = e.text;
        const usesSpec = usesSpecFor(e);
        if (usesSpec) tracker = renderUsesTracker(e, usesSpec);
      }
      return `<div>${link} &nbsp;<label class="hint">Feat: <input type="text" class="asi-input" data-asikey="${e.fkey}" value="${escapeHtml(e.asiChosen)}" style="width:12rem"></label>${tracker}${renderEffectControls(e)}</div>`;
    }).join("") || "<div class='hint'>&nbsp;&nbsp;no features by this level</div>";
    const grantedHtml = (sub && sub.grantedSpells && sub.grantedSpells.length)
      ? grantedSpellsHtml(flattenGrantedSpells(sub.grantedSpells).filter(g => g.minLevel <= lvl), sub.name, rec.name) : "";
    return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(rec.name)} ${lvl}</b>${subNote}</div>${items}${grantedHtml}`;
  }).join("");
  el.innerHTML = raceHtml + classHtml;
  el.querySelectorAll(".asi-input").forEach(inp => attachTypeahead(inp, () => Object.keys(FEAT_LIB).sort()));
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
      const feat = ciFindFeat(FEAT_CHOICES[link.dataset.fkey]);
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
    const et = e.target.closest(".eff-toggle"); if (et) { if (!et.disabled) toggleEffect(et.dataset.fkey, et.dataset.toggle); return; }
    const pip = e.target.closest(".use-pip"); if (pip) { togglePip(pip); return; }
    const gsp = e.target.closest(".gsp-link");
    if (gsp) {
      const name = gsp.dataset.name, lib = findLibSpellByName(name), lvl = lib ? lib.level : 0;
      if (gsp.dataset.expanded === "1") { openPrepClassModal(name, lvl, gsp.dataset.header); return; }
      addCharacterSpell(gsp.dataset.cls || "", lvl, name, { grantSrc: gsp.dataset.header });
      return;
    }
    const l = e.target.closest(".feat-link"); if (l) { e.preventDefault(); toggleFeatDetail(l); }
  });
  // performRest() (src/rest.js) wraps applyRest() with the rest of what a rest actually does —
  // temp HP, current HP, Hit Dice, spell slots — see DOCS.md's "Resting" section.
  // Short Rest opens a dialog first, since spending Hit Dice is a per-die decision made at the end
  // of the rest (PHB p186); "Finish Short Rest" in there is what calls performRest("sr"). A long
  // rest has no such choice to make, so it applies straight away. Both live in src/rest.js.
  $("btn-short-rest").addEventListener("click", openShortRestModal);
  $("btn-long-rest").addEventListener("click", () => performRest("lr"));
  $("class-feat-results").addEventListener("change", e => {
    const inp = e.target.closest(".asi-input");
    if (inp) {
      const v = inp.value.trim();
      if (v) FEAT_CHOICES[inp.dataset.asikey] = v; else delete FEAT_CHOICES[inp.dataset.asikey];
      scheduleSave(); renderClassFeatures(); return;
    }
    const sel = e.target.closest(".eff-choice");
    if (sel) {
      const fkey = sel.dataset.fkey, id = sel.dataset.choice, v = sel.value, slot = sel.dataset.slot;
      const c = EFFECT_CHOICES[fkey] || (EFFECT_CHOICES[fkey] = {});
      if (slot != null) {
        // multi-pick ("choose N"): store one array per choice id, one slot per rendered <select>
        const arr = Array.isArray(c[id]) ? c[id].slice() : [];
        arr[Number(slot)] = v;
        if (arr.some(x => x)) c[id] = arr; else delete c[id];
      } else if (v) c[id] = v; else delete c[id];
      invalidateEffects(); scheduleSave(); recompute(); renderClassFeatures(); return;
    }
  });
  // Re-render when the Classes table or race/subrace fields change: MutationObserver for row add/remove, input for value edits.
  const cr = $("class-rows");
  if (cr) new MutationObserver(() => renderClassFeatures()).observe(cr, { childList: true });
  document.addEventListener("input", e => {
    if (e.target.closest && (e.target.closest("#class-rows") || e.target.id === "char-race" || e.target.id === "char-subrace")) renderClassFeatures();
  });
  renderClassLibrary();
});
