/* ============================================================
   attacks.js — Attacks / Weapons (DRAFT).
   A table of weapon/attack rows. Per row: name, ability (Str / Dex /
   Finesse=higher of the two / —), proficient toggle, an attack "misc"
   field, damage dice, "add ability mod to damage" toggle, and a damage
   "misc" field. From those it computes a to-hit bonus and a damage
   expression, and gives you roll buttons for each.

   To-hit buttons use class "wpn-roll" so the shared dice engine
   (dice.js D20SEL / rollInfo / fireRoll) handles advantage/disadvantage,
   the right-click menu, and the modifier tooltip for free — attacks.js
   just keeps each button's data-bonus / data-dice / data-rolllabel current.

   Rows live in the DOM (like the Classes table); getAttacks() serializes
   them and persistence.js stores the result in the character (collectState
   / applyState). Field edits autosave through app.js's global input
   listener; add/delete call scheduleSave directly.

   NOT wired yet: the effects engine's reserved attack-hit / damage-bonus
   targets (Sharpshooter, Great Weapon Master). They currently land in the
   effects snapshot's `unapplied` bucket; folding them in here is the next
   step and needs a small change in effects.js to un-reserve those targets.
   ============================================================ */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = v => (v || "").replace(/"/g, "&quot;");
  const signed = n => (n >= 0 ? "+" + n : "" + n);
  const ABILS = [["str", "Str"], ["dex", "Dex"], ["con", "Con"], ["int", "Int"], ["wis", "Wis"], ["cha", "Cha"], ["fin", "Finesse"], ["", "—"]];

  function attackAbilityMod(abil) {
    if (abil === "fin") return Math.max(abilityMod("str"), abilityMod("dex"));
    if (["str", "dex", "con", "int", "wis", "cha"].includes(abil)) return abilityMod(abil);
    return 0;
  }
  function rowData(tr) {
    return {
      name: tr.querySelector(".atk-name").value,
      abil: tr.querySelector(".atk-abil").value,
      prof: tr.querySelector(".atk-prof").checked,
      atkMisc: tr.querySelector(".atk-misc").value,
      dmg: tr.querySelector(".atk-dmg").value,
      modDmg: tr.querySelector(".atk-moddmg").checked,
      dmgMisc: tr.querySelector(".atk-dmgmisc").value,
    };
  }
  function getAttacks() { return [...document.querySelectorAll("#attack-rows tr")].map(rowData); }

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
  function updateAllDerived() { document.querySelectorAll("#attack-rows tr").forEach(updateRowDerived); }

  function addAttackRow(data = {}) {
    const tr = document.createElement("tr");
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
       <td><button class="rowbtn atk-del">x</button></td>`;
    $("attack-rows").appendChild(tr);
    updateRowDerived(tr);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const add = $("btn-add-attack");
    if (add) add.addEventListener("click", () => { addAttackRow(); scheduleSave(); });
    // keep to-hit / damage numbers current as ability scores, level, proficiency, or the row's own fields change
    document.addEventListener("input", e => { if ($("attack-rows")) updateAllDerived(); });
    document.addEventListener("click", e => {
      const del = e.target.closest(".atk-del"); if (del) { del.closest("tr").remove(); scheduleSave(); return; }
      const dmg = e.target.closest(".wpn-dmg"); if (dmg && dmg.dataset.expr) { const tr = dmg.closest("tr"); runRoll(dmg.dataset.expr + " " + (tr.querySelector(".atk-name").value || "Attack") + " damage"); }
    });
    updateAllDerived();
  });

  // exposed for persistence.js
  window.getAttacks = getAttacks;
  window.addAttackRow = addAttackRow;
})();
