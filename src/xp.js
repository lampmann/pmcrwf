/* ============================================================
   XP AND LEVEL — two views of one number.

   PHB p15's Character Advancement table maps experience points to character
   level. The sheet shows both, and editing either one moves the other:

     - type a LEVEL   -> XP jumps to that level's threshold (its minimum)
     - type XP        -> the level becomes whatever that XP earns

   The level box is not a third place your level is stored. Your actual level
   is the sum of the Classes table, and always has been — everything derived
   (proficiency bonus, spell slots, max HP, hit dice) reads it from there.
   This box is a *request*: raising it opens the Level Up dialog so the new
   level lands in a specific class with hit points chosen, and lowering it
   asks first, because dropping a level silently would quietly rewrite the
   Classes table.

   Which is why levelling down doesn't try to be clever about which class
   loses the level. It takes it from the last class row that has one to give,
   after saying what it's about to do — a multiclass character undoing a
   level almost always means undoing the most recent one, and guessing
   otherwise would be worse than asking.
   ============================================================ */

/* PHB p15, Character Advancement: the XP at which each level begins. Index 0 is level 1.
   A short, fixed, prose-free table — the same footing as the multiclass slot table (see DOCS'
   "Where game data comes from"). */
const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

function levelForXp(xp) {
  let lvl = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) lvl = i + 1;
  return lvl;
}
function xpForLevel(lvl) { return XP_THRESHOLDS[Math.max(1, Math.min(20, lvl)) - 1]; }

/* "1,300 XP to level 6" — the thing every player actually wants off this table. Level 20 has no
   next level, and says so rather than showing a blank. */
function xpNextText() {
  const xp = num($("char-xp"));
  const lvl = totalLevel();
  if (lvl >= 20) return "level 20 — no further advancement";
  const need = xpForLevel(lvl + 1) - xp;
  if (need <= 0) return `enough XP for level ${lvl + 1} — set Level to ${lvl + 1} to take it`;
  return `${need.toLocaleString()} XP to level ${lvl + 1} (at ${xpForLevel(lvl + 1).toLocaleString()})`;
}

/* Repaint both readouts from the current state of the sheet. Called from recompute(), so it follows
   the Classes table however the level got there — level-up dialog, hand-edit, or character switch.
   The level box is skipped while it has focus, so it doesn't fight what's being typed into it. */
function renderXp() {
  const box = $("char-level"); if (!box) return;
  if (document.activeElement !== box) box.value = totalLevel();
  const next = $("xp-next"); if (next) next.textContent = xpNextText();
}

/* Take one level off the last class row that has one to spare. Returns the class name, or "" if
   nothing could be dropped (a single class already at level 1). */
function dropOneLevel() {
  const rows = [...document.querySelectorAll("#class-rows tr")];
  for (let i = rows.length - 1; i >= 0; i--) {
    const inp = rows[i].querySelector(".cls-lvl");
    const lvl = Number(inp.value) || 0;
    if (lvl <= 0) continue;
    const name = (rows[i].querySelector(".cls-name") || {}).value || "class";
    if (lvl === 1 && rows.length > 1) { rows[i].remove(); return name; }   // a multiclass dip, undone entirely
    if (lvl <= 1) continue;
    inp.value = String(lvl - 1); commitMathField(inp);
    return name;
  }
  return "";
}

/* The level box was edited. One step at a time in either direction, because each step up is a real
   decision (which class, what hit points) and each step down destroys one. */
function levelBoxChanged() {
  const box = $("char-level");
  const want = Math.max(1, Math.min(20, Number(box.value) || 1));
  const have = totalLevel();
  if (want === have) { renderXp(); return; }

  if (want > have) {
    // Going up: hand over to the Level Up dialog so the level lands somewhere specific. The XP floor
    // is set first, so a character advanced by level rather than by XP still has coherent XP.
    const floor = xpForLevel(have + 1);
    if (num($("char-xp")) < floor) { $("char-xp").value = String(floor); commitMath($("char-xp")); }
    box.value = have;                       // the dialog is what actually changes the level
    renderXp(); recompute();
    if (typeof openLevelUp === "function") openLevelUp();
    else alert("Level Up isn't available on this page.");
    return;
  }

  // Going down: confirm once, then take the levels off one at a time.
  const drop = have - want;
  if (!confirm(`Level down from ${have} to ${want}? That removes ${drop} level${drop === 1 ? "" : "s"} from the bottom of your Classes table, and sets XP to ${xpForLevel(want).toLocaleString()}.\n\nHit points, features and spell slots follow your classes, so they'll drop too. This can't be undone.`)) {
    box.value = have; renderXp(); return;
  }
  const dropped = [];
  for (let i = 0; i < drop; i++) { const n = dropOneLevel(); if (!n) break; dropped.push(n); }
  $("char-xp").value = String(xpForLevel(want)); commitMath($("char-xp"));
  // A Max HP override was written for a level that no longer exists, so it can't stay — the automatic
  // value is right again, and leaving a stale override would silently inflate the character.
  const ov = $("hp-max-override");
  if (ov && ov.value !== "") { ov.value = ""; }
  recompute();
  if (typeof renderClassFeatures === "function") renderClassFeatures();
  if (typeof renderHitDice === "function") renderHitDice();
  const cur = $("hp-cur");
  if (cur && num(cur) > maxHP()) { cur.value = String(maxHP()); commitMath(cur); }
  logEvent("info", `<b>Level down</b> &mdash; ${have} &rarr; ${totalLevel()}${dropped.length ? ` (${escapeHtml(dropped.join(", "))})` : ""} &middot; XP set to ${xpForLevel(want).toLocaleString()}`);
  renderXp(); saveState();
}

/* Typing XP moves the level readout, but never the Classes table on its own — crossing a threshold
   offers the level rather than taking it, since gaining a level is a decision (PHB p15). */
function xpBoxChanged() {
  const lvl = levelForXp(num($("char-xp")));
  renderXp();
  const box = $("char-level");
  if (box && lvl > totalLevel()) box.classList.add("xp-ready"); else if (box) box.classList.remove("xp-ready");
}

document.addEventListener("DOMContentLoaded", () => {
  const box = $("char-level"); if (!box) return;
  // `change`, not `input`: half-typed levels ("1" on the way to "12") would otherwise each fire a
  // confirm dialog or a level-up.
  box.addEventListener("change", levelBoxChanged);
  box.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); box.blur(); } });
  const xp = $("char-xp");
  if (xp) xp.addEventListener("input", xpBoxChanged);
});
