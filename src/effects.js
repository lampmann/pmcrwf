/* ============================================================
   EFFECTS ENGINE — applies the declarative overlay in EFFECTS_DB (see
   effects/effects-db.js) on top of the live feature list from
   activeFeatures() (class-library.js). See DOCS.md for the full schema
   writeup; the short version:

   An entry (keyed by effKeyFor()) has effects: [{target, op, value?,
   activation?, when?}]. Evaluation is layered so nothing can cycle:
     L0  score-*         literal adds only
     L1  profbonus        may reference L0
     L2  prof/expertise   -> profMult, read by L3
     L3  numeric targets  may reference L0/L1/choices — never another L3 key
     L4  adv/dis/adddice/notes
   Because a value expression can only ever reach L0/L1/choices (see
   evalValue below — there is deliberately no "read another target" node),
   cross-effect cycles are impossible by construction, not by a solver.

   "attack-hit" and "damage-bonus" are read by the Attacks module
   (attacks.js): they fold into every attack row's to-hit bonus / damage
   expression the same way a row's own Hit+ / Dmg+ field does, and an
   adv/dis on "attack-hit" forces the to-hit roll's mode. Because the
   engine has no per-weapon predicate, the bucket is global — a row opts
   out with its own `fx` checkbox (see attacks.js) when the effect doesn't
   apply to that weapon (Sharpshooter on your dagger, Rage on your bow).

   "damage-crit", "attack-crit-range" and "attack-ability" are read there
   too: crit-only damage dice, a widened crit range, and an op that
   REPLACES the ability a row uses (Battle Smith) rather than adding to it.

   Every OTHER "attack-"/"damage-"-prefixed target is still reserved: no
   module reads it, so it always lands in snap.unapplied instead of being
   applied, however its activation resolves. That's what lets an entry be
   written once now and "switch on" later without re-conversion — which is
   exactly how Sharpshooter, Great Weapon Master and then the crit targets
   reached the Attacks module.

   WHAT STILL CAN'T BE EXPRESSED: anything needing per-weapon context. The
   attack buckets are global — every row reads the same ones — so "heavy
   weapons only", or a crit die the weapon itself defines (Savage Attacks,
   Brutal Critical), has no home here. Each row's `fx` checkbox is the
   manual stand-in.

   "spell-grant" is a different kind of target entirely — not numeric, so
   it's skipped here and rendered directly off entry.effects instead (see
   renderEffectControls in effects-ui.js), the same way toggle buttons and
   always-on chips already bypass the snapshot. Two ops: "grant-free" (the
   spell is known/prepared for free — a Cleric domain spell, a Mark of
   Warding's innate grant — never counted against a class's Known/Prepared
   total) and "grant-list" (merely added to your spell list — a Dragonmark
   or Eldritch-Knight-style expansion — still costs a normal known/prepared
   slot on whichever class you learn it through). Race/subclass grants
   already work today via a separate, auto-derived pipeline (5e.tools'
   `additionalSpells` field, parsed in class-library.js) — this target
   exists for everything THAT pipeline doesn't reach, chiefly feats (whose
   additionalSpells the app otherwise ignores entirely).
   ============================================================ */

/* ----- DB key scheme (see activeFeatures() in class-library.js for `origin` shapes) ----- */
function effKeyFor(origin, name) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return null;
  switch (origin.kind) {
    case "feat": return "feat|" + n;
    case "race": return "race|" + origin.raceName.trim().toLowerCase() + "|" + n;
    case "subrace": return "subrace|" + origin.subraceName.trim().toLowerCase() + "|" + n;
    case "class": return "class|" + origin.className.trim().toLowerCase() + "|" + n;
    case "subclass": return "subclass|" + origin.className.trim().toLowerCase() + "|" + origin.subclassName.trim().toLowerCase() + "|" + n;
    default: return null;
  }
}
/* attack-/damage- targets a module actually reads today (attacks.js). Anything else under those
   prefixes stays reserved — see the header comment. */
const LIVE_ATTACK_TARGETS = new Set(["attack-hit", "damage-bonus", "damage-crit", "attack-crit-range", "attack-ability"]);
function isReservedTarget(t) { return /^(attack-|damage-)/.test(t) && !LIVE_ATTACK_TARGETS.has(t); }

