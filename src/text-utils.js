/* ============================================================
   Plain-text extraction from 5e.tools' JSON "entries" format. Shared by the
   browser (spell/class/race/feat libraries) and by the Node-side effects
   conversion pipeline (tools/effects/extract-features.mjs), so both sides
   see byte-identical feature text. Kept dependency-free (no DOM, no other
   module globals) so it loads the same way in both environments.
   ============================================================ */
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
if (typeof module !== "undefined") module.exports = { flattenEntries, stripTags };
