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
      <td><input type="text" data-persist id="savemisc-${a.key}" style="width:4.5rem;text-align:right"></td>
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
      <td><input type="text" data-persist id="skillmisc-${slug}" style="width:4.5rem;text-align:right"></td>
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
  const nameInput = tr.querySelector(".cls-name"), subInput = tr.querySelector(".cls-sub");
  attachTypeahead(nameInput, () => Object.keys(CLASS_LIB));
  attachTypeahead(subInput, () => {
    const rec = ciFindClass(nameInput.value);
    return rec ? Object.values(rec.subs).map(s => s.name) : [];
  });
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

/* ---------- Inventory rows ---------- */
function addItemRow(data = {}) {
  const tr = document.createElement("tr");
  const qty = data.qty ?? 1, wt = data.wt ?? "", val = data.val ?? "";
  tr.innerHTML = `
    <td><input type="checkbox" class="itm-eq" ${data.eq ? "checked" : ""}></td>
    <td><input type="text" inputmode="numeric" class="tiny itm-qty" data-math data-min="0" value="${qty}"></td>
    <td><input type="text" class="itm-name" value="${data.name || ""}" style="width:12rem"></td>
    <td><input type="text" inputmode="decimal" class="tiny itm-wt" data-math data-decimal data-min="0" data-allow-empty value="${wt}" placeholder="—"></td>
    <td><input type="text" inputmode="decimal" class="num itm-val" data-math data-decimal data-min="0" data-allow-empty value="${val}" placeholder="0"></td>
    <td class="derived itm-total">0</td>
    <td><button class="rowbtn itm-del">x</button></td>`;
  tr.querySelector(".itm-qty").dataset.prev = String(qty || 0);
  tr.querySelector(".itm-wt").dataset.prev = String(wt === "" ? 0 : wt);
  tr.querySelector(".itm-val").dataset.prev = String(val === "" ? 0 : val);
  tr.querySelector(".itm-del").addEventListener("click", () => { tr.remove(); recompute(); scheduleSave(); });
  $("item-rows").appendChild(tr);
}
function getItems() {
  return [...document.querySelectorAll("#item-rows tr")].map(tr => ({
    eq: tr.querySelector(".itm-eq").checked,
    qty: Number(tr.querySelector(".itm-qty").value) || 0,
    name: tr.querySelector(".itm-name").value,
    wt: tr.querySelector(".itm-wt").value,
    val: tr.querySelector(".itm-val").value,
  }));
}
