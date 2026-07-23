/* ---------- Init / wiring ---------- */
function init() {
  buildAbilities(); buildSaves(); buildSkills(); buildSlots();

  // Attach all listeners FIRST, so that even if loading a saved state fails,
  // the sheet stays fully interactive (this is the "nothing auto-calcs" failsafe).
  // live recompute + autosave on any input (math parsing happens on commit below)
  document.addEventListener("input", () => { recompute(); scheduleSave(); });

  // commit math fields on blur (change) or Enter
  document.addEventListener("change", e => { const el = e.target.closest("[data-math]"); if (el) commitMathField(el); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const t = e.target;
    if (t && t.tagName === "INPUT" && t.type === "checkbox") {   // Enter toggles a focused checkbox
      e.preventDefault(); t.checked = !t.checked;
      t.dispatchEvent(new Event("change", { bubbles: true }));
      t.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const el = t.closest && t.closest("[data-math]");
    if (el) { commitMathField(el); if (el.blur) el.blur(); }
  });

  // roll-check buttons (saves, skills, initiative, spell attack) — left-click rolls; Shift=adv, Ctrl=dis
  document.addEventListener("click", e => {
    if (_menuOpen) closeRollMenu();
    const btn = e.target.closest(D20SEL);
    if (btn) fireRoll(btn, modeFromEvent(e));
  });
  // modifier-aware tooltip: hold Shift/Ctrl while hovering a roll button to see the mode
  document.addEventListener("mousemove", e => { _mouse.x = e.clientX; _mouse.y = e.clientY; if (_hoverRoll) refreshRollTip(); });
  document.addEventListener("mouseover", e => { const b = e.target.closest(D20SEL); if (b) { _hoverRoll = b; refreshRollTip(); } });
  document.addEventListener("mouseout", e => { const b = e.target.closest(D20SEL); if (b && (!e.relatedTarget || !b.contains(e.relatedTarget))) { _hoverRoll = null; refreshRollTip(); } });
  document.addEventListener("keydown", e => { const m = modKey(e); if (m !== _curMod) { _curMod = m; refreshRollTip(); } });
  document.addEventListener("keyup", e => { const m = modKey(e); if (m !== _curMod) { _curMod = m; refreshRollTip(); } });
  window.addEventListener("blur", () => { _curMod = null; refreshRollTip(); });
  // right-click a roll button for a Normal / Advantage / Disadvantage menu
  document.addEventListener("contextmenu", e => { const b = e.target.closest(D20SEL); if (b) { e.preventDefault(); showRollMenu(e.clientX, e.clientY, b); } });

  // dice command input
  $("cmd-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { runCommand(e.target.value); e.target.value = ""; }
  });

  $("btn-add-class").addEventListener("click", () => { addClassRow(); recompute(); scheduleSave(); });
  $("btn-add-spell").addEventListener("click", () => { addSpellRow(); scheduleSave(); });

  $("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(collectState(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = ($("char-name").value || "character") + ".json"; a.click();
  });
  $("file-import").addEventListener("change", e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { applyState(JSON.parse(reader.result)); saveState(); } catch (err) { alert("Bad JSON: " + err); } };
    reader.readAsText(file);
  });
  $("btn-reset").addEventListener("click", () => {
    if (confirm("Reset the whole sheet? This clears saved data.")) { localStorage.removeItem("charsheet-v0"); location.reload(); }
  });

  // ----- Spell library wiring -----
  loadSpellLib(); loadFilters(); renderSpellLibrary();
  $("spell-import").addEventListener("change", e => { if (e.target.files.length) loadSpellFiles(e.target.files); e.target.value = ""; });
  $("spell-search").addEventListener("input", renderSpellResults);
  $("spell-filter-area").addEventListener("click", e => {
    const opt = e.target.closest("[data-fval]");
    if (opt) { cycleState(opt.dataset.fgroup, opt.dataset.fval); persistFilters(); renderFilterArea(); renderSpellResults(); return; }
    const ctrl = e.target.closest("[data-fctrl]");
    if (ctrl) { handleCtrl(ctrl.dataset.fctrl, ctrl.dataset.fg); persistFilters(); renderFilterArea(); renderSpellResults(); return; }
    const id = e.target.id;
    if (id === "mod-combine") { moduleCombine = moduleCombine === "and" ? "or" : "and"; persistFilters(); renderFilterArea(); renderSpellResults(); }
    else if (id === "mod-showall") { SPELL_FGROUPS.forEach(g => filterState[g.key].hidden = false); persistFilters(); renderFilterArea(); }
    else if (id === "mod-hideall") { SPELL_FGROUPS.forEach(g => filterState[g.key].hidden = true); persistFilters(); renderFilterArea(); }
    else if (id === "mod-reset") { resetFilters(); renderFilterArea(); renderSpellResults(); }
    else if (id === "mod-savedefault") { saveFilterDefaults(); alert("Current filters saved as the default (Reset restores them)."); }
  });
  $("spell-results").addEventListener("click", e => {
    const b = e.target.closest(".sp-lib-add"); if (b) { addSpellFromLib(b.dataset.key); return; }
    const link = e.target.closest(".sp-name-link"); if (link) { e.preventDefault(); toggleSpellDetail(link); }
  });
  $("spell-lib-clear").addEventListener("click", () => {
    if (confirm("Clear the imported spell library? (does not affect your character)")) {
      SPELL_LIB = []; localStorage.removeItem("charsheet-spelllib");
      renderSpellLibrary();
    }
  });

  // Load saved state LAST and guarded — if it throws, start fresh but keep the sheet alive.
  try {
    const saved = loadState();
    if (saved) applyState(saved);
    else { addClassRow({ name: "", lvl: 1 }); initMathFields(); }
  } catch (err) {
    console.error("Load failed; starting fresh.", err);
    $("class-rows").innerHTML = ""; $("spell-rows").innerHTML = "";
    addClassRow({ name: "", lvl: 1 }); initMathFields();
  }

  recompute();
}
document.addEventListener("DOMContentLoaded", init);
