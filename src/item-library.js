/* ============================================================
   EQUIPMENT LIBRARY — import & search 5e.tools item JSON
   Accepts items-base.json ("baseitem"), items.json ("item"), or any file
   with either array — one search box, one import button, nothing to configure.
   ============================================================ */
const ITEM_TYPES = {
  $:"Treasure", "$A":"Treasure (Art Object)", "$C":"Treasure (Coinage)", "$G":"Treasure (Gemstone)",
  A:"Ammunition", AF:"Ammunition (Firearm)", AIR:"Vehicle (Air)", AT:"Artisan's Tools", EM:"Eldritch Machine",
  EXP:"Explosive", FD:"Food & Drink", G:"Adventuring Gear", GS:"Gaming Set", GV:"Generic Variant", HA:"Heavy Armor",
  INS:"Instrument", LA:"Light Armor", M:"Melee Weapon", MA:"Medium Armor", MNT:"Mount", OTH:"Other",
  P:"Potion", R:"Ranged Weapon", RD:"Rod", RG:"Ring", S:"Shield", SC:"Scroll", SCF:"Spellcasting Focus",
  SPC:"Vehicle (Space)", T:"Tools", TAH:"Tack & Harness", TG:"Trade Good", VEH:"Vehicle (Land)",
  SHP:"Vehicle (Water)", WD:"Wand",
};
// 5e.tools weapon/armor property codes (data/items-base.json "property"), suffixed with |SOURCE
// for the non-core ones (e.g. "Vst|EGW") — split on "|" the same way item type codes are.
const ITEM_PROPS = {
  "2H":"Two-Handed", A:"Ammunition", AF:"Ammunition (Firearm)", BF:"Burst Fire", F:"Finesse", H:"Heavy",
  L:"Light", LD:"Loading", R:"Reach", RLD:"Reload", S:"Special", T:"Thrown", V:"Versatile", Vst:"Vestige of Divergence",
};
// data/items*.json "miscTags"
const ITEM_MISC_TAGS = { "CF/W":"Creates Food/Water", CNS:"Consumable", TT:"Trinket Table" };
// 5e.tools damage-type codes (weapon dmgType / dmg2)
const DMG_TYPE_NAMES = {
  A:"Acid", B:"Bludgeoning", C:"Cold", F:"Fire", O:"Force", L:"Lightning", N:"Necrotic",
  P:"Piercing", I:"Poison", Y:"Psychic", R:"Radiant", S:"Slashing", T:"Thunder",
};
// resist/immune/vulnerable are stored as full lowercase names, not codes
const DMG_FILTER_TYPES = ["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"];
// Which classes each spellcasting-focus type serves — 5e.tools presents this category by class
// rather than by the raw arcane/druid/holy code the data stores.
const SCF_CLASSES = {
  arcane: ["Artificer", "Sorcerer", "Warlock", "Wizard"],
  druid: ["Druid", "Ranger"],
  holy: ["Cleric", "Paladin"],
};
const ITEM_LIB_SCHEMA = 4;  // bump when the parsed-item shape changes (forces a one-time re-import)
let ITEM_LIB = [];

// Individual magic items in 5e.tools rarely carry an explicit "value" — these are the average gp
// asking price per rarity from XGE's "Magic Item Price" table (Xanathar's Guide to Everything, p.126,
// data/book/book-xge.json ~L5628), halved for consumables per that table's own footnote, applied when
// an item's data marks it as one via a "consumable" flag.
const RARITY_DEFAULT_GP = { common: 45, uncommon: 350, rare: 11000, "very rare": 35000, legendary: 175000 };
function defaultRarityValueGp(raw) {
  const base = RARITY_DEFAULT_GP[raw.rarity];
  if (base == null) return null;
  return raw.consumable ? base / 2 : base;
}
function parseItemType(raw) {
  const code = (raw.type || "").split("|")[0];
  return ITEM_TYPES[code] || code || "";
}
// Armor category drives the AC formula (see armorClassAuto in derived.js): light armor adds the
// full DEX mod, medium caps it at +2, heavy ignores it; a shield is a flat +2 rather than a base AC.
const ARMOR_CAT_BY_TYPE_CODE = { LA: "light", MA: "medium", HA: "heavy", S: "shield" };