/* ----- persisted per-instance state (character choices, not library data — see persistence.js) ----- */
let EFFECT_CHOICES = {};   // { fkey: { choiceId: value } }
let EFFECT_TOGGLES = {};   // { "fkey|toggleId": true }

function dbEntryFor(feature) { return feature.effKey ? EFFECTS_DB[feature.effKey] : null; }

/* ----- limited-use ("N uses per rest") spec, declared on a DB entry as `uses: { max, per, delayed? }` —
   `max` is an ordinary value expression (see evalValue below), so "proficiency bonus" is
   `{ prof: true }` and "your CON modifier, minimum 1" is `{ max: [{ mod: "con" }, 1] }`. `per` is
   "sr" or "lr" (short-rest recovery also happens on a long rest, same as the 2014 rules). `delayed`
   is only for the "once expended, roll NdN — that many long rests until it recharges" pattern
   (Sorcerous Restoration-style features), as `{ expr: "1d4" }`. This replaces scanning feature text
   for phrasings at render time: a feature only gets a uses tracker if its DB entry declares one. */
function usesSpecFor(feature) { const e = dbEntryFor(feature); return e && e.uses ? e.uses : null; }
function usesMaxFor(feature, maxExpr) { return Math.max(0, evalValue(feature, maxExpr)); }
function choiceValue(feature, id) { const c = EFFECT_CHOICES[feature.fkey]; return c ? c[id] : undefined; }
function hasChoiceValue(feature, id) {
  const v = choiceValue(feature, id);
  return Array.isArray(v) ? v.some(x => x != null && x !== "") : (v != null && v !== "");
}
function resolveTarget(feature, target) {
  return target.replace(/\{choice:([a-zA-Z0-9_]+)\}/g, (_, id) => {
    const v = choiceValue(feature, id);
    return (Array.isArray(v) ? v[0] : v) || "";
  });
}
// Like resolveTarget, but a multi-pick choice (an array value, from a `pick n>1` choice — see
// effects-ui.js) expands into one resolved target per filled slot, so the same effect applies once
// per skill/save the player actually picked instead of collapsing to a single slot.
function resolveTargetsAll(feature, target) {
  const m = target.match(/\{choice:([a-zA-Z0-9_]+)\}/);
  if (!m) return [target];
  const v = choiceValue(feature, m[1]);
  const vals = Array.isArray(v) ? v.filter(x => x != null && x !== "") : (v != null && v !== "" ? [v] : [""]);
  return vals.map(val => target.replace(m[0], val));
}

/* What armour you are actually wearing, as a category — "none" when nothing is equipped. Read from
   the same equipped-item lookup the AC formula uses (equippedArmorLibs in derived.js), so a predicate
   and the AC it implies can never disagree about what you have on. Shields are separate: a shield is
   not body armour, and "not wearing heavy armour" says nothing about carrying one. */
function armorWorn() {
  if (typeof equippedArmorLibs !== "function") return "none";
  const body = equippedArmorLibs().find(lib => lib.armor && lib.armorCat !== "shield");
  return body ? (body.armorCat || "unknown") : "none";
}
function shieldWorn() {
  if (typeof equippedArmorLibs !== "function") return false;
  return equippedArmorLibs().some(lib => lib.armorCat === "shield");
}
function classLevelOf(name) {
  const want = String(name || "").trim().toLowerCase();
  return getClasses().filter(c => c.name.trim().toLowerCase() === want).reduce((s, c) => s + (c.lvl || 0), 0);
}

/* Conditions the engine can evaluate. An effect carrying an unrecognized key is left INACTIVE rather
   than silently applied — the "degrade to manual, never guess" rule — and still shows in the audit.
   Every key here is checkable from state the sheet already owns; nothing infers from feature text. */
