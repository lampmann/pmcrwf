#!/usr/bin/env node
/* ============================================================
   Static validator for effects/db/*.js entries — checks structural
   validity against the schema in src/effects.js without needing a
   browser (no DOM, no activeFeatures()). Run after any manual edit or
   LLM conversion pass, before committing:

     node effects/tools/validate-db.js

   Exits non-zero (and prints every problem found) if any entry is
   malformed. This does NOT check game-rules correctness (that's what
   the hand-checked fixtures in tests/effects.html are for) — only that
   the shape an entry uses is one the engine in src/effects.js actually
   understands, so a typo'd target/op doesn't silently no-op forever.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DB_DIR = path.join(__dirname, "..", "db");

const SKILL_SLUGS = new Set([
  "acrobatics", "animalhandling", "arcana", "athletics", "deception", "history",
  "insight", "intimidation", "investigation", "medicine", "nature", "perception",
  "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival",
]);
const ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);
const FIXED_TARGETS = new Set(["init", "hpmax", "profbonus", "spelldc", "spellatk", "passive-perception", "spell-grant", "ac", "speed"]);
const OPS = new Set(["add", "adddice", "min", "max", "set", "prof", "expertise", "adv", "dis", "note", "grant-free", "grant-list", "grant-innate"]);
const ACTIVATION_KINDS = new Set(["always", "toggle", "choice"]);
const CHOICE_KINDS = new Set(["pick", "ability", "spellfilter"]);
const SPELL_GRANT_OPS = ["grant-free", "grant-list", "grant-innate"];
const ENTRY_FIELDS = new Set(["name", "sv", "effects", "choices", "unsupported", "uses"]);
const EFFECT_FIELDS = new Set(["target", "op", "value", "text", "activation", "when"]);
const USES_FIELDS = new Set(["max", "per", "delayed"]);
// whenSatisfied() in src/effects.js returns false for any predicate it doesn't recognize, so an
// effect carrying a typo'd/invented key is silently inert forever — catch it here instead.
const WHEN_PREDICATES = new Set(["minLevel", "hasClass", "casting"]);
// evalValue() dispatches on the FIRST matching key and ignores every other field on the node, so
// `{ mod: "con", min: 1 }` quietly evaluates to a bare CON modifier — the "minimum 1" vanishes.
// Each node shape therefore declares exactly which sibling keys are legal.
const VALUE_NODE_FIELDS = [
  ["mod", new Set(["mod"])],
  ["prof", new Set(["prof"])],
  ["level", new Set(["level", "class"])],
  ["choice", new Set(["choice"])],
  ["sum", new Set(["sum"])],
  ["mul", new Set(["mul"])],
  ["floor", new Set(["floor"])],
  ["max", new Set(["max"])],
  ["min", new Set(["min"])],
];

function unknownFields(obj, allowed) { return Object.keys(obj).filter(k => !allowed.has(k)); }

function isKnownTarget(t) {
  if (typeof t !== "string") return false;
  if (t.includes("{choice:")) return true; // resolved at runtime; can't statically verify the slug
  if (FIXED_TARGETS.has(t)) return true;
  // "attack-hit"/"damage-bonus" are read by the Attacks module (src/attacks.js); every other
  // attack-/damage- name is still reserved — valid to write, but it lands in `unapplied` until
  // something reads it. Both cases are accepted here; see isReservedTarget() in src/effects.js.
  if (/^attack-|^damage-/.test(t)) return true;
  if (t.startsWith("save-")) return ABILITIES.has(t.slice(5));
  if (t.startsWith("skill-")) return SKILL_SLUGS.has(t.slice(6));
  if (t.startsWith("score-")) return ABILITIES.has(t.slice(6));
  return false;
}

function isValidValueExpr(v, choiceIds) {
  if (typeof v === "number") return true;
  if (v == null) return false;
  if (typeof v !== "object") return false;
  if ("mod" in v) return ABILITIES.has(v.mod);
  if ("prof" in v) return true;
  if ("level" in v) return v.level === "total" || v.level === "class";
  if ("choice" in v) return choiceIds.has(v.choice);
  if ("sum" in v) return Array.isArray(v.sum) && v.sum.every(x => isValidValueExpr(x, choiceIds));
  if ("mul" in v) return Array.isArray(v.mul) && v.mul.every(x => isValidValueExpr(x, choiceIds));
  if ("floor" in v) return isValidValueExpr(v.floor, choiceIds);
  if ("max" in v) return Array.isArray(v.max) && v.max.every(x => isValidValueExpr(x, choiceIds));
  if ("min" in v) return Array.isArray(v.min) && v.min.every(x => isValidValueExpr(x, choiceIds));
  return false;
}

/* Separate from isValidValueExpr's shape check: walks a value expression looking for fields the
   engine will silently drop (see VALUE_NODE_FIELDS). A node can be structurally "valid" and still
   mean something other than what it reads like, which is the worse failure of the two. */
