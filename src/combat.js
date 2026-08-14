/* ============================================================
   COMBAT ROUND TRACKER — your turn's economy, spent as you play it.

   Modelled on COMP/CON's round tracker: rolling initiative puts you in
   combat, and from then on the module shows what you have left this turn —
   action, bonus action, reaction, free object interaction, movement — and
   End Round gives it all back. Each resource is a button, and clicking it
   opens a menu of what you can actually spend it on, built from THIS
   character's sheet rather than a generic list: your attacks, your spells
   filtered by casting time, the standard PHB actions.

   Two ideas do most of the work.

   1. THE ATTACK ACTION GRANTS SWINGS, NOT ONE ATTACK. Spending your action
      on Attack gives you 1 + Extra Attack swings, and each attack roll
      spends one swing. That's why a Fighter 5 can roll twice without the
      tracker claiming they used two actions — the alternative (one action
      per attack roll) is wrong for every martial past level 5. Rolling an
      attack with no swings banked spends the action first and then a swing,
      so the common case still needs no bookkeeping (BG3's behaviour).

   2. SPENDING IS ADVISORY, NOT ENFORCED. Nothing here blocks a roll. A
      resource at zero goes red and says so, and you can still act — because
      a real table has readied actions, Action Surge, effects this sheet
      doesn't model, and a DM. A tracker that refused to let you roll would
      be wrong more often than it was right, and would be the thing you
      turned off. Every spend is logged, so the record is auditable.

   RAW notes, and where this deliberately simplifies:
   - Reaction refreshes at the START of your turn (PHB p190), not the end.
     One "End Round" button standing for "end my turn / start my next" is
     the honest simplification for a single-character sheet with no
     initiative order; the button says what it refreshes.
   - The free object interaction is one per turn (PHB p190); a second one
     costs your action (Use an Object), which is a separate menu entry.
   - Movement is a pool of feet, spendable a foot at a time (± steps on the
     module) or by editing the current/max box directly, same as Hit Dice's
     remaining-count box. What a foot of DISTANCE costs is the terrain
     multiplier (TERRAIN_COSTS, edited via its own inline box), so "I moved
     15 feet through difficult terrain" is one number to enter rather than a
     sum to do in your head. Dash adds your speed to the pool rather than
     doubling it — same result, and it survives a speed change mid-turn.
   ============================================================ */

const COMBAT_MAX = { action: 1, bonus: 1, reaction: 1, object: 1 };
const COMBAT_KINDS = ["action", "bonus", "reaction", "object"];
const COMBAT_LABEL = { action: "Action", bonus: "Bonus Action", reaction: "Reaction", object: "Object Interaction" };

/* Persisted as part of the character (see collectState/applyState), so a fight survives a reload
   and switching to your familiar's tab and back. */
let COMBAT = blankCombat();

function blankCombat() {
  return {
    active: false, round: 0,
    used: { action: 0, bonus: 0, reaction: 0, object: 0 },
    moveUsed: 0, moveBonus: 0,     // feet spent; feet added by Dash and the like
    swings: 0,                     // attacks banked by taking the Attack action
    attacked: false,               // has an attack been rolled this turn (gates Two-Weapon Fighting)
    terrain: 1,                    // ft of movement each ft of distance costs (TERRAIN_COSTS) — a
                                   // terrain property, so it survives End Round but not a fresh fight
    history: [],                   // undo stack — see pushHistory/undoLast below
    order: [],                     // initiative order — [{id, name, init, pc}], highest init first
    turnId: null,                  // id (into order) of whose turn it is, or null if nobody's been stepped to yet
  };
}
const HISTORY_MAX = 20;

/* A character's `combat` is persisted as part of its state (see applyState in persistence.js), which
   means a save made before some field existed here — `history` when Undo was added, `terrain` when
   the multiplier replaced the old difficult-terrain flag — comes back missing that field entirely.
   Assigning a stored object straight into COMBAT trusted whatever shape it happened to have, so an
   old save crashed the first time something touched the field it lacked (pushHistory().push() on an
   undefined array). Loading always goes through here instead, layering the saved values over a fresh
   blankCombat() so any field the save predates gets today's default rather than `undefined`. */
function normalizeCombat(saved) {
  const blank = blankCombat();
  if (!saved || typeof saved !== "object") return blank;
  return { ...blank, ...saved, used: { ...blank.used, ...(saved.used || {}) },
    history: Array.isArray(saved.history) ? saved.history : blank.history,
    order: Array.isArray(saved.order) ? saved.order : blank.order,
    turnId: (typeof saved.turnId === "string" ? saved.turnId : blank.turnId) };
}

/* ----- derived numbers ----- */

/* Attacks per Attack action. 5e.tools names the escalating ones "Extra Attack (2)" and
   "Extra Attack (3)" (Fighter 11 and 20), so the highest one you qualify for sets the count:
   plain Extra Attack = 2 swings, (2) = 3, (3) = 4. Anything the data doesn't describe falls back
   to one swing, which is right for a character with no Extra Attack at all. */
function attacksPerAction() {
  let best = 1;
  (typeof getClasses === "function" ? getClasses() : []).forEach(c => {
    const rec = (typeof ciFindClass === "function") ? ciFindClass(c.name) : null;
    if (!rec) return;
    (rec.feats || []).forEach(f => {
      if (f.level > c.lvl) return;
      const m = /^Extra Attack(?:\s*\((\d)\))?$/i.exec(f.name || "");
      if (m) best = Math.max(best, 1 + (m[1] ? Number(m[1]) : 1));
    });
  });
  return best;
}

