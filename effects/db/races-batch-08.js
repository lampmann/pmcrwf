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
    unsupported: [{ reason: "base AC 17 (armor as class feature, not AC enhancement)", tags: ["ac-modifier"] }],
  },

  "race|tortle|shell defense": {
    name: "Shell Defense", sv: 1,
    unsupported: [{ reason: "+4 AC toggle; disadvantage on DEX saves while active; AC modifier not modeled", tags: ["ac-modifier", "toggle"] }],
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
    unsupported: [{ reason: "+1 bonus to Armor Class", tags: ["ac-modifier"] }],
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
    unsupported: [{ reason: "speed +10 ft and advantage on STR/DEX checks and saves for 1 minute (conditional, post-bloodthirst); speed not modeled", tags: ["speed", "conditional-advantage"] }],
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
    unsupported: [{ reason: "advantage on INT/WIS/CHA saving throws against magic; condition-based advantage (against spells), not per-ability", tags: ["condition-based-advantage"] }],
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
    unsupported: [{ reason: "advantage on poison saves; poison resistance; immunity to disease/sleep effects; no sleep requirement; complex mix of immunities and resistances not modeled", tags: ["condition-advantage", "resistance", "immunity"] }],
  },

  "race|warforged|integrated protection": {
    name: "Integrated Protection", sv: 1,
    unsupported: [{ reason: "+1 bonus to Armor Class", tags: ["ac-modifier"] }],
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
    unsupported: [{ reason: "advantage on saving throws against spells; condition-based advantage (against magic), not modeled per-ability", tags: ["condition-based-advantage"] }],
  },

  "race|yuan-ti|poison resilience": {
    name: "Poison Resilience", sv: 1,
    unsupported: [{ reason: "advantage on saves to avoid/end poisoned condition; poison resistance; condition-based advantage", tags: ["condition-based-advantage", "resistance"] }],
  },

  "race|yuan-ti|serpentine spellcasting": {
    name: "Serpentine Spellcasting", sv: 1,
    unsupported: [{ reason: "innate spellcasting (poison spray, animal friendship, suggestion at 3rd level); leveled spell access with finite uses; spellcasting not modeled", tags: ["innate-spellcasting", "leveled"] }],
  },

  // ----- Yuan-Ti Pureblood -----
  "race|yuan-ti pureblood|magic resistance": {
    name: "Magic Resistance", sv: 1,
    unsupported: [{ reason: "advantage on saving throws against spells and other magical effects; condition-based advantage", tags: ["condition-based-advantage"] }],
  },

  // ----- Zombie -----
  "race|zombie|undead fortitude": {
    name: "Undead Fortitude", sv: 1,
    unsupported: [{ reason: "Constitution save (DC 5 + damage taken) to avoid falling to 0 HP; death-prevention mechanic with damage-based DC", tags: ["conditional-save", "damage-based-dc", "death-prevention"] }],
  },

  "race|zombie|undead nature": {
    name: "Undead Nature", sv: 1,
    unsupported: [{ reason: "immunity to poison damage and poisoned condition; no need for air/food/drink/sleep; immunities/resistances not modeled", tags: ["immunity", "resistance"] }],
  },
});
