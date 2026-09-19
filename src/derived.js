/* ---------- Derived calculations ---------- */
function totalLevel() { return getClasses().reduce((s, c) => s + c.lvl, 0); }
function profBonus() {
  const ov = $("pb-override").value;
  const lvl = totalLevel();
  const base = ov !== "" ? Number(ov) : (lvl < 1 ? 2 : Math.ceil(lvl / 4) + 1);
  return base + effFlat("profbonus");   // override sets the base; effects still add on top
}
function spellMod() { const ab = $("spell-ability").value; return ab ? abilityMod(ab) : 0; }
function spellAttackBonus() { return profBonus() + spellMod() + parseBonus($("spell-atk-misc").value).flat + effFlat("spellatk"); }
function spellAttackDice() { return parseBonus($("spell-atk-misc").value).dice + effDice("spellatk"); }
// One source of truth for the save DC, so the Routines module can show it for save-based spells.
function spellSaveDC() { return 8 + profBonus() + spellMod() + num($("spell-dc-misc")) + effFlat("spelldc"); }

/* ---------- Max HP (assumes fixed/"consistent" HP per level, not rolled) ---------- */
const HIT_DIE_MAX = { d6: 6, d8: 8, d10: 10, d12: 12 };
const HIT_DIE_FIXED = { d6: 4, d8: 5, d10: 6, d12: 7 };
function maxHPAuto() {
  const classes = getClasses().filter(c => c.lvl > 0);
  const conMod = abilityMod("con");
  return classes.reduce((total, c, i) => {
    const hitDie = c.hitDie === "auto" ? classHitDie(c.name) : c.hitDie;
    const dieMax = HIT_DIE_MAX[hitDie] || 8, dieFixed = HIT_DIE_FIXED[hitDie] || 5;
    for (let l = 1; l <= c.lvl; l++) total += (i === 0 && l === 1 ? dieMax : dieFixed) + conMod;
    return total;
  }, 0);
}
function maxHP() {
  const ov = $("hp-max-override").value;
  const base = ov !== "" && !isNaN(Number(ov)) ? Number(ov) : maxHPAuto();
  const n = base + effFlat("hpmax");   // override sets the base; effects (e.g. Tough) still add on top
  return (typeof conditionMaxHp === "function") ? conditionMaxHp(n) : n;   // exhaustion 4 halves it
}

/* speed is a plain user-typed input (not auto-calculated like AC/initiative), but effects can still
   add to it — same "base + effects = total" pattern as an ability score (see abilityScore in data.js). */
/* Variant Encumbrance (DMG/PHB p176) subtracts from Speed once carried weight passes 5x/10x your
   Strength — see encumbranceState() in variant-rules.js. Clamped at 0: a heavily-encumbered creature
   with a 20 ft speed is stopped, not moving backwards. */
function speedTotal() {
  const enc = (typeof encumbranceState === "function") ? encumbranceState().speedPenalty : 0;
  const n = Math.max(0, num($("speed")) + effFlat("speed") - enc);
  // Grappled and Restrained stop you; exhaustion halves at 2 and stops you at 5 (PHB p291).
  return (typeof conditionSpeed === "function") ? conditionSpeed(n) : n;
}

/* ---------- Armor Class (auto-calculated from equipped armor, like initiative) ----------
   No armor equipped: 10 + DEX. Light armor: armor AC + full DEX. Medium: armor AC + DEX (max +2).
   Heavy: armor AC only. Equipping any shield adds a flat +2 (multiple shields don't stack — same
   "only one shield at a time" rule as the books). Ties among multiple equipped body-armor pieces
   are broken by table order (an edge case the sheet doesn't try to adjudicate); an override box
   covers anything this formula can't represent (Unarmored Defense, natural armor, etc.). */
function equippedArmorLibs() {
  return CHARACTER_ITEMS.filter(it => it.eq).map(it => findLibItemByName(it.name)).filter(Boolean);
}
function armorClassAuto() {
  const equipped = equippedArmorLibs();
  const armor = equipped.find(lib => lib.armor && lib.armorCat !== "shield");
  const hasShield = equipped.some(lib => lib.armorCat === "shield");
  const dex = abilityMod("dex");
  let base;
  if (!armor) base = 10 + dex;
  else if (armor.armorCat === "light") base = armor.ac + dex;
  else if (armor.armorCat === "medium") base = armor.ac + Math.min(dex, 2);
  else base = armor.ac; // heavy (or an armor entry with an unrecognized category — treat as flat)
  return base + (hasShield ? 2 : 0);
}

