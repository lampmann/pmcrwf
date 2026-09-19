/* Sorcerer class + Sorcerous Origin subclass features.

   Almost everything a sorcerer does is powered by sorcery points, which the
   sheet has no resource model for (the uses tracker counts discrete uses,
   not a spendable pool), so this class converts thinly on purpose. Draconic
   Resilience is the notable exception — its per-level max HP bump is exactly
   what `{ level: "class", class: "@self" }` exists for. */
registerEffects({
  // ===== Sorcerer (base class) =====
  "class|sorcerer|font of magic": {
    name: "Font of Magic", sv: 1,
    unsupported: [{ reason: "sorcery points are a spendable pool convertible to spell slots; the uses tracker counts discrete uses, not a point pool", tags: ["resource", "spell-slots"] }],
  },

  "class|sorcerer|metamagic": {
    name: "Metamagic", sv: 1,
    unsupported: [{ reason: "Metamagic options live in 5e.tools' optional-features file, which isn't imported yet", tags: ["optional-features"] }],
  },

  "class|sorcerer|magical guidance": {
    name: "Magical Guidance", sv: 1,
    unsupported: [{ reason: "spend a sorcery point to reroll a failed ability check; no post-hoc roll modification", tags: ["skills", "reroll"] }],
  },

  // ===== Draconic Bloodline =====
  "subclass|sorcerer|draconic bloodline|draconic resilience": {
    name: "Draconic Resilience", sv: 1,
    effects: [{ target: "hpmax", op: "add", value: { level: "class", class: "@self" } }],
    unsupported: [{ reason: "unarmored AC becomes 13 + DEX; AC isn't an effects target", tags: ["ac"] }],
  },

  "subclass|sorcerer|draconic bloodline|dragon ancestor": {
    name: "Dragon Ancestor", sv: 1,
    unsupported: [{ reason: "doubled proficiency on Charisma checks when interacting with dragons; no creature-type predicate", tags: ["conditional", "skills"] }],
  },

  "subclass|sorcerer|draconic bloodline|elemental affinity": {
    name: "Elemental Affinity", sv: 1,
    unsupported: [{ reason: "adds CHA to one damage roll of a spell matching your draconic damage type; spell damage rolls aren't an effects target", tags: ["damage"] }],
  },

  // ===== Wild Magic =====
  "subclass|sorcerer|wild magic|tides of chaos": {
    name: "Tides of Chaos", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "advantage on one attack roll, ability check, or saving throw of your choice; the engine can't target 'one roll of any kind'", tags: ["advantage", "resource"] }],
  },

  "subclass|sorcerer|wild magic|spell bombardment": {
    name: "Spell Bombardment", sv: 1,
    unsupported: [{ reason: "reroll and add a maximum-value spell damage die; no damage-dice model", tags: ["damage"] }],
  },

  // ===== Divine Soul =====
  "subclass|sorcerer|divine soul|favored by the gods": {
    name: "Favored by the Gods", sv: 1,
    uses: { max: 1, per: "sr" },
    unsupported: [{ reason: "add 2d4 to a failed save or missed attack after the roll; no post-hoc roll modification", tags: ["saves", "attacks", "resource"] }],
  },

  // ===== Shadow Magic =====
  "subclass|sorcerer|shadow magic|strength of the grave": {
    name: "Strength of the Grave", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "CHA save to drop to 1 hit point instead of 0; no HP-threshold trigger model", tags: ["hp", "trigger"] }],
  },

  "subclass|sorcerer|shadow magic|umbral form": {
    name: "Umbral Form", sv: 1,
    effects: [
      { target: "resist-all damage except force and radiant", op: "tag", value: "all but force/radiant" },
      { target: "resist-all damage except force and radiant", op: "note", text: "only while transformed - costs 6 sorcery points" },
    ],
  },

  // ===== Aberrant Mind =====
  "subclass|sorcerer|aberrant mind|psychic defenses": {
    name: "Psychic Defenses", sv: 1,
    effects: [
      { target: "resist-psychic", op: "tag", value: "psychic" },
      { target: "save-vs-charmed", op: "tag", value: "charmed" },
      { target: "save-vs-frightened", op: "tag", value: "frightened" },
    ],
  },

  // ===== Storm Sorcery =====
  "subclass|sorcerer|storm sorcery|heart of the storm": {
    name: "Heart of the Storm", sv: 1,
    effects: [
      { target: "resist-lightning and thunder", op: "tag", value: "lightning/thunder" },
      { target: "resist-lightning and thunder", op: "note", text: "casting a 1st-level-or-higher lightning/thunder spell also bursts for half your sorcerer level" },
    ],
  },

  "subclass|sorcerer|storm sorcery|wind soul": {
    name: "Wind Soul", sv: 1,
    effects: [
      { target: "immune-lightning and thunder", op: "tag", value: "lightning/thunder" },
      { target: "speed-fly", op: "add", value: 60 },
    ],
  },

  // ===== Pyromancer (PSK) =====
  "subclass|sorcerer|pyromancer (psk)|fire in the veins": {
    name: "Fire in the Veins", sv: 1,
    effects: [
      { target: "resist-fire", op: "tag", value: "fire" },
    ],
  },

  "subclass|sorcerer|pyromancer (psk)|fiery soul": {
    name: "Fiery Soul", sv: 1,
    effects: [
      { target: "immune-fire", op: "tag", value: "fire" },
    ],
  },
});