function moveMax() { return (typeof speedTotal === "function" ? speedTotal() : 0) + COMBAT.moveBonus; }
function moveLeft() { return Math.max(0, moveMax() - COMBAT.moveUsed); }
function leftOf(kind) { return Math.max(0, COMBAT_MAX[kind] - COMBAT.used[kind]); }

/* The movement pool is the one part of the tracker that depends on a number outside it — your Speed,
   which you can change mid-fight (a race correction, an effect, an item). renderCombat() can't be
   called from recompute() to pick that up: this row holds live text boxes, and rebuilding it on
   every keystroke would take the caret with it. So recompute() calls THIS instead — it writes the
   two numbers in place and touches nothing else. Without it the row kept whatever max it was drawn
   with, so a fight entered while Speed was blank stayed at 0/0 however you fixed the Speed after. */
function syncCombatMovement() {
  const max = document.querySelector(".cbt-move-max"); if (!max) return;
  max.textContent = moveMax();
  const box = document.querySelector(".cbt-move-box");
  if (box && box !== document.activeElement) box.value = moveLeft();
}

/* Equipped weapons, by inventory + library. Used for Two-Weapon Fighting's precondition and for
   the object-interaction menu, both of which need to know what you're actually holding. */
function equippedWeapons() {
  if (typeof CHARACTER_ITEMS === "undefined") return [];
  return CHARACTER_ITEMS.filter(it => it.eq).map(it => {
    const lib = (typeof findLibItemByName === "function") ? findLibItemByName(it.name) : null;
    return { name: it.name, lib };
  }).filter(w => w.lib && w.lib.weapon);
}
/* PHB p195: two-weapon fighting needs a light melee weapon in each hand.

   "Melee" is the item's own type, NOT "has no range" — a dagger and a handaxe are melee weapons that
   also happen to be Thrown, so they carry a 20/60 range and the range test excluded exactly the
   weapons people dual-wield. 5e.tools types them "M" (melee) vs "R" (ranged), which parseItemType
   turns into "Melee Weapon"/"Ranged Weapon"; matching the parsed string avoids re-parsing the
   library just to learn something it already recorded. */
function isMeleeWeapon(lib) { return !!lib && lib.weapon && /^Melee Weapon/.test(lib.type || ""); }
function lightMeleeWeapons() {
  return equippedWeapons().filter(w => (w.lib.weaponProps || []).includes("L") && isMeleeWeapon(w.lib));
}
function canTwoWeaponFight() { return lightMeleeWeapons().length >= 2; }

/* The character's own spells whose casting time matches, e.g. every bonus-action spell. Casting time
   comes from the Spell Library entry, so a spell the library doesn't know is left out rather than
   guessed at. */
function spellsByCastTime(unit) {
  if (typeof CHARACTER_SPELLS === "undefined") return [];
  const seen = new Set();
  return CHARACTER_SPELLS.filter(s => {
    const lib = (typeof findLibSpellByName === "function") ? findLibSpellByName(s.name) : null;
    if (!lib || lib.cast !== unit) return false;
    if (seen.has(s.name)) return false;                     // the same spell can be on two class lists
    seen.add(s.name);
    return true;
  });
}

/* ----- spending ----- */
function combatLog(html) { if (typeof logEvent === "function") logEvent("resource", html); }

function enterCombat(reason) {
  if (COMBAT.active) return;
  // A DM can build the initiative order before anyone's rolled — don't let the fresh blankCombat()
  // this function does for everything else throw that list away.
  const order = COMBAT.order, turnId = COMBAT.turnId;
  COMBAT = blankCombat();
  COMBAT.order = order; COMBAT.turnId = turnId;
  COMBAT.active = true; COMBAT.round = 1;
  renderCombat(); scheduleSave();
  combatLog(`<b>Combat</b> — round 1${reason ? ` (${escapeHtml(reason)})` : ""}`);
}
function leaveCombat() {
  if (!COMBAT.active) return;
  const n = COMBAT.round;
  COMBAT = blankCombat();
  renderCombat(); scheduleSave();
  combatLog(`<b>Combat ended</b> after ${n} round${n === 1 ? "" : "s"}`);
}
function endRound() {
  if (!COMBAT.active) return;
  const spent = COMBAT_KINDS.filter(k => COMBAT.used[k]).map(k => COMBAT_LABEL[k]);
  const moved = COMBAT.moveUsed;
  COMBAT.round++;
  COMBAT.used = { action: 0, bonus: 0, reaction: 0, object: 0 };
  COMBAT.moveUsed = 0; COMBAT.moveBonus = 0; COMBAT.swings = 0; COMBAT.attacked = false;
  COMBAT.history = [];   // last round's spends don't apply to this round's freshly-refreshed pools
  renderCombat(); scheduleSave();
  combatLog(`<b>Round ${COMBAT.round}</b> — everything refreshed` +
    (spent.length || moved ? ` <span class="hint">(last round: ${[...spent, moved ? moved + " ft moved" : ""].filter(Boolean).join(", ")})</span>` : ""));
}

/* ----- initiative order -----
   A local (single-browser) multi-actor turn tracker: the piece the round tracker's header names as
   its own known limit ("no initiative order for the whole table"). It's a plain list — name +
   initiative, highest first, with a pointer to whose turn it is — not tied to anyone's resource
   pools. That's a deliberate boundary, not an oversight: this module already gives ITS character's
   own action/bonus/reaction/movement pools their own refresh button (End Round), and coupling that
   to "it became your turn in the order" would mean guessing which of possibly several entries is
   "you" and reaching into a resource model this list has no business owning. A DM steps through
   whose turn it is here; each player's own pools stay theirs to manage, same as always. */
