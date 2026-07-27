/* ============================================================
   attacks.js — Attacks / Weapons (DRAFT).
   A table of weapon/attack rows. Per row: name, ability (Str / Dex /
   Finesse=higher of the two / —), proficient toggle, an attack "misc"
   field, damage dice, "add ability mod to damage" toggle, and a damage
   "misc" field. From those it computes a to-hit bonus and a damage
   expression, and gives you roll buttons: to hit, damage, or both at once.

   To-hit buttons use class "wpn-roll" so the shared dice engine
   (dice.js D20SEL / rollInfo / fireRoll) handles advantage/disadvantage,
   the right-click menu, and the modifier tooltip for free — attacks.js
   just keeps each button's data-bonus / data-dice / data-rolllabel current.
   The combined button (.wpn-both) is handled here instead, since it fires
   two rolls and reports them as one log entry.

   Each row carries a stable generated id (data-atkid) so the Routines
   module can reference an attack across renames and reordering.

   Rows live in the DOM (like the Classes table); getAttacks() serializes
   them and persistence.js stores the result in the character (collectState
   / applyState). Field edits autosave through app.js's global input
   listener; add/delete call scheduleSave directly.

   NOT wired yet: the effects engine's reserved attack-hit / damage-bonus
   targets (Sharpshooter, Great Weapon Master). They currently land in the
   effects snapshot's `unapplied` bucket; folding them in here is the next
   step and needs a small change in effects.js to un-reserve those targets.
   Crits roll no extra damage dice yet either — the log flags the crit, you
   double the dice yourself.
   ============================================================ */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = v => (v || "").replace(/"/g, "&quot;");
  const signed = n => (n >= 0 ? "+" + n : "" + n);
  const ABILS = [["str", "Str"], ["dex", "Dex"], ["con", "Con"], ["int", "Int"], ["wis", "Wis"], ["cha", "Cha"], ["fin", "Finesse"], ["", "—"]];
  let idSeq = 0;
  const newId = () => "a" + (Date.now().toString(36)) + (++idSeq);

  function attackAbilityMod(abil) {
    if (abil === "fin") return Math.max(abilityMod("str"), abilityMod("dex"));
    if (["str", "dex", "con", "int", "wis", "cha"].includes(abil)) return abilityMod(abil);
    return 0;
  }
  function rowData(tr) {
    return {
      id: tr.dataset.atkid,
      name: tr.querySelector(".atk-name").value,
      abil: tr.querySelector(".atk-abil").value,
      prof: tr.querySelector(".atk-prof").checked,
      atkMisc: tr.querySelector(".atk-misc").value,
      dmg: tr.querySelector(".atk-dmg").value,
      modDmg: tr.querySelector(".atk-moddmg").checked,
      dmgMisc: tr.querySelector(".atk-dmgmisc").value,
    };
  }
  const allRows = () => [...document.querySelectorAll("#attack-rows tr")];
  function getAttacks() { return allRows().map(rowData); }
  function rowById(id) { return allRows().find(tr => tr.dataset.atkid === id) || null; }

  function toHit(d) {
    const b = attackAbilityMod(d.abil) + (d.prof ? profBonus() : 0) + parseBonus(d.atkMisc).flat;
    return { bonus: b, dice: parseBonus(d.atkMisc).dice };
  }
  function damageExpr(d) {
    const parts = [];
    if (d.dmg && d.dmg.trim()) parts.push(d.dmg.trim());
    if (d.modDmg) { const m = attackAbilityMod(d.abil); if (m) parts.push(signed(m)); }
    const pb = parseBonus(d.dmgMisc);
    if (pb.flat) parts.push(signed(pb.flat));
    if (pb.dice) parts.push(pb.dice);   // already signed, e.g. "+1d6"
    return parts.join("");
  }
  function updateRowDerived(tr) {
    const d = rowData(tr);
    const th = toHit(d), hitBtn = tr.querySelector(".wpn-roll");
    hitBtn.dataset.bonus = th.bonus; hitBtn.dataset.dice = th.dice;
    hitBtn.dataset.rolllabel = (d.name || "Attack") + " to hit";
    hitBtn.textContent = "to hit " + signed(th.bonus) + (th.dice || "");
    const dmg = damageExpr(d), dmgBtn = tr.querySelector(".wpn-dmg");
    dmgBtn.dataset.expr = dmg;
    dmgBtn.textContent = dmg ? "dmg " + dmg : "dmg —";
    dmgBtn.disabled = !dmg;
  }
  function updateAllDerived() { allRows().forEach(updateRowDerived); }

  /* ----- rolling (shared with the Routines module) -----
     Rolls through the dice engine's evalExpr/applyMode rather than runRoll, so the caller decides
     how to present the result: a single attack logs one line, a routine collects many into one block. */
  function rollExpr(expr, mode) {
    const r = evalExpr(applyMode(expr, mode || "normal"));
    return { value: r.value, display: r.display, d20: (typeof _d20kept !== "undefined" ? _d20kept.slice() : []) };
  }
  function critNote(d20) {
    if (d20.length === 1) { if (d20[0] === 20) return "  <b>Critical Success!</b>"; if (d20[0] === 1) return "  <b>Critical Failure!</b>"; }
    return "";
  }
  // { hitText, dmgText, damage } for one swing of an attack; used by both .wpn-both and routines.
  function rollAttackOnce(d, mode) {
    const th = toHit(d), name = d.name || "Attack";
    const hit = rollExpr(`1d20${signed(th.bonus)}${th.dice || ""}`, mode);
    const modeTag = (mode && mode !== "normal") ? ` <i>(${mode})</i>` : "";
    const out = { hitText: `<b>${hit.value}</b> to hit${modeTag} ← ${hit.display}${critNote(hit.d20)}`, dmgText: "", damage: 0 };
    const de = damageExpr(d);
    if (de) { const dm = rollExpr(de, "normal"); out.dmgText = `<b>${dm.value}</b> damage ← ${dm.display}`; out.damage = dm.value; }
    out.name = name;
    return out;
  }
  function rollBoth(tr, mode) {
    const d = rowData(tr), res = rollAttackOnce(d, mode);
    log(`<b>${res.name}</b> — ${res.hitText}${res.dmgText ? " · " + res.dmgText : ""}`);
  }

  // doubles each dice term in a damage expression (e.g. "1d8+3" -> "(1d8+1d8)+3") for crit damage,
  // per the standard 5e rule: roll damage dice twice, add flat modifiers once
  function doubleDiceExpr(expr) { return expr.replace(/\d*d\d+[a-z<>\d]*/gi, m => `(${m}+${m})`); }

  // one swing for the Routines module: same as rollAttackOnce, but also reports the raw to-hit total
  // (needed to build the AC-range damage table) and auto-doubles damage dice on a crit.
  function rollAttackForRoutine(tr, mode) {
    const d = rowData(tr), th = toHit(d), name = d.name || "Attack";
    const hit = rollExpr(`1d20${signed(th.bonus)}${th.dice || ""}`, mode);
    const modeTag = (mode && mode !== "normal") ? ` <i>(${mode})</i>` : "";
    const isCrit = hit.d20.length === 1 && hit.d20[0] === 20;
    const out = { name, hitTotal: hit.value, isCrit, hitText: `<b>${hit.value}</b> to hit${modeTag} ← ${hit.display}${critNote(hit.d20)}`, dmgText: "", damage: 0 };
    const de = damageExpr(d);
    if (de) {
      const dm = rollExpr(isCrit ? doubleDiceExpr(de) : de, "normal");
      out.dmgText = `<b>${dm.value}</b> damage ← ${dm.display}${isCrit ? " <i>(crit, dice doubled)</i>" : ""}`;
      out.damage = dm.value;
    }
    return out;
  }

  function addAttackRow(data = {}) {
    const tr = document.createElement("tr");
    tr.dataset.atkid = data.id || newId();
    const opts = ABILS.map(([v, l]) => `<option value="${v}"${data.abil === v ? " selected" : ""}>${l}</option>`).join("");
    tr.innerHTML =
      `<td><input type="text" class="atk-name" value="${esc(data.name)}" style="width:8rem" placeholder="Longsword"></td>
       <td><select class="atk-abil">${opts}</select></td>
       <td style="text-align:center"><input type="checkbox" class="atk-prof"${data.prof ? " checked" : ""}></td>
       <td><input type="text" class="atk-misc tiny" value="${esc(data.atkMisc)}" placeholder="+0"></td>
       <td><button class="roll wpn-roll">to hit</button></td>
       <td><input type="text" class="atk-dmg" value="${esc(data.dmg)}" style="width:4.5rem" placeholder="1d8"></td>
       <td style="text-align:center"><input type="checkbox" class="atk-moddmg"${data.modDmg !== false ? " checked" : ""}></td>
       <td><input type="text" class="atk-dmgmisc tiny" value="${esc(data.dmgMisc)}" placeholder="+0"></td>
       <td><button class="roll wpn-dmg">dmg</button></td>
       <td><button class="roll wpn-both" title="roll the attack and its damage together (Shift = advantage, Ctrl = disadvantage)">atk+dmg</button></td>
       <td><button class="rowbtn atk-del">x</button></td>`;
    $("attack-rows").appendChild(tr);
    updateRowDerived(tr);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const add = $("btn-add-attack");
    if (add) add.addEventListener("click", () => { addAttackRow(); scheduleSave(); if (typeof renderRoutines === "function") renderRoutines(); });
    // keep to-hit / damage numbers current as ability scores, level, proficiency, or the row's own fields change
    document.addEventListener("input", e => { if ($("attack-rows")) updateAllDerived(); });
    document.addEventListener("click", e => {
      const del = e.target.closest(".atk-del");
      if (del) { del.closest("tr").remove(); scheduleSave(); if (typeof renderRoutines === "function") renderRoutines(); return; }
      const both = e.target.closest(".wpn-both");
      if (both) { rollBoth(both.closest("tr"), modeFromEvent(e)); return; }
      const dmg = e.target.closest(".wpn-dmg");
      if (dmg && dmg.dataset.expr) { const tr = dmg.closest("tr"); runRoll(dmg.dataset.expr + " " + (tr.querySelector(".atk-name").value || "Attack") + " damage"); }
    });
    updateAllDerived();
  });

  // exposed for persistence.js and the Routines module
  window.getAttacks = getAttacks;
  window.addAttackRow = addAttackRow;
  // [{id, name, bonus, dice, dmg}] computed live — the Routines module's attack picker reads this
  window.attacksForRoutines = () => getAttacks().map(d => {
    const th = toHit(d);
    return { id: d.id, name: d.name || "(unnamed)", bonus: th.bonus, dice: th.dice, dmg: damageExpr(d) };
  });
  // one swing of the attack with this id, as text + damage total (no logging — the caller presents it)
  window.rollAttackById = (id, mode) => { const tr = rowById(id); return tr ? rollAttackOnce(rowData(tr), mode) : null; };
  // same, but for the Routines module: also reports the raw hit total and auto-doubles crit damage dice
  window.rollAttackForRoutineById = (id, mode) => { const tr = rowById(id); return tr ? rollAttackForRoutine(tr, mode) : null; };
  window.diceRollExpr = rollExpr;   // routines reuse the same roll/critical plumbing
})();
