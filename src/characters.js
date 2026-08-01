/* ============================================================
   CHARACTER ROSTER — several characters in one sheet, one tab each.

   Storage layout. A character's state is exactly what collectState() has
   always produced (persistence.js), so nothing about a single character's
   shape changes here; the roster just holds several of them:

     charsheet-roster : { v: 1, activeId, chars: [{ id, name, state }] }
     charsheet-v0     : the pre-roster single character — READ ONCE and
                        migrated in, then left untouched on disk.

   The old key is deliberately NOT deleted. It costs a few KB and it is the
   only copy of a character that existed before this feature; if anything
   about the migration is wrong, the user's original is still sitting there
   to recover by hand. Migration is also idempotent — it only runs when no
   roster exists at all, so a later save can't resurrect a stale copy.

   Saving is whole-roster (one JSON blob) rather than a key per character:
   collectState() already serialises a whole character in one go, rosters
   are a handful of entries, and one key keeps switching atomic — there's no
   window where the active id points at a character that hasn't been written.
   ============================================================ */
const ROSTER_KEY = "charsheet-roster";
const LEGACY_CHAR_KEY = "charsheet-v0";   // pre-roster single-character slot; read once, never written

let ROSTER = { v: 1, activeId: null, chars: [] };

function newCharId() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* The tab label. A character's name lives inside its own state (the char-name field), so the roster
   copy is only a cache for rendering tabs without deserialising every character — refreshed from the
   live sheet on every save (see saveState). */
function charDisplayName(c) {
  return (c && c.name || "").trim() || "unnamed";
}

function activeChar() { return ROSTER.chars.find(c => c.id === ROSTER.activeId) || null; }

function persistRoster() {
  try { localStorage.setItem(ROSTER_KEY, JSON.stringify(ROSTER)); }
  catch (e) { console.warn("Roster too large for localStorage; kept in memory for this session only.", e); }
}

/* Load the roster, migrating a pre-roster character in on first run. Returns the state to apply, or
   null for a genuinely fresh install (in which case app.js leaves its default empty sheet alone). */
function loadRoster() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ROSTER_KEY)); } catch (e) {}
  if (stored && Array.isArray(stored.chars) && stored.chars.length) {
    ROSTER = { v: 1, activeId: stored.activeId, chars: stored.chars };
    if (!activeChar()) ROSTER.activeId = ROSTER.chars[0].id;   // stale/missing active id
    return activeChar().state;
  }

  // No roster yet. Adopt the pre-roster character if there is one.
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(LEGACY_CHAR_KEY)); } catch (e) {}
  if (legacy) {
    const id = newCharId();
    ROSTER = { v: 1, activeId: id, chars: [{ id, name: nameFromState(legacy), state: legacy }] };
    persistRoster();
    return legacy;
  }

  // Genuinely fresh install. Seed one empty entry so the very first save has somewhere to go —
  // returning null tells app.js to leave the markup's own blank sheet as-is rather than apply state.
  const id = newCharId();
  ROSTER = { v: 1, activeId: id, chars: [{ id, name: "unnamed", state: null }] };
  persistRoster();
  return null;
}

function nameFromState(state) {
  return ((state && state.fields && state.fields["char-name"]) || "").trim() || "unnamed";
}

/* ----- switching -----
   Committing the visible sheet before swapping is the whole safety story: applyState() overwrites
   every field, so anything not already captured into the active roster entry would be lost. */
function switchCharacter(id) {
  if (id === ROSTER.activeId) return;
  const target = ROSTER.chars.find(c => c.id === id); if (!target) return;
  saveState();                       // flush the sheet as it stands into the active entry
  ROSTER.activeId = id;
  persistRoster();
  applyState(target.state);
  renderCharacterTabs();
  logEvent("info", `Switched to <b>${escapeHtml(charDisplayName(target))}</b>`);
}

/* Adds a character built from an already-assembled state object (the creation wizard hands one over)
   and switches to it. Passing nothing gives a blank sheet, which is what "+" does if the wizard is
   unavailable for any reason. */
