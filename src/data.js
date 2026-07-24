/* ---------- Reference data ---------- */
const ABILITIES = [
  {key:"str", name:"Strength"}, {key:"dex", name:"Dexterity"}, {key:"con", name:"Constitution"},
  {key:"int", name:"Intelligence"}, {key:"wis", name:"Wisdom"}, {key:"cha", name:"Charisma"},
];
const SKILLS = [
  ["Acrobatics","dex"],["Animal Handling","wis"],["Arcana","int"],["Athletics","str"],
  ["Deception","cha"],["History","int"],["Insight","wis"],["Intimidation","cha"],
  ["Investigation","int"],["Medicine","wis"],["Nature","int"],["Perception","wis"],
  ["Performance","cha"],["Persuasion","cha"],["Religion","int"],["Sleight of Hand","dex"],
  ["Stealth","dex"],["Survival","wis"],
];

/* ---------- SRD class data (hit die & casting type, keyed by lowercased class name) ----------
   Small, fixed SRD facts get hardcoded per DOCS.md's data-sourcing policy; used to auto-fill
   the Hit Die / Casting selects unless the row is manually overridden. */
const CLASS_DATA = {
  barbarian: { hitDie: "d12", casting: "none" },
  bard: { hitDie: "d8", casting: "full" },
  cleric: { hitDie: "d8", casting: "full" },
  druid: { hitDie: "d8", casting: "full" },
  fighter: { hitDie: "d10", casting: "none" },
  monk: { hitDie: "d8", casting: "none" },
  paladin: { hitDie: "d10", casting: "half" },
  ranger: { hitDie: "d10", casting: "half" },
  rogue: { hitDie: "d8", casting: "none" },
  sorcerer: { hitDie: "d6", casting: "full" },
  warlock: { hitDie: "d8", casting: "pact" },
  wizard: { hitDie: "d6", casting: "full" },
};
// Third-caster subclasses grant Casting even though their base class doesn't.
const SUBCLASS_CASTING = {
  "eldritch knight": "third",
  "arcane trickster": "third",
};
function classHitDie(name) { const d = CLASS_DATA[(name || "").trim().toLowerCase()]; return d ? d.hitDie : "d8"; }
function classCasting(name, sub) {
  const subCast = SUBCLASS_CASTING[(sub || "").trim().toLowerCase()];
  if (subCast) return subCast;
  const d = CLASS_DATA[(name || "").trim().toLowerCase()];
  return d ? d.casting : "none";
}

/* ---------- Known/prepared spell counts (2014 PHB/TCE rules, SRD-scale hardcoded tables) ----------
   "prepared" classes (Cleric/Druid/Paladin/Wizard/Artificer) choose daily from their whole class
   list; "known" classes (Bard/Ranger/Sorcerer/Warlock, and the third-caster Eldritch Knight/Arcane
   Trickster) are capped by a fixed table. Each class's own casting ability is used here (not the
   sheet's single "Spellcasting ability" field), so multiclass prepared/known counts stay correct
   even when two of your classes use different abilities. */
const CASTING_STYLE = {
  cleric: "prepared", druid: "prepared", paladin: "prepared", wizard: "prepared", artificer: "prepared",
  bard: "known", ranger: "known", sorcerer: "known", warlock: "known",
};
const CASTING_ABILITY = {
  cleric: "wis", druid: "wis", paladin: "cha", wizard: "int", artificer: "int",
  bard: "cha", ranger: "wis", sorcerer: "cha", warlock: "cha",
};
const SUBCLASS_CASTING_STYLE = { "eldritch knight": "known", "arcane trickster": "known" };
const SUBCLASS_CASTING_ABILITY = { "eldritch knight": "int", "arcane trickster": "int" };
// "Half-prepared" classes use floor(level/2) instead of the full class level in the prepared formula.
const HALF_PREPARED_CLASSES = ["paladin", "artificer"];
// index = class level (1-20); [level] = spells known at that level.
const SPELLS_KNOWN_TABLE = {
  bard:     [null, 4, 5, 6, 7, 8, 9,10,11,12,14,15,15,16,18,19,19,20,22,22,22],
  sorcerer: [null, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,12,13,13,14,14,15,15,15,15],
  warlock:  [null, 2, 3, 4, 5, 6, 7, 8, 9,10,10,11,11,12,12,13,13,14,14,15,15],
  ranger:   [null, 0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9,10,10,11,11],
};
// Eldritch Knight & Arcane Trickster share this table (no spells known before level 3).
const THIRD_CASTER_KNOWN = [null, 0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9,10,10,11,11,11,12,13];
// Returns { style: "known"|"prepared", max, spellbookMax? } for a class-table row ({name, sub, lvl}),
// or null if that class/subclass isn't a spellcaster. `max` for a "prepared" class is how many can be
// prepared at once; `spellbookMax`, only set for Wizard, is the separate (larger) known/spellbook pool
// (PHB: 4 + 2 per level, i.e. spells the Wizard actually has *written down* — not counting scroll copies —
// as distinct from how many of those it can have prepared on a given day).
function classSpellAllowance(c) {
  const name = (c.name || "").trim().toLowerCase(), sub = (c.sub || "").trim().toLowerCase(), lvl = Math.max(0, Math.min(20, c.lvl || 0));
  if (!lvl) return null;
  if (SUBCLASS_CASTING_STYLE[sub]) return { style: "known", max: THIRD_CASTER_KNOWN[lvl] || 0 };
  const style = CASTING_STYLE[name];
  if (!style) return null;
  const abilMod = mod($("score-" + CASTING_ABILITY[name]).value);
  if (style === "known") { const t = SPELLS_KNOWN_TABLE[name]; return t ? { style, max: t[lvl] || 0 } : null; }
  const base = HALF_PREPARED_CLASSES.includes(name) ? Math.floor(lvl / 2) : lvl;
  const result = { style, max: Math.max(1, base + abilMod) };
  if (name === "wizard") result.spellbookMax = 4 + 2 * lvl;
  return result;
}
// Cantrips known (2014 PHB/TCE): a fixed number, entirely separate from the known/prepared/spellbook
// totals above — cantrips are always available and never "prepared" or written into a spellbook.
// Paladin and (2014) Ranger aren't in this table, i.e. they get none.
const CANTRIPS_KNOWN_TABLE = {
  bard:      [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  cleric:    [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  druid:     [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  sorcerer:  [0, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  warlock:   [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  wizard:    [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  artificer: [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
};
const THIRD_CASTER_CANTRIPS = [0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
function classCantripsKnown(c) {
  const name = (c.name || "").trim().toLowerCase(), sub = (c.sub || "").trim().toLowerCase(), lvl = Math.max(0, Math.min(20, c.lvl || 0));
  if (!lvl) return 0;
  if (SUBCLASS_CASTING_STYLE[sub]) return THIRD_CASTER_CANTRIPS[lvl] || 0;
  const t = CANTRIPS_KNOWN_TABLE[name];
  return t ? (t[lvl] || 0) : 0;
}

/* Coin values in gp-equivalent, per SRD exchange rates. */
const COIN_GP = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const mod = score => Math.floor(((Number(score)||10) - 10) / 2);
const sign = n => (n >= 0 ? "+" : "") + n;
const num = el => Number(el && el.value) || 0;
