/* ============================================================
   CHARACTER CREATOR — the "+ New character" wizard, and the Level Up
   dialog. Both walk PHB'14 chapter 1 ("Step-by-Step Characters", p11-15)
   in its own order, since that's the order the book teaches and the order
   the choices actually depend on each other in: your race sets ability
   bonuses you can't apply until you've rolled scores, and your class sets
   the hit die you can't compute HP from until you know Constitution.

     1. Choose a Race          p11   race + subrace
     2. Choose a Class         p11   class + subclass + LEVEL (default 1)
     3. Determine Ability      p12   standard array / point buy / 4d6kh3 /
        Scores                       manual, then racial increases
     4. Describe Your          p13   name + background
        Character
     5. Choose Equipment       p14   starting gold, pointer to the library

   Two steps are deliberately thin, both for reasons the project already
   committed to elsewhere:

   - Step 4 is name + background only. DOCS.md's roadmap lists personality
     traits, ideals, bonds, flaws, backstory and appearance under "Not
     planned" — this sheet targets optimised play, not roleplay journaling
     — so the wizard doesn't collect fields the sheet has nowhere to put.
   - Step 5 doesn't hand out class/background starting equipment packs.
     5e.tools stores those as `startingEquipment` reference strings that
     need their own resolver, and inventory items on this sheet are added
     from the Equipment Library by name (see inventory.js). The step gives
     the class's starting gold instead and points at the library, rather
     than half-populating an inventory the sheet can't fully model yet.

   Everything the wizard collects is written through collectState()'s own
   shape, so a created character is indistinguishable from a hand-built
   one — no separate "created by wizard" flavour of state to maintain.
   ============================================================ */

/* Standard array and point buy, PHB p13. POINT_COST is the book's table verbatim. */
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const POINT_BUY_BUDGET = 27;
const CREATOR_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

/* Wizard state. Rebuilt from scratch on every open — a half-finished character is never persisted,
   so closing the dialog genuinely discards it rather than leaving a partial entry on the tab bar. */
let CREATOR = null;

const CREATOR_STEPS = ["Race", "Class", "Ability Scores", "Description", "Equipment"];

function blankCreator() {
  return {
    step: 1,
    race: "", subrace: "",
    classes: [{ name: "", sub: "", lvl: 1 }],            // multiclass from the start, same shape as the Classes table
    method: "standard",                                  // standard | pointbuy | roll | manual
    scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    assign: {},                                          // ability -> index into STANDARD_ARRAY / rolled
    rolled: [],                                          // 4d6kh3 results, when method === "roll"
    racialChoice: [],                                    // abilities picked for a race's `choose` bonus
    name: "", background: "",
  };
}

function creatorTotalLevel() { return CREATOR.classes.reduce((s, c) => s + (Number(c.lvl) || 0), 0); }

/* ----- pickers -----
   A dropdown is the right control when the sheet knows the full list of valid answers, and it is
   also the only one that can't lose focus mid-edit: rebuilding cr-body on every keystroke of a text
   box tore the box out from under the cursor, so race/class are <select>s that re-render on `change`
   (a discrete event, fired when the user is done) instead of on `input`.

   The fallback matters, though. Libraries are user-supplied (see DOCS' "Where game data comes from")
   and may be absent entirely, so with nothing loaded this degrades to a free-text box rather than an
   empty dropdown you can't get past. A value that isn't in the list — typed before the data loaded,
   or from a source you've since removed — is added as an option so selecting it isn't silently lost. */
function creatorPicker(id, value, options, placeholder) {
  if (!options.length) {
    return `<input type="text" id="${id}" class="cr-text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" style="width:12rem" autocomplete="off">`;
  }
  const opts = options.slice();
  if (value && !opts.some(o => o.toLowerCase() === value.toLowerCase())) opts.unshift(value);
  return `<select id="${id}" class="cr-pick" style="width:12rem"><option value="">— ${escapeHtml(placeholder)} —</option>` +
    opts.map(o => `<option value="${escapeHtml(o)}"${o.toLowerCase() === (value || "").toLowerCase() ? " selected" : ""}>${escapeHtml(o)}</option>`).join("") +
    `</select>`;
}

/* Same control, for one row of the class table — ids have to be per-row, so these carry a data-crrow
   index and a class instead of an id. */
function creatorRowPicker(cls, row, value, options, placeholder) {
  if (!options.length) {
    return `<input type="text" class="cr-text ${cls}" data-crrow="${row}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" style="width:11rem" autocomplete="off">`;
  }
  const opts = options.slice();
  if (value && !opts.some(o => o.toLowerCase() === value.toLowerCase())) opts.unshift(value);
  return `<select class="cr-pick ${cls}" data-crrow="${row}" style="width:11rem"><option value="">— ${escapeHtml(placeholder)} —</option>` +
    opts.map(o => `<option value="${escapeHtml(o)}"${o.toLowerCase() === (value || "").toLowerCase() ? " selected" : ""}>${escapeHtml(o)}</option>`).join("") +
    `</select>`;
}

/* Subrace / subclass names, defensively. 5e.tools data has entries this sheet can't assume are
   well-formed (a subrace with no name at all is a real shape — see BASE_SUBRACE in class-library.js),
   and one malformed record used to throw out of the whole render, which reads to the user as "Back
   and Next don't work" rather than as an error. */
