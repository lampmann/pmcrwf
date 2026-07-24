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
const ITEM_LIB_SCHEMA = 2;  // bump when the parsed-item shape changes (forces a one-time re-import)
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
function parseItem(raw) {
  const explicitGp = raw.value != null ? Math.round((raw.value / 100) * 100) / 100 : null;  // 5e.tools stores value in cp
  const rarityGp = explicitGp == null ? defaultRarityValueGp(raw) : null;
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
function findLibItemByName(name) {
  const q = (name || "").trim().toLowerCase(); if (!q) return null;
  return ITEM_LIB.find(i => i.name.toLowerCase() === q) || null;
}

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
function addItemFromLib(key) {
  const it = ITEM_LIB.find(x => (x.name + "|" + x.source) === key); if (!it) return;
  addCharacterItem(it.name);
}
