// Sidekick class features (Tasha's Cauldron of Everything) — expert, spellcaster, and warrior sidekick
registerEffects({
  // ===== EXPERT SIDEKICK — automatable =====
  "class|expert sidekick|expertise": {
    name: "Expertise", sv: 1,
    // One choice id per skill picked: renderEffectControls() draws a single <select> per id and
    // ignores `n`, so a single n:2 choice would only ever record one of the two skills.
    choices: [
      { id: "expertise1a", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Expertise 1 (Level 3)" },
      { id: "expertise1b", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Expertise 2 (Level 3)" },
      { id: "expertise2a", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Expertise 3 (Level 15)" },
      { id: "expertise2b", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Expertise 4 (Level 15)" },
    ],
    effects: [
      { target: "skill-{choice:expertise1a}", op: "expertise", activation: { kind: "choice", choice: "expertise1a" } },
      { target: "skill-{choice:expertise1b}", op: "expertise", activation: { kind: "choice", choice: "expertise1b" } },
      { target: "skill-{choice:expertise2a}", op: "expertise", activation: { kind: "choice", choice: "expertise2a" }, when: { minLevel: 15 } },
      { target: "skill-{choice:expertise2b}", op: "expertise", activation: { kind: "choice", choice: "expertise2b" }, when: { minLevel: 15 } },
    ],
  },

  "class|expert sidekick|sharp mind": {
    name: "Sharp Mind", sv: 1,
    choices: [
      { id: "savethrow", kind: "pick", n: 1, options: ["int", "wis", "cha"], label: "Sharp Mind save" },
    ],
    effects: [
      { target: "save-{choice:savethrow}", op: "prof", activation: { kind: "choice", choice: "savethrow" } },
    ],
  },

  // ===== WARRIOR SIDEKICK — automatable =====
  "class|warrior sidekick|battle readiness": {
    name: "Battle Readiness", sv: 1,
    effects: [
      { target: "init", op: "adv" },
    ],
  },

  "class|warrior sidekick|second wind": {
    name: "Second Wind", sv: 1,
    uses: { max: 1, per: "sr" },
    unsupported: [{ reason: "HP recovery (1d10 + class level) and scaling to 2 uses at 20th level not automatable", tags: ["healing", "level-scaling"] }],
  },

  // ===== UNSUPPORTED FEATURES =====
  "class|expert sidekick|bonus proficiencies": {
    name: "Bonus Proficiencies", sv: 1,
    unsupported: [{ reason: "skill/armor/weapon/tool proficiency choices not modeled", tags: ["proficiency"] }],
  },

  "class|expert sidekick|coordinated strike": {
    name: "Coordinated Strike", sv: 1,
    unsupported: [{ reason: "conditional damage bonus (on Help action trigger) requires action/condition tracking", tags: ["damage", "conditional"] }],
  },

  "class|expert sidekick|evasion": {
    name: "Evasion", sv: 1,
    unsupported: [{ reason: "condition-specific save mechanic (Dexterity only) not modeled per-condition", tags: ["advantage", "condition"] }],
  },

  "class|expert sidekick|inspiring help": {
    name: "Inspiring Help", sv: 1,
    unsupported: [{ reason: "d20 roll bonus (1d6 base, 2d6 at 20th) added to another creature; no roll-history model", tags: ["d20-modifier", "level-scaling"] }],
  },

  "class|expert sidekick|reliable talent": {
    name: "Reliable Talent", sv: 1,
    unsupported: [{ reason: "d20 roll mechanic (minimum 10 on proficiency checks)", tags: ["d20-modifier"] }],
  },

  "class|spellcaster sidekick|bonus proficiencies": {
    name: "Bonus Proficiencies", sv: 1,
    unsupported: [{ reason: "skill/armor/weapon proficiency choices not modeled", tags: ["proficiency"] }],
  },

  "class|spellcaster sidekick|spellcasting": {
    name: "Spellcasting", sv: 1,
    unsupported: [{ reason: "full spellcasting system (role choice, spell lists, slots) not modeled", tags: ["spellcasting"] }],
  },

  "class|spellcaster sidekick|potent cantrips": {
    name: "Potent Cantrips", sv: 1,
    unsupported: [{ reason: "spell-specific damage modifier (ability mod on cantrip damage)", tags: ["spellcasting", "damage"] }],
  },

  "class|spellcaster sidekick|empowered spells": {
    name: "Empowered Spells", sv: 1,
    unsupported: [{ reason: "school-of-magic choice with conditional spell damage bonus; requires spell system", tags: ["spellcasting", "choice", "conditional"] }],
  },

  "class|spellcaster sidekick|focused casting": {
    name: "Focused Casting", sv: 1,
    unsupported: [{ reason: "concentration mechanic not modeled", tags: ["concentration"] }],
  },

  "class|warrior sidekick|bonus proficiencies": {
    name: "Bonus Proficiencies", sv: 1,
    unsupported: [{ reason: "skill/armor/weapon/shield proficiency choices not modeled", tags: ["proficiency"] }],
  },

  "class|warrior sidekick|improved critical": {
    name: "Improved Critical", sv: 1,
    // The Attacks module reads "attack-crit-range" onto each row's to-hit button; the engine keeps
    // the LOWEST threshold, so a later Superior Critical (18) subsumes this one rather than fighting it.
    effects: [{ target: "attack-crit-range", op: "critrange", value: 19 }],
  },

  "class|warrior sidekick|extra attack": {
    name: "Extra Attack", sv: 1,
    unsupported: [{ reason: "extra attacks per action (2 at level 6, 3 at level 15); action economy, not a number on an attack", tags: ["attack", "action", "level-scaling"] }],
  },

  "class|warrior sidekick|improved defense": {
    name: "Improved Defense", sv: 1,
    effects: [{ target: "ac", op: "add", value: 1 }],
  },

  "class|warrior sidekick|indomitable": {
    name: "Indomitable", sv: 1,
    unsupported: [{ reason: "save reroll mechanic; uses scaling (1 at 11th, 2 at 18th) not expressible in uses model", tags: ["reroll", "level-scaling"] }],
  },
});