/* ---------- Spell slots (multiclass spellcaster table, driven by per-class Casting type) ---------- */
// index = total effective caster level (0-20); values = slots for spell levels 1-9
const MULTICLASS_SLOTS = [
  [0,0,0,0,0,0,0,0,0], [2,0,0,0,0,0,0,0,0], [3,0,0,0,0,0,0,0,0], [4,2,0,0,0,0,0,0,0],
  [4,3,0,0,0,0,0,0,0], [4,3,2,0,0,0,0,0,0], [4,3,3,0,0,0,0,0,0], [4,3,3,1,0,0,0,0,0],
  [4,3,3,2,0,0,0,0,0], [4,3,3,3,1,0,0,0,0], [4,3,3,3,2,0,0,0,0], [4,3,3,3,2,1,0,0,0],
  [4,3,3,3,2,1,0,0,0], [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,1,0],
  [4,3,3,3,2,1,1,1,0], [4,3,3,3,2,1,1,1,1], [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1],
  [4,3,3,3,3,2,2,1,1],
];
function casterLevel() {
  // Pact Magic (Warlock) slots aren't part of the multiclass table — "pact" classes don't contribute here.
  return getClasses().reduce((s, c) => {
    const casting = c.casting === "auto" ? classCasting(c.name, c.sub) : c.casting;
    if (casting === "full") return s + c.lvl;
    if (casting === "half") return s + Math.floor(c.lvl / 2);
    if (casting === "third") return s + Math.floor(c.lvl / 3);
    return s;
  }, 0);
}
function autoSlots() { return MULTICLASS_SLOTS[Math.max(0, Math.min(20, casterLevel()))]; }
function slotTotal(i) {
  const ov = $("slot-override-" + i).value;
  return ov !== "" && !isNaN(Number(ov)) ? Number(ov) : autoSlots()[i - 1];
}

/* Parse a "misc bonus" string into a flat numeric part + a dice-notation part.
   e.g. "10+d4" -> { flat: 10, dice: "+1d4" }  (Pass Without Trace + Guidance) */
function parseBonus(str) {
  let flat = 0, dice = "";
  const terms = (str || "").replace(/\s/g, "").match(/[+-]?[^+-]+/g) || [];
  for (let t of terms) {
    let s = "+";
    if (t[0] === "+") t = t.slice(1); else if (t[0] === "-") { s = "-"; t = t.slice(1); }
    if (!t) continue;
    if (/d/i.test(t)) { if (/^d/i.test(t)) t = "1" + t; dice += s + t; }   // dice term (bare "d4" -> "1d4")
    else { const n = Number(t); if (!isNaN(n)) flat += s === "-" ? -n : n; }
  }
  return { flat, dice };
}
/* ----- what the effects engine grants that has no box of its own -----
   Extra movement speeds (a flying or swimming speed rather than a bonus to walking), damage
   resistances/immunities/vulnerabilities, and advantage on saves against a named condition. Each is
   a target the engine writes and nothing else reads, so they are listed here rather than silently
   dropped into snap.unapplied — which is what used to happen to every one of them.

   Rendered as text because that's what they are: a resistance isn't a number that folds into a
   total, it's a fact about you that the DM asks about. */
/* A hand-entered defences box: comma-separated damage types. Kept deliberately free-text rather
   than a picker — "fire", "bludgeoning from nonmagical attacks" and "everything except psychic" are
   all things a table says, and only the first is in any list the sheet could offer. */
function manualDefences(fieldId) {
  const el = $(fieldId); if (!el) return [];
  return String(el.value || "").split(",").map(x => x.trim()).filter(Boolean);
}

