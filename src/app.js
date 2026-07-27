/* ---------- data/ folder auto-load status ---------- */
function autoStatusText(res, what) {
  if (res.blocked) return "auto-load blocked — serve over http(s), not file:// (see DOCS)";
  if (!res.found) return `no data/ found for ${what} — see DOCS, or import manually below`;
  return `auto-loaded ${res.filesLoaded}/${res.filesTotal} file(s) from data/`;
}
function runSpellAutoLoad() {
  $("spell-lib-autostatus").textContent = "loading from data/ …";
  autoLoadSpells().then(res => { renderSpellLibrary(); $("spell-lib-autostatus").textContent = autoStatusText(res, "spells"); });
}
function runItemAutoLoad() {
  $("item-lib-autostatus").textContent = "loading from data/ …";
  autoLoadItems().then(res => { renderItemLibrary(); $("item-lib-autostatus").textContent = autoStatusText(res, "equipment"); });
}

/* ---------- Init / wiring ---------- */
function init() {
  buildAbilities(); buildSaves(); buildSkills(); buildSlots();

  // Race/Subrace search-as-you-type (mirrors the class/subclass typeahead in rows.js)
  const raceInput = $("char-race"), subraceInput = $("char-subrace");
  attachTypeahead(raceInput, () => Object.keys(RACE_LIB));
  attachTypeahead(subraceInput, () => {
    const rec = ciFindRace(raceInput.value);
    return rec ? Object.values(rec.subs).map(s => s.name) : [];
  });

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
  loadSpellLib(); SPELL_FILTERS.load(); renderSpellLibrary();
  $("spell-import").addEventListener("change", e => { if (e.target.files.length) loadSpellFiles(e.target.files); e.target.value = ""; });
  $("spell-search").addEventListener("input", renderSpellResults);
  $("spell-filter-area").addEventListener("click", e => SPELL_FILTERS.handleClick(e));
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
  $("spell-lib-reload").addEventListener("click", runSpellAutoLoad);
  runSpellAutoLoad();

  // Spell Library starts collapsed; the Spellcasting module's "+ Add Spell" opens it.
  $("spell-lib-toggle").addEventListener("click", () => {
    const open = $("spell-library-body").style.display === "none";
    $("spell-library-body").style.display = open ? "" : "none";
    $("spell-lib-collapsed-hint").style.display = open ? "none" : "";
    if (open) {
      refreshSpellAddClassSelect();
      $("spell-search").focus();
      $("spell-library-body").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  // ----- Equipment library wiring -----
  loadItemLib(); ITEM_FILTERS.load(); renderItemLibrary();
  $("item-import").addEventListener("change", e => { if (e.target.files.length) loadItemFiles(e.target.files); e.target.value = ""; });
  $("item-search").addEventListener("input", renderItemResults);
  $("item-filter-area").addEventListener("click", e => ITEM_FILTERS.handleClick(e));
  $("item-results").addEventListener("click", e => {
    const b = e.target.closest(".itm-lib-add"); if (b) { addItemFromLib(b.dataset.key); return; }
    const link = e.target.closest(".itm-name-link"); if (link) { e.preventDefault(); toggleItemDetail(link); }
  });
  $("item-lib-clear").addEventListener("click", () => {
    if (confirm("Clear the imported equipment library? (does not affect your character)")) {
      ITEM_LIB = []; localStorage.removeItem("charsheet-itemlib");
      renderItemLibrary();
    }
  });
  $("item-lib-reload").addEventListener("click", runItemAutoLoad);
  runItemAutoLoad();

  // Equipment Library starts collapsed; the Items fieldset's "+ Add Item" opens it (mirrors "+ Add Spell").
  $("item-lib-toggle").addEventListener("click", () => {
    const open = $("item-library-body").style.display === "none";
    $("item-library-body").style.display = open ? "" : "none";
    $("item-lib-collapsed-hint").style.display = open ? "none" : "";
    if (open) {
      $("item-search").focus();
      $("item-library-body").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  // Load saved state LAST and guarded — if it throws, start fresh but keep the sheet alive.
  try {
    const saved = loadState();
    if (saved) applyState(saved);
    else { addClassRow({ name: "", lvl: 1 }); initMathFields(); }
  } catch (err) {
    console.error("Load failed; starting fresh.", err);
    $("class-rows").innerHTML = ""; CHARACTER_SPELLS = []; CHARACTER_ITEMS = [];
    addClassRow({ name: "", lvl: 1 }); initMathFields();
  }

  recompute();
}
document.addEventListener("DOMContentLoaded", init);
