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
  XPHB:"Player's Handbook (2024)",
  /* The rest of 2014-era D&D. This list started spell-shaped, which is why the Equipment Library's
     book filter used to show bare abbreviations for most of its chips — items come from far more
     books than spells do (65 sources against about 30). Same rule as everywhere else in this file:
     short, fixed, prose-free lookup, no sourcebook text. */
  DMG:"Dungeon Master's Guide (2014)", MM:"Monster Manual (2014)", MTF:"Mordenkainen's Tome of Foes",
  VGM:"Volo's Guide to Monsters", MPMM:"Monsters of the Multiverse", MOT:"Mythic Odysseys of Theros",
  ERLW:"Eberron: Rising from the Last War", VRGR:"Van Richten's Guide to Ravenloft",
  BGG:"Bigby Presents: Glory of the Giants", DSotDQ:"Dragonlance: Shadow of the Dragon Queen",
  SDW:"Sleeping Dragon's Wake", AWM:"Adventure with Muk", OGA:"One Grung Above",
  BGDIA:"Baldur's Gate: Descent into Avernus", CM:"Candlekeep Mysteries", CoS:"Curse of Strahd",
  CRCotN:"Critical Role: Call of the Netherdeep", CoA:"Chains of Asmodeus", DC:"Divine Contention",
  DitLCoT:"Descent into the Lost Caverns of Tsojcanth", EET:"Elemental Evil: Trinkets",
  GoS:"Ghosts of Saltmarsh", "HAT-LMI":"Honor Among Thieves: Legendary Magic Items",
  HftT:"Hunt for the Thessalhydra", HotDQ:"Hoard of the Dragon Queen", IMR:"Infernal Machine Rebuild",
  JttRC:"Journeys through the Radiant Citadel", KftGV:"Keys from the Golden Vault",
  LMoP:"Lost Mine of Phandelver", LR:"Locathah Rising", LoX:"Light of Xaryxis",
  "MCV2DC":"Monstrous Compendium Volume 2: Dragonlance Creatures",
  "NRH-AT":"NERDS Restoring Harmony: Adventure Together", "NRH-TLT":"NERDS Restoring Harmony: The Lost Tomb",
  OotA:"Out of the Abyss", PaBTSO:"Phandelver and Below: The Shattered Obelisk", PotA:"Princes of the Apocalypse",
  PSA:"Plane Shift: Amonkhet", PSD:"Plane Shift: Dominaria", PSI:"Plane Shift: Innistrad",
  PSK:"Plane Shift: Kaladesh", PSX:"Plane Shift: Ixalan", PSZ:"Plane Shift: Zendikar",
  QftIS:"Quests from the Infinite Staircase", RMBRE:"The Lost Dungeon of Rickedness: Big Rick Energy",
  RoT:"The Rise of Tiamat", RoTOS:"The Rise of Tiamat Online Supplement", SKT:"Storm King's Thunder",
  TTP:"The Tortle Package", TftYP:"Tales from the Yawning Portal", ToA:"Tomb of Annihilation",
  VEoR:"Vecna: Eve of Ruin", WBtW:"The Wild Beyond the Witchlight", WDH:"Waterdeep: Dragon Heist",
  WDMM:"Waterdeep: Dungeon of the Mad Mage", XMtS:"X Marks the Spot", BAM:"Boo's Astral Menagerie",
  AZfyT:"A Zib for your Thoughts", "AitFR-THP":"Adventures in the Forgotten Realms: The Hidden Page",
  UATheMysticClass:"Unearthed Arcana: The Mystic Class",
};
// 5e.tools' own Core/Supplement/Adventure split (Parser.SOURCES_ADVENTURES vs. everything else in
// Parser.SOURCE_JSON_TO_FULL, with the 3 actual core rulebooks carved out of "everything else"):
// a short, fixed, prose-free lookup, same footing as SOURCE_NAMES above.
const SOURCE_GROUP = {
  PHB:"core", XPHB:"core", DMG:"core", MM:"core",
  ToR:"adventure", DD:"adventure", FS:"adventure", US:"adventure", IDRotF:"adventure", LLK:"adventure", "AitFR-AVT":"adventure",
  "AitFR-THP":"adventure", AWM:"adventure", AZfyT:"adventure", BGDIA:"adventure", CM:"adventure", CoA:"adventure",
  CoS:"adventure", CRCotN:"adventure", DC:"adventure", DitLCoT:"adventure", DSotDQ:"adventure", EET:"adventure",
  GoS:"adventure", "HAT-LMI":"adventure", HftT:"adventure", HotDQ:"adventure", IMR:"adventure", JttRC:"adventure",
  KftGV:"adventure", LMoP:"adventure", LR:"adventure", LoX:"adventure", "NRH-AT":"adventure", "NRH-TLT":"adventure",
  OGA:"adventure", OotA:"adventure", PaBTSO:"adventure", PotA:"adventure", QftIS:"adventure", RMBRE:"adventure",
  RoT:"adventure", RoTOS:"adventure", SDW:"adventure", SKT:"adventure", TTP:"adventure", TftYP:"adventure",
  ToA:"adventure", VEoR:"adventure", WBtW:"adventure", WDH:"adventure", WDMM:"adventure", XMtS:"adventure",
};
function sourceGroupOf(src) { return SOURCE_GROUP[src] || "supplement"; }
const LIB_SCHEMA = 6;  // bump when the parsed-spell shape changes (forces a one-time re-import)
function castCat(u) { return (u === "action" || u === "bonus" || u === "reaction" || u === "minute" || u === "hour") ? u : ""; }
// 5e.tools' Parser.SPELL_AREA_TYPE_TO_FULL — short area-of-effect shape codes from a spell's own
// areaTags field (not every spell has one; single-target spells usually don't).
const SPELL_AREA_TYPES = {
  ST:"Single Target", MT:"Multiple Targets", C:"Cube", N:"Cone", Y:"Cylinder", S:"Sphere",
  R:"Circle", Q:"Square", L:"Line", H:"Hemisphere", W:"Wall", E:"Emanation",
};
// Categorized range (Parser.SPELL_ATTACK_TYPE_TO_FULL groups distance into a handful of buckets;
// exact distances are a numeric-range filter, tracked separately — see DOCS.md's Range-valued filters).
function rangeCat(raw) {
  const r = raw.range; if (!r) return "";
  const d = r.distance; if (!d) return "special";
  if (d.type === "self" || d.type === "touch" || d.type === "sight" || d.type === "unlimited") return d.type;
  return "ranged"; // feet or miles
}
// Exact numeric range in feet, for the Range-valued (numeric) filter — only meaningful for a
// feet-based range (miles/touch/self/sight/unlimited have no comparable "how far" number).
function rangeFeet(raw) {
  const d = raw.range && raw.range.distance;
  return (d && d.type === "feet" && typeof d.amount === "number") ? d.amount : null;
}
function durationCat(raw) { const du = raw.duration && raw.duration[0]; return du ? du.type : ""; }
// filter groups. `dynamic` groups (Source) compute their options from the loaded library.
const SPELL_FGROUPS = [
  { key:"source", label:"Source", dynamic:true, get:s=>[s.source], dynOpts:()=>spellSources().map(src=>[src, src, SOURCE_NAMES[src]||src]) },
  { key:"srcgroup", label:"Source Group", get:s=>[sourceGroupOf(s.source)], opts:[["core","Core"],["supplement","Supplement"],["adventure","Adventure"]] },
  // Not every 5e.tools data dump includes per-spell class lists ("classes.fromClassList") —
  // when it's missing this group just has no options to show (see DOCS re: import-not-hardcode).
  { key:"cls",    label:"Class",  dynamic:true, get:s=>s.classes||[], dynOpts:spellClassesInLib },
  { key:"level",  label:"Level",  get:s=>[String(s.level)], opts:[["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]] },
  { key:"school", label:"School", get:s=>[s.school], opts:["Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"].map(x=>[x,x]) },
  { key:"dmg",    label:"Damage", get:s=>s.dmgTypes, opts:["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"].map(x=>[x, x[0].toUpperCase()+x.slice(1)]) },
  { key:"save",   label:"Save",   get:s=>s.save?[s.save]:[], opts:[["strength","Str"],["dexterity","Dex"],["constitution","Con"],["intelligence","Int"],["wisdom","Wis"],["charisma","Cha"]] },
  { key:"atk",    label:"Spell Attack", get:s=>s.attack?[s.atkType]:[], opts:[["M","Melee"],["R","Ranged"],["O","Other"]] },
  { key:"cond",   label:"Conditions Inflicted", get:s=>s.conds||[],
    opts:["blinded","charmed","deafened","exhaustion","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"]
      .map(x=>[x, x[0].toUpperCase()+x.slice(1)]) },
  { key:"range",  label:"Range",  get:s=>s.rangeCat?[s.rangeCat]:[], opts:[["self","Self"],["touch","Touch"],["ranged","Ranged"],["sight","Sight"],["unlimited","Unlimited"],["special","Special"]] },
  // Exact-distance filter — only spells with a plain feet-based range have a value here (see
  // rangeFeet() above); the categorical Range group just above covers Self/Touch/Sight/Unlimited/Special.
  { key:"rangeft", label:"Range (ft)", kind:"range", unit:"ft", min:5, max:1000, getNum:s=>s.rangeFt },
  { key:"area",   label:"Area of Effect", get:s=>s.areaTags||[], opts:Object.entries(SPELL_AREA_TYPES).map(([v,lab])=>[v,lab]) },
  { key:"dur",    label:"Duration", get:s=>s.durType?[s.durType]:[], opts:[["instant","Instantaneous"],["timed","Timed"],["permanent","Permanent"],["special","Special"]] },
  { key:"cast",   label:"Cast",   get:s=>[castCat(s.cast)], opts:[["action","Action"],["bonus","Bonus"],["reaction","Reaction"],["minute","Minute+"],["hour","Hour+"]] },
  { key:"comp",   label:"Components", get:s=>["v","s","m"].filter(k=>s.comp&&s.comp[k]), opts:[["v","Verbal"],["s","Somatic"],["m","Material"]] },
  { key:"misc",   label:"Misc",   get:s=>["conc","ritual","attack","srd"].filter(k=> k==="conc"?s.conc : k==="ritual"?s.ritual : k==="attack"?s.attack : s.srd), opts:[["conc","Concentration"],["ritual","Ritual"],["attack","Attack roll"],["srd","SRD"]] },
];
let SPELL_LIB = [];
// The tri-state filter state machine lives in src/filters.js, shared with the Equipment Library.
// ns "spell" keeps the existing localStorage keys (charsheet-spellfilters / -spellfilter-defaults).
const SPELL_FILTERS = createFilterSet({
  ns: "spell", groups: SPELL_FGROUPS, areaId: "spell-filter-area", searchId: "spell-search",
  onChange: () => renderSpellResults(),
});

// flattenEntries/stripTags now live in text-utils.js (shared with the Node-side effects pipeline).
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
    areaTags: raw.areaTags || [],
    rangeCat: rangeCat(raw),
    rangeFt: rangeFeet(raw),
    durType: durationCat(raw),
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

function renderSpellLibrary() {
  $("spell-lib-count").textContent = SPELL_LIB.length ? (SPELL_LIB.length + " spells · " + spellSources().length + " source(s)") : "no spells loaded";
  SPELL_FILTERS.renderArea();
  renderSpellResults();
}
function renderSpellResults() {
  const q = ($("spell-search").value || "").toLowerCase().trim();
  const active = SPELL_FILTERS.activeGroups();
  const rows = []; let more = 0;
  for (const s of SPELL_LIB) {
    if (q && !s.name.toLowerCase().includes(q)) continue;
    if (!SPELL_FILTERS.passes(s, active)) continue;
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
// String() coercion, not just a null-guard: callers pass values straight out of imported 5e.tools
// JSON, which is not always the string the surrounding code assumes (see collectNames in
// class-library.js). A malformed value should render oddly, never throw and kill the whole render.
function escapeHtml(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
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
