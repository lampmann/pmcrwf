// Artificer class and subclass features (batch 2): Armorer, Alchemist, Artillerist, Battle Smith
registerEffects({
  "class|artificer|tool expertise": {
    name: "Tool Expertise", sv: 1,
    unsupported: [{ reason: "tool proficiency doubling on ability checks; no tool-check target exists", tags: ["proficiency"] }],
  },
  "class|artificer|flash of genius": {
    name: "Flash of Genius", sv: 1,
    uses: { max: { max: [{ mod: "int" }, 1] }, per: "lr" },
    unsupported: [{ reason: "reaction-triggered ability to add INT mod to any ability check or saving throw; no general ability-check modifier target", tags: ["reaction", "selective"] }],
  },
  "class|artificer|soul of artifice": {
    name: "Soul of Artifice", sv: 1,
    unsupported: [{ reason: "+1 save bonus per magic item attuned (requires attunement tracking); reaction ability to trade infusion for HP survival", tags: ["attunement", "reaction"] }],
  },

  "subclass|artificer|alchemist|experimental elixir": {
    name: "Experimental Elixir", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "elixir uses-count scales at level 6 (2) and 15 (3); base value represented; random table for elixir effects", tags: ["scaling-uses", "random-table"] }],
  },
  "subclass|artificer|alchemist|alchemical savant": {
    name: "Alchemical Savant", sv: 1,
    unsupported: [{ reason: "conditional spell bonus (INT mod, min +1) only when spellcasting focus is alchemist's supplies and spell deals acid/fire/necrotic/poison or restores HP", tags: ["spell-specific", "conditional"] }],
  },
  "subclass|artificer|alchemist|restorative reagents": {
    name: "Restorative Reagents", sv: 1,
    uses: { max: { max: [{ mod: "int" }, 1] }, per: "lr" },
    unsupported: [{ reason: "spell-specific: casting lesser restoration without slot; no spell-casting-without-slot mechanic", tags: ["spell-specific"] }],
  },
  "subclass|artificer|alchemist|chemical mastery": {
    name: "Chemical Mastery", sv: 1,
    unsupported: [{ reason: "damage/condition immunities (acid/poison resist, poisoned immunity); spell-specific casting (greater restoration, heal) without slot/component/preparation", tags: ["damage-immunity", "spell-specific"] }],
  },

  "subclass|artificer|armorer|armor model": {
    name: "Armor Model", sv: 1,
    unsupported: [{ reason: "model selection (Guardian vs Infiltrator) that changes on short/long rest; INT-based attack/damage for armor's special weapon (weapon-dependent); model-specific benefits", tags: ["model-dependent", "weapon"] }],
  },
  "subclass|artificer|armorer|dampening field": {
    name: "Dampening Field", sv: 1,
    effects: [
      { target: "skill-stealth", op: "adv" },
    ],
  },
  "subclass|artificer|armorer|defensive field": {
    name: "Defensive Field", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [{ reason: "bonus action ability to gain temporary hit points (equal to artificer level); action-dependent effect not modeled", tags: ["action", "temporary-hp"] }],
  },
  "subclass|artificer|armorer|lightning launcher": {
    name: "Lightning Launcher", sv: 1,
    effects: [
      // This is the armor's own built-in weapon, not a rider on every attack, so it's toggled:
      // switch it on for the attack row that *is* the launcher (dmg 1d6, ranged, magical).
      { target: "damage-bonus", op: "adddice", value: "1d6",
        activation: { kind: "toggle", id: "lightning-launcher", label: "Lightning Launcher", default: false } },
      { target: "damage-bonus", op: "note", text: "the armor's own ranged weapon (1d6 lightning), not a bonus on other attacks" },
    ],
  },
  "subclass|artificer|armorer|powered steps": {
    name: "Powered Steps", sv: 1,
    effects: [{ target: "speed", op: "add", value: 5 }],
  },
  "subclass|artificer|armorer|thunder gauntlets": {
    name: "Thunder Gauntlets", sv: 1,
    effects: [
      // As with Lightning Launcher: the gauntlets are their own melee weapon, so the die is toggled
      // onto the row that represents them rather than added to every attack you make.
      { target: "damage-bonus", op: "adddice", value: "1d8",
        activation: { kind: "toggle", id: "thunder-gauntlets", label: "Thunder Gauntlets", default: false } },
      { target: "damage-bonus", op: "note", text: "the armor's own melee weapon (1d8 thunder), not a bonus on other attacks" },
    ],
    unsupported: [{ reason: "a creature hit by the gauntlets has disadvantage on attacks against anyone else until your next turn", tags: ["disadvantage", "target-state"] }],
  },
  "subclass|artificer|armorer|extra attack": {
    name: "Extra Attack", sv: 1,
    unsupported: [{ reason: "extra attack action on Attack action; action-based feature not modeled", tags: ["action"] }],
  },
  "subclass|artificer|armorer|guardian": {
    name: "Guardian", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [{ reason: "reaction ability: force STR save and reposition creature within 30 feet; possible bonus melee attack if pulled within 5 feet", tags: ["reaction", "save", "damage"] }],
  },
  "subclass|artificer|armorer|infiltrator": {
    name: "Infiltrator", sv: 1,
    unsupported: [{ reason: "passive effect triggered by Lightning Launcher damage: target gains disadvantage on attacks against you; next attack against target has advantage and deals +1d6 lightning", tags: ["conditional-disadvantage", "conditional-advantage"] }],
  },

  "subclass|artificer|artillerist|eldritch cannon": {
    name: "Eldritch Cannon", sv: 1,
    unsupported: [{ reason: "summoned magical cannon companion with independent AC, HP, and attacks; action to create, long rest or spell slot to recharge", tags: ["summon", "companion"] }],
  },
  "subclass|artificer|artillerist|arcane firearm": {
    name: "Arcane Firearm", sv: 1,
    unsupported: [{ reason: "random d8 roll to bonus damage on artificer spells cast through firearm; no roll-history model", tags: ["spell-specific", "random-roll"] }],
  },
  "subclass|artificer|artillerist|explosive cannon": {
    name: "Explosive Cannon", sv: 1,
    unsupported: [{ reason: "Eldritch Cannon enhancement: +1d8 damage and detonation action forcing DEX save (3d8 force); companion-dependent", tags: ["companion-dependent", "scaling"] }],
  },
  "subclass|artificer|artillerist|fortified position": {
    name: "Fortified Position", sv: 1,
    unsupported: [{ reason: "half cover within 10 feet of Eldritch Cannon; ability to have two cannons at once; companion-dependent", tags: ["companion-dependent", "cover"] }],
  },

  "subclass|artificer|battle smith|battle ready": {
    name: "Battle Ready", sv: 2,
    // INT *replaces* STR/DEX on a magic weapon's attack and damage rolls rather than adding on top,
    // which is what `useability` expresses. It applies to magic weapons only, and the engine has no
    // per-weapon predicate — so a row it shouldn't touch opts out with that row's own fx checkbox,
    // and the note says so.
    effects: [
      { target: "attack-ability", op: "useability", value: "int" },
      { target: "attack-hit", op: "note", text: "magic weapons only — untick fx on a row this shouldn't apply to" },
    ],
  },
  "subclass|artificer|battle smith|steel defender": {
    name: "Steel Defender", sv: 1,
    unsupported: [{ reason: "summoned mechanical companion with independent stat block, AC, HP, and actions; shares initiative; revivable with spell slot", tags: ["summon", "companion"] }],
  },
  "subclass|artificer|battle smith|extra attack": {
    name: "Extra Attack", sv: 1,
    unsupported: [{ reason: "extra attack action on Attack action; action-based feature not modeled", tags: ["action"] }],
  },
  "subclass|artificer|battle smith|arcane jolt": {
    name: "Arcane Jolt", sv: 1,
    uses: { max: { max: [{ mod: "int" }, 1] }, per: "lr" },
    unsupported: [{ reason: "reaction-triggered ability on magic weapon or steel defender hit; choice between +2d6 force damage or healing 2d6; limited to once per turn", tags: ["reaction", "companion-dependent"] }],
  },
  "subclass|artificer|battle smith|improved defender": {
    name: "Improved Defender", sv: 1,
    unsupported: [{ reason: "Arcane Jolt and steel defender upgrades: damage/healing scales to 4d6; defender +2 AC and Deflect Attack damage reaction; companion-dependent", tags: ["companion-dependent", "scaling"] }],
  },
});
