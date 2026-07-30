/* ============================================================
   PROFICIENCIES MODULE — armor/weapon category proficiencies are
   plain persisted checkboxes (same as Conditions); specific weapons,
   tools, and languages are freeform add/remove lists (same shape as
   CHARACTER_ITEMS in inventory.js) since they're open-ended names,
   not a fixed enumerable set. PROFICIENCIES is persisted as part of
   the character (see persistence.js).
   ============================================================ */
let PROFICIENCIES = { weapons: [], tools: [], languages: [] }; // {weapons:[name], tools:[name], languages:[name]}

function addProficiency(cat, name) {
  name = (name || "").trim(); if (!name) return;
  PROFICIENCIES[cat].push(name);
  renderProficiencyList(cat); scheduleSave();
}
function removeProficiency(cat, idx) {
  PROFICIENCIES[cat].splice(idx, 1);
  renderProficiencyList(cat); scheduleSave();
}
function renderProficiencyList(cat) {
  const el = $(`prof-${cat}-list`); if (!el) return;
  const list = PROFICIENCIES[cat] || [];
  if (!list.length) { el.innerHTML = "<div class='hint'>none yet</div>"; return; }
  el.innerHTML = list.map((name, i) => `<div>
      ${escapeHtml(name)}
      <button class="rowbtn prof-del" data-cat="${cat}" data-idx="${i}" title="remove">x</button>
    </div>`).join("");
}
function renderAllProficiencyLists() { ["weapons", "tools", "languages"].forEach(renderProficiencyList); }

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".prof-add-btn").forEach(btn => {
    const cat = btn.dataset.cat;
    const input = $(`prof-${cat}-input`);
    const commit = () => { addProficiency(cat, input.value); input.value = ""; input.focus(); };
    btn.addEventListener("click", commit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
  });
  const module = document.querySelector('[data-module="proficiencies"]');
  if (module) module.addEventListener("click", e => {
    const del = e.target.closest(".prof-del");
    if (del) removeProficiency(del.dataset.cat, Number(del.dataset.idx));
  });
  renderAllProficiencyLists();
});
