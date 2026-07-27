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
      { target: "damage-bonus", op: "adddice", value: "1d6" },
    ],
  },
  "subclass|artificer|armorer|powered steps": {
    name: "Powered Steps", sv: 1,
    unsupported: [{ reason: "speed increase (+5 feet); speed target not yet wired in effects engine", tags: ["speed"] }],
  },
  "subclass|artificer|armorer|thunder gauntlets": {
    name: "Thunder Gauntlets", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
    ],
    unsupported: [{ reason: "gauntlets as melee weapons with 1d8 thunder base damage; disadvantage imposed on attacking creature until next turn start", tags: ["weapon", "disadvantage"] }],
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
    name: "Battle Ready", sv: 1,
    effects: [
      { target: "attack-hit", op: "add", value: { mod: "int" } },
      { target: "damage-bonus", op: "add", value: { mod: "int" } },
      { target: "attack-hit", op: "note", text: "magic weapons only" },
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
