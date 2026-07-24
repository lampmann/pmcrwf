/* ============================================================
   SPELLCASTING MODULE — the character's chosen spells, rendered like
   the Features panel: grouped by class, click a name to expand its
   description (with 5e.tools-style inline clickable dice/attack text),
   a checkbox to mark it prepared, and an "x" to remove it. Spells are
   added only from the Spell Library (name/level/class come from there
   and aren't hand-edited) via addCharacterSpell(). CHARACTER_SPELLS is
   persisted as part of the character (see persistence.js), same as
   FEAT_CHOICES/USES_STATE.
   ============================================================ */
let CHARACTER_SPELLS = []; // [{cls, lvl, name, prep}]

function ordinalLevel(lvl) {
  if (!lvl) return "Cantrip";
  const v = lvl % 100;
  const suf = (v >= 11 && v <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[lvl % 10] || "th");
  return lvl + suf;
}
function addCharacterSpell(cls, lvl, name) {
  CHARACTER_SPELLS.push({ cls: cls || "", lvl, name, prep: false });
  renderSpellList(); recompute(); scheduleSave();
}
function removeCharacterSpell(idx) {
  CHARACTER_SPELLS.splice(idx, 1);
  renderSpellList(); recompute(); scheduleSave();
}
function setCharacterSpellPrep(idx, prep) {
  const s = CHARACTER_SPELLS[idx]; if (!s) return;
  s.prep = prep;
  renderSpellList(); recompute(); scheduleSave();
}
function refreshSpellAddClassSelect() {
  const sel = $("spell-add-class"); if (!sel) return;
  const names = getClasses().map(c => c.name.trim()).filter(Boolean);
  const cur = sel.value;
  sel.innerHTML = `<option value="">—</option>` + names.map(n =>
    `<option value="${escapeHtml(n)}" ${n === cur ? "selected" : ""}>${escapeHtml(n)}</option>`).join("");
  if (!names.includes(cur)) sel.value = names[0] || "";
}
function renderSpellList() {
  const el = $("spell-feat-results"); if (!el) return;
  const classes = getClasses().filter(c => c.name.trim());
  const casters = classes.filter(c => classSpellAllowance(c));
  if (!casters.length) { el.innerHTML = "<div class='hint'>Add a spellcasting class in the Character module to track spells here.</div>"; return; }
  const assigned = new Set(casters.map(c => c.name.trim()));
  const html = casters.map(c => {
    const info = classSpellAllowance(c);
    const allRows = CHARACTER_SPELLS.map((s, i) => ({ ...s, i })).filter(s => s.cls === c.name.trim())
      .sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
    // Cantrips are tracked separately (their own known-cantrips table) and never count toward a
    // "known"/spellbook/prepared total — e.g. a Wizard's cantrips aren't written in their spellbook.
    const leveled = allRows.filter(s => s.lvl > 0), cantrips = allRows.filter(s => s.lvl === 0);
    const subNote = c.sub.trim() ? ` <span class="hint">/ ${escapeHtml(c.sub)}</span>` : "";
    const notes = [];
    const cantripMax = classCantripsKnown(c);
    if (cantripMax > 0) notes.push(`Cantrips ${cantrips.length}/${cantripMax}`);
    if (info.style === "known") notes.push(`Known ${leveled.length}/${info.max}`);
    else {
      const prepHave = leveled.filter(s => s.prep).length;
      notes.push(info.spellbookMax != null
        ? `Spellbook ${leveled.length}/${info.spellbookMax} &middot; Prepared ${prepHave}/${info.max}`
        : `Prepared ${prepHave}/${info.max}`);
    }
    const items = allRows.map(s => {
      // Cantrips are always "on" — 5e has no cantrip-preparation step — so only leveled spells get the checkbox.
      const prepBox = (info.style === "prepared" && s.lvl > 0)
        ? `<label class="hint" style="margin-left:.4rem"><input type="checkbox" class="sp2-prep" data-idx="${s.i}" ${s.prep ? "checked" : ""}> prepared</label>` : "";
      const lib = findLibSpellByName(s.name), src = lib ? lib.source : "";
      return `<div><a class="feat-link sp2-link" data-idx="${s.i}"><b>${ordinalLevel(s.lvl)}</b> ${escapeHtml(s.name)}</a> <span class="hint">${src}</span>${prepBox}
        <button class="rowbtn sp2-del" data-idx="${s.i}" title="remove">x</button></div>`;
    }).join("") || "<div class='hint'>&nbsp;&nbsp;no spells added yet</div>";
    return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(c.name)} ${c.lvl}</b>${subNote} <span class="hint">&mdash; ${notes.join(" &middot; ")}</span></div>${items}`;
  }).join("");
  const orphans = CHARACTER_SPELLS.map((s, i) => ({ ...s, i })).filter(s => !assigned.has(s.cls));
  const orphanHtml = orphans.length ? `<div style="margin:.5rem 0 .1rem"><b>Unassigned</b> <span class="hint">— class removed or not set</span></div>` +
    orphans.map(s => `<div><a class="feat-link sp2-link" data-idx="${s.i}"><b>${ordinalLevel(s.lvl)}</b> ${escapeHtml(s.name)}</a>
      <button class="rowbtn sp2-del" data-idx="${s.i}" title="remove">x</button></div>`).join("") : "";
  el.innerHTML = html + orphanHtml;
}
function findLibSpellByName(name) {
  const q = (name || "").trim().toLowerCase(); if (!q) return null;
  return SPELL_LIB.find(s => s.name.toLowerCase() === q) || null;
}
function toggleSpell2Detail(link) {
  const div = link.closest("div");
  if (div.nextElementSibling && div.nextElementSibling.classList.contains("feat-detail")) { div.nextElementSibling.remove(); return; }
  const s = CHARACTER_SPELLS[Number(link.dataset.idx)]; if (!s) return;
  const lib = findLibSpellByName(s.name);
  const d = document.createElement("div"); d.className = "feat-detail";
  if (!lib) {
    d.innerHTML = `<div class="hint">No spell named "${escapeHtml(s.name)}" found in the Spell Library — load/import it above to see its description.</div>`;
  } else {
    const comp = ["v", "s", "m"].filter(k => lib.comp && lib.comp[k]).map(k => k.toUpperCase()).join("") || "—";
    const meta = ["Level " + lib.level, lib.school, lib.cast ? ("Cast: " + lib.cast) : "", "Comp: " + comp,
      lib.conc ? "Concentration" : "", lib.ritual ? "Ritual" : "", lib.save ? (lib.save + " save") : "", lib.attack ? "spell attack" : ""].filter(Boolean).join(" · ");
    d.innerHTML = `<div class="hint">${meta}</div><div>${renderInlineSpellText(lib.rawText, lib.name)}</div>` +
      (lib.rawHigher ? `<div style="margin-top:3px"><b>At Higher Levels:</b> ${renderInlineSpellText(lib.rawHigher, lib.name)}</div>` : "");
  }
  div.after(d);
}

/* ----- inline click-to-roll rendering (5e.tools-style) -----
   Turns {@damage X}/{@dice X}/{@hit X} tags into click-to-roll links, and bare
   "(melee/ranged) spell attack" phrases into a link that rolls like the row's
   own "to hit" button used to (same spellAttackBonus(), routed through the
   D20SEL adv/dis machinery in dice.js — see the ".atk-roll" case in rollInfo()). */
const ATK_PHRASE_RE = /\b(melee or ranged spell attack|melee spell attack|ranged spell attack|spell attack)\b/gi;
function splitSpellTags(raw) {
  const nodes = [];
  const re = /\{@(damage|dice|hit)\s*([^}|]*)(?:\|[^}]*)?\}|\{@\w+ ([^}]+)\}|\{@\w+\}/gi;
  let last = 0, m;
  while ((m = re.exec(raw))) {
    if (m.index > last) nodes.push({ type: "text", value: raw.slice(last, m.index) });
    if (m[1] === "damage" || m[1] === "dice") nodes.push({ type: "dice", value: m[2].trim() });
    else if (m[1] === "hit") nodes.push({ type: "hit", value: m[2].trim() });
    else { const parts = (m[3] || "").split("|"); nodes.push({ type: "text", value: (parts.length > 1 && parts[parts.length - 1]) ? parts[parts.length - 1] : (parts[0] || "") }); }
    last = re.lastIndex;
  }
  if (last < raw.length) nodes.push({ type: "text", value: raw.slice(last) });
  return nodes;
}
function expandAtkPhrases(nodes) {
  const out = [];
  nodes.forEach(n => {
    if (n.type !== "text") { out.push(n); return; }
    let last = 0, m; const re = new RegExp(ATK_PHRASE_RE);
    while ((m = re.exec(n.value))) {
      if (m.index > last) out.push({ type: "text", value: n.value.slice(last, m.index) });
      out.push({ type: "atk", value: m[0] });
      last = re.lastIndex;
    }
    if (last < n.value.length) out.push({ type: "text", value: n.value.slice(last) });
  });
  return out;
}
function renderInlineSpellText(raw, spellName) {
  if (!raw) return "";
  const nodes = expandAtkPhrases(splitSpellTags(raw));
  return nodes.map(n => {
    if (n.type === "dice") return `<a class="dice-roll" data-dice="${escapeHtml(n.value)}" data-rolllabel="${escapeHtml(spellName)} damage">${escapeHtml(n.value)}</a>`;
    if (n.type === "hit") { const b = Number(n.value) || 0; return `<a class="dice-roll" data-dice="1d20${b >= 0 ? "+" + b : b}" data-rolllabel="${escapeHtml(spellName)} attack">${b >= 0 ? "+" + b : b} to hit</a>`; }
    if (n.type === "atk") return `<a class="atk-roll" data-rolllabel="${escapeHtml(spellName)} attack">${escapeHtml(n.value)}</a>`;
    return escapeHtml(n.value).replace(/\n/g, "<br>");
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const cr = $("class-rows");
  if (cr) new MutationObserver(() => { refreshSpellAddClassSelect(); renderSpellList(); }).observe(cr, { childList: true });
  document.addEventListener("input", e => {
    if (e.target.closest && e.target.closest("#class-rows")) { refreshSpellAddClassSelect(); renderSpellList(); }
  });
  const results = $("spell-feat-results");
  if (results) results.addEventListener("click", e => {
    const del = e.target.closest(".sp2-del"); if (del) { removeCharacterSpell(Number(del.dataset.idx)); return; }
    // Handled on click (not "change"): a checkbox's native "input" event fires before "change", and the
    // app's global input-listener triggers a full recompute()/re-render that replaces this very checkbox —
    // by the time "change" would bubble here it's already detached and the event never arrives. Click fires
    // first, and a checkbox's .checked has already flipped by the time a delegated click listener sees it
    // (that's the browser's own "activation behavior", not something we set), so it's safe to read here.
    const prepBox = e.target.closest(".sp2-prep"); if (prepBox) { setCharacterSpellPrep(Number(prepBox.dataset.idx), prepBox.checked); return; }
    const link = e.target.closest(".sp2-link"); if (link) { e.preventDefault(); toggleSpell2Detail(link); }
  });
  // inline flat (non-d20) dice rolls from an expanded spell description; .atk-roll goes through
  // the D20SEL delegated handler in app.js instead, so it gets adv/dis + right-click like "to hit" did.
  document.addEventListener("click", e => {
    const d = e.target.closest(".dice-roll");
    if (d) runRoll(`${d.dataset.dice} ${d.dataset.rolllabel || ""}`);
  });
});
