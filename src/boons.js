/* ============================================================
   BOONS — Guidance, Resistance and Death Ward, as counts rather than
   toggles, because at this table they stack.

   WHY COUNTS. Combining Magical Effects (PHB p205) says two castings of
   the same spell don't stack: the most recent applies and the earlier is
   *suppressed*. A spell's block of information lists its duration; the
   rest of the entry is its effect — so Guidance's "The spell then ends"
   is part of its EFFECT, not its duration, and a suppressed Guidance has
   its end condition suppressed along with everything else. Expend the
   active one and it ends; the suppressed one wakes up, "after making the
   ability check" is still true, and it can be expended on the same check.
   Hence N d4 on one roll. Same reasoning for Resistance and Death Ward.
   This is house rule R21/R22 — see house-rules/lampmann.md §4.9.

   WHAT EACH ONE TOUCHES:
   - Guidance   -> ability checks. That's every skill, and initiative,
                   which PHB p189 defines as a Dexterity check. Not
                   attacks, not saves.
   - Resistance -> saving throws only.
   - Death Ward -> not a die at all. It fires when you would drop to 0.

   A ROLL SPENDS EVERY ACTIVE DIE. Stacking three Guidances is something
   you do on purpose, immediately before the check you care about, so
   "spend them all" is the case worth optimizing and "spend one of three"
   is the rare one — reachable by editing the count down, rolling, and
   putting it back. Every spend is logged, and the counts are ordinary
   editable boxes (the same correct-it-directly rule as Hit Dice), so a
   spend you didn't mean is one keystroke to undo rather than a mode to
   learn beforehand.

   These are per-character state, persisted with the character: two
   characters can each be under their own Guidance.
   ============================================================ */

/* Which boon a d20 button draws on, or null for the many that draw on none (attack rolls, a
   companion's own rolls, AC). Keyed by the same data-roll-check strings dice.js dispatches on. */
function boonKindFor(key) {
  const k = key || "";
  // With stacking off there are no Guidance/Resistance counters, so nothing here draws on them —
  // closing it at this one gate means a count left behind from before the ruling flipped can't
  // quietly keep adding dice to rolls.
  if (!boonStackingOn()) return null;
  if (k === "init" || k.startsWith("skill-")) return "guidance";
  if (k.startsWith("save-")) return "resistance";
  return null;
}

const BOON_DEFS = [
  { key: "guidance", label: "Guidance", die: "d4", applies: "ability checks and initiative",
    hint: "+1d4 per casting on an ability check (initiative is a Dex check, PHB p189)" },
  { key: "resistance", label: "Resistance", die: "d4", applies: "saving throws",
    hint: "+1d4 per casting on a saving throw" },
  { key: "deathward", label: "Death Ward", die: "", applies: "",
    hint: "dropping to 0 HP leaves you at 1 instead; fires automatically and is logged" },
];

let BOONS = blankBoons();
function blankBoons() { return { guidance: 0, resistance: 0, deathward: 0, heroPoints: 0, castings: {}, custom: [] }; }

/* Whether this table reads Combining Magical Effects the way the header argues (house rule R21/R22,
   settable under House Rules). Guidance and Resistance are counters ONLY because they stack: take
   that away and "how many are running" collapses to a yes/no, so the counters come off the sheet
   rather than sitting there able to count to three in a game where three is meaningless. Death Ward
   is not covered — it was never a die stacked onto a roll, it's how many times you get pulled back
   from 0 HP, which is worth counting under either reading. */
function boonStackingOn() {
  return (typeof hrSetting === "function") ? hrSetting("boonStacking") !== false : true;
}
/* The boons actually on the sheet right now. */
function activeBoonDefs() {
  return BOON_DEFS.filter(d => d.key === "deathward" || boonStackingOn());
}
/* A character saved before boons existed has no `boons` key at all; layering over the blank keeps a
   missing field at 0 rather than undefined, which would poison the arithmetic in boonDice(). */
function normalizeBoons(saved) {
  const blank = blankBoons();
  if (!saved || typeof saved !== "object") return blank;
  const out = { ...blank, castings: {} };
  ["guidance", "resistance", "deathward", "heroPoints"].forEach(k => { const n = Math.floor(Number(saved[k])); if (n > 0) out[k] = n; });
  out.custom = (Array.isArray(saved.custom) ? saved.custom : [])
    .filter(c => c && typeof c === "object" && typeof c.name === "string" && c.name.trim())
    .map(c => ({ id: String(c.id || newCounterId()), name: c.name.trim().slice(0, 40),
                 n: Math.max(0, Math.min(999, Math.floor(Number(c.n)) || 0)),
                 max: (c.max === "" || c.max == null) ? null : Math.max(0, Math.floor(Number(c.max)) || 0) }));
  if (saved.castings && typeof saved.castings === "object") {
    Object.entries(saved.castings).forEach(([name, n]) => { const v = Math.floor(Number(n)); if (v > 0) out.castings[name] = v; });
  }
  return out;
}
/* ----- concurrent castings (H4) -----
   How many of a capped spell you currently have running. Which spells are capped, and at what, is a
   property of the ruleset rather than of you (see spellLimits in house-rules.js); the counts are
   yours. Going over is shown, not prevented — the DM is at the table, and a limit the sheet enforced
   would be wrong the moment they said "this one's fine". */