function checkValueFields(where, v, errors) {
  if (v == null || typeof v !== "object") return;
  const node = VALUE_NODE_FIELDS.find(([k]) => k in v);
  if (node) {
    const stray = unknownFields(v, node[1]);
    if (stray.length) {
      errors.push(`${where} value expression {${node[0]}: …} has field(s) ${stray.map(s => `"${s}"`).join(", ")} that evalValue() ignores — ${JSON.stringify(v)}`);
    }
  }
  ["sum", "mul", "max", "min"].forEach(k => { if (Array.isArray(v[k])) v[k].forEach(x => checkValueFields(where, x, errors)); });
  if (v.floor != null) checkValueFields(where, v.floor, errors);
}

function validateEntry(key, entry, errors) {
  const where = `[${key}]`;
  if (typeof entry.name !== "string" || !entry.name.trim()) errors.push(`${where} missing/blank "name"`);
  if (entry.sv !== 1) errors.push(`${where} "sv" must be 1`);
  unknownFields(entry, ENTRY_FIELDS).forEach(f => errors.push(`${where} unknown entry field "${f}"`));

  const choiceIds = new Set((entry.choices || []).map(c => c.id));
  (entry.choices || []).forEach(c => {
    if (!c.id) errors.push(`${where} choice missing "id"`);
    if (!CHOICE_KINDS.has(c.kind)) errors.push(`${where} choice "${c.id}" has unknown kind "${c.kind}"`);
    if (c.kind === "pick" && !Array.isArray(c.options)) errors.push(`${where} choice "${c.id}" (kind pick) needs "options" array`);
    if (c.kind === "spellfilter" && !(typeof c.filter === "string" && c.filter.trim())) errors.push(`${where} choice "${c.id}" (kind spellfilter) needs a "filter" spec string`);
    if (c.kind === "pick" && c.n != null && (!Number.isInteger(c.n) || c.n < 1)) {
      errors.push(`${where} choice "${c.id}" has n=${c.n}; must be a positive integer`);
    }
    if (c.kind === "pick" && Array.isArray(c.options) && c.n > c.options.length) {
      errors.push(`${where} choice "${c.id}" picks ${c.n} from only ${c.options.length} option(s)`);
    }
  });

  (entry.effects || []).forEach((eff, i) => {
    const w = `${where} effects[${i}]`;
    unknownFields(eff, EFFECT_FIELDS).forEach(f => errors.push(`${w} unknown field "${f}"`));
    if (!isKnownTarget(eff.target)) errors.push(`${w} unknown target "${eff.target}"`);
    if (!OPS.has(eff.op)) errors.push(`${w} unknown op "${eff.op}"`);
    if (eff.when) {
      unknownFields(eff.when, WHEN_PREDICATES).forEach(p =>
        errors.push(`${w} unrecognized "when" predicate "${p}" — whenSatisfied() will never let this effect apply`));
    }
    if (["add", "min", "max", "set"].includes(eff.op) && !isValidValueExpr(eff.value, choiceIds)) {
      errors.push(`${w} op "${eff.op}" has invalid/missing "value" expression`);
    }
    checkValueFields(w, eff.value, errors);
    if (eff.op === "adddice" && typeof eff.value !== "string") errors.push(`${w} op "adddice" needs a string dice "value"`);
    if (eff.op === "note" && typeof eff.text !== "string") errors.push(`${w} op "note" needs a string "text"`);
    if (SPELL_GRANT_OPS.includes(eff.op) && !(eff.value && typeof eff.value.name === "string" && eff.value.name.trim())) {
      errors.push(`${w} op "${eff.op}" needs a "value.name" string (the spell's name, or a "{choice:id}" template)`);
    }
    if (eff.target === "spell-grant" && !SPELL_GRANT_OPS.includes(eff.op)) {
      errors.push(`${w} target "spell-grant" must use op "grant-free", "grant-list", or "grant-innate"`);
    }
    if (eff.value && eff.value.name && eff.value.name.includes("{choice:")) {
      const m = eff.value.name.match(/\{choice:([a-zA-Z0-9_]+)\}/);
      if (m && !choiceIds.has(m[1])) errors.push(`${w} value.name references undeclared choice "${m[1]}"`);
    }
    if (eff.activation) {
      const act = eff.activation;
      if (!ACTIVATION_KINDS.has(act.kind)) errors.push(`${w} unknown activation.kind "${act.kind}"`);
      if (act.kind === "toggle" && !act.id) errors.push(`${w} activation kind "toggle" needs an "id"`);
      if (act.kind === "choice" && !choiceIds.has(act.choice)) errors.push(`${w} activation.choice "${act.choice}" not declared in "choices"`);
    }
    if (eff.target && eff.target.includes("{choice:")) {
      const m = eff.target.match(/\{choice:([a-zA-Z0-9_]+)\}/);
      if (m && !choiceIds.has(m[1])) errors.push(`${w} target references undeclared choice "${m[1]}"`);
    }
  });

  (entry.unsupported || []).forEach((u, i) => {
    if (typeof u.reason !== "string" || !u.reason.trim()) errors.push(`${where} unsupported[${i}] missing "reason"`);
  });

  if (entry.uses) {
    const w = `${where} uses`;
    unknownFields(entry.uses, USES_FIELDS).forEach(f => errors.push(`${w} unknown field "${f}"`));
    if (!isValidValueExpr(entry.uses.max, choiceIds)) errors.push(`${w} invalid/missing "max" value expression`);
    checkValueFields(`${w}.max`, entry.uses.max, errors);
    if (!["sr", "lr"].includes(entry.uses.per)) errors.push(`${w} "per" must be "sr" or "lr"`);
    if (entry.uses.delayed != null && !/^\d*d\d+$/i.test(entry.uses.delayed.expr || "")) {
      errors.push(`${w} "delayed.expr" must be dice notation like "1d4"`);
    }
  }

  if (!entry.effects && !entry.unsupported && !entry.uses) errors.push(`${where} has neither "effects", "unsupported", nor "uses" — nothing for this entry to do`);
}

