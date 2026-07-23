/* ---------- Derived calculations ---------- */
function totalLevel() { return getClasses().reduce((s, c) => s + c.lvl, 0); }
function profBonus() {
  const ov = $("pb-override").value;
  if (ov !== "") return Number(ov);
  const lvl = totalLevel();
  return lvl < 1 ? 2 : Math.ceil(lvl / 4) + 1;
}
function spellMod() { const ab = $("spell-ability").value; return ab ? mod($("score-" + ab).value) : 0; }
function spellAttackBonus() { return profBonus() + spellMod() + num($("spell-atk-misc")); }

/* ---------- Max HP (assumes fixed/"consistent" HP per level, not rolled) ---------- */
const HIT_DIE_MAX = { d6: 6, d8: 8, d10: 10, d12: 12 };
const HIT_DIE_FIXED = { d6: 4, d8: 5, d10: 6, d12: 7 };
function maxHPAuto() {
  const classes = getClasses().filter(c => c.lvl > 0);
  const conMod = mod($("score-con").value);
  return classes.reduce((total, c, i) => {
    const dieMax = HIT_DIE_MAX[c.hitDie] || 8, dieFixed = HIT_DIE_FIXED[c.hitDie] || 5;
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
    if (c.casting === "full") return s + c.lvl;
    if (c.casting === "half") return s + Math.floor(c.lvl / 2);
    if (c.casting === "third") return s + Math.floor(c.lvl / 3);
    return s;
  }, 0);
}
function autoSlots() { return MULTICLASS_SLOTS[Math.max(0, Math.min(20, casterLevel()))]; }
function slotTotal(i) {
  const ov = $("slot-override-" + i).value;
  return ov !== "" && !isNaN(Number(ov)) ? Number(ov) : autoSlots()[i - 1];
}

function recompute() {
  const pb = profBonus();
  $("total-level").textContent = totalLevel();
  $("pb").textContent = sign(pb);
  ABILITIES.forEach(a => { $("mod-" + a.key).textContent = sign(mod($("score-" + a.key).value)); });
  ABILITIES.forEach(a => {
    const b = mod($("score-" + a.key).value) + ($("saveprof-" + a.key).checked ? pb : 0) + num($("savemisc-" + a.key));
    $("savebonus-" + a.key).textContent = sign(b);
  });
  document.querySelectorAll("#skill-rows tr").forEach(tr => {
    const slug = tr.dataset.slug, ab = tr.dataset.ability;
    let pmult = $("skillexp-" + slug).checked ? 2 : $("skillprof-" + slug).checked ? 1 : 0;
    const b = mod($("score-" + ab).value) + pb * pmult + num($("skillmisc-" + slug));
    $("skillbonus-" + slug).textContent = sign(b);
  });
  const percMult = $("skillexp-perception").checked ? 2 : $("skillprof-perception").checked ? 1 : 0;
  $("passive-perc").textContent = 10 + mod($("score-wis").value) + pb * percMult + num($("skillmisc-perception"));
  $("init").textContent = sign(mod($("score-dex").value) + num($("init-misc")));
  const ab = $("spell-ability").value;
  if (ab) {
    $("spell-dc").textContent = 8 + pb + spellMod() + num($("spell-dc-misc"));
    $("spell-atk").textContent = sign(spellAttackBonus());
  } else { $("spell-dc").textContent = "—"; $("spell-atk").textContent = "—"; }

  const hpMax = maxHP();
  $("hp-max").textContent = String(hpMax);
  const hpCur = $("hp-cur");
  if (hpCur.value !== "" && Number(hpCur.value) > hpMax) hpCur.value = String(hpMax);

  for (let i = 1; i <= 9; i++) $("slot-total-" + i).textContent = String(slotTotal(i));
}

function checkBonus(key) {
  if (key === "init") return mod($("score-dex").value) + num($("init-misc"));
  if (key.startsWith("save-")) {
    const a = key.slice(5), pb = profBonus();
    return mod($("score-" + a).value) + ($("saveprof-" + a).checked ? pb : 0) + num($("savemisc-" + a));
  }
  if (key.startsWith("skill-")) {
    const slug = key.slice(6), pb = profBonus();
    const tr = [...document.querySelectorAll("#skill-rows tr")].find(t => t.dataset.slug === slug);
    const ab = tr.dataset.ability;
    const pmult = $("skillexp-" + slug).checked ? 2 : $("skillprof-" + slug).checked ? 1 : 0;
    return mod($("score-" + ab).value) + pb * pmult + num($("skillmisc-" + slug));
  }
  return 0;
}