/* ----- filterable facets, derived once at parse time so filtering never re-reads raw JSON ----- */
// "Requires Attunement By..." is its own bucket in 5e.tools because attunement restricted to a
// class/race/alignment is a very different shopping constraint from plain attunement.
function attuneBucket(raw) {
  if (raw.reqAttune === true) return "required";
  if (raw.reqAttune === "optional") return "optional";
  if (typeof raw.reqAttune === "string" && raw.reqAttune) return "by";
  return "none";
}
// baseitem/itemGroup/baseItem-reference is how 5e.tools distinguishes a plain longsword from the
// generic "+1 Weapon" template from the specific "+1 Longsword" it expands into.
function itemCategory(raw, sourceArray) {
  if (sourceArray === "baseitem") return "Basic";
  if (sourceArray === "itemGroup") return "Generic Variant";
  if (raw.baseItem) return "Specific Variant";
  return "Other";
}
function itemBonuses(raw) {
  const out = [];
  const add = (label, val) => { if (val) { out.push(label); out.push(label + " (" + val + ")"); } };
  add("Weapon Attack and Damage Rolls", raw.bonusWeapon);
  add("Weapon Attack Rolls", raw.bonusWeaponAttack);
  add("Weapon Damage Rolls", raw.bonusWeaponDamage);
  add("Armor Class", raw.bonusAc);
  add("Spell Attacks", raw.bonusSpellAttack);
  add("Spell Save DC", raw.bonusSpellSaveDc);
  add("Saving Throws", raw.bonusSavingThrow);
  add("Proficiency Bonus", raw.bonusProficiencyBonus);
  return out;
}
function itemMisc(raw) {
  const t = [];
  (raw.miscTags || []).forEach(m => { if (ITEM_MISC_TAGS[m]) t.push(ITEM_MISC_TAGS[m]); });
  if (raw.rarity && raw.rarity !== "none") t.push("Magic"); else t.push("Mundane");
  if (raw.curse) t.push("Cursed");
  if (raw.sentient) t.push("Sentient");
  if (raw.charges != null) t.push("Charges");
  if (raw.stealth) t.push("Disadvantage on Stealth");
  if (raw.strength) t.push("Strength Requirement");
  if (raw.grantsLanguage) t.push("Grants Language");
  if (raw.grantsProficiency) t.push("Grants Proficiency");
  if (raw.modifySpeed) t.push("Speed Adjustment");
  if (raw.ability) t.push("Ability Score Adjustment");
  if (raw.items) t.push("Bundle");
  if (raw.srd) t.push("SRD 5.1");
  if (raw.basicRules) t.push("Basic Rules (2014)");
  if (raw.reprintedAs) t.push("Reprinted");
  if (raw._isItemGroup || raw.items) t.push("Item Group");
  return [...new Set(t)];
}

