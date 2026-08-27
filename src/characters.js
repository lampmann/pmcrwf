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

let ROSTER = { v: 1, activeId: null, chars: [], logs: {} };

function newCharId() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* The tab label. A character's name lives inside its own state (the char-name field), so the roster
   copy is only a cache for rendering tabs without deserialising every character — refreshed from the
   live sheet on every save (see saveState). */
function charDisplayName(c) {
  return (c && c.name || "").trim() || "unnamed";
}

function activeChar() { return ROSTER.chars.find(c => c.id === ROSTER.activeId) || null; }

/* Returns whether the write actually landed. Callers must not report "saved" on a false — the save
   status used to say "saved <time>" unconditionally while a quota failure was being swallowed here,
   which told the user their work was safe at exactly the moment it stopped being. */
function persistRoster() {
  try { localStorage.setItem(ROSTER_KEY, JSON.stringify(ROSTER)); return true; }
  catch (e) { console.warn("Roster too large for localStorage; kept in memory for this session only.", e); return false; }
}

/* Load the roster, migrating a pre-roster character in on first run. Returns the state to apply, or
   null for a genuinely fresh install (in which case app.js leaves its default empty sheet alone). */
function loadRoster() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ROSTER_KEY)); } catch (e) {}
  if (stored && Array.isArray(stored.chars) && stored.chars.length) {
    ROSTER = { v: 1, activeId: stored.activeId, chars: stored.chars, logs: stored.logs || {} };
    if (!activeChar()) ROSTER.activeId = ROSTER.chars[0].id;   // stale/missing active id
    return activeChar().state;
  }

  // No roster yet. Adopt the pre-roster character if there is one.
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(LEGACY_CHAR_KEY)); } catch (e) {}
  if (legacy) {
    const id = newCharId();
    ROSTER = { v: 1, activeId: id, chars: [{ id, name: nameFromState(legacy), state: legacy }], logs: {} };
    persistRoster();
    return legacy;
  }

  // Genuinely fresh install. Seed one empty entry so the very first save has somewhere to go —
  // returning null tells app.js to leave the markup's own blank sheet as-is rather than apply state.
  const id = newCharId();
  ROSTER = { v: 1, activeId: id, chars: [{ id, name: "unnamed", state: null }], logs: {} };
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
  const fromKey = logKeyFor(activeChar());
  ROSTER.activeId = id;
  persistRoster();
  applyState(target.state);
  // The log follows the character (or its group — see logKeyFor). Repainting only when the key
  // actually changes is what makes a group feel like one shared log rather than several copies.
  if (logKeyFor(target) !== fromKey) repaintEventLog();
  renderCharacterTabs();
  /* Only worth logging when the log is shared: in a group the entry tells the other characters who
     is acting now, which is the point. On a solo character the log is that character's own, so
     "Switched to Alice" in Alice's log says nothing you can't see from the tab bar. */
  if (target.group) logEvent("info", `Switched to <b>${escapeHtml(charDisplayName(target))}</b>`);
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
  /* Drop the log with the character, or it sits in localStorage forever with no tab to reach it —
     up to LOG_CAP entries per deleted character, which is exactly the growth that pushes a roster
     into a quota failure. Only its OWN log: a grouped character's log key belongs to the group and
     the remaining members are still using it. */
  if (ROSTER.logs && !c.group) delete ROSTER.logs[c.id];
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
  /* Every persisted field has to be named explicitly. applyState() only writes the fields its state
     object mentions, so an EMPTY `fields` map leaves the previous character's name, race, scores and
     everything else sitting on screen — which made "+ New character" (with no wizard) look like it
     had cloned whoever you were just looking at. */
  const fields = {};
  document.querySelectorAll("[data-persist]").forEach(el => { fields[el.id] = el.type === "checkbox" ? false : ""; });
  applyState({ v: 1, fields, classes: [{ name: "", sub: "", lvl: 1 }], spells: [], items: [],
    attacks: [], routines: [], featChoices: {}, asiChoices: {}, usesState: {}, hdState: {},
    // An empty skillOrder means alphabetical: a new character shouldn't inherit the row order of
    // whoever happened to be on screen when you pressed "+", any more than it inherits their name.
    skillOrder: [],
    effectChoices: {}, effectToggles: {}, proficiencies: { weapons: [], tools: [], languages: [] } });
}

