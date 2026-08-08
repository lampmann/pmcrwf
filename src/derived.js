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
  return base + effFlat("hpmax");   // override sets the base; effects (e.g. Tough) still add on top
}

/* speed is a plain user-typed input (not auto-calculated like AC/initiative), but effects can still
   add to it — same "base + effects = total" pattern as an ability score (see abilityScore in data.js). */
/* Variant Encumbrance (DMG/PHB p176) subtracts from Speed once carried weight passes 5x/10x your
   Strength — see encumbranceState() in variant-rules.js. Clamped at 0: a heavily-encumbered creature
   with a 20 ft speed is stopped, not moving backwards. */
function speedTotal() {
  const enc = (typeof encumbranceState === "function") ? encumbranceState().speedPenalty : 0;
  return Math.max(0, num($("speed")) + effFlat("speed") - enc);
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
  { const d = checkDice("init"); $("init").textContent = sign(checkBonus("init")) + (d ? " " + d : ""); }
  { const d = checkDice("ac"); $("ac").textContent = String(checkBonus("ac")) + (d ? " " + d : ""); }
  const ab = $("spell-ability").value;
  if (ab) {
    $("spell-dc").textContent = spellSaveDC();
    const ad = spellAttackDice();
    $("spell-atk").textContent = sign(spellAttackBonus()) + (ad ? " " + ad : "");
  } else { $("spell-dc").textContent = "—"; $("spell-atk").textContent = "—"; }

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
