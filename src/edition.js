/* ============================================================
   2014 / 2024 CONTENT

   5e.tools ships the 2024 books (XPHB, XDMG, XMM) next to the 2014 ones,
   often with the same names: two Fireballs, two Fighters, two Elves. The
   sheet keeps one record per name, and this switch (top bar, per browser)
   decides which:

     off (default)  records from the 2024 books are left out entirely
     on             a 2024 record replaces its 2014 namesake; records only
                    one edition has are kept either way

   Libraries keyed by name (classes, races, feats, backgrounds, languages,
   optional features) resolve this through preferRulesRecord as they load;
   the spell, item and monster lists through editionMerge. Changing it
   reloads the page, so every library is rebuilt under the new rule from
   your data folder.
   ============================================================ */
const EDITION_KEY = "charsheet-2024";
const SOURCES_2024 = new Set(["XPHB", "XDMG", "XMM"]);
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
  const box = document.getElementById("edition-2024"); if (!box) return;
  box.checked = USE_2024;
  box.addEventListener("change", () => setUse2024(box.checked));
});