function subNames(rec) {
  return rec ? Object.values(rec.subs || {}).map(s => (s && s.name) || "").filter(Boolean).sort() : [];
}
function findSubByName(rec, name) {
  const q = (name || "").trim().toLowerCase(); if (!rec || !q) return null;
  return Object.values(rec.subs || {}).find(s => s && (s.name || "").toLowerCase() === q) || null;
}

/* ----- racial ability increases (races.json `ability`, parsed into RACE_LIB by class-library.js) -----
   Shape is [{ con: 2 }] for a fixed bonus, or [{ cha: 2, choose: { from: [...], count: n } }] for a
   Half-Elf-style "and two others of your choice". Returns { fixed: {ab: n}, choose: {from, count} }. */
function racialAbilityBonus(raceName, subraceName) {
  const out = { fixed: {}, choose: null };
  const rec = (typeof ciFindRace === "function") ? ciFindRace(raceName) : null;
  if (!rec) return out;
  const blocks = [].concat(rec.ability || []);
  const sub = findSubByName(rec, subraceName);
  if (sub) blocks.push(...(sub.ability || []));
  blocks.forEach(b => {
    if (!b || typeof b !== "object") return;
    Object.entries(b).forEach(([k, v]) => {
      if (k === "choose") { if (v && Array.isArray(v.from)) out.choose = { from: v.from, count: Number(v.count) || 1 }; return; }
      if (CREATOR_ABILITIES.includes(k) && typeof v === "number") out.fixed[k] = (out.fixed[k] || 0) + v;
    });
  });
  return out;
}

/* Final score for one ability: the base from whichever generation method is active, plus racial. */
function creatorFinalScore(ab) {
  const c = CREATOR;
  let base = c.scores[ab];
  const bonus = racialAbilityBonus(c.race, c.subrace);
  let inc = bonus.fixed[ab] || 0;
  if (bonus.choose && c.racialChoice.includes(ab)) inc += 1;   // 5e's "choose" increases are always +1
  return Math.max(1, Math.min(30, base + inc));
}

function pointsSpent() {
  return CREATOR_ABILITIES.reduce((s, ab) => s + (POINT_COST[CREATOR.scores[ab]] != null ? POINT_COST[CREATOR.scores[ab]] : 0), 0);
}

/* Two small readouts that a typed number changes, factored out so the `input` handler can refresh
   just them. Redrawing the whole step on a keystroke isn't only a focus problem: it detaches the
   buttons around the field, so the very next click (on "+ add class", say) lands on a node that is no
   longer in the document and does nothing. Anything derived from a text/number box updates in place. */
function creatorStep2Hint() {
  const first = CREATOR.classes[0] || { name: "" };
  const hd = first.name ? classHitDie(first.name) : "";
  return (hd ? `At 1st level you start with your first class's Hit Die (<b>${hd}</b>) at its maximum + your CON modifier.`
             : "Pick a class to see its hit die.")
    + (creatorTotalLevel() > 1 ? ` You're starting above 1st level, so you'll also want to set XP (Character module) and pick anything your classes grant on the way up &mdash; the Features panel lists it all once you're in.` : "");
}
function creatorFinalCell(ab) {
  const final = creatorFinalScore(ab);
  return `= <b>${final}</b> <span class="hint">(${sign(mod(final))})</span>`;
}

/* ----- step rendering -----
   Each step returns plain HTML; the shell wires the shared Back/Next/Create controls, so a step only
   has to describe its own fields and its own validity (see creatorStepValid). */
