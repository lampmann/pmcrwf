/* ============================================================
   ROLL MIRROR — the tail of the Event Log, pinned to the corner.

   The Event Log is a module like any other, which means it can be anywhere
   in your layout — and once you have a few modules open it is usually a
   scroll away from the button you just clicked. That's fine for reading
   history and useless for the thing you actually want, which is seeing what
   the die did a second ago without leaving the roll you're in the middle of.

   So: a small fixed panel in the bottom-right that mirrors the newest
   entries. It is a MIRROR and nothing else — no state of its own, no second
   copy of the log to keep in step. Every entry it shows was put there by
   logEvent(), and switching characters repaints it from the same stored log
   the module reads. Deleting it would lose nothing but convenience.

   Fold rolls it up to its title bar; the × hides it entirely and leaves a
   small tab to bring it back. Both are per browser rather than per
   character — it's a preference about your screen, not a fact about your
   character, so it sits in its own localStorage key next to the theme.
   ============================================================ */

const MIRROR_MAX = 40;          // entries kept in the corner; the module itself keeps everything
const MIRROR_KEY = "charsheet-rollmirror";

let MIRROR = { folded: false, hidden: false };

function loadMirrorPrefs() {
  try {
    const d = JSON.parse(localStorage.getItem(MIRROR_KEY));
    if (d && typeof d === "object") MIRROR = { folded: !!d.folded, hidden: !!d.hidden };
  } catch (e) { /* a corrupt pref is not worth a broken sheet — keep the defaults */ }
}
function saveMirrorPrefs() {
  try { localStorage.setItem(MIRROR_KEY, JSON.stringify(MIRROR)); }
  catch (e) { console.warn("Could not save the roll mirror's state", e); }
}

function mirrorEl() { return document.getElementById("roll-mirror"); }
function mirrorBody() { return document.getElementById("roll-mirror-body"); }

/* Paints the frame (folded/hidden state, buttons). The entries themselves are added one at a time
   by mirrorLogEntry so a roll doesn't cost a full rebuild — see repaintRollMirror for the
   character-switch case, which does rebuild because the whole log has changed underneath it. */
function renderRollMirror() {
  const el = mirrorEl(); if (!el) return;
  el.classList.toggle("mirror-folded", MIRROR.folded);
  el.style.display = MIRROR.hidden ? "none" : "";
  const tab = document.getElementById("roll-mirror-tab");
  if (tab) tab.style.display = MIRROR.hidden ? "" : "none";
  const fold = document.getElementById("roll-mirror-fold");
  if (fold) {
    fold.textContent = MIRROR.folded ? "▲" : "▼";
    fold.title = MIRROR.folded ? "unfold the roll log" : "fold the roll log up";
  }
}

function toggleMirrorFold() { MIRROR.folded = !MIRROR.folded; saveMirrorPrefs(); renderRollMirror(); }
function hideRollMirror() { MIRROR.hidden = true; saveMirrorPrefs(); renderRollMirror(); }
function showRollMirror() { MIRROR.hidden = false; saveMirrorPrefs(); renderRollMirror(); }

/* One new entry, newest at the top, oldest trimmed off the bottom. Called from logEvent, so
   anything that reaches the Event Log reaches here — rolls, rests, HP changes, resource spends. */
function mirrorLogEntry(kind, html) {
  const body = mirrorBody(); if (!body) return;
  const d = document.createElement("div");
  d.className = "ev ev-" + kind;
  d.innerHTML = html;
  body.insertBefore(d, body.firstChild);
  while (body.children.length > MIRROR_MAX) body.removeChild(body.lastChild);
  // A roll arriving while the panel is hidden shouldn't silently vanish — that's exactly the moment
  // it's wanted. Folded is a deliberate "I know it's there", so that state is left alone.
  if (MIRROR.hidden) showRollMirror();
}

/* Rebuild from the active character's stored log — switching characters replaces the whole history,
   so appending is meaningless and the panel has to start again from what that character has. */
function repaintRollMirror() {
  const body = mirrorBody(); if (!body) return;
  const entries = (typeof ROSTER === "object" && ROSTER.logs && typeof activeLogKey === "function")
    ? (ROSTER.logs[activeLogKey()] || []) : [];
  body.innerHTML = entries.slice(0, MIRROR_MAX)
    .map(e => `<div class="ev ev-${e.kind}">${e.html}</div>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const el = mirrorEl(); if (!el) return;
  loadMirrorPrefs();
  repaintRollMirror();
  renderRollMirror();

  el.addEventListener("click", e => {
    if (e.target.id === "roll-mirror-fold") { toggleMirrorFold(); return; }
    if (e.target.id === "roll-mirror-close") { hideRollMirror(); return; }
  });
  const tab = document.getElementById("roll-mirror-tab");
  if (tab) tab.addEventListener("click", showRollMirror);
});
