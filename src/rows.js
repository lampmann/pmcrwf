/* ---------- Build dynamic rows ---------- */
function buildAbilities() {
  const tb = $("ability-rows");
  ABILITIES.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.name}</td>
      <td><input type="text" inputmode="numeric" class="num" data-persist data-math data-min="1" data-max="30" id="score-${a.key}" value="10"></td>
      <td class="derived" id="mod-${a.key}">+0</td>`;
    tb.appendChild(tr);
  });
}
function buildSaves() {
  const tb = $("save-rows");
  ABILITIES.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" data-persist id="saveprof-${a.key}"></td>
      <td>${a.name}</td>
      <td><input type="number" class="tiny" data-persist id="savemisc-${a.key}"></td>
      <td class="derived" id="savebonus-${a.key}">+0</td>
      <td><button class="roll" data-roll-check="save-${a.key}" data-label="${a.name} save">roll</button></td>`;
    tb.appendChild(tr);
  });
}
function buildSkills() {
  const tb = $("skill-rows");
  SKILLS.forEach(([name, ab]) => {
    const slug = name.toLowerCase().replace(/[^a-z]/g, "");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" data-persist id="skillprof-${slug}"></td>
      <td><input type="checkbox" data-persist id="skillexp-${slug}"></td>
      <td>${name} <span class="hint">(${ab})</span></td>
      <td><input type="number" class="tiny" data-persist id="skillmisc-${slug}"></td>
      <td class="derived" id="skillbonus-${slug}">+0</td>
      <td><button class="roll" data-roll-check="skill-${slug}" data-label="${name}">roll</button></td>`;
    tr.dataset.ability = ab; tr.dataset.slug = slug;
    // expertise and proficiency are mutually exclusive
    const prof = tr.querySelector(`#skillprof-${slug}`), exp = tr.querySelector(`#skillexp-${slug}`);
    exp.addEventListener("change", () => { if (exp.checked) prof.checked = false; });
    prof.addEventListener("change", () => { if (prof.checked) exp.checked = false; });
    tb.appendChild(tr);
  });
}
function buildSlots() {
  const head = $("slot-head"), total = $("slot-total"), override = $("slot-override"), used = $("slot-used");
  head.innerHTML = "<th>Level</th>"; total.innerHTML = "<td>total</td>"; override.innerHTML = "<td>override</td>"; used.innerHTML = "<td>used</td>";
  for (let i = 1; i <= 9; i++) {
    head.innerHTML += `<th>${i}</th>`;
    total.innerHTML += `<td class="derived" id="slot-total-${i}">0</td>`;
    override.innerHTML += `<td><input type="text" inputmode="numeric" class="tiny" data-persist data-allow-empty placeholder="auto" id="slot-override-${i}"></td>`;
    used.innerHTML += `<td><input type="text" inputmode="numeric" class="tiny" data-persist data-math data-min="0" data-allow-empty data-max-from="slot-total-${i}" id="slot-used-${i}"></td>`;
  }
}

/* ---------- Class (multiclass) rows ---------- */
// "auto" defers to CLASS_DATA/SUBCLASS_CASTING (looked up from the class/subclass name); pick an
// explicit value only to override that lookup (homebrew class, reflavored hit die, etc.).
const HIT_DICE = [["auto", "auto"], ["d6", "d6"], ["d8", "d8"], ["d10", "d10"], ["d12", "d12"]];
const CASTING_TYPES = [
  ["auto", "auto"], ["none", "None"], ["full", "Full"], ["half", "Half"], ["third", "Third"],
  ["pact", "Pact (Warlock)"],
];
function addClassRow(data = {}) {
  const tr = document.createElement("tr");
  const hd = data.hitDie || "auto", cast = data.casting || "auto";
  const hdOpts = HIT_DICE.map(([v, lab]) => `<option value="${v}" ${hd === v ? "selected" : ""}>${lab}</option>`).join("");
  const castOpts = CASTING_TYPES.map(([v, lab]) => `<option value="${v}" ${cast === v ? "selected" : ""}>${lab}</option>`).join("");
  tr.innerHTML = `
    <td><input type="text" class="cls-name" value="${data.name || ""}" style="width:8rem"></td>
    <td><input type="text" class="cls-sub" value="${data.sub || ""}" style="width:8rem"></td>
    <td><input type="text" inputmode="numeric" class="tiny cls-lvl" data-math data-min="1" data-max="20" value="${data.lvl || 1}"></td>
    <td><select class="cls-hd">${hdOpts}</select></td>
    <td><select class="cls-cast">${castOpts}</select></td>
    <td><button class="rowbtn cls-del">x</button></td>`;
  const lvl = tr.querySelector(".cls-lvl"); lvl.dataset.prev = String(data.lvl || 1);
  tr.querySelector(".cls-del").addEventListener("click", () => { tr.remove(); recompute(); scheduleSave(); });
  tr.querySelectorAll("input, select").forEach(i => {
    i.addEventListener("input", () => { recompute(); scheduleSave(); });
    i.addEventListener("change", () => { recompute(); scheduleSave(); });
  });
  $("class-rows").appendChild(tr);
}
function getClasses() {
  return [...document.querySelectorAll("#class-rows tr")].map(tr => ({
    name: tr.querySelector(".cls-name").value,
    sub: tr.querySelector(".cls-sub").value,
    lvl: Number(tr.querySelector(".cls-lvl").value) || 0,
    hitDie: tr.querySelector(".cls-hd").value,
    casting: tr.querySelector(".cls-cast").value,
  }));
}

/* ---------- Spell rows ---------- */
function addSpellRow(data = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="checkbox" class="sp-prep" ${data.prep ? "checked" : ""}></td>
    <td><input type="number" class="tiny sp-lvl" value="${data.lvl ?? 0}" min="0" max="9"></td>
    <td><input type="text" class="sp-name" value="${data.name || ""}" style="width:10rem"></td>
    <td><button class="roll sp-atk">to hit</button></td>
    <td><input type="text" class="sp-dmg" value="${data.dmg || ""}" placeholder="e.g. 8d6" style="width:8rem">
        <button class="roll sp-dmg-btn">roll</button></td>
    <td><button class="rowbtn sp-del">x</button></td>`;
  tr.querySelector(".sp-del").addEventListener("click", () => { tr.remove(); scheduleSave(); });
  // .sp-atk (to-hit) is handled by the delegated D20SEL click/contextmenu handlers
  tr.querySelector(".sp-dmg-btn").addEventListener("click", () => {
    const notation = tr.querySelector(".sp-dmg").value.trim();
    const name = tr.querySelector(".sp-name").value || "spell";
    if (notation) runRoll(`${notation} ${name} damage`);
  });
  tr.querySelectorAll("input").forEach(i => i.addEventListener("input", scheduleSave));
  $("spell-rows").appendChild(tr);
}
function getSpells() {
  return [...document.querySelectorAll("#spell-rows tr")].map(tr => ({
    prep: tr.querySelector(".sp-prep").checked,
    lvl: Number(tr.querySelector(".sp-lvl").value) || 0,
    name: tr.querySelector(".sp-name").value,
    dmg: tr.querySelector(".sp-dmg").value,
  }));
}