function creatorStepHtml() {
  const c = CREATOR;
  if (c.step === 1) {
    const races = Object.keys(RACE_LIB).sort();
    const rec = ciFindRace(c.race);
    const subs = subNames(rec);
    const bonus = racialAbilityBonus(c.race, c.subrace);
    const fixedTxt = Object.entries(bonus.fixed).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(", ");
    return `<div class="cr-step"><b>Step 1 &middot; Choose a Race</b> <span class="hint">PHB p11</span>
      <div class="hint">Your race sets your general appearance, natural talents, and one or more ability score increases (applied in step 3).</div>
      <label>Race ${creatorPicker("cr-race", c.race, races, "choose a race")}</label>
      ${subs.length || c.subrace ? `<label style="margin-left:.6rem">Subrace ${creatorPicker("cr-subrace", c.subrace, subs, "none")}</label>` : ""}
      <div class="hint" style="margin-top:.4rem">${races.length
        ? (fixedTxt ? `Ability increases from this race: <b>${fixedTxt}</b>${bonus.choose ? `, plus ${bonus.choose.count} of your choice (step 3)` : ""}`
                    : (c.race ? (subs.length && !c.subrace ? "This race's ability increases come from its subrace — pick one." : "No fixed ability increase found for this race in your data.")
                              : "Pick a race from your imported list."))
        : "No race data loaded — you can still type a race name freely, and fill ability scores in yourself."}</div>
      ${subs.includes(BASE_SUBRACE) ? `<div class="hint"><b>(base)</b> is this race's default version, the one with no subrace of its own — for a PHB Human that's the +1-to-everything build, as opposed to Variant.</div>` : ""}
    </div>`;
  }

  if (c.step === 2) {
    const classes = Object.keys(CLASS_LIB).sort();
    const total = creatorTotalLevel();
    const rows = c.classes.map((row, i) => {
      const rec = ciFindClass(row.name);
      const subs = subNames(rec);
      const hd = row.name ? classHitDie(row.name) : "";
      return `<tr>
        <td>${creatorRowPicker("cr-cls", i, row.name, classes, "choose a class")}</td>
        <td>${creatorRowPicker("cr-sub", i, row.sub, subs, "no subclass")}</td>
        <td><input type="number" class="tiny cr-lvl" data-crrow="${i}" min="1" max="20" value="${row.lvl}"></td>
        <td class="hint">${hd || ""}</td>
        <td>${c.classes.length > 1 ? `<button type="button" class="cr-cls-del" data-crrow="${i}" title="remove this class">&times;</button>` : ""}</td>
      </tr>`;
    }).join("");
    return `<div class="cr-step"><b>Step 2 &middot; Choose a Class</b> <span class="hint">PHB p11</span>
      <div class="hint">Your class sets your hit die, proficiencies, and the features you gain. <b>Level</b> starts at 1 &mdash; raise it if you're joining an existing campaign above 1st level (PHB p11). Add a second class to start multiclassed (PHB p163); the ability prerequisites for that aren't checked for you.</div>
      <table class="cr-classes"><tr class="hint"><td>Class</td><td>Subclass</td><td>Level</td><td>Hit Die</td><td></td></tr>${rows}</table>
      <div style="margin-top:.3rem"><button type="button" id="cr-add-class">+ add a class</button>
        <span class="hint" style="margin-left:.6rem">Total level <b id="cr-total-level" class="${total > 20 ? "cr-over" : ""}">${total}</b> / 20</span></div>
      <div class="hint" id="cr-step2-hint" style="margin-top:.4rem">${creatorStep2Hint()}</div>
    </div>`;
  }

  if (c.step === 3) {
    const bonus = racialAbilityBonus(c.race, c.subrace);
    const methodBtn = (id, label, title) =>
      `<button type="button" class="cr-method${c.method === id ? " active" : ""}" data-crmethod="${id}" title="${title}">${label}</button>`;
    let poolHtml = "";
    if (c.method === "standard" || c.method === "roll") {
      const pool = c.method === "standard" ? STANDARD_ARRAY : c.rolled;
      const used = new Set(Object.values(c.assign).filter(v => v != null));
      poolHtml = `<div class="hint" style="margin:.3rem 0">Assign each number to an ability:
        ${pool.map((n, i) => `<span class="cr-pool${used.has(i) ? " used" : ""}">${n}</span>`).join(" ")}
        ${c.method === "roll" ? `<button type="button" id="cr-reroll">roll 4d6, drop lowest &times;6</button>` : ""}</div>`;
    } else if (c.method === "pointbuy") {
      const spent = pointsSpent();
      poolHtml = `<div class="hint" style="margin:.3rem 0">Points spent: <b class="${spent > POINT_BUY_BUDGET ? "cr-over" : ""}">${spent}</b> / ${POINT_BUY_BUDGET}
        &middot; scores 8&ndash;15 before racial increases (PHB p13)</div>`;
    }
    const rows = CREATOR_ABILITIES.map(ab => {
      const pool = c.method === "standard" ? STANDARD_ARRAY : c.rolled;
      let control;
      if (c.method === "standard" || c.method === "roll") {
        const chosen = c.assign[ab];
        const taken = new Set(Object.entries(c.assign).filter(([k, v]) => k !== ab && v != null).map(([, v]) => v));
        control = `<select class="cr-assign" data-ab="${ab}"><option value="">—</option>` +
          pool.map((n, i) => `<option value="${i}"${chosen === i ? " selected" : ""}${taken.has(i) ? " disabled" : ""}>${n}</option>`).join("") + `</select>`;
      } else if (c.method === "pointbuy") {
        control = `<select class="cr-points" data-ab="${ab}">` +
          Object.keys(POINT_COST).map(Number).sort((a, b) => a - b)
            .map(n => `<option value="${n}"${c.scores[ab] === n ? " selected" : ""}>${n} (${POINT_COST[n]} pt)</option>`).join("") + `</select>`;
      } else {
        control = `<input type="number" class="tiny cr-manual" data-ab="${ab}" min="1" max="30" value="${c.scores[ab]}">`;
      }
      const inc = (bonus.fixed[ab] || 0) + (bonus.choose && c.racialChoice.includes(ab) ? 1 : 0);
      return `<tr><td>${ab.toUpperCase()}</td><td>${control}</td>
        <td class="hint">${inc ? `+${inc} racial` : ""}</td>
        <td id="cr-final-${ab}">${creatorFinalCell(ab)}</td></tr>`;
    }).join("");
    const chooseHtml = bonus.choose ? `<div class="hint" style="margin-top:.4rem">Your race also increases
      <b>${bonus.choose.count}</b> other ability score${bonus.choose.count === 1 ? "" : "s"} by 1 &mdash; pick ${bonus.choose.count}:
      ${bonus.choose.from.map(ab => `<button type="button" class="cr-racial${c.racialChoice.includes(ab) ? " active" : ""}" data-crracial="${ab}">${ab.toUpperCase()}</button>`).join(" ")}</div>` : "";
    return `<div class="cr-step"><b>Step 3 &middot; Determine Ability Scores</b> <span class="hint">PHB p12&ndash;13</span>
      <div style="margin:.3rem 0">
        ${methodBtn("standard", "Standard array", "15, 14, 13, 12, 10, 8 (PHB p13)")}
        ${methodBtn("pointbuy", "Point buy", "27 points, scores 8–15 (PHB p13 variant)")}
        ${methodBtn("roll", "Roll 4d6 drop lowest", "roll six sets of 4d6, keeping the highest three (PHB p12)")}
        ${methodBtn("manual", "Enter manually", "type scores straight in")}
      </div>
      ${poolHtml}
      <table class="cr-scores">${rows}</table>
      ${chooseHtml}
    </div>`;
  }

  if (c.step === 4) {
    return `<div class="cr-step"><b>Step 4 &middot; Describe Your Character</b> <span class="hint">PHB p13</span>
      <div class="hint">A background grants two skill proficiencies, sometimes tools or languages, and a background feature &mdash; record those in the Skills and Proficiencies modules once you're in.</div>
      <label>Name <input type="text" id="cr-name" value="${escapeHtml(c.name)}" style="width:14rem"></label>
      <label style="margin-left:.6rem">Background <input type="text" id="cr-background" value="${escapeHtml(c.background)}" style="width:12rem"></label>
      <div class="hint" style="margin-top:.4rem">Personality traits, ideals, bonds, flaws, backstory and appearance are deliberately not tracked on this sheet (see DOCS' roadmap) &mdash; it targets optimised play, so that material belongs in your own notes.</div>
    </div>`;
  }

  // Step 5
  const c5 = CREATOR;
  const first5 = c5.classes[0] || { name: "", sub: "", lvl: 1 };
  const hd = first5.name ? classHitDie(first5.name) : "";
  const conMod = mod(creatorFinalScore("con"));
  const hp = hd ? (HIT_DIE_MAX[hd] || 8) + conMod : null;
  const classTxt = c5.classes.filter(r => r.name || r.lvl > 1)
    .map(r => `${escapeHtml(r.name || "no class")}${r.sub ? ` (${escapeHtml(r.sub)})` : ""} ${r.lvl}`).join(" / ") || "no class";
  return `<div class="cr-step"><b>Step 5 &middot; Choose Equipment</b> <span class="hint">PHB p14</span>
    <div class="hint">Your class and background give you starting equipment, or you can buy your own with your class's starting gold. Either way, add the items from the <b>Equipment Library</b> ("+ Add Item" in Inventory) once you're in &mdash; the sheet looks up weight, value and armour class from the library entry, and your AC is computed from whatever you mark equipped.</div>
    <div style="margin-top:.5rem">Ready to create:
      <b>${escapeHtml(c5.name || "unnamed")}</b>, ${escapeHtml(c5.race || "no race")}${c5.subrace ? ` (${escapeHtml(c5.subrace)})` : ""},
      ${classTxt}</div>
    <div class="hint">${CREATOR_ABILITIES.map(ab => `${ab.toUpperCase()} ${creatorFinalScore(ab)}`).join(" &middot; ")}</div>
    ${hp != null ? `<div class="hint">Starting HP at 1st level would be ${HIT_DIE_MAX[hd]} (${hd} max) ${sign(conMod)} CON = <b>${Math.max(1, hp)}</b>; the sheet computes Max HP for your actual level automatically.</div>` : ""}
  </div>`;
}