function addCharacter(state, name) {
  saveState();                       // don't lose the character currently on screen
  const id = newCharId();
  const entry = { id, name: (name || nameFromState(state) || "unnamed"), state: state || null };
  ROSTER.chars.push(entry);
  ROSTER.activeId = id;
  persistRoster();
  if (state) applyState(state); else resetSheetToBlank();
  saveState();                       // capture the new character's starting state immediately
  renderCharacterTabs();
  logEvent("info", `Created <b>${escapeHtml(charDisplayName(entry))}</b>`);
  return id;
}

function renameCharacter(id) {
  const c = ROSTER.chars.find(x => x.id === id); if (!c) return;
  const next = prompt("Character name:", charDisplayName(c));
  if (next == null) return;
  c.name = next.trim() || "unnamed";
  if (id === ROSTER.activeId) { $("char-name").value = c.name; recompute(); }
  persistRoster(); saveState(); renderCharacterTabs();
}

function deleteCharacter(id) {
  const c = ROSTER.chars.find(x => x.id === id); if (!c) return;
  if (ROSTER.chars.length === 1) { alert("This is your only character — add another before deleting this one."); return; }
  if (!confirm(`Delete "${charDisplayName(c)}"? This can't be undone.`)) return;
  const wasActive = id === ROSTER.activeId;
  const idx = ROSTER.chars.indexOf(c);
  ROSTER.chars.splice(idx, 1);
  if (wasActive) {
    ROSTER.activeId = ROSTER.chars[Math.max(0, idx - 1)].id;
    applyState(activeChar().state);
  }
  persistRoster(); renderCharacterTabs();
  logEvent("info", `Deleted <b>${escapeHtml(charDisplayName(c))}</b>`);
}

/* A blank sheet, without going through location.reload() — used by "+" when there's no wizard, and
   by Reset. Mirrors the markup's own initial state: one empty class row, everything else default. */
function resetSheetToBlank() {
  applyState({ v: 1, fields: {}, classes: [{ name: "", sub: "", lvl: 1 }], spells: [], items: [],
    attacks: [], routines: [], featChoices: {}, usesState: {}, hdState: {},
    effectChoices: {}, effectToggles: {}, proficiencies: { weapons: [], tools: [], languages: [] } });
}

/* ----- tab bar ----- */
function renderCharacterTabs() {
  const el = $("char-tabs"); if (!el) return;
  const tabs = ROSTER.chars.map(c => {
    const active = c.id === ROSTER.activeId;
    const lvl = totalLevelOfState(c);
    return `<button type="button" class="char-tab${active ? " active" : ""}" data-charid="${c.id}"
      title="${active ? "current character — click to rename" : "switch to this character"}">${escapeHtml(charDisplayName(c))}${lvl ? ` <span class="hint">lv ${lvl}</span>` : ""}` +
      (ROSTER.chars.length > 1 ? `<span class="char-tab-x" data-delid="${c.id}" title="delete this character">×</span>` : "") +
      `</button>`;
  }).join("");
  el.innerHTML = tabs + `<button type="button" id="char-tab-add" title="create a new character">+ New character</button>`;
}

/* Level shown on a tab. The active character's classes live in the DOM (they may be mid-edit and not
   yet saved), so read those live; everyone else's come from their stored state. */
function totalLevelOfState(c) {
  if (c.id === ROSTER.activeId) return totalLevel();
  const classes = (c.state && c.state.classes) || [];
  return classes.reduce((s, x) => s + (Number(x.lvl) || 0), 0);
}

document.addEventListener("DOMContentLoaded", () => {
  const el = $("char-tabs"); if (!el) return;
  el.addEventListener("click", e => {
    const del = e.target.closest("[data-delid]");
    if (del) { e.stopPropagation(); deleteCharacter(del.dataset.delid); return; }
    if (e.target.closest("#char-tab-add")) { openCreator(); return; }
    const tab = e.target.closest("[data-charid]");
    if (!tab) return;
    if (tab.dataset.charid === ROSTER.activeId) renameCharacter(tab.dataset.charid);
    else switchCharacter(tab.dataset.charid);
  });
});