function renderDefenses() {
  const el = $("defenses-row"); if (!el) return;
  if (typeof effFlatByPrefix !== "function") { el.textContent = ""; return; }
  const bits = [];
  // Numeric extra speeds ("fly 60 ft") and described ones ("fly equal to your walking speed" — a
  // value the engine can't compute, since a value expression deliberately can't read another target).
  const speeds = effFlatByPrefix("speed-").map(s => `<b>${escapeHtml(s.kind)}</b> ${s.n} ft`)
    .concat(effTagsByPrefix("speed-").map(t => `<b>${escapeHtml(t.kind)}</b> ${escapeHtml(t.items.map(i => i.label).join(", "))}`));
  if (speeds.length) bits.push(speeds.join(", "));
  /* Feature-granted AND hand-entered, in one list per category. Plenty of what a character is
     resistant to on a given evening comes from somewhere the sheet can't see — a spell someone else
     cast on you, a potion, a DM ruling, an item not itemised in Inventory — and a defences line that
     could only ever show what a *feature* granted was read-only for exactly the cases that change
     most. Duplicates collapse, so a resistance you both have and typed shows once. */
  [["resist-", "resistant to", "def-resist"], ["immune-", "immune to", "def-immune"],
   ["vuln-", "vulnerable to", "def-vuln"]].forEach(([pre, label, fieldId]) => {
    const fromFeatures = effTagsByPrefix(pre).map(r => r.kind || r.items.map(i => i.label).join("/"));
    const byHand = manualDefences(fieldId);
    const seen = new Set(), names = [];
    fromFeatures.concat(byHand).forEach(n => {
      const k = n.trim().toLowerCase(); if (!k || seen.has(k)) return;
      seen.add(k); names.push(n.trim());
    });
    if (!names.length) return;
    bits.push(`${label} <b>${escapeHtml(names.join(", "))}</b>`);
  });
  const condSaves = effTagsByPrefix("save-vs-");
  if (condSaves.length) {
    bits.push("advantage on saves vs " + condSaves.map(r => `<b>${escapeHtml(r.kind)}</b>`).join(", "));
  }
  /* Situational advantage and disadvantage — "on Stealth checks in rocky terrain", "on attack rolls
     in direct sunlight". Listed rather than applied on purpose: the trigger is terrain, light, or
     what a creature is doing, none of which the sheet can see. Applying them unconditionally would
     be wrong far more often than right, and this is the whole "degrade to manual, never guess" rule. */
  const sit = [];
  effTagsByPrefix("situational-").forEach(row => {
    row.items.forEach(i => sit.push(`<b>${escapeHtml(row.kind)}</b> ${escapeHtml(i.label)} <span class="hint">(${escapeHtml(i.source)})</span>`));
  });
  el.innerHTML = (bits.length ? bits.join(" &middot; ") : "") +
    (sit.length ? `<div class="hint" style="margin-top:.15rem">Situational: ${sit.join(" &middot; ")}</div>` : "");
}

function recompute() {
  invalidateEffects();   // rebuild the effects snapshot at most once for this whole pass (see effects.js)
  const pb = profBonus();
  $("total-level").textContent = totalLevel();
  $("pb").textContent = sign(pb);
  ABILITIES.forEach(a => { $("mod-" + a.key).textContent = sign(abilityMod(a.key)); });
  ABILITIES.forEach(a => {
    const key = "save-" + a.key, d = checkDice(key);
    $("savebonus-" + a.key).textContent = sign(checkBonus(key)) + (d ? " " + d : "");
  });
  document.querySelectorAll("#skill-rows tr").forEach(tr => {
    const key = "skill-" + tr.dataset.slug, d = checkDice(key);
    $("skillbonus-" + tr.dataset.slug).textContent = sign(checkBonus(key)) + (d ? " " + d : "");
  });
  $("passive-perc").textContent = 10 + checkBonus("skill-perception") + effFlat("passive-perception");
  renderDefenses();
  // Just the two movement numbers, not a re-render of the round tracker — see syncCombatMovement.
  if (typeof syncCombatMovement === "function") syncCombatMovement();
  // Likewise the character's own name in the initiative order, written in place.
  if (typeof syncPcOrderName === "function") syncPcOrderName();
  // What conditions and exhaustion have done to the numbers, and what they've left to you.
  if (typeof renderConditionEffects === "function") renderConditionEffects();
  { const d = checkDice("init"); $("init").textContent = sign(checkBonus("init")) + (d ? " " + d : ""); }
  { const d = checkDice("ac"); $("ac").textContent = String(checkBonus("ac")) + (d ? " " + d : ""); }
  const ab = $("spell-ability").value;
  if (ab) {
    $("spell-dc").textContent = spellSaveDC();
    const ad = spellAttackDice();
    $("spell-atk").textContent = sign(spellAttackBonus()) + (ad ? " " + ad : "");
  } else { $("spell-dc").textContent = "-"; $("spell-atk").textContent = "-"; }

  $("hp-max").textContent = String(maxHP());
  /* Current HP is deliberately NOT clamped here. recompute() runs on every keystroke, so a max that
     is momentarily low mid-edit — CON cleared to be retyped, a class level blanked, a class row
     deleted before being re-added — used to overwrite current HP with that temporary max, and
     finishing the edit did not bring it back. hp-cur carries data-max-from="hp-max" in the markup,
     so commitMath() clamps it on commit (blur/Enter), which is the point at which the max is a
     settled number rather than a half-typed one. */
  // renderHitDice() (src/rest.js) is deliberately NOT called from here — recompute() runs on every
  // keystroke anywhere on the page (see app.js's document-level "input" listener), and its own pool
  // markup contains editable inputs; rebuilding them on every unrelated keystroke would blow away
  // whatever a player is mid-typing into a pool's own spent-count box. Same reason renderClassFeatures()
  // isn't called from here either — rest.js re-renders itself explicitly after anything that actually
  // changes a pool (spend/correct/rest) or the Classes table.

  for (let i = 1; i <= 9; i++) $("slot-total-" + i).textContent = String(slotTotal(i));

  renderSpellList();
  recomputeInventory();
  // Attack rows fold in the effects snapshot's attack-hit/damage-bonus targets (attacks.js), so they
  // have to be repainted on the same pass that rebuilds it — an effect toggle fires no input event.
  if (typeof updateAttackRows === "function") updateAttackRows();
  if (typeof renderEffectsStrip === "function") renderEffectsStrip();
  if (typeof paintEffectAudit === "function") paintEffectAudit();
  if (typeof renderXp === "function") renderXp();
}