/* Validity is asked about a *named* step rather than the current one, because the steps are freely
   navigable tabs — Create has to know whether step 3 is finished while you're standing on step 5. */
function creatorStepBlockerFor(step) {
  const c = CREATOR;
  if (step === 2) {
    const total = creatorTotalLevel();
    if (c.classes.some(r => (Number(r.lvl) || 0) < 1)) return "Every class needs at least 1 level.";
    if (total > 20) return `Total level is ${total} — the cap is 20.`;
  }
  if (step === 3) {
    if (c.method === "pointbuy" && pointsSpent() > POINT_BUY_BUDGET) return `Over budget by ${pointsSpent() - POINT_BUY_BUDGET} point(s).`;
    if (c.method === "standard" || c.method === "roll") {
      if (c.method === "roll" && !c.rolled.length) return "Roll a set of scores first.";
      if (!CREATOR_ABILITIES.every(ab => c.assign[ab] != null)) return "Assign every number to an ability.";
    }
  }
  return "";
}
function creatorStepValid(step) { return !creatorStepBlockerFor(step == null ? CREATOR.step : step); }
function creatorStepBlocker() { return creatorStepBlockerFor(CREATOR.step); }

/* The first problem anywhere in the wizard, so Create can explain itself from whichever step you
   happen to be standing on. */
function creatorFirstBlocker() {
  for (let s = 1; s <= 5; s++) { const b = creatorStepBlockerFor(s); if (b) return { step: s, msg: b }; }
  return null;
}

function creatorStepperHtml() {
  return CREATOR_STEPS.map((label, i) => {
    const n = i + 1, bad = !!creatorStepBlockerFor(n);
    return `<button type="button" class="cr-tab${CREATOR.step === n ? " active" : ""}${bad ? " cr-tab-bad" : ""}" data-crstep="${n}"
      title="${bad ? escapeHtml(creatorStepBlockerFor(n)) : `go to step ${n}`}"><span class="hint">${n}</span> ${escapeHtml(label)}</button>`;
  }).join("");
}

/* Chrome only — the stepper, blocker line and button states. Split out from renderCreator so an edit
   that changes nothing about the step's own controls (typing a level, a name) can refresh what's
   derived from it WITHOUT replacing cr-body and yanking the field out from under the cursor. */
