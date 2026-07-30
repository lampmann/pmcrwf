/* ---------- Persistence ---------- */
let saveTimer;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 300); }
function collectState() {
  const state = {
    v: 1, effectsSv: 1,
    fields: {}, classes: getClasses(), spells: CHARACTER_SPELLS, concentrating: CONCENTRATING, items: CHARACTER_ITEMS,
    proficiencies: PROFICIENCIES,
    attacks: (typeof getAttacks === "function" ? getAttacks() : []),
    routines: (typeof ROUTINES !== "undefined" ? ROUTINES : []),
    featChoices: FEAT_CHOICES, usesState: USES_STATE,
    effectChoices: EFFECT_CHOICES, effectToggles: EFFECT_TOGGLES,
  };
  document.querySelectorAll("[data-persist]").forEach(el => { state.fields[el.id] = el.type === "checkbox" ? el.checked : el.value; });
  return state;
}
function applyState(state) {
  if (!state) return;
  $("class-rows").innerHTML = "";
  (state.classes || [{ name: "", sub: "", lvl: 1 }]).forEach(addClassRow);
  CHARACTER_SPELLS = state.spells || [];
  CONCENTRATING = state.concentrating || null;
  CHARACTER_ITEMS = state.items || [];
  PROFICIENCIES = state.proficiencies || { weapons: [], tools: [], languages: [] };
  FEAT_CHOICES = state.featChoices || {};
  USES_STATE = state.usesState || {};
  EFFECT_CHOICES = state.effectChoices || {};
  EFFECT_TOGGLES = state.effectToggles || {};
  Object.entries(state.fields || {}).forEach(([id, val]) => {
    const el = $(id); if (!el) return;
    if (el.type === "checkbox") el.checked = val; else el.value = val;
  });
  initMathFields();
  if (typeof addAttackRow === "function") { $("attack-rows").innerHTML = ""; (state.attacks || []).forEach(addAttackRow); }
  if (typeof setRoutines === "function") setRoutines(state.routines || []);   // after attacks, so step pickers resolve names
  refreshSpellAddClassSelect();
  invalidateEffects();
  recompute();
  renderClassFeatures();
  renderAllProficiencyLists();
}
function saveState() { localStorage.setItem("charsheet-v0", JSON.stringify(collectState())); $("save-status").textContent = "saved " + new Date().toLocaleTimeString(); }
function loadState() { try { return JSON.parse(localStorage.getItem("charsheet-v0")); } catch (e) { return null; } }
