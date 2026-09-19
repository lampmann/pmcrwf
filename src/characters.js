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
  clearTimeout(rosterSaveTimer);
  rosterSaveTimer = null;
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
  if (ROSTER.chars.length === 1) { alert("This is your only character - add another before deleting this one."); return; }
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
  // applyState restores omitted fields and collections to their defaults, including scores of 10,
  // Medium size, and speed 30. Explicit empty strings would overwrite those defaults again.
  applyState({ v: 1, fields: {} });
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
  const header = el.firstElementChild ? el.firstElementChild.outerHTML : "<div>- event log -</div>";
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

  keepGroupContiguous(gid);

  persistRoster(); repaintEventLog(); renderCharacterTabs();
  logEvent("info", `<b>${escapeHtml(charDisplayName(moved))}</b> and <b>${escapeHtml(charDisplayName(target))}</b> now share an Event Log`);
}

/* Re-splice the roster so every member of `gid` sits together, at the position of whichever
   one of them comes first. A group that is not contiguous cannot be drawn as one thing —
   renderCharacterTabs boxes each contiguous run of one group id — so a group split across a
   non-member renders as two boxes claiming to be the same group. */
function keepGroupContiguous(gid) {
  if (!gid) return;
  const first = ROSTER.chars.findIndex(c => c.group === gid);
  if (first < 0) return;                     // dissolved, or never existed
  const members = ROSTER.chars.filter(c => c.group === gid);
  ROSTER.chars = ROSTER.chars.filter(c => c.group !== gid);
  ROSTER.chars.splice(first, 0, ...members);
}

/* Move ONE character in or out of a group, carrying its history with it.

   This is the membership half of a drag; moveCharacter below is the position half. Splitting
   them is what lets a drop say "this tab, here, in that group" as one gesture — which is the
   whole mechanism now that the ⛓ button is gone.

   Returns whether anything actually changed, so a no-op drag stays a no-op. */
function setCharacterGroup(id, gid) {
  const c = ROSTER.chars.find(x => x.id === id);
  if (!c) return false;
  const was = c.group || null;
  gid = gid || null;
  if (was === gid) return false;
  if (!ROSTER.logs) ROSTER.logs = {};

  // Leaving takes a COPY of the shared history: the entries are as much this character's as the
  // group's, and losing them to a mis-drag would be worse than duplicating them.
  if (was) ROSTER.logs[c.id] = (ROSTER.logs[was] || []).slice();
  c.group = gid;

  // Joining folds this character's own history into the group's, newest first, so the shared
  // stream still reads as one history rather than two stacked — same rule groupCharacters uses.
  if (gid) {
    const mine = ROSTER.logs[c.id] || [];
    ROSTER.logs[gid] = [...(ROSTER.logs[gid] || []), ...mine]
      .sort((a, b) => b.t - a.t).slice(0, LOG_CAP);
    delete ROSTER.logs[c.id];
  }

  /* A group of one isn't one — and the last member out takes the shared log with it, exactly as
     the leaver did.

     That second half is new, and it was a real hole. Dissolving used to clear `group` and stop,
     leaving the entries filed under a group id nothing pointed at any more: the character left
     holding the group was the one that lost the history, while the one who walked out kept a
     copy. Barely reachable before, when the only way out was a button that always ejected the
     FIRST member of a group. It is the everyday gesture now that any tab can leave by being
     dragged out, so it had to be closed. */
  if (was) {
    const left = groupMembers(was);
    if (left.length <= 1) {
      left.forEach(m => { ROSTER.logs[m.id] = (ROSTER.logs[was] || []).slice(); m.group = null; });
      delete ROSTER.logs[was];
    }
  }
  return true;
}

/* A character leaves its group and gets its own Event Log back. Still its own named operation
   even though nothing on screen calls it directly any more — dragging a tab out of the box is
   what invokes it, and "left the group" is worth one line in the log either way. */
