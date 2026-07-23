/* ============================================================
   EQUIPMENT LIBRARY — import & search 5e.tools item JSON
   Accepts items-base.json ("baseitem"), items.json ("item"), or any file
   with either array — one search box, one import button, nothing to configure.
   ============================================================ */
const ITEM_TYPES = {
  $:"Treasure", A:"Ammunition", AF:"Ammunition (Firearm)", AT:"Artisan's Tools", EM:"Eldritch Machine",
  EXP:"Explosive", FD:"Food & Drink", G:"Adventuring Gear", GS:"Gaming Set", HA:"Heavy Armor",
  INS:"Instrument", LA:"Light Armor", M:"Melee Weapon", MA:"Medium Armor", MNT:"Mount", OTH:"Other",
  P:"Potion", R:"Ranged Weapon", RD:"Rod", RG:"Ring", S:"Shield", SC:"Scroll", SCF:"Spellcasting Focus",
  T:"Tools", TAH:"Tack & Harness", TG:"Trade Good", VEH:"Vehicle (Land)", SHP:"Ship", WD:"Wand",
};
const ITEM_LIB_SCHEMA = 1;  // bump when the parsed-item shape changes (forces a one-time re-import)
let ITEM_LIB = [];

function parseItemType(raw) {
  const code = (raw.type || "").split("|")[0];
  return ITEM_TYPES[code] || code || "";
}
function parseItem(raw) {
  return {
    name: raw.name,
    source: raw.source || "",
    type: parseItemType(raw),
    rarity: (raw.rarity && raw.rarity !== "none") ? raw.rarity : "",
    weight: raw.weight != null ? raw.weight : "",
    valueGp: raw.value != null ? Math.round((raw.value / 100) * 100) / 100 : "",  // 5e.tools stores value in cp
    srd: !!raw.srd || !!raw.basicRules,
  };
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
        const raws = [].concat(j.baseitem || [], j.item || [], j.itemGroup || []);
        mergeItems(raws.map(parseItem));
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
      const raws = [].concat(j.baseitem || [], j.item || [], j.itemGroup || []);
      mergeItems(raws.map(parseItem));
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

function renderItemLibrary() {
  $("item-lib-count").textContent = ITEM_LIB.length ? (ITEM_LIB.length + " items · " + itemSources().length + " source(s)") : "no equipment loaded";
  renderItemResults();
}
function renderItemResults() {
  const q = ($("item-search").value || "").toLowerCase().trim();
  const rows = []; let more = 0;
  for (const it of ITEM_LIB) {
    if (q && !(it.name + " " + it.type + " " + it.rarity + " " + it.source).toLowerCase().includes(q)) continue;
    if (rows.length >= 250) { more++; continue; }
    rows.push(it);
  }
  const el = $("item-results");
  if (!ITEM_LIB.length) { el.innerHTML = "<div class='hint'>Load some equipment files above to get started.</div>"; return; }
  if (!rows.length) { el.innerHTML = "<div class='hint'>no matches</div>"; return; }
  const body = rows.map(it => {
    const key = (it.name + "|" + it.source).replace(/"/g, "&quot;");
    return `<tr>
      <td><button class="itm-lib-add" data-key="${key}" title="add to inventory">+</button></td>
      <td class="nm">${it.name}</td>
      <td class="hint">${it.type}</td>
      <td class="hint">${it.rarity}</td>
      <td class="c hint">${it.weight === "" ? "" : it.weight}</td>
      <td class="c hint">${it.valueGp === "" ? "" : it.valueGp}</td>
      <td class="hint">${it.source}</td>
    </tr>`;
  }).join("");
  el.innerHTML = `<table class="spell-table"><tbody>${body}</tbody></table>` + (more ? `<div class='hint'>…and ${more} more — narrow your search</div>` : "");
}
function addItemFromLib(key) {
  const it = ITEM_LIB.find(x => (x.name + "|" + x.source) === key); if (!it) return;
  addItemRow({ qty: 1, name: it.name, wt: it.weight === "" ? "" : String(it.weight), val: it.valueGp === "" ? "" : String(it.valueGp) });
  recompute(); scheduleSave();
}
