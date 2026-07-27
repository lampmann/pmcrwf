/* Paladin class + Sacred Oath subclass features.

   No `when: { minLevel }` gate is used for a feature that's simply granted at
   a given level — class-library.js already filters features by your actual
   class level (`f.level <= lvl`), so a 7th-level aura can't show up before
   7th. `when` is reserved for a mechanic that scales *within* one feature key
   (where it reads total character level — the documented approximation).

   Several oath features are the clearest legitimate use of the reserved
   attack-/damage- targets on the sheet: Improved Divine Smite, Sacred Weapon,
   Vow of Enmity and Guided Strike are all flat to-hit/damage modifiers, so
   they're written now and will start applying when the Attacks module reads
   those targets. */
registerEffects({
  // ===== Paladin (base class) =====
  "class|paladin|divine sense": {
    name: "Divine Sense", sv: 1,
    uses: { max: { sum: [1, { mod: "cha" }] }, per: "lr" },
  },

  "class|paladin|lay on hands": {
    name: "Lay on Hands", sv: 1,
    unsupported: [{ reason: "a pool of (paladin level x 5) hit points spent per point; the uses tracker counts discrete uses, not a point pool", tags: ["healing", "resource"] }],
  },

  "class|paladin|channel divinity": {
    name: "Channel Divinity", sv: 1,
    uses: { max: 1, per: "sr" },
  },

  "class|paladin|divine smite": {
    name: "Divine Smite", sv: 1,
    unsupported: [{ reason: "extra radiant damage scaled by the spell slot expended (2d8-5d8, +1d8 vs undead/fiends); no spell-slot-driven damage model", tags: ["damage", "spell-slots"] }],
  },

  "class|paladin|improved divine smite": {
    name: "Improved Divine Smite", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "melee weapon attacks only; radiant" },
    ],
  },

  "class|paladin|fighting style": {
    name: "Fighting Style", sv: 1,
    unsupported: [{ reason: "Fighting Style options live in 5e.tools' optional-features file, which isn't imported yet", tags: ["optional-features"] }],
  },

  "class|paladin|extra attack": {
    name: "Extra Attack", sv: 1,
    unsupported: [{ reason: "a second attack on the Attack action; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
  },

  // The paladin's signature aura: +CHA (minimum +1) to every saving throw.
  "class|paladin|aura of protection": {
    name: "Aura of Protection", sv: 1,
    effects: [
      { target: "save-str", op: "add", value: { max: [{ mod: "cha" }, 1] } },
      { target: "save-dex", op: "add", value: { max: [{ mod: "cha" }, 1] } },
      { target: "save-con", op: "add", value: { max: [{ mod: "cha" }, 1] } },
      { target: "save-int", op: "add", value: { max: [{ mod: "cha" }, 1] } },
      { target: "save-wis", op: "add", value: { max: [{ mod: "cha" }, 1] } },
      { target: "save-cha", op: "add", value: { max: [{ mod: "cha" }, 1] } },
      { target: "save-con", op: "note", text: "aura only applies while you are conscious" },
    ],
  },

  // ===== Oathbreaker =====
  "subclass|paladin|oathbreaker|aura of hate": {
    name: "Aura of Hate", sv: 1,
    effects: [
      { target: "damage-bonus", op: "add", value: { max: [{ mod: "cha" }, 1] } },
      { target: "damage-bonus", op: "note", text: "melee weapon attacks only" },
    ],
  },

  "subclass|paladin|oathbreaker|supernatural resistance": {
    name: "Supernatural Resistance", sv: 1,
    unsupported: [{ reason: "resistance to nonmagical bludgeoning/piercing/slashing; no resistances model", tags: ["resistance"] }],
  },

  // ===== Oath of the Ancients =====
  "subclass|paladin|oath of the ancients|aura of warding": {
    name: "Aura of Warding", sv: 1,
    unsupported: [{ reason: "resistance to damage from spells; no resistances model", tags: ["resistance"] }],
  },

  "subclass|paladin|oath of the ancients|undying sentinel": {
    name: "Undying Sentinel", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "drop to 1 hit point instead of 0; no HP-threshold trigger model", tags: ["hp", "trigger"] }],
  },

  // ===== Oath of Devotion =====
  "subclass|paladin|oath of devotion|sacred weapon": {
    name: "Sacred Weapon", sv: 1,
    effects: [
      { target: "attack-hit", op: "add", value: { max: [{ mod: "cha" }, 1] },
        activation: { kind: "toggle", id: "sacred-weapon", label: "Sacred Weapon", default: false } },
    ],
  },

  // ===== Oath of Vengeance =====
  "subclass|paladin|oath of vengeance|vow of enmity": {
    name: "Vow of Enmity", sv: 1,
    effects: [
      { target: "attack-hit", op: "adv",
        activation: { kind: "toggle", id: "vow-of-enmity", label: "Vow of Enmity", default: false } },
    ],
  },

  "subclass|paladin|oath of vengeance|soul of vengeance": {
    name: "Soul of Vengeance", sv: 1,
    unsupported: [{ reason: "reaction melee attack against a creature under your Vow of Enmity; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
  },

  // ===== Oath of the Crown =====
  "subclass|paladin|oath of the crown|unyielding spirit": {
    name: "Unyielding Spirit", sv: 1,
    unsupported: [{ reason: "advantage on saves to avoid being paralyzed or stunned; conditional advantage isn't modeled per-ability", tags: ["advantage", "condition"] }],
  },

  // ===== Oath of Glory =====
  "subclass|paladin|oath of glory|peerless athlete": {
    name: "Peerless Athlete", sv: 1,
    effects: [
      { target: "skill-athletics", op: "adv",
        activation: { kind: "toggle", id: "peerless-athlete", label: "Peerless Athlete", default: false } },
      { target: "skill-acrobatics", op: "adv",
        activation: { kind: "toggle", id: "peerless-athlete", label: "Peerless Athlete", default: false } },
    ],
  },

  "subclass|paladin|oath of glory|aura of alacrity": {
    name: "Aura of Alacrity", sv: 1,
    unsupported: [{ reason: "+10 ft walking speed; speed isn't an effects target", tags: ["speed"] }],
  },

  // ===== Oath of the Watchers =====
  "subclass|paladin|oath of the watchers|aura of the sentinel": {
    name: "Aura of the Sentinel", sv: 1,
    effects: [{ target: "init", op: "add", value: { prof: true } }],
  },

  "subclass|paladin|oath of the watchers|watcher's will": {
    name: "Watcher's Will", sv: 1,
    effects: [
      { target: "save-int", op: "adv",
        activation: { kind: "toggle", id: "watchers-will", label: "Watcher's Will", default: false } },
      { target: "save-wis", op: "adv",
        activation: { kind: "toggle", id: "watchers-will", label: "Watcher's Will", default: false } },
      { target: "save-cha", op: "adv",
        activation: { kind: "toggle", id: "watchers-will", label: "Watcher's Will", default: false } },
    ],
  },

  // ===== Oath of Conquest =====
  "subclass|paladin|oath of conquest|guided strike": {
    name: "Guided Strike", sv: 1,
    effects: [
      { target: "attack-hit", op: "add", value: 10,
        activation: { kind: "toggle", id: "guided-strike", label: "Guided Strike (+10)", default: false } },
    ],
  },

  // ===== Oath of Redemption =====
  "subclass|paladin|oath of redemption|emissary of peace": {
    name: "Emissary of Peace", sv: 1,
    effects: [
      { target: "skill-persuasion", op: "add", value: 5,
        activation: { kind: "toggle", id: "emissary-of-peace", label: "Emissary of Peace (+5)", default: false } },
    ],
  },

  "subclass|paladin|oath of redemption|emissary of redemption": {
    name: "Emissary of Redemption", sv: 1,
    unsupported: [{ reason: "resistance to all damage dealt by other creatures; no resistances model", tags: ["resistance"] }],
  },
});
