/* ============================================================
   SPELL LIBRARY — import & search 5e.tools spell JSON
   ============================================================ */
const SPELL_SCHOOLS = { A:"Abjuration", C:"Conjuration", D:"Divination", E:"Enchantment", V:"Evocation", I:"Illusion", N:"Necromancy", T:"Transmutation" };
// Full book names (from 5e.tools parser.js) for hover tooltips on the source toggles
const SOURCE_NAMES = {
  PHB:"Player's Handbook (2014)", XGE:"Xanathar's Guide to Everything", TCE:"Tasha's Cauldron of Everything",
  SCAG:"Sword Coast Adventurer's Guide", EEPC:"Elemental Evil Player's Companion", GGR:"Guildmasters' Guide to Ravnica",
  AI:"Acquisitions Incorporated", EGW:"Explorer's Guide to Wildemount", ToR:"Tide of Retribution", DD:"Dangerous Designs",
  FS:"Frozen Sick", US:"Unwelcome Spirits", FTD:"Fizban's Treasury of Dragons", IDRotF:"Icewind Dale: Rime of the Frostmaiden",
  SatO:"Sigil and the Outlands", AAG:"Astral Adventurer's Guide", SCC:"Strixhaven: A Curriculum of Chaos",
  BMT:"The Book of Many Things", LLK:"Lost Laboratory of Kwalish", FRHoF:"Forgotten Realms: Heroes of Faerûn",
  EFA:"Eberron: Forge of the Artificer", "AitFR-AVT":"Adventures in the Forgotten Realms: A Verdant Tomb",
  XPHB:"Player's Handbook (2024)"
};
const LIB_SCHEMA = 4;  // bump when the parsed-spell shape changes (forces a one-time re-import)
function castCat(u) { return (u === "action" || u === "bonus" || u === "reaction") ? u : (u ? "long" : ""); }
// filter groups. `dynamic` groups (Source) compute their options from the loaded library.
const SPELL_FGROUPS = [
  { key:"source", label:"Source", dynamic:true, get:s=>[s.source] },
  // Not every 5e.tools data dump includes per-spell class lists ("classes.fromClassList") —
  // when it's missing this group just has no options to show (see DOCS re: import-not-hardcode).
  { key:"cls",    label:"Class",  dynamic:true, get:s=>s.classes||[], dynOpts:spellClassesInLib },
  { key:"level",  label:"Level",  get:s=>[String(s.level)], opts:[["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]] },
  { key:"school", label:"School", get:s=>[s.school], opts:["Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"].map(x=>[x,x]) },
  { key:"dmg",    label:"Damage", get:s=>s.dmgTypes, opts:["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"].map(x=>[x, x[0].toUpperCase()+x.slice(1)]) },
  { key:"save",   label:"Save",   get:s=>s.save?[s.save]:[], opts:[["strength","Str"],["dexterity","Dex"],["constitution","Con"],["intelligence","Int"],["wisdom","Wis"],["charisma","Cha"]] },
  { key:"cast",   label:"Cast",   get:s=>[castCat(s.cast)], opts:[["action","Action"],["bonus","Bonus"],["reaction","Reaction"],["long","Min+"]] },
  { key:"comp",   label:"Components", get:s=>["v","s","m"].filter(k=>s.comp&&s.comp[k]), opts:[["v","Verbal"],["s","Somatic"],["m","Material"]] },
  { key:"misc",   label:"Misc",   get:s=>["conc","ritual","attack","srd"].filter(k=> k==="conc"?s.conc : k==="ritual"?s.ritual : k==="attack"?s.attack : s.srd), opts:[["conc","Concentration"],["ritual","Ritual"],["attack","Attack roll"],["srd","SRD"]] },
];
let SPELL_LIB = [];
// filter state: per group { states:{val:'ignore'|'include'|'exclude'}, blueMode, redMode, hidden }
let filterState = {};
let moduleCombine = "and";   // how groups combine: 'and' | 'or'
function nextMode(m) { return m === "or" ? "and" : m === "and" ? "xor" : "or"; }
function groupDef(key) { return SPELL_FGROUPS.find(g => g.key === key); }
function groupOpts(g) {
  if (!g.dynamic) return g.opts.map(o => [o[0], o[1], ""]);
  if (g.dynOpts) return g.dynOpts().map(v => [v, v, ""]);
  return spellSources().map(src => [src, src, SOURCE_NAMES[src] || src]);
}
function ensureStates() {
  SPELL_FGROUPS.forEach(g => {
    if (!filterState[g.key]) filterState[g.key] = { states:{}, blueMode:"or", redMode:"or", hidden:false };
    groupOpts(g).forEach(([v]) => { if (!(v in filterState[g.key].states)) filterState[g.key].states[v] = "ignore"; });
  });
}

function flattenEntries(entries) {
  const out = [];
  (entries || []).forEach(e => {
    if (typeof e === "string") out.push(e);
    else if (e && Array.isArray(e.entries)) out.push(flattenEntries(e.entries));
    else if (e && Array.isArray(e.items)) out.push(flattenEntries(e.items));
  });
  return out.join("\n");
}
function stripTags(s) {   // convert 5e.tools {@tag ...} markup to plain text
  return (s || "")
    .replace(/{@(?:h|hit)}/gi, "Hit: ")
    .replace(/{@\w+ ([^}]+)}/g, (m, p) => { const a = p.split("|"); return (a.length > 2 && a[a.length - 1]) ? a[a.length - 1] : a[0]; })
    .replace(/{@\w+}/g, "");
}
function spellDice(raw) {
  const sc = raw.scalingLevelDice;                                  // cantrips scale with character level
  if (sc) {
    const scal = Array.isArray(sc) ? (sc[0] && sc[0].scaling) : sc.scaling;
    if (scal) { const lvl = totalLevel() || 1; let best = ""; Object.keys(scal).map(Number).sort((a, b) => a - b).forEach(th => { if (lvl >= th) best = scal[th]; }); if (best) return best; }
  }
  const txt = flattenEntries(raw.entries);
  const m = txt.match(/{@damage ([^}|]+)}/i) || txt.match(/{@dice ([^}|]+)}/i);
  return m ? m[1].trim() : "";
}
function parseSpell(raw) {
  const comp = raw.components || {};
  return {
    name: raw.name, source: raw.source, level: raw.level,
    school: SPELL_SCHOOLS[raw.school] || raw.school || "",
    ritual: !!(raw.meta && raw.meta.ritual),
    attack: !!raw.spellAttack,
    atkType: raw.spellAttack ? raw.spellAttack[0] : null,
    save: raw.savingThrow ? raw.savingThrow[0] : null,
    dmgTypes: raw.damageInflict || [],
    conds: raw.conditionInflict || [],
    conc: !!(raw.duration && raw.duration.some(d => d && d.concentration)),
    comp: { v: !!comp.v, s: !!comp.s, m: !!comp.m },
    cast: (raw.time && raw.time[0] && raw.time[0].unit) || "",
    dmg: spellDice(raw),
    srd: !!raw.srd || !!raw.basicRules,
    classes: (raw.classes && raw.classes.fromClassList || []).map(c => c.name),
    text: stripTags(flattenEntries(raw.entries)),
    higher: raw.entriesHigherLevel ? stripTags(flattenEntries(raw.entriesHigherLevel)) : "",
    // Tag-preserving versions of the above, kept only so the Spellcasting module can turn
    // {@damage}/{@dice} tags into click-to-roll links (see renderInlineSpellText in spellcasting.js).
    rawText: flattenEntries(raw.entries),
    rawHigher: raw.entriesHigherLevel ? flattenEntries(raw.entriesHigherLevel) : ""
  };
}
function mergeSpells(list) {
  const seen = new Set(SPELL_LIB.map(s => s.name + "|" + s.source));
  list.forEach(s => { const k = s.name + "|" + s.source; if (!seen.has(k)) { SPELL_LIB.push(s); seen.add(k); } });
  SPELL_LIB.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}