function parseItem(raw, sourceArray) {
  const explicitGp = raw.value != null ? Math.round((raw.value / 100) * 100) / 100 : null;  // 5e.tools stores value in cp
  const rarityGp = explicitGp == null ? defaultRarityValueGp(raw) : null;
  const typeCode = (raw.type || "").split("|")[0];
  return {
    name: raw.name,
    source: raw.source || "",
    type: parseItemType(raw),
    rarity: (raw.rarity && raw.rarity !== "none") ? raw.rarity : "",
    weight: raw.weight != null ? raw.weight : "",
    valueGp: explicitGp != null ? explicitGp : (rarityGp != null ? rarityGp : ""),
    valueDefaulted: rarityGp != null,  // true when the value came from RARITY_DEFAULT_GP, not the source data
    srd: !!raw.srd || !!raw.basicRules,
    reqAttune: raw.reqAttune === true ? "requires attunement" : raw.reqAttune ? ("requires attunement " + raw.reqAttune) : "",
    text: stripTags(flattenEntries(raw.entries)),
    // ----- armor (see armorClassAuto in derived.js) -----
    armor: !!raw.armor,
    armorCat: ARMOR_CAT_BY_TYPE_CODE[typeCode] || "",
    ac: raw.ac != null ? raw.ac : null,
    strengthReq: raw.strength ? Number(raw.strength) : null,
    stealthDisadvantage: !!raw.stealth,
    // ----- weapon (see the Attacks module, src/attacks.js) -----
    weapon: !!raw.weapon,
    weaponCategory: raw.weaponCategory || "",
    dmg1: raw.dmg1 || "",
    dmg2: raw.dmg2 || "",
    dmgType: raw.dmgType || "",
    range: raw.range || "",
    weaponProps: raw.property || [],
    // ----- filter facets (see ITEM_FGROUPS) -----
    tier: raw.tier || "",
    props: (raw.property || []).map(p => ITEM_PROPS[String(p).split("|")[0]]).filter(Boolean),
    attune: attuneBucket(raw),
    category: itemCategory(raw, sourceArray),
    scfClasses: SCF_CLASSES[raw.scfType] || [],
    dmgTypeName: DMG_TYPE_NAMES[raw.dmgType] || "",
    bonuses: itemBonuses(raw),
    vulnerable: raw.vulnerable || [],
    resist: raw.resist || [],
    immune: raw.immune || [],
    conditionImmune: raw.conditionImmune || [],
    misc: itemMisc(raw),
    /* A "generic variant" (5e.tools' itemGroup) is a CATEGORY, not something you own — "Armor of
       Resistance" lists the ten concrete items it stands for. Keeping those names is what lets the
       library offer them when you try to add the group, instead of putting an un-resolvable line
       with no weight, value or AC into your inventory. */
    groupItems: Array.isArray(raw.items) ? raw.items.map(n => String(n).split("|")[0]) : [],
    recharge: raw.recharge || "",
    poisonTypes: raw.poisonTypes || [],
    lootTables: raw.lootTables || [],
  };
}
// Which array an entry came from is itself a filter facet (Basic / Generic Variant / …), so parse
// each array separately rather than concatenating them first.
function parseItemArrays(j) {
  return [].concat(
    (j.baseitem || []).map(r => parseItem(r, "baseitem")),
    (j.item || []).map(r => parseItem(r, "item")),
    (j.itemGroup || []).map(r => parseItem(r, "itemGroup")),
  );
}
function mergeItems(list) {
  const seen = new Set(ITEM_LIB.map(i => i.name + "|" + i.source));
  list.forEach(i => { if (!i.name) return; const k = i.name + "|" + i.source; if (!seen.has(k)) { ITEM_LIB.push(i); seen.add(k); } });
  ITEM_LIB.sort((a, b) => a.name.localeCompare(b.name));
}
function loadItemFiles(files) {
  const total = files.length; let done = 0, errs = [];
  [...files].forEach(file => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        mergeItems(parseItemArrays(j));
      } catch (e) { errs.push(file.name + ": " + e); }
      if (++done === total) { saveItemLib(); renderItemLibrary(); if (errs.length) alert("Some files failed:\n" + errs.join("\n")); }
    };
    rd.readAsText(file);
  });
}
/* ----- auto-load from a local data/ folder (a copy of 5e.tools' own data/ dir, dropped next to the sheet) -----
   Only works when served over http(s) — browsers block fetch() of local files opened via file://. */