/* ---------- Inventory (coin purse + item list, all summed in gp) ---------- */
/* itemsTotalValue()/itemsTotalWeight() are defined in inventory.js, next to CHARACTER_ITEMS. */
function fmtGP(n) { return String(Math.round(n * 100) / 100); }
function coinTotalGP() { return Object.keys(COIN_GP).reduce((s, k) => s + num($("coin-" + k)) * COIN_GP[k], 0); }
/* NB: renderItemList() is deliberately NOT called from here. recompute() runs on every keystroke
   anywhere on the sheet, and the item list contains its own editable quantity box — rebuilding the
   list mid-edit tore that box out from under the cursor, which read as "you can't change the number
   of items". The list is re-rendered when its *composition* changes (add/remove/applyState) and the
   quantity box updates its own row's totals in place; see inventory.js. Same rule as the Hit Dice
   pools in rest.js and the character-creator's number boxes. */
function recomputeInventory() {
  $("items-value-total").textContent = fmtGP(itemsTotalValue());
  $("items-weight-total").textContent = fmtGP(itemsTotalWeight());
  $("coin-total-gp").textContent = fmtGP(coinTotalGP());
  $("wealth-total-gp").textContent = fmtGP(coinTotalGP() + itemsTotalValue());
}

function miscOf(key) {
  if (key === "init") return $("init-misc").value;
  if (key === "ac") return $("ac-misc").value;
  if (key.startsWith("save-")) return $("savemisc-" + key.slice(5)).value;
  if (key.startsWith("skill-")) return $("skillmisc-" + key.slice(6)).value;
  return "";
}
// A feature granting proficiency/expertise (Resilient, a subclass "expertise in two skills", etc.)
// combines with the user's own checkbox as a max over multipliers (0/1/2) — a grant and a checkbox
// never conflict, the higher one wins.
function saveProfMult(ab) { return Math.max($("saveprof-" + ab).checked ? 1 : 0, effectsSnapshot().profMult["save-" + ab] || 0); }
function skillProfMult(slug) {
  const own = $("skillexp-" + slug).checked ? 2 : $("skillprof-" + slug).checked ? 1 : 0;
  return Math.max(own, effectsSnapshot().profMult["skill-" + slug] || 0);
}
function baseOf(key) {   // the fixed part: ability mod + proficiency (no misc, no effects flat/dice)
  if (key === "init") return abilityMod("dex");
  if (key === "ac") {
    const ov = $("ac-override").value;
    return (ov !== "" && !isNaN(Number(ov))) ? Number(ov) : armorClassAuto();
  }
  // Proficiency Dice (DMG p263) replaces the flat bonus with a die, so the flat part drops to zero
  // here and checkDice() supplies the die instead.
  if (key.startsWith("save-")) { const a = key.slice(5); return abilityMod(a) + (profDiceOn() ? 0 : saveProfMult(a) * profBonus()); }
  if (key.startsWith("skill-")) {
    const slug = key.slice(6);
    const tr = [...document.querySelectorAll("#skill-rows tr")].find(t => t.dataset.slug === slug);
    return abilityMod(tr.dataset.ability) + (profDiceOn() ? 0 : profBonus() * skillProfMult(slug));
  }
  return 0;
}
function checkBonus(key) { return baseOf(key) + parseBonus(miscOf(key)).flat + effFlat(key); }   // static numeric bonus
// Dice from misc + effects + any active boon, e.g. "+1d4". Guidance/Resistance ride along here rather
// than being added at roll time so the derived display and the roll agree by construction — a skill
// showing "+5 +2d4" is stating exactly the expression its button will roll (see boons.js).
function profDiceOn() { return typeof proficiencyDie === "function" && !!proficiencyDie(); }
/* The proficiency die a check contributes under DMG p263, or "" — expertise rolls it twice rather
   than doubling a bonus, which is exactly what a multiplier of 2 produces here. */
function profDiceFor(key) {
  if (!profDiceOn()) return "";
  let mult = 0;
  if (key.startsWith("save-")) mult = saveProfMult(key.slice(5));
  else if (key.startsWith("skill-")) mult = skillProfMult(key.slice(6));
  return typeof proficiencyDiceTerm === "function" ? proficiencyDiceTerm(mult) : "";
}
function checkDice(key) {
  return parseBonus(miscOf(key)).dice + effDice(key) + profDiceFor(key) +
    (typeof boonDice === "function" ? boonDice(key) : "");
}