function castingCount(name) { return Math.max(0, Math.floor(Number((BOONS.castings || {})[name])) || 0); }
function setCastingCount(name, n) {
  if (!BOONS.castings) BOONS.castings = {};
  const v = Math.max(0, Math.min(99, Math.floor(Number(n)) || 0));
  if (v) BOONS.castings[name] = v; else delete BOONS.castings[name];
  renderBoons();
  if (typeof scheduleSave === "function") scheduleSave();
}
function castingOverLimit(name) {
  const lim = (typeof spellLimitFor === "function") ? spellLimitFor(name) : null;
  return lim != null && castingCount(name) > lim;
}
function boonCount(kind) { return Math.max(0, Math.floor(Number(BOONS[kind]) || 0)); }
function setBoonCount(kind, n) {
  if (!(kind in BOONS)) return;
  BOONS[kind] = Math.max(0, Math.min(99, Math.floor(Number(n)) || 0));
  if (typeof recompute === "function") recompute();   // the dice show in every affected derived total
  renderBoons();
  if (typeof scheduleSave === "function") scheduleSave();
}

/* The dice this button gets from boons, already signed so it concatenates onto a roll expression the
   same way the Misc field's and a feature effect's dice do (see checkDice in derived.js). */
function newCounterId() { return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ----- custom counters -----
   Anything a table needs to count that the sheet doesn't model: Sorcery Points on a homebrew
   subclass, charges on a DM-invented item, "arrows left", "favours owed to the archfey". Per
   character, like every other counter in this row. An optional max shows as /N and goes red over
   it — shown, never enforced, same as the concurrent-casting limits beside it. */
function customCounters() { return Array.isArray(BOONS.custom) ? BOONS.custom : (BOONS.custom = []); }
function addCustomCounter(name, max) {
  name = String(name || "").trim(); if (!name) return null;
  const c = { id: newCounterId(), name: name.slice(0, 40), n: 0,
              max: (max === "" || max == null) ? null : Math.max(0, Math.floor(Number(max)) || 0) };
  customCounters().push(c);
  renderBoons(); if (typeof scheduleSave === "function") scheduleSave();
  return c.id;
}
function removeCustomCounter(id) {
  const list = customCounters(), i = list.findIndex(c => c.id === id);
  if (i < 0) return;
  list.splice(i, 1);
  renderBoons(); if (typeof scheduleSave === "function") scheduleSave();
}
function setCustomCounter(id, n) {
  const c = customCounters().find(x => x.id === id); if (!c) return;
  c.n = Math.max(0, Math.min(999, Math.floor(Number(n)) || 0));
  renderBoons(); if (typeof scheduleSave === "function") scheduleSave();
}

function boonDice(key) {
  const kind = boonKindFor(key); if (!kind) return "";
  const n = boonCount(kind);
  return n > 0 ? `+${n}d4` : "";
}

/* Called by dice.js once a check has actually been rolled — not from rollInfo(), which also runs for
   the hover tooltip and the right-click menu and must not spend anything. */
function spendBoonsFor(key) {
  const kind = boonKindFor(key); if (!kind) return;
  const n = boonCount(kind); if (!n) return;
  const def = BOON_DEFS.find(d => d.key === kind);
  BOONS[kind] = 0;
  if (typeof recompute === "function") recompute();
  renderBoons();
  if (typeof scheduleSave === "function") scheduleSave();
  if (typeof log === "function") {
    log(`<span class="hint">${escapeHtml(def.label)} spent &mdash; ${n}d4 added to that roll` +
      `${n > 1 ? ` (${n} castings, stacked)` : ""}. None left.</span>`);
  }
}

/* ----- Death Ward -----
   Fires on the transition to 0, not on being at 0, so sitting at 0 doesn't burn a second ward and
   re-entering the sheet doesn't fire one at all. `_hpBefore` is re-synced by renderBoons() rather
   than tracked on every keystroke, which is also why renderBoons() must never be called from
   recompute() — that runs on every keystroke and would make the "before" value always equal the
   "after" one, so no drop would ever be visible. */
let _hpBefore = null;
function syncHpWatch() {
  const el = document.getElementById("hp-cur");
  _hpBefore = el ? (el.value === "" ? 0 : Number(el.value) || 0) : null;
}
function currentHpValue() {
  const el = document.getElementById("hp-cur");
  if (!el) return null;
  return el.value === "" ? 0 : Number(el.value) || 0;
}
function triggerDeathWard() {
  if (boonCount("deathward") <= 0) return false;
  const el = document.getElementById("hp-cur"); if (!el) return false;
  BOONS.deathward = boonCount("deathward") - 1;
  el.value = "1";
  if (typeof commitMath === "function") commitMath(el);
  if (typeof recompute === "function") recompute();
  renderBoons();
  if (typeof scheduleSave === "function") scheduleSave();
  const left = boonCount("deathward");
  if (typeof log === "function") {
    log(`<b>Death Ward</b> &mdash; you drop to <b>1 HP</b> instead of 0.` +
      ` <span class="hint">${left ? `${left} still active.` : "That was the last one."}</span>`);
  }
  return true;
}
/* Watches for a drop to 0 and spends a ward if one is up. Returns whether it fired, for the tests. */
function checkDeathWardTrigger() {
  const now = currentHpValue();
  const before = _hpBefore;
  _hpBefore = now;
  if (before === null || now === null) return false;
  if (now > 0 || before <= 0) return false;      // not a fresh drop to 0
  if (boonCount("deathward") <= 0) return false;
  return triggerDeathWard();
}

/* Guidance and Resistance last a minute, so no rest of any length leaves them running. Death Ward
   runs 8 hours — exactly a long rest — so a short rest leaves it alone and a long one ends it. */
function clearBoonsForRest(kind) {
  const had = boonCount("guidance") + boonCount("resistance") + (kind === "long" ? boonCount("deathward") : 0);
  BOONS.guidance = 0; BOONS.resistance = 0;
  if (kind === "long") BOONS.deathward = 0;
  if (had) { renderBoons(); if (typeof recompute === "function") recompute(); }
  return had;
}

/* ----- rendering ----- */
function boonRowHtml(def) {
  const n = boonCount(def.key);
  return `<span class="boon" title="${escapeHtml(def.hint)}">
    <button type="button" class="boon-step" data-boon="${def.key}" data-delta="-1" title="one fewer">&minus;</button>
    <input type="text" inputmode="numeric" class="tiny boon-count${n ? " boon-on" : ""}" data-boon="${def.key}" value="${n}">
    <button type="button" class="boon-step" data-boon="${def.key}" data-delta="1" title="one more">+</button>
    <span class="boon-label${n ? " boon-on" : ""}">${escapeHtml(def.label)}${n && def.die ? ` <b>+${n}${def.die}</b>` : ""}</span>
  </span>`;
}
/* One counter per capped spell, appearing only when the ruleset caps something — a table with no
   limits sees nothing here at all. */
function castingRowHtml(name, limit) {
  const n = castingCount(name), over = n > limit;
  return `<span class="boon" title="${escapeHtml(name)} — this campaign allows ${limit} active at a time">
    <button type="button" class="boon-step" data-casting="${escapeHtml(name).replace(/"/g, "&quot;")}" data-delta="-1" title="one fewer">&minus;</button>
    <input type="text" inputmode="numeric" class="tiny boon-count${n ? " boon-on" : ""}${over ? " boon-over" : ""}" data-casting="${escapeHtml(name).replace(/"/g, "&quot;")}" value="${n}">
    <button type="button" class="boon-step" data-casting="${escapeHtml(name).replace(/"/g, "&quot;")}" data-delta="1" title="one more">+</button>
    <span class="boon-label${n ? " boon-on" : ""}${over ? " boon-over" : ""}">${escapeHtml(name)} <span class="hint">/${limit}</span>${over ? " <b>over</b>" : ""}</span>
  </span>`;
}
/* Hero Points (DMG p264), only while that optional rule is switched on. A point is spent AFTER the
   d20 lands but before the result applies, so there is no die to fold into a roll in advance — this
   is a counter and nothing more, showing the level-scaled maximum beside it. */
function heroPointHtml() {
  const max = (typeof heroPointMax === "function") ? heroPointMax() : null;
  if (max == null) return "";
  const n = boonCount("heroPoints"), over = n > max;
  return `<span class="boon" title="DMG p264 — spend one after a d20 lands to add 1d6; you get 5 + half your level each time you gain one">
    <button type="button" class="boon-step" data-boon="heroPoints" data-delta="-1" title="spend one">&minus;</button>
    <input type="text" inputmode="numeric" class="tiny boon-count${n ? " boon-on" : ""}${over ? " boon-over" : ""}" data-boon="heroPoints" value="${n}">
    <button type="button" class="boon-step" data-boon="heroPoints" data-delta="1" title="one more">+</button>
    <span class="boon-label${n ? " boon-on" : ""}${over ? " boon-over" : ""}">Hero Points <span class="hint">/${max}</span>${over ? " <b>over</b>" : ""}</span>
  </span>`;
}
/* Variant Encumbrance status, when that rule is on and you're actually carrying enough to matter. */
function encumbranceHtml() {
  const enc = (typeof encumbranceState === "function") ? encumbranceState() : null;
  if (!enc || !enc.level) return "";
  return `<span class="boon boon-over" title="${escapeHtml(enc.note)}"><b>${escapeHtml(enc.level)}</b>
    <span class="hint">${enc.carried} lb vs Str ${enc.str} &mdash; speed &minus;${enc.speedPenalty} ft</span></span>`;
}
/* A counter the player invented. `max` is optional and advisory — over it goes red, nothing stops. */
function customRowHtml(c) {
  const over = c.max != null && c.n > c.max;
  return `<span class="boon" title="a counter you added — the &times; removes it">
    <button type="button" class="boon-step" data-custom="${c.id}" data-delta="-1" title="one fewer">&minus;</button>
    <input type="text" inputmode="numeric" class="tiny boon-count${c.n ? " boon-on" : ""}${over ? " boon-over" : ""}" data-custom="${c.id}" value="${c.n}">
    <button type="button" class="boon-step" data-custom="${c.id}" data-delta="1" title="one more">+</button>
    <span class="boon-label${c.n ? " boon-on" : ""}${over ? " boon-over" : ""}">${escapeHtml(c.name)}${c.max != null ? ` <span class="hint">/${c.max}</span>` : ""}${over ? " <b>over</b>" : ""}</span>
    <button type="button" class="boon-del" data-customdel="${c.id}" title="remove this counter">&times;</button>
  </span>`;
}
function customAddHtml() {
  return `<span class="boon boon-add">
    <input type="text" id="boon-add-name" class="boon-add-name" placeholder="counter name">
    <input type="text" inputmode="numeric" id="boon-add-max" class="tiny" placeholder="max" title="optional maximum — shown, never enforced">
    <button type="button" id="boon-add-btn" title="add a counter of your own">+ Counter</button>
  </span>`;
}
function renderBoons() {
  const el = document.getElementById("boons-row"); if (!el) return;
  const limits = (typeof spellLimits === "function") ? spellLimits() : {};
  el.innerHTML = activeBoonDefs().map(boonRowHtml).join("") + heroPointHtml() +
    Object.keys(limits).sort().map(name => castingRowHtml(name, spellLimitFor(name))).join("") +
    customCounters().map(customRowHtml).join("") +
    encumbranceHtml() + customAddHtml();
  syncHpWatch();
}

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("boons-row"); if (!el) return;
  renderBoons();

  el.addEventListener("click", e => {
    const del = e.target.closest("[data-customdel]");
    if (del) { removeCustomCounter(del.dataset.customdel); return; }
    if (e.target.id === "boon-add-btn") {
      const nameEl = document.getElementById("boon-add-name"), maxEl = document.getElementById("boon-add-max");
      if (nameEl && nameEl.value.trim()) {
        addCustomCounter(nameEl.value, maxEl ? maxEl.value : "");
        // renderBoons() just rebuilt these boxes, so re-find and focus for the next one.
        const fresh = document.getElementById("boon-add-name"); if (fresh) fresh.focus();
      }
      return;
    }
    const step = e.target.closest(".boon-step"); if (!step) return;
    if (step.dataset.custom) { const c = customCounters().find(x => x.id === step.dataset.custom);
      if (c) setCustomCounter(c.id, c.n + Number(step.dataset.delta)); return; }
    if (step.dataset.casting) { setCastingCount(step.dataset.casting, castingCount(step.dataset.casting) + Number(step.dataset.delta)); return; }
    setBoonCount(step.dataset.boon, boonCount(step.dataset.boon) + Number(step.dataset.delta));
  });
  // Commits on change (blur/Enter), never on input — the same rule as Hit Dice's remaining box and
  // the movement box: re-rendering mid-keystroke would take the caret with it.
  el.addEventListener("change", e => {
    const box = e.target.closest(".boon-count"); if (!box) return;
    if (box.dataset.custom) { setCustomCounter(box.dataset.custom, box.value); return; }
    if (box.dataset.casting) { setCastingCount(box.dataset.casting, box.value); return; }
    setBoonCount(box.dataset.boon, box.value);
  });

  /* Deferred so math-fields' own commit has clamped and normalized the box first — read too early
     and the value is still whatever was typed ("12-20"), not the number it resolves to. */
  const hp = document.getElementById("hp-cur");
  if (hp) hp.addEventListener("change", () => setTimeout(checkDeathWardTrigger, 0));
});
