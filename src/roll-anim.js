/* ============================================================
   TUMBLING DICE — the brief flash a new roll gets before it settles.

   Every die face the roller renders is its own element carrying the die it
   came off (`data-sides`), the number it settled on (`data-final`) and which
   term of the expression it belongs to (`data-term`); the total is an element
   carrying its own final value and how much each term moves it
   (`data-coeffs`). See evalDice/totalHtml in dice.js.

   That is all this file needs. It flashes each face through other faces OF
   THE SAME DIE, recomputes the total from what is currently showing, and then
   puts everything back to what was actually rolled.

   THREE THINGS IT DELIBERATELY DOESN'T TOUCH:

     - Modifiers and signs. "+5" is not a die and never flickers; watching a
       fixed number jitter would read as the sheet being unsure of it.
     - Which dice were dropped. Advantage keeps the higher of two, and that
       was decided by the roll that already happened — re-picking mid-flash
       would show a kept die being discarded, which never occurred.
     - The result itself. The numbers shown during the flash are theatre; the
       ones it lands on are the roll, and they were rolled before the first
       frame drew. Nothing here can change an outcome.

   The total during the flash is COMPUTED, not faked: each term's coefficient
   was measured at roll time (bump the term by one, see what the total does),
   so "10-1d6" counts down as the die tumbles and "2*1d6" moves in twos.

   It runs on every new log entry, which means every path that rolls dice gets
   it — the command line, roll buttons, attacks, companions, routines, rests,
   death saves — without any of them knowing this file exists.
   ============================================================ */

const ROLL_ANIM_FRAMES = 7;      // flashes before it settles
const ROLL_ANIM_MS = 38;         // between flashes — ~270ms total, long enough to catch, short
                                 // enough that a Fireball's eight dice don't hold up the table
const ROLL_ANIM_KEY = "charsheet-rollanim";

let ROLL_ANIM_ON = true;
function loadRollAnimPref() {
  try { const v = localStorage.getItem(ROLL_ANIM_KEY); if (v != null) ROLL_ANIM_ON = v !== "off"; }
  catch (e) { /* a corrupt pref isn't worth a broken sheet */ }
}
function setRollAnim(on) {
  ROLL_ANIM_ON = !!on;
  try { localStorage.setItem(ROLL_ANIM_KEY, on ? "on" : "off"); } catch (e) {}
}

/* Someone who has asked their OS not to animate things means it. */
function rollAnimAllowed() {
  if (!ROLL_ANIM_ON) return false;
  try { return !window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return true; }
}

/* The running total for a set of currently-showing faces. Starts from the value actually rolled and
   moves it by each face's distance from where it will land, scaled by that term's coefficient — so
   this is arithmetic on the real roll rather than a second, invented one. */
function rollAnimTotal(totalEl, faces) {
  const final = Number(totalEl.dataset.final);
  const coeffs = (totalEl.dataset.coeffs || "").split(",").map(Number);
  let n = final;
  faces.forEach(f => {
    if (f.dropped) return;   // a dropped die is in no total
    const c = Number.isFinite(coeffs[f.term]) ? coeffs[f.term] : 1;
    n += c * (f.cur - f.finalV);
  });
  return n;
}

/* Animate one roll across every copy of it on screen — the Event Log module and the corner mirror
   hold the same entry, and both must show the same numbers at the same moment. The frame sequence is
   generated ONCE here and written into all of them; generating it per copy is how they drifted into
   tumbling through different faces, which reads as two different rolls happening.

   Safe to call on anything: entries with no dice in them do nothing. */
function animateRollCopies(entries) {
  const copies = entries.filter(Boolean).map(entry => ({
    entry,
    dice: [...entry.querySelectorAll(".die")],
    totals: [...entry.querySelectorAll(".roll-total")],
  })).filter(c => c.dice.length);
  if (!copies.length || !rollAnimAllowed()) return;

  // Every copy is the same markup, so the first one describes the dice for all of them.
  const faces = copies[0].dice.map(el => ({
    sides: Math.max(2, Number(el.dataset.sides) || 20),
    finalV: Number(el.dataset.final),
    dropped: el.classList.contains("die-dropped"),
    term: Number(el.dataset.term),
    cur: Number(el.dataset.final),
  }));

  copies.forEach(c => c.entry.classList.add("rolling"));
  let frame = 0;
  const paint = () => {
    copies.forEach(c => {
      c.dice.forEach((el, i) => { if (faces[i]) el.textContent = String(faces[i].cur); });
      c.totals.forEach(t => { t.textContent = String(rollAnimTotal(t, faces)); });
    });
  };
  const tick = () => {
    if (frame < ROLL_ANIM_FRAMES) {
      faces.forEach(f => {
        // A face never shows a number its own die can't produce, and never lands early on the number
        // it is about to settle on — a d20 flashing "17, 17, 17" doesn't read as tumbling.
        let v = 1 + Math.floor(Math.random() * f.sides);
        if (v === f.finalV) v = (v % f.sides) + 1;
        f.cur = v;
      });
      paint();
      frame++;
      setTimeout(tick, ROLL_ANIM_MS);
      return;
    }
    // Settle: every number goes back to what was actually rolled.
    faces.forEach(f => { f.cur = f.finalV; });
    copies.forEach(c => {
      c.dice.forEach((el, i) => { if (faces[i]) el.textContent = String(faces[i].finalV); });
      c.totals.forEach(t => { t.textContent = t.dataset.final; });
      c.entry.classList.remove("rolling");
      c.entry.classList.add("rolled");
      setTimeout(() => c.entry.classList.remove("rolled"), 600);
    });
  };
  setTimeout(tick, 0);
}

/* Kept for callers that have a single entry in hand. */
function animateRoll(entry) { animateRollCopies([entry]); }

/* The newest entry, in every place it is displayed. */
function animateNewestRoll() {
  if (!rollAnimAllowed()) return;
  const entries = ["dicelog", "roll-mirror-body"].map(id => {
    const host = document.getElementById(id); if (!host) return null;
    // The log keeps a sticky header as its first child; the newest entry is the first .ev either way.
    return host.querySelector(".ev");
  });
  animateRollCopies(entries);
}

document.addEventListener("DOMContentLoaded", loadRollAnimPref);
