// Monk class features batch 1: base class + Way of Mercy/Shadow/Ascendant Dragon subclasses
registerEffects({
  "class|monk|ki": {
    name: "Ki", sv: 1,
    uses: { max: { level: "class", class: "@self" }, per: "sr" },
  },

  "class|monk|unarmored defense": {
    name: "Unarmored Defense", sv: 1,
    unsupported: [{ reason: "AC calculation (10 + DEX mod + WIS mod) not yet supported", tags: ["ac"] }],
  },

  "class|monk|flurry of blows": {
    name: "Flurry of Blows", sv: 1,
    unsupported: [{ reason: "requires spending ki points (resource tracking unavailable)", tags: ["resource", "ki"] }],
  },

  "class|monk|patient defense": {
    name: "Patient Defense", sv: 1,
    unsupported: [{ reason: "requires spending ki points (resource tracking unavailable)", tags: ["resource", "ki"] }],
  },

  "class|monk|step of the wind": {
    name: "Step of the Wind", sv: 1,
    unsupported: [{ reason: "requires spending ki points; doubles jump distance (speed bonus not supported)", tags: ["resource", "ki", "speed"] }],
  },

  "class|monk|unarmored movement": {
    name: "Unarmored Movement", sv: 1,
    unsupported: [{ reason: "speed bonus not yet supported (scaling by level; gains vertical/liquid movement at 9th)", tags: ["speed"] }],
  },

  "class|monk|deflect missiles": {
    name: "Deflect Missiles", sv: 1,
    unsupported: [{ reason: "damage reduction (1d10 + DEX mod + monk level) not yet supported", tags: ["damage-reduction"] }],
  },

  "class|monk|ki-fueled attack": {
    name: "Ki-Fueled Attack", sv: 1,
    unsupported: [{ reason: "requires spending ki points; bonus unarmed strike (action economy not modeled)", tags: ["resource", "ki"] }],
  },

  "class|monk|quickened healing": {
    name: "Quickened Healing", sv: 1,
    unsupported: [{ reason: "action + 2 ki points to restore HP (roll Martial Arts die + prof bonus)", tags: ["resource", "ki"] }],
  },

  "class|monk|slow fall": {
    name: "Slow Fall", sv: 1,
    unsupported: [{ reason: "damage reduction (5 × monk level) when falling, not yet supported", tags: ["damage-reduction"] }],
  },

  "class|monk|extra attack": {
    name: "Extra Attack", sv: 1,
    unsupported: [{ reason: "attack twice on Attack action (needs weapons/attacks module)", tags: ["attack"] }],
  },

  "class|monk|focused aim": {
    name: "Focused Aim", sv: 1,
    unsupported: [{ reason: "variable ki spending (1-3 points) to modify attack roll by +2 per point", tags: ["resource", "ki"] }],
  },

  "class|monk|stunning strike": {
    name: "Stunning Strike", sv: 1,
    unsupported: [{ reason: "melee hit + 1 ki → target makes CON save or stunned through end of next turn", tags: ["resource", "ki"] }],
  },

  "class|monk|evasion": {
    name: "Evasion", sv: 1,
    unsupported: [{ reason: "conditional DEX save (no damage on success, half on fail); per-condition save mechanics not modeled", tags: ["save", "condition"] }],
  },

  "class|monk|stillness of mind": {
    name: "Stillness of Mind", sv: 1,
    unsupported: [{ reason: "action to end one charmed or frightened condition; condition-specific removal not modeled", tags: ["condition"] }],
  },

  "class|monk|diamond soul": {
    name: "Diamond Soul", sv: 1,
    effects: [
      { target: "save-str", op: "prof" },
      { target: "save-dex", op: "prof" },
      { target: "save-con", op: "prof" },
      { target: "save-int", op: "prof" },
      { target: "save-wis", op: "prof" },
      { target: "save-cha", op: "prof" },
    ],
    unsupported: [{ reason: "spend 1 ki point to reroll failed save", tags: ["resource", "ki"] }],
  },

  "class|monk|empty body": {
    name: "Empty Body", sv: 1,
    unsupported: [{ reason: "action + 4 ki → invisible + resistance (all but force); or 8 ki → cast astral projection", tags: ["resource", "ki"] }],
  },

  "class|monk|perfect self": {
    name: "Perfect Self", sv: 1,
    unsupported: [{ reason: "regain 4 ki points when rolling initiative with none remaining; conditional ki mechanics", tags: ["resource", "ki"] }],
  },

  "subclass|monk|way of mercy|implements of mercy": {
    name: "Implements of Mercy", sv: 1,
    effects: [
      { target: "skill-insight", op: "prof" },
      { target: "skill-medicine", op: "prof" },
    ],
  },

  "subclass|monk|way of mercy|hand of harm": {
    name: "Hand of Harm", sv: 1,
    unsupported: [{ reason: "melee hit + 1 ki → extra necrotic damage (roll Martial Arts die + WIS mod)", tags: ["resource", "ki"] }],
  },

  "subclass|monk|way of mercy|hand of healing": {
    name: "Hand of Healing", sv: 1,
    unsupported: [{ reason: "action + 1 ki → restore HP (roll Martial Arts die + WIS mod); or replace Flurry strike without ki cost", tags: ["resource", "ki"] }],
  },

  "subclass|monk|way of mercy|physician's touch": {
    name: "Physician's Touch", sv: 1,
    unsupported: [{ reason: "modifies Hand of Healing to also end one disease/condition; Hand of Harm applies poisoned until end of next turn", tags: ["condition"] }],
  },

  "subclass|monk|way of mercy|flurry of healing and harm": {
    name: "Flurry of Healing and Harm", sv: 1,
    unsupported: [{ reason: "replace Flurry of Blows strikes with healing/harm without ki cost; use Hand of Harm without spending ki (once per turn limit)", tags: ["resource", "ki"] }],
  },

  "subclass|monk|way of mercy|hand of ultimate mercy": {
    name: "Hand of Ultimate Mercy", sv: 1,
    unsupported: [{ reason: "action + 5 ki → revive corpse within 24 hours, restore 4d10 + WIS mod HP, end conditions; once per long rest", tags: ["resource", "ki"] }],
  },

  "subclass|monk|way of shadow|shadow arts": {
    name: "Shadow Arts", sv: 1,
    unsupported: [{ reason: "action + 2 ki → cast darkness/darkvision/pass without trace/silence without material components; gain minor illusion cantrip", tags: ["resource", "ki"] }],
  },

  "subclass|monk|way of shadow|shadow step": {
    name: "Shadow Step", sv: 1,
    unsupported: [{ reason: "bonus action teleport (60 ft in dim/dark light) + advantage on first melee attack; location and condition-specific mechanics", tags: ["teleport", "condition"] }],
  },

  "subclass|monk|way of shadow|cloak of shadows": {
    name: "Cloak of Shadows", sv: 1,
    unsupported: [{ reason: "action to become invisible in dim/dark light (condition-specific application); ends if you attack/cast/enter bright light", tags: ["condition"] }],
  },

  "subclass|monk|way of shadow|opportunist": {
    name: "Opportunist", sv: 1,
    unsupported: [{ reason: "reaction to make melee attack when creature within 5 ft is hit by another attack; extra reaction tracking not modeled", tags: ["reaction"] }],
  },

  "subclass|monk|way of the ascendant dragon|draconic disciple": {
    name: "Draconic Disciple", sv: 1,
    unsupported: [{ reason: "feature text incomplete (ends mid-description: 'You gain the following benefits:')", tags: ["incomplete"] }],
  },

  "subclass|monk|way of the ascendant dragon|breath of the dragon": {
    name: "Breath of the Dragon", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [{ reason: "replace one Attack action attack with 20-ft cone/30-ft line AoE (DEX save, 2-3 Martial Arts dice damage depending on level); can spend 2 ki for extra use", tags: ["attack", "condition"] }],
  },

  "subclass|monk|way of the ascendant dragon|wings unfurled": {
    name: "Wings Unfurled", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [{ reason: "bonus action (via Step of the Wind) grants flying speed equal to walking speed; speed target not yet supported", tags: ["speed"] }],
  },
});