function whenSatisfied(when, feature) {
  if (!when) return true;
  return Object.entries(when).every(([k, v]) => {
    if (k === "minLevel") return totalLevel() >= v;
    if (k === "maxLevel") return totalLevel() <= v;
    if (k === "hasClass") return getClasses().some(c => c.name.trim().toLowerCase() === String(v).trim().toLowerCase());
    if (k === "casting") return getClasses().some(c => (c.casting === "auto" ? classCasting(c.name, c.sub) : c.casting) !== "none");
    // Level bands within one class — "@self" means the class this feature came from, which is what a
    // subclass feature almost always wants.
    if (k === "minClassLevel" || k === "maxClassLevel") {
      const cls = (v.class === "@self" || v.class == null) ? ((feature && feature.origin && feature.origin.className) || "") : v.class;
      const lvl = classLevelOf(cls);
      return k === "minClassLevel" ? lvl >= v.level : lvl <= v.level;
    }
    // Armour state. `armor` is an allow-list of categories you may be wearing ("none", "light",
    // "medium", "heavy"); `notArmor` is the deny-list form that Fast Movement and friends actually
    // phrase themselves in ("while you aren't wearing heavy armor").
    if (k === "armor") return [].concat(v).includes(armorWorn());
    if (k === "notArmor") return ![].concat(v).includes(armorWorn());
    if (k === "shield") return shieldWorn() === !!v;
    return false;   // unrecognized predicate — can't verify, so don't apply
  });
}
function isActivated(feature, effect) {
  const act = effect.activation || { kind: "always" };
  if (!whenSatisfied(effect.when, feature)) return false;
  if (act.kind === "always") return true;
  if (act.kind === "toggle") return !!EFFECT_TOGGLES[feature.fkey + "|" + act.id];
  if (act.kind === "choice") return hasChoiceValue(feature, act.choice);
  return false;
}

/* value expressions: literal | {mod} | {prof} | {level} | {choice} | {sum}/{mul}/{floor}/{max}/{min}.
   Deliberately no accessor for an L3 stat (init, save-<ab>, skill-<slug>, etc.) — see the header comment. */
function evalValue(feature, v) {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  if ("mod" in v) return mod(num($("score-" + v.mod)));
  if ("prof" in v) return profBonus();
  if ("level" in v) {
    if (v.level === "total") return totalLevel();
    if (v.level === "class") {
      const want = (v.class === "@self" ? (feature.origin.className || "") : v.class || "").trim().toLowerCase();
      return getClasses().filter(c => c.name.trim().toLowerCase() === want).reduce((s, c) => s + (c.lvl || 0), 0);
    }
    return 0;
  }
  if ("choice" in v) return Number(choiceValue(feature, v.choice)) || 0;
  if ("sum" in v) return v.sum.reduce((s, x) => s + evalValue(feature, x), 0);
  if ("mul" in v) return v.mul.reduce((s, x) => s * evalValue(feature, x), 1);
  if ("floor" in v) return Math.floor(evalValue(feature, v.floor));
  if ("ceil" in v) return Math.ceil(evalValue(feature, v.ceil));
  if ("round" in v) return Math.round(evalValue(feature, v.round));
  if ("div" in v) { const [a, b] = v.div.map(x => evalValue(feature, x)); return b ? a / b : 0; }
  if ("max" in v) return Math.max(...v.max.map(x => evalValue(feature, x)));
  if ("min" in v) return Math.min(...v.min.map(x => evalValue(feature, x)));
  return 0;
}

/* A dice term, either literal ("1d6") or COMPUTED from a value expression — { count, die } — which is
   what Sneak Attack and friends need: `{ count: { ceil: { div: [{ level: "class", class: "@self" }, 2] } }, die: "d6" }`
   is ceil(level/2)d6. A computed count of zero yields no term at all rather than a bogus "0d6".

   NOT called evalDice: dice.js already owns that name for its expression tokenizer, and this file
   loads after it — defining a second one here would silently replace the dice roller's own. */
function evalDiceTerm(feature, v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (v.die) {
    const n = Math.max(0, Math.floor(evalValue(feature, v.count == null ? 1 : v.count)));
    return n ? n + String(v.die) : "";
  }
  return "";
}

