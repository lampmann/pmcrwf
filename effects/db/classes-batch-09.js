// Druid class and subclass features (batch 09)
registerEffects({
  "class|druid|wild shape": {
    name: "Wild Shape", sv: 1,
    uses: { max: 2, per: "sr" },
  },
  "subclass|druid|circle of dreams|hidden paths": {
    name: "Hidden Paths", sv: 1,
    uses: { max: { max: [{ mod: "wis" }, 1] }, per: "lr" },
  },
  "subclass|druid|circle of spores|fungal infestation": {
    name: "Fungal Infestation", sv: 1,
    uses: { max: { max: [{ mod: "wis" }, 1] }, per: "lr" },
    unsupported: [{ reason: "animate corpse as zombie; no creature summoning model", tags: ["summon"] }],
  },
  "subclass|druid|circle of stars|archer": {
    name: "Archer", sv: 1,
    effects: [
      { target: "damage-bonus", op: "add", value: { mod: "wis" }, activation: { kind: "toggle", id: "archer-constellation", label: "Archer constellation active", default: false } },
      { target: "damage-bonus", op: "adddice", value: "1d8", activation: { kind: "toggle", id: "archer-constellation", label: "Archer constellation active", default: false } },
      { target: "attack-hit", op: "note", text: "radiant ranged spell attack, 60 feet range" },
    ],
  },
  "subclass|druid|circle of stars|chalice": {
    name: "Chalice", sv: 1,
    unsupported: [{ reason: "spell-casting triggered healing bonus; no casting trigger model", tags: ["spell", "trigger"] }],
  },
  "subclass|druid|circle of stars|dragon": {
    name: "Dragon", sv: 1,
    unsupported: [{ reason: "d20 roll modification (minimum 10 on rolls 1-9); no roll model", tags: ["roll"] }],
  },
  "subclass|druid|circle of stars|star map": {
    name: "Star Map", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
  },
  "subclass|druid|circle of the shepherd|spirit totem": {
    name: "Spirit Totem", sv: 1,
    uses: { max: 1, per: "sr" },
    unsupported: [{ reason: "summon spirit with conditional aura effects (temp HP, advantage on STR, advantage on Perception, healing); no summon/aura model", tags: ["summon"] }],
  },
  "subclass|druid|circle of the shepherd|faithful summons": {
    name: "Faithful Summons", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "emergency summon 4 beasts (conjure animals, 9th level); no summon model", tags: ["summon"] }],
  },
  "subclass|druid|circle of wildfire|cauterizing flames": {
    name: "Cauterizing Flames", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [{ reason: "creature-death triggered healing or damage reaction (2d10 + WIS mod); no trigger model", tags: ["trigger"] }],
  },
  "subclass|druid|circle of wildfire|blazing revival": {
    name: "Blazing Revival", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "0-HP triggered emergency revival (regain half HP, stand up); no trigger model", tags: ["trigger"] }],
  },
});