function renderCreatorChrome() {
  $("cr-stepper").innerHTML = creatorStepperHtml();
  $("cr-back").disabled = CREATOR.step === 1;
  const last = CREATOR.step === 5;
  $("cr-next").style.display = last ? "none" : "";
  $("cr-create").style.display = last ? "" : "none";
  const here = creatorStepBlocker();
  const anywhere = creatorFirstBlocker();
  $("cr-blocker").textContent = here || (last && anywhere ? `Step ${anywhere.step}: ${anywhere.msg}` : "");
  $("cr-next").disabled = !!here;
  $("cr-create").disabled = !!anywhere;
}

function renderCreator() {
  const modal = $("creator-modal"); if (!modal || modal.style.display === "none") return;
  $("cr-body").innerHTML = creatorStepHtml();
  renderCreatorChrome();
}

function goToCreatorStep(n) {
  if (!CREATOR || n < 1 || n > 5 || n === CREATOR.step) return;
  CREATOR.step = n;
  renderCreator();
}

function openCreator() {
  const modal = $("creator-modal");
  if (!modal) { addCharacter(null); return; }   // no dialog markup (test harness): plain blank character
  CREATOR = blankCreator();
  modal.style.display = "";
  renderCreator();
}
function closeCreator() { const m = $("creator-modal"); if (m) m.style.display = "none"; CREATOR = null; }

/* Roll 4d6-drop-lowest six times, logging each set so the numbers are auditable afterwards rather
   than appearing from nowhere — same principle as every other roll on the sheet. */
function creatorRollScores() {
  const sets = [];
  for (let i = 0; i < 6; i++) {
    const dice = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => b - a);
    sets.push({ total: dice[0] + dice[1] + dice[2], dice });
  }
  CREATOR.rolled = sets.map(s => s.total);
  CREATOR.assign = {};
  logEvent("roll", `<b>Ability scores</b> &larr; 4d6 drop lowest &times;6: ` +
    sets.map(s => `<b>${s.total}</b> (${s.dice.join(",")})`).join(" &middot; "));
}

/* Turn the wizard's answers into a character state and hand it to the roster. */
function creatorBuildState() {
  const c = CREATOR;
  const fields = {
    "char-name": c.name || "unnamed",
    "char-race": c.race, "char-subrace": c.subrace, "char-bg": c.background,
  };
  CREATOR_ABILITIES.forEach(ab => { fields["score-" + ab] = String(creatorFinalScore(ab)); });
  // An all-blank extra row is a row the user added and never filled in; it would show up as an
  // "(unnamed class)" line on the Classes table, so drop it rather than carrying it across.
  const rows = c.classes.filter((r, i) => i === 0 || r.name.trim() || r.lvl > 1);
  return {
    v: 1, effectsSv: 1, fields,
    classes: rows.map(r => ({ name: r.name, sub: r.sub, lvl: r.lvl, hitDie: "auto", casting: "auto" })),
    spells: [], items: [], attacks: [], routines: [],
    featChoices: {}, usesState: {}, hdState: {},
    effectChoices: {}, effectToggles: {},
    proficiencies: { weapons: [], tools: [], languages: [] },
    concentrating: null,
  };
}

function creatorFinish() {
  const c = CREATOR;
  const state = creatorBuildState();
  const name = c.name || "unnamed";
  closeCreator();
  addCharacter(state, name);
  // Current HP starts at max — a newly created character is undamaged, and Max HP is only known once
  // the state is live (it depends on the class table and CON that were just applied).
  $("hp-cur").value = String(maxHP()); commitMath($("hp-cur"));
  recompute(); saveState();
  const classTxt = c.classes.filter(r => r.name.trim()).map(r => `${escapeHtml(r.name)} ${r.lvl}`).join(" / ") || "no class";
  logEvent("info", `<b>${escapeHtml(name)}</b> created &mdash; ${escapeHtml(c.race || "no race")} ${classTxt}`);
}