function buildEffectsSnapshot() {
  const snap = { flat: {}, dice: {}, profMult: {}, mode: {}, notes: {}, contribs: {}, unapplied: [],
    dieFloor: {}, critMin: {}, ability: {}, tags: {} };
  const addContrib = (target, c) => { (snap.contribs[target] || (snap.contribs[target] = [])).push(c); };
  const mins = {}, maxes = {};
  // Published while building so a re-entrant read resolves against the partial snapshot instead of
  // recursing (see effectsSnapshot). An L3 value expression legitimately reaches L1: `{ prof: true }`
  // calls profBonus(), which is itself `base + effFlat("profbonus")`. Without this the first entry to
  // put { prof: true } on a real target blows the stack — the layering in the header comment is a
  // rule for authors, not something the single-pass build enforces on itself.
  _effBuilding = snap;
  const features = (typeof activeFeatures === "function") ? activeFeatures() : [];
  features.forEach(feature => {
    const entry = dbEntryFor(feature);
    if (!entry) return;
    (entry.unsupported || []).forEach(u => snap.unapplied.push({ source: feature.name, fkey: feature.fkey, target: null, reason: u.reason }));
    (entry.effects || []).forEach(effect => {
      if (effect.target === "spell-grant") return;   // rendered directly by renderEffectControls, not numeric
      resolveTargetsAll(feature, effect.target).forEach(target => {
      if (!target) return;
      if (isReservedTarget(target)) {
        snap.unapplied.push({ source: feature.name, fkey: feature.fkey, target, reason: `not automated yet (no module reads "${target}")` });
        return;
      }
      if (!isActivated(feature, effect)) return;
      switch (effect.op) {
        case "add": {
          const n = evalValue(feature, effect.value);
          snap.flat[target] = (snap.flat[target] || 0) + n;
          addContrib(target, { source: feature.name, fkey: feature.fkey, op: "add", n });
          break;
        }
        case "adddice": {
          const raw = evalDiceTerm(feature, effect.value);
          if (!raw) break;                                   // a computed count of 0 contributes nothing
          const signed = /^[+-]/.test(raw) ? raw : "+" + raw;
          snap.dice[target] = (snap.dice[target] || "") + signed;
          addContrib(target, { source: feature.name, fkey: feature.fkey, op: "adddice", n: raw });
          break;
        }
        /* Reliable Talent and friends: "treat a d20 roll of N or lower as N". The highest floor wins
           when two apply, and dice.js turns it into the roller's own `mi` operator. */
        case "diefloor": {
          const n = evalValue(feature, effect.value);
          snap.dieFloor[target] = Math.max(snap.dieFloor[target] || 0, n);
          addContrib(target, { source: feature.name, fkey: feature.fkey, op: "diefloor", n: "min " + n });
          break;
        }
        /* Improved Critical / Superior Critical: "your weapon attacks score a critical hit on a 19-20".
           The LOWEST threshold wins, since a wider range subsumes a narrower one. */
        case "critrange": {
          const n = evalValue(feature, effect.value);
          snap.critMin[target] = Math.min(snap.critMin[target] == null ? 20 : snap.critMin[target], n);
          addContrib(target, { source: feature.name, fkey: feature.fkey, op: "critrange", n: n + "-20" });
          break;
        }
        /* Battle Smith, Hexblade's pact weapon: use a different ability for this roll rather than
           adding to it. Last writer wins — two features replacing the same modifier is not a case the
           rules produce, and averaging them would be nonsense. */
        case "useability": {
          snap.ability[target] = String(effect.value || "").toLowerCase();
          addContrib(target, { source: feature.name, fkey: feature.fkey, op: "useability", n: String(effect.value).toUpperCase() });
          break;
        }
        /* A standing, non-numeric property: a damage resistance, an immunity, advantage on saves
           against a named condition. Collected as a set per target so the sheet can list them. */
        case "tag": {
          const t = snap.tags[target] || (snap.tags[target] = []);
          const label = String(effect.value || effect.text || "");
          if (label && !t.some(x => x.label === label)) t.push({ label, source: feature.name });
          addContrib(target, { source: feature.name, fkey: feature.fkey, op: "tag", n: label });
          break;
        }
        case "min": { const n = evalValue(feature, effect.value); mins[target] = mins[target] == null ? n : Math.max(mins[target], n); addContrib(target, { source: feature.name, fkey: feature.fkey, op: "min", n }); break; }
        case "max": { const n = evalValue(feature, effect.value); maxes[target] = maxes[target] == null ? n : Math.min(maxes[target], n); addContrib(target, { source: feature.name, fkey: feature.fkey, op: "max", n }); break; }
        case "set": { const n = evalValue(feature, effect.value); snap.flat[target] = n; addContrib(target, { source: feature.name, fkey: feature.fkey, op: "set", n }); break; }
        case "prof": snap.profMult[target] = Math.max(snap.profMult[target] || 0, 1); addContrib(target, { source: feature.name, fkey: feature.fkey, op: "prof", n: "prof" }); break;
        case "expertise": snap.profMult[target] = Math.max(snap.profMult[target] || 0, 2); addContrib(target, { source: feature.name, fkey: feature.fkey, op: "expertise", n: "expertise" }); break;
        case "adv": snap.mode[target] = snap.mode[target] === "dis" ? "normal" : "adv"; addContrib(target, { source: feature.name, fkey: feature.fkey, op: "adv", n: "adv" }); break;
        case "dis": snap.mode[target] = snap.mode[target] === "adv" ? "normal" : "dis"; addContrib(target, { source: feature.name, fkey: feature.fkey, op: "dis", n: "dis" }); break;
        case "note": (snap.notes[target] || (snap.notes[target] = [])).push(feature.name + ": " + effect.text); break;
      }
      });
    });
  });
  Object.keys(mins).forEach(t => { snap.flat[t] = Math.max(snap.flat[t] || 0, mins[t]); });
  Object.keys(maxes).forEach(t => { snap.flat[t] = Math.min(snap.flat[t] || 0, maxes[t]); });
  _effBuilding = null;
  return snap;
}

