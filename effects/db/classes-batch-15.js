/* Rogue class + Roguish Archetype subclass features.

   Sneak Attack is deliberately `unsupported` rather than an adddice effect:
   its die *count* scales with rogue level (ceil(level/2)d6) and `adddice`
   takes a literal string, so there's no way to express a computed number of
   dice. Same reason Psychic Blades / Dreadful Strikes are unsupported in the
   bard and ranger batches — this is the single biggest recurring gap in
   class coverage. */
(function () {
  const SKILLS = ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history",
    "insight", "intimidation", "investigation", "medicine", "nature", "perception",
    "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"];

  registerEffects({
    // ===== Rogue (base class) =====
    "class|rogue|expertise": {
      name: "Expertise", sv: 1,
      choices: [
        { id: "exp1a", kind: "pick", n: 1, options: SKILLS, label: "Expertise 1 (1st level)" },
        { id: "exp1b", kind: "pick", n: 1, options: SKILLS, label: "Expertise 2 (1st level)" },
        { id: "exp6a", kind: "pick", n: 1, options: SKILLS, label: "Expertise 3 (6th level)" },
        { id: "exp6b", kind: "pick", n: 1, options: SKILLS, label: "Expertise 4 (6th level)" },
      ],
      effects: [
        { target: "skill-{choice:exp1a}", op: "expertise", activation: { kind: "choice", choice: "exp1a" } },
        { target: "skill-{choice:exp1b}", op: "expertise", activation: { kind: "choice", choice: "exp1b" } },
        { target: "skill-{choice:exp6a}", op: "expertise", activation: { kind: "choice", choice: "exp6a" }, when: { minLevel: 6 } },
        { target: "skill-{choice:exp6b}", op: "expertise", activation: { kind: "choice", choice: "exp6b" }, when: { minLevel: 6 } },
        { target: "skill-sleightofhand", op: "note", text: "a pick may be spent on thieves' tools instead of a skill; tools have no row here" },
      ],
    },

    "class|rogue|sneak attack": {
      name: "Sneak Attack", sv: 1,
      // ceil(rogue level / 2)d6, as a computed dice count. A toggle rather than always-on: Sneak
      // Attack needs advantage or an ally adjacent, and applies once per turn — conditions the sheet
      // can't see, so you say when it lands.
      effects: [
        { target: "damage-bonus", op: "adddice",
          value: { count: { ceil: { div: [{ level: "class", class: "Rogue" }, 2] } }, die: "d6" },
          activation: { kind: "toggle", id: "sneak-attack", label: "Sneak Attack", default: false } },
        { target: "damage-bonus", op: "note", text: "once per turn, with advantage or an ally within 5 ft of the target" },
      ],
    },

    "class|rogue|steady aim": {
      name: "Steady Aim", sv: 1,
      effects: [
        { target: "attack-hit", op: "adv",
          activation: { kind: "toggle", id: "steady-aim", label: "Steady Aim", default: false } },
        { target: "attack-hit", op: "note", text: "only if you haven't moved this turn; your speed becomes 0 afterwards" },
      ],
    },

    "class|rogue|uncanny dodge": {
      name: "Uncanny Dodge", sv: 1,
      unsupported: [{ reason: "reaction to halve an attack's damage; no incoming-damage model", tags: ["damage", "reaction"] }],
    },

    "class|rogue|evasion": {
      name: "Evasion", sv: 1,
      unsupported: [{ reason: "no damage on a successful DEX save against area effects; no damage-halving model", tags: ["damage", "saves"] }],
    },

    "class|rogue|reliable talent": {
      name: "Reliable Talent", sv: 1,
      // "check-proficient" is every check you add your proficiency bonus to — the rule's own
      // precondition — so this doesn't have to be restated per skill. dice.js turns it into the
      // roller's `mi` operator, so the floor shows in the rolled dice rather than adjusting a total.
      effects: [{ target: "check-proficient", op: "diefloor", value: 10 }],
    },

    "class|rogue|slippery mind": {
      name: "Slippery Mind", sv: 1,
      effects: [{ target: "save-wis", op: "prof" }],
    },

    // ===== Arcane Trickster =====
    "subclass|rogue|arcane trickster|versatile trickster": {
      name: "Versatile Trickster", sv: 1,
      effects: [
        { target: "attack-hit", op: "adv",
          activation: { kind: "toggle", id: "versatile-trickster", label: "Versatile Trickster", default: false } },
        { target: "attack-hit", op: "note", text: "against a creature distracted by your mage hand, until end of turn" },
      ],
    },

    // ===== Assassin =====
    "subclass|rogue|assassin|assassinate": {
      name: "Assassinate", sv: 1,
      effects: [
        { target: "attack-hit", op: "adv",
          activation: { kind: "toggle", id: "assassinate", label: "Assassinate", default: false } },
        { target: "attack-hit", op: "note", text: "against any creature that hasn't taken a turn yet; hits on a surprised creature are critical" },
      ],
    },

    "subclass|rogue|assassin|bonus proficiencies": {
      name: "Bonus Proficiencies", sv: 1,
      unsupported: [{ reason: "disguise kit and poisoner's kit proficiency; no proficiencies module", tags: ["proficiency", "tools"] }],
    },

    "subclass|rogue|assassin|death strike": {
      name: "Death Strike", sv: 1,
      unsupported: [{ reason: "doubles the damage of an attack against a surprised creature that fails a CON save; no damage-doubling model", tags: ["damage"] }],
    },

    // ===== Thief =====
    "subclass|rogue|thief|supreme sneak": {
      name: "Supreme Sneak", sv: 1,
      effects: [
        { target: "skill-stealth", op: "adv",
          activation: { kind: "toggle", id: "supreme-sneak", label: "Supreme Sneak", default: false } },
        { target: "skill-stealth", op: "note", text: "only if you move no more than half your speed this turn" },
      ],
    },

    // ===== Phantom =====
    "subclass|rogue|phantom|whispers of the dead": {
      name: "Whispers of the Dead", sv: 1,
      choices: [{ id: "whisperskill", kind: "pick", n: 1, options: SKILLS, label: "Borrowed proficiency" }],
      effects: [
        { target: "skill-{choice:whisperskill}", op: "prof", activation: { kind: "choice", choice: "whisperskill" } },
        { target: "skill-perception", op: "note", text: "re-chosen on each short or long rest; may be a tool proficiency instead, which has no row here" },
      ],
    },

    // ===== Soulknife =====
    "subclass|rogue|soulknife|psionic power": {
      name: "Psionic Power", sv: 1,
      uses: { max: { mul: [2, { prof: true }] }, per: "lr" },
      unsupported: [{ reason: "one die also returns as a bonus action once per short rest; the uses tracker only models full-pool recharge", tags: ["uses", "partial-recharge"] }],
    },

    "subclass|rogue|soulknife|psi-bolstered knack": {
      name: "Psi-Bolstered Knack", sv: 1,
      unsupported: [{ reason: "add a Psionic Energy die to a failed ability check after the roll; no post-hoc roll modification", tags: ["skills", "resource"] }],
    },

    // ===== Inquisitive =====
    "subclass|rogue|inquisitive|ear for deceit": {
      name: "Ear for Deceit", sv: 1,
      // The floor is unconditional on the sheet, but the rule limits it to Insight checks made to
      // detect a lie — a purpose the sheet can't see — so the note carries that half.
      effects: [
        { target: "skill-insight", op: "diefloor", value: 8 },
        { target: "skill-insight", op: "note", text: "the floor applies only to Insight checks made to detect a lie" },
      ],
    },

    "subclass|rogue|inquisitive|steady eye": {
      name: "Steady Eye", sv: 1,
      effects: [
        { target: "skill-perception", op: "adv",
          activation: { kind: "toggle", id: "steady-eye", label: "Steady Eye", default: false } },
        { target: "skill-investigation", op: "adv",
          activation: { kind: "toggle", id: "steady-eye", label: "Steady Eye", default: false } },
        { target: "skill-perception", op: "note", text: "only if you move no more than half your speed this turn" },
      ],
    },

    "subclass|rogue|inquisitive|eye for weakness": {
      name: "Eye for Weakness", sv: 1,
      unsupported: [{ reason: "+3d6 Sneak Attack damage against your Insightful Fighting target; Sneak Attack itself isn't modeled", tags: ["damage"] }],
    },

    // ===== Mastermind =====
    "subclass|rogue|mastermind|master of intrigue": {
      name: "Master of Intrigue", sv: 1,
      unsupported: [{ reason: "disguise kit, forgery kit, gaming set and language proficiencies; no proficiencies module", tags: ["proficiency", "tools"] }],
    },

    // ===== Scout =====
    "subclass|rogue|scout|survivalist": {
      name: "Survivalist", sv: 1,
      effects: [
        { target: "skill-nature", op: "prof" },
        { target: "skill-nature", op: "expertise" },
        { target: "skill-survival", op: "prof" },
        { target: "skill-survival", op: "expertise" },
      ],
    },

    "subclass|rogue|scout|superior mobility": {
      name: "Superior Mobility", sv: 1,
      effects: [{ target: "speed", op: "add", value: 10 }],
      effects: [
        { target: "speed-climb", op: "tag", value: "+10 ft, if you have one" },
        { target: "speed-swim", op: "tag", value: "+10 ft, if you have one" },
      ],
    },

    "subclass|rogue|scout|ambush master": {
      name: "Ambush Master", sv: 1,
      effects: [{ target: "init", op: "adv" }],
    },

    "subclass|rogue|scout|sudden strike": {
      name: "Sudden Strike", sv: 1,
      unsupported: [{ reason: "an extra bonus-action attack; action economy isn't modeled", tags: ["attacks", "action-economy"] }],
    },

    // ===== Swashbuckler =====
    "subclass|rogue|swashbuckler|rakish audacity": {
      name: "Rakish Audacity", sv: 1,
      effects: [
        { target: "init", op: "add", value: { mod: "cha" } },
        { target: "init", op: "note", text: "also enables Sneak Attack in single combat without advantage" },
      ],
    },

    "subclass|rogue|swashbuckler|elegant maneuver": {
      name: "Elegant Maneuver", sv: 1,
      effects: [
        { target: "skill-acrobatics", op: "adv",
          activation: { kind: "toggle", id: "elegant-maneuver", label: "Elegant Maneuver", default: false } },
        { target: "skill-athletics", op: "adv",
          activation: { kind: "toggle", id: "elegant-maneuver", label: "Elegant Maneuver", default: false } },
      ],
    },

    "subclass|rogue|swashbuckler|master duelist": {
      name: "Master Duelist", sv: 1,
      uses: { max: 1, per: "sr" },
      unsupported: [{ reason: "reroll a missed attack with advantage; no post-hoc roll modification", tags: ["attacks", "reroll"] }],
    },
  });
})();
