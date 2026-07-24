/* ---------- Derived calculations ---------- */
function totalLevel() { return getClasses().reduce((s, c) => s + c.lvl, 0); }
function profBonus() {
  const ov = $("pb-override").value;
  if (ov !== "") return Number(ov);
  const lvl = totalLevel();
  return lvl < 1 ? 2 : Math.ceil(lvl / 4) + 1;
}
function spellMod() { const ab = $("spell-ability").value; return ab ? mod($("score-" + ab).value) : 0; }
function spellAttackBonus() { return profBonus() + spellMod() + parseBonus($("spell-atk-misc").value).flat; }
function spellAttackDice() { return parseBonus($("spell-atk-misc").value).dice; }

/* ---------- Max HP (assumes fixed/"consistent" HP per level, not rolled) ---------- */
const HIT_DIE_MAX = { d6: 6, d8: 8, d10: 10, d12: 12 };
const HIT_DIE_FIXED = { d6: 4, d8: 5, d10: 6, d12: 7 };
function maxHPAuto() {
  const classes = getClasses().filter(c => c.lvl > 0);
  const conMod = mod($("score-con").value);
  return classes.reduce((total, c, i) => {
    const hitDie = c.hitDie === "auto" ? classHitDie(c.name) : c.hitDie;
    const dieMax = HIT_DIE_MAX[hitDie] || 8, dieFixed = HIT_DIE_FIXED[hitDie] || 5;
    for (let l = 1; l <= c.lvl; l++) total += (i === 0 && l === 1 ? dieMax : dieFixed) + conMod;
    return total;
  }, 0);
}
function maxHP() {
  const ov = $("hp-max-override").value;
  return ov !== "" && !isNaN(Number(ov)) ? Number(ov) : maxHPAuto();
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
  const pb = profBonus();
  $("total-level").textContent = totalLevel();
  $("pb").textContent = sign(pb);
  ABILITIES.forEach(a => { $("mod-" + a.key).textContent = sign(mod($("score-" + a.key).value)); });
  ABILITIES.forEach(a => {
    const key = "save-" + a.key, d = checkDice(key);
    $("savebonus-" + a.key).textContent = sign(checkBonus(key)) + (d ? " " + d : "");
  });
  document.querySelectorAll("#skill-rows tr").forEach(tr => {
    const key = "skill-" + tr.dataset.slug, d = checkDice(key);
    $("skillbonus-" + tr.dataset.slug).textContent = sign(checkBonus(key)) + (d ? " " + d : "");
  });
  const percMult = $("skillexp-perception").checked ? 2 : $("skillprof-perception").checked ? 1 : 0;
  $("passive-perc").textContent = 10 + mod($("score-wis").value) + pb * percMult + parseBonus($("skillmisc-perception").value).flat;
  { const d = checkDice("init"); $("init").textContent = sign(checkBonus("init")) + (d ? " " + d : ""); }
  const ab = $("spell-ability").value;
  if (ab) {
    $("spell-dc").textContent = 8 + pb + spellMod() + num($("spell-dc-misc"));
    const ad = spellAttackDice();
    $("spell-atk").textContent = sign(spellAttackBonus()) + (ad ? " " + ad : "");
  } else { $("spell-dc").textContent = "—"; $("spell-atk").textContent = "—"; }

  const hpMax = maxHP();
  $("hp-max").textContent = String(hpMax);
  const hpCur = $("hp-cur");
  if (hpCur.value !== "" && Number(hpCur.value) > hpMax) hpCur.value = String(hpMax);

  for (let i = 1; i <= 9; i++) $("slot-total-" + i).textContent = String(slotTotal(i));

  renderSpellList();
  recomputeInventory();
}

/* ---------- Inventory (coin purse + item list, all summed in gp) ---------- */
function fmtGP(n) { return String(Math.round(n * 100) / 100); }
function coinTotalGP() { return Object.keys(COIN_GP).reduce((s, k) => s + num($("coin-" + k)) * COIN_GP[k], 0); }
function itemsTotalValue() { return getItems().reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.val) || 0), 0); }
function itemsTotalWeight() { return getItems().reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.wt) || 0), 0); }
function recomputeInventory() {
  document.querySelectorAll("#item-rows tr").forEach(tr => {
    const qty = Number(tr.querySelector(".itm-qty").value) || 0;
    const val = Number(tr.querySelector(".itm-val").value) || 0;
    tr.querySelector(".itm-total").textContent = fmtGP(qty * val);
  });
  $("items-value-total").textContent = fmtGP(itemsTotalValue());
  $("items-weight-total").textContent = fmtGP(itemsTotalWeight());
  $("coin-total-gp").textContent = fmtGP(coinTotalGP());
  $("wealth-total-gp").textContent = fmtGP(coinTotalGP() + itemsTotalValue());
}

function miscOf(key) {
  if (key === "init") return $("init-misc").value;
  if (key.startsWith("save-")) return $("savemisc-" + key.slice(5)).value;
  if (key.startsWith("skill-")) return $("skillmisc-" + key.slice(6)).value;
  return "";
}
function baseOf(key) {   // the fixed part: ability mod + proficiency (no misc)
  if (key === "init") return mod($("score-dex").value);
  if (key.startsWith("save-")) { const a = key.slice(5); return mod($("score-" + a).value) + ($("saveprof-" + a).checked ? profBonus() : 0); }
  if (key.startsWith("skill-")) {
    const slug = key.slice(6);
    const tr = [...document.querySelectorAll("#skill-rows tr")].find(t => t.dataset.slug === slug);
    const ab = tr.dataset.ability, pmult = $("skillexp-" + slug).checked ? 2 : $("skillprof-" + slug).checked ? 1 : 0;
    return mod($("score-" + ab).value) + profBonus() * pmult;
  }
  return 0;
}
function checkBonus(key) { return baseOf(key) + parseBonus(miscOf(key)).flat; }   // static numeric bonus
function checkDice(key) { return parseBonus(miscOf(key)).dice; }                  // dice from misc, e.g. "+1d4"
