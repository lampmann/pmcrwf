// Race features (batch 04: Gnome, Goblin, Goliath, Grimlock, Grung, Hadozee, Half-Elf, Half-Orc, Halfling)
// LLM-generated conversion pass from 5e sourcebook trait text.
// See effects/tools/conversion-guide.md for full spec and decision rules.
registerEffects({
  // ----- Gnome subraces -----
  "race|gnome (deep)|gnome cunning": {
    name: "Gnome Cunning", sv: 1,
    effects: [
      { target: "save-vs-magic", op: "tag", value: "magic (INT, WIS and CHA saves)" },
    ],
  },
  "race|gnome (deep)|stone camouflage": {
    name: "Stone Camouflage", sv: 1,
    effects: [
      { target: "situational-advantage", op: "tag", value: "on Stealth checks in rocky terrain" },
    ],
  },

  // ----- Goblin -----
  // Note: Fury of the Small already in uses-races.js with uses block; no new effects here

  // ----- Goblin subraces -----
  "subrace|zendikar; grotag tribe|grotag tamer": {
    name: "Grotag Tamer", sv: 1,
    effects: [{ target: "skill-animalhandling", op: "prof" }],
  },
  "subrace|zendikar; lavastep tribe|lavastep grit": {
    name: "Lavastep Grit", sv: 1,
    effects: [
      { target: "situational-advantage", op: "tag", value: "on Stealth checks in rocky or subterranean terrain" },
    ],
  },

  // ----- Goliath -----
  "race|goliath|natural athlete": {
    name: "Natural Athlete", sv: 1,
    effects: [{ target: "skill-athletics", op: "prof" }],
  },

  // ----- Grimlock -----
  "race|grimlock|keen hearing and smell": {
    name: "Keen Hearing and Smell", sv: 1,
    effects: [
      { target: "situational-advantage", op: "tag", value: "on Perception checks that rely on hearing or smell" },
    ],
  },
  "race|grimlock|stone camouflage": {
    name: "Stone Camouflage", sv: 1,
    effects: [
      { target: "situational-advantage", op: "tag", value: "on Stealth checks in rocky terrain" },
    ],
  },

  // ----- Grung -----
  "race|grung|arboreal alertness": {
    name: "Arboreal Alertness", sv: 1,
    effects: [{ target: "skill-perception", op: "prof" }],
  },
  "race|grung|poisonous skin": {
    name: "Poisonous Skin", sv: 1,
    unsupported: [{ reason: "constitution saving throw DC and damage output depend on grapple state and weapon application; DM-adjudicated triggers", tags: ["grapple-mechanic", "conditional-damage"] }],
  },

  // ----- Hadozee -----
  // Note: Hadozee Dodge already in uses-races.js with uses block; damage reduction unsupported regardless

  // ----- Half-Elf -----
  "race|half-elf|fey ancestry": {
    name: "Fey Ancestry", sv: 1,
    effects: [
      { target: "save-vs-charmed", op: "tag", value: "charmed" },
      { target: "immune-magical sleep", op: "tag", value: "magical sleep" },
    ],
  },
  "race|half-elf|skill versatility": {
    name: "Skill Versatility", sv: 1,
    choices: [
      { id: "skill1", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "First skill" },
      { id: "skill2", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Second skill" },
    ],
    effects: [
      { target: "skill-{choice:skill1}", op: "prof", activation: { kind: "choice", choice: "skill1" } },
      { target: "skill-{choice:skill2}", op: "prof", activation: { kind: "choice", choice: "skill2" } },
    ],
  },
  "subrace|variant; aquatic elf descent|variant feature (choose 1)": {
    name: "Variant Feature (Choose 1)", sv: 1,
    choices: [
      { id: "skill1", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "First skill" },
      { id: "skill2", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Second skill" },
    ],
    effects: [
      { target: "skill-{choice:skill1}", op: "prof", activation: { kind: "choice", choice: "skill1" } },
      { target: "skill-{choice:skill2}", op: "prof", activation: { kind: "choice", choice: "skill2" } },
    ],
  },
  "subrace|variant; drow descent|variant feature (choose 1)": {
    name: "Variant Feature (Choose 1)", sv: 1,
    choices: [
      { id: "skill1", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "First skill" },
      { id: "skill2", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Second skill" },
    ],
    effects: [
      { target: "skill-{choice:skill1}", op: "prof", activation: { kind: "choice", choice: "skill1" } },
      { target: "skill-{choice:skill2}", op: "prof", activation: { kind: "choice", choice: "skill2" } },
    ],
  },
  "subrace|variant; moon elf or sun elf descent|variant feature (choose 1)": {
    name: "Variant Feature (Choose 1)", sv: 1,
    choices: [
      { id: "skill1", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "First skill" },
      { id: "skill2", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Second skill" },
    ],
    effects: [
      { target: "skill-{choice:skill1}", op: "prof", activation: { kind: "choice", choice: "skill1" } },
      { target: "skill-{choice:skill2}", op: "prof", activation: { kind: "choice", choice: "skill2" } },
    ],
  },
  "subrace|variant; wood elf descent|variant feature (choose 1)": {
    name: "Variant Feature (Choose 1)", sv: 1,
    choices: [
      { id: "skill1", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "First skill" },
      { id: "skill2", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Second skill" },
    ],
    effects: [
      { target: "skill-{choice:skill1}", op: "prof", activation: { kind: "choice", choice: "skill1" } },
      { target: "skill-{choice:skill2}", op: "prof", activation: { kind: "choice", choice: "skill2" } },
    ],
  },

  // ----- Half-Orc -----
  "race|half-orc|menacing": {
    name: "Menacing", sv: 1,
    effects: [{ target: "skill-intimidation", op: "prof" }],
  },
  "race|half-orc|relentless endurance": {
    name: "Relentless Endurance", sv: 1,
    unsupported: [{ reason: "revival mechanic (drop to 1 HP when reduced to 0); engine has no hit-point-floor model", tags: ["revival", "hp-mechanic"] }],
  },
  "race|half-orc|savage attacks": {
    name: "Savage Attacks", sv: 1,
    unsupported: [{ reason: "critical-hit bonus damage die; the Attacks module has no crit-damage model", tags: ["attack-mechanic", "critical-hit"] }],
  },

  // ----- Halfling -----
  "race|halfling|brave": {
    name: "Brave", sv: 1,
    effects: [
      { target: "save-vs-frightened", op: "tag", value: "frightened" },
    ],
  },
  "race|halfling|lucky": {
    name: "Lucky", sv: 1,
    unsupported: [{ reason: "post-hoc reroll of 1s on d20 rolls; no roll-history model", tags: ["reroll", "conditional-reroll"] }],
  },

  // ----- Halfling subraces -----
  "subrace|lightfoot|naturally stealthy": {
    name: "Naturally Stealthy", sv: 1,
    effects: [
      { target: "situational-advantage", op: "tag", value: "on Stealth checks while obscured by a larger creature" },
    ],
  },
  "subrace|lotusden|timberwalk": {
    name: "Timberwalk", sv: 1,
    unsupported: [{ reason: "disadvantage on tracking checks + movement through plants; no per-check disadvantage target, movement outside scope", tags: ["condition-disadvantage", "movement"] }],
  },
});
