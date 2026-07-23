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
