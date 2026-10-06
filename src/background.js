/* ============================================================
   BACKGROUND MODULE

   The background named in the Character module, its feature from the
   background data (click the name for its text), and three groups of
   the character's own description: appearance, alignment, personality.
   Every field is an ordinary persisted input; this file only draws the
   heading, which holds no inputs, so recompute() can redraw it freely.
   ============================================================ */
let BGM_FEATURE_OPEN = false;
function renderBackgroundModule() {
  const el = $("bgm-head"); if (!el) return;
  const name = (($("char-bg") || {}).value || "").trim();
  if (!name) { el.innerHTML = `<div class="hint">No background.</div>`; return; }
  const rec = typeof BACKGROUND_LIB === "object"
    ? Object.values(BACKGROUND_LIB).find(b => b.name.toLowerCase() === name.toLowerCase()) : null;
  const f = rec && rec.feature;
  const spells = rec && BACKGROUND_GRANTS ? grantedSpellsHtml(flattenGrantedSpells(rec.grantedSpells || []).filter(g => g.minLevel <= totalLevel()), rec.name, "") : "";
  el.innerHTML = `<div class="bgm-name"><b>${escapeHtml(rec ? rec.name : name)}</b>${rec ? ` <span class="hint">${escapeHtml(rec.source)}</span>` : ""}</div>` +
    (f ? `<div class="bgm-feature"><a class="feat-link" id="bgm-feature-link">Feature: ${escapeHtml(f.name)}</a>` +
      (BGM_FEATURE_OPEN ? `<div class="feat-detail">${escapeHtml(normalizeDisplayPunctuation(f.text)).replace(/\n/g, "<br>")}</div>` : "") + `</div>` : "") + spells;
}
document.addEventListener("DOMContentLoaded", () => {
  const el = $("bgm-head"); if (!el) return;
  el.addEventListener("click", e => {
    const spell = e.target.closest(".gsp-link");
    if (spell) {
      e.preventDefault();
      const name = spell.dataset.name, lib = findLibSpellByName(name), level = lib ? lib.level : 0;
      if (spell.dataset.expanded === "1") openPrepClassModal(name, level, spell.dataset.header);
      else addCharacterSpell("", level, name, { grantSrc: spell.dataset.header });
      return;
    }
    if (!e.target.closest("#bgm-feature-link")) return;
    e.preventDefault(); BGM_FEATURE_OPEN = !BGM_FEATURE_OPEN; renderBackgroundModule();
  });
  renderBackgroundModule();
});