// 5e.tools ships per-spell class lists separately, in data/spells/sources.json — keyed by
// [source][spellName] -> { class:[{name,source}], classVariant:[{name,source,definedInSource}] }
// (classVariant = the same spell added to a class's list by a *different* sourcebook than the
// spell's own). Both count as "this class can cast this spell" for the Class filter.
function applySpellClasses(sourcesMap) {
  if (!sourcesMap) return;
  SPELL_LIB.forEach(s => {
    const bySpell = sourcesMap[s.source];
    const info = bySpell && bySpell[s.name];
    if (!info) return;
    const names = new Set(s.classes || []);
    (info.class || []).forEach(c => names.add(c.name));
    (info.classVariant || []).forEach(c => names.add(c.name));
    s.classes = [...names];
  });
}
function loadSpellFiles(files) {
  const total = files.length; let done = 0, errs = [], sourcesJson = null;
  [...files].forEach(file => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        if (/sources\.json$/i.test(file.name)) sourcesJson = j;
        else mergeSpells((j.spell || []).map(parseSpell));
      }
      catch (e) { errs.push(file.name + ": " + e); }
      if (++done === total) {
        if (sourcesJson) applySpellClasses(sourcesJson);
        saveSpellLib(); renderSpellLibrary(); if (errs.length) alert("Some files failed:\n" + errs.join("\n"));
      }
    };
    rd.readAsText(file);
  });
}
/* ----- auto-load from a local data/ folder (a copy of 5e.tools' own data/ dir, dropped next to the sheet) -----
   Only works when served over http(s) — browsers block fetch() of local files opened via file://. */
