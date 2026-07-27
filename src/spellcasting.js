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
let CONCENTRATING = null; // { name, cls } of the one spell currently being concentrated on, or null

/* ----- concentration: 5e only allows one concentration spell at a time, so starting a new one
   always drops whatever came before. Identified by name+cls rather than a CHARACTER_SPELLS array
   index, since indices shift whenever an earlier spell is removed — this stays valid across
   reloads/edits regardless of array position. */
function isConcentratingOn(s) { return !!CONCENTRATING && CONCENTRATING.name === s.name && CONCENTRATING.cls === (s.cls || ""); }
function startConcentrating(name, cls) { CONCENTRATING = { name, cls: cls || "" }; scheduleSave(); renderSpellList(); }
function dropConcentration() { CONCENTRATING = null; scheduleSave(); renderSpellList(); }
function concentrationBannerHtml() {
  if (!CONCENTRATING) return "";
  const clsNote = CONCENTRATING.cls ? ` <span class="hint">(${escapeHtml(CONCENTRATING.cls)})</span>` : "";
  return `<div class="conc-banner">🔒 Concentrating: <b>${escapeHtml(CONCENTRATING.name)}</b>${clsNote} <button type="button" class="rowbtn sp2-conc-drop" title="drop concentration">drop</button></div>`;
}

function ordinalLevel(lvl) {
  if (!lvl) return "Cantrip";
  const v = lvl % 100;
  const suf = (v >= 11 && v <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[lvl % 10] || "th");
  return lvl + suf;
}
function addCharacterSpell(cls, lvl, name, opts = {}) {
  CHARACTER_SPELLS.push({ cls: cls || "", lvl, name, prep: false, grantSrc: opts.grantSrc || "", note: opts.note || "" });
  renderSpellList(); recompute(); scheduleSave();
}
/* ----- "prepare from which class?" modal -----
   Used for spell-list-expansion grants (Dragonmarks, Eldritch Knight, Divine Soul, Warlock
   patrons, Wizard subschools — the ".gsp-expanded" links built in class-library.js's
   grantedSpellsHtml()). Unlike a domain/innate grant (free, its own header, never prepared),
   these spells are only *eligible* to be learned/prepared — they still cost a normal known/
   prepared slot on a real class, so the user has to say which one. The chosen spell is tagged
   with a `note` (the granting trait's name) purely for display, so its origin isn't lost once
   it's sitting in that class's ordinary spell list. */
