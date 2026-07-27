// Race features batch 03 — LLM conversion pass
// D&D 5e (2014) racial trait effects; see conversion-guide.md for rules and caveats
registerEffects({
  "race|elf (zendikar)|keen senses": {
    name: "Keen Senses", sv: 1,
    effects: [
      { target: "skill-perception", op: "prof" },
    ],
  },

  "race|elf (zendikar)|fey ancestry": {
    name: "Fey Ancestry", sv: 1,
    unsupported: [
      { reason: "advantage on saves against being charmed (condition-specific, not ability-based); no per-condition save target", tags: ["condition", "save", "charmed"] },
      { reason: "immunity to magical sleep effects", tags: ["magic", "sleep", "condition-immunity"] },
    ],
  },

  "subrace|mul daya nation|sunlight sensitivity": {
    name: "Sunlight Sensitivity", sv: 1,
    unsupported: [
      { reason: "disadvantage on attack rolls and Perception checks in direct sunlight; requires terrain/lighting condition tracking", tags: ["condition", "terrain", "attack", "perception"] },
    ],
  },

  "subrace|tajuru nation|skill versatility": {
    name: "Skill Versatility", sv: 1,
    unsupported: [
      { reason: "proficiency with 2 skills or tools of choice; tools outside skill target list", tags: ["tool", "choice", "proficiency"] },
    ],
  },

  "race|firbolg|speech of beast and leaf": {
    name: "Speech of Beast and Leaf", sv: 1,
    unsupported: [
      { reason: "advantage on Charisma checks to influence beasts/plants; ability checks (not saves) not modeled as targets", tags: ["ability-check", "charisma"] },
    ],
  },

  "race|giff|hippo build": {
    name: "Hippo Build", sv: 1,
    effects: [
      { target: "save-str", op: "adv" },
    ],
    unsupported: [
      { reason: "advantage on Strength-based ability checks; ability checks not modeled", tags: ["ability-check", "strength"] },
      { reason: "carrying capacity doubled; not modeled as stat", tags: ["carrying-capacity"] },
    ],
  },

  "race|giff|firearms mastery": {
    name: "Firearms Mastery", sv: 1,
    unsupported: [
      { reason: "firearm proficiency and ignoring the loading property; weapon proficiencies and properties aren't tracked", tags: ["weapon", "firearm", "property"] },
      { reason: "no disadvantage on long-range firearm attacks; range handling not modeled", tags: ["range", "attack"] },
    ],
  },

  "subrace|githyanki|decadent mastery": {
    name: "Decadent Mastery", sv: 1,
    unsupported: [
      { reason: "language grant + proficiency with skill or tools of choice; tools outside target list", tags: ["language", "tool", "choice", "proficiency"] },
    ],
  },

  "subrace|githyanki|martial prodigy": {
    name: "Martial Prodigy", sv: 1,
    unsupported: [
      { reason: "proficiency with light/medium armor and martial weapons (shortsword/longsword/greatsword); armor/weapons not modeled", tags: ["armor", "weapon", "proficiency"] },
    ],
  },

  "subrace|githzerai|mental discipline": {
    name: "Mental Discipline", sv: 1,
    unsupported: [
      { reason: "advantage on saves against charmed/frightened conditions; no per-condition save target", tags: ["condition", "save", "charmed", "frightened"] },
    ],
  },

  "race|githyanki|astral knowledge": {
    name: "Astral Knowledge", sv: 1,
    unsupported: [
      { reason: "proficiency selection (skill/weapon/tool) that resets on long rest; resource-gated choice and tool target not modeled", tags: ["choice", "proficiency", "tool", "resource", "long-rest"] },
    ],
  },

  "race|gnoll|bite": {
    name: "Bite", sv: 1,
    unsupported: [
      { reason: "natural weapon (1d4 piercing + STR mod) as unarmed strike alternative; requires attack/weapon module", tags: ["weapon", "attack", "unarmed", "natural-weapon"] },
    ],
  },

  "race|gnoll|rampage": {
    name: "Rampage", sv: 1,
    unsupported: [
      { reason: "bonus action melee attack on kill; requires attack/action-economy mechanics", tags: ["attack", "action-economy", "conditional"] },
    ],
  },

  "race|gnome|gnome cunning": {
    name: "Gnome Cunning", sv: 1,
    unsupported: [
      { reason: "advantage on INT/WIS/CHA saves against magic spells; requires magic-type condition tracking", tags: ["condition", "save", "magic", "conditional"] },
    ],
  },

  "subrace|deep|stone camouflage": {
    name: "Stone Camouflage", sv: 1,
    unsupported: [
      { reason: "advantage on Stealth checks in rocky terrain only; requires terrain condition tracking", tags: ["skill", "condition", "terrain", "stealth"] },
    ],
  },

  "subrace|deep/svirfneblin|stone camouflage": {
    name: "Stone Camouflage", sv: 1,
    unsupported: [
      { reason: "advantage on Stealth checks in rocky terrain only; requires terrain condition tracking", tags: ["skill", "condition", "terrain", "stealth"] },
    ],
  },
});