function ungroupCharacter(id) {
  const c = ROSTER.chars.find(x => x.id === id); if (!c || !c.group) return;
  const was = c.group;
  if (!setCharacterGroup(id, null)) return;
  /* AND CLOSE THE HOLE BEHIND IT. A character taken out of the MIDDLE of a run leaves its
     old group split across it — same group, two runs, drawn as two boxes. Harmless when the
     leaver was at an end, or when the drag already moved it to a boundary, since the
     re-splice is then a no-op; essential when it left in place from the middle. */
  keepGroupContiguous(was);
  persistRoster(); repaintEventLog(); renderCharacterTabs();
  logEvent("info", `<b>${escapeHtml(charDisplayName(c))}</b> left the group and has its own Event Log again`);
}

/* Move `movedId` to sit before or after `dropId`.

   ONE TAB, NEVER A BLOCK. This used to move the mover's whole group, on the reasoning that a
   drag should not be able to silently split a group in two. Dragging a tab OUT is now the only
   way to leave a group, so that reasoning inverts: moving the block would make the one gesture
   that has to move a single tab the one gesture that cannot.

   ANCHORED ON THE TAB YOU DROPPED ON, and computed against `rest` — the bar with the moved tab
   already taken out — so the insertion index is found in the list the tab is going back into and
   cannot be thrown off by the tab's own position. The previous version took a null anchor to
   mean "the end", and derived the anchor for an "after" drop as *the tab following the target*,
   which past the last tab is nothing: dropping onto the last tab's right edge silently became
   "move to the end", and could land on the moved tab itself. */
function moveCharacter(movedId, dropId, intent) {
  const moved = ROSTER.chars.find(c => c.id === movedId);
  if (!moved || movedId === dropId) return false;
  const rest = ROSTER.chars.filter(c => c !== moved);
  const i = rest.findIndex(c => c.id === dropId);
  if (i < 0) return false;
  rest.splice(intent === "before" ? i : i + 1, 0, moved);
  ROSTER.chars = rest;
  return true;
}

/* ----- tab bar ----- */
function charTabHtml(c) {
  const active = c.id === ROSTER.activeId;
  const lvl = totalLevelOfState(c);
  return `<button type="button" class="char-tab${active ? " active" : ""}" data-charid="${c.id}" draggable="true"
    aria-current="${active}">${escapeHtml(charDisplayName(c))}${lvl ? ` <span class="hint">lv ${lvl}</span>` : ""}` +
    (ROSTER.chars.length > 1 ? `<span class="char-tab-x" data-delid="${c.id}" aria-label="delete this character">×</span>` : "") +
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
    /* `data-group` is what the drop handler reads to answer "which box is the cursor in", which
       is the whole basis of joining and leaving now — see groupBoxAt. */
    html += `<span class="char-group" data-group="${c.group}" ` +
      `role="group" aria-label="Shared event log">` +
      run.map(charTabHtml).join("") + `</span>`;
  }
  el.innerHTML = html + `<button type="button" id="char-tab-add" aria-label="create a new character">+ New character</button>`;
}

/* Level shown on a tab. The active character's classes live in the DOM (they may be mid-edit and not
   yet saved), so read those live; everyone else's come from their stored state. */
function totalLevelOfState(c) {
  if (c.id === ROSTER.activeId) return totalLevel();
  const classes = (c.state && c.state.classes) || [];
  return classes.reduce((s, x) => s + (Number(x.lvl) || 0), 0);
}

/* ----- drag to reorder, drop onto a tab to group, drag out of the box to leave -----

   One gesture, two outcomes, decided by where in the target tab you let go: the middle means "put
   these together", the edges mean "put this here". Both are shown live while dragging (a ring for
   grouping, a bar for the insertion point) because a drag with two possible meanings and no feedback
   is a guess.

   WHERE A TAB LANDS IS WHAT DECIDES ITS GROUP. Drop it inside a group's box and it is in that
   group; drop it outside every box and it is in none. That one rule replaces the ⛓ button that
   used to be the only way out of a group, and it is deliberately the BOX that decides rather than
   an index calculation: the dashed rectangle is the thing on screen, so it should be the thing you
   aim at. It also settles a question an index cannot — dropping level with the last tab in a group
   but past its right edge is *inside* the box, because that is where the box is drawn.

   The rule runs both ways on purpose. It has to: a tab dropped between two members of a group but
   not joining it would render as two boxes for one group, since renderCharacterTabs draws a box
   per contiguous run of one group id. "Inside the box means in the group" is the only reading that
   cannot produce that. */
