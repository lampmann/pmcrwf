/* ============================================================
   status.js — Death Saves, Exhaustion, and Conditions trackers.
   Self-contained. The checkboxes / select live in the HTML with
   data-persist, so they save & load through the normal persistence
   path; this file only adds the death-save roll logic + the
   exhaustion effect readout. Reuses the global dice helpers
   (rollDie / log) and scheduleSave when present.
   ============================================================ */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);

  /* ---- death saves ---- */
  const deathBoxes = type => [1, 2, 3].map(i => byId("death-" + type + "-" + i)).filter(Boolean);
  const countDeath = type => deathBoxes(type).filter(b => b.checked).length;
  function markDeath(type) {
    const b = deathBoxes(type).find(x => !x.checked);
    if (b) { b.checked = true; b.dispatchEvent(new Event("input", { bubbles: true })); return true; }
    return false;
  }
  function clearDeath() {
    deathBoxes("succ").concat(deathBoxes("fail")).forEach(b => (b.checked = false));
    if (typeof scheduleSave === "function") scheduleSave();
  }
  function rollDeathSave() {
    if (typeof rollDie !== "function") return;
    const d = rollDie(20);
    let note;
    if (d === 20) {
      clearDeath();
      const hp = byId("hp-cur");
      if (hp) { hp.value = "1"; hp.dispatchEvent(new Event("input", { bubbles: true })); hp.dispatchEvent(new Event("change", { bubbles: true })); }
      note = "NAT 20 — regain 1 HP and are conscious!";
    } else if (d === 1) { markDeath("fail"); markDeath("fail"); note = "nat 1 — two failures!"; }
    else if (d >= 10) { markDeath("succ"); note = d + " — success."; }
    else { markDeath("fail"); note = d + " — failure."; }
    let status = "";
    if (countDeath("fail") >= 3) status = " You have died.";
    else if (countDeath("succ") >= 3) status = " You are stable.";
    if (typeof log === "function") log(`<b>${d}</b> &larr; Death Save: ${note}${status}`);
  }

  /* ---- exhaustion (2014 cumulative track) ---- */
  const EXH = ["", "Disadvantage on ability checks", "Speed halved",
    "Disadvantage on attack rolls and saving throws", "Hit point maximum halved",
    "Speed reduced to 0", "Death"];
  function updateExhaustion() {
    const lvlEl = byId("exhaustion-level"), out = byId("exhaustion-effect");
    if (!lvlEl || !out) return;
    const lvl = Math.max(0, Math.min(6, Number(lvlEl.value) || 0));
    let rows = "<tr><th>Lvl</th><th>Effect</th></tr>";   // click a level to set it; rows up to it are highlighted (cumulative)
    for (let i = 1; i <= 6; i++) {
      const active = i <= lvl;
      rows += `<tr data-exh="${i}" style="cursor:pointer${active ? ";background:var(--menu-hover-bg)" : ""}"><td style="text-align:center">${i}</td><td>${EXH[i]}</td></tr>`;
    }
    out.innerHTML = `<table style="margin-top:.25rem">${rows}</table>`;
  }
  function setExhaustion(n) {
    const lvlEl = byId("exhaustion-level"); if (!lvlEl) return;
    lvlEl.value = String(Math.max(0, Math.min(6, n)));
    lvlEl.dispatchEvent(new Event("input", { bubbles: true }));    // persistence (app.js global listener)
    lvlEl.dispatchEvent(new Event("change", { bubbles: true }));   // re-renders via the change handler below
  }

  /* ---- condition dependencies: Paralyzed / Petrified / Stunned / Unconscious also make you Incapacitated ---- */
  const INCAPACITATORS = ["paralyzed", "petrified", "stunned", "unconscious"];
  function wireIncapacitators() {
    INCAPACITATORS.forEach(c => {
      const cb = byId("cond-" + c);
      if (cb) cb.addEventListener("change", () => {
        if (!cb.checked) return;
        const inc = byId("cond-incapacitated");
        if (inc && !inc.checked) { inc.checked = true; inc.dispatchEvent(new Event("input", { bubbles: true })); }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const roll = byId("btn-death-roll"), reset = byId("btn-death-reset"), exh = byId("exhaustion-level");
    if (roll) roll.addEventListener("click", rollDeathSave);
    if (reset) reset.addEventListener("click", clearDeath);
    if (exh) exh.addEventListener("change", updateExhaustion);
    const exhOut = byId("exhaustion-effect");
    if (exhOut) exhOut.addEventListener("click", e => {
      const tr = e.target.closest("[data-exh]"); if (!tr) return;
      const clicked = Number(tr.dataset.exh), cur = Number(byId("exhaustion-level").value) || 0;
      setExhaustion(clicked === cur ? clicked - 1 : clicked);   // clicking the current level steps down
    });
    wireIncapacitators();
    updateExhaustion();  // runs after app.js has applied any saved state (this script loads after app.js)
  });
})();
