/* ---------- Persistence ---------- */
let saveTimer;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 300); }
function collectState() {
  const state = { fields: {}, classes: getClasses(), spells: getSpells() };
  document.querySelectorAll("[data-persist]").forEach(el => { state.fields[el.id] = el.type === "checkbox" ? el.checked : el.value; });
  return state;
}
function applyState(state) {
  if (!state) return;
  $("class-rows").innerHTML = "";
  (state.classes || [{ name: "", sub: "", lvl: 1 }]).forEach(addClassRow);
  $("spell-rows").innerHTML = "";
  (state.spells || []).forEach(addSpellRow);
  Object.entries(state.fields || {}).forEach(([id, val]) => {
    const el = $(id); if (!el) return;
    if (el.type === "checkbox") el.checked = val; else el.value = val;
  });
  initMathFields();
  recompute();
}
function saveState() { localStorage.setItem("charsheet-v0", JSON.stringify(collectState())); $("save-status").textContent = "saved " + new Date().toLocaleTimeString(); }
function loadState() { try { return JSON.parse(localStorage.getItem("charsheet-v0")); } catch (e) { return null; } }
