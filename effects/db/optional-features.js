/* Optional features (data/optionalfeatures.json): Fighting Styles, Eldritch Invocations, Pact
   Boons and Rune Knight runes. Keyed "optfeature|<name>"; each chosen option becomes a feature of
   its own on the Features module, so the class entries that only offer the choice need no entry.
   Options whose benefit is another creature's number, an extra action, or a per-spell change
   (Metamagic, Maneuvers, Arcane Shots, most invocations) are omitted. */
registerEffects({
  // ===== Fighting Styles =====
  "optfeature|archery": {
    name: "Archery", sv: 1,
    effects: [
      { target: "attack-hit", op: "add", value: 2 },
      { target: "attack-hit", op: "note", text: "ranged weapons only" },
    ],
  },
  "optfeature|defense": {
    name: "Defense", sv: 1,
    effects: [{ target: "ac", op: "add", value: 1, when: { notArmor: ["none"] } }],
  },
  "optfeature|dueling": {
    name: "Dueling", sv: 1,
    effects: [
      { target: "damage-bonus", op: "add", value: 2 },
      { target: "damage-bonus", op: "note", text: "melee weapon in one hand and no other weapons" },
    ],
  },
  "optfeature|thrown weapon fighting": {
    name: "Thrown Weapon Fighting", sv: 1,
    effects: [
      { target: "damage-bonus", op: "add", value: 2 },
      { target: "damage-bonus", op: "note", text: "ranged attacks with thrown weapons only" },
    ],
  },
  "optfeature|great weapon fighting": {
    name: "Great Weapon Fighting", sv: 1,
    unsupported: [{ reason: "rerolls 1s and 2s on damage dice of two-handed melee weapons; the roller has no reroll-low-dice rule per weapon", tags: ["per-weapon", "dice"] }],
  },
  "optfeature|two-weapon fighting": {
    name: "Two-Weapon Fighting", sv: 1,
    unsupported: [{ reason: "adds your ability modifier to the off-hand attack's damage; the attack buckets are global, not per weapon", tags: ["per-weapon"] }],
  },
  "optfeature|unarmed fighting": {
    name: "Unarmed Fighting", sv: 1,
    unsupported: [{ reason: "unarmed strikes deal 1d6 (1d8 with both hands free); no unarmed strike model", tags: ["per-weapon"] }],
  },

  // ===== Eldritch Invocations =====
  "optfeature|agonizing blast": {
    name: "Agonizing Blast", sv: 1,
    unsupported: [{ reason: "adds CHA to Eldritch Blast damage; spell damage has no effects target", tags: ["spell-damage"] }],
  },
  "optfeature|armor of shadows": {
    name: "Armor of Shadows", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "mage armor" } }],
  },
  "optfeature|ascendant step": {
    name: "Ascendant Step", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "levitate" } }],
  },
  "optfeature|beast speech": {
    name: "Beast Speech", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "speak with animals" } }],
  },
  "optfeature|beguiling influence": {
    name: "Beguiling Influence", sv: 1,
    effects: [
      { target: "skill-deception", op: "prof" },
      { target: "skill-persuasion", op: "prof" },
    ],
  },
  "optfeature|bewitching whispers": {
    name: "Bewitching Whispers", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "compulsion" } }],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|dreadful word": {
    name: "Dreadful Word", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "confusion" } }],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|devil's sight": {
    name: "Devil's Sight", sv: 1,
    effects: [{ target: "sense-special", op: "tag", value: "Devil's Sight 120 ft (magical darkness too)" }],
  },
  "optfeature|witch sight": {
    name: "Witch Sight", sv: 1,
    effects: [{ target: "sense-special", op: "tag", value: "Witch Sight 30 ft (true forms)" }],
  },
  "optfeature|blind fighting": {
    name: "Blind Fighting", sv: 1,
    effects: [{ target: "sense-blindsight", op: "min", value: 10 }],
  },
  "optfeature|eldritch mind": {
    name: "Eldritch Mind", sv: 1,
    effects: [{ target: "situational-advantage", op: "tag", value: "on Constitution saves to maintain concentration" }],
  },
  "optfeature|eldritch sight": {
    name: "Eldritch Sight", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "detect magic" } }],
  },
  "optfeature|fiendish vigor": {
    name: "Fiendish Vigor", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "false life" } }],
  },
  "optfeature|gift of the depths": {
    name: "Gift of the Depths", sv: 1,
    effects: [
      { target: "speed-swim", op: "tag", value: "equal to your walking speed", equalsWalk: true },
      { target: "spell-grant", op: "grant-innate", value: { name: "water breathing" } },
    ],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|improved pact weapon": {
    name: "Improved Pact Weapon", sv: 1,
    effects: [
      { target: "attack-hit", op: "add", value: 1 },
      { target: "damage-bonus", op: "add", value: 1 },
      { target: "attack-hit", op: "note", text: "pact weapon that isn't already magic" },
    ],
  },
  "optfeature|lifedrinker": {
    name: "Lifedrinker", sv: 1,
    effects: [
      { target: "damage-bonus", op: "add", value: { max: [{ mod: "cha" }, 1] } },
      { target: "damage-bonus", op: "note", text: "pact weapon only; necrotic" },
    ],
  },
  "optfeature|mask of many faces": {
    name: "Mask of Many Faces", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "disguise self" } }],
  },
  "optfeature|master of myriad forms": {
    name: "Master of Myriad Forms", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "alter self" } }],
  },
  "optfeature|minions of chaos": {
    name: "Minions of Chaos", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "conjure elemental" } }],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|mire the mind": {
    name: "Mire the Mind", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "slow" } }],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|misty visions": {
    name: "Misty Visions", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "silent image" } }],
  },
  "optfeature|otherworldly leap": {
    name: "Otherworldly Leap", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "jump" } }],
  },
  "optfeature|sculptor of flesh": {
    name: "Sculptor of Flesh", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "polymorph" } }],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|shroud of shadow": {
    name: "Shroud of Shadow", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "invisibility" } }],
  },
  "optfeature|sign of ill omen": {
    name: "Sign of Ill Omen", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "bestow curse" } }],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|thief of five fates": {
    name: "Thief of Five Fates", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "bane" } }],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|trickster's escape": {
    name: "Trickster's Escape", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "freedom of movement" } }],
    uses: { max: 1, per: "lr" },
  },
  "optfeature|visions of distant realms": {
    name: "Visions of Distant Realms", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "arcane eye" } }],
  },
  "optfeature|whispers of the grave": {
    name: "Whispers of the Grave", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "speak with dead" } }],
  },
  "optfeature|tomb of levistus": {
    name: "Tomb of Levistus", sv: 1,
    unsupported: [{ reason: "temporary hit points and vulnerability to fire while encased; no temporary HP model", tags: ["temp-hp"] }],
    uses: { max: 1, per: "sr" },
  },

  // ===== Pact Boons =====
  "optfeature|pact of the chain": {
    name: "Pact of the Chain", sv: 1,
    effects: [{ target: "spell-grant", op: "grant-free", value: { name: "find familiar" } }],
  },

  // ===== Rune Knight runes =====
  "optfeature|cloud rune": {
    name: "Cloud Rune", sv: 1,
    effects: [
      { target: "skill-sleightofhand", op: "adv" },
      { target: "skill-deception", op: "adv" },
    ],
    uses: { max: 1, per: "sr" },
  },
  "optfeature|fire rune": {
    name: "Fire Rune", sv: 1,
    uses: { max: 1, per: "sr" },
  },
  "optfeature|frost rune": {
    name: "Frost Rune", sv: 1,
    effects: [
      { target: "skill-animalhandling", op: "adv" },
      { target: "skill-intimidation", op: "adv" },
    ],
    uses: { max: 1, per: "sr" },
  },
  "optfeature|hill rune": {
    name: "Hill Rune", sv: 1,
    effects: [
      { target: "save-vs-poisoned", op: "tag", value: "poisoned" },
      { target: "resist-poison", op: "tag", value: "poison" },
    ],
    uses: { max: 1, per: "sr" },
  },
  "optfeature|stone rune": {
    name: "Stone Rune", sv: 1,
    effects: [
      { target: "skill-insight", op: "adv" },
      { target: "sense-darkvision", op: "min", value: 120 },
    ],
    uses: { max: 1, per: "sr" },
  },
  "optfeature|storm rune": {
    name: "Storm Rune", sv: 1,
    effects: [
      { target: "skill-arcana", op: "adv" },
      { target: "init", op: "note", text: "can't be surprised while not incapacitated" },
    ],
    uses: { max: 1, per: "sr" },
  },
});
