// Racial traits (Kor, Kuo-Toa, Leonin, Lizardfolk, Locathah, Loxodon, Merfolk, Minotaur, Naga, Orc)
// LLM-converted from data/races.json per effects/tools/conversion-guide.md
// Omitted: flavor-only traits (age, size, alignment, languages), traits outside engine
// scope (darkvision, breathing, movement speeds, AC), and complex mechanics without
// numeric analogues (crafting, trunk manipulation, etc.). Merged multi-level recurring
// features per guide (not applicable to races). Some traits already in uses-races.js
// are skipped here to avoid duplication of uses blocks (but their effects may be
// included if applicable).
registerEffects({
  // ----- KOR -----
  "race|kor|kor climbing": {
    name: "Kor Climbing",
    sv: 1,
    effects: [
      { target: "skill-athletics", op: "prof" },
      { target: "skill-acrobatics", op: "prof" },
    ],
  },
  "race|kor|brave": {
    name: "Brave",
    sv: 1,
    unsupported: [{ reason: "advantage on saving throws against a specific condition (frightened), not modeled per-condition", tags: ["advantage", "condition"] }],
  },
  "race|kor|lucky": {
    name: "Lucky",
    sv: 1,
    unsupported: [{ reason: "reroll d20 on result of 1; no roll-history model", tags: ["reroll", "resource"] }],
  },

  // ----- KUO-TOA -----
  "race|kuo-toa|otherworldly perception": {
    name: "Otherworldly Perception",
    sv: 1,
    unsupported: [{ reason: "sense invisible/ethereal creatures within 30 feet; no per-creature visibility model", tags: ["sense", "condition"] }],
  },
  "race|kuo-toa|slippery": {
    name: "Slippery",
    sv: 1,
    unsupported: [{ reason: "advantage on ability checks and saves to escape a grapple; not a single ability target", tags: ["advantage", "grapple"] }],
  },
  "race|kuo-toa|sunlight sensitivity": {
    name: "Sunlight Sensitivity",
    sv: 1,
    unsupported: [{ reason: "disadvantage on attack rolls and Perception checks in sunlight; condition-specific", tags: ["disadvantage", "condition"] }],
  },

  // ----- LEONIN -----
  "race|leonin|hunter's instincts": {
    name: "Hunter's Instincts",
    sv: 1,
    choices: [
      { id: "skill", kind: "pick", n: 1, options: ["athletics", "intimidation", "perception", "survival"], label: "Choose a skill" },
    ],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
  },
  "race|leonin|claws": {
    name: "Claws",
    sv: 1,
    unsupported: [{ reason: "natural weapon dealing 1d4 + STR slashing damage; requires attack roll tracking", tags: ["attack", "damage"] }],
  },

  // ----- LIZARDFOLK -----
  "race|lizardfolk|bite": {
    name: "Bite",
    sv: 1,
    unsupported: [{ reason: "natural weapon dealing 1d6 + STR piercing damage; requires attack roll tracking", tags: ["attack", "damage"] }],
  },
  "race|lizardfolk|hungry jaws": {
    name: "Hungry Jaws",
    sv: 1,
    uses: { max: 1, per: "sr" },
    unsupported: [{ reason: "bonus action bite attack with temporary HP gain; requires attack roll tracking", tags: ["attack", "damage"] }],
  },
  "race|lizardfolk|hunter's lore": {
    name: "Hunter's Lore",
    sv: 1,
    choices: [
      { id: "skill", kind: "pick", n: 2, options: ["animalhandling", "nature", "perception", "stealth", "survival"], label: "Choose two skills" },
    ],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
  },

  // ----- LOCATHAH -----
  "race|locathah|observant & athletic": {
    name: "Observant & Athletic",
    sv: 1,
    effects: [
      { target: "skill-athletics", op: "prof" },
      { target: "skill-perception", op: "prof" },
    ],
  },
  "race|locathah|leviathan will": {
    name: "Leviathan Will",
    sv: 1,
    unsupported: [{ reason: "advantage on saves vs charmed/frightened/paralyzed/poisoned/stunned/sleep; multiple condition-specific advantages", tags: ["advantage", "condition"] }],
  },

  // ----- LOXODON -----
  "race|loxodon|keen smell": {
    name: "Keen Smell",
    sv: 1,
    unsupported: [{ reason: "advantage on Perception/Survival/Investigation checks involving smell; sense-specific advantage not modeled", tags: ["advantage", "sense"] }],
  },
  "race|loxodon|loxodon serenity": {
    name: "Loxodon Serenity",
    sv: 1,
    unsupported: [{ reason: "advantage on saving throws against being charmed or frightened; condition-specific advantage", tags: ["advantage", "condition"] }],
  },

  // ----- MERFOLK (IXALAN: BLUE) -----
  "subrace|ixalan; blue|lore of the waters": {
    name: "Lore of the Waters",
    sv: 1,
    effects: [
      { target: "skill-history", op: "prof" },
      { target: "skill-nature", op: "prof" },
    ],
  },
  "subrace|ixalan; blue|cantrip": {
    name: "Cantrip",
    sv: 1,
    unsupported: [{ reason: "know 1 cantrip (int-based); cantrip selection and spellcasting not modeled", tags: ["spellcasting"] }],
  },

  // ----- MERFOLK (IXALAN: GREEN) -----
  "subrace|ixalan; green|cantrip": {
    name: "Cantrip",
    sv: 1,
    unsupported: [{ reason: "know 1 cantrip (wis-based); cantrip selection and spellcasting not modeled", tags: ["spellcasting"] }],
  },

  // ----- MERFOLK (ZENDIKAR: COSI CREED) -----
  "subrace|zendikar; cosi creed|creed of the trickster": {
    name: "Creed of the Trickster",
    sv: 1,
    effects: [
      { target: "skill-sleightofhand", op: "prof" },
      { target: "skill-stealth", op: "prof" },
    ],
  },
  "subrace|zendikar; cosi creed|cantrip": {
    name: "Cantrip",
    sv: 1,
    unsupported: [{ reason: "know 1 cantrip (cha-based); cantrip selection and spellcasting not modeled", tags: ["spellcasting"] }],
  },

  // ----- MERFOLK (ZENDIKAR: EMERIA CREED) -----
  "subrace|zendikar; emeria creed|wind creed manipulation": {
    name: "Wind Creed Manipulation",
    sv: 1,
    effects: [
      { target: "skill-deception", op: "prof" },
      { target: "skill-persuasion", op: "prof" },
    ],
  },
  "subrace|zendikar; emeria creed|cantrip": {
    name: "Cantrip",
    sv: 1,
    unsupported: [{ reason: "know 1 cantrip (wis-based); cantrip selection and spellcasting not modeled", tags: ["spellcasting"] }],
  },

  // ----- MERFOLK (ZENDIKAR: ULA CREED) -----
  "subrace|zendikar; ula creed|water creed navigation": {
    name: "Water Creed Navigation",
    sv: 1,
    unsupported: [{ reason: "proficiency with navigator's tools and Survival skill; tools not in modeled skill targets", tags: ["proficiency", "tools"] }],
  },
  "subrace|zendikar; ula creed|cantrip": {
    name: "Cantrip",
    sv: 1,
    unsupported: [{ reason: "know 1 cantrip (int-based); cantrip selection and spellcasting not modeled", tags: ["spellcasting"] }],
  },

  // ----- MINOTAUR -----
  "race|minotaur|horns": {
    name: "Horns",
    sv: 1,
    unsupported: [{ reason: "natural weapon dealing 1d6 + STR piercing damage; requires attack roll tracking", tags: ["attack", "damage"] }],
  },
  "race|minotaur|goring rush": {
    name: "Goring Rush",
    sv: 1,
    unsupported: [{ reason: "bonus action melee attack after moving 20+ feet; requires attack roll tracking", tags: ["attack", "movement"] }],
  },
  "race|minotaur|hammering horns": {
    name: "Hammering Horns",
    sv: 1,
    unsupported: [{ reason: "bonus action strength save to push target after hit; requires attack roll tracking and creature interaction", tags: ["attack", "save"] }],
  },
  "race|minotaur|labyrinthine recall": {
    name: "Labyrinthine Recall",
    sv: 1,
    unsupported: [{ reason: "always know north direction; advantage on Survival checks to navigate/track (sense-specific advantage)", tags: ["navigation", "advantage"] }],
  },

  // ----- MINOTAUR (AMONKHET) -----
  "race|minotaur (amonkhet)|menacing": {
    name: "Menacing",
    sv: 1,
    effects: [
      { target: "skill-intimidation", op: "prof" },
    ],
  },
  "race|minotaur (amonkhet)|natural weapon": {
    name: "Natural Weapon",
    sv: 1,
    unsupported: [{ reason: "natural weapon (horns) dealing 1d6 + STR bludgeoning damage; requires attack roll tracking", tags: ["attack", "damage"] }],
  },
  "race|minotaur (amonkhet)|relentless endurance": {
    name: "Relentless Endurance",
    sv: 1,
    unsupported: [{ reason: "drop to 1 HP when reduced to 0 (once per long rest); triggered zero-HP mechanic not modeled", tags: ["survival", "hp"] }],
  },
  "race|minotaur (amonkhet)|savage attacks": {
    name: "Savage Attacks",
    sv: 1,
    unsupported: [{ reason: "roll extra weapon damage die on critical hit; requires critical roll tracking", tags: ["attack", "damage"] }],
  },

  // ----- NAGA -----
  "race|naga|natural weapons": {
    name: "Natural Weapons",
    sv: 1,
    unsupported: [{ reason: "bite (1d4 + STR piercing + CON save for poison) and constrict (1d6 + STR bludgeoning + grapple) attacks; requires attack/damage roll tracking and grapple mechanics", tags: ["attack", "damage"] }],
  },
  "race|naga|poison affinity": {
    name: "Poison Affinity",
    sv: 1,
    unsupported: [{ reason: "proficiency with poisoner's kit; tool proficiencies not modeled (only skills)", tags: ["proficiency", "tools"] }],
  },

  // ----- ORC -----
  "race|orc|aggressive": {
    name: "Aggressive",
    sv: 1,
    unsupported: [{ reason: "bonus action move up to speed toward hostile creature; movement speed mechanics not modeled", tags: ["movement", "action"] }],
  },
  "race|orc|primal intuition": {
    name: "Primal Intuition",
    sv: 1,
    choices: [
      { id: "skill", kind: "pick", n: 2, options: ["animalhandling", "insight", "intimidation", "medicine", "nature", "perception", "survival"], label: "Choose two skills" },
    ],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
  },
});
