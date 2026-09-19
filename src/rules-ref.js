/* ============================================================
   RULES REFERENCE — a small "ⓘ" button next to Conditions and
   Exhaustion that expands the official rules text (+ source/page)
   inline, the same click-to-expand pattern already used for spell/
   item/feature descriptions (see inv-link/sp-name-link/feat-link).

   Text comes from the user's own imported data/conditionsdiseases.json
   (5e.tools) — auto-fetched like the other libraries, never bundled;
   see DOCS.md's "Where game data comes from" for why. If data/ isn't
   present (or the page was opened via file://, which blocks fetch()),
   the buttons simply never appear rather than showing broken links —
   this is a nice-to-have layered on top of the Conditions/Exhaustion
   modules, not a dependency of theirs.

   Death Saves has no equivalent 5e.tools entry (it's core PHB prose,
   not a named condition/action/status), so it isn't covered here.
   ============================================================ */
let RULES_CONDITIONS = {}; // { "blinded": {source, page, text} }

async function loadRulesRef() {
  try {
    const res = await dataFetch("data/conditionsdiseases.json");
    if (!res.ok) return;
    const j = await res.json();
    (j.condition || []).forEach(c => {
      RULES_CONDITIONS[c.name.toLowerCase()] = { source: c.source, page: c.page, text: stripTags(flattenEntries(c.entries)) };
    });
    renderRulesRefButtons();
  } catch (e) { /* file:// or missing data/ — buttons just don't appear */ }
}
function rulesRefFor(name) { return RULES_CONDITIONS[(name || "").toLowerCase()] || null; }
function toggleRulesRefDetail(btn) {
  const next = btn.nextElementSibling;
  if (next && next.classList.contains("rules-ref-detail")) { next.remove(); return; }
  const ref = rulesRefFor(btn.dataset.rulesRef);
  const d = document.createElement("div"); d.className = "rules-ref-detail hint";
  d.innerHTML = ref
    ? `<div>${escapeHtml(ref.text).replace(/\n/g, "<br>")}</div><div>- ${escapeHtml(ref.source)}, p.${ref.page}</div>`
    : "no rules text loaded for this - see data/conditionsdiseases.json";
  btn.after(d);
}
function rulesRefBtnHtml(name) {
  return `<button type="button" class="rules-ref-btn" data-rules-ref="${name}" aria-label="show rules text">&#9432;</button>`;
}
// Adds a ⓘ button after each condition checkbox's label (derived from its own id, "cond-blinded"
// -> "blinded" — no extra markup needed) and shows/hides the one static Exhaustion button.
function renderRulesRefButtons() {
  document.querySelectorAll("#conditions-list label").forEach(label => {
    if (label.querySelector(".rules-ref-btn")) return; // already added
    const cb = label.querySelector('input[id^="cond-"]'); if (!cb) return;
    const name = cb.id.slice("cond-".length);
    if (!rulesRefFor(name)) return; // nothing loaded for this one
    label.insertAdjacentHTML("beforeend", rulesRefBtnHtml(name));
  });
  const exBtn = $("exhaustion-rules-ref");
  if (exBtn) exBtn.style.display = rulesRefFor("exhaustion") ? "" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  loadRulesRef();
  document.body.addEventListener("click", e => {
    const btn = e.target.closest(".rules-ref-btn"); if (btn) toggleRulesRefDetail(btn);
  });
});