/* ----- generation-counted cache: rebuilt once per recompute() pass, not once per keystroke.
   recompute() (derived.js) calls invalidateEffects() first; toggle/choice handlers call it too.
   The Features panel and recompute() are two independent `input` listeners with no guaranteed
   order — this makes that order irrelevant, since whichever fires first builds the snapshot and
   the other just reuses it. ----- */
let _effGen = 0, _effCache = null, _effCacheGen = -1, _effBuilding = null;
function invalidateEffects() { _effGen++; _effBuilding = null; }
function effectsSnapshot() {
  // A build in progress answers reads from its own partial snapshot. The cache generation is only
  // stamped once the build finishes, so without this an effect value that reads back into the
  // snapshot (any { prof: true }, via profBonus -> effFlat("profbonus")) would restart the build
  // and recurse until the stack blows. Reading the partial result means such a value sees the
  // profbonus contributions applied so far — exact whenever nothing targets profbonus, which is
  // every entry in the database today.
  if (_effBuilding) return _effBuilding;
  if (_effCacheGen !== _effGen) { _effCache = buildEffectsSnapshot(); _effCacheGen = _effGen; }
  return _effCache;
}

function effFlat(target) { return effectsSnapshot().flat[target] || 0; }
function effDieFloor(target) { return effectsSnapshot().dieFloor[target] || 0; }
function effCritMin(target) { const n = effectsSnapshot().critMin[target]; return n == null ? 20 : n; }
function effAbility(target) { return effectsSnapshot().ability[target] || null; }
function effTags(target) { return effectsSnapshot().tags[target] || []; }
/* Every target under a prefix, for the readouts that list whatever happens to be there — resistances,
   extra movement speeds, condition-save advantages — rather than asking for each by name. */
function effTagsByPrefix(prefix) {
  const tags = effectsSnapshot().tags, out = [];
  Object.keys(tags).forEach(t => { if (t.startsWith(prefix)) out.push({ target: t, kind: t.slice(prefix.length), items: tags[t] }); });
  return out.sort((a, b) => a.kind.localeCompare(b.kind));
}
function effFlatByPrefix(prefix) {
  const flat = effectsSnapshot().flat, out = [];
  Object.keys(flat).forEach(t => { if (t.startsWith(prefix) && flat[t]) out.push({ target: t, kind: t.slice(prefix.length), n: flat[t] }); });
  return out.sort((a, b) => a.kind.localeCompare(b.kind));
}
function effDice(target) { return effectsSnapshot().dice[target] || ""; }
function effMode(target) { return effectsSnapshot().mode[target] || null; }
function effContribs(target) { return effectsSnapshot().contribs[target] || []; }
function effAnnotations(target) {
  const c = effContribs(target).filter(x => typeof x.n === "number");
  return c.length ? " " + c.map(x => `[${x.source} ${sign(x.n)}]`).join("") : "";
}

function toggleEffect(fkey, id) {
  const key = fkey + "|" + id;
  EFFECT_TOGGLES[key] = !EFFECT_TOGGLES[key];
  invalidateEffects(); recompute(); scheduleSave();
  if (typeof renderClassFeatures === "function") renderClassFeatures();
}