function loadDbFile(file) {
  const src = fs.readFileSync(file, "utf8");
  const sandbox = { registered: {} };
  sandbox.registerEffects = entries => Object.assign(sandbox.registered, entries);
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: file });
  return sandbox.registered;
}

/* A DB file with no <script> tag is inert: it parses, it validates, and the app never sees a byte
   of it. That's a silent failure the schema checks below can't reach, so check the wiring too —
   every effects/db/*.js must be loaded by the app page AND by the test page. */
function checkWiring(files, errors) {
  [["character-sheet.html", "effects/db/"], ["tests/effects.html", "../effects/db/"]].forEach(([page, prefix]) => {
    const full = path.join(__dirname, "..", "..", page);
    let html;
    try {
      html = fs.readFileSync(full, "utf8");
    } catch (e) {
      errors.push(`${page}: can't read to verify DB wiring — ${e.message}`);
      return;
    }
    files.forEach(f => {
      if (!html.includes(`src="${prefix}${f}"`)) errors.push(`${page} has no <script> tag for effects/db/${f} — its entries are loaded by nothing and can never fire`);
    });
  });
}

function main() {
  const files = fs.readdirSync(DB_DIR).filter(f => f.endsWith(".js"));
  let errors = [];
  checkWiring(files, errors);
  const seenKeys = new Map();
  for (const file of files) {
    const full = path.join(DB_DIR, file);
    let entries;
    try {
      entries = loadDbFile(full);
    } catch (e) {
      errors.push(`${file}: failed to load/parse — ${e.message}`);
      continue;
    }
    for (const [key, entry] of Object.entries(entries)) {
      if (seenKeys.has(key)) errors.push(`duplicate key "${key}" in ${file} (already defined in ${seenKeys.get(key)})`);
      seenKeys.set(key, file);
      const perEntryErrors = [];
      validateEntry(key, entry, perEntryErrors);
      perEntryErrors.forEach(e => errors.push(`${file}: ${e}`));
    }
  }
  if (errors.length) {
    console.error(`FAILED — ${errors.length} problem(s):\n`);
    errors.forEach(e => console.error("  " + e));
    process.exit(1);
  }
  console.log(`OK — validated ${seenKeys.size} entries across ${files.length} file(s).`);
}

main();
