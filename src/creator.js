/* ============================================================
   CHARACTER CREATOR — the "+ New character" wizard, and the Level Up
   dialog. Both walk PHB'14 chapter 1 ("Step-by-Step Characters", p11-15)
   in its own order, since that's the order the book teaches and the order
   the choices actually depend on each other in: your race sets ability
   bonuses you can't apply until you've rolled scores, and your class sets
   the hit die you can't compute HP from until you know Constitution.

     1. Choose a Race          p11   race + subrace + racial choices
     2. Choose a Class         p11   classes (multiclass) + LEVEL (default 1)
     3. Determine Ability      p12   standard array / point buy / 4d6kh3 /
        Scores                       manual, then racial increases
     4. Describe Your          p13   name + background (PHB p125 custom too)
        Character
     5. Choose Equipment       p14   package or starting gold, DMG p38 for
                                     characters starting above 1st level

   The five steps are TABS, not a one-way walk: any step can be jumped to at
   any time, because the choices genuinely feed back on each other (you pick
   a race, see what it did to your scores in step 3, and want to change it).
   Back/Next still walk them in order for anyone who'd rather do that. Create
   is disabled until every step validates, and names the step that isn't.

   Everything the wizard collects is written through collectState()'s own
   shape, so a created character is indistinguishable from a hand-built one
   — no separate "created by wizard" flavour of state to maintain.

   ---------------------------------------------------------------
   INPUT HANDLING — the rule that keeps this dialog usable.

   Two bugs came out of redrawing the dialog body at the wrong moment, and
   both are easy to reintroduce:

     - Rebuilding on `input` replaces the field you are typing into, so it
       loses focus after one character.
     - Rebuilding on `change` for a TEXT or NUMBER box fires on blur — i.e.
       as you click the next control — which detaches that control before
       its own click resolves, so the click silently does nothing.

   The rule: text boxes rebuild on `input` and then restore focus and caret
   (renderCreatorKeepingFocus); number boxes never rebuild at all, updating
   only the readouts derived from them; nothing at all rebuilds on `change`
   of a text or number box.
   ============================================================ */

/* Standard array and point buy, PHB p13. POINT_COST is the book's table verbatim. */
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const POINT_BUY_BUDGET = 27;
const CREATOR_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const CREATOR_STEPS = ["Race", "Class", "Ability Scores", "Description", "Equipment"];
const SIZE_NAMES = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan", V: "Varies" };

/* Wizard state. Rebuilt from scratch on every open — a half-finished character is never persisted,
   so closing the dialog genuinely discards it rather than leaving a partial entry on the tab bar. */
let CREATOR = null;

function blankCreator() {
  return {
    step: 1,
    race: "", subrace: "", size: "",
    racialChoice: {},                                    // "<blockIndex>:<slot>" -> ability, for a race's `choose` increases
    customOrigin: false,                                 // TCE p8: reassign the race's fixed increases freely
    originChoice: {},                                    // "fixed:<n>" -> ability, when customOrigin is on
    srcOff: { race: {}, class: {}, background: {} },     // books switched off in the pickers
    classes: [{ name: "", sub: "", lvl: 1 }],            // multiclass from the start, same shape as the Classes table
    // standard | pointbuy | roll | manual. A campaign that has settled on a method (House Rules →
    // Settings) opens the wizard on it, so the common case is zero clicks; still switchable per
    // character, since the ruleset is a default rather than a lock.
    method: (typeof hrSetting === "function" && hrSetting("abilityMethod")) || "standard",
    scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    assign: {},                                          // ability -> index into STANDARD_ARRAY / rolled
    rolled: [],                                          // 4d6kh3 results, when method === "roll"
    name: "", background: "", customBg: false,
    bgSkills: ["", ""], bgTools: ["", ""], bgFeature: "",   // custom background (PHB p125)
    equipMode: "package",                                // package | gold
    equipPick: {},                                       // startingEquipment line index -> "a" | "b"
    startGold: null, goldAveraged: false,                // starting gold, rolled or averaged, when equipMode === "gold"
    higherLevel: false, campaignMagic: "standard",       // DMG p38, characters starting above 1st level
    higherGold: null, higherRoll: null,
  };
}

function creatorTotalLevel() { return CREATOR.classes.reduce((s, c) => s + (Number(c.lvl) || 0), 0); }

/* ============================================================
   RACIAL ABILITY INCREASES

   5e.tools stores these as an `ability` array on the race and on each
   subrace. Three things about that shape are easy to get wrong, and this
   sheet got all three wrong before:

   1. `choose` blocks carry an `amount`. { choose: { from, count } } is
      "+1 to N of these"; { choose: { from, amount: 2 } } is "+2 to one of
      these" (Custom Lineage). Assuming +1 silently halves the second.

   2. A subrace's block sometimes ADDS to the race's and sometimes REPLACES
      it, and the data does not say which. Dwarf gives CON +2 and Mountain
      Dwarf adds STR +2 — additive, and correct RAW at +4 total. But
      Dragonborn gives STR +2/CHA +1 and its Draconblood subrace (EGW)
      gives INT +2/CHA +1, which is that subrace's *whole* increase, not an
      extra +3 on top.

      The rule used here: a subrace block that is already a complete racial
      increase — totalling 3 or more, or containing a `choose` — replaces;
      anything smaller adds. That is right for every PHB and EGW case, and
      where it is wrong the numbers are visible and editable in step 1
      rather than silently baked in.

   3. Several races (mostly MPMM reprints) carry no `ability` at all,
      because their increase is the "choose any +2 and +1" floating rule.
      Those come through as zero, which is why the increases are editable:
      an empty result is a prompt, not an answer.
   ============================================================ */
function abilityBlockTotal(b) {
  let t = 0;
  Object.entries(b || {}).forEach(([k, v]) => {
    if (k === "choose") { t += (Number(v.count) || 1) * (Number(v.amount) || 1); return; }
    if (CREATOR_ABILITIES.includes(k) && typeof v === "number") t += v;
  });
  return t;
}
function blockHasChoose(b) { return !!(b && b.choose && Array.isArray(b.choose.from)); }

/* Returns { fixed: {ab: n}, choose: [{ from, count, amount }] } for a race+subrace pair. */
function racialAbilityBonus(raceName, subraceName) {
  const out = { fixed: {}, choose: [] };
  const rec = (typeof ciFindRace === "function") ? ciFindRace(raceName) : null;
  if (!rec) return out;
  const sub = findSubByName(rec, subraceName);
  const subBlocks = (sub && sub.ability) || [];
  const subReplaces = subBlocks.some(b => abilityBlockTotal(b) >= 3 || blockHasChoose(b));
  const blocks = subReplaces ? subBlocks.slice() : [].concat(rec.ability || [], subBlocks);

  blocks.forEach(b => {
    if (!b || typeof b !== "object") return;
    Object.entries(b).forEach(([k, v]) => {
      if (k === "choose") {
        if (v && Array.isArray(v.from)) out.choose.push({ from: v.from, count: Number(v.count) || 1, amount: Number(v.amount) || 1 });
        return;
      }
      if (CREATOR_ABILITIES.includes(k) && typeof v === "number") out.fixed[k] = (out.fixed[k] || 0) + v;
    });
  });
  return out;
}

/* ----- Customizing Your Origin (TCE p8) -----
   "Take any ability score increase you gain in your race or subrace and apply it to an ability score
   of your choice. If you gain more than one increase, you can't apply those increases to the same
   ability score."

   So with the option on, a race's FIXED increases become free picks that keep their sizes: a Mountain
   Dwarf's CON +2 / STR +2 turns into two +2s you assign, and a Tiefling's CHA +2 / INT +1 into a +2
   and a +1. Blocks the race already leaves to choice are unaffected — they were already free.

   The rule is per-increase, not per-point: a +2 stays a +2 and can't be split into two +1s. And no
   two increases may land on the same ability, which is what makes the pickers disable a taken score. */