function newOrderId() { return "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* Stable per spec (ES2019+) — ties keep the order they were added/edited in, rather than jumping
   around every time something re-sorts. */
function sortOrder() { COMBAT.order.sort((a, b) => b.init - a.init); }

function charName() {
  const el = document.getElementById("char-name");
  return (el && el.value && el.value.trim()) || "You";
}

function addOrderEntry(name, init) {
  name = String(name || "").trim(); if (!name) return;
  const n = Math.round(Number(init));
  COMBAT.order.push({ id: newOrderId(), name, init: Number.isFinite(n) ? n : 0 });
  sortOrder();
  renderCombat(); scheduleSave();
}
function removeOrderEntry(id) {
  if (!COMBAT.order.some(o => o.id === id)) return;
  COMBAT.order = COMBAT.order.filter(o => o.id !== id);
  if (COMBAT.turnId === id) COMBAT.turnId = null;
  renderCombat(); scheduleSave();
}
function editOrderEntry(id, field, value) {
  const e = COMBAT.order.find(o => o.id === id); if (!e) return;
  if (field === "name") { const v = String(value || "").trim(); if (v) e.name = v; }
  if (field === "init") { const n = Math.round(Number(value)); if (Number.isFinite(n)) e.init = n; }
  sortOrder();
  renderCombat(); scheduleSave();
}
/* Called off the real Roll Initiative button (see the click hook below) — seeds or updates the
   character's own row with the number that actually landed in the log, never a second private roll
   that could disagree with it. One entry per character: re-rolling initiative updates it in place
   rather than adding a duplicate. */
function setPcInitiative(name, value) {
  let e = COMBAT.order.find(o => o.pc);
  if (!e) { e = { id: newOrderId(), pc: true, name: name || "You", init: value }; COMBAT.order.push(e); }
  else { e.name = name || e.name; e.init = value; }
  sortOrder();
  renderCombat(); scheduleSave();
  combatLog(`<b>Initiative</b> — ${escapeHtml(e.name)}: ${value}`);
}
/* Advances to the next entry in the (already-sorted) order, wrapping back to the top after the last
   one. Wrapping is announced but doesn't touch COMBAT.round itself or anyone's pools — see this
   section's header comment for why those stay decoupled. */
function nextTurn() {
  if (!COMBAT.order.length) return;
  const curIdx = COMBAT.order.findIndex(o => o.id === COMBAT.turnId);
  const nextIdx = curIdx === -1 ? 0 : (curIdx + 1) % COMBAT.order.length;
  const wrapped = curIdx !== -1 && nextIdx === 0;
  COMBAT.turnId = COMBAT.order[nextIdx].id;
  renderCombat(); scheduleSave();
  if (wrapped) combatLog(`<span class="hint">— back to the top of the order —</span>`);
  combatLog(`<b>Turn</b> — ${escapeHtml(COMBAT.order[nextIdx].name)}`);
}

/* Spend one of a resource. Never refuses — see this file's header — but says when you'd be over. */
function spendResource(kind, what) {
  if (!COMBAT.active) enterCombat();
  const over = leftOf(kind) <= 0;
  COMBAT.used[kind]++;
  renderCombat(); scheduleSave();
  combatLog(`${escapeHtml(what || COMBAT_LABEL[kind])} — <b>${COMBAT_LABEL[kind]}</b>` +
    (over ? ` <span class="cr-over">(none left — over your limit)</span>` : ` <span class="hint">(${leftOf(kind)}/${COMBAT_MAX[kind]} left)</span>`));
}
function spendMovement(ft, what) {
  if (!COMBAT.active) enterCombat();
  // Clamped at zero: the ± steps pass a negative to give feet back, and a pool below empty would
  // then hand out free movement later in the turn.
  COMBAT.moveUsed = Math.max(0, COMBAT.moveUsed + ft);
  const over = COMBAT.moveUsed > moveMax();
  renderCombat(); scheduleSave();
  combatLog(`${escapeHtml(what || "Move")} ${Math.abs(ft)} ft — <b>Movement</b> ` +
    (over ? `<span class="cr-over">${COMBAT.moveUsed}/${moveMax()} ft (over)</span>` : `<span class="hint">${moveLeft()}/${moveMax()} ft left</span>`));
}

/* ----- undo -----
   One entry per user-initiated spend, captured as a snapshot of every field a spend can touch —
   not a per-field diff — because several spends are compound (Dash adds to moveBonus AND spends the
   action; taking Attack with no swings banked spends the action AND sets swings AND attacked). A
   snapshot restores the whole thing in one step regardless of how many fields the spend actually
   changed, so the caller only has to know "before" and "after", never the shape of what happened
   between them.

   The three call sites that begin a real spend (the menu's entry.run(), a chip double-click, and an
   attack roll auto-booking itself) call pushHistory() first; the mutators themselves (spendResource,
   spendMovement, useAttackSwing) don't, so a compound spend that calls two of them only ever pushes
   once. Undoing does NOT remove the Event Log entry the spend made — the tracker's whole premise is
   an auditable log (see this file's header), and erasing history would fight that. Instead Undo adds
   its own log line, so both "this was spent" and "then undone" stay on the record. */
function pushHistory(label) {
  // spendResource/spendMovement also auto-enter combat on a first spend — but enterCombat() replaces
  // COMBAT wholesale with a fresh blankCombat(), which would discard an entry pushed onto the OLD
  // object a moment earlier. Doing it here first means every push lands on the object that survives.
  if (!COMBAT.active) enterCombat();
  COMBAT.history.push({ label, used: { ...COMBAT.used }, moveUsed: COMBAT.moveUsed, moveBonus: COMBAT.moveBonus, swings: COMBAT.swings, attacked: COMBAT.attacked });
  if (COMBAT.history.length > HISTORY_MAX) COMBAT.history.shift();
}
function lastHistoryLabel() { return COMBAT.history.length ? COMBAT.history[COMBAT.history.length - 1].label : null; }
function undoLast() {
  const entry = COMBAT.history.pop(); if (!entry) return;
  COMBAT.used = entry.used; COMBAT.moveUsed = entry.moveUsed; COMBAT.moveBonus = entry.moveBonus;
  COMBAT.swings = entry.swings; COMBAT.attacked = entry.attacked;
  renderCombat(); scheduleSave();
  combatLog(`<span class="hint">Undo</span> — ${escapeHtml(entry.label)}`);
}

/* An attack roll landed. Spends a banked swing, or takes the Attack action first if there are none —
   so the ordinary case (click "atk+dmg", never touch this module) books itself correctly. */
function useAttackSwing(name) {
  if (!COMBAT.active) return;                 // out of combat the tracker stays out of the way
  COMBAT.attacked = true;
  if (COMBAT.swings <= 0) {
    const n = attacksPerAction();
    COMBAT.swings = n;
    spendResource("action", `Attack${n > 1 ? ` (${n} attacks)` : ""}`);
  }
  COMBAT.swings--;
  renderCombat(); scheduleSave();
  if (COMBAT.swings > 0) combatLog(`<span class="hint">${escapeHtml(name || "Attack")} — ${COMBAT.swings} attack${COMBAT.swings === 1 ? "" : "s"} left in this Attack action</span>`);
}

/* ----- the resource menus -----
   Each entry is { label, hint, run } — `run` does whatever the entry means, which is usually
   "spend the resource and log it", and sometimes also "make the roll". Entries are built from the
   live sheet, so an empty inventory or spell list simply produces fewer of them. */
function menuFor(kind) {
  if (kind === "action") return actionMenu();
  if (kind === "bonus") return bonusMenu();
  if (kind === "reaction") return reactionMenu();
  if (kind === "object") return objectMenu();
  if (kind === "move") return moveMenu();
  return [];
}

function attackEntries(spend) {
  const atks = (typeof attacksForRoutines === "function") ? attacksForRoutines() : [];
  return atks.map(a => ({
    label: a.name, hint: `${a.bonus >= 0 ? "+" : ""}${a.bonus} to hit${a.dmg ? ` · ${a.dmg}` : ""}`,
    run: () => {
      const res = (typeof rollAttackById === "function") ? rollAttackById(a.id, "normal") : null;
      if (res) log(`<b>${res.name}</b> — ${res.hitText}${res.dmgText ? " · " + res.dmgText : ""}`);
      spend(a.name);
    },
  }));
}

function spellEntries(unit, kind) {
  return spellsByCastTime(unit).map(s => ({
    label: s.name, hint: s.lvl === 0 ? "cantrip" : `level ${s.lvl}${s.cls ? " · " + s.cls : ""}`,
    run: () => spendResource(kind, `Cast ${s.name}`),
  }));
}

function actionMenu() {
  const out = [];
  const spend = what => spendResource("action", what);
  const atks = attackEntries(() => {});
  const n = attacksPerAction();
  out.push({ label: "Attack", hint: n > 1 ? `${n} attacks with this action` : "one attack",
    submenu: atks.length ? attackEntries(name => useAttackSwing(name)) : null,
    run: atks.length ? null : () => { COMBAT.swings = n; spend(`Attack (${n})`); } });
  const spells = spellEntries("action", "action");
  out.push({ label: "Cast a Spell", hint: spells.length ? `${spells.length} with a 1-action casting time` : "no action-cast spells on your list",
    submenu: spells.length ? spells : null, run: spells.length ? null : () => spend("Cast a Spell") });
  out.push({ label: "Dash", hint: `+${speedTotal()} ft of movement`, run: () => { COMBAT.moveBonus += speedTotal(); spend("Dash"); } });
  out.push({ label: "Disengage", hint: "your movement provokes no opportunity attacks this turn", run: () => spend("Disengage") });
  out.push({ label: "Dodge", hint: "attacks against you have disadvantage; DEX saves have advantage", run: () => spend("Dodge") });
  out.push({ label: "Help", hint: "give an ally advantage, or aid an attack against a creature within 5 ft", run: () => spend("Help") });
  out.push({ label: "Hide", hint: "rolls Stealth", run: () => { rollNamedSkill("Stealth"); spend("Hide"); } });
  out.push({ label: "Search", hint: "rolls Perception", run: () => { rollNamedSkill("Perception"); spend("Search"); } });
  out.push({ label: "Ready", hint: "hold an action for a trigger — it costs your reaction when it fires", run: () => spend("Ready") });
  out.push({ label: "Use an Object", hint: "a second object interaction this turn, or one that needs an action", run: () => spend("Use an Object") });
  return out;
}

function bonusMenu() {
  const out = [];
  const spend = what => spendResource("bonus", what);

  // Two-Weapon Fighting, PHB p195. The precondition is real and checkable, so it's checked: two
  // light melee weapons equipped, and an attack already made this turn.
  const light = lightMeleeWeapons();
  if (light.length >= 2) {
    const offhand = light.slice(1).map(w => w.name);
    out.push({
      label: "Two-Weapon Fighting",
      hint: COMBAT.attacked ? `off-hand attack with ${offhand.join(" / ")}` : "you haven't attacked yet this turn",
      disabled: !COMBAT.attacked,
      submenu: attackEntries(name => spend(`Off-hand attack (${name})`)),
    });
  } else {
    out.push({ label: "Two-Weapon Fighting", hint: `needs two light melee weapons equipped (you have ${light.length})`, disabled: true });
  }

  /* R47 (house rule): a spell with a bonus-action casting time always costs a bonus action. The
     argument this rejects reads PHB's "you must use a bonus action… provided that you haven't
     already taken a bonus action this turn" as lapsing once you have — making the spell free rather
     than uncastable. It doesn't: with the bonus action spent, the spell simply can't be cast. Said
     rather than blocked, like everything else in this tracker. */
  const spells = spellEntries("bonus", "bonus");
  const baSpent = (typeof hrSetting !== "function" || hrSetting("bonusActionSpellStrict") !== false) && leftOf("bonus") <= 0;
  out.push({ label: "Cast a Spell",
    hint: baSpent ? "your bonus action is spent — a bonus-action spell can't be cast at all this turn (R47)"
      : (spells.length ? `${spells.length} with a bonus-action casting time` : "no bonus-action spells on your list"),
    disabled: baSpent,
    submenu: (!baSpent && spells.length) ? spells : null,
    run: (!baSpent && !spells.length) ? () => spend("Cast a Spell") : null });

  // Class features that say "bonus action" in their own text — read from what the Features module
  // rendered, so this follows your actual classes and level with nothing hardcoded per class.
  const feats = bonusActionFeatures();
  out.push({ label: "Class feature", hint: feats.length ? `${feats.length} of your features mention a bonus action` : "none of your features mention a bonus action",
    submenu: feats.length ? feats.map(f => ({ label: f, run: () => spend(f) })) : null,
    run: feats.length ? null : () => spend("Bonus action feature") });

  out.push({ label: "Other", hint: "anything this sheet doesn't know about", run: () => spend("Bonus action") });
  return out;
}

function reactionMenu() {
  const out = [];
  const spend = what => spendResource("reaction", what);
  const atks = attackEntries(name => spend(`Opportunity attack (${name})`));
  out.push({ label: "Opportunity Attack", hint: "a creature left your reach", submenu: atks.length ? atks : null,
    run: atks.length ? null : () => spend("Opportunity Attack") });
  const spells = spellEntries("reaction", "reaction");
  out.push({ label: "Cast a Spell", hint: spells.length ? `${spells.length} with a reaction casting time` : "no reaction spells on your list",
    submenu: spells.length ? spells : null, run: spells.length ? null : () => spend("Cast a Spell") });
  out.push({ label: "Readied action", hint: "the trigger you set with Ready has fired", run: () => spend("Readied action") });
  out.push({ label: "Other", hint: "a feature or effect this sheet doesn't know about", run: () => spend("Reaction") });
  return out;
}

function objectMenu() {
  const spend = what => spendResource("object", what);
  const out = [
    { label: "Draw or sheathe a weapon", run: () => spend("Draw/sheathe a weapon") },
    { label: "Don or doff a shield", run: () => spend("Don/doff a shield") },
    { label: "Pick up or drop an item", run: () => spend("Pick up/drop an item") },
    { label: "Open a door, pull a lever, …", run: () => spend("Interact with an object") },
  ];
  // Your own equipped gear, so "sheathe the longsword" is one click rather than a category.
  equippedWeapons().slice(0, 8).forEach(w => out.push({ label: `Sheathe ${w.name}`, hint: "equipped", run: () => spend(`Sheathe ${w.name}`) }));
  return out;
}

/* What a foot of DISTANCE costs you in movement. 5e writes these as "each foot of movement costs 1
   extra foot" (difficult terrain, crawling, standing in a creature's space) or "4 feet" (Plant
   Growth), and they stack — crawling through difficult terrain is 1 + 1 + 1 = 3. A multiplier is
   what that arithmetic reduces to, and a stacked case is easier to pick than to compute.

   It's a property of the ground, not of your turn, so it's a standing setting that the quick-move
   buttons, the ± steps and the custom-feet input all read rather than something you re-enter on
   every move — and it survives End Round (a swamp is still a swamp next turn) but resets with a
   fresh fight, since blankCombat() rebuilds the whole state. */
const TERRAIN_COSTS = [
  { mult: 1, label: "Normal", hint: "each foot of movement costs 1 foot" },
  { mult: 2, label: "Difficult terrain", hint: "PHB p182 — also crawling, or standing in a creature's space; each foot costs 1 extra" },
  { mult: 3, label: "Difficult + crawling", hint: "two 1-extra-foot effects stacked" },
  { mult: 4, label: "Plant Growth", hint: "each foot of movement costs 4 feet" },
];
/* Direct correction of the movement pool and terrain multiplier, mirroring Hit Dice's remaining-count
   box (rest.js, correctHitDiceRemaining) — each box shows the number a player thinks in (feet LEFT,
   the multiplier itself), so it's translated back to what COMBAT actually stores. Neither function
   touches the DOM beyond re-rendering; they take the input element (or anything with a `.value`) so
   they're callable straight from a test without a real `change` event. */
function correctMoveBox(input) {
  const max = moveMax();
  const remaining = Math.max(0, Math.min(max, Math.round(Number(input.value)) || 0));
  COMBAT.moveUsed = max - remaining;
  renderCombat(); scheduleSave();
}
function correctTerrainInput(input) {
  const mult = Number(input.value);
  COMBAT.terrain = mult > 0 ? mult : 1;
  renderCombat(); scheduleSave();
}
function terrainMult() { return COMBAT.terrain || 1; }
function terrainLabel() { const t = TERRAIN_COSTS.find(x => x.mult === terrainMult()); return t ? t.label : "×" + terrainMult(); }
function moveCostFt(actualFt) { return actualFt * terrainMult(); }
function moveLabel(actualFt, note) {
  const cost = moveCostFt(actualFt);
  return terrainMult() > 1 ? `${note || "Move"} ${actualFt} ft (${terrainLabel().toLowerCase()}, ${cost} ft spent)` : `${note || "Move"} ${actualFt} ft`;
}
function moveQuickHint(actualFt) {
  return terrainMult() > 1 ? `${actualFt} ft of distance — ${moveCostFt(actualFt)} ft of movement at ×${terrainMult()}` : undefined;
}
function moveMenu() {
  const sp = speedTotal();
  const out = [5, 10, 15, 30].map(ft => ({ label: `Move ${ft} ft`, hint: moveQuickHint(ft), run: () => spendMovement(moveCostFt(ft), moveLabel(ft)) }));
  out.push({ label: `Move your full speed (${sp} ft)`, hint: moveQuickHint(sp), run: () => spendMovement(moveCostFt(sp), moveLabel(sp)) });
  out.push({ label: "Dash", hint: `costs your action, +${sp} ft`, run: () => { COMBAT.moveBonus += sp; spendResource("action", "Dash"); } });
  // Standing up is a fixed fraction of your speed stat (PHB p190), not distance covered along the
  // ground, so difficult terrain doesn't multiply it.
  out.push({ label: "Stand up from prone", hint: `costs half your speed (${Math.floor(sp / 2)} ft)`, run: () => spendMovement(Math.floor(sp / 2), "Stand up") });
  out.push({ label: "Reset movement", hint: "put the feet back", run: () => { COMBAT.moveUsed = 0; renderCombat(); scheduleSave(); } });
  return out;
}

/* Features whose text mentions a bonus action. FEATURE_TEXT_BY_KEY is populated by the Features
   module's own render, so this needs no per-class table and follows multiclassing for free. */
function bonusActionFeatures() {
  if (typeof FEATURE_TEXT_BY_KEY === "undefined") return [];
  const out = [];
  Object.entries(FEATURE_TEXT_BY_KEY).forEach(([key, text]) => {
    if (!/\bbonus action\b/i.test(text || "")) return;
    const name = String(key).split("|")[1] || String(key).split("||").pop() || key;
    if (name && !out.includes(name)) out.push(name);
  });
  return out.sort();
}

/* Roll a skill by name through the sheet's own skill buttons, so Hide and Search use your real
   modifier, advantage handling and log format rather than a private copy. */
function rollNamedSkill(name) {
  const slug = name.toLowerCase().replace(/[^a-z]/g, "");
  const btn = document.querySelector(`[data-roll-check="skill-${slug}"]`);
  if (btn) btn.click();
}

/* ----- rendering ----- */
function orderRowHtml(e) {
  const active = e.id === COMBAT.turnId;
  return `<li class="cbt-order-row${active ? " active" : ""}" data-oid="${e.id}">
    <input type="text" inputmode="numeric" class="tiny cbt-order-init" value="${e.init}" title="initiative">
    <input type="text" class="cbt-order-name" value="${escapeHtml(e.name)}">
    ${e.pc ? `<span class="hint" title="rolled from your own Initiative button">(you)</span>` : ""}
    <button type="button" class="cbt-order-del" title="remove from the order">&times;</button>
  </li>`;
}
/* Shown whether or not combat is active — a table can build its initiative order before the first
   roll — which is why this lives outside the active/!active branch of renderCombat() below. */
function orderHtml() {
  const rows = COMBAT.order.map(orderRowHtml).join("");
  return `<div class="cbt-order">
    <div class="cbt-order-head"><b>Initiative order</b>
      ${COMBAT.order.length ? `<button type="button" id="cbt-order-next" title="advance to the next combatant's turn">Next turn</button>` : ""}
    </div>
    <ol class="cbt-order-list">${rows || `<li class="hint">Nobody yet — roll your own Initiative (HP &amp; Defenses), or add a combatant below.</li>`}</ol>
    <div class="cbt-order-add">
      <input type="text" inputmode="numeric" class="tiny" id="cbt-order-add-init" placeholder="init">
      <input type="text" id="cbt-order-add-name" placeholder="name (monster, ally, …)">
      <button type="button" id="cbt-order-add-btn">Add</button>
    </div>
  </div>`;
}

function combatChipHtml(kind) {
  const left = leftOf(kind), max = COMBAT_MAX[kind];
  const pips = Array.from({ length: max }, (_, i) => i < left ? "●" : "○").join("");
  return `<button type="button" class="cbt-chip${left ? "" : " spent"}" data-cbt="${kind}"
    title="${COMBAT_LABEL[kind]} — click for what you can spend it on, double-click to just spend it">${COMBAT_LABEL[kind]} <b>${pips}</b></button>`;
}

function renderCombat() {
  const el = $("combat-body"); if (!el) return;
  const status = $("combat-status");

  if (!COMBAT.active) {
    if (status) status.textContent = "";
    el.innerHTML = `<div class="hint">Not in combat. <b>Roll Initiative</b> (HP &amp; Defenses) starts a fight and this module starts tracking your turn — or press Start below.</div>
      <div style="margin-top:.3rem"><button type="button" id="cbt-start">Start combat</button></div>
      ${orderHtml()}`;
    return;
  }

  if (status) status.textContent = `Round ${COMBAT.round}`;
  const mv = moveLeft(), mvMax = moveMax();
  const undoLabel = lastHistoryLabel();
  el.innerHTML =
    `${orderHtml()}
     <div class="cbt-chips">${COMBAT_KINDS.map(combatChipHtml).join("")}</div>
     <div class="cbt-move-row">
       <span class="hint">move</span>
       <button type="button" class="cbt-mv" data-mv="-5" title="give back 5 ft of distance">&minus;5</button>
       <button type="button" class="cbt-mv" data-mv="-1" title="give back 1 ft of distance">&minus;1</button>
       <span class="cbt-move-box-wrap" title="feet of movement left this turn — edit to correct">
         <input type="text" inputmode="numeric" class="tiny cbt-move-box" value="${mv}">/<span class="cbt-move-max">${mvMax}</span> ft
       </span>
       <button type="button" class="cbt-mv" data-mv="1" title="move 1 ft of distance">+1</button>
       <button type="button" class="cbt-mv" data-mv="5" title="move 5 ft of distance">+5</button>
       <label class="hint" title="${escapeHtml(terrainLabel())} — feet of movement each foot of distance costs">&times;<input type="text" inputmode="numeric" class="tiny cbt-terrain-input" value="${terrainMult()}"></label>
       <button type="button" class="cbt-move-more" data-cbt="move" title="more movement options — presets, Dash, stand up from prone">&hellip;</button>
     </div>
     ${COMBAT.swings > 0 ? `<div class="hint">${COMBAT.swings} attack${COMBAT.swings === 1 ? "" : "s"} left in this Attack action.</div>` : ""}
     <div style="margin-top:.4rem">
       <button type="button" id="cbt-end">End Round</button>
       <button type="button" id="cbt-leave" title="leave combat and clear the tracker">End combat</button>
       <button type="button" id="cbt-undo"${undoLabel ? "" : " disabled"} title="${undoLabel ? "undo: " + escapeHtml(undoLabel) : "nothing to undo"}">Undo${undoLabel ? ` (${escapeHtml(undoLabel)})` : ""}</button>
       <span class="hint">End Round refreshes your action, bonus action, reaction, object interaction and movement.</span>
     </div>
     <div id="cbt-menu-anchor"></div>`;
}

/* The context menu. Rendered as a popup anchored to its chip, with one level of submenu reached by
   clicking through and a Back entry — flyouts on hover are fiddly to hit and impossible on touch. */
let CBT_MENU = null;      // { kind, entries, stack: [{title, entries}] }

function closeCombatMenu() {
  const m = document.querySelector(".cbt-menu"); if (m) m.remove();
  CBT_MENU = null;
}

function openCombatMenu(kind, anchor) {
  const entries = menuFor(kind);
  closeCombatMenu();
  CBT_MENU = { kind, stack: [{ title: kind === "move" ? "Movement" : COMBAT_LABEL[kind], entries }] };
  paintCombatMenu(anchor);
}

function paintCombatMenu(anchor) {
  if (!CBT_MENU) return;
  let m = document.querySelector(".cbt-menu");
  if (!m) { m = document.createElement("div"); m.className = "cbt-menu"; document.body.appendChild(m); }
  const top = CBT_MENU.stack[CBT_MENU.stack.length - 1];
  const back = CBT_MENU.stack.length > 1 ? `<div class="cbt-item cbt-back" data-cbtback="1">← back</div>` : "";
  // Every entry's `hint` — what it actually does — is a title (hover) tooltip, not visible text, so
  // the menu itself reads as a plain list of action names. Consistent with how the rest of the sheet
  // explains a number without cluttering the row for it (Attacks' Fx tooltips, roll-button tooltips).
  m.innerHTML = `<div class="cbt-menu-title">${escapeHtml(top.title)}</div>${back}` +
    top.entries.map((e, i) =>
      `<div class="cbt-item${e.disabled ? " disabled" : ""}" data-cbtidx="${i}"${e.hint ? ` title="${escapeHtml(e.hint)}"` : ""}>
         <span>${escapeHtml(e.label)}${e.submenu ? " ›" : ""}</span>
       </div>`).join("");
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    m.style.left = r.left + "px";
    const room = window.innerHeight - r.bottom;
    if (room < 220 && r.top > room) { m.style.top = ""; m.style.bottom = (window.innerHeight - r.top + 2) + "px"; }
    else { m.style.bottom = ""; m.style.top = (r.bottom + 2) + "px"; }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const el = $("combat-body"); if (!el) return;
  renderCombat();

  el.addEventListener("click", e => {
    if (e.target.id === "cbt-start") { enterCombat(); return; }
    if (e.target.id === "cbt-end") { endRound(); return; }
    if (e.target.id === "cbt-leave") { leaveCombat(); return; }
    if (e.target.id === "cbt-undo") { undoLast(); return; }
    if (e.target.id === "cbt-order-next") { nextTurn(); return; }
    if (e.target.id === "cbt-order-add-btn") {
      const nameEl = $("cbt-order-add-name"), initEl = $("cbt-order-add-init");
      if (nameEl && nameEl.value.trim()) {
        addOrderEntry(nameEl.value, initEl ? initEl.value : 0);
        // renderCombat() just rebuilt these boxes from scratch, so re-find and focus for the next add.
        const fresh = $("cbt-order-add-name"); if (fresh) fresh.focus();
      }
      return;
    }
    if (e.target.classList.contains("cbt-order-del")) {
      const row = e.target.closest(".cbt-order-row");
      if (row) removeOrderEntry(row.dataset.oid);
      return;
    }
    /* Foot-by-foot steps, right on the module rather than only inside the menu: movement is the one
       resource you spend in arbitrary amounts several times a turn, and often need back by a few
       feet. They take DISTANCE, so the terrain multiplier applies exactly as it does in the menu,
       and they go through pushHistory so Undo covers them like everything else. */
    const mv = e.target.closest(".cbt-mv");
    if (mv) {
      const ft = Number(mv.dataset.mv);
      pushHistory(moveLabel(Math.abs(ft), ft < 0 ? "Give back" : "Move"));
      spendMovement(moveCostFt(ft), moveLabel(Math.abs(ft), ft < 0 ? "Give back" : "Move"));
      return;
    }
    const chip = e.target.closest("[data-cbt]");
    if (chip) {
      if (CBT_MENU && CBT_MENU.kind === chip.dataset.cbt) { closeCombatMenu(); return; }
      openCombatMenu(chip.dataset.cbt, chip);
    }
  });

  /* Double-click spends the resource outright, no menu. Most of the time you know what you did and
     just want the pip gone — the menu is for when you want the sheet to roll it or to remind you what
     the option even is. The menu opens on the first click of the double, so it's dismissed here. */
  el.addEventListener("dblclick", e => {
    const chip = e.target.closest("[data-cbt]"); if (!chip) return;
    closeCombatMenu();
    const kind = chip.dataset.cbt;
    // a 5-ft step is the smallest useful unit; goes through the same difficult-terrain multiplier as
    // every other move so a double-click is never the one path that forgets the terrain toggle
    if (kind === "move") { pushHistory(moveLabel(5)); spendMovement(moveCostFt(5), moveLabel(5)); return; }
    pushHistory(COMBAT_LABEL[kind]); spendResource(kind);
  });

  document.addEventListener("click", e => {
    const item = e.target.closest(".cbt-item");
    if (!item) {
      // Anything else — a chip/button, the popup's own title bar, or the always-visible movement
      // box/terrain input outside any menu — has its own handling (or none) below; it must not fall
      // through to closing the menu on every click.
      if (!e.target.closest("[data-cbt]") && !e.target.closest(".cbt-menu")) closeCombatMenu();
      return;
    }
    if (!CBT_MENU) return;
    if (item.dataset.cbtback) { CBT_MENU.stack.pop(); paintCombatMenu(document.querySelector(`[data-cbt="${CBT_MENU.kind}"]`)); return; }
    const top = CBT_MENU.stack[CBT_MENU.stack.length - 1];
    const entry = top.entries[Number(item.dataset.cbtidx)];
    if (!entry || entry.disabled) return;
    if (entry.submenu) {
      CBT_MENU.stack.push({ title: entry.label, entries: entry.submenu });
      paintCombatMenu(document.querySelector(`[data-cbt="${CBT_MENU.kind}"]`));
      return;
    }
    if (entry.run) { pushHistory(entry.label); entry.run(); }
    closeCombatMenu();
  });

  /* The movement box and terrain multiplier, always visible in .cbt-move-row (not the popup menu) —
     commits on `change` (blur/Enter), never on every keystroke, or typing "30" toward a corrected
     value would fight the cursor mid-type. See correctMoveBox/correctTerrainInput above. */
  document.addEventListener("change", e => {
    const box = e.target.closest(".cbt-move-box"); if (box) { correctMoveBox(box); return; }
    const terrain = e.target.closest(".cbt-terrain-input"); if (terrain) correctTerrainInput(terrain);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeCombatMenu(); });

  /* Initiative-order rows: name/init edit boxes commit on change (same reasoning as the movement box
     above), and Enter in either "add" box is the same as clicking Add. */
  el.addEventListener("change", e => {
    const row = e.target.closest(".cbt-order-row"); if (!row) return;
    if (e.target.classList.contains("cbt-order-init")) editOrderEntry(row.dataset.oid, "init", e.target.value);
    else if (e.target.classList.contains("cbt-order-name")) editOrderEntry(row.dataset.oid, "name", e.target.value);
  });
  el.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.id === "cbt-order-add-name" || e.target.id === "cbt-order-add-init") {
      const btn = $("cbt-order-add-btn"); if (btn) btn.click();
    }
  });

  /* Rolling initiative is what puts you in combat — the whole point of the tracker is that you
     don't have to remember to turn it on — and it's also what seeds/updates your own row in the
     initiative order below, with the number that actually landed in the log (LAST_D20_ROLL, set by
     fireRoll in dice.js). Deferred so that roll has already happened: app.js's own click listener
     for [data-roll-check] buttons is registered after this file's (combat.js loads first), so it
     fires later in this same click's dispatch — but only guaranteed complete by the next tick. */
  document.addEventListener("click", e => {
    const init = e.target.closest('[data-roll-check="init"]');
    if (!init) return;
    setTimeout(() => {
      if (!COMBAT.active) enterCombat("initiative rolled");
      if (LAST_D20_ROLL && LAST_D20_ROLL.key === "init" && typeof LAST_D20_ROLL.value === "number") {
        setPcInitiative(charName(), LAST_D20_ROLL.value);
      }
    }, 0);
  });

  /* Attack rolls book themselves. Deferred so the roll's own log entry lands first and the tracker's
     note reads as a consequence of it rather than a prediction. The history snapshot is taken NOW,
     synchronously, before that deferred booking runs — Undo needs "the state right before this
     spend", and by the time the timeout fires that state is already gone. */
  document.addEventListener("click", e => {
    const btn = e.target.closest(".wpn-both, .wpn-roll");
    if (!btn || !COMBAT.active) return;
    const tr = btn.closest("tr");
    const name = tr ? (tr.querySelector(".atk-name") || {}).value : "";
    pushHistory(name || "Attack");
    setTimeout(() => useAttackSwing(name), 0);
  });
});
