/* ---------- data/ folder auto-load status ---------- */
function autoStatusText(res, what) {
  if (res.blocked) return "auto-load blocked — serve over http(s), not file:// (see DOCS)";
  if (!res.found) return `no data/ found for ${what} — see DOCS, or import manually below`;
  return `auto-loaded ${res.filesLoaded}/${res.filesTotal} file(s) from data/`;
}
/* Both loaders report failure into their own status line. Without a .catch, a throw anywhere in the
   load or the render that follows it leaves "loading from data/ …" on screen for good, with nothing
   in the error bar either (errors.js listens for `error`, and a rejected promise is not one) — the
   silent failure the visible-error-surface rule exists to prevent.

   Both RETURN the promise. Nothing needed that while these only ran once at startup, but connecting
   a data/ folder mid-session re-runs every loader and waits for them (reloadAllLibraries in
   src/data-folder.js) — and a runner that returns undefined is awaited instantly, so the wait
   silently did nothing and the status line was still reading "loading …" when the caller believed
   it was finished. */
function runSpellAutoLoad() {
  $("spell-lib-autostatus").textContent = "loading from data/ …";
  return autoLoadSpells()
    .then(res => { renderSpellLibrary(); $("spell-lib-autostatus").textContent = autoStatusText(res, "spells"); })
    .catch(err => { console.error("Spell auto-load failed", err); $("spell-lib-autostatus").textContent = "auto-load failed: " + (err && err.message || err) + " — import manually below"; });
}
function runItemAutoLoad() {
  $("item-lib-autostatus").textContent = "loading from data/ …";
  return autoLoadItems()
    .then(res => { renderItemLibrary(); $("item-lib-autostatus").textContent = autoStatusText(res, "equipment"); })
    .catch(err => { console.error("Equipment auto-load failed", err); $("item-lib-autostatus").textContent = "auto-load failed: " + (err && err.message || err) + " — import manually below"; });
}

/* Containers whose inputs are not character data: the three import libraries (search boxes, filter
   controls, file pickers), the modal dialogs (which own their own draft state and commit it
   explicitly), and the dice command line. Anything typed inside these neither feeds a derived number
   nor belongs in a save, so it skips the sheet-wide recompute+autosave — see the listener below. */
const NON_SHEET_INPUTS = "#spell-library-body, #item-library-body, #mon-library-body, .modal-overlay, #cmd-input, #roll-mirror";

/* ---------- Init / wiring ---------- */
function init() {
  buildAbilities(); buildSaves(); buildSkills(); buildSlots();

  // Race/Subrace search-as-you-type (mirrors the class/subclass typeahead in rows.js)
  const raceInput = $("char-race"), subraceInput = $("char-subrace");
  // The third argument marks house-rule-banned options red in the dropdown (see house-rules.js);
  // subraces are checked against the same `race` list, since that's how a DM writes such a ban down.
  attachTypeahead(raceInput, () => Object.keys(RACE_LIB), () => ({ kind: "race", prefix: "" }));
  attachTypeahead(subraceInput, () => {
    const rec = ciFindRace(raceInput.value);
    return rec ? Object.values(rec.subs).map(s => s.name) : [];
  }, () => ({ kind: "race", prefix: "" }));
  raceInput.dataset.banKind = "race";
  subraceInput.dataset.banKind = "race";
  // Picking a race sets the Speed box to that race's walking speed — halflings and dwarves are 25,
  // not 30. Only while the box still holds what this last put there: type your own number and it
  // stops following the race (see syncRaceSpeed).
  [raceInput, subraceInput].forEach(el => el.addEventListener("change", () => {
    if (syncRaceSpeed()) { recompute(); scheduleSave(); }
  }));

  // Attach all listeners FIRST, so that even if loading a saved state fails,
  // the sheet stays fully interactive (this is the "nothing auto-calcs" failsafe).
  // live recompute + autosave on any input (math parsing happens on commit below)
  //
  // Scoped to fields that actually belong to the character. It used to fire on every keystroke
  // anywhere on the page, which meant typing one letter into the spell search box ran a full
  // recompute() (rebuilding the effects snapshot, repainting the spell list, re-totalling the
  // inventory) and then serialised the whole character to localStorage. Search boxes, filter
  // controls and the creator's own dialogs own their state and re-render themselves; none of them
  // feeds a derived number on the sheet.
  document.addEventListener("input", e => {
    if (e.target && e.target.closest && e.target.closest(NON_SHEET_INPUTS)) return;
    recompute(); scheduleSave();
  });

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
    reader.onerror = () => alert("Could not read that file: " + (reader.error && reader.error.message || "unknown error"));
    reader.readAsText(file);
    e.target.value = "";   // so re-picking the SAME file fires `change` again (mirrors spell/item import)
  });
  /* Resets the character you're looking at, not the browser's storage. The old implementation removed
     the "charsheet-v0" key, which stopped being where characters live when the roster landed — so it
     reset nothing, and the one thing it did delete was the deliberately-preserved pre-roster backup
     (see the header comment in characters.js). Other characters on the tab bar are untouched. */
  $("btn-reset").addEventListener("click", () => {
    const who = ($("char-name").value || "").trim() || "this character";
    if (!confirm(`Reset ${who} to a blank sheet? This can't be undone. Your other characters are not affected.`)) return;
    if (typeof resetSheetToBlank === "function") resetSheetToBlank(); else location.reload();
    saveState();
    logEvent("info", `<b>${escapeHtml(who)}</b> was reset to a blank sheet`);
  });

  // ----- Spell library wiring -----
  loadSpellLib(); SPELL_FILTERS.load(); renderSpellLibrary();
  $("spell-import").addEventListener("change", e => { if (e.target.files.length) loadSpellFiles(e.target.files); e.target.value = ""; });
  $("spell-search").addEventListener("input", renderSpellResults);
  $("spell-filter-area").addEventListener("click", e => SPELL_FILTERS.handleClick(e));
  $("spell-filter-area").addEventListener("input", e => SPELL_FILTERS.handleInput(e));
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
  $("item-filter-area").addEventListener("input", e => ITEM_FILTERS.handleInput(e));
  $("item-results").addEventListener("click", e => {
    const b = e.target.closest(".itm-lib-add"); if (b) { addItemFromLib(b.dataset.key, b); return; }
    const pick = e.target.closest(".itm-group-pick"); if (pick) { addCharacterItem(pick.dataset.name); return; }
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

  // The roster is populated by loadState() above, so the tab bar and the stored Event Log can only
  // be drawn once that has run.
  if (typeof renderCharacterTabs === "function") renderCharacterTabs();
  if (typeof repaintEventLog === "function") repaintEventLog();

  recompute();
}
document.addEventListener("DOMContentLoaded", init);
