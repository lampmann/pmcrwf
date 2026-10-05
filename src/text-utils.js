/* ============================================================
   Plain-text extraction from 5e.tools' JSON "entries" format. Shared by the
   browser (spell/class/race/feat libraries) and by the Node-side effects
   conversion pipeline (tools/effects/extract-features.mjs), so both sides
   see byte-identical feature text. Kept dependency-free (no DOM, no other
   module globals) so it loads the same way in both environments.
   ============================================================ */
/* HTML escaping for everything that interpolates a name into markup. It lives here rather than in a
   feature module because half the sheet depends on it (the roster tab bar, the inventory list, the
   event log, the creator) — having it in spell-library.js made the spell library a load-order
   dependency of the character roster, which it has no business being.
   `&` first, or the entities produced by the later replacements get double-escaped. */
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
if (typeof module !== "undefined") module.exports = { flattenEntries, stripTags, escapeHtml };

// Sorting changes the display only; callers retain the original record indexes.
function createListSort(columns) {
  const state = { key: "name", descending: false };
  const value = (row, key) => { const c = columns.find(c => c.key === key); return c.get ? c.get(row) : row[key]; };
  return {
    rows(rows) { return [...rows].sort((a, b) => this.compare(a, b)); },
    compare(a, b) {
        const av = value(a, state.key), bv = value(b, state.key);
        const missing = v => v == null || v === "" || (typeof v === "number" && !Number.isFinite(v));
        if (missing(av) !== missing(bv)) return missing(av) ? 1 : -1;
        const c = columns.find(c => c.key === state.key);
        const cmp = missing(av) ? 0 : c.numeric ? Number(av) - Number(bv) : String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true });
        return (state.descending ? -cmp : cmp) || String(value(a, "name") || "").localeCompare(String(value(b, "name") || ""));
    },
    header(key, label, cell = true) {
      if (!key) return `<th scope="col">${escapeHtml(label)}</th>`;
      const active = state.key === key;
      const button = `<button type="button" class="list-sort" data-sort="${key}" aria-label="Sort by ${escapeHtml(label)}">${escapeHtml(label)}${active ? state.descending ? " ▼" : " ▲" : ""}</button>`;
      return cell ? `<th scope="col" aria-sort="${active ? state.descending ? "descending" : "ascending" : "none"}">${button}</th>` : button;
    },
    headers(cell = true) { return columns.map(c => this.header(c.key, c.label, cell)).join(cell ? "" : " "); },
    click(e, render) {
      const button = e.target.closest(".list-sort"); if (!button) return false;
      const c = columns.find(c => c.key === button.dataset.sort); if (!c) return false;
      state.descending = state.key === c.key ? !state.descending : !!c.numeric;
      state.key = c.key; render(); return true;
    },
  };
}
