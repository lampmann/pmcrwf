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
    const sel = byId("exhaustion-level"), out = byId("exhaustion-effect");
    if (!sel || !out) return;
    const lvl = Math.max(0, Math.min(6, Number(sel.value) || 0));
    if (lvl <= 0) { out.textContent = "No exhaustion."; return; }
    const lines = []; for (let i = 1; i <= lvl; i++) lines.push(i + ". " + EXH[i]);
    out.innerHTML = "Cumulative effects: " + lines.join(" · ");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const roll = byId("btn-death-roll"), reset = byId("btn-death-reset"), exh = byId("exhaustion-level");
    if (roll) roll.addEventListener("click", rollDeathSave);
    if (reset) reset.addEventListener("click", clearDeath);
    if (exh) exh.addEventListener("change", updateExhaustion);
    updateExhaustion();  // runs after app.js has applied any saved state (this script loads after app.js)
  });
})();