/* ----- dialog wiring ----- */
document.addEventListener("DOMContentLoaded", () => {
  const modal = $("creator-modal"); if (!modal) return;

  $("cr-back").addEventListener("click", () => goToCreatorStep(CREATOR.step - 1));
  $("cr-next").addEventListener("click", () => { if (creatorStepValid()) goToCreatorStep(CREATOR.step + 1); });
  // The stepper is a tab strip, not just a label: any step can be jumped to at any time, so you can
  // go back and change your race after seeing the ability scores it feeds without walking the whole
  // wizard again. Create stays disabled until every step validates, wherever you're standing.
  $("cr-stepper").addEventListener("click", e => {
    const t = e.target.closest("[data-crstep]"); if (t && CREATOR) goToCreatorStep(Number(t.dataset.crstep));
  });
  $("cr-create").addEventListener("click", creatorFinish);
  $("cr-cancel").addEventListener("click", closeCreator);
  modal.addEventListener("click", e => { if (e.target === modal) closeCreator(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.style.display !== "none") closeCreator();
  });

  // Field edits. Text inputs re-render only when the change alters what other fields offer (race ->
  // subrace list, class -> subclass list), so typing a name doesn't rebuild the step under the cursor.
  /* `input` fires on every keystroke, so NOTHING in here may rebuild cr-body — that is what tore the
     race and class text boxes out from under the cursor after one character. Everything typed either
     needs no redraw at all, or redraws only the small derived readout it affects. Controls that DO
     need a rebuild (the pickers) are <select>s, handled on `change` below. */
  $("cr-body").addEventListener("input", e => {
    const t = e.target; if (!CREATOR) return;
    if (t.id === "cr-race") { CREATOR.race = t.value; CREATOR.racialChoice = []; return; }   // free-text fallback (no race data)
    if (t.id === "cr-subrace") { CREATOR.subrace = t.value; return; }
    if (t.classList.contains("cr-cls")) { CREATOR.classes[Number(t.dataset.crrow)].name = t.value; return; }
    if (t.classList.contains("cr-sub")) { CREATOR.classes[Number(t.dataset.crrow)].sub = t.value; return; }
    if (t.classList.contains("cr-lvl")) {
      CREATOR.classes[Number(t.dataset.crrow)].lvl = Math.max(1, Math.min(20, Number(t.value) || 1));
      const total = creatorTotalLevel(), tot = $("cr-total-level");
      if (tot) { tot.textContent = total; tot.className = total > 20 ? "cr-over" : ""; }
      if ($("cr-step2-hint")) $("cr-step2-hint").innerHTML = creatorStep2Hint();
      renderCreatorChrome(); return;
    }
    if (t.id === "cr-name") { CREATOR.name = t.value; return; }
    if (t.id === "cr-background") { CREATOR.background = t.value; return; }
    if (t.classList.contains("cr-manual")) {
      const ab = t.dataset.ab;
      CREATOR.scores[ab] = Math.max(1, Math.min(30, Number(t.value) || 10));
      if ($("cr-final-" + ab)) $("cr-final-" + ab).innerHTML = creatorFinalCell(ab);
      renderCreatorChrome(); return;
    }
  });
  /* `change` rebuilds, so ONLY <select>s are handled here. A number box also fires `change`, but on
     blur — i.e. as you click the next control — which would tear that control out of the document
     before its own click resolved. Number boxes are fully handled by `input` above. */
  $("cr-body").addEventListener("change", e => {
    const t = e.target; if (!CREATOR) return;
    if (t.id === "cr-race") { CREATOR.race = t.value; CREATOR.subrace = ""; CREATOR.racialChoice = []; renderCreator(); return; }
    if (t.id === "cr-subrace") { CREATOR.subrace = t.value; CREATOR.racialChoice = []; renderCreator(); return; }
    if (t.classList.contains("cr-cls")) {
      const row = CREATOR.classes[Number(t.dataset.crrow)];
      row.name = t.value; row.sub = "";   // subclasses belong to a class; keeping the old one would be nonsense
      renderCreator(); return;
    }
    if (t.classList.contains("cr-sub")) { CREATOR.classes[Number(t.dataset.crrow)].sub = t.value; return; }
    if (t.classList.contains("cr-assign")) {
      const i = t.value === "" ? null : Number(t.value);
      CREATOR.assign[t.dataset.ab] = i;
      const pool = CREATOR.method === "standard" ? STANDARD_ARRAY : CREATOR.rolled;
      CREATOR.scores[t.dataset.ab] = i == null ? 10 : pool[i];
      renderCreator(); return;
    }
    if (t.classList.contains("cr-points")) {
      CREATOR.scores[t.dataset.ab] = Number(t.value) || 8;
      renderCreator(); return;
    }
  });
  $("cr-body").addEventListener("click", e => {
    if (!CREATOR) return;
    if (e.target.id === "cr-add-class") { CREATOR.classes.push({ name: "", sub: "", lvl: 1 }); renderCreator(); return; }
    const del = e.target.closest(".cr-cls-del");
    if (del) { CREATOR.classes.splice(Number(del.dataset.crrow), 1); renderCreator(); return; }
    const m = e.target.closest("[data-crmethod]");
    if (m) {
      CREATOR.method = m.dataset.crmethod;
      CREATOR.assign = {};
      // Point buy starts everyone at 8 (0 points spent); the other methods start neutral at 10.
      const base = CREATOR.method === "pointbuy" ? 8 : 10;
      CREATOR_ABILITIES.forEach(ab => { CREATOR.scores[ab] = base; });
      if (CREATOR.method === "roll" && !CREATOR.rolled.length) creatorRollScores();
      renderCreator(); return;
    }
    if (e.target.id === "cr-reroll") { creatorRollScores(); renderCreator(); return; }
    const r = e.target.closest("[data-crracial]");
    if (r) {
      const ab = r.dataset.crracial, bonus = racialAbilityBonus(CREATOR.race, CREATOR.subrace);
      const i = CREATOR.racialChoice.indexOf(ab);
      if (i >= 0) CREATOR.racialChoice.splice(i, 1);
      else if (!bonus.choose || CREATOR.racialChoice.length < bonus.choose.count) CREATOR.racialChoice.push(ab);
      renderCreator(); return;
    }
  });
});

/* ============================================================
   LEVEL UP — PHB'14 p15, "Beyond 1st Level".

   Levelling is a much shorter walk than creation, and the same order:
   pick which class gains the level (or add a new one, i.e. multiclass),
   then take the hit points. The book offers two ways to take HP and this
   offers both: roll the class's Hit Die, or take "the fixed value shown
   in your class entry, which is the average result of the die roll
   (rounded up)" — HIT_DIE_FIXED in derived.js, the same numbers maxHPAuto()
   already assumes.

   What the sheet does NOT do here, deliberately: Max HP is *computed* from
   your classes and CON (maxHPAuto), so it already changes the moment the
   level does — there's nothing to write. A rolled Hit Die therefore has to
   go somewhere that survives that recomputation, which is the Max HP
   override box; taking the average needs no write at all, since that's
   exactly what the formula assumes. This is explained in the dialog rather
   than left for the player to discover.

   Features gained at the new level come from the Features panel, which
   re-renders off the Classes table automatically — the dialog lists them
   as a preview so you know what you're picking up.
   ============================================================ */