const SPELL_DATA_INDEX = "data/spells/index.json";
const SPELL_SOURCES_URL = "data/spells/sources.json";
async function autoLoadSpells() {
  let idx;
  try {
    const res = await fetch(SPELL_DATA_INDEX);
    if (!res.ok) return { found: false, blocked: false };
    idx = await res.json();
  } catch (e) { return { found: false, blocked: true }; }
  const files = Object.values(idx);
  const results = await Promise.allSettled(
    files.map(f => fetch("data/spells/" + f).then(r => r.ok ? r.json() : Promise.reject(r.status)))
  );
  let filesLoaded = 0;
  results.forEach(r => { if (r.status === "fulfilled") { mergeSpells((r.value.spell || []).map(parseSpell)); filesLoaded++; } });
  try {
    const res = await fetch(SPELL_SOURCES_URL);
    if (res.ok) applySpellClasses(await res.json());
  } catch (e) { /* class filter just stays empty if this one file is missing/unreadable */ }
  if (filesLoaded) saveSpellLib();
  return { found: true, blocked: false, filesLoaded, filesTotal: files.length };
}
function saveSpellLib() {
  try { localStorage.setItem("charsheet-spelllib", JSON.stringify({ v: LIB_SCHEMA, spells: SPELL_LIB })); }
  catch (e) { console.warn("Spell library too large for localStorage; kept in memory for this session only.", e); }
}
function loadSpellLib() {
  try {
    const d = JSON.parse(localStorage.getItem("charsheet-spelllib"));
    if (d && d.v === LIB_SCHEMA) SPELL_LIB = d.spells || [];
    else { SPELL_LIB = []; if (d) localStorage.removeItem("charsheet-spelllib"); } // stale schema → re-import
  } catch (e) { SPELL_LIB = []; }
  localStorage.removeItem("charsheet-spellsrcoff"); // retire old keys
}
function spellSources() { return [...new Set(SPELL_LIB.map(s => s.source))].sort(); }
function spellClassesInLib() { return [...new Set(SPELL_LIB.flatMap(s => s.classes || []))].sort(); }

