/* ============================================================
   EVENT LOG — the running record of what has happened to this character,
   in order: dice rolls, rests, and anything else a mechanic wants to
   report. It began life as the dice roller's roll log, which is why the
   module still carries `data-module="dice"` in character-sheet.html —
   layout.js keys saved module positions off that attribute, so renaming
   it would silently orphan every saved arrangement. The heading is what
   changed, not the key.

   ---------------------------------------------------------------
   ADDING A NEW KIND OF EVENT — the whole API is one call:

       logEvent("rest", `<b>Short Rest</b> — 3 feature(s) recovered`);

   `kind` classes the entry (`ev ev-<kind>`) so themes can style event
   types apart and a future filter can hide categories; it never alters
   the text you pass. Pass HTML you have already escaped — same contract
   as the old log(), which is now just logEvent("roll", …) so every
   existing caller (dice.js, attacks.js, routines.js, status.js) keeps
   working unchanged and rolls keep rendering exactly as before.

   Register any new kind in EVENT_KINDS rather than passing an ad-hoc
   string: an unregistered kind still logs (never lose an event over a
   typo) but warns, so the roster of things this sheet can report stays
   greppable in one place.

   ---------------------------------------------------------------
   MECHANICS THAT SHOULD LOG HERE BUT DON'T YET. Each is a one-line
   logEvent() call at the point the state actually changes — deliberately
   not done here, since each belongs with its own feature, but this is
   the list a future pass should work through:

     - conditions applied/cleared, exhaustion level changes (status.js) —
       kind "condition"
     - concentration started, dropped, or broken (spellcasting.js) —
       kind "resource"; CONCENTRATING already tracks the spell
     - spell slots spent when a spell is actually cast (spellcasting.js)
       — kind "resource"; today slot-used-N is only ever typed by hand,
       so there's no cast event to hang it off yet
     - limited-use feature pips being spent (togglePip in
       class-library.js) — kind "resource"
     - death-save outcome transitions (status.js logs the d20 roll, but
       not "stabilised" / "died" when the third box fills) — kind "hp"
     - damage/healing typed straight into the HP boxes — kind "hp"; would
       need a change-watcher on hp-cur rather than a discrete action
     - XP gained (a plain persisted input, with no discrete "awarded"
       action to hang an event off) — kind "info". Level-up itself already
       logs, from levelUpConfirm() in creator.js.
   ============================================================ */
const EVENT_KINDS = new Set(["roll", "rest", "hp", "resource", "condition", "info"]);

function logEvent(kind, html) {
  if (!EVENT_KINDS.has(kind)) {
    console.warn(`logEvent: unregistered kind "${kind}" — add it to EVENT_KINDS in src/event-log.js`);
    kind = "info";
  }
  const el = $("dicelog"); if (!el) return;
  const d = document.createElement("div");
  d.className = "ev ev-" + kind;
  d.innerHTML = html;
  el.insertBefore(d, el.children[1] || null);   // newest first, under the sticky header row
  // Persist it against the active character's log (or its group's — see characters.js). The DOM
  // above stays the source of truth for what you're looking at; this is only what survives a switch.
  if (typeof recordLogEntry === "function") recordLogEntry(kind, html);
  // The corner panel is a mirror of this, so it's fed from the one place every entry passes through.
  if (typeof mirrorLogEntry === "function") mirrorLogEntry(kind, html);
}

/* Back-compat shorthand for the overwhelmingly common case. Every pre-existing caller logs a die
   roll, so log() keeps meaning exactly that and their output is byte-identical to before. */
function log(html) { logEvent("roll", html); }

/* Clearing empties the stored log too, not just the panel — otherwise the entries would come
   straight back on the next character switch. */
function clearLog() {
  $("dicelog").innerHTML = "<div>— event log —</div>";
  if (typeof ROSTER === "object" && ROSTER.logs && typeof activeLogKey === "function") {
    delete ROSTER.logs[activeLogKey()];
    persistRoster();
  }
  // After the delete, not before: the mirror rebuilds from the stored log, so repainting first
  // would faithfully restore everything this function just cleared off the screen.
  if (typeof repaintRollMirror === "function") repaintRollMirror();
}
