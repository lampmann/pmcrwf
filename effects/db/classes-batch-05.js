// Cleric class features (base class and 3 domains: Ambition, Arcana, Death, Forge)
registerEffects({
  // ----- Class features -----
  "class|cleric|channel divinity": {
    name: "Channel Divinity", sv: 1,
    uses: { max: 1, per: "sr" },
    unsupported: [{ reason: "use count scales (2 uses at level 6, 3 at level 18); engine lacks conditional use limits", tags: ["uses-scaling"] }],
  },

  // ----- Ambition Domain -----
  "subclass|cleric|ambition domain (psa)|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; radiant" },
    ],
    unsupported: [{ reason: "the same 1d8 also rides on your cantrips; no cantrip-damage target", tags: ["cantrip-damage"] }],
  },

  // ----- Arcana Domain -----
  "subclass|cleric|arcana domain|arcane initiate": {
    name: "Arcane Initiate", sv: 1,
    effects: [{ target: "skill-arcana", op: "prof" }],
  },
  "subclass|cleric|arcana domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; radiant" },
    ],
    unsupported: [{ reason: "the same 1d8 also rides on your cantrips; no cantrip-damage target", tags: ["cantrip-damage"] }],
  },

  // ----- Death Domain -----
  "subclass|cleric|death domain|channel divinity: touch of death": {
    name: "Channel Divinity: Touch of Death", sv: 1,
    effects: [
      // Spends a Channel Divinity use on one melee hit, so it's toggled rather than always-on —
      // left unconditional it would quietly inflate every attack row's damage.
      { target: "damage-bonus", op: "add",
        value: { sum: [5, { mul: [2, { level: "class", class: "@self" }] }] },
        activation: { kind: "toggle", id: "touch-of-death", label: "Touch of Death", default: false } },
      { target: "damage-bonus", op: "note", text: "one melee hit, spending a Channel Divinity use; necrotic" },
    ],
  },
  "subclass|cleric|death domain|divine strike": {
    name: "Divine Strike", sv: 1,
    effects: [
      // 1d8 at 8th, 2d8 at 14th — the second effect is the *increment*, since adddice accumulates.
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "adddice", value: "1d8", when: { minLevel: 14 } },
      { target: "damage-bonus", op: "note", text: "once per turn, on a weapon hit; necrotic" },
    ],
  },
  "subclass|cleric|death domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; radiant" },
    ],
    unsupported: [{ reason: "the same 1d8 also rides on your cantrips; no cantrip-damage target", tags: ["cantrip-damage"] }],
  },

  // ----- Unsupported: spell/resource mechanics -----
  "class|cleric|channel divinity: harness divine power": {
    name: "Channel Divinity: Harness Divine Power", sv: 1,
    unsupported: [{ reason: "regains expended spell slots; no spell-slot resource pool tracked", tags: ["resource", "spellcasting"] }],
  },

  // ----- Unsupported: Ambition Domain -----
  "subclass|cleric|ambition domain (psa)|warding flare": {
    name: "Warding Flare", sv: 1,
    uses: { max: { max: [{ mod: "wis" }, 1] }, per: "lr" },
    unsupported: [{ reason: "imposes disadvantage on attacker's roll; no per-condition save/attack target", tags: ["disadvantage", "reaction-ability"] }],
  },
  "subclass|cleric|ambition domain (psa)|channel divinity: invoke duplicity": {
    name: "Channel Divinity: Invoke Duplicity", sv: 1,
    unsupported: [{ reason: "grants advantage on attack rolls when illusion is near target; condition-specific, not ability-based", tags: ["advantage", "illusion-mechanic"] }],
  },
  "subclass|cleric|ambition domain (psa)|potent spellcasting": {
    name: "Potent Spellcasting", sv: 1,
    unsupported: [{ reason: "adds Wisdom modifier to cantrip damage; no cantrip-specific damage target", tags: ["cantrip-damage"] }],
  },

  // ----- Unsupported: Arcana Domain -----
  "subclass|cleric|arcana domain|channel divinity: arcane abjuration": {
    name: "Channel Divinity: Arcane Abjuration", sv: 1,
    unsupported: [{ reason: "turns/banishes creatures by type (celestial/elemental/fey/fiend) and CR threshold; requires DM adjudication", tags: ["creature-type-gated", "turn-effect", "banishment"] }],
  },
  "subclass|cleric|arcana domain|potent spellcasting": {
    name: "Potent Spellcasting", sv: 1,
    unsupported: [{ reason: "adds Wisdom modifier to cantrip damage; no cantrip-specific damage target", tags: ["cantrip-damage"] }],
  },

  // ----- Unsupported: Death Domain -----
  "subclass|cleric|death domain|bonus proficiency": {
    name: "Bonus Proficiency", sv: 1,
    unsupported: [{ reason: "martial weapon proficiency; weapon proficiencies aren't tracked (an attack row's Pr box is per-row and manual)", tags: ["weapon-proficiency"] }],
  },

  // ----- Unsupported: Forge Domain -----
  "subclass|cleric|forge domain|blessing of the forge": {
    name: "Blessing of the Forge", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "creates temporary +1 magic item (AC or attack/damage); requires equipment tracking and persistence", tags: ["magic-item-creation", "equipment"] }],
  },
});
