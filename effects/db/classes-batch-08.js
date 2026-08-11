// Cleric domains (part 4): Tempest, Trickery, Twilight, War, Zeal
registerEffects({
  // ----- TEMPEST DOMAIN -----
  "subclass|cleric|tempest domain|wrath of the storm": {
    name: "Wrath of the Storm", sv: 1,
    uses: { max: { max: [{ mod: "wis" }, 1] }, per: "lr" },
    unsupported: [{ reason: "reaction damage on save; requires attack/damage roll tracking", tags: ["damage", "reaction"] }],
  },
  "subclass|cleric|tempest domain|channel divinity: destructive wrath": {
    name: "Channel Divinity: Destructive Wrath", sv: 1,
    unsupported: [{ reason: "requires damage roll tracking to maximize dice rolls", tags: ["damage", "reroll"] }],
  },
  "subclass|cleric|tempest domain|thunderbolt strike": {
    name: "Thunderbolt Strike", sv: 1,
    unsupported: [{ reason: "requires damage roll tracking and creature-size checks", tags: ["damage", "condition"] }],
  },
  "subclass|cleric|tempest domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; radiant" },
    ],
    unsupported: [{ reason: "the same 1d8 also rides on your cantrips; no cantrip-damage target", tags: ["cantrip-damage"] }],
  },
  "subclass|cleric|tempest domain|divine strike": {
    name: "Divine Strike", sv: 1,
    effects: [
      // 1d8 at 8th, 2d8 at 14th — the second effect is the *increment*, since adddice accumulates.
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "adddice", value: "1d8", when: { minLevel: 14 } },
      { target: "damage-bonus", op: "note", text: "once per turn, on a weapon hit" },
    ],
  },
  "subclass|cleric|tempest domain|stormborn": {
    name: "Stormborn", sv: 1,
    unsupported: [{ reason: "flying speed not modeled", tags: ["movement"] }],
  },

  // ----- TRICKERY DOMAIN -----
  "subclass|cleric|trickery domain|blessing of the trickster": {
    name: "Blessing of the Trickster", sv: 1,
    unsupported: [{ reason: "temporary buff with 1-hour duration; requires action activation and one-time advantage on skill check", tags: ["buff", "advantage"] }],
  },
  "subclass|cleric|trickery domain|channel divinity: invoke duplicity": {
    name: "Channel Divinity: Invoke Duplicity", sv: 1,
    unsupported: [{ reason: "illusory duplicate not modeled; conditional advantage on attack rolls based on positioning", tags: ["illusion", "advantage"] }],
  },
  "subclass|cleric|trickery domain|channel divinity: cloak of shadows": {
    name: "Channel Divinity: Cloak of Shadows", sv: 1,
    unsupported: [{ reason: "invisibility condition not modeled", tags: ["condition"] }],
  },
  "subclass|cleric|trickery domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; radiant" },
    ],
    unsupported: [{ reason: "the same 1d8 also rides on your cantrips; no cantrip-damage target", tags: ["cantrip-damage"] }],
  },
  "subclass|cleric|trickery domain|divine strike": {
    name: "Divine Strike", sv: 1,
    effects: [
      // 1d8 at 8th, 2d8 at 14th — the second effect is the *increment*, since adddice accumulates.
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "adddice", value: "1d8", when: { minLevel: 14 } },
      { target: "damage-bonus", op: "note", text: "once per turn, on a weapon hit" },
    ],
  },
  "subclass|cleric|trickery domain|improved duplicity": {
    name: "Improved Duplicity", sv: 1,
    unsupported: [{ reason: "illusory duplicates not modeled; scales from 1 to 4 copies", tags: ["illusion", "scaling"] }],
  },

  // ----- TWILIGHT DOMAIN -----
  "subclass|cleric|twilight domain|bonus proficiencies": {
    name: "Bonus Proficiencies", sv: 1,
    unsupported: [{ reason: "weapon and armor proficiency not modeled", tags: ["proficiency"] }],
  },
  "subclass|cleric|twilight domain|eyes of night": {
    name: "Eyes of Night", sv: 1,
    unsupported: [{ reason: "darkvision not modeled; spell-slot-contingent uses (to share) not modeled", tags: ["vision", "resource"] }],
  },
  "subclass|cleric|twilight domain|vigilant blessing": {
    name: "Vigilant Blessing", sv: 1,
    unsupported: [{ reason: "one-time initiative advantage per target; requires per-usage activation tracking", tags: ["advantage"] }],
  },
  "subclass|cleric|twilight domain|channel divinity: twilight sanctuary": {
    name: "Channel Divinity: Twilight Sanctuary", sv: 1,
    unsupported: [{ reason: "aura effect with multiple conditional bonuses (temp HP, condition removal) not modeled", tags: ["aura", "buff"] }],
  },
  "subclass|cleric|twilight domain|steps of night": {
    name: "Steps of Night", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    effects: [
      { target: "speed-fly", op: "tag", value: "equal to your walking speed" },
      { target: "speed-fly", op: "note", text: "a bonus action, in dim light or darkness, for 1 minute" },
    ],
  },
  "subclass|cleric|twilight domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; radiant" },
    ],
    unsupported: [{ reason: "the same 1d8 also rides on your cantrips; no cantrip-damage target", tags: ["cantrip-damage"] }],
  },
  "subclass|cleric|twilight domain|divine strike": {
    name: "Divine Strike", sv: 1,
    effects: [
      // 1d8 at 8th, 2d8 at 14th — the second effect is the *increment*, since adddice accumulates.
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "adddice", value: "1d8", when: { minLevel: 14 } },
      { target: "damage-bonus", op: "note", text: "once per turn, on a weapon hit" },
    ],
  },
  "subclass|cleric|twilight domain|twilight shroud": {
    name: "Twilight Shroud", sv: 1,
    unsupported: [{ reason: "half cover within aura not modeled", tags: ["ac"] }],
  },

  // ----- WAR DOMAIN -----
  "subclass|cleric|war domain|bonus proficiencies": {
    name: "Bonus Proficiencies", sv: 1,
    unsupported: [{ reason: "weapon and armor proficiency not modeled", tags: ["proficiency"] }],
  },
  "subclass|cleric|war domain|war priest": {
    name: "War Priest", sv: 1,
    uses: { max: { max: [{ mod: "wis" }, 1] }, per: "lr" },
    unsupported: [{ reason: "extra bonus action attack not modeled", tags: ["attack"] }],
  },
  "subclass|cleric|war domain|channel divinity: guided strike": {
    name: "Channel Divinity: Guided Strike", sv: 1,
    effects: [
      // Same shape as Oath of Conquest's Guided Strike (classes-batch-13.js): a toggle, since the
      // +10 is applied after you see the roll and costs a Channel Divinity use.
      { target: "attack-hit", op: "add", value: 10, activation: { kind: "toggle", id: "guided-strike", label: "Guided Strike (+10)", default: false } },
      { target: "attack-hit", op: "note", text: "one attack roll, spending a Channel Divinity use; declared after you see the roll" },
    ],
  },
  "subclass|cleric|war domain|channel divinity: war god's blessing": {
    name: "Channel Divinity: War God's Blessing", sv: 1,
    unsupported: [{ reason: "grants +10 to ally's attack roll as reaction; requires attack roll tracking and post-hoc modification", tags: ["attack"] }],
  },
  "subclass|cleric|war domain|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; radiant" },
    ],
    unsupported: [{ reason: "the same 1d8 also rides on your cantrips; no cantrip-damage target", tags: ["cantrip-damage"] }],
  },
  "subclass|cleric|war domain|divine strike": {
    name: "Divine Strike", sv: 1,
    effects: [
      // 1d8 at 8th, 2d8 at 14th — the second effect is the *increment*, since adddice accumulates.
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "adddice", value: "1d8", when: { minLevel: 14 } },
      { target: "damage-bonus", op: "note", text: "once per turn, on a weapon hit" },
    ],
  },
  "subclass|cleric|war domain|avatar of battle": {
    name: "Avatar of Battle", sv: 1,
    effects: [
      { target: "resist-bludgeoning, piercing and slashing", op: "tag", value: "nonmagical" },
      { target: "resist-bludgeoning, piercing and slashing", op: "note", text: "from nonmagical attacks" },
    ],
  },

  // ----- ZEAL DOMAIN (PSA) -----
  "subclass|cleric|zeal domain (psa)|bonus proficiencies": {
    name: "Bonus Proficiencies", sv: 1,
    unsupported: [{ reason: "weapon and armor proficiency not modeled", tags: ["proficiency"] }],
  },
  "subclass|cleric|zeal domain (psa)|priest of zeal": {
    name: "Priest of Zeal", sv: 1,
    uses: { max: { max: [{ mod: "wis" }, 1] }, per: "lr" },
    unsupported: [{ reason: "extra bonus action attack not modeled", tags: ["attack"] }],
  },
  "subclass|cleric|zeal domain (psa)|channel divinity: consuming fervor": {
    name: "Channel Divinity: Consuming Fervor", sv: 1,
    unsupported: [{ reason: "requires damage roll tracking to maximize dice rolls", tags: ["damage", "reroll"] }],
  },
  "subclass|cleric|zeal domain (psa)|resounding strike": {
    name: "Resounding Strike", sv: 1,
    unsupported: [{ reason: "requires damage roll tracking and creature-size checks", tags: ["damage", "condition"] }],
  },
  "subclass|cleric|zeal domain (psa)|blessed strikes": {
    name: "Blessed Strikes", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "note", text: "once per turn, on a hit; radiant" },
    ],
    unsupported: [{ reason: "the same 1d8 also rides on your cantrips; no cantrip-damage target", tags: ["cantrip-damage"] }],
  },
  "subclass|cleric|zeal domain (psa)|divine strike": {
    name: "Divine Strike", sv: 1,
    effects: [
      // 1d8 at 8th, 2d8 at 14th — the second effect is the *increment*, since adddice accumulates.
      { target: "damage-bonus", op: "adddice", value: "1d8" },
      { target: "damage-bonus", op: "adddice", value: "1d8", when: { minLevel: 14 } },
      { target: "damage-bonus", op: "note", text: "once per turn, on a weapon hit" },
    ],
  },
  "subclass|cleric|zeal domain (psa)|blaze of glory": {
    name: "Blaze of Glory", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "triggered on 0 HP; extra melee attack with massive dice damage; requires death-tracking mechanics", tags: ["attack", "death"] }],
  },
});
