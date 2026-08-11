/* Wizard class + Arcane Tradition subclass features.

   War Magic's Tactical Wit and Chronurgy's Temporal Awareness already live in
   effects/db/handwritten.js (they were the schema's original worked examples)
   and are deliberately not repeated here.

   Bladesong moves here from uses-classes.js: the generated file only carried
   its uses tracker, but the feature also grants advantage on Acrobatics, so
   the richer entry owns the key now (registerEffects is Object.assign — a key
   can only live in one file, whole entry wins). */
registerEffects({
  // ===== School of Divination =====
  "subclass|wizard|school of divination|portent": {
    name: "Portent", sv: 1,
    uses: { max: 2, per: "lr" },
    unsupported: [{ reason: "replaces any d20 roll with a number pre-rolled on a long rest; no pre-rolled-result substitution", tags: ["reroll", "resource"] }],
  },

  "subclass|wizard|school of divination|greater portent": {
    name: "Greater Portent", sv: 1,
    unsupported: [{ reason: "raises Portent's pool from two dice to three; an entry can't modify another feature's uses spec", tags: ["uses", "cross-feature"] }],
  },

  // ===== School of Abjuration =====
  "subclass|wizard|school of abjuration|improved abjuration": {
    name: "Improved Abjuration", sv: 1,
    unsupported: [{ reason: "adds proficiency bonus to the ability check made by counterspell and dispel magic; spell ability checks aren't an effects target", tags: ["spellcasting"] }],
  },

  "subclass|wizard|school of abjuration|spell resistance": {
    name: "Spell Resistance", sv: 1,
    effects: [
      { target: "resist-damage from spells", op: "tag", value: "spells" },
      { target: "save-vs-magic", op: "tag", value: "spells" },
    ],
  },

  // ===== School of Evocation =====
  "subclass|wizard|school of evocation|empowered evocation": {
    name: "Empowered Evocation", sv: 1,
    unsupported: [{ reason: "adds INT to one damage roll of a wizard evocation spell; spell damage rolls aren't an effects target", tags: ["damage"] }],
  },

  "subclass|wizard|school of evocation|overchannel": {
    name: "Overchannel", sv: 1,
    unsupported: [{ reason: "maximises a spell's damage at escalating necrotic cost per use between long rests; no escalating-cost model", tags: ["damage", "resource"] }],
  },

  // ===== School of Necromancy =====
  "subclass|wizard|school of necromancy|inured to undeath": {
    name: "Inured to Undeath", sv: 1,
    effects: [
      { target: "resist-necrotic", op: "tag", value: "necrotic" },
      { target: "resist-necrotic", op: "note", text: "and immunity to having your hit point maximum reduced" },
    ],
  },

  // ===== School of Transmutation =====
  "subclass|wizard|school of transmutation|transmuter's stone": {
    name: "Transmuter's Stone", sv: 1,
    unsupported: [{ reason: "grants one of darkvision / +10 speed / CON save proficiency / a damage resistance, re-chosen on each transmutation spell; only one of the four options is representable, so a choice picker would be misleading", tags: ["choice", "speed", "resistance"] }],
  },

  // ===== Bladesinging =====
  "subclass|wizard|bladesinging|training in war and song (bladesinging)": {
    name: "Training in War and Song (Bladesinging)", sv: 1,
    effects: [{ target: "skill-performance", op: "prof" }],
    unsupported: [{ reason: "light armor and one-handed melee weapon proficiency; no proficiencies module", tags: ["proficiency", "equipment"] }],
  },

  "subclass|wizard|bladesinging|bladesong": {
    name: "Bladesong", sv: 1,
    uses: { max: { prof: true }, per: "sr" },
    effects: [
      { target: "skill-acrobatics", op: "adv",
        activation: { kind: "toggle", id: "bladesong", label: "Bladesong", default: false } },
      { target: "skill-acrobatics", op: "note", text: "Bladesong also grants +INT to AC, +10 ft speed, and +INT on concentration saves — none of which are effects targets" },
    ],
  },

  "subclass|wizard|bladesinging|song of victory": {
    name: "Song of Victory", sv: 1,
    effects: [
      { target: "damage-bonus", op: "add", value: { max: [{ mod: "int" }, 1] },
        activation: { kind: "toggle", id: "song-of-victory", label: "Song of Victory", default: false } },
      { target: "damage-bonus", op: "note", text: "melee weapon attacks only, while your Bladesong is active" },
    ],
  },

  "subclass|wizard|bladesinging|extra attack": {
    name: "Extra Attack", sv: 1,
    unsupported: [{ reason: "a second attack on the Attack action (one replaceable by a cantrip); action economy isn't modeled", tags: ["attacks", "action-economy"] }],
  },

  // ===== War Magic =====
  "subclass|wizard|war magic|arcane deflection": {
    name: "Arcane Deflection", sv: 1,
    unsupported: [{ reason: "reaction giving +2 AC or +4 to one saving throw after the roll; no post-hoc roll modification and AC isn't a target", tags: ["ac", "saves", "reaction"] }],
  },

  "subclass|wizard|war magic|power surge": {
    name: "Power Surge", sv: 1,
    unsupported: [{ reason: "a pool capped at your INT modifier that resets to *one* (not full) on a long rest and refills by dispelling magic; the uses tracker only models full-pool recharge", tags: ["resource", "partial-recharge"] }],
  },

  "subclass|wizard|war magic|durable magic": {
    name: "Durable Magic", sv: 1,
    effects: [
      { target: "save-str", op: "add", value: 2, activation: { kind: "toggle", id: "durable-magic", label: "Durable Magic", default: false } },
      { target: "save-dex", op: "add", value: 2, activation: { kind: "toggle", id: "durable-magic", label: "Durable Magic", default: false } },
      { target: "save-con", op: "add", value: 2, activation: { kind: "toggle", id: "durable-magic", label: "Durable Magic", default: false } },
      { target: "save-int", op: "add", value: 2, activation: { kind: "toggle", id: "durable-magic", label: "Durable Magic", default: false } },
      { target: "save-wis", op: "add", value: 2, activation: { kind: "toggle", id: "durable-magic", label: "Durable Magic", default: false } },
      { target: "save-cha", op: "add", value: 2, activation: { kind: "toggle", id: "durable-magic", label: "Durable Magic", default: false } },
      { target: "save-con", op: "note", text: "only while you are concentrating on a spell; also grants +2 AC" },
    ],
  },

  // ===== Order of Scribes =====
  "subclass|wizard|order of scribes|one with the word": {
    name: "One with the Word", sv: 1,
    effects: [{ target: "skill-arcana", op: "adv" }],
  },

  // ===== Chronurgy Magic =====
  "subclass|wizard|chronurgy magic|convergent future": {
    name: "Convergent Future", sv: 1,
    unsupported: [{ reason: "replaces a d20 roll with your chosen outcome at the cost of a level of exhaustion; no roll-substitution model", tags: ["reroll", "exhaustion"] }],
  },
});