function fixedIncreaseSlots() {
  const bonus = racialAbilityBonus(CREATOR.race, CREATOR.subrace);
  return Object.entries(bonus.fixed).map(([ab, amount], i) => ({ key: "fixed:" + i, from: CREATOR_ABILITIES, amount, was: ab }));
}

/* Every increase you have to choose an ability for, as a flat list — one entry per pick, so a
   "+1 to two of your choice" race yields two slots and each gets its own dropdown. Keys are what
   CREATOR.racialChoice / CREATOR.originChoice are keyed by, and are stable as long as the race is. */
function racialChoiceSlots() {
  const bonus = racialAbilityBonus(CREATOR.race, CREATOR.subrace);
  const slots = [];
  bonus.choose.forEach((c, bi) => {
    for (let i = 0; i < c.count; i++) slots.push({ key: bi + ":" + i, from: c.from, amount: c.amount, store: "racialChoice" });
  });
  if (CREATOR.customOrigin) fixedIncreaseSlots().forEach(s => slots.push({ ...s, store: "originChoice" }));
  return slots;
}
function slotValue(s) { return CREATOR[s.store][s.key] || ""; }
function setSlotValue(s, v) { CREATOR[s.store][s.key] = v; }

/* The increase a single ability actually gets. With custom origin off that's the race's fixed part
   plus any chosen slots; with it on, the fixed part is no longer attached to its original ability at
   all and comes entirely from the reassignment pickers. */
function racialIncrease(ab) {
  const bonus = racialAbilityBonus(CREATOR.race, CREATOR.subrace);
  let inc = CREATOR.customOrigin ? 0 : (bonus.fixed[ab] || 0);
  racialChoiceSlots().forEach(s => { if (slotValue(s) === ab) inc += s.amount; });
  return inc;
}

/* Final score for one ability: the base from whichever generation method is active, plus racial. */
function creatorFinalScore(ab) {
  return Math.max(1, Math.min(30, CREATOR.scores[ab] + racialIncrease(ab)));
}

function pointsSpent() {
  return CREATOR_ABILITIES.reduce((s, ab) => s + (POINT_COST[CREATOR.scores[ab]] != null ? POINT_COST[CREATOR.scores[ab]] : 0), 0);
}

/* ----- pickers -----
   A combobox: a text box you can type in, with a datalist so the browser filters the full list as
   you type. It is deliberately NOT a plain <select> — the lists here run to ninety-odd races, and
   typing three letters beats scrolling. It is also not a bare text box: everything valid is one
   keystroke and a click away, and the list is the documentation for what the loaded data contains.

   Free text is still accepted, on purpose. The libraries are user-supplied (see DOCS' "Where game
   data comes from") and may be absent entirely, so a race the sheet has never heard of has to remain
   typeable — the datalist is a convenience, never a gate. */
function creatorCombo(id, value, options, placeholder, extraClass, width, banKind, banPrefix) {
  return comboboxHtml({ id, value, options, placeholder, extraClass, width: width || "12rem", banKind, banPrefix });
}
/* Same control for one row of the class table — ids have to be per-row, so these carry a data-crrow
   index and a class instead of an id. */
function creatorRowCombo(cls, row, value, options, placeholder, banKind, banPrefix) {
  return comboboxHtml({ value, options, placeholder, extraClass: cls, width: "11rem",
    dataAttr: `data-crrow="${row}"`, banKind, banPrefix });
}

/* ----- source filters -----
   Race, class and background lists run to ninety-odd entries drawn from sixty-odd books, most of
   which a given table isn't using. These narrow the combobox lists the same way the Spell and
   Equipment libraries' own Source filters narrow their results: pick the books you play with and
   everything else disappears from the pickers.

   Deliberately simpler than filters.js' tri-state engine: there is nothing here to exclude *and*
   include *and* combine — one flat list of books, all on by default, click to toggle. A tri-state
   chip row would be more machinery than the question needs. Selections are per-wizard-session, not
   persisted, since they're a browsing aid rather than part of the character. */
function creatorSources(lib) { return [...new Set(Object.values(lib).map(r => r.source).filter(Boolean))].sort(); }

function sourceFilterHtml(kind, lib) {
  const srcs = creatorSources(lib);
  if (srcs.length < 2) return "";                 // one book (or none): nothing to choose between
  const off = CREATOR.srcOff[kind] || {};
  const chips = srcs.map(s => {
    const on = !off[s];
    const full = (typeof SOURCE_NAMES !== "undefined" && SOURCE_NAMES[s]) || s;
    return `<button type="button" class="fbtn cr-src${on ? " inc" : ""}" data-crsrc="${kind}" data-src="${escapeHtml(s)}"
      title="${escapeHtml(full)}">${escapeHtml(s)}</button>`;
  }).join("");
  const anyOff = Object.values(off).some(Boolean);
  return `<details class="cr-sources"${anyOff ? " open" : ""}><summary class="hint">Books (${srcs.length - Object.values(off).filter(Boolean).length}/${srcs.length})</summary>
    <div>${chips}</div>
    <div><button type="button" class="cr-src-all" data-crsrc="${kind}">all</button>
      <button type="button" class="cr-src-none" data-crsrc="${kind}">none</button>
      <span class="hint">click a book to hide its entries from the list below</span></div></details>`;
}
/* Names from `lib`, minus anything from a book that's been switched off. The currently-selected
   value always survives the filter — hiding a book shouldn't silently blank a choice already made. */