let LEVELUP = null;

function levelUpClasses() {
  return getClasses().map((c, i) => ({ i, name: c.name, sub: c.sub, lvl: c.lvl, hitDie: c.hitDie === "auto" ? classHitDie(c.name) : c.hitDie }));
}

/* Features the chosen class grants at the level being entered — same lookup the Features panel does,
   so what's previewed here is exactly what will appear there. */
function featuresAtLevel(className, subName, level) {
  const rec = ciFindClass(className); if (!rec) return [];
  const out = rec.feats.filter(f => f.level === level).map(f => f.name);
  const sub = findSubByName(rec, subName);
  if (sub) out.push(...(sub.feats || []).filter(f => f.level === level).map(f => f.name));
  return out;
}

function renderLevelUp() {
  const modal = $("levelup-modal"); if (!modal || modal.style.display === "none") return;
  const rows = levelUpClasses();
  const isNew = LEVELUP.target === "new";
  const cur = !isNew ? rows[LEVELUP.target] : null;
  const newLevel = isNew ? 1 : (cur ? cur.lvl + 1 : 1);
  const hitDie = isNew ? (LEVELUP.newClass ? classHitDie(LEVELUP.newClass) : "") : (cur ? cur.hitDie : "");
  const conMod = abilityMod("con");
  const fixed = hitDie ? (HIT_DIE_FIXED[hitDie] || 5) : 0;

  const opts = rows.map(r => `<option value="${r.i}"${LEVELUP.target === r.i ? " selected" : ""}>${escapeHtml(r.name || "(unnamed class)")} ${r.lvl} &rarr; ${r.lvl + 1}</option>`).join("")
    + `<option value="new"${isNew ? " selected" : ""}>+ multiclass into a new class (level 1)</option>`;

  // A dropdown, for the same two reasons as the creator's pickers: the sheet knows the valid answers,
  // and a text box here re-rendered the dialog on every keystroke and lost focus after one character.
  const classes = Object.keys(CLASS_LIB).sort();
  const newClassHtml = isNew ? `<div style="margin-top:.4rem">
      <label>New class ${creatorPicker("lu-newclass", LEVELUP.newClass, classes, "choose a class")}</label>
      <div class="hint">Multiclassing has ability-score prerequisites (PHB p163) that this sheet doesn't check for you.</div>
    </div>` : "";

  const gained = !isNew && cur ? featuresAtLevel(cur.name, cur.sub, newLevel)
                : (LEVELUP.newClass ? featuresAtLevel(LEVELUP.newClass, "", 1) : []);

  $("lu-body").innerHTML = `
    <div class="hint">Each level gives 1 additional Hit Die and increases your hit point maximum (PHB p15).</div>
    <div style="margin-top:.4rem"><label>Level up <select id="lu-target">${opts}</select></label></div>
    ${newClassHtml}
    <div style="margin-top:.5rem"><b>Hit points</b> <span class="hint">${hitDie ? `${hitDie} + CON ${sign(conMod)}` : "pick a class first"}</span>
      <div style="margin-top:.2rem">
        <label><input type="radio" name="lu-hp" value="fixed"${LEVELUP.hpMode === "fixed" ? " checked" : ""}>
          Take the fixed average${hitDie ? `: <b>${fixed}</b> ${sign(conMod)} = <b>${Math.max(1, fixed + conMod)}</b>` : ""}</label>
        <label style="margin-left:.8rem"><input type="radio" name="lu-hp" value="roll"${LEVELUP.hpMode === "roll" ? " checked" : ""}>
          Roll the Hit Die${LEVELUP.rolled != null ? `: rolled <b>${LEVELUP.rolled}</b> ${sign(conMod)} = <b>${Math.max(1, LEVELUP.rolled + conMod)}</b>` : ""}</label>
        ${LEVELUP.hpMode === "roll" ? ` <button type="button" id="lu-roll"${hitDie ? "" : " disabled"}>${LEVELUP.rolled == null ? "roll" : "re-roll"}</button>` : ""}
      </div>
      <div class="hint" style="margin-top:.3rem">Max HP is calculated from your classes and CON, and already assumes the fixed average — so taking the average needs no adjustment. A <i>rolled</i> result is written into the <b>Max HP override</b> box instead, since a computed value has nowhere else to keep it.</div>
    </div>
    ${gained.length ? `<div style="margin-top:.5rem"><b>Gained at level ${newLevel}:</b> <span class="hint">${gained.map(escapeHtml).join(", ")}</span></div>`
      : `<div class="hint" style="margin-top:.5rem">No class features listed at that level in your loaded data.</div>`}`;

  renderLevelUpChrome();
}

/* Confirm's enabled state, without redrawing the body — so the free-text class fallback can update it
   on every keystroke without destroying the field being typed into. */
function renderLevelUpChrome() {
  if (!LEVELUP) return;
  const blocked = LEVELUP.target === "new" && !LEVELUP.newClass.trim();
  $("lu-confirm").disabled = blocked || (LEVELUP.hpMode === "roll" && LEVELUP.rolled == null);
}

