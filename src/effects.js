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

   Targets prefixed "attack-"/"damage-" are reserved: no module reads them
   yet (there's no weapons/attacks module), so they always land in
   snap.unapplied instead of being applied, however their activation
   resolves. That's what lets an entry like Sharpshooter be written once
   now and "switch on" later without re-conversion.

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
function isReservedTarget(t) { return /^(attack-|damage-)/.test(t); }

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

/* Conditions the engine can actually evaluate today. Anything else in a `when` block (armor state,
   weapon type, etc.) can't be checked yet, so — per the "degrade to manual, never guess" rule — an
   effect carrying an unrecognized condition key is simply left inactive rather than silently applied;
   it still shows up in the audit as a feature whose effect wasn't automated. */
function whenSatisfied(when) {
  if (!when) return true;
  return Object.entries(when).every(([k, v]) => {
    if (k === "minLevel") return totalLevel() >= v;
    if (k === "hasClass") return getClasses().some(c => c.name.trim().toLowerCase() === String(v).trim().toLowerCase());
    if (k === "casting") return getClasses().some(c => (c.casting === "auto" ? classCasting(c.name, c.sub) : c.casting) !== "none");
    return false;   // unrecognized predicate — can't verify, so don't apply
  });
}
function isActivated(feature, effect) {
  const act = effect.activation || { kind: "always" };
  if (!whenSatisfied(effect.when)) return false;
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
  if ("max" in v) return Math.max(...v.max.map(x => evalValue(feature, x)));
  if ("min" in v) return Math.min(...v.min.map(x => evalValue(feature, x)));
  return 0;
}

function buildEffectsSnapshot() {
  const snap = { flat: {}, dice: {}, profMult: {}, mode: {}, notes: {}, contribs: {}, unapplied: [] };
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
        snap.unapplied.push({ source: feature.name, fkey: feature.fkey, target, reason: "not automated yet (attacks module not implemented)" });
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
          const d = String(effect.value), signed = /^[+-]/.test(d) ? d : "+" + d;
          snap.dice[target] = (snap.dice[target] || "") + signed;
          addContrib(target, { source: feature.name, fkey: feature.fkey, op: "adddice", n: d });
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
