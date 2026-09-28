/* ============================================================
   2014 / 2024 CONTENT

   5e.tools ships the 2024 books next to the 2014 ones,
   often with the same names: two Fireballs, two Fighters, two Elves. The
   sheet keeps one record per name, and this switch (top bar, per browser)
   decides which:

     off (default)  records from the 2024 books are left out entirely
     on             a 2024 record replaces its 2014 namesake; records only
                    one edition has are kept either way

   "The 2024 books" are the core three (XPHB, XDMG, XMM), the later books
   written for those rules that this file names, and any book your data's
   books.json / adventures.json dates on or after the 2024 Player's Handbook,
   so a book released after this was written still counts.

   Libraries keyed by name (classes, races, feats, backgrounds, languages,
   optional features) resolve this through preferRulesRecord as they load;
   the spell, item and monster lists through editionMerge. Changing it
   reloads the page, so every library is rebuilt under the new rule from
   your data folder.
   ============================================================ */
const EDITION_KEY = "charsheet-2024";
const SOURCES_2024 = new Set(["XPHB", "XDMG", "XMM", "FRHOF", "FRAIF", "EFA"]);   // upper case
const EDITION_2024_FROM = "2024-09-17";   // the 2024 Player's Handbook
let USE_2024 = false;
try { USE_2024 = localStorage.getItem(EDITION_KEY) === "on"; } catch (e) { /* storage off: stay on 2014 */ }

function is2024(rec) {
  if (!rec) return false;
  return SOURCES_2024.has(String(rec.source || "").toUpperCase()) || rec.edition === "one";
}
function editionAllows(rec) { return USE_2024 || !is2024(rec); }
/* For two records sharing a name: the lower rank wins. */
function editionRank(rec) {
  const y = is2024(rec);
  if (USE_2024) return y ? 0 : rec && rec.source === "PHB" ? 1 : 2;
  return y ? 3 : rec && rec.source === "PHB" ? 0 : 1;
}
/* Adds `incoming` records to a list, one per name across editions: a 2024 record and a 2014 record
   with the same name are the same thing twice, and the rank decides which stays. Records from two
   books of the same edition are both kept (name|source), as they were before this existed. */
function editionMerge(list, incoming) {
  const bySource = new Set(list.map(r => r.name + "|" + r.source));
  const byName = new Map();
  list.forEach((r, i) => { const k = String(r.name).toLowerCase(); if (!byName.has(k)) byName.set(k, i); });
  (incoming || []).forEach(r => {
    if (!r || !r.name || !editionAllows(r) || bySource.has(r.name + "|" + r.source)) return;
    const k = String(r.name).toLowerCase(), at = byName.get(k);
    const other = at != null ? list[at] : null;
    if (other && is2024(other) !== is2024(r)) {
      if (editionRank(r) < editionRank(other)) { list[at] = r; bySource.add(r.name + "|" + r.source); }
      return;
    }
    list.push(r); bySource.add(r.name + "|" + r.source);
    if (at == null) byName.set(k, list.length - 1);
  });
  return list;
}
/* A cached list from before the switch changed keeps only what the current setting allows. */
function editionFilter(list) { return (list || []).filter(editionAllows); }

/* Learns the 2024-era books from the data's own publication dates. When those arrive after a library
   has already loaded (with 2024 content off), whatever came from a newly recognised book is taken back
   out, so the result doesn't depend on which file happened to load first. */
async function loadEditionSources() {
  if (typeof dataFetch !== "function") return;
  for (const file of ["data/books.json", "data/adventures.json"]) {
    try {
      const res = await dataFetch(file); if (!res || !res.ok) continue;
      const j = await res.json();
      [...(j.book || []), ...(j.adventure || [])].forEach(b => {
        const id = String((b && (b.source || b.id)) || "").toUpperCase();
        if (id && b.published && String(b.published) >= EDITION_2024_FROM && !SOURCES_2024.has(id)) SOURCES_2024.add(id);
      });
    } catch (e) { /* no such file in this data: the built-in list stands */ }
  }
  // Also clears anything a library cached before this build knew a book was 2024 content.
  editionPurge();
}
function editionPurge() {
  if (USE_2024) return;
  let changed = false;
  const keyed = lib => {
    if (!lib) return;
    Object.keys(lib).forEach(k => {
      const rec = lib[k];
      if (is2024(rec)) { delete lib[k]; changed = true; return; }
      if (rec && rec.subs) Object.keys(rec.subs).forEach(sk => { if (is2024(rec.subs[sk])) { delete rec.subs[sk]; changed = true; } });
    });
  };
  if (typeof CLASS_LIB !== "undefined") keyed(CLASS_LIB);
  if (typeof RACE_LIB !== "undefined") keyed(RACE_LIB);
  if (typeof FEAT_LIB !== "undefined") keyed(FEAT_LIB);
  if (typeof BACKGROUND_LIB !== "undefined") keyed(BACKGROUND_LIB);
  if (typeof OPTFEATURE_LIB !== "undefined") keyed(OPTFEATURE_LIB);
  if (typeof LANGUAGE_LIB !== "undefined") keyed(LANGUAGE_LIB);
  if (typeof SPELL_LIB !== "undefined" && SPELL_LIB.some(is2024)) { SPELL_LIB = editionFilter(SPELL_LIB); changed = true; if (typeof saveSpellLib === "function") saveSpellLib(); }
  if (typeof ITEM_LIB !== "undefined" && ITEM_LIB.some(is2024)) { ITEM_LIB = editionFilter(ITEM_LIB); changed = true; if (typeof saveItemLib === "function") saveItemLib(); }
  if (!changed) return;
  ["saveClassLib", "saveRaceLib", "saveFeatLib", "saveBackgroundLib", "saveOptFeatureLib", "saveLanguageLib"].forEach(f => { if (typeof window[f] === "function") window[f](); });
  ["renderClassLibrary", "renderSpellLibrary", "renderItemLibrary"].forEach(f => { if (typeof window[f] === "function") window[f](); });
  if (typeof recompute === "function") recompute();
}

function setUse2024(on) {
  try { localStorage.setItem(EDITION_KEY, on ? "on" : "off"); } catch (e) {}
  // Libraries cached under the other setting are dropped so they rebuild from your data; turning
  // 2024 on needs the 2024 records, which a 2014-only cache never kept.
  ["charsheet-classlib", "charsheet-racelib", "charsheet-featlib", "charsheet-bglib", "charsheet-languagelib",
    "charsheet-optfeaturelib", "charsheet-spelllib", "charsheet-itemlib"].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  if (typeof flushPendingSaves === "function") flushPendingSaves();
  location.reload();
}

document.addEventListener("DOMContentLoaded", () => {
  loadEditionSources();
  const box = document.getElementById("edition-2024"); if (!box) return;
  box.checked = USE_2024;
  box.addEventListener("change", () => setUse2024(box.checked));
});