function openLevelUp() {
  const modal = $("levelup-modal"); if (!modal) return;
  const rows = levelUpClasses();
  LEVELUP = { target: rows.length ? 0 : "new", newClass: "", hpMode: "fixed", rolled: null };
  modal.style.display = "";
  renderLevelUp();
}
function closeLevelUp() { const m = $("levelup-modal"); if (m) m.style.display = "none"; LEVELUP = null; }

function levelUpConfirm() {
  const rows = levelUpClasses();
  const isNew = LEVELUP.target === "new";
  const hpBefore = maxHP();
  const autoBefore = maxHPAuto();   // what the formula said before this level existed

  if (isNew) {
    addClassRow({ name: LEVELUP.newClass, sub: "", lvl: 1 });
  } else {
    const tr = document.querySelectorAll("#class-rows tr")[LEVELUP.target];
    if (!tr) { closeLevelUp(); return; }
    const lvlInput = tr.querySelector(".cls-lvl");
    lvlInput.value = String(Math.min(20, (Number(lvlInput.value) || 1) + 1));
    commitMathField(lvlInput);
  }
  recompute();

  const cur = isNew ? { name: LEVELUP.newClass, lvl: 1 } : rows[LEVELUP.target];
  const newLevel = isNew ? 1 : cur.lvl + 1;
  const conMod = abilityMod("con");

  /* Max HP. The automatic formula already assumes the fixed average for every level, so a
     fixed-average level-up on an un-overridden sheet needs no write at all — recompute() above
     has already produced the right number.

     Two cases do need a write, and both go through the override box because a literal number is
     the only place the sheet can keep a Max HP that differs from the formula:

       - a ROLLED hit die, which deviates from the average by `rollDelta`;
       - ANY level-up while an override is already in force, because the override shadows the
         formula entirely — leave it alone and the character gains a level with no hit points.

     The override case adds what the formula thinks this level is worth (autoAfter - autoBefore,
     which picks up per-level bonuses like Hill Dwarf's Dwarven Toughness, not just die + CON)
     plus any roll deviation. */
  const fixedAvg = HIT_DIE_FIXED[isNew ? classHitDie(LEVELUP.newClass) : rows[LEVELUP.target].hitDie] || 5;
  const rolledMode = LEVELUP.hpMode === "roll" && LEVELUP.rolled != null;
  const rollDelta = rolledMode ? Math.max(1, LEVELUP.rolled + conMod) - Math.max(1, fixedAvg + conMod) : 0;
  const ov = $("hp-max-override");
  const overridden = ov.value !== "" && !isNaN(Number(ov.value));
  if (overridden) {
    ov.value = String(Number(ov.value) + (maxHPAuto() - autoBefore) + rollDelta);
    recompute();
  } else if (rollDelta) {
    ov.value = String(maxHPAuto() + rollDelta);
    recompute();
  }

  const gainedHp = maxHP() - hpBefore;
  // Level-ups increase your maximum; current HP rises with it, per the usual reading of gaining a level.
  $("hp-cur").value = String(num($("hp-cur")) + Math.max(0, gainedHp)); commitMath($("hp-cur"));

  const gained = featuresAtLevel(cur.name, isNew ? "" : cur.sub, newLevel);
  logEvent("info", `<b>Level up</b> &mdash; ${escapeHtml(cur.name || "class")} ${newLevel}` +
    ` &middot; max HP ${hpBefore} &rarr; ${maxHP()}` +
    (gained.length ? ` &middot; gained ${gained.map(escapeHtml).join(", ")}` : ""));
  closeLevelUp();
  recompute(); renderClassFeatures(); if (typeof renderHitDice === "function") renderHitDice();
  saveState(); renderCharacterTabs();
}

document.addEventListener("DOMContentLoaded", () => {
  const modal = $("levelup-modal"); if (!modal) return;
  const btn = $("btn-level-up"); if (btn) btn.addEventListener("click", openLevelUp);
  $("lu-cancel").addEventListener("click", closeLevelUp);
  $("lu-confirm").addEventListener("click", levelUpConfirm);
  modal.addEventListener("click", e => { if (e.target === modal) closeLevelUp(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.style.display !== "none") closeLevelUp();
  });
  $("lu-body").addEventListener("change", e => {
    if (!LEVELUP) return;
    if (e.target.id === "lu-target") {
      LEVELUP.target = e.target.value === "new" ? "new" : Number(e.target.value);
      LEVELUP.rolled = null; renderLevelUp(); return;
    }
    if (e.target.id === "lu-newclass") { LEVELUP.newClass = e.target.value; LEVELUP.rolled = null; renderLevelUp(); return; }
    if (e.target.name === "lu-hp") { LEVELUP.hpMode = e.target.value; LEVELUP.rolled = null; renderLevelUp(); return; }
  });
  // input: record the free-text fallback without redrawing (see the creator's handlers for why).
  $("lu-body").addEventListener("input", e => {
    if (LEVELUP && e.target.id === "lu-newclass") { LEVELUP.newClass = e.target.value; renderLevelUpChrome(); }
  });
  $("lu-body").addEventListener("click", e => {
    if (!LEVELUP || e.target.id !== "lu-roll") return;
    const rows = levelUpClasses();
    const hitDie = LEVELUP.target === "new" ? classHitDie(LEVELUP.newClass) : rows[LEVELUP.target].hitDie;
    const sides = HIT_DIE_MAX[hitDie] || 8;
    LEVELUP.rolled = rollDie(sides);
    logEvent("roll", `<b>${LEVELUP.rolled}</b> &larr; Level-up Hit Die (1${hitDie})`);
    renderLevelUp();
  });
});
