/* Ranger class + Ranger Archetype subclass features.

   Gloom Stalker's Dread Ambusher (+WIS to initiative) and Fey Wanderer's
   Otherworldly Glamour (+WIS to Charisma checks) are the two headline
   automatable rangers features; most of the rest of the class is either
   terrain/creature-type conditional (which the engine has no predicate for)
   or companion statblocks, which live outside this sheet entirely. */
(function () {
  const SKILLS = ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history",
    "insight", "intimidation", "investigation", "medicine", "nature", "perception",
    "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"];

  registerEffects({
    // ===== Ranger (base class) =====
    "class|ranger|deft explorer": {
      name: "Deft Explorer", sv: 1,
      choices: [{ id: "canny", kind: "pick", n: 1, options: SKILLS, label: "Canny expertise" }],
      effects: [
        { target: "skill-{choice:canny}", op: "expertise", activation: { kind: "choice", choice: "canny" } },
      ],
    },

    "class|ranger|natural explorer": {
      name: "Natural Explorer", sv: 1,
      unsupported: [{ reason: "doubled proficiency on INT/WIS checks tied to your favored terrain; no terrain predicate", tags: ["conditional", "skills"] }],
    },

    "class|ranger|favored enemy": {
      name: "Favored Enemy", sv: 1,
      unsupported: [{ reason: "advantage on Survival to track and INT checks to recall lore about one creature type; no creature-type predicate", tags: ["conditional", "skills"] }],
    },

    "class|ranger|fighting style": {
      name: "Fighting Style", sv: 1,
      unsupported: [{ reason: "Fighting Style options live in 5e.tools' optional-features file, which isn't imported yet", tags: ["optional-features"] }],
    },

    "class|ranger|extra attack": {
      name: "Extra Attack", sv: 1,
      unsupported: [{ reason: "a second attack on the Attack action; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    "class|ranger|land's stride": {
      name: "Land's Stride", sv: 1,
      unsupported: [{ reason: "advantage on saves against magically created plants; conditional advantage isn't modeled per-ability", tags: ["advantage", "conditional"] }],
    },

    "class|ranger|hide in plain sight": {
      name: "Hide in Plain Sight", sv: 1,
      effects: [
        { target: "skill-stealth", op: "add", value: 10,
          activation: { kind: "toggle", id: "hide-in-plain-sight", label: "Hide in Plain Sight (+10)", default: false } },
        { target: "skill-stealth", op: "note", text: "only while camouflaged and not moving or taking an action" },
      ],
    },

    "class|ranger|feral senses": {
      name: "Feral Senses", sv: 1,
      unsupported: [{ reason: "no disadvantage on attacks against creatures you can't see; per-circumstance attack modes aren't modeled", tags: ["attacks", "conditional"] }],
    },

    "class|ranger|foe slayer": {
      name: "Foe Slayer", sv: 1,
      effects: [
        { target: "attack-hit", op: "add", value: { mod: "wis" },
          activation: { kind: "toggle", id: "foe-slayer", label: "Foe Slayer", default: false } },
        { target: "attack-hit", op: "note", text: "once per turn, against a favored enemy; may be applied to the damage roll instead" },
      ],
    },

    // ===== Hunter =====
    "subclass|ranger|hunter|colossus slayer": {
      name: "Colossus Slayer", sv: 1,
      effects: [
        { target: "damage-bonus", op: "adddice", value: "1d8",
          activation: { kind: "toggle", id: "colossus-slayer", label: "Colossus Slayer", default: false } },
        { target: "damage-bonus", op: "note", text: "once per turn, against a target below its hit point maximum" },
      ],
    },

    "subclass|ranger|hunter|horde breaker": {
      name: "Horde Breaker", sv: 1,
      unsupported: [{ reason: "an extra weapon attack against a second nearby creature; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    "subclass|ranger|hunter|multiattack defense": {
      name: "Multiattack Defense", sv: 1,
      unsupported: [{ reason: "+4 AC against a creature's subsequent attacks; AC isn't an effects target", tags: ["ac", "conditional"] }],
    },

    "subclass|ranger|hunter|steel will": {
      name: "Steel Will", sv: 1,
      unsupported: [{ reason: "advantage on saves against being frightened; conditional advantage isn't modeled per-ability", tags: ["advantage", "condition"] }],
    },

    "subclass|ranger|hunter|volley": {
      name: "Volley", sv: 1,
      unsupported: [{ reason: "a ranged attack against any number of creatures in an area; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    "subclass|ranger|hunter|whirlwind attack": {
      name: "Whirlwind Attack", sv: 1,
      unsupported: [{ reason: "a melee attack against any number of creatures within 5 feet; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    "subclass|ranger|hunter|evasion": {
      name: "Evasion", sv: 1,
      unsupported: [{ reason: "no damage on a successful DEX save against area effects; no damage-halving model", tags: ["damage", "saves"] }],
    },

    "subclass|ranger|hunter|uncanny dodge": {
      name: "Uncanny Dodge", sv: 1,
      unsupported: [{ reason: "reaction to halve an attack's damage; no incoming-damage model", tags: ["damage", "reaction"] }],
    },

    // ===== Fey Wanderer =====
    // "Whenever you make a Charisma check" — approximated as the four CHA-based skills, which are
    // the only Charisma checks this sheet has rows for.
    "subclass|ranger|fey wanderer|otherworldly glamour": {
      name: "Otherworldly Glamour", sv: 1,
      choices: [{ id: "glamourskill", kind: "pick", n: 1, options: ["deception", "performance", "persuasion"], label: "Skill proficiency" }],
      effects: [
        { target: "skill-deception", op: "add", value: { max: [{ mod: "wis" }, 1] } },
        { target: "skill-intimidation", op: "add", value: { max: [{ mod: "wis" }, 1] } },
        { target: "skill-performance", op: "add", value: { max: [{ mod: "wis" }, 1] } },
        { target: "skill-persuasion", op: "add", value: { max: [{ mod: "wis" }, 1] } },
        { target: "skill-persuasion", op: "note", text: "applies to any Charisma check, including ones without a skill row here" },
        { target: "skill-{choice:glamourskill}", op: "prof", activation: { kind: "choice", choice: "glamourskill" } },
      ],
    },

    "subclass|ranger|fey wanderer|dreadful strikes": {
      name: "Dreadful Strikes", sv: 1,
      unsupported: [{ reason: "extra psychic damage stepping 1d4 to 1d6 at ranger 11; `when` supports only minLevel, so a level *band* can't be expressed", tags: ["damage", "level-scaling"] }],
    },

    "subclass|ranger|fey wanderer|beguiling twist": {
      name: "Beguiling Twist", sv: 1,
      unsupported: [{ reason: "advantage on saves against being charmed or frightened; conditional advantage isn't modeled per-ability", tags: ["advantage", "condition"] }],
    },

    // ===== Gloom Stalker =====
    "subclass|ranger|gloom stalker|dread ambusher": {
      name: "Dread Ambusher", sv: 1,
      effects: [
        { target: "init", op: "add", value: { mod: "wis" } },
        { target: "init", op: "note", text: "also +10 ft speed and an extra attack on your first turn of combat" },
      ],
    },

    "subclass|ranger|gloom stalker|iron mind": {
      name: "Iron Mind", sv: 1,
      choices: [{ id: "ironsave", kind: "pick", n: 1, options: ["wis", "int", "cha"], label: "Save proficiency" }],
      effects: [
        { target: "save-{choice:ironsave}", op: "prof", activation: { kind: "choice", choice: "ironsave" } },
        { target: "save-wis", op: "note", text: "Wisdom by default; pick Intelligence or Charisma only if you already had Wisdom" },
      ],
    },

    "subclass|ranger|gloom stalker|stalker's flurry": {
      name: "Stalker's Flurry", sv: 1,
      unsupported: [{ reason: "an extra weapon attack on a miss; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    // ===== Monster Slayer =====
    "subclass|ranger|monster slayer|slayer's prey": {
      name: "Slayer's Prey", sv: 1,
      effects: [
        { target: "damage-bonus", op: "adddice", value: "1d6",
          activation: { kind: "toggle", id: "slayers-prey", label: "Slayer's Prey", default: false } },
        { target: "damage-bonus", op: "note", text: "first hit each turn against your designated quarry" },
      ],
    },

    "subclass|ranger|monster slayer|supernatural defense": {
      name: "Supernatural Defense", sv: 1,
      effects: [
        { target: "save-str", op: "adddice", value: "1d6", activation: { kind: "toggle", id: "supernatural-defense", label: "Supernatural Defense", default: false } },
        { target: "save-dex", op: "adddice", value: "1d6", activation: { kind: "toggle", id: "supernatural-defense", label: "Supernatural Defense", default: false } },
        { target: "save-con", op: "adddice", value: "1d6", activation: { kind: "toggle", id: "supernatural-defense", label: "Supernatural Defense", default: false } },
        { target: "save-int", op: "adddice", value: "1d6", activation: { kind: "toggle", id: "supernatural-defense", label: "Supernatural Defense", default: false } },
        { target: "save-wis", op: "adddice", value: "1d6", activation: { kind: "toggle", id: "supernatural-defense", label: "Supernatural Defense", default: false } },
        { target: "save-cha", op: "adddice", value: "1d6", activation: { kind: "toggle", id: "supernatural-defense", label: "Supernatural Defense", default: false } },
        { target: "save-con", op: "note", text: "only against saves forced by the target of your Slayer's Prey" },
      ],
    },

    // ===== Horizon Walker =====
    "subclass|ranger|horizon walker|planar warrior": {
      name: "Planar Warrior", sv: 1,
      unsupported: [{ reason: "extra force damage stepping 1d8 to 2d8 at ranger 11; `when` supports only minLevel, so a level *band* can't be expressed", tags: ["damage", "level-scaling"] }],
    },

    "subclass|ranger|horizon walker|spectral defense": {
      name: "Spectral Defense", sv: 1,
      unsupported: [{ reason: "reaction granting resistance to an attack's damage; no resistances model", tags: ["resistance", "reaction"] }],
    },

    // ===== Swarmkeeper =====
    "subclass|ranger|swarmkeeper|gathered swarm": {
      name: "Gathered Swarm", sv: 1,
      unsupported: [{ reason: "extra damage stepping 1d6 to 1d8 at ranger 11, plus forced movement; `when` supports only minLevel, so a level *band* can't be expressed", tags: ["damage", "level-scaling"] }],
    },
  });
})();