function filteredNames(kind, lib, keep) {
  const off = CREATOR.srcOff[kind] || {};
  return Object.values(lib)
    .filter(r => !off[r.source] || (keep && r.name.toLowerCase() === keep.toLowerCase()))
    .map(r => r.name).sort();
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

/* ----- racial ability-increase controls -----
   Rendered identically in step 1 (where you pick your race and want to see what it gave you) and in
   step 3 (where you're assigning scores and want the increases in front of you). Both read and write
   the same CREATOR.racialChoice, so they are the same control in two places, not two controls. */
function racialAsiHtml() {
  const bonus = racialAbilityBonus(CREATOR.race, CREATOR.subrace);
  const slots = racialChoiceSlots();
  const hasFixed = Object.keys(bonus.fixed).length > 0;
  const fixedTxt = Object.entries(bonus.fixed).map(([k, v]) => `${k.toUpperCase()} ${sign(v)}`).join(", ");

  const customToggle = hasFixed ? `<label class="hint" style="margin-left:.6rem" title="Tasha's Cauldron of Everything p8: apply each of your race's ability score increases to an ability of your choice instead.">
      <input type="checkbox" id="cr-custom-origin"${CREATOR.customOrigin ? " checked" : ""}> customise (TCE p8)</label>` : "";

  if (!hasFixed && !slots.length) {
    return CREATOR.race
      ? `<div class="hint">No ability increase in your data for this race. Several races (mostly Monsters of the Multiverse reprints) use the floating "+2 and +1 to any" rule instead, which isn't stored as a fixed increase &mdash; set the scores yourself in step 3.</div>`
      : `<div class="hint">Pick a race to see its ability increases.</div>`;
  }

  const taken = new Set(slots.map(slotValue).filter(Boolean));
  const slotHtml = slots.map(s => {
    const chosen = slotValue(s);
    const opts = s.from.map(ab => {
      const disabled = taken.has(ab) && chosen !== ab;   // TCE p8 and 5e generally: no two increases on one score
      return `<option value="${ab}"${chosen === ab ? " selected" : ""}${disabled ? " disabled" : ""}>${ab.toUpperCase()}</option>`;
    }).join("");
    return `<label class="cr-racial-slot">${sign(s.amount)} to
      <select class="cr-racial" data-crslot="${s.key}" data-crstore="${s.store}"><option value="">— choose —</option>${opts}</select>${s.was && CREATOR.customOrigin ? ` <span class="hint">(was ${s.was.toUpperCase()})</span>` : ""}</label>`;
  }).join(" ");

  const fixedPart = (hasFixed && !CREATOR.customOrigin) ? `<b>${fixedTxt}</b>` : "";
  return `<div style="margin-top:.3rem">${fixedPart}${fixedPart && slotHtml ? " &middot; " : ""}${slotHtml}${customToggle}</div>`;
}

/* Traits the race and subrace grant. Shown in step 1 so the choices a race makes you responsible for
   are visible while you're picking it — Simic Hybrid's Animal Enhancement, a Variant Human's feat,
   any "of your choice" language or skill. The sheet can't resolve those into fields (they're prose,
   and each one is different), so they're flagged rather than automated; the Features module shows
   the full text once the character exists. */
const CHOICE_CUE = /\b(choose|of your choice|choice of|select one|either)\b/i;
function raceTraitsHtml() {
  const rec = ciFindRace(CREATOR.race);
  if (!rec) return "";
  const sub = findSubByName(rec, CREATOR.subrace);
  // A subrace trait with the same name as a race trait overrides it (5e.tools' own `overwrite` flag).
  const byName = new Map();
  (rec.entries || []).forEach(e => byName.set(e.name, e));
  ((sub && sub.entries) || []).forEach(e => byName.set(e.name, e));
  const traits = [...byName.values()].filter(e => !/^(Age|Alignment|Languages|Size)$/i.test(e.name));
  if (!traits.length) return "";
  const withChoice = traits.filter(e => CHOICE_CUE.test(e.text || ""));
  return `<div style="margin-top:.5rem"><b>Traits</b>
    <div class="hint">${traits.map(e => CHOICE_CUE.test(e.text || "")
      ? `<b class="cr-choice-trait" title="${escapeHtml((e.text || "").slice(0, 400))}">${escapeHtml(e.name)} &#9998;</b>`
      : `<span title="${escapeHtml((e.text || "").slice(0, 400))}">${escapeHtml(e.name)}</span>`).join(" &middot; ")}</div>
    ${withChoice.length ? `<div class="hint">Marked traits (&#9998;) involve a choice you make yourself &mdash;
      the full text is in the Features module once the character exists, and anything mechanical goes in the
      Proficiencies, Skills or Spellcasting modules. The sheet doesn't guess these for you.</div>` : ""}</div>`;
}

/* Size. Most races are one size; a few (Dhampir, Fairy, and the other MPMM "Small or Medium" races)
   genuinely leave it to the player, so those get a picker rather than an arbitrary pick. */
function raceSizeHtml() {
  const rec = ciFindRace(CREATOR.race);
  const sizes = (rec && rec.size) || [];
  if (sizes.length <= 1) {
    return sizes.length ? `<div class="hint" style="margin-top:.3rem">Size: <b>${SIZE_NAMES[sizes[0]] || sizes[0]}</b></div>` : "";
  }
  return `<div style="margin-top:.3rem"><label>Size
    <select id="cr-size">${sizes.map(s => `<option value="${s}"${CREATOR.size === s ? " selected" : ""}>${SIZE_NAMES[s] || s}</option>`).join("")}</select></label>
    <span class="hint">this race lets you choose</span></div>`;
}

/* ----- multiclassing prerequisites, PHB p163 -----
   5e.tools stores these as { str: 13 } or { or: [{ str: 13 }, { dex: 13 }] }. RAW you must meet the
   prerequisite for BOTH the class you're leaving and the one you're entering, so with three classes
   every one of them has to qualify — which is what checking each row independently amounts to.
   Only checked when there is more than one class: a single-class character has no prerequisite. */
function mcRequirementText(req) {
  if (!req) return "";
  const one = r => Object.entries(r).map(([ab, n]) => `${ab.toUpperCase()} ${n}`).join(" and ");
  if (req.or) return req.or.map(one).join(" or ");
  return one(req);
}
function meetsMcRequirement(req, scoreOf) {
  if (!req) return true;
  const ok = r => Object.entries(r).every(([ab, n]) => scoreOf(ab) >= n);
  if (req.or) return req.or.some(ok);
  return ok(req);
}
/* Which class rows fail their prerequisite, given a score lookup. Returns [{ name, need }]. */
function mcFailures(rows, scoreOf) {
  const named = rows.filter(r => (r.name || "").trim());
  if (named.length < 2) return [];
  return named.map(r => {
    const rec = ciFindClass(r.name);
    if (!rec || !rec.mcReq) return null;                       // no data for this class: nothing to check against
    return meetsMcRequirement(rec.mcReq, scoreOf) ? null : { name: r.name, need: mcRequirementText(rec.mcReq) };
  }).filter(Boolean);
}

/* ----- starting equipment, PHB p14 -----
   5e.tools' `startingEquipment.defaultData` is a list of lines, each an { a: [...], b: [...] } pair
   ("(a) chain mail or (b) leather armor, longbow, and 20 arrows"). Leaves are either "item|source"
   strings or { item, quantity } / { equipmentType } objects. An equipmentType is a *filter* ("any
   martial weapon"), not an item, so it can't be resolved to something addable — those lines are
   listed for you to pick from the Equipment Library yourself, the same way granted-spell filters are
   handled in the Features module. */
function eqLeafName(leaf) {
  if (typeof leaf === "string") return leaf.split("|")[0];
  if (leaf && leaf.item) return String(leaf.item).split("|")[0];
  return null;
}
function eqLeafQty(leaf) { return (leaf && leaf.quantity) || 1; }
function eqLeafLabel(leaf) {
  const n = eqLeafName(leaf);
  if (n) { const q = eqLeafQty(leaf); return q > 1 ? `${n} ×${q}` : n; }
  if (leaf && leaf.equipmentType) {
    const q = eqLeafQty(leaf);
    const pretty = String(leaf.equipmentType).replace(/([A-Z])/g, " $1").toLowerCase().trim();
    return `any ${pretty}${q > 1 ? ` ×${q}` : ""} (pick it yourself)`;
  }
  return "?";
}
function startingEquipmentLines() {
  const first = CREATOR.classes[0];
  const rec = first && first.name ? ciFindClass(first.name) : null;
  const data = rec && rec.startEq && rec.startEq.defaultData;
  return Array.isArray(data) ? data : [];
}
function startingGoldDice() {
  const first = CREATOR.classes[0];
  const rec = first && first.name ? ciFindClass(first.name) : null;
  const alt = rec && rec.startEq && rec.startEq.goldAlternative;
  if (!alt) return null;
  // "{@dice 5d4 × 10|5d4 × 10|Starting Gold}" -> "5d4 × 10"
  const m = String(alt).match(/\{@dice ([^|}]+)/);
  return m ? m[1].trim() : String(alt);
}

/* DMG p38, "Starting at Higher Level". gp is a flat amount plus 1d10 × mult; items is the book's own
   wording for what magic items the DM hands out, which this sheet reports rather than grants — it has
   no random-magic-item table and inventing one would be worse than saying what you're owed. */
const HIGHER_LEVEL_START = [
  { min: 1, max: 4, gp: 0, mult: 0, items: { low: "", standard: "", high: "" } },
  { min: 5, max: 10, gp: 500, mult: 25, items: { low: "", standard: "", high: "one uncommon magic item" } },
  { min: 11, max: 16, gp: 5000, mult: 250, items: { low: "one uncommon magic item", standard: "two uncommon magic items", high: "three uncommon magic items and one rare item" } },
  { min: 17, max: 20, gp: 20000, mult: 250, items: { low: "two uncommon magic items", standard: "two uncommon magic items and one rare item", high: "three uncommon magic items, two rare items, and one very rare item" } },
];
function higherLevelBand(level) { return HIGHER_LEVEL_START.find(b => level >= b.min && level <= b.max) || HIGHER_LEVEL_START[0]; }

/* ----- step rendering -----
   Each step returns plain HTML; the shell wires the shared Back/Next/Create controls, so a step only
   has to describe its own fields and its own validity (see creatorStepBlockerFor). */

/* Two small readouts that a typed number changes, factored out so the `input` handler can refresh
   just them without redrawing the step (see this file's header on why that matters). */
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

function creatorStepHtml() {
  const c = CREATOR;

  if (c.step === 1) {
    const races = filteredNames("race", RACE_LIB, c.race);
    const rec = ciFindRace(c.race);
    const subs = subNames(rec);
    return `<div class="cr-step"><b>Step 1 &middot; Choose a Race</b> <span class="hint">PHB p11</span>
      <div class="hint">Your race sets your general appearance, natural talents, and one or more ability score increases.</div>
      ${sourceFilterHtml("race", RACE_LIB)}
      <label>Race ${creatorCombo("cr-race", c.race, races, races.length ? "type to search" : "no race data — type freely", "", "", "race")}</label>
      ${subs.length || c.subrace ? `<label style="margin-left:.6rem">Subrace ${creatorCombo("cr-subrace", c.subrace, subs, "none", "", "", "race")}</label>` : ""}
      ${subs.includes(BASE_SUBRACE) ? `<div class="hint"><b>(base)</b> is this race's default version, the one with no subrace of its own &mdash; for a PHB Human that's the +1-to-everything build, as opposed to Variant.</div>` : ""}
      <div style="margin-top:.4rem"><b>Ability increases</b> <span class="hint">applied to your scores in step 3</span></div>
      ${racialAsiHtml()}
      ${raceSizeHtml()}
      ${raceTraitsHtml()}
    </div>`;
  }

  if (c.step === 2) {
    const total = creatorTotalLevel();
    const rows = c.classes.map((row, i) => {
      const rec = ciFindClass(row.name);
      const hd = row.name ? classHitDie(row.name) : "";
      return `<tr>
        <td>${creatorRowCombo("cr-cls", i, row.name, filteredNames("class", CLASS_LIB, row.name), "type to search", "class")}</td>
        <td>${creatorRowCombo("cr-sub", i, row.sub, subNames(rec), "no subclass", "subclass", rec ? rec.name + ": " : "")}</td>
        <td><input type="number" class="tiny cr-lvl" data-crrow="${i}" min="1" max="20" value="${row.lvl}"></td>
        <td class="hint">${hd || ""}</td>
        <td>${c.classes.length > 1 ? `<button type="button" class="cr-cls-del" data-crrow="${i}" title="remove this class">&times;</button>` : ""}</td>
      </tr>`;
    }).join("");
    const fails = mcFailures(c.classes, creatorFinalScore);
    return `<div class="cr-step"><b>Step 2 &middot; Choose a Class</b> <span class="hint">PHB p11</span>
      <div class="hint">Your class sets your hit die, proficiencies, and the features you gain. <b>Level</b> starts at 1 &mdash; raise it if you're joining an existing campaign above 1st level (PHB p11). Add a second class to start multiclassed.</div>
      ${sourceFilterHtml("class", CLASS_LIB)}
      <table class="cr-classes"><tr class="hint"><td>Class</td><td>Subclass</td><td>Level</td><td>Hit Die</td><td></td></tr>${rows}</table>
      <div style="margin-top:.3rem">${
        // Multiclassing can be switched off as a house rule (see src/house-rules.js). The control
        // disappears rather than erroring on click, and says why, so an absent button never reads
        // as a broken sheet.
        (typeof hrSetting === "function" && hrSetting("multiclass") === false)
          ? `<span class="hint">Multiclassing is off in this campaign's House Rules.</span>`
          : `<button type="button" id="cr-add-class">+ add a class</button>`}
        <span class="hint" style="margin-left:.6rem">Total level <b id="cr-total-level" class="${total > 20 ? "cr-over" : ""}">${total}</b> / 20</span></div>
      ${c.classes.filter(r => r.name.trim()).length > 1 ? `<div class="hint" style="margin-top:.4rem">
        <b>Multiclassing prerequisites (PHB p163)</b> &mdash; you need the listed scores in <i>every</i> class you're combining, checked against your step-3 scores:
        <div>${c.classes.filter(r => r.name.trim()).map(r => {
          const rec = ciFindClass(r.name);
          if (!rec || !rec.mcReq) return `${escapeHtml(r.name)}: <span class="hint">not in your data</span>`;
          const ok = meetsMcRequirement(rec.mcReq, creatorFinalScore);
          return `${escapeHtml(r.name)}: <b class="${ok ? "cr-ok" : "cr-over"}">${escapeHtml(mcRequirementText(rec.mcReq))}</b>`;
        }).join(" &middot; ")}</div>${fails.length ? "" : `<div>All prerequisites met.</div>`}</div>` : ""}
      <div class="hint" id="cr-step2-hint" style="margin-top:.4rem">${creatorStep2Hint()}</div>
    </div>`;
  }

  if (c.step === 3) {
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
      const inc = racialIncrease(ab);
      return `<tr><td>${ab.toUpperCase()}</td><td>${control}</td>
        <td class="hint">${inc ? `+${inc} racial` : ""}</td>
        <td id="cr-final-${ab}">${creatorFinalCell(ab)}</td></tr>`;
    }).join("");
    return `<div class="cr-step"><b>Step 3 &middot; Determine Ability Scores</b> <span class="hint">PHB p12&ndash;13</span>
      <div style="margin:.3rem 0">
        ${methodBtn("standard", "Standard array", "15, 14, 13, 12, 10, 8 (PHB p13)")}
        ${methodBtn("pointbuy", "Point buy", "27 points, scores 8–15 (PHB p13 variant)")}
        ${methodBtn("roll", "Roll 4d6 drop lowest", "roll six sets of 4d6, keeping the highest three (PHB p12)")}
        ${methodBtn("manual", "Enter manually", "type scores straight in")}
      </div>
      ${poolHtml}
      <table class="cr-scores">${rows}</table>
      <div style="margin-top:.5rem"><b>Racial increases</b> <span class="hint">from step 1 &mdash; the same control, so changing it here changes it there</span></div>
      ${racialAsiHtml()}
    </div>`;
  }

  if (c.step === 4) {
    const bgs = filteredNames("background", BACKGROUND_LIB, c.background);
    const rec = !c.customBg ? ciFindBackground(c.background) : null;
    return `<div class="cr-step"><b>Step 4 &middot; Describe Your Character</b> <span class="hint">PHB p13, p125</span>
      <div class="hint">A background grants two skill proficiencies, often tools or languages, a feature, and its own equipment.</div>
      ${sourceFilterHtml("background", BACKGROUND_LIB)}
      <label>Name <input type="text" id="cr-name" value="${escapeHtml(c.name)}" style="width:14rem"></label>
      <label style="margin-left:.6rem">Background ${creatorCombo("cr-background", c.background, bgs, bgs.length ? "type to search" : "no background data — type freely", "", "", "background")}</label>
      <label style="margin-left:.6rem"><input type="checkbox" id="cr-custom-bg"${c.customBg ? " checked" : ""}> custom background</label>
      ${!bgs.length ? `<div class="hint">No <code>data/backgrounds.json</code> loaded, so there's nothing to look up &mdash; the name is recorded and its proficiencies are yours to add. Drop that file next to the sheet (see the Features module) to get the full list.</div>` : ""}
      ${c.customBg ? customBackgroundHtml() : backgroundSummaryHtml(rec)}
      <div class="hint" style="margin-top:.4rem">Personality traits, ideals, bonds, flaws, backstory and appearance are deliberately not tracked on this sheet (see DOCS' roadmap) &mdash; it targets optimised play, so that material belongs in your own notes.</div>
    </div>`;
  }

  // Step 5
  return creatorStep5Html();
}

/* What a chosen background actually gives you, and what of it the sheet will apply. Skills go to the
   Skills module, tools and languages to Proficiencies; a `choose` block is a decision, so it's shown
   as one rather than silently resolved. */
function profListText(list) {
  if (!Array.isArray(list) || !list.length) return "";
  const out = [];
  list.forEach(entry => {
    Object.entries(entry || {}).forEach(([k, v]) => {
      if (k === "choose") {
        const from = (v.from || []).map(x => String(x).replace(/\|.*/, ""));
        out.push(`choose ${v.count || 1} of: ${from.join(", ")}`);
      } else if (k === "any") { out.push(`any ${v}`);
      } else if (k === "anyStandard") { out.push(`any ${v} standard language(s)`);
      } else if (v === true) { out.push(String(k).replace(/\|.*/, "")); }
    });
  });
  return out.join("; ");
}
/* The names a proficiency block grants outright — `choose`/`any` blocks contribute nothing, since
   they're an outstanding decision rather than a grant. */
function flatProfNames(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach(entry => {
    Object.entries(entry || {}).forEach(([k, v]) => {
      if (k === "choose" || k === "any" || k === "anyStandard") return;
      if (v === true) out.push(String(k).replace(/\|.*/, ""));
    });
  });
  return out;
}
function backgroundSummaryHtml(rec) {
  if (!rec) return "";
  const parts = [];
  const sk = profListText(rec.skills); if (sk) parts.push(`<b>Skills</b> ${escapeHtml(sk)}`);
  const tl = profListText(rec.tools); if (tl) parts.push(`<b>Tools</b> ${escapeHtml(tl)}`);
  const lg = profListText(rec.languages); if (lg) parts.push(`<b>Languages</b> ${escapeHtml(lg)}`);
  if (rec.feature) parts.push(`<b>Feature</b> ${escapeHtml(rec.feature.name)}`);
  return `<div class="hint" style="margin-top:.4rem">${parts.join(" &middot; ") || "No mechanical details in your data for this background."}
    ${rec.equipmentText ? `<div><b>Equipment</b> ${escapeHtml(rec.equipmentText)}</div>` : ""}
    <div>Skill proficiencies are applied to the Skills module; tools and languages to Proficiencies. Anything listed as a choice is yours to make there.</div></div>`;
}

/* Custom background, PHB p125: any two skills, any two tool proficiencies or languages, and one
   feature borrowed from any background. The book also has you pick personality traits/ideals/bonds/
   flaws, which this sheet doesn't track at all (see the roadmap), so those aren't asked for. */
function customBackgroundHtml() {
  const skillNames = (typeof SKILLS !== "undefined") ? SKILLS.map(s => s[0]) : [];   // SKILLS is [name, ability] pairs (data.js)
  const features = Object.values(BACKGROUND_LIB).filter(b => b.feature).map(b => `${b.feature.name} (${b.name})`).sort();
  const pick = (arr, i, cls, list, ph) =>
    `${creatorCombo(`cr-${cls}-${i}`, arr[i] || "", list, ph, cls, "11rem")}`;
  return `<div style="margin-top:.4rem" class="cr-custom-bg">
    <div class="hint">PHB p125: replace one feature with any other, choose any two skills, and choose two tool proficiencies or languages in total.</div>
    <div style="margin-top:.3rem">Skills ${pick(CREATOR.bgSkills, 0, "cr-bgskill", skillNames, "any skill")} ${pick(CREATOR.bgSkills, 1, "cr-bgskill", skillNames, "any skill")}</div>
    <div style="margin-top:.3rem">Tools / languages ${pick(CREATOR.bgTools, 0, "cr-bgtool", [], "tool or language")} ${pick(CREATOR.bgTools, 1, "cr-bgtool", [], "tool or language")}</div>
    <div style="margin-top:.3rem">Feature ${creatorCombo("cr-bgfeature", CREATOR.bgFeature, features, features.length ? "any background's feature" : "name your feature", "", "16rem")}</div>
  </div>`;
}

function creatorStep5Html() {
  const c = CREATOR;
  const first = c.classes[0] || { name: "", sub: "", lvl: 1 };
  const hd = first.name ? classHitDie(first.name) : "";
  const conMod = mod(creatorFinalScore("con"));
  const hp = hd ? (HIT_DIE_MAX[hd] || 8) + conMod : null;
  const classTxt = c.classes.filter(r => r.name || r.lvl > 1)
    .map(r => `${escapeHtml(r.name || "no class")}${r.sub ? ` (${escapeHtml(r.sub)})` : ""} ${r.lvl}`).join(" / ") || "no class";

  const lines = startingEquipmentLines();
  const goldDice = startingGoldDice();
  const total = creatorTotalLevel();
  const band = higherLevelBand(total);

  const pkgHtml = lines.length ? lines.map((line, i) => {
    const picked = c.equipPick[i] || "a";
    const opt = (k) => line[k] ? `<label style="margin-right:.8rem"><input type="radio" name="cr-eq-${i}" value="${k}" data-creq="${i}"${picked === k ? " checked" : ""}>
      (${k}) ${escapeHtml(line[k].map(eqLeafLabel).join(", "))}</label>` : "";
    return `<div style="margin:.15rem 0">${opt("a")}${opt("b")}</div>`;
  }).join("") : `<div class="hint">No starting-equipment data for this class &mdash; add what you need from the Equipment Library.</div>`;

  return `<div class="cr-step"><b>Step 5 &middot; Choose Equipment</b> <span class="hint">PHB p14</span>
    <div class="hint">Take your class's starting equipment package, or its starting gold and buy your own (PHB p143). Items are added to Inventory by name from the Equipment Library, so weight, value and armour class come from the library entry &mdash; anything the data leaves as "any martial weapon" is a pick you make there yourself.</div>
    <div style="margin:.4rem 0">
      <button type="button" class="cr-method${c.equipMode === "package" ? " active" : ""}" data-creqmode="package">Equipment package</button>
      <button type="button" class="cr-method${c.equipMode === "gold" ? " active" : ""}" data-creqmode="gold"${goldDice ? "" : " disabled"}>Starting gold${goldDice ? ` (${escapeHtml(goldDice)})` : " — no data"}</button>
    </div>
    ${c.equipMode === "package" ? pkgHtml : `<div>
      <button type="button" id="cr-roll-gold">${c.startGold == null ? "roll" : "re-roll"} ${escapeHtml(goldDice || "")}</button>
      <button type="button" id="cr-avg-gold" title="the average of ${escapeHtml(goldDice || "")}, rounded down — the same 'take the fixed value' option the rules give for hit points">take the average${averageGold() != null ? ` (${averageGold()} gp)` : ""}</button>
      ${c.startGold != null ? ` &rarr; <b>${c.startGold} gp</b>${c.goldAveraged ? ` <span class="hint">(average)</span>` : ""}` : ` <span class="hint">roll, or take the average</span>`}
      <div class="hint">Taking gold instead of the package means you also skip your background's equipment (PHB p125).</div>
    </div>`}

    <div style="margin-top:.6rem"><label><input type="checkbox" id="cr-higher"${c.higherLevel ? " checked" : ""}>
      <b>Starting at Higher Level</b></label> <span class="hint">DMG p38 &mdash; extra gear for a character who doesn't begin at 1st level</span></div>
    ${c.higherLevel ? `<div style="margin-top:.3rem">
      <label>Campaign <select id="cr-magic">
        <option value="low"${c.campaignMagic === "low" ? " selected" : ""}>Low magic</option>
        <option value="standard"${c.campaignMagic === "standard" ? " selected" : ""}>Standard</option>
        <option value="high"${c.campaignMagic === "high" ? " selected" : ""}>High magic</option>
      </select></label>
      <span class="hint">total level ${total} &rarr; band ${band.min}&ndash;${band.max}</span>
      <div style="margin-top:.3rem">${band.gp
        ? `<button type="button" id="cr-roll-higher">${c.higherGold == null ? "roll" : "re-roll"} ${band.gp} gp + 1d10 × ${band.mult} gp</button>
           ${c.higherGold != null ? ` &rarr; <b>${c.higherGold} gp</b> <span class="hint">(1d10 rolled ${c.higherRoll})</span>` : ""}`
        : `<span class="hint">Levels 1&ndash;4 get normal starting equipment and no extra gold.</span>`}</div>
      ${band.items[c.campaignMagic] ? `<div class="hint" style="margin-top:.3rem">Your DM also gives you <b>${band.items[c.campaignMagic]}</b>. The sheet has no random magic-item table, so add those from the Equipment Library yourself &mdash; it says what you're owed rather than inventing it.</div>` : ""}
      <div class="hint">This is on top of normal starting equipment, and is "entirely at your discretion" per the DMG &mdash; check with your DM.</div>
    </div>` : ""}

    <div style="margin-top:.6rem">Ready to create:
      <b>${escapeHtml(c.name || "unnamed")}</b>, ${escapeHtml(c.race || "no race")}${c.subrace ? ` (${escapeHtml(c.subrace)})` : ""},
      ${classTxt}${c.background ? `, ${escapeHtml(c.background)}${c.customBg ? " (custom)" : ""}` : ""}</div>
    <div class="hint">${CREATOR_ABILITIES.map(ab => `${ab.toUpperCase()} ${creatorFinalScore(ab)}`).join(" &middot; ")}</div>
    ${hp != null ? `<div class="hint">Starting HP at 1st level would be ${HIT_DIE_MAX[hd]} (${hd} max) ${sign(conMod)} CON = <b>${Math.max(1, hp)}</b>; the sheet computes Max HP for your actual level automatically.</div>` : ""}
  </div>`;
}

/* Validity is asked about a *named* step rather than the current one, because the steps are freely
   navigable tabs — Create has to know whether step 3 is finished while you're standing on step 5. */
function creatorStepBlockerFor(step) {
  const c = CREATOR;
  if (step === 1) {
    // slotValue, not racialChoice directly — a TCE custom-origin slot stores in originChoice, and
    // reading only one of the two stores left the step permanently blocked.
    const unset = racialChoiceSlots().filter(s => !slotValue(s)).length;
    if (unset) return `Choose ${unset} more racial ability increase${unset === 1 ? "" : "s"}.`;
  }
  if (step === 2) {
    const total = creatorTotalLevel();
    if (c.classes.some(r => (Number(r.lvl) || 0) < 1)) return "Every class needs at least 1 level.";
    if (total > 20) return `Total level is ${total} — the cap is 20.`;
    const fails = mcFailures(c.classes, creatorFinalScore);
    if (fails.length) return `Multiclassing needs ${fails.map(f => `${f.need} for ${f.name}`).join("; ")} (PHB p163).`;
  }
  if (step === 3) {
    if (c.method === "pointbuy" && pointsSpent() > POINT_BUY_BUDGET) return `Over budget by ${pointsSpent() - POINT_BUY_BUDGET} point(s).`;
    if (c.method === "standard" || c.method === "roll") {
      if (c.method === "roll" && !c.rolled.length) return "Roll a set of scores first.";
      if (!CREATOR_ABILITIES.every(ab => c.assign[ab] != null)) return "Assign every number to an ability.";
    }
  }
  if (step === 5 && c.equipMode === "gold" && startingGoldDice() && c.startGold == null) return "Roll your starting gold, or take the equipment package.";
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
    const n = i + 1, bad = creatorStepBlockerFor(n);
    return `<button type="button" class="cr-tab${CREATOR.step === n ? " active" : ""}${bad ? " cr-tab-bad" : ""}" data-crstep="${n}"
      title="${bad ? escapeHtml(bad) : `go to step ${n}`}"><span class="hint">${n}</span> ${escapeHtml(label)}</button>`;
  }).join("");
}

