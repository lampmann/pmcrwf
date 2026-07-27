// Racial trait features (batch 2): race/subrace ability bonus features converted to
// declarative effects. LLM-generated from D&D 5e (2014) sourcebooks; see
// effects/tools/conversion-guide.md for methodology. Most traits (darkvision,
// resistances, weapon training, languages, speed, etc.) fall outside the
// engine's current target list or require features not yet modeled (e.g.,
// condition-specific save advantage, spell casting without slots); only
// numeric/mechanical bonuses to modeled game subsystems are included below.
registerEffects({
  "race|eladrin|keen senses": {
    name: "Keen Senses", sv: 1,
    effects: [
      { target: "skill-perception", op: "prof" },
    ],
  },
  "race|elf|keen senses": {
    name: "Keen Senses", sv: 1,
    effects: [
      { target: "skill-perception", op: "prof" },
    ],
  },
  "race|elf (kaladesh)|keen senses": {
    name: "Keen Senses", sv: 1,
    effects: [
      { target: "skill-perception", op: "prof" },
    ],
  },
  "subrace|hill|dwarven toughness": {
    name: "Dwarven Toughness", sv: 1,
    effects: [{ target: "hpmax", op: "add", value: { level: "total" } }],
  },
  "race|dwarf (kaladesh)|dwarven toughness": {
    name: "Dwarven Toughness", sv: 1,
    effects: [{ target: "hpmax", op: "add", value: { level: "total" } }],
  },
  "race|dwarf|stonecunning": {
    name: "Stonecunning", sv: 1,
    unsupported: [{ reason: "double proficiency bonus, but only on History checks related to stonework's origin; not a blanket skill expertise", tags: ["skill", "conditional"] }],
  },
});
