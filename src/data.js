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

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const mod = score => Math.floor(((Number(score)||10) - 10) / 2);
const sign = n => (n >= 0 ? "+" : "") + n;
const num = el => Number(el && el.value) || 0;
