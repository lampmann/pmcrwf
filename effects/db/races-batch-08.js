/* ============================================================
   Race and subrace features (batch 08): Tiefling variants, Tortle, Triton,
   Troglodyte, Vampire (base + Ixalan/Zendikar), Vedalken, Verdan, Warforged,
   Yuan-Ti (base + Pureblood), Zombie.

   LLM-generated conversion pass; see effects/tools/conversion-guide.md for
   scheme. Entries with no automatable numeric/mechanical effect per the engine's
   target list (innate spellcasting, darkvision, resistances, speed, size,
   languages, pure roleplay) are omitted entirely.
   ============================================================ */

registerEffects({
  // ----- Tortle -----
  "race|tortle|survival instinct": {
    name: "Survival Instinct", sv: 1,
    effects: [
      { target: "skill-survival", op: "prof" },
    ],
  },

  "race|tortle|natural armor": {
    name: "Natural Armor", sv: 1,
    // Not a flat bonus — replaces the whole base-AC formula (flat 17, no DEX at
    // all) rather than adding to it. "min"/"max" ops only clamp the *effects
    // layer's own contribution*, not the combined final AC (add(17) would double
    // up with armorClassAuto()'s already-computed base) — there's no "set/replace
    // the base formula" op yet, so this stays unsupported.
    unsupported: [{ reason: "base AC 17, no DEX — replaces the whole AC formula rather than adding to it; no override/replace op exists yet", tags: ["ac"] }],
  },

  "race|tortle|shell defense": {
    name: "Shell Defense", sv: 1,
    effects: [
      { target: "ac", op: "add", value: 4, activation: { kind: "toggle", id: "shell", label: "In Shell" } },
      { target: "save-str", op: "adv", activation: { kind: "toggle", id: "shell", label: "In Shell" } },
      { target: "save-con", op: "adv", activation: { kind: "toggle", id: "shell", label: "In Shell" } },
      { target: "save-dex", op: "dis", activation: { kind: "toggle", id: "shell", label: "In Shell" } },
    ],
    unsupported: [{ reason: "while in shell: prone, speed 0, can't take reactions, only a bonus action to emerge — not modeled", tags: ["condition", "speed", "reaction"] }],
  },

  // ----- Troglodyte -----
  "race|troglodyte|chameleon skin": {
    name: "Chameleon Skin", sv: 1,
    effects: [
      { target: "skill-stealth", op: "adv" },
    ],
  },

  "race|troglodyte|natural armor": {
    name: "Natural Armor", sv: 1,
    effects: [{ target: "ac", op: "add", value: 1 }],
  },

  "race|troglodyte|stench": {
    name: "Stench", sv: 1,
    unsupported: [{ reason: "creatures start turn within 5 ft must save vs poison; DC 12 CON save or poisoned; condition-based mechanic", tags: ["poison-condition", "save-effect"] }],
  },

  "race|troglodyte|sunlight sensitivity": {
    name: "Sunlight Sensitivity", sv: 1,
    unsupported: [{ reason: "disadvantage on attack rolls and Perception checks in sunlight; condition-based disadvantage", tags: ["attack-disadvantage", "condition-based"] }],
  },

  // ----- Vampire -----
  "race|vampire|blood thirst": {
    name: "Blood Thirst", sv: 1,
    unsupported: [{ reason: "melee attack roll with 1d6 necrotic damage; target max HP reduction", tags: ["attacks", "damage", "resource-drain"] }],
  },

  // ----- Vampire Ixalan -----
  "subrace|ixalan|feast of blood": {
    name: "Feast of Blood", sv: 1,
    effects: [
      { target: "speed", op: "add", value: 10, activation: { kind: "toggle", id: "feast-of-blood", label: "Feast of Blood", default: false } },
      { target: "situational-advantage", op: "tag", value: "on Strength and Dexterity checks and saves, while feasting" },
      { target: "speed", op: "note", text: "for 1 minute after drinking a creature's blood" },
    ],
  },

  // ----- Vampire Zendikar -----
  "subrace|zendikar|null transformation": {
    name: "Null Transformation", sv: 1,
    unsupported: [{ reason: "humanoid killed by Bloodthirst becomes a null; conditional transformation dependent on another ability", tags: ["condition-based", "creature-status"] }],
  },

  // ----- Vedalken -----
  "race|vedalken|aether lore": {
    name: "Aether Lore", sv: 1,
    unsupported: [{ reason: "add twice proficiency bonus on specific History checks (magic items/aether devices); ability-check specific condition not modeled", tags: ["ability-check-bonus", "conditional"] }],
  },

  "race|vedalken|vedalken cunning": {
    name: "Vedalken Cunning", sv: 1,
    effects: [
      { target: "save-vs-magic", op: "tag", value: "magic (INT, WIS and CHA saves)" },
    ],
  },

  // ----- Verdan -----
  "race|verdan|persuasive": {
    name: "Persuasive", sv: 1,
    effects: [
      { target: "skill-persuasion", op: "prof" },
    ],
  },

  "race|verdan|telepathic insight": {
    name: "Telepathic Insight", sv: 1,
    effects: [
      { target: "save-wis", op: "adv" },
      { target: "save-cha", op: "adv" },
    ],
  },

  "race|verdan|black blood healing": {
    name: "Black Blood Healing", sv: 1,
    unsupported: [{ reason: "reroll 1 or 2 on Hit Dice spent after short rest; Hit Die roll mechanics not modeled", tags: ["hit-die-reroll"] }],
  },

  "race|verdan|size": {
    name: "Size", sv: 1,
    unsupported: [{ reason: "leveled size change (Small at 1st level, Medium at 5th); size not modeled", tags: ["size", "leveled"] }],
  },

  // ----- Warforged -----
  "race|warforged|constructed resilience": {
    name: "Constructed Resilience", sv: 1,
    effects: [
      { target: "save-vs-poisoned", op: "tag", value: "poisoned" },
      { target: "resist-poison", op: "tag", value: "poison" },
      { target: "immune-disease", op: "tag", value: "disease" },
      { target: "resist-poison", op: "note", text: "you don't need to eat, drink or breathe, and you rest without sleeping" },
    ],
  },

  "race|warforged|integrated protection": {
    name: "Integrated Protection", sv: 1,
    effects: [{ target: "ac", op: "add", value: 1 }],
  },

  "race|warforged|specialized design": {
    name: "Specialized Design", sv: 1,
    choices: [
      { id: "skill", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Choose one skill" },
    ],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
    unsupported: [{ reason: "one tool proficiency of choice; tool proficiencies not modeled", tags: ["tool-proficiency", "choice-limited"] }],
  },

  // ----- Yuan-Ti -----
  "race|yuan-ti|magic resistance": {
    name: "Magic Resistance", sv: 1,
    effects: [
      { target: "save-vs-magic", op: "tag", value: "spells and other magical effects" },
    ],
  },

  "race|yuan-ti|poison resilience": {
    name: "Poison Resilience", sv: 1,
    effects: [
      { target: "save-vs-poisoned", op: "tag", value: "poisoned" },
      { target: "resist-poison", op: "tag", value: "poison" },
    ],
  },

  "race|yuan-ti|serpentine spellcasting": {
    name: "Serpentine Spellcasting", sv: 1,
    unsupported: [{ reason: "innate spellcasting (poison spray, animal friendship, suggestion at 3rd level); leveled spell access with finite uses; spellcasting not modeled", tags: ["innate-spellcasting", "leveled"] }],
  },

  // ----- Yuan-Ti Pureblood -----
  "race|yuan-ti pureblood|magic resistance": {
    name: "Magic Resistance", sv: 1,
    effects: [
      { target: "save-vs-magic", op: "tag", value: "spells and other magical effects" },
    ],
  },

  // ----- Zombie -----
  "race|zombie|undead fortitude": {
    name: "Undead Fortitude", sv: 1,
    unsupported: [{ reason: "Constitution save (DC 5 + damage taken) to avoid falling to 0 HP; death-prevention mechanic with damage-based DC", tags: ["conditional-save", "damage-based-dc", "death-prevention"] }],
  },

  "race|zombie|undead nature": {
    name: "Undead Nature", sv: 1,
    effects: [
      { target: "immune-poison", op: "tag", value: "poison" },
      { target: "save-vs-poisoned", op: "tag", value: "poisoned" },
      { target: "immune-poison", op: "note", text: "you don't need air, food, drink or sleep" },
    ],
  },
});