/* ----- filter state persistence ----- */
function persistFilters() { try { localStorage.setItem("charsheet-spellfilters", JSON.stringify({ combine: moduleCombine, state: filterState })); } catch (e) {} }
function loadFilters() { try { const d = JSON.parse(localStorage.getItem("charsheet-spellfilters")); if (d) { moduleCombine = d.combine || "and"; filterState = d.state || {}; } } catch (e) {} }
function saveFilterDefaults() { try { localStorage.setItem("charsheet-spellfilter-defaults", JSON.stringify({ combine: moduleCombine, state: filterState })); } catch (e) {} persistFilters(); }
function resetFilters() {
  let d = null; try { d = JSON.parse(localStorage.getItem("charsheet-spellfilter-defaults")); } catch (e) {}
  if (d) { moduleCombine = d.combine || "and"; filterState = JSON.parse(JSON.stringify(d.state || {})); }
  else { filterState = {}; moduleCombine = "and"; }
  ensureStates(); $("spell-search").value = ""; persistFilters();
}

/* ----- filter interactions ----- */
function cycleState(gkey, v) { const st = filterState[gkey].states; st[v] = st[v] === "ignore" ? "include" : st[v] === "include" ? "exclude" : "ignore"; }
function handleCtrl(action, gkey) {
  const st = filterState[gkey], g = groupDef(gkey);
  if (action === "all") groupOpts(g).forEach(([v]) => st.states[v] = "include");
  else if (action === "clear") Object.keys(st.states).forEach(v => st.states[v] = "ignore");
  else if (action === "none") groupOpts(g).forEach(([v]) => st.states[v] = "exclude");
  else if (action === "bluemode") st.blueMode = nextMode(st.blueMode);
  else if (action === "redmode") st.redMode = nextMode(st.redMode);
  else if (action === "hide") st.hidden = !st.hidden;
}

/* ----- filter matching ----- */
function groupConstrained(g) { return Object.values(filterState[g.key].states).some(x => x !== "ignore"); }
function groupPass(g, s) {
  const st = filterState[g.key], vals = g.get(s);
  const inc = Object.keys(st.states).filter(v => st.states[v] === "include");
  const exc = Object.keys(st.states).filter(v => st.states[v] === "exclude");
  let incPass = true;
  if (inc.length) { const p = inc.filter(v => vals.includes(v)).length; incPass = st.blueMode === "and" ? p === inc.length : st.blueMode === "xor" ? p === 1 : p > 0; }
  let excPass = true;
  if (exc.length) { const p = exc.filter(v => vals.includes(v)).length; const excluded = st.redMode === "and" ? p === exc.length : st.redMode === "xor" ? p === 1 : p > 0; excPass = !excluded; }
  return incPass && excPass;
}