/* Chrome only — the stepper, blocker line and button states. Split out from renderCreator so an edit
   that changes nothing about the step's own controls can refresh what's derived from it WITHOUT
   replacing cr-body. */
function renderCreatorChrome() {
  $("cr-stepper").innerHTML = creatorStepperHtml();
  $("cr-back").disabled = CREATOR.step === 1;
  const last = CREATOR.step === 5;
  $("cr-next").style.display = last ? "none" : "";
  $("cr-create").style.display = last ? "" : "none";
  const here = creatorStepBlocker();
  const anywhere = creatorFirstBlocker();
  $("cr-blocker").textContent = here || (anywhere ? `Step ${anywhere.step}: ${anywhere.msg}` : "");
  $("cr-next").disabled = !!here;
  $("cr-create").disabled = !!anywhere;
}

function renderCreator() {
  const modal = $("creator-modal"); if (!modal || modal.style.display === "none") return;
  $("cr-body").innerHTML = creatorStepHtml();
  renderCreatorChrome();
  // The comboboxes are fresh elements after every redraw, and their dropdown panel lives outside
  // cr-body — so it has to be re-attached to whichever field still has focus. See combobox.js.
  if (typeof initComboboxes === "function") initComboboxes($("cr-body"));
}

/* Redraw, then put the cursor back where it was. Typing in a combobox has to redraw — the subrace
   list, the ability increases and the traits all depend on the race you're halfway through typing —
   but redrawing replaces the box itself, so focus and caret are restored afterwards. */
