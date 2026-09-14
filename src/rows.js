/* ---------- Build dynamic rows ---------- */
function buildAbilities() {
  const tb = $("ability-rows");
  ABILITIES.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.name}</td>
      <td><input type="text" inputmode="numeric" class="num" data-persist readonly id="score-${a.key}" value="10"
            title="your base score, set at character creation and by level-up \u2014 everything since goes in Misc"> <span class="derived eff-note" id="score-eff-${a.key}" style="display:none"></span></td>
      <td><input type="text" data-persist class="score-misc" id="scoremisc-${a.key}"
            placeholder="+2 belt, -1 curse"
            title="signed terms, each optionally labelled with what it's from \u2014 e.g. &quot;+4-1&quot; or &quot;+2 belt, -1 curse&quot;"></td>
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
/* ============================================================
   SKILL ORDER — yours, per character.

   Eighteen skills, and on most characters a dozen of them never come up. The
   alphabetical order the book prints them in is the worst one for play: the
   three you actually roll are scattered through a list you have to read past
   every time. So the rows drag.

   Order is stored as a list of slugs on the character, not in the layout: a
   rogue and a wizard want different skills on top, and it travels with an
   exported character rather than staying behind in this browser. Anything the
   stored list doesn't mention keeps its alphabetical position after the ones
   it does, so a saved order from before a skill existed doesn't lose it.
   ============================================================ */
let SKILL_ORDER = [];

function skillRowEls() { return [...document.querySelectorAll("#skill-rows tr")]; }

/* The order as it currently stands on screen — what gets saved. */
function currentSkillOrder() { return skillRowEls().map(tr => tr.dataset.slug); }

/* Reorder the rows to match a stored list. Unknown slugs are ignored and unmentioned rows keep
   their relative order at the end, so this can never drop a skill off the sheet. */
function applySkillOrder(order) {
  const tb = document.getElementById("skill-rows"); if (!tb) return;
  SKILL_ORDER = Array.isArray(order) ? order.filter(x => typeof x === "string") : [];
  // No stored order means alphabetical, which is also what a brand-new character gets.
  if (!SKILL_ORDER.length) { resetSkillOrderRows(); return; }
  const rows = skillRowEls();
  const bySlug = {}; rows.forEach(tr => { bySlug[tr.dataset.slug] = tr; });
  const seen = new Set();
  SKILL_ORDER.forEach(slug => {
    const tr = bySlug[slug];
    if (!tr || seen.has(slug)) return;
    seen.add(slug); tb.appendChild(tr);
  });
  rows.forEach(tr => { if (!seen.has(tr.dataset.slug)) tb.appendChild(tr); });
}

function resetSkillOrderRows() {
  const tb = document.getElementById("skill-rows"); if (!tb) return;
  skillRowEls().sort((a, b) => a.dataset.slug.localeCompare(b.dataset.slug)).forEach(tr => tb.appendChild(tr));
}
function resetSkillOrder() {
  resetSkillOrderRows();
  SKILL_ORDER = currentSkillOrder();
  if (typeof scheduleSave === "function") scheduleSave();
}

/* Drag to reorder. Insertion goes above or below the row you're over depending on which half of it
   the pointer is in, and the line showing where it will land is drawn while you drag — a drop with
   no preview is a guess, the same reasoning the character tabs follow. */
let SKILL_DRAG_SLUG = null;
function clearSkillDropMarks() {
  document.querySelectorAll("#skill-rows tr").forEach(t => t.classList.remove("drop-before", "drop-after"));
}
function skillDropAfter(tr, clientY) {
  const r = tr.getBoundingClientRect();
  return (clientY - r.top) > r.height / 2;
}

document.addEventListener("DOMContentLoaded", () => {
  const tb = document.getElementById("skill-rows"); if (!tb) return;

  tb.addEventListener("dragstart", e => {
    const tr = e.target.closest("tr"); if (!tr || !tr.dataset.slug) return;
    SKILL_DRAG_SLUG = tr.dataset.slug;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", SKILL_DRAG_SLUG); } catch (err) {}   // Firefox needs a payload
    tr.classList.add("dragging");
  });
  tb.addEventListener("dragend", () => {
    SKILL_DRAG_SLUG = null; clearSkillDropMarks();
    document.querySelectorAll("#skill-rows tr").forEach(t => { t.classList.remove("dragging"); t.draggable = false; });
  });
  tb.addEventListener("dragover", e => {
    if (!SKILL_DRAG_SLUG) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    clearSkillDropMarks();
    const tr = e.target.closest("tr");
    if (!tr || tr.dataset.slug === SKILL_DRAG_SLUG) return;
    tr.classList.add(skillDropAfter(tr, e.clientY) ? "drop-after" : "drop-before");
  });
  tb.addEventListener("drop", e => {
    if (!SKILL_DRAG_SLUG) return;
    e.preventDefault();
    const moved = document.querySelector(`#skill-rows tr[data-slug="${SKILL_DRAG_SLUG}"]`);
    const tr = e.target.closest("tr");
    SKILL_DRAG_SLUG = null; clearSkillDropMarks();
    if (!moved || !tr || tr === moved) return;
    if (skillDropAfter(tr, e.clientY)) tr.after(moved); else tr.before(moved);
    SKILL_ORDER = currentSkillOrder();
    if (typeof scheduleSave === "function") scheduleSave();
  });

  const reset = document.getElementById("btn-skill-reset-order");
  if (reset) reset.addEventListener("click", resetSkillOrder);
});

