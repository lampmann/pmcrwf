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
   - Movement is a pool of feet. Dash adds your speed to the pool rather
     than doubling it, which is the same thing and survives a speed change
     mid-turn.
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
  };
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
  COMBAT = blankCombat();
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
  renderCombat(); scheduleSave();
  combatLog(`<b>Round ${COMBAT.round}</b> — everything refreshed` +
    (spent.length || moved ? ` <span class="hint">(last round: ${[...spent, moved ? moved + " ft moved" : ""].filter(Boolean).join(", ")})</span>` : ""));
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
  COMBAT.moveUsed += ft;
  const over = COMBAT.moveUsed > moveMax();
  renderCombat(); scheduleSave();
  combatLog(`${escapeHtml(what || "Move")} ${ft} ft — <b>Movement</b> ` +
    (over ? `<span class="cr-over">${COMBAT.moveUsed}/${moveMax()} ft (over)</span>` : `<span class="hint">${moveLeft()}/${moveMax()} ft left</span>`));
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

  const spells = spellEntries("bonus", "bonus");
  out.push({ label: "Cast a Spell", hint: spells.length ? `${spells.length} with a bonus-action casting time` : "no bonus-action spells on your list",
    submenu: spells.length ? spells : null, run: spells.length ? null : () => spend("Cast a Spell") });

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

function moveMenu() {
  const sp = speedTotal();
  const out = [5, 10, 15, 30].map(ft => ({ label: `Move ${ft} ft`, run: () => spendMovement(ft, "Move") }));
  out.push({ label: `Move your full speed (${sp} ft)`, run: () => spendMovement(sp, "Move") });
  out.push({ label: "Dash", hint: `costs your action, +${sp} ft`, run: () => { COMBAT.moveBonus += sp; spendResource("action", "Dash"); } });
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
      <div style="margin-top:.3rem"><button type="button" id="cbt-start">Start combat</button></div>`;
    return;
  }

  if (status) status.textContent = `Round ${COMBAT.round}`;
  const mv = moveLeft(), mvMax = moveMax();
  el.innerHTML =
    `<div class="cbt-chips">${COMBAT_KINDS.map(combatChipHtml).join("")}
       <button type="button" class="cbt-chip${mv ? "" : " spent"}" data-cbt="move" title="Movement — click for ways to spend it">Movement <b>${mv}</b>/${mvMax} ft</button>
     </div>
     ${COMBAT.swings > 0 ? `<div class="hint">${COMBAT.swings} attack${COMBAT.swings === 1 ? "" : "s"} left in this Attack action.</div>` : ""}
     <div style="margin-top:.4rem">
       <button type="button" id="cbt-end">End Round</button>
       <button type="button" id="cbt-leave" title="leave combat and clear the tracker">End combat</button>
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
  m.innerHTML = `<div class="cbt-menu-title">${escapeHtml(top.title)}</div>${back}` +
    top.entries.map((e, i) =>
      `<div class="cbt-item${e.disabled ? " disabled" : ""}" data-cbtidx="${i}">
         <span>${escapeHtml(e.label)}${e.submenu ? " ›" : ""}</span>
         ${e.hint ? `<span class="hint">${escapeHtml(e.hint)}</span>` : ""}
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
    if (kind === "move") { spendMovement(5, "Move"); return; }   // a 5-ft step is the smallest useful unit
    spendResource(kind);
  });

  document.addEventListener("click", e => {
    const item = e.target.closest(".cbt-item");
    if (!item) { if (!e.target.closest("[data-cbt]")) closeCombatMenu(); return; }
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
    if (entry.run) entry.run();
    closeCombatMenu();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeCombatMenu(); });

  /* Rolling initiative is what puts you in combat — the whole point of the tracker is that you
     don't have to remember to turn it on. */
  document.addEventListener("click", e => {
    const init = e.target.closest('[data-roll-check="init"]');
    if (init && !COMBAT.active) setTimeout(() => enterCombat("initiative rolled"), 0);
  });

  /* Attack rolls book themselves. Deferred so the roll's own log entry lands first and the tracker's
     note reads as a consequence of it rather than a prediction. */
  document.addEventListener("click", e => {
    const btn = e.target.closest(".wpn-both, .wpn-roll");
    if (!btn || !COMBAT.active) return;
    const tr = btn.closest("tr");
    const name = tr ? (tr.querySelector(".atk-name") || {}).value : "";
    setTimeout(() => useAttackSwing(name), 0);
  });
});
