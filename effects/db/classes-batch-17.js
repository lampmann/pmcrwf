/* Warlock class + Otherworldly Patron subclass features.

   The four Mystic Arcanum features are separate 5e.tools records (one per
   spell level), so they're four separate keys, each with its own 1/long-rest
   tracker — that matches how the Features panel lists them.

   Eldritch Invocations are the class's main customisation and can't be
   converted at all yet: they live in 5e.tools' optional-features file, which
   the sheet doesn't import (see DOCS.md). */
registerEffects({
  // ===== Warlock (base class) =====
  "class|warlock|eldritch invocations": {
    name: "Eldritch Invocations", sv: 1,
    unsupported: [{ reason: "invocations live in 5e.tools' optional-features file, which isn't imported yet — several of them (Agonizing Blast, Devil's Sight, ...) would otherwise be automatable", tags: ["optional-features"] }],
  },

  "class|warlock|mystic arcanum (6th level)": {
    name: "Mystic Arcanum (6th Level)", sv: 1,
    uses: { max: 1, per: "lr" },
  },

  "class|warlock|mystic arcanum (7th level)": {
    name: "Mystic Arcanum (7th Level)", sv: 1,
    uses: { max: 1, per: "lr" },
  },

  "class|warlock|mystic arcanum (8th level)": {
    name: "Mystic Arcanum (8th Level)", sv: 1,
    uses: { max: 1, per: "lr" },
  },

  "class|warlock|mystic arcanum (9th level)": {
    name: "Mystic Arcanum (9th Level)", sv: 1,
    uses: { max: 1, per: "lr" },
  },

  "class|warlock|eldritch master": {
    name: "Eldritch Master", sv: 1,
    uses: { max: 1, per: "lr" },
  },

  // ===== The Fiend =====
  "subclass|warlock|the fiend|dark one's blessing": {
    name: "Dark One's Blessing", sv: 1,
    unsupported: [{ reason: "temporary hit points on reducing a creature to 0 hp; temp HP isn't an effects target", tags: ["temp-hp", "trigger"] }],
  },

  "subclass|warlock|the fiend|dark one's own luck": {
    name: "Dark One's Own Luck", sv: 1,
    uses: { max: 1, per: "sr" },
    unsupported: [{ reason: "add a d10 to an ability check or save after seeing the roll; no post-hoc roll modification", tags: ["skills", "saves", "resource"] }],
  },

  "subclass|warlock|the fiend|fiendish resilience": {
    name: "Fiendish Resilience", sv: 1,
    unsupported: [{ reason: "resistance to a damage type chosen on each rest; no resistances model", tags: ["resistance"] }],
  },

  // ===== The Celestial =====
  "subclass|warlock|the celestial|healing light": {
    name: "Healing Light", sv: 1,
    uses: { max: { sum: [1, { level: "class", class: "@self" }] }, per: "lr" },
    unsupported: [{ reason: "the pool is spent as d6s (up to CHA modifier at a time), not as one use per activation; the pip tracker counts single uses", tags: ["healing", "resource"] }],
  },

  "subclass|warlock|the celestial|radiant soul": {
    name: "Radiant Soul", sv: 1,
    unsupported: [{ reason: "resistance to radiant damage plus CHA added to radiant/fire spell damage; neither resistances nor spell damage rolls are effects targets", tags: ["resistance", "damage"] }],
  },

  "subclass|warlock|the celestial|celestial resilience": {
    name: "Celestial Resilience", sv: 1,
    unsupported: [{ reason: "temporary hit points on each rest; temp HP isn't an effects target", tags: ["temp-hp", "rest"] }],
  },

  // ===== The Genie =====
  "subclass|warlock|the genie|genie's wrath": {
    name: "Genie's Wrath", sv: 1,
    effects: [
      { target: "damage-bonus", op: "add", value: { prof: true } },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; damage type follows your patron" },
    ],
  },

  // ===== The Hexblade =====
  "subclass|warlock|the hexblade|hex warrior": {
    name: "Hex Warrior", sv: 1,
    unsupported: [{ reason: "medium armor/shield/martial weapon proficiency, plus using CHA instead of STR/DEX for one weapon's attack and damage; no proficiencies module and no ability-substitution model", tags: ["proficiency", "attacks"] }],
  },

  "subclass|warlock|the hexblade|hexblade's curse": {
    name: "Hexblade's Curse", sv: 1,
    uses: { max: 1, per: "sr" },
    effects: [
      { target: "damage-bonus", op: "add", value: { prof: true },
        activation: { kind: "toggle", id: "hexblades-curse", label: "Hexblade's Curse", default: false } },
      { target: "damage-bonus", op: "note", text: "against the cursed target only; your crit range against it also becomes 19-20" },
    ],
  },

  "subclass|warlock|the hexblade|armor of hexes": {
    name: "Armor of Hexes", sv: 1,
    unsupported: [{ reason: "a d6 chance to negate the cursed target's hit; no incoming-attack model", tags: ["reaction", "defense"] }],
  },

  // ===== The Great Old One =====
  "subclass|warlock|the great old one|thought shield": {
    name: "Thought Shield", sv: 1,
    unsupported: [{ reason: "resistance to psychic damage and reflected psychic damage; no resistances model", tags: ["resistance"] }],
  },

  // ===== The Undying =====
  "subclass|warlock|the undying|among the dead": {
    name: "Among the Dead", sv: 1,
    unsupported: [{ reason: "advantage on saving throws against disease; conditional advantage isn't modeled per-ability", tags: ["advantage", "condition"] }],
  },

  // ===== The Fathomless =====
  "subclass|warlock|the fathomless|oceanic soul": {
    name: "Oceanic Soul", sv: 1,
    unsupported: [{ reason: "resistance to cold damage; no resistances model", tags: ["resistance"] }],
  },

  // ===== The Undead =====
  "subclass|warlock|the undead|necrotic husk": {
    name: "Necrotic Husk", sv: 1,
    unsupported: [{ reason: "resistance (or immunity, while transformed) to necrotic damage; no resistances model", tags: ["resistance"] }],
  },
});