function buildSkills() {
  const tb = $("skill-rows");
  SKILLS.forEach(([name, ab]) => {
    const slug = name.toLowerCase().replace(/[^a-z]/g, "");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="skill-grip" title="drag to reorder">&#8942;&#8942;</td>
      <td><input type="checkbox" data-persist id="skillprof-${slug}"></td>
      <td><input type="checkbox" data-persist id="skillexp-${slug}"></td>
      <td>${name} <span class="hint">(${ab})</span></td>
      <td><input type="text" data-persist id="skillmisc-${slug}" style="width:4.5rem;text-align:right"></td>
      <td class="derived" id="skillbonus-${slug}">+0</td>
      <td><button class="roll" data-roll-check="skill-${slug}" data-label="${name}">roll</button></td>`;
    tr.dataset.ability = ab; tr.dataset.slug = slug;
    /* Draggable from the grip only, not the whole row: the row is full of checkboxes and a text
       field, and a row that starts a drag when you try to select text in Misc is worse than one
       that can't be reordered at all. */
    tr.draggable = false;
    const grip = tr.querySelector(".skill-grip");
    grip.addEventListener("mousedown", () => { tr.draggable = true; });
    grip.addEventListener("mouseup", () => { tr.draggable = false; });
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
    <td><input type="text" class="cls-name" style="width:8rem"></td>
    <td><input type="text" class="cls-sub" style="width:8rem"></td>
    <td><input type="text" inputmode="numeric" class="tiny cls-lvl" data-math data-min="1" data-max="20"></td>
    <td><select class="cls-hd">${hdOpts}</select></td>
    <td><select class="cls-cast">${castOpts}</select></td>
    <td><button class="rowbtn cls-del">x</button></td>`;
  tr.querySelector(".cls-name").defaultValue = data.name || "";
  tr.querySelector(".cls-sub").defaultValue = data.sub || "";
  const lvl = tr.querySelector(".cls-lvl");
  lvl.defaultValue = data.lvl || 1;
  lvl.dataset.prev = String(data.lvl || 1);
  tr.querySelector(".cls-del").addEventListener("click", () => { tr.remove(); recompute(); scheduleSave(); });
  tr.querySelectorAll("input, select").forEach(i => {
    i.addEventListener("input", () => { recompute(); scheduleSave(); });
    i.addEventListener("change", () => { recompute(); scheduleSave(); });
  });
  $("class-rows").appendChild(tr);
  const nameInput = tr.querySelector(".cls-name"), subInput = tr.querySelector(".cls-sub");
  // Banned options show red rather than disappearing (see house-rules.js). A subclass ban is stored
  // qualified by its class ("Fighter: Champion"), and the class in this row can change under the
  // picker, so the prefix is resolved per-open rather than baked in.
  // ciFindClass lives in class-library.js, which the standalone tests/derived.html doesn't load —
  // this module has to stay usable without it, so every lookup goes through here.
  const classRec = () => (typeof ciFindClass === "function") ? ciFindClass(nameInput.value) : null;
  attachTypeahead(nameInput, () => Object.keys(typeof CLASS_LIB !== "undefined" ? CLASS_LIB : {}), () => ({ kind: "class", prefix: "" }));
  attachTypeahead(subInput, () => {
    const rec = classRec();
    return rec ? Object.values(rec.subs).map(s => s.name) : [];
  }, () => {
    const rec = classRec();
    return { kind: "subclass", prefix: rec ? rec.name + ": " : "" };
  });
  nameInput.dataset.banKind = "class";
  subInput.dataset.banKind = "subclass";
  // Keeps the subclass box's own red-when-banned test qualified by whatever class is typed now.
  const syncSubPrefix = () => {
    const rec = classRec();
    subInput.dataset.banPrefix = rec ? rec.name + ": " : "";
    if (typeof markBannedInput === "function") { markBannedInput(nameInput); markBannedInput(subInput); }
  };
  nameInput.addEventListener("input", syncSubPrefix);
  syncSubPrefix();
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