/* ============================================================
   GROUPS AND THE SHARED EVENT LOG

   Drag a tab onto another and they form a group. The case this is for is a
   character and the things they command — a wizard and their familiar, a
   druid and a summon, a party the same person is running — where what
   matters is that everything they did happened in ONE order. So a group
   shares an Event Log: roll on the familiar's sheet and it lands in the same
   stream as the wizard's attack, because that's how the turn actually went.

   Storage: each character carries an optional `group` id, and ROSTER.logs is
   keyed by group id where there is one and by character id where there
   isn't — so an ungrouped character keeps its own log without a special
   case, and grouping is just two characters agreeing on a key.

   Entries carry a timestamp. That's what makes merging two logs on grouping
   possible at all: without one there'd be no way to interleave them, and
   concatenating would claim an order that never happened.
   ============================================================ */
const LOG_CAP = 300;        // per log; enough to cover a session, bounded so localStorage can't run away

function logKeyFor(c) { return c ? (c.group || c.id) : ""; }
function activeLogKey() { return logKeyFor(activeChar()); }
function newGroupId() { return "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function groupMembers(gid) { return ROSTER.chars.filter(c => c.group === gid); }

/* Record an entry against the active log. Called by logEvent (event-log.js) after it paints, so the
   DOM stays the single source of what you're looking at and this is only the persistence side. */
function recordLogEntry(kind, html) {
  const key = activeLogKey(); if (!key) return;
  if (!ROSTER.logs) ROSTER.logs = {};
  const list = ROSTER.logs[key] || (ROSTER.logs[key] = []);
  list.unshift({ t: Date.now(), kind, html });
  if (list.length > LOG_CAP) list.length = LOG_CAP;
  persistRosterSoon();
}

/* Redraw #dicelog from the stored entries for whichever log is now active. */
function repaintEventLog() {
  const el = $("dicelog"); if (!el) return;
  const entries = (ROSTER.logs && ROSTER.logs[activeLogKey()]) || [];
  const header = el.firstElementChild ? el.firstElementChild.outerHTML : "<div>— event log —</div>";
  el.innerHTML = header + entries.map(e => `<div class="ev ev-${e.kind}">${e.html}</div>`).join("");
  if (typeof repaintRollMirror === "function") repaintRollMirror();
}

/* Persisting the whole roster on every die roll would serialise every character's full state each
   time; a short debounce collapses a burst of rolls into one write. */
let rosterSaveTimer = null;
function persistRosterSoon() {
  clearTimeout(rosterSaveTimer);
  rosterSaveTimer = setTimeout(persistRoster, 400);
}

/* Put `moved` into `target`'s group, creating one if neither has it, and merge their logs in
   timestamp order so the combined stream reads as one history rather than two stacked. */
function groupCharacters(movedId, targetId) {
  const moved = ROSTER.chars.find(c => c.id === movedId);
  const target = ROSTER.chars.find(c => c.id === targetId);
  if (!moved || !target || moved === target) return;
  if (moved.group && moved.group === target.group) return;

  const gid = target.group || moved.group || newGroupId();
  const keys = [...new Set([logKeyFor(moved), logKeyFor(target), gid])];
  if (!ROSTER.logs) ROSTER.logs = {};
  const merged = keys.flatMap(k => ROSTER.logs[k] || []).sort((a, b) => b.t - a.t).slice(0, LOG_CAP);
  keys.forEach(k => { if (k !== gid) delete ROSTER.logs[k]; });

  // Everything already in the moved character's group comes along — dragging a tab moves its group,
  // not just the one tab, which is the only reading that doesn't silently split a group in two.
  const movers = moved.group ? groupMembers(moved.group) : [moved];
  movers.forEach(c => { c.group = gid; });
  target.group = gid;
  ROSTER.logs[gid] = merged;

  // Keep a group contiguous on the bar, so it reads as one thing.
  const first = ROSTER.chars.findIndex(c => c.group === gid);
  const members = ROSTER.chars.filter(c => c.group === gid);
  ROSTER.chars = ROSTER.chars.filter(c => c.group !== gid);
  ROSTER.chars.splice(first, 0, ...members);

  persistRoster(); repaintEventLog(); renderCharacterTabs();
  logEvent("info", `<b>${escapeHtml(charDisplayName(moved))}</b> and <b>${escapeHtml(charDisplayName(target))}</b> now share an Event Log`);
}

function ungroupCharacter(id) {
  const c = ROSTER.chars.find(x => x.id === id); if (!c || !c.group) return;
  const gid = c.group;
  // The character leaving takes a copy of the shared log, since the entries are as much theirs as
  // the group's — losing their history to a mis-drag would be worse than duplicating it.
  if (!ROSTER.logs) ROSTER.logs = {};
  ROSTER.logs[c.id] = (ROSTER.logs[gid] || []).slice();
  c.group = null;
  if (groupMembers(gid).length <= 1) groupMembers(gid).forEach(m => { m.group = null; });   // a group of one isn't one
  persistRoster(); repaintEventLog(); renderCharacterTabs();
  logEvent("info", `<b>${escapeHtml(charDisplayName(c))}</b> left the group and has its own Event Log again`);
}

/* Reorder: move `movedId` to sit before `targetId` (or to the end when target is null). */
function reorderCharacter(movedId, targetId) {
  const from = ROSTER.chars.findIndex(c => c.id === movedId);
  if (from < 0) return;
  const moved = ROSTER.chars[from];
  const block = moved.group ? groupMembers(moved.group) : [moved];   // a group moves as a unit
  const rest = ROSTER.chars.filter(c => !block.includes(c));
  let at = targetId ? rest.findIndex(c => c.id === targetId) : rest.length;
  if (at < 0) at = rest.length;
  rest.splice(at, 0, ...block);
  ROSTER.chars = rest;
  persistRoster(); renderCharacterTabs();
}

/* ----- tab bar ----- */
function charTabHtml(c) {
  const active = c.id === ROSTER.activeId;
  const lvl = totalLevelOfState(c);
  return `<button type="button" class="char-tab${active ? " active" : ""}" data-charid="${c.id}" draggable="true"
    title="${active ? "current character — click to rename" : "switch to this character"}${ROSTER.chars.length > 1 ? " · drag onto another tab to share an Event Log" : ""}">${escapeHtml(charDisplayName(c))}${lvl ? ` <span class="hint">lv ${lvl}</span>` : ""}` +
    (ROSTER.chars.length > 1 ? `<span class="char-tab-x" data-delid="${c.id}" title="delete this character">×</span>` : "") +
    `</button>`;
}

function renderCharacterTabs() {
  const el = $("char-tabs"); if (!el) return;
  // Walk in roster order, wrapping each contiguous run of same-group tabs in one box.
  let html = "", i = 0;
  while (i < ROSTER.chars.length) {
    const c = ROSTER.chars[i];
    if (!c.group) { html += charTabHtml(c); i++; continue; }
    const run = [];
    while (i < ROSTER.chars.length && ROSTER.chars[i].group === c.group) run.push(ROSTER.chars[i++]);
    html += `<span class="char-group" title="these characters share one Event Log">` +
      run.map(charTabHtml).join("") +
      `<button type="button" class="char-group-x" data-ungroup="${run[0].id}" title="split this group up (each character gets its own Event Log again)">⛓</button></span>`;
  }
  el.innerHTML = html + `<button type="button" id="char-tab-add" title="create a new character">+ New character</button>`;
}

/* Level shown on a tab. The active character's classes live in the DOM (they may be mid-edit and not
   yet saved), so read those live; everyone else's come from their stored state. */
function totalLevelOfState(c) {
  if (c.id === ROSTER.activeId) return totalLevel();
  const classes = (c.state && c.state.classes) || [];
  return classes.reduce((s, x) => s + (Number(x.lvl) || 0), 0);
}

/* ----- drag to reorder, drop onto a tab to group -----
   One gesture, two outcomes, decided by where in the target tab you let go: the middle means "put
   these together", the edges mean "put this here". Both are shown live while dragging (a ring for
   grouping, a bar for the insertion point) because a drag with two possible meanings and no feedback
   is a guess. */
let TAB_DRAG_ID = null;

function tabDropIntent(tab, clientX) {
  const r = tab.getBoundingClientRect();
  const rel = (clientX - r.left) / r.width;
  if (rel < 0.28) return "before";
  if (rel > 0.72) return "after";
  return "group";
}
function clearTabDropMarks() {
  document.querySelectorAll(".char-tab").forEach(t => t.classList.remove("drop-group", "drop-before", "drop-after"));
}

document.addEventListener("DOMContentLoaded", () => {
  const el = $("char-tabs"); if (!el) return;
  el.addEventListener("click", e => {
    const ung = e.target.closest("[data-ungroup]");
    if (ung) { e.stopPropagation(); ungroupCharacter(ung.dataset.ungroup); return; }
    const del = e.target.closest("[data-delid]");
    if (del) { e.stopPropagation(); deleteCharacter(del.dataset.delid); return; }
    if (e.target.closest("#char-tab-add")) { openCreator(); return; }
    const tab = e.target.closest("[data-charid]");
    if (!tab) return;
    if (tab.dataset.charid === ROSTER.activeId) renameCharacter(tab.dataset.charid);
    else switchCharacter(tab.dataset.charid);
  });

  el.addEventListener("dragstart", e => {
    const tab = e.target.closest("[data-charid]"); if (!tab) return;
    TAB_DRAG_ID = tab.dataset.charid;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", TAB_DRAG_ID); } catch (err) {}   // Firefox needs a payload
    tab.classList.add("dragging");
  });
  el.addEventListener("dragend", () => {
    TAB_DRAG_ID = null; clearTabDropMarks();
    document.querySelectorAll(".char-tab.dragging").forEach(t => t.classList.remove("dragging"));
  });
  el.addEventListener("dragover", e => {
    if (!TAB_DRAG_ID) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    clearTabDropMarks();
    const tab = e.target.closest("[data-charid]");
    if (!tab || tab.dataset.charid === TAB_DRAG_ID) return;
    const intent = tabDropIntent(tab, e.clientX);
    tab.classList.add(intent === "group" ? "drop-group" : intent === "before" ? "drop-before" : "drop-after");
  });
  el.addEventListener("drop", e => {
    if (!TAB_DRAG_ID) return;
    e.preventDefault();
    const moved = TAB_DRAG_ID;
    TAB_DRAG_ID = null; clearTabDropMarks();
    const tab = e.target.closest("[data-charid]");
    if (!tab) { reorderCharacter(moved, null); return; }          // dropped past the last tab
    const targetId = tab.dataset.charid;
    if (targetId === moved) return;
    const intent = tabDropIntent(tab, e.clientX);
    if (intent === "group") { groupCharacters(moved, targetId); return; }
    if (intent === "before") { reorderCharacter(moved, targetId); return; }
    const idx = ROSTER.chars.findIndex(c => c.id === targetId);
    const after = ROSTER.chars[idx + 1];
    reorderCharacter(moved, after ? after.id : null);
  });
});
