#!/usr/bin/env node
/* ============================================================
   Generates `uses` blocks (see conversion-guide.md's "Limited uses"
   section) for feats/classes/races by scanning data/*.json text for the
   same finite-use + recharge phrasings the app used to detect live, at
   render time, via regex (removed from src/class-library.js — see
   effects/tools/conversion-guide.md). This script keeps the same
   detection logic, but runs it once, offline, over the user's own data/
   folder, and its output is reviewed before being committed as ordinary
   effects DB entries — not re-run against arbitrary text in the browser.

   Usage:
     node effects/tools/generate-uses.js feats   > /tmp/uses-feats.json
     node effects/tools/generate-uses.js classes > /tmp/uses-classes.json
     node effects/tools/generate-uses.js races   > /tmp/uses-races.json

   Each prints a JSON array of { key, name, uses, text } for manual
   review — "text" is included only in this intermediate output (to help
   a human sanity-check the detection), never in a committed DB file.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { flattenEntries, stripTags } = require("../../src/text-utils.js");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const ABILITY_NAMES = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
const NUM_WORDS = { once: 1, twice: 2, thrice: 3, "three times": 3, "four times": 4, "five times": 5, "six times": 6 };

// A feature whose use-count itself scales with level (Action Surge, Channel Divinity,
// Indomitable, ...) can't be represented as a single flat `uses.max` — the schema has no
// per-level conditional. Rather than commit a number that's wrong for most of the leveling
// range, detect and skip these entirely (they fall back to "unsupported"/no tracker, same as
// any other mechanic this sheet can't yet represent).
function isLevelScaledCount(t) {
  const words = t.match(/\b(once|twice|thrice|three times|four times|five times|six times)\b/gi) || [];
  const distinct = new Set(words.map(w => NUM_WORDS[w.toLowerCase()]));
  if (distinct.size > 1) return true;   // e.g. "...twice between rests... three times between rests"
  // A base-1 clause ("once you use this feature... again") plus a *separate* higher-level clause
  // naming an explicit count is also scaling, even when only one explicit number word appears in
  // the whole text (e.g. Action Surge: the base is implied by the "can't use it again" phrasing
  // alone, and "twice" only shows up in the 17th-level clause) — check for the base clause and the
  // level clause as independent textual facts, not by which branch happened to set `max`.
  const hasBaseOneClause = /(?:once you use|when (?:it|you) uses?) (?:this feature|this|it)\b/i.test(t) &&
    /(can[’']?t use (?:this|it|the feature) again|must finish an? (?:short or long|long or short|short|long) rest before (?:you|it) can(?:not|'t)? use (?:this|it|the feature) again)/i.test(t);
  if (hasBaseOneClause && distinct.size >= 1 && /(?:starting|beginning) at \d+\w{0,2} level\b/i.test(t)) return true;
  return false;
}

function detectUses(rawText) {
  if (!rawText) return null;
  const t = rawText.replace(/\s+/g, " ");

  let max = null;
  if (/number of times equal to your proficiency bonus/i.test(t)) max = { prof: true };
  if (max == null) {
    const am = t.match(/number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i);
    if (am) {
      const ab = ABILITY_NAMES[am[1].toLowerCase()];
      const mm = t.match(/minimum of (once|twice|\d+)/i);
      max = mm ? { max: [{ mod: ab }, NUM_WORDS[mm[1].toLowerCase()] || Number(mm[1]) || 1] } : { mod: ab };
    }
  }
  if (max == null) {
    const wm = t.match(/use (?:this|it) (?:ability|feature|reaction|trait)?\s*(once|twice|thrice|three times|four times|five times|six times)\b/i);
    if (wm) max = NUM_WORDS[wm[1].toLowerCase()];
  }
  if (max == null && /\bonce per day\b/i.test(t)) max = 1;
  if (max == null && /once you use (?:this feature|this|it)\b/i.test(t) &&
      /(can[’']?t use (?:this|it) again|must finish an? (?:short or long|long or short|short|long) rest before you can use (?:this|it) again)/i.test(t)) {
    max = 1;
  }
  if (max == null) return null;
  if (isLevelScaledCount(t)) return null;

  let per = "lr", delayed = null;
  const dm = t.match(/until you finish (\d*d\d+) (?:long|short) rests?/i);
  if (dm) { delayed = { expr: dm[1].toLowerCase() }; per = "lr"; }
  else {
    // "until" matters as much as "when"/"before" here: "you can't use it again until you finish a
    // short or long rest" is the single most common recharge phrasing in the class data, and
    // missing it silently fell through to the `per = "lr"` default — turning every short-rest
    // feature phrased that way into a long-rest one (Echo Knight's Shadow Martyr, and others).
    const pm = t.match(/(?:when|before|until) you (?:can use it again,? )?finish an? (short or long|long or short|short|long) rest/i)
      || t.match(/must finish an? (short or long|long or short|short|long) rest/i);
    if (pm) per = pm[1].toLowerCase().includes("short") ? "sr" : "lr";
  }
  return { max, per, delayed };
}

function textOf(entries) { return stripTags(flattenEntries(entries)); }

function genFeats() {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "feats.json"), "utf8"));
  return (d.feat || []).map(f => {
    const text = textOf(f.entries);
    const uses = detectUses(text);
    if (!uses) return null;
    return { key: "feat|" + f.name.trim().toLowerCase(), name: f.name, uses, text };
  }).filter(Boolean);
}

function genRaces() {
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "races.json"), "utf8"));
  // Some race names appear more than once in races.json (reprints/parity updates in later
  // books) — the live app's RACE_LIB[r.name] = {...} (parseRaceFile) fully overwrites on each
  // later entry, so only the *last* one in file order is ever actually live. Match that here
  // instead of emitting (and duplicate-keying) traits from a shadowed reprint.
  const raceByName = {};
  (d.race || []).forEach(r => { if (!r._copy) raceByName[r.name] = r; });
  const out = [];
  Object.values(raceByName).forEach(r => {
    (r.entries || []).forEach(e => {
      if (!e || typeof e !== "object" || !e.name) return;
      const text = textOf(e.entries || [e.entry].filter(Boolean));
      const uses = detectUses(text);
      if (!uses) return;
      out.push({ key: "race|" + r.name.trim().toLowerCase() + "|" + e.name.trim().toLowerCase(), name: e.name, race: r.name, uses, text });
    });
  });
  return out;
}

function genClasses() {
  const dir = DATA_DIR + "/class";
  const out = [];
  fs.readdirSync(dir).filter(f => /^class-.*\.json$/.test(f)).forEach(file => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    // effKeyFor's "subclass" key uses the subclass's full `name`, not `subclassShortName" — same
    // lookup the live app does (r.subs[f.subclassShortName] = { name: sc.name, ... } in parseClassFile).
    const subclassNameByShort = {};
    (d.subclass || []).forEach(sc => { subclassNameByShort[sc.className + "|" + sc.shortName] = sc.name; });
    (d.classFeature || []).forEach(f => {
      const text = textOf(f.entries);
      const uses = detectUses(text);
      if (!uses) return;
      out.push({ key: "class|" + f.className.trim().toLowerCase() + "|" + f.name.trim().toLowerCase(), name: f.name, className: f.className, level: f.level, uses, text });
    });
    (d.subclassFeature || []).forEach(f => {
      const text = textOf(f.entries);
      const uses = detectUses(text);
      if (!uses) return;
      const subclassName = subclassNameByShort[f.className + "|" + f.subclassShortName] || f.subclassShortName;
      out.push({
        key: "subclass|" + f.className.trim().toLowerCase() + "|" + subclassName.trim().toLowerCase() + "|" + f.name.trim().toLowerCase(),
        name: f.name, className: f.className, subclassName, level: f.level, uses, text,
      });
    });
  });
  return out;
}

/* Keys already carried by a hand-written or LLM-converted DB file are dropped from the output.
   registerEffects() assigns whole entries rather than merging fields, so emitting a `uses`-only
   duplicate of (say) a classes-batch-*.js entry doesn't add a tracker to it — depending on script
   order it erases that entry's effects outright, or is itself erased. The converted entry is the
   richer record and wins; this generator only fills the gaps around it. The uses-<mode>.js file
   being regenerated is excluded from the ownership scan, so re-running doesn't drop everything. */
function ownedElsewhere(mode) {
  const dbDir = path.join(__dirname, "..", "db");
  const self = `uses-${mode}.js`;
  const owned = new Map();
  fs.readdirSync(dbDir).filter(f => f.endsWith(".js") && f !== self).forEach(file => {
    const sandbox = { registered: {} };
    sandbox.registerEffects = entries => Object.assign(sandbox.registered, entries);
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(dbDir, file), "utf8"), sandbox, { filename: file });
    Object.keys(sandbox.registered).forEach(k => owned.set(k, file));
  });
  return owned;
}

const mode = process.argv[2];
const fn = { feats: genFeats, races: genRaces, classes: genClasses }[mode];
if (!fn) { console.error("usage: node generate-uses.js <feats|races|classes>"); process.exit(1); }
const all = fn();
const owned = ownedElsewhere(mode);
const kept = all.filter(r => !owned.has(r.key));
all.filter(r => owned.has(r.key)).forEach(r => console.error(`skipped ${r.key} — already defined in ${owned.get(r.key)}`));
if (kept.length !== all.length) console.error(`(${all.length - kept.length} of ${all.length} detected features skipped as already-converted)`);
console.log(JSON.stringify(kept, null, 2));
