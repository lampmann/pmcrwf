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
    companions: (typeof COMPANIONS !== "undefined" ? COMPANIONS : []),
    combat: (typeof COMBAT !== "undefined" ? COMBAT : null),   // the round tracker, so a fight survives a reload
    featChoices: FEAT_CHOICES, usesState: USES_STATE, hdState: HD_STATE,
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
  HD_STATE = state.hdState || {};
  EFFECT_CHOICES = state.effectChoices || {};
  EFFECT_TOGGLES = state.effectToggles || {};
  Object.entries(state.fields || {}).forEach(([id, val]) => {
    const el = $(id); if (!el) return;
    if (el.type === "checkbox") el.checked = val; else el.value = val;
  });
  initMathFields();
  if (typeof addAttackRow === "function") { $("attack-rows").innerHTML = ""; (state.attacks || []).forEach(addAttackRow); }
  if (typeof setRoutines === "function") setRoutines(state.routines || []);   // after attacks, so step pickers resolve names
  if (typeof setCompanions === "function") setCompanions(state.companions || []);   // triggers the bestiary's lazy load if there are any
  // The round tracker is per character: switching tabs mid-fight shows that character's own turn.
  if (typeof blankCombat === "function") { COMBAT = state.combat || blankCombat(); if (typeof renderCombat === "function") renderCombat(); }
  refreshSpellAddClassSelect();
  invalidateEffects();
  recompute();
  renderClassFeatures();
  if (typeof renderHitDice === "function") renderHitDice();
  if (typeof renderItemList === "function") renderItemList();   // not driven by recompute() — see derived.js
  if (typeof renderEquipSlots === "function") renderEquipSlots();   // the paper doll reads CHARACTER_ITEMS, which has only just been set
  if (typeof renderAllProficiencyLists === "function") renderAllProficiencyLists();
  // Renders off a persisted field but only listens to its own `change` event, which writing .value
  // above does not fire — so it has to be repainted explicitly or it keeps showing the previous
  // character's exhaustion level (see status.js).
  if (typeof updateExhaustion === "function") updateExhaustion();
}
/* Saving writes into the active roster entry (src/characters.js) rather than a single fixed key, so
   every character on the tab bar keeps its own state. The entry's cached `name` is refreshed from the
   live field on the way through — that cache is only ever used to label tabs. */
function saveState() {
  const state = collectState();
  const entry = (typeof activeChar === "function") ? activeChar() : null;
  let ok = true;
  if (entry) {
    entry.state = state;
    entry.name = ((state.fields && state.fields["char-name"]) || "").trim() || "unnamed";
    ok = persistRoster();
    if (typeof renderCharacterTabs === "function") renderCharacterTabs();
  } else {
    try { localStorage.setItem("charsheet-v0", JSON.stringify(state)); }   // no roster (e.g. test harness)
    catch (e) { console.warn("Could not write charsheet-v0", e); ok = false; }
  }
  // Report what actually happened. A failed write is almost always localStorage quota (a big roster,
  // or logs that have grown) and the character is then only in memory — losable by closing the tab —
  // so it has to be loud rather than a console line nobody is looking at.
  const st = $("save-status");
  if (ok) { st.textContent = "saved " + new Date().toLocaleTimeString(); st.style.color = ""; st.removeAttribute("title"); }
  else {
    st.textContent = "NOT SAVED — browser storage full (this character is only in memory)";
    st.style.color = "#c00";
    st.title = "Export this character to a file, then delete characters you no longer need or clear old event logs to free space.";
  }
}
function loadState() {
  if (typeof loadRoster === "function") return loadRoster();
  try { return JSON.parse(localStorage.getItem("charsheet-v0")); } catch (e) { return null; }
}
