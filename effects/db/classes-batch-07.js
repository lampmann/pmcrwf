/* Cleric domains batch 3: Nature, Order, Peace, Solidarity, Strength domains */
registerEffects({
  "subclass|cleric|order domain|bonus proficiencies": {
    name: "Bonus Proficiencies", sv: 1,
    choices: [{ id: "skill", kind: "pick", n: 1, options: ["intimidation", "persuasion"], label: "Skill proficiency" }],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
  },
  "subclass|cleric|peace domain|implement of peace": {
    name: "Implement of Peace", sv: 1,
    choices: [{ id: "skill", kind: "pick", n: 1, options: ["insight", "performance", "persuasion"], label: "Skill proficiency" }],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
  },
  "subclass|cleric|strength domain (psa)|acolyte of strength": {
    name: "Acolyte of Strength", sv: 1,
    choices: [{ id: "skill", kind: "pick", n: 1, options: ["animalhandling", "athletics", "nature", "survival"], label: "Skill proficiency" }],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
  },
  "subclass|cleric|solidarity domain (psa)|solidarity's action": {
    name: "Solidarity's Action", sv: 1,
    uses: { max: { max: [{ mod: "wis" }, 1] }, per: "lr" },
    unsupported: [{ reason: "bonus-action weapon attack", tags: ["attack", "bonus-action"] }],
  },
  "subclass|cleric|nature domain|dampen elements": {
    name: "Dampen Elements", sv: 1,
    unsupported: [{ reason: "damage-type-specific resistance (acid/cold/fire/lightning/thunder)", tags: ["resistance", "damage-type"] }],
  },
  "subclass|cleric|nature domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    unsupported: [{ reason: "weapon/cantrip-attack-dependent bonus damage", tags: ["attack", "damage"] }],
  },
  "subclass|cleric|nature domain|divine strike": {
    name: "Divine Strike", sv: 1,
    unsupported: [{ reason: "weapon-attack-dependent damage bonus; scales at character level 14", tags: ["attack", "damage", "level-scaling"] }],
  },
  "subclass|cleric|order domain|voice of authority": {
    name: "Voice of Authority", sv: 1,
    unsupported: [{ reason: "bonus-action weapon attack triggered by spell casting", tags: ["attack", "spellcasting", "bonus-action"] }],
  },
  "subclass|cleric|order domain|channel divinity: order's demand": {
    name: "Channel Divinity: Order's Demand", sv: 1,
    unsupported: [{ reason: "conditional charm with DM-adjudicated item dropping", tags: ["charm", "condition"] }],
  },
  "subclass|cleric|order domain|embodiment of the law": {
    name: "Embodiment of the Law", sv: 1,
    uses: { max: { max: [{ mod: "wis" }, 1] }, per: "lr" },
    unsupported: [{ reason: "spell casting-time modification", tags: ["spellcasting"] }],
  },
  "subclass|cleric|order domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    unsupported: [{ reason: "weapon/cantrip-attack-dependent bonus damage", tags: ["attack", "damage"] }],
  },
  "subclass|cleric|order domain|divine strike": {
    name: "Divine Strike", sv: 1,
    unsupported: [{ reason: "weapon-attack-dependent damage bonus; scales at character level 14", tags: ["attack", "damage", "level-scaling"] }],
  },
  "subclass|cleric|order domain|order's wrath": {
    name: "Order's Wrath", sv: 1,
    unsupported: [{ reason: "curse tracking with conditional ally damage", tags: ["curse", "damage", "condition"] }],
  },
  "subclass|cleric|peace domain|emboldening bond": {
    name: "Emboldening Bond", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [{ reason: "conditional d4 bonus (distance-gated, per-turn limit)", tags: ["bonus", "conditional"] }],
  },
  "subclass|cleric|peace domain|channel divinity: balm of peace": {
    name: "Channel Divinity: Balm of Peace", sv: 1,
    unsupported: [{ reason: "action-based healing with position-dependent targeting", tags: ["healing", "action"] }],
  },
  "subclass|cleric|peace domain|protective bond": {
    name: "Protective Bond", sv: 1,
    unsupported: [{ reason: "reaction-triggered teleport with damage redirection", tags: ["teleport", "damage", "reaction"] }],
  },
  "subclass|cleric|peace domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    unsupported: [{ reason: "weapon/cantrip-attack-dependent bonus damage", tags: ["attack", "damage"] }],
  },
  "subclass|cleric|peace domain|potent spellcasting": {
    name: "Potent Spellcasting", sv: 1,
    unsupported: [{ reason: "cantrip damage modifier (ability-dependent)", tags: ["spellcasting", "damage"] }],
  },
  "subclass|cleric|solidarity domain (psa)|channel divinity: preserve life": {
    name: "Channel Divinity: Preserve Life", sv: 1,
    unsupported: [{ reason: "action-based healing with variable distribution", tags: ["healing", "action"] }],
  },
  "subclass|cleric|solidarity domain (psa)|oketra's blessing": {
    name: "Oketra's Blessing", sv: 1,
    unsupported: [{ reason: "reaction-triggered post-hoc bonus to creature's attack roll", tags: ["bonus", "attack", "reaction"] }],
  },
  "subclass|cleric|solidarity domain (psa)|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    unsupported: [{ reason: "weapon/cantrip-attack-dependent bonus damage", tags: ["attack", "damage"] }],
  },
  "subclass|cleric|solidarity domain (psa)|divine strike": {
    name: "Divine Strike", sv: 1,
    unsupported: [{ reason: "weapon-attack-dependent damage bonus; scales at character level 14", tags: ["attack", "damage", "level-scaling"] }],
  },
  "subclass|cleric|strength domain (psa)|channel divinity: feat of strength": {
    name: "Channel Divinity: Feat of Strength", sv: 1,
    unsupported: [{ reason: "post-hoc bonus to STR-based rolls after seeing the roll", tags: ["bonus", "strength", "condition"] }],
  },
  "subclass|cleric|strength domain (psa)|rhonas's blessing": {
    name: "Rhonas's Blessing", sv: 1,
    unsupported: [{ reason: "reaction-triggered post-hoc bonus to creature's STR-based rolls", tags: ["bonus", "strength", "reaction"] }],
  },
  "subclass|cleric|strength domain (psa)|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    unsupported: [{ reason: "weapon/cantrip-attack-dependent bonus damage", tags: ["attack", "damage"] }],
  },
  "subclass|cleric|strength domain (psa)|divine strike": {
    name: "Divine Strike", sv: 1,
    unsupported: [{ reason: "weapon-attack-dependent damage bonus; scales at character level 14", tags: ["attack", "damage", "level-scaling"] }],
  },
  "subclass|cleric|strength domain (psa)|avatar of battle": {
    name: "Avatar of Battle", sv: 1,
    unsupported: [{ reason: "damage-type-specific resistance (nonmagical BPS)", tags: ["resistance", "damage-type"] }],
  },
});
