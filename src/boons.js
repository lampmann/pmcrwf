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
function blankBoons() { return { guidance: 0, resistance: 0, deathward: 0 }; }
/* A character saved before boons existed has no `boons` key at all; layering over the blank keeps a
   missing field at 0 rather than undefined, which would poison the arithmetic in boonDice(). */
function normalizeBoons(saved) {
  const blank = blankBoons();
  if (!saved || typeof saved !== "object") return blank;
  const out = { ...blank };
  Object.keys(blank).forEach(k => { const n = Math.floor(Number(saved[k])); if (n > 0) out[k] = n; });
  return out;
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
function renderBoons() {
  const el = document.getElementById("boons-row"); if (!el) return;
  el.innerHTML = BOON_DEFS.map(boonRowHtml).join("");
  syncHpWatch();
}

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("boons-row"); if (!el) return;
  renderBoons();

  el.addEventListener("click", e => {
    const step = e.target.closest(".boon-step"); if (!step) return;
    setBoonCount(step.dataset.boon, boonCount(step.dataset.boon) + Number(step.dataset.delta));
  });
  // Commits on change (blur/Enter), never on input — the same rule as Hit Dice's remaining box and
  // the movement box: re-rendering mid-keystroke would take the caret with it.
  el.addEventListener("change", e => {
    const box = e.target.closest(".boon-count"); if (!box) return;
    setBoonCount(box.dataset.boon, box.value);
  });

  /* Deferred so math-fields' own commit has clamped and normalized the box first — read too early
     and the value is still whatever was typed ("12-20"), not the number it resolves to. */
  const hp = document.getElementById("hp-cur");
  if (hp) hp.addEventListener("change", () => setTimeout(checkDeathWardTrigger, 0));
});
