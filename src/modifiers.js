/* ---------- Roll modifiers (dice bonuses like Guidance / Bless) ----------
   Toggleable dice that get appended to matching d20 rolls. Scopes:
   check (ability checks & skills), save, atk (attacks/spell attacks), init. */
const MOD_PRESETS = {
  guidance:   { name: "Guidance",           dice: "1d4", check: true },
  bless:      { name: "Bless",              dice: "1d4", save: true, atk: true },
  resistance: { name: "Resistance",         dice: "1d4", save: true },
  bardic:     { name: "Bardic Inspiration", dice: "1d6", check: true, save: true, atk: true },
  alacrity:   { name: "Gift of Alacrity",   dice: "1d8", init: true },
};
function addModifierRow(d = {}) {
  const tr = document.createElement("tr");
  const esc = v => (v || "").replace(/"/g, "&quot;");
  tr.innerHTML = `
    <td><input type="checkbox" class="mod-on" ${d.on ? "checked" : ""}></td>
    <td><input type="text" class="mod-name" value="${esc(d.name)}" style="width:9rem"></td>
    <td><input type="text" class="mod-dice" value="${esc(d.dice || "1d4")}" style="width:3.5rem"></td>
    <td><input type="checkbox" class="mod-check" ${d.check ? "checked" : ""}></td>
    <td><input type="checkbox" class="mod-save" ${d.save ? "checked" : ""}></td>
    <td><input type="checkbox" class="mod-atk" ${d.atk ? "checked" : ""}></td>
    <td><input type="checkbox" class="mod-init" ${d.init ? "checked" : ""}></td>
    <td><button class="rowbtn mod-del">x</button></td>`;
  tr.querySelector(".mod-del").addEventListener("click", () => { tr.remove(); scheduleSave(); });
  tr.querySelectorAll("input").forEach(i => i.addEventListener("input", scheduleSave));
  $("mod-rows").appendChild(tr);
}
function getModifiers() {
  return [...document.querySelectorAll("#mod-rows tr")].map(tr => ({
    on: tr.querySelector(".mod-on").checked,
    name: tr.querySelector(".mod-name").value,
    dice: tr.querySelector(".mod-dice").value,
    check: tr.querySelector(".mod-check").checked,
    save: tr.querySelector(".mod-save").checked,
    atk: tr.querySelector(".mod-atk").checked,
    init: tr.querySelector(".mod-init").checked,
  }));
}
function activeMods(cat) { return getModifiers().filter(m => m.on && m[cat] && m.dice.trim()); }