let _prepModalCtx = null;
function openPrepClassModal(name, lvl, header) {
  const classes = getClasses().map(c => c.name.trim()).filter(Boolean);
  if (!classes.length) { alert("Add a class in the Character module first — this spell needs to be prepared under one."); return; }
  _prepModalCtx = { name, lvl, header };
  $("prep-modal-spell").textContent = name;
  $("prep-modal-hint").textContent = `Added to your spell list by ${header} — still needs to be prepared/known normally.`;
  $("prep-modal-select").innerHTML = classes.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  $("prep-class-modal").style.display = "flex";
}
function closePrepClassModal() { $("prep-class-modal").style.display = "none"; _prepModalCtx = null; }
function confirmPrepClassModal() {
  if (!_prepModalCtx) return;
  const cls = $("prep-modal-select").value;
  addCharacterSpell(cls, _prepModalCtx.lvl, _prepModalCtx.name, { note: _prepModalCtx.header });
  closePrepClassModal();
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
function spellLineHtml(s, prepBox) {
  const lib = findLibSpellByName(s.name), src = lib ? lib.source : "";
  const note = s.note ? ` <span class="hint">(${escapeHtml(s.note)})</span>` : "";
  const concBtn = (lib && lib.conc)
    ? (isConcentratingOn(s)
        ? ` <button type="button" class="rowbtn sp2-conc on" data-idx="${s.i}" title="concentrating — click to drop">◉ conc</button>`
        : ` <button type="button" class="rowbtn sp2-conc" data-idx="${s.i}" title="click to start concentrating (drops any other spell you're concentrating on)">○ conc</button>`)
    : "";
  return `<div><a class="feat-link sp2-link" data-idx="${s.i}"><b>${ordinalLevel(s.lvl)}</b> ${escapeHtml(s.name)}</a>${note} <span class="hint">${src}</span>${concBtn}${prepBox || ""}
    <button class="rowbtn sp2-del" data-idx="${s.i}" title="remove">x</button></div>`;
}
function renderSpellList() {
  const el = $("spell-feat-results"); if (!el) return;
  const classes = getClasses().filter(c => c.name.trim());
  const casters = classes.filter(c => classSpellAllowance(c));
  const assigned = new Set(casters.map(c => c.name.trim()));
  const casterHtml = casters.map(c => {
    const info = classSpellAllowance(c);
    // Granted spells (domain/racial, tagged with grantSrc) get their own header/group below and never
    // count toward a class's normal Known/Prepared/Spellbook totals — see grantSrc handling further down.
    const allRows = CHARACTER_SPELLS.map((s, i) => ({ ...s, i })).filter(s => !s.grantSrc && s.cls === c.name.trim())
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
      return spellLineHtml(s, prepBox);
    }).join("") || "<div class='hint'>&nbsp;&nbsp;no spells added yet</div>";
    return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(c.name)} ${c.lvl}</b>${subNote} <span class="hint">&mdash; ${notes.join(" &middot; ")}</span></div>${items}`;
  }).join("");
  // Granted spells (Cleric domain, Mark of X, etc. — see class-library.js's .gsp-link) are grouped by
  // their own source name instead of by class, and are always-available so they never show a "prepared"
  // checkbox or count against any class's Known/Prepared total.
  const grantedGroups = [...new Set(CHARACTER_SPELLS.filter(s => s.grantSrc).map(s => s.grantSrc))];
  const grantedHtml = grantedGroups.map(src => {
    const rows = CHARACTER_SPELLS.map((s, i) => ({ ...s, i })).filter(s => s.grantSrc === src)
      .sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
    const items = rows.map(s => spellLineHtml(s)).join("");
    return `<div style="margin:.5rem 0 .1rem"><b>${escapeHtml(src)}</b> <span class="hint">&mdash; granted spells</span></div>${items}`;
  }).join("");
  const orphans = CHARACTER_SPELLS.map((s, i) => ({ ...s, i })).filter(s => !s.grantSrc && !assigned.has(s.cls));
  const orphanHtml = orphans.length ? `<div style="margin:.5rem 0 .1rem"><b>Unassigned</b> <span class="hint">— class removed or not set</span></div>` +
    orphans.map(s => spellLineHtml(s)).join("") : "";
  if (!casterHtml && !grantedHtml && !orphanHtml) {
    el.innerHTML = concentrationBannerHtml() || "<div class='hint'>Add a spellcasting class in the Character module to track spells here.</div>";
    return;
  }
  el.innerHTML = concentrationBannerHtml() + casterHtml + grantedHtml + orphanHtml;
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
    const dropBtn = e.target.closest(".sp2-conc-drop"); if (dropBtn) { dropConcentration(); return; }
    const conc = e.target.closest(".sp2-conc");
    if (conc) {
      const s = CHARACTER_SPELLS[Number(conc.dataset.idx)]; if (!s) return;
      if (isConcentratingOn(s)) dropConcentration(); else startConcentrating(s.name, s.cls || "");
      return;
    }
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
  // "prepare from which class?" modal (spell-list-expansion grants)
  $("prep-modal-confirm").addEventListener("click", confirmPrepClassModal);
  $("prep-modal-cancel").addEventListener("click", closePrepClassModal);
  $("prep-class-modal").addEventListener("click", e => { if (e.target.id === "prep-class-modal") closePrepClassModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("prep-class-modal").style.display !== "none") closePrepClassModal(); });
});
