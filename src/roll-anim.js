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

const ROLL_ANIM_FRAMES = 11;     // flashes before it settles
const ROLL_ANIM_MS = 45;         // between flashes — ~500ms total. The first version ran in 270ms
                                 // and was genuinely easy to miss; this is long enough to read as a
                                 // tumble without making a Fireball's eight dice hold up the table.
const ROLL_ANIM_KEY = "charsheet-rollanim";

/* null = never chosen, so the OS decides; true/false = the user said so and that wins.
   The distinction matters: gating this on prefers-reduced-motion ALONE meant anyone with that
   setting on simply never saw the feature and had no way to find out why, which is a worse
   accessibility outcome than a visible switch they can flip. The system preference still picks the
   default — it just no longer has the final word over someone who has asked for the animation. */
let ROLL_ANIM_PREF = null;
function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return false; }
}
function loadRollAnimPref() {
  try { const v = localStorage.getItem(ROLL_ANIM_KEY); ROLL_ANIM_PREF = v == null ? null : v !== "off"; }
  catch (e) { /* a corrupt pref isn't worth a broken sheet */ }
}
function setRollAnim(on) {
  ROLL_ANIM_PREF = !!on;
  try { localStorage.setItem(ROLL_ANIM_KEY, on ? "on" : "off"); } catch (e) {}
  if (typeof renderRollAnimToggle === "function") renderRollAnimToggle();
}
function rollAnimAllowed() {
  return ROLL_ANIM_PREF == null ? !prefersReducedMotion() : ROLL_ANIM_PREF;
}
/* The small die button in the roll mirror's title bar, so the switch is somewhere you'd find it. */
function renderRollAnimToggle() {
  const btn = document.getElementById("roll-anim-toggle"); if (!btn) return;
  const on = rollAnimAllowed();
  btn.textContent = on ? "\u2685" : "\u2680";
  btn.classList.toggle("off", !on);
  btn.title = on ? "dice tumble when they land \u2014 click to switch off"
                 : "dice land without tumbling \u2014 click to switch on"
                   + (prefersReducedMotion() ? " (your system asks for reduced motion)" : "");
}

/* The running total for a set of currently-showing faces. Starts from the value actually rolled and
   moves it by each face's distance from where it will land, scaled by that term's coefficient — so
   this is arithmetic on the real roll rather than a second, invented one. */
function rollAnimTotal(totalEl, faces) {
  const final = Number(totalEl.dataset.final);
  const coeffs = (totalEl.dataset.coeffs || "").split(",").map(Number);
  /* Per TERM rather than per die: a term's value is the sum of whatever it is currently KEEPING, so
     a strike-through moving from one advantage die to the other falls out of the arithmetic instead
     of needing a case of its own. */
  const cur = {}, fin = {};
  faces.forEach(f => {
    cur[f.term] = cur[f.term] || 0;
    fin[f.term] = fin[f.term] || 0;
    if (!f.dropped) cur[f.term] += f.cur;
    if (!f.finalDropped) fin[f.term] += f.finalV;
  });
  let n = final;
  Object.keys(cur).forEach(t => {
    const c = Number.isFinite(coeffs[t]) ? coeffs[t] : 1;
    n += c * (cur[t] - fin[t]);
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
    finalDropped: el.classList.contains("die-dropped"),
    dropped: el.classList.contains("die-dropped"),
    ops: el.dataset.ops || "",
    term: el.dataset.term || "0",
    cur: Number(el.dataset.final),
  }));
  // Terms that select between their dice (advantage's kh1, and friends) re-decide every frame.
  const termsWithOps = [...new Set(faces.filter(f => f.ops).map(f => f.term))];

  copies.forEach(c => c.entry.classList.add("rolling"));
  let frame = 0;
  const paint = () => {
    copies.forEach(c => {
      c.dice.forEach((el, i) => {
        const f = faces[i]; if (!f) return;
        el.textContent = String(f.cur);
        el.classList.toggle("die-dropped", f.dropped);
      });
      c.totals.forEach(t => { t.textContent = String(rollAnimTotal(t, faces)); });
    });
  };
  /* Re-run the roller's own keep/drop rule against what the dice are currently showing, so a
     tumbling advantage strikes out whichever die is momentarily lower — the discarded die moves as
     the numbers do, which is what watching two dice fight over a roll actually looks like. */
  const reselect = () => {
    if (typeof dropFlagsFor !== "function") return;
    termsWithOps.forEach(term => {
      const group = faces.filter(f => f.term === term);
      if (!group.length) return;
      const flags = dropFlagsFor(group.map(f => f.cur), group[0].ops, group[0].sides);
      group.forEach((f, i) => { f.dropped = !!flags[i]; });
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
      reselect();
      paint();
      frame++;
      setTimeout(tick, ROLL_ANIM_MS);
      return;
    }
    // Settle: every number, and every strike-through, goes back to what was actually rolled.
    faces.forEach(f => { f.cur = f.finalV; f.dropped = f.finalDropped; });
    copies.forEach(c => {
      c.dice.forEach((el, i) => {
        const f = faces[i]; if (!f) return;
        el.textContent = String(f.finalV);
        el.classList.toggle("die-dropped", f.finalDropped);
      });
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

document.addEventListener("DOMContentLoaded", () => {
  loadRollAnimPref();
  renderRollAnimToggle();
  const btn = document.getElementById("roll-anim-toggle");
  if (btn) btn.addEventListener("click", () => setRollAnim(!rollAnimAllowed()));
});