/* ----- rendering ----- */
function renderFilterArea() {
  ensureStates();
  const modBar = `<div class="modbar">
    <button id="mod-combine" title="how filter categories combine">Combine as ${moduleCombine.toUpperCase()}</button>
    <button id="mod-showall">Show All</button><button id="mod-hideall">Hide All</button>
    <button id="mod-reset">Reset</button><button id="mod-savedefault" title="save current filters as the default that Reset restores">Manage Defaults</button>
  </div>`;
  const groups = SPELL_FGROUPS.map(g => {
    const st = filterState[g.key];
    const ctrl = `<span class="fctrl">` +
      `<button class="fctrl-btn" data-fctrl="all" data-fg="${g.key}">All</button>` +
      `<button class="fctrl-btn" data-fctrl="clear" data-fg="${g.key}">Clear</button>` +
      `<button class="fctrl-btn" data-fctrl="none" data-fg="${g.key}">None</button>` +
      `<button class="fctrl-btn blue fmode" data-fctrl="bluemode" data-fg="${g.key}" title="how INCLUDE (blue) options combine">${st.blueMode.toUpperCase()}</button>` +
      `<button class="fctrl-btn red fmode" data-fctrl="redmode" data-fg="${g.key}" title="how EXCLUDE (red) options combine">${st.redMode.toUpperCase()}</button>` +
      `<button class="fctrl-btn" data-fctrl="hide" data-fg="${g.key}">${st.hidden ? "Show" : "Hide"}</button></span>`;
    const opts = st.hidden ? "" : groupOpts(g).map(([v, lab, title]) => {
      const s = st.states[v] || "ignore", cls = s === "include" ? "inc" : s === "exclude" ? "exc" : "";
      return `<button class="fbtn ${cls}" data-fgroup="${g.key}" data-fval="${v}"${title ? ` title="${title.replace(/"/g, "&quot;")}"` : ""}>${lab}</button>`;
    }).join("");
    return `<div class="fgroup"><div class="flabel">${g.label}</div><div class="fbody">${ctrl}${opts}</div></div>`;
  }).join("");
  $("spell-filter-area").innerHTML = modBar + groups;
}
function renderSpellLibrary() {
  $("spell-lib-count").textContent = SPELL_LIB.length ? (SPELL_LIB.length + " spells · " + spellSources().length + " source(s)") : "no spells loaded";
  renderFilterArea();
  renderSpellResults();
}
function renderSpellResults() {
  const q = ($("spell-search").value || "").toLowerCase().trim();
  const active = SPELL_FGROUPS.filter(groupConstrained);
  const rows = []; let more = 0;
  for (const s of SPELL_LIB) {
    if (q && !s.name.toLowerCase().includes(q)) continue;
    let pass;
    if (!active.length) pass = true;
    else if (moduleCombine === "and") pass = active.every(g => groupPass(g, s));
    else pass = active.some(g => groupPass(g, s));
    if (!pass) continue;
    if (rows.length >= 250) { more++; continue; }
    rows.push(s);
  }
  const el = $("spell-results");
  if (!SPELL_LIB.length) { el.innerHTML = "<div class='hint'>Load some spell files above to get started.</div>"; return; }
  if (!rows.length) { el.innerHTML = "<div class='hint'>no matches</div>"; return; }
  const body = rows.map(s => {
    const key = (s.name + "|" + s.source).replace(/"/g, "&quot;");
    const sv = s.attack ? "atk" : s.save ? (s.save.slice(0, 3) + " sv") : "";
    return `<tr>
      <td><button class="sp-lib-add" data-key="${key}" title="add to sheet">+</button></td>
      <td class="c"><b>${s.level}</b></td>
      <td class="nm"><a class="sp-name-link" data-key="${key}">${s.name}</a></td>
      <td class="hint">${s.school}</td>
      <td class="hint">${sv}</td>
      <td class="hint">${s.dmg || ""}</td>
      <td class="c hint" title="concentration">${s.conc ? "conc" : ""}</td>
      <td class="c hint" title="ritual">${s.ritual ? "R" : ""}</td>
      <td class="hint">${s.source}</td>
    </tr>`;
  }).join("");
  el.innerHTML = `<table class="spell-table"><tbody>${body}</tbody></table>` + (more ? `<div class='hint'>…and ${more} more — narrow your search</div>` : "");
}
function escapeHtml(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function toggleSpellDetail(link) {
  const tr = link.closest("tr"), next = tr.nextElementSibling;
  if (next && next.classList.contains("sp-detail")) { next.remove(); return; }  // toggle off
  const s = SPELL_LIB.find(x => (x.name + "|" + x.source) === link.dataset.key); if (!s) return;
  const comp = ["v", "s", "m"].filter(k => s.comp && s.comp[k]).map(k => k.toUpperCase()).join("") || "—";
  const meta = ["Level " + s.level, s.school, s.cast ? ("Cast: " + s.cast) : "", "Comp: " + comp,
    s.conc ? "Concentration" : "", s.ritual ? "Ritual" : "", s.save ? (s.save + " save") : "", s.attack ? "spell attack" : ""].filter(Boolean).join(" · ");
  const det = document.createElement("tr"); det.className = "sp-detail";
  det.innerHTML = `<td></td><td colspan="8"><div class="hint">${meta}</div><div>${escapeHtml(s.text).replace(/\n/g, "<br>")}</div>` +
    (s.higher ? `<div style="margin-top:3px"><b>At Higher Levels:</b> ${escapeHtml(s.higher).replace(/\n/g, "<br>")}</div>` : "") + `</td>`;
  tr.after(det);
}
function addSpellFromLib(key) {
  const s = SPELL_LIB.find(x => (x.name + "|" + x.source) === key); if (!s) return;
  addCharacterSpell($("spell-add-class").value, s.level, s.name);
}