function renderCreatorKeepingFocus(el) {
  const id = el.id, cls = el.className, row = el.dataset.crrow, pos = el.selectionStart;
  renderCreator();
  const again = id ? $(id) : document.querySelector(`.${cls.split(/\s+/).filter(Boolean).join(".")}[data-crrow="${row}"]`);
  if (!again) return;
  again.focus();
  try { again.setSelectionRange(pos, pos); } catch (e) { /* not a text input; focus alone is enough */ }
  // The dropdown is reopened by combobox.js's own deferred input handler, which resolves against
  // whatever ends up focused — this function's job is only to make sure that's the right field.
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

/* Starting gold, e.g. "5d4 × 10". Parsed rather than hardcoded per class, and logged like any roll. */
function parseGoldSpec(spec) {
  const m = (spec || "").match(/(\d+)d(\d+)\s*(?:[×x*]\s*(\d+))?/i);
  return m ? { n: Number(m[1]), faces: Number(m[2]), mult: Number(m[3] || 1) } : null;
}
/* The average of the class's starting-gold dice, rounded down — the same "take the fixed value
   instead of rolling" choice the rules offer for hit points, applied to the one other roll character
   creation asks for. A Fighter's 5d4 × 10 averages 125 gp. */
function averageGold() {
  const g = parseGoldSpec(startingGoldDice()); if (!g) return null;
  return Math.floor(g.n * (g.faces + 1) / 2 * g.mult);
}
function creatorRollGold() {
  const spec = startingGoldDice(); const g = parseGoldSpec(spec); if (!g) return;
  let sum = 0; const rolls = [];
  for (let i = 0; i < g.n; i++) { const d = rollDie(g.faces); rolls.push(d); sum += d; }
  CREATOR.startGold = sum * g.mult;
  CREATOR.goldAveraged = false;
  logEvent("roll", `<b>${CREATOR.startGold} gp</b> &larr; starting gold (${escapeHtml(spec)}: ${rolls.join(",")})`);
}
function creatorAverageGold() {
  const avg = averageGold(); if (avg == null) return;
  CREATOR.startGold = avg;
  CREATOR.goldAveraged = true;
  logEvent("info", `Starting gold: <b>${avg} gp</b> &mdash; average of ${escapeHtml(startingGoldDice() || "")}, taken instead of rolling`);
}
function creatorRollHigherGold() {
  const band = higherLevelBand(creatorTotalLevel());
  if (!band.gp) { CREATOR.higherGold = 0; CREATOR.higherRoll = 0; return; }
  const d = rollDie(10);
  CREATOR.higherRoll = d;
  CREATOR.higherGold = band.gp + d * band.mult;
  logEvent("roll", `<b>${CREATOR.higherGold} gp</b> &larr; starting at higher level (DMG p38: ${band.gp} + 1d10 (${d}) × ${band.mult})`);
}

/* The chosen race/subrace's walking speed, in feet — or null if the race isn't recognized or its
   data doesn't say. Left for the player to fill in by hand in that case, same as everything else
   the wizard can't resolve; see raceWalkSpeed in class-library.js for the two shapes 5e.tools uses. */
function creatorRaceSpeed() {
  const rec = ciFindRace(CREATOR.race);
  if (!rec) return null;
  const sub = findSubByName(rec, CREATOR.subrace);
  return raceWalkSpeed((sub && sub.speed != null) ? sub.speed : rec.speed);
}

/* ----- building the character -----
   Everything the wizard collected, turned into the state shape collectState() produces. */
function creatorBuildState() {
  const c = CREATOR;
  const fields = {
    "char-name": c.name || "unnamed",
    "char-race": c.race, "char-subrace": c.subrace,
    "char-bg": c.background + (c.customBg && c.background ? " (custom)" : (c.customBg ? "Custom" : "")),
  };
  // Falls back to 30 ft (the walking speed of most PHB races) rather than leaving Speed blank when
  // the race library has no entry for the chosen race — most commonly because the sheet was opened
  // straight from disk (file://), where a browser blocks the auto-load fetch that races.json needs
  // (see autoLoadRaces in class-library.js) and nothing has been imported manually yet. A newly
  // created character's Movement pool should never read 0/0; 30 is closer to right than 0 for nearly
  // every race, and it's a plain editable field either way if it's wrong.
  const raceSpeed = creatorRaceSpeed();
  fields["speed"] = String(raceSpeed != null ? raceSpeed : 30);
  // Size: the wizard has been collecting this since step 1 (CREATOR.size, plus raceSizeHtml's picker
  // for the races that genuinely let you choose) and was throwing it away — the character came out
  // Medium whatever you picked. Races that state a single size supply it even though there was no
  // picker to touch; anything unknown stays Medium, which is the field's own default.
  const sizes = (ciFindRace(c.race) || {}).size || [];
  const size = c.size || (sizes.length === 1 ? sizes[0] : "");
  if (size && size !== "V") fields["char-size"] = size;
  CREATOR_ABILITIES.forEach(ab => { fields["score-" + ab] = String(creatorFinalScore(ab)); });

  // Coins. Starting gold and DMG p38's higher-level allowance are both plain gp.
  const gp = (c.equipMode === "gold" ? (c.startGold || 0) : 0) + (c.higherLevel ? (c.higherGold || 0) : 0);
  if (gp) fields["coin-gp"] = String(gp);

  // An all-blank extra row is a row the user added and never filled in; it would show up as an
  // "(unnamed class)" line on the Classes table, so drop it rather than carrying it across.
  const rows = c.classes.filter((r, i) => i === 0 || r.name.trim() || r.lvl > 1);

  /* Background proficiencies. Only what the data states OUTRIGHT is applied — a `choose` block is a
     decision the player still has to make, and silently picking one for them would be worse than
     leaving it visible in the Skills / Proficiencies modules. A custom background (PHB p125) is all
     outright picks by definition, so all of it applies. */
  const prof = { weapons: [], tools: [], languages: [] };
  const skillProfs = [];
  if (c.customBg) {
    c.bgSkills.filter(Boolean).forEach(s => skillProfs.push(s));
    // The two tool/language picks aren't distinguishable in the data (PHB lets you take either), so
    // they go to Proficiencies' tools list, where they're editable either way.
    c.bgTools.filter(Boolean).forEach(t => prof.tools.push(t));
  } else {
    const rec = ciFindBackground(c.background);
    if (rec) {
      flatProfNames(rec.skills).forEach(s => skillProfs.push(s));
      flatProfNames(rec.tools).forEach(t => prof.tools.push(t));
      flatProfNames(rec.languages).forEach(l => prof.languages.push(l));
    }
  }
  skillProfs.forEach(name => {
    const slug = String(name).toLowerCase().replace(/[^a-z]/g, "");   // same slug rows.js builds the checkbox ids from
    if (SKILLS.some(s => s[0].toLowerCase().replace(/[^a-z]/g, "") === slug)) fields["skillprof-" + slug] = true;
  });

  return {
    v: 1, effectsSv: 1, fields,
    classes: rows.map(r => ({ name: r.name, sub: r.sub, lvl: r.lvl, hitDie: "auto", casting: "auto" })),
    spells: [], items: creatorStartingItems(), attacks: [], routines: [],
    featChoices: {}, usesState: {}, hdState: {},
    effectChoices: {}, effectToggles: {},
    proficiencies: prof,
    concentrating: null,
  };
}

/* Items from the chosen equipment package. Only leaves that name a real item are added — an
   "any martial weapon" line has no single answer, so it's left for the Equipment Library. Quantities
   come from the data; everything else about an item (weight, value, AC) is looked up by name at
   render time, exactly as it is for an item added by hand. */
function creatorStartingItems() {
  if (CREATOR.equipMode !== "package") return [];
  const out = [];
  startingEquipmentLines().forEach((line, i) => {
    const side = line[CREATOR.equipPick[i] || "a"] || [];
    side.forEach(leaf => {
      const name = eqLeafName(leaf);
      if (!name) return;                                  // equipmentType filter: not an item
      out.push({ name, qty: eqLeafQty(leaf), eq: false, attuned: false });   // same shape addCharacterItem builds
    });
  });
  return out;
}

function creatorFinish() {
  const c = CREATOR;
  const state = creatorBuildState();
  const name = c.name || "unnamed";
  const unresolved = startingEquipmentLines().reduce((n, line, i) =>
    n + ((line[c.equipPick[i] || "a"] || []).filter(l => !eqLeafName(l)).length), 0);
  closeCreator();
  addCharacter(state, name);
  // Current HP starts at max — a newly created character is undamaged, and Max HP is only known once
  // the state is live (it depends on the class table and CON that were just applied).
  $("hp-cur").value = String(maxHP()); commitMath($("hp-cur"));
  recompute(); saveState();

  const classTxt = c.classes.filter(r => r.name.trim()).map(r => `${escapeHtml(r.name)} ${r.lvl}`).join(" / ") || "no class";
  logEvent("info", `<b>${escapeHtml(name)}</b> created &mdash; ${escapeHtml(c.race || "no race")} ${classTxt}`);
  const gp = (c.equipMode === "gold" ? (c.startGold || 0) : 0) + (c.higherLevel ? (c.higherGold || 0) : 0);
  const bits = [];
  if (state.items.length) bits.push(`${state.items.length} starting item(s)`);
  if (gp) bits.push(`${gp} gp`);
  if (unresolved) bits.push(`${unresolved} equipment choice(s) left to pick from the Equipment Library`);
  if (bits.length) logEvent("info", `Starting equipment: ${bits.join(", ")}`);
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

  /* Text boxes: redraw (their value feeds the rest of the step) and put the cursor back.
     Number boxes: never redraw — update only the readouts derived from them. See this file's header. */
  $("cr-body").addEventListener("input", e => {
    const t = e.target; if (!CREATOR) return;

    if (t.id === "cr-race") { CREATOR.race = t.value; CREATOR.subrace = ""; CREATOR.racialChoice = {}; CREATOR.size = ""; renderCreatorKeepingFocus(t); return; }
    if (t.id === "cr-subrace") { CREATOR.subrace = t.value; CREATOR.racialChoice = {}; renderCreatorKeepingFocus(t); return; }
    if (t.classList.contains("cr-cls")) {
      const row = CREATOR.classes[Number(t.dataset.crrow)];
      row.name = t.value; row.sub = "";                   // subclasses belong to a class
      renderCreatorKeepingFocus(t); return;
    }
    if (t.classList.contains("cr-sub")) { CREATOR.classes[Number(t.dataset.crrow)].sub = t.value; renderCreatorChrome(); return; }
    if (t.id === "cr-background") { CREATOR.background = t.value; renderCreatorKeepingFocus(t); return; }
    if (t.classList.contains("cr-bgskill")) { CREATOR.bgSkills[Number(t.id.slice(-1))] = t.value; renderCreatorChrome(); return; }
    if (t.classList.contains("cr-bgtool")) { CREATOR.bgTools[Number(t.id.slice(-1))] = t.value; renderCreatorChrome(); return; }
    if (t.id === "cr-bgfeature") { CREATOR.bgFeature = t.value; return; }
    if (t.id === "cr-name") { CREATOR.name = t.value; return; }

    if (t.classList.contains("cr-lvl")) {
      CREATOR.classes[Number(t.dataset.crrow)].lvl = Math.max(1, Math.min(20, Number(t.value) || 1));
      const total = creatorTotalLevel(), tot = $("cr-total-level");
      if (tot) { tot.textContent = total; tot.className = total > 20 ? "cr-over" : ""; }
      if ($("cr-step2-hint")) $("cr-step2-hint").innerHTML = creatorStep2Hint();
      renderCreatorChrome(); return;
    }
    if (t.classList.contains("cr-manual")) {
      const ab = t.dataset.ab;
      CREATOR.scores[ab] = Math.max(1, Math.min(30, Number(t.value) || 10));
      if ($("cr-final-" + ab)) $("cr-final-" + ab).innerHTML = creatorFinalCell(ab);
      renderCreatorChrome(); return;
    }
  });

  /* `change` rebuilds, so ONLY <select>s and checkboxes are handled here. A text or number box also
     fires `change`, but on blur — as you click the next control — which would tear that control out
     of the document before its own click resolved. Those are handled entirely by `input` above. */
  $("cr-body").addEventListener("change", e => {
    const t = e.target; if (!CREATOR) return;
    if (t.classList.contains("cr-racial")) { CREATOR[t.dataset.crstore][t.dataset.crslot] = t.value; renderCreator(); return; }
    if (t.id === "cr-custom-origin") {
      CREATOR.customOrigin = t.checked;
      CREATOR.originChoice = {};                        // reassignments don't survive turning it off and on
      renderCreator(); return;
    }
    if (t.id === "cr-size") { CREATOR.size = t.value; return; }
    if (t.id === "cr-custom-bg") { CREATOR.customBg = t.checked; renderCreator(); return; }
    if (t.id === "cr-higher") { CREATOR.higherLevel = t.checked; CREATOR.higherGold = null; renderCreator(); return; }
    if (t.id === "cr-magic") { CREATOR.campaignMagic = t.value; renderCreator(); return; }
    if (t.dataset.creq != null) { CREATOR.equipPick[Number(t.dataset.creq)] = t.value; renderCreatorChrome(); return; }
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
    // Source filters. Toggling a book off hides its entries from the picker below it.
    const src = e.target.closest("[data-crsrc]");
    if (src) {
      const kind = src.dataset.crsrc, off = CREATOR.srcOff[kind];
      if (src.classList.contains("cr-src-all")) { CREATOR.srcOff[kind] = {}; }
      else if (src.classList.contains("cr-src-none")) {
        const lib = kind === "race" ? RACE_LIB : kind === "class" ? CLASS_LIB : BACKGROUND_LIB;
        CREATOR.srcOff[kind] = {}; creatorSources(lib).forEach(s => { CREATOR.srcOff[kind][s] = true; });
      } else { const s = src.dataset.src; if (off[s]) delete off[s]; else off[s] = true; }
      renderCreator(); return;
    }
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
    const eq = e.target.closest("[data-creqmode]");
    if (eq) { CREATOR.equipMode = eq.dataset.creqmode; renderCreator(); return; }
    if (e.target.id === "cr-reroll") { creatorRollScores(); renderCreator(); return; }
    if (e.target.id === "cr-roll-gold") { creatorRollGold(); renderCreator(); return; }
    if (e.target.id === "cr-avg-gold") { creatorAverageGold(); renderCreator(); return; }
    if (e.target.id === "cr-roll-higher") { creatorRollHigherGold(); renderCreator(); return; }
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

/* Multiclassing prerequisites for the class you're entering AND every class you already have
   (PHB p163) — checked against the live sheet's scores rather than the wizard's. Reported, not
   enforced: the numbers may legitimately be about to change (an ASI on this very level), and the
   sheet's job here is to tell you what RAW asks for, not to refuse the level. */
function luMcHtml() {
  const wanted = [{ name: LEVELUP.newClass }, ...levelUpClasses()].filter(r => (r.name || "").trim());
  const scoreOf = ab => abilityScore(ab);
  const fails = mcFailures(wanted, scoreOf);
  const listed = wanted.map(r => {
    const rec = ciFindClass(r.name);
    if (!rec || !rec.mcReq) return "";
    const ok = meetsMcRequirement(rec.mcReq, scoreOf);
    return `${escapeHtml(rec.name)} needs ${escapeHtml(mcRequirementText(rec.mcReq))} <b class="${ok ? "cr-ok" : "cr-over"}">${ok ? "✓" : "✗"}</b>`;
  }).filter(Boolean).join(" &middot; ");
  if (!listed) return `<div class="hint">Multiclassing has ability-score prerequisites (PHB p163); none are in your loaded data for these classes.</div>`;
  return `<div class="hint"><b>Multiclassing prerequisites (PHB p163)</b> — you need these for every class you're combining.<div>${listed}</div>
    ${fails.length ? `<div class="cr-over">Not met yet. The sheet will still let you take the level — check with your DM.</div>` : ""}</div>`;
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
      <label>New class ${creatorCombo("lu-newclass", LEVELUP.newClass, classes, "type to search", "", "", "class")}</label>
      ${luMcHtml()}
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
  if (typeof initComboboxes === "function") initComboboxes($("lu-body"));
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
    if (e.target.name === "lu-hp") { LEVELUP.hpMode = e.target.value; LEVELUP.rolled = null; renderLevelUp(); return; }
  });
  /* The class box is a combobox (a text input with a datalist), so it redraws on `input` — the
     feature preview and the prerequisite check both depend on it — and never on `change`, which for
     a text box fires on blur and would detach whatever you clicked next. Same rule as the creator. */
  $("lu-body").addEventListener("input", e => {
    if (!LEVELUP || e.target.id !== "lu-newclass") return;
    LEVELUP.newClass = e.target.value; LEVELUP.rolled = null;
    const pos = e.target.selectionStart;
    renderLevelUp();
    const again = $("lu-newclass");
    if (again) {
      again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) {}
    }
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
