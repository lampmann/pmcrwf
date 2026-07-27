/* Fighter subclass features (batch 11 / part 2): Echo Knight, Eldritch Knight, Psi Warrior, Purple Dragon Knight, Rune Knight, Samurai */

registerEffects({
  // ----- Purple Dragon Knight (Banneret) -----
  "subclass|fighter|purple dragon knight (banneret)|royal envoy": {
    name: "Royal Envoy", sv: 1,
    effects: [
      { target: "skill-persuasion", op: "expertise" },
    ],
  },

  // ----- Rune Knight -----
  "subclass|fighter|rune knight|giant's might": {
    name: "Giant's Might", sv: 1,
    effects: [
      { target: "save-str", op: "adv", activation: { kind: "toggle", id: "giants-might", label: "Giant's Might", default: false } },
      { target: "damage-bonus", op: "adddice", value: "1d6", activation: { kind: "toggle", id: "giants-might", label: "Giant's Might", default: false } },
    ],
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [{ reason: "advantage on STR ability checks (not saving throws); size increase to Large", tags: ["ability-checks", "size"] }],
  },

  // ----- Samurai -----
  "subclass|fighter|samurai|bonus proficiency": {
    name: "Bonus Proficiency", sv: 1,
    choices: [{ id: "skill", kind: "pick", n: 1, options: ["history", "insight", "performance", "persuasion"], label: "Skill proficiency" }],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
  },

  "subclass|fighter|samurai|fighting spirit": {
    name: "Fighting Spirit", sv: 1,
    effects: [
      { target: "attack-hit", op: "adv", activation: { kind: "toggle", id: "fighting-spirit", label: "Fighting Spirit", default: false } },
      { target: "attack-hit", op: "note", text: "grants temporary HP: 5 (Fighter 3–9), 10 (Fighter 10–14), 15 (Fighter 15+)" },
    ],
    uses: { max: 3, per: "lr" },
  },

  "subclass|fighter|samurai|elegant courtier": {
    name: "Elegant Courtier", sv: 1,
    choices: [{ id: "save", kind: "pick", n: 1, options: ["int", "cha"], label: "Additional save proficiency" }],
    effects: [
      { target: "skill-persuasion", op: "add", value: { mod: "wis" } },
      { target: "save-wis", op: "prof" },
      { target: "save-{choice:save}", op: "prof", activation: { kind: "choice", choice: "save" } },
    ],
  },

  // ----- Echo Knight (all unsupported) -----
  "subclass|fighter|echo knight|unleash incarnation": {
    name: "Unleash Incarnation", sv: 1,
    uses: { max: { mod: "con", min: 1 }, per: "lr" },
    unsupported: [{ reason: "extra melee attack action from echo position", tags: ["attacks"] }],
  },

  "subclass|fighter|echo knight|shadow martyr": {
    name: "Shadow Martyr", sv: 1,
    uses: { max: 1, per: "sr" },
    unsupported: [{ reason: "teleport echo to intercept attack, change attack target", tags: ["reaction", "teleport"] }],
  },

  "subclass|fighter|echo knight|reclaim potential": {
    name: "Reclaim Potential", sv: 1,
    uses: { max: { mod: "con", min: 1 }, per: "lr" },
    unsupported: [{ reason: "temporary HP gain (2d6 + CON mod) when echo destroyed by damage", tags: ["temp-hp", "condition-based"] }],
  },

  "subclass|fighter|echo knight|legion of one": {
    name: "Legion of One", sv: 1,
    unsupported: [{ reason: "dual echo management, regain Unleash Incarnation use on initiative roll", tags: ["resource-management", "initiative-trigger"] }],
  },

  // ----- Eldritch Knight (all unsupported or omitted) -----
  "subclass|fighter|eldritch knight|war magic": {
    name: "War Magic", sv: 1,
    unsupported: [{ reason: "bonus-action weapon attack after casting cantrip", tags: ["attacks", "action-economy"] }],
  },

  "subclass|fighter|eldritch knight|eldritch strike": {
    name: "Eldritch Strike", sv: 1,
    unsupported: [{ reason: "disadvantage on next spell save (condition-specific, not ability-specific)", tags: ["condition-dependent-save"] }],
  },

  "subclass|fighter|eldritch knight|improved war magic": {
    name: "Improved War Magic", sv: 1,
    unsupported: [{ reason: "bonus-action weapon attack after casting spell", tags: ["attacks", "action-economy"] }],
  },

  // ----- Psi Warrior (all unsupported — resource pool system) -----
  "subclass|fighter|psi warrior|protective field": {
    name: "Protective Field", sv: 1,
    unsupported: [{ reason: "damage reduction (die roll + INT mod) using Psionic Energy die resource", tags: ["resource-pool", "die-roll", "reaction"] }],
  },

  "subclass|fighter|psi warrior|psionic power": {
    name: "Psionic Power", sv: 1,
    unsupported: [{ reason: "Psionic Energy dice resource pool system (d6 scaling to d12); various psionic powers use these", tags: ["resource-pool", "scaling-die"] }],
  },

  "subclass|fighter|psi warrior|psionic strike": {
    name: "Psionic Strike", sv: 1,
    unsupported: [{ reason: "force damage (die roll + INT mod) expending Psionic Energy die", tags: ["resource-pool", "die-roll"] }],
  },

  "subclass|fighter|psi warrior|telekinetic movement": {
    name: "Telekinetic Movement", sv: 1,
    unsupported: [{ reason: "object/creature telekinetic movement (30 ft), limited by short rest or Psionic Energy die", tags: ["telekinesis", "resource-pool"] }],
  },

  "subclass|fighter|psi warrior|psi-powered leap": {
    name: "Psi-Powered Leap", sv: 1,
    unsupported: [{ reason: "flying speed (2× walking) granted until turn end, limited by short rest or Psionic Energy die; speed not modeled", tags: ["speed", "resource-pool"] }],
  },

  "subclass|fighter|psi warrior|telekinetic thrust": {
    name: "Telekinetic Thrust", sv: 1,
    unsupported: [{ reason: "Strength save DC (8 + prof + INT mod) to knock prone or move target; conditional on Psionic Strike", tags: ["conditional-save-effect", "resource-pool"] }],
  },

  "subclass|fighter|psi warrior|guarded mind": {
    name: "Guarded Mind", sv: 1,
    unsupported: [{ reason: "psychic damage resistance; condition-removal (charmed/frightened) using Psionic Energy die", tags: ["resistance", "resource-pool", "condition-removal"] }],
  },

  "subclass|fighter|psi warrior|bulwark of force": {
    name: "Bulwark of Force", sv: 1,
    unsupported: [{ reason: "half cover for multiple creatures (up to INT mod), limited by long rest or Psionic Energy die", tags: ["AC-modifier", "resource-pool"] }],
  },

  "subclass|fighter|psi warrior|telekinetic master": {
    name: "Telekinetic Master", sv: 1,
    unsupported: [{ reason: "cast telekinesis spell (concentration) + bonus-action weapon attack each turn; limited by long rest or Psionic Energy die", tags: ["spell-casting", "attacks", "resource-pool"] }],
  },

  // ----- Purple Dragon Knight (additional) -----
  "subclass|fighter|purple dragon knight (banneret)|rallying cry": {
    name: "Rallying Cry", sv: 1,
    unsupported: [{ reason: "heal up to three allies for Fighter level HP when using Second Wind", tags: ["ally-healing"] }],
  },

  "subclass|fighter|purple dragon knight (banneret)|inspiring surge": {
    name: "Inspiring Surge", sv: 1,
    unsupported: [{ reason: "allow one ally (two at Fighter 18) to make weapon attack as reaction when you use Action Surge", tags: ["ally-action", "action-economy"] }],
  },

  "subclass|fighter|purple dragon knight (banneret)|bulwark": {
    name: "Bulwark", sv: 1,
    unsupported: [{ reason: "allow one ally to reroll a failed save against the same effect when you use Indomitable", tags: ["ally-save-reroll"] }],
  },

  // ----- Samurai (additional) -----
  "subclass|fighter|samurai|tireless spirit": {
    name: "Tireless Spirit", sv: 1,
    unsupported: [{ reason: "regain one use of Fighting Spirit when rolling initiative with no uses remaining", tags: ["initiative-trigger", "resource-recharge"] }],
  },

  "subclass|fighter|samurai|rapid strike": {
    name: "Rapid Strike", sv: 1,
    unsupported: [{ reason: "trade advantage on an attack roll for an additional weapon attack", tags: ["attacks", "action-economy"] }],
  },

  "subclass|fighter|samurai|strength before death": {
    name: "Strength before Death", sv: 1,
    unsupported: [{ reason: "at 0 HP, delay unconsciousness to take an immediate extra turn; resource-limited (once per long rest)", tags: ["death-prevention", "turn-economy"] }],
  },
});