let TAB_DRAG_ID = null;

function tabDropIntent(tab, clientX) {
  const r = tab.getBoundingClientRect();
  const rel = (clientX - r.left) / r.width;
  if (rel < 0.28) return "before";
  if (rel > 0.72) return "after";
  return "group";
}

/* Which group's box the cursor is inside, or null for none — "outside the group", literally. */
function groupBoxAt(x, y) {
  const box = [...document.querySelectorAll("#char-tabs .char-group")].find(b => {
    const r = b.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
  return box ? box.dataset.group : null;
}

/* What the cursor is over, INCLUDING when it is over nothing.

   The bar is a flex row with a gap between tabs and a box that adds padding of its own, so there
   is a real band of pixels where the cursor is over the container and not over any tab — and it
   is the most natural place to aim when dropping BETWEEN two tabs. That used to resolve to "no
   target" and fall through to a move-to-the-end path. It matters more now than it did: the band
   inside a box, where the ⛓ button used to sit, is exactly where someone will aim to drop a tab
   at the end of a group, and resolving it to "the end of the roster" would move the tab out from
   under the group id it was just given.

   So a miss resolves to the nearest tab by edge distance, and to the side of it the cursor is on.
   Grouping is unreachable from a gap, which is right: a gap means "put it here" unambiguously,
   and only the middle of a tab means "put it with this one". */
/* `ignoreId` is passed in rather than read off TAB_DRAG_ID, because the drop handler clears
   that before it resolves the target — reading the module state here would exclude nothing at
   exactly the moment it matters, and only the hover feedback would benefit. */
function dropTargetAt(e, ignoreId) {
  const el = e.target.closest && e.target.closest("[data-charid]");
  if (el) return { id: el.dataset.charid, intent: tabDropIntent(el, e.clientX) };

  /* THE DRAGGED TAB IS NOT A CANDIDATE. It stays in the bar at its old place while you drag
     it, so pulling the FIRST or LAST tab of a group out past its own end makes it the tab
     nearest the cursor — which resolves to "you dropped on yourself" and is discarded. That
     is why pulling an end tab out towards its own side did nothing, while hauling it across
     to the far side worked: some other tab was then nearest. */
  const tabs = [...document.querySelectorAll("#char-tabs .char-tab")]
    .filter(t => t.dataset.charid !== ignoreId);
  if (!tabs.length) return null;
  let best = null, bestDist = Infinity;
  tabs.forEach(t => {
    const r = t.getBoundingClientRect();
    // 0 while inside the tab; otherwise how far outside either edge the cursor is.
    const d = e.clientX < r.left ? r.left - e.clientX
      : e.clientX > r.right ? e.clientX - r.right : 0;
    if (d < bestDist) { bestDist = d; best = { el: t, r }; }
  });
  if (!best) return null;
  const mid = best.r.left + best.r.width / 2;
  return { id: best.el.dataset.charid, intent: e.clientX < mid ? "before" : "after" };
}

function clearTabDropMarks() {
  document.querySelectorAll(".char-tab").forEach(t => t.classList.remove("drop-group", "drop-before", "drop-after"));
  document.querySelectorAll(".char-group").forEach(g => g.classList.remove("losing"));
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
  /* The mark is drawn from the SAME resolution the drop uses, so what you see is what you get,
     gaps included. The extra mark is on the BOX: while a grouped tab is being dragged somewhere
     that would take it out, its group is outlined as losing a member — the one piece of feedback
     the ⛓ button used to provide for free by being a visible control. */
  /* Marks the box a drop would take a character out of. Leaving has no button, so the box
     has to say so before the release rather than after. */
  function markLosing(id) {
    const dragged = ROSTER.chars.find(c => c.id === id);
    const from = dragged && dragged.group;
    if (!from) return;
    const box = el.querySelector(`.char-group[data-group="${CSS.escape(from)}"]`);
    if (box) box.classList.add("losing");
  }

  /* ON THE DOCUMENT, NOT THE BAR.

     Leaving a group means dropping outside every box, and vertically there was nowhere to
     do it: #char-tabs is padded `.25rem .5rem 0`, so its bottom edge IS the box's bottom
     edge — a band of exactly zero pixels. Dragging a tab straight down, which is what
     anyone does when they mean "get this out", missed the bar entirely at every depth and
     no drop handler ever ran.

     Listening on the document makes the rest of the page the way out. The rule is one
     sentence — on the bar you are rearranging or regrouping, anywhere else you are leaving
     — and the target is the size of the window rather than a sliver. Both handlers return
     immediately unless a tab drag is in progress, so nothing else on the page is affected. */
  const overStrip = e => {
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right
        && e.clientY >= r.top && e.clientY <= r.bottom;
  };

  document.addEventListener("dragover", e => {
    if (!TAB_DRAG_ID) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    clearTabDropMarks();

    if (!overStrip(e)) { markLosing(TAB_DRAG_ID); return; }

    const hit = dropTargetAt(e, TAB_DRAG_ID);
    if (!hit || hit.id === TAB_DRAG_ID) return;
    const tab = el.querySelector(`.char-tab[data-charid="${CSS.escape(hit.id)}"]`);
    if (!tab) return;
    tab.classList.add(hit.intent === "group" ? "drop-group"
      : hit.intent === "before" ? "drop-before" : "drop-after");

    const dragged = ROSTER.chars.find(c => c.id === TAB_DRAG_ID);
    const from = dragged && dragged.group;
    if (from && hit.intent !== "group" && groupBoxAt(e.clientX, e.clientY) !== from) markLosing(TAB_DRAG_ID);
  });
  document.addEventListener("drop", e => {
    if (!TAB_DRAG_ID) return;
    e.preventDefault();
    const moved = TAB_DRAG_ID;
    TAB_DRAG_ID = null;

    /* Dropped off the bar: leave the group, and stay where you are in the order. There is
       no sensible position to read out of a point nowhere near the bar, and the gesture was
       never about position — it was about getting out. ungroupCharacter re-splices the group
       left behind, so leaving from the middle of a run does not split it in two. */
    if (!overStrip(e)) { clearTabDropMarks(); ungroupCharacter(moved); return; }

    const hit = dropTargetAt(e, moved);
    /* Read the box under the cursor BEFORE anything re-renders the bar — after that the
       rectangles these coordinates were measured against no longer exist. */
    const landing = hit && hit.intent !== "group" ? groupBoxAt(e.clientX, e.clientY) : null;
    clearTabDropMarks();
    if (!hit || hit.id === moved) return;

    // The middle of a tab still means "group these", and still brings the mover's group along.
    if (hit.intent === "group") { groupCharacters(moved, hit.id); return; }

    const before = ROSTER.chars.find(c => c.id === moved);
    const was = (before && before.group) || null;
    const placed = moveCharacter(moved, hit.id, hit.intent);

    /* ungroupCharacter for a departure, because leaving is worth a line in the log; a plain
       setCharacterGroup for a join or a stay, which either already announced itself or is not an
       event at all. Membership is applied after the move so the group is judged on where the tab
       actually ended up. */
    let regrouped = false;
    if (landing !== was) {
      if (landing) regrouped = setCharacterGroup(moved, landing);
      else { ungroupCharacter(moved); return; }                  // repaints and persists itself
    }
    if (!placed && !regrouped) return;                           // a drag that changed nothing
    persistRoster();
    if (regrouped) repaintEventLog();
    renderCharacterTabs();
  });
});