const ITEM_DATA_FILES = ["data/items-base.json", "data/items.json"];
async function autoLoadItems() {
  let found = false, blocked = false, filesLoaded = 0;
  for (const url of ITEM_DATA_FILES) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      found = true;
      const j = await res.json();
      mergeItems(parseItemArrays(j));
      filesLoaded++;
    } catch (e) { blocked = true; }
  }
  if (filesLoaded) saveItemLib();
  return { found, blocked, filesLoaded, filesTotal: ITEM_DATA_FILES.length };
}
function saveItemLib() {
  try { localStorage.setItem("charsheet-itemlib", JSON.stringify({ v: ITEM_LIB_SCHEMA, items: ITEM_LIB })); }
  catch (e) { console.warn("Item library too large for localStorage; kept in memory for this session only.", e); }
}
function loadItemLib() {
  try {
    const d = JSON.parse(localStorage.getItem("charsheet-itemlib"));
    if (d && d.v === ITEM_LIB_SCHEMA) ITEM_LIB = d.items || [];
    else { ITEM_LIB = []; if (d) localStorage.removeItem("charsheet-itemlib"); } // stale schema -> re-import
  } catch (e) { ITEM_LIB = []; }
}
function itemSources() { return [...new Set(ITEM_LIB.map(i => i.source))].sort(); }
function itemLootTables() { return [...new Set(ITEM_LIB.flatMap(i => i.lootTables || []))].sort(); }
function itemDmgDice() {
  // sorted by die size then count, so 1d4 … 1d12 reads naturally instead of alphabetically
  const parse = d => { const m = /^(\d*)d(\d+)$/.exec(d); return m ? [Number(m[2]), Number(m[1] || 1)] : [0, Number(d) || 0]; };
  return [...new Set(ITEM_LIB.map(i => i.dmg1).filter(Boolean))]
    .sort((a, b) => { const pa = parse(a), pb = parse(b); return pa[0] - pb[0] || pa[1] - pb[1]; });
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// A weapon's "range" field is 5e.tools' raw "normal/long" string (e.g. "80/320"); melee weapons
// without one have "". Only the normal range is filterable as a single number.
function itemNormalRange(i) {
  if (!i.range) return null;
  const n = parseInt(i.range.split("/")[0], 10);
  return isNaN(n) ? null : n;
}

/* Filter categories, mirroring 5e.tools' own item filter panel. Range-valued facets it also
   offers (Cost, Weight, Armor Class, Range) need a slider rather than tri-state buttons and
   aren't here yet — see DOCS. Free-text facets over huge value sets (Base Item, Attached
   Spells) are likewise left to the search box. */
const ITEM_FGROUPS = [
  { key:"source", label:"Source", dynamic:true, get:i=>[i.source],
    dynOpts:()=>itemSources().map(src=>[src, src, (typeof SOURCE_NAMES !== "undefined" && SOURCE_NAMES[src]) || src]) },
  // Shared with the Spell Library's own "Source Group" filter — see sourceGroupOf() in spell-library.js.
  { key:"srcgroup", label:"Source Group", get:i=>[typeof sourceGroupOf === "function" ? sourceGroupOf(i.source) : "supplement"],
    opts:[["core","Core"],["supplement","Supplement"],["adventure","Adventure"]] },
  { key:"type", label:"Type", dynamic:true, get:i=>i.type?[i.type]:[], dynOpts:()=>[...new Set(ITEM_LIB.map(i=>i.type).filter(Boolean))].sort() },
  { key:"tier", label:"Tier", get:i=>[i.tier||"none"], opts:[["none","None"],["minor","Minor"],["major","Major"]] },
  { key:"rarity", label:"Rarity", get:i=>[i.rarity||"none"],
    opts:[["none","None"],["common","Common"],["uncommon","Uncommon"],["rare","Rare"],["very rare","Very Rare"],["legendary","Legendary"],["artifact","Artifact"],["varies","Varies"],["unknown","Unknown"],["unknown (magic)","Unknown (Magic)"]] },
  { key:"property", label:"Property", dynamic:true, get:i=>i.props||[],
    dynOpts:()=>[...new Set(ITEM_LIB.flatMap(i=>i.props||[]))].sort() },
  { key:"attune", label:"Attunement", get:i=>[i.attune],
    opts:[["required","Requires Attunement"],["by","Requires Attunement By…"],["optional","Attunement Optional"],["none","No Attunement Required"]] },
  { key:"category", label:"Category", get:i=>[i.category],
    opts:[["Basic","Basic"],["Generic Variant","Generic Variant"],["Specific Variant","Specific Variant"],["Other","Other"]] },
  { key:"scf", label:"Spellcasting Focus", get:i=>i.scfClasses||[],
    opts:["Artificer","Bard","Cleric","Druid","Paladin","Ranger","Sorcerer","Warlock","Wizard"].map(c=>[c,c]) },
  { key:"wdmgtype", label:"Weapon Damage Type", get:i=>i.dmgTypeName?[i.dmgTypeName]:[],
    opts:["Bludgeoning","Cold","Fire","Force","Necrotic","Piercing","Radiant","Slashing"].map(x=>[x,x]) },
  { key:"wdmgdice", label:"Weapon Damage Dice", dynamic:true, get:i=>i.dmg1?[i.dmg1]:[], dynOpts:itemDmgDice },
  { key:"bonus", label:"Bonus", dynamic:true, get:i=>i.bonuses||[],
    dynOpts:()=>[...new Set(ITEM_LIB.flatMap(i=>i.bonuses||[]))].sort() },
  { key:"vuln", label:"Vulnerability", get:i=>i.vulnerable||[], opts:DMG_FILTER_TYPES.map(x=>[x,cap(x)]) },
  { key:"resist", label:"Resistance", get:i=>i.resist||[], opts:DMG_FILTER_TYPES.map(x=>[x,cap(x)]) },
  { key:"immune", label:"Immunity", get:i=>i.immune||[], opts:DMG_FILTER_TYPES.map(x=>[x,cap(x)]) },
  { key:"condimm", label:"Condition Immunity", get:i=>i.conditionImmune||[],
    opts:["blinded","charmed","deafened","disease","exhaustion","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious"].map(x=>[x,cap(x)]) },
  { key:"misc", label:"Miscellaneous", dynamic:true, get:i=>i.misc||[],
    dynOpts:()=>[...new Set(ITEM_LIB.flatMap(i=>i.misc||[]))].sort() },
  { key:"recharge", label:"Recharge Type", get:i=>i.recharge?[i.recharge]:[],
    opts:[["dawn","Dawn"],["dusk","Dusk"],["midnight","Midnight"],["restLong","Long Rest"],["restShort","Short Rest"],["special","Special"]] },
  { key:"poison", label:"Poison Type", get:i=>i.poisonTypes||[],
    opts:[["contact","Contact"],["ingested","Ingested"],["inhaled","Inhaled"],["injury","Injury"]] },
  { key:"foundon", label:"Found On", dynamic:true, get:i=>i.lootTables||[], dynOpts:itemLootTables },
  // ----- numeric-range filters (src/filters.js's "range" control kind) -----
  { key:"cost", label:"Cost", kind:"range", unit:"gp", min:0, max:1000000, getNum:i=>i.valueGp===""?null:i.valueGp },
  { key:"weight", label:"Weight", kind:"range", unit:"lb", min:0, max:2000, getNum:i=>i.weight===""?null:i.weight },
  { key:"ac", label:"Armor Class", kind:"range", unit:"AC", min:0, max:25, getNum:i=>i.armor?i.ac:null },
  { key:"wrange", label:"Range", kind:"range", unit:"ft (normal)", min:0, max:600, getNum:i=>itemNormalRange(i) },
];
const ITEM_FILTERS = createFilterSet({
  ns: "item", groups: ITEM_FGROUPS, areaId: "item-filter-area", searchId: "item-search",
  onChange: () => renderItemResults(),
});

function findLibItemByName(name) {
  const q = (name || "").trim().toLowerCase(); if (!q) return null;
  return ITEM_LIB.find(i => i.name.toLowerCase() === q) || null;
}

/* The character's own item list resolves weight/value/description out of ITEM_LIB by name, so it has
   to be repainted whenever the library itself changes — it is no longer redrawn by recompute(). */
function renderItemLibrary() {
  if (typeof renderItemList === "function") renderItemList();
  $("item-lib-count").textContent = ITEM_LIB.length ? (ITEM_LIB.length + " items · " + itemSources().length + " source(s)") : "no equipment loaded";
  ITEM_FILTERS.renderArea();
  renderItemResults();
}
function renderItemResults() {
  const q = ($("item-search").value || "").toLowerCase().trim();
  const active = ITEM_FILTERS.activeGroups();
  const rows = []; let more = 0;
  for (const it of ITEM_LIB) {
    if (q && !(it.name + " " + it.type + " " + it.rarity + " " + it.source).toLowerCase().includes(q)) continue;
    if (!ITEM_FILTERS.passes(it, active)) continue;
    if (rows.length >= 250) { more++; continue; }
    rows.push(it);
  }
  const el = $("item-results");
  if (!ITEM_LIB.length) { el.innerHTML = "<div class='hint'>Load some equipment files above to get started.</div>"; return; }
  if (!rows.length) { el.innerHTML = "<div class='hint'>no matches</div>"; return; }
  const body = rows.map(it => {
    const key = (it.name + "|" + it.source).replace(/"/g, "&quot;");
    const isGroup = it.groupItems.length > 0;
    return `<tr>
      <td><button class="itm-lib-add" data-key="${key}" title="${isGroup ? `${it.name} is a category — pick which one you actually have` : "add to inventory"}">${isGroup ? "&hellip;" : "+"}</button></td>
      <td class="nm"><a class="itm-name-link" data-key="${key}">${it.name}</a></td>
      <td class="hint">${it.type}</td>
      <td class="hint">${it.rarity}</td>
      <td class="c hint">${it.weight === "" ? "" : it.weight}</td>
      <td class="c hint"${it.valueDefaulted ? ` title="estimated by rarity — no official price in the source data"` : ""}>${it.valueGp === "" ? "" : (it.valueDefaulted ? "~" + it.valueGp : it.valueGp)}</td>
      <td class="hint">${it.source}</td>
    </tr>`;
  }).join("");
  el.innerHTML = `<table class="spell-table"><tbody>${body}</tbody></table>` + (more ? `<div class='hint'>…and ${more} more — narrow your search</div>` : "");
}
function toggleItemDetail(link) {
  const tr = link.closest("tr"), next = tr.nextElementSibling;
  if (next && next.classList.contains("sp-detail")) { next.remove(); return; }
  const it = ITEM_LIB.find(x => (x.name + "|" + x.source) === link.dataset.key); if (!it) return;
  const meta = [it.type, it.rarity, it.reqAttune].filter(Boolean).join(" · ");
  const det = document.createElement("tr"); det.className = "sp-detail";
  det.innerHTML = `<td></td><td colspan="6"><div class="hint">${meta}</div><div>${escapeHtml(it.text).replace(/\n/g, "<br>")}</div></td>`;
  tr.after(det);
}
/* Adding from the library. A generic variant ("Armor of Resistance", "Cast-Off Armor") is a category
   rather than a thing you can own — adding its name would put a line in your inventory with no
   weight, value, AC or description, since nothing in the data describes the category itself. So the
   "…" button expands the category's members inline and each of those is addable, the same
   click-to-expand idiom the rest of the sheet uses. */
function addItemFromLib(key, btn) {
  const it = ITEM_LIB.find(x => (x.name + "|" + x.source) === key); if (!it) return;
  if (!it.groupItems.length) { addCharacterItem(it.name); return; }
  const tr = btn && btn.closest("tr"); if (!tr) { addCharacterItem(it.name); return; }
  const next = tr.nextElementSibling;
  if (next && next.classList.contains("itm-group-row")) { next.remove(); return; }
  // Members that exist in the loaded library get their real entry (and so their real stats); one
  // that doesn't is still offered, because the character may own it even if the book isn't loaded.
  const members = it.groupItems.map(n => {
    const rec = findLibItemByName(n);
    return { name: n, key: rec ? (rec.name + "|" + rec.source) : "", known: !!rec };
  });
  const row = document.createElement("tr"); row.className = "itm-group-row";
  row.innerHTML = `<td></td><td colspan="6"><div class="hint">${escapeHtml(it.name)} is a category — add the specific item you have:</div>
    <div>${members.map(m => `<button class="itm-group-pick" data-name="${escapeHtml(m.name)}"${m.known ? "" : ` title="not in the loaded library — added by name only"`}>${escapeHtml(m.name)}${m.known ? "" : " *"}</button>`).join(" ")}</div></td>`;
  tr.after(row);
}
