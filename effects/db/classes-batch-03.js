// Barbarian class features (base + subclass) batch 03
registerEffects({
  "class|barbarian|rage": {
    name: "Rage", sv: 1,
    effects: [
      { target: "save-str", op: "adv", activation: { kind: "toggle", id: "rage", label: "Raging", default: false } },
      { target: "damage-bonus", op: "add", value: 2, activation: { kind: "toggle", id: "rage", label: "Raging", default: false } },
    ],
    uses: { max: 2, per: "lr" },
    unsupported: [
      { reason: "resistance to bludgeoning/piercing/slashing while raging", tags: ["resistance", "conditional"] },
      { reason: "can't cast spells or concentrate on spells while raging", tags: ["spellcasting"] },
      { reason: "damage bonus and uses count scale at class levels 3/6/9/12/16/17", tags: ["scaling-uses", "scaling-effect"] },
    ],
  },

  "class|barbarian|unarmored defense": {
    name: "Unarmored Defense", sv: 1,
    unsupported: [
      { reason: "AC calculation (10 + DEX mod + CON mod) not modeled", tags: ["AC"] },
    ],
  },

  "class|barbarian|danger sense": {
    name: "Danger Sense", sv: 1,
    effects: [
      { target: "save-dex", op: "adv" },
      { target: "save-dex", op: "note", text: "only vs. visible effects; not while blinded/deafened/incapacitated" },
    ],
  },

  "class|barbarian|reckless attack": {
    name: "Reckless Attack", sv: 1,
    effects: [
      { target: "attack-hit", op: "adv", activation: { kind: "toggle", id: "reckless", label: "Reckless Attack", default: false } },
      { target: "attack-hit", op: "note", text: "melee/Strength only; first attack per turn; enemies get advantage against you until your next turn" },
    ],
    unsupported: [
      { reason: "enemy attack rolls against you gain advantage until next turn", tags: ["AC", "conditional"] },
    ],
  },

  "class|barbarian|primal knowledge": {
    name: "Primal Knowledge", sv: 1,
    choices: [
      { id: "skill-3", kind: "pick", n: 1, options: ["animalhandling", "athletics", "intimidation", "nature", "perception", "survival"], label: "Skill proficiency (3rd level)" },
      { id: "skill-10", kind: "pick", n: 1, options: ["animalhandling", "athletics", "intimidation", "nature", "perception", "survival"], label: "Skill proficiency (10th level)" },
    ],
    effects: [
      { target: "skill-{choice:skill-3}", op: "prof", activation: { kind: "choice", choice: "skill-3" } },
      { target: "skill-{choice:skill-10}", op: "prof", activation: { kind: "choice", choice: "skill-10" }, when: { minLevel: 10 } },
    ],
  },

  "class|barbarian|extra attack": {
    name: "Extra Attack", sv: 1,
    unsupported: [
      { reason: "extra melee attack action requires attacks/weapons module", tags: ["attack", "action-economy"] },
    ],
  },

  "class|barbarian|fast movement": {
    name: "Fast Movement", sv: 1,
    unsupported: [
      { reason: "speed increase target not yet supported", tags: ["speed"] },
    ],
  },

  "class|barbarian|feral instinct": {
    name: "Feral Instinct", sv: 1,
    effects: [
      { target: "init", op: "adv" },
    ],
    unsupported: [
      { reason: "act normally on first turn when surprised (requires entering rage first)", tags: ["surprise", "action-economy"] },
    ],
  },

  "class|barbarian|instinctive pounce": {
    name: "Instinctive Pounce", sv: 1,
    unsupported: [
      { reason: "bonus movement as part of rage bonus action; speed not modeled", tags: ["speed", "action-economy"] },
    ],
  },

  "class|barbarian|brutal critical (1 die)": {
    name: "Brutal Critical (1 die)", sv: 1,
    unsupported: [
      { reason: "extra weapon damage die on critical hit; requires weapon die integration; scales at levels 13/17", tags: ["crit", "weapon", "damage-die", "scaling"] },
    ],
  },

  "class|barbarian|relentless rage": {
    name: "Relentless Rage", sv: 1,
    unsupported: [
      { reason: "save to avoid dropping to 0 HP while raging; DC increases on re-use; requires roll history and state tracking", tags: ["death-save", "resource", "DC-scaling"] },
    ],
  },

  "class|barbarian|brutal critical (2 dice)": {
    name: "Brutal Critical (2 dice)", sv: 1,
    unsupported: [
      { reason: "extra weapon damage dice on critical hit; requires weapon die integration; scales at level 17", tags: ["crit", "weapon", "damage-die", "scaling"] },
    ],
  },

  "class|barbarian|brutal critical (3 dice)": {
    name: "Brutal Critical (3 dice)", sv: 1,
    unsupported: [
      { reason: "extra weapon damage dice on critical hit; requires weapon die integration", tags: ["crit", "weapon", "damage-die"] },
    ],
  },

  "class|barbarian|indomitable might": {
    name: "Indomitable Might", sv: 1,
    unsupported: [
      { reason: "replace ability check total with raw ability score; ability checks not modeled as a target", tags: ["ability-check"] },
    ],
  },

  "class|barbarian|primal champion": {
    name: "Primal Champion", sv: 1,
    effects: [
      { target: "score-str", op: "add", value: 4 },
      { target: "score-str", op: "max", value: 24 },
      { target: "score-con", op: "add", value: 4 },
      { target: "score-con", op: "max", value: 24 },
    ],
  },

  "subclass|barbarian|path of the ancestral guardian|ancestral protectors": {
    name: "Ancestral Protectors", sv: 1,
    unsupported: [
      { reason: "mark creature hit as target; apply disadvantage on attacks vs. others; requires attack/target tracking", tags: ["attack", "target-marking", "conditional-adv"] },
    ],
  },

  "subclass|barbarian|path of the ancestral guardian|spirit shield": {
    name: "Spirit Shield", sv: 1,
    unsupported: [
      { reason: "reaction to reduce damage by 2d6 (3d6 at level 10, 4d6 at level 14); requires damage roll tracking and reaction mechanics", tags: ["reaction", "damage-reduction", "scaling"] },
    ],
  },

  "subclass|barbarian|path of the ancestral guardian|consult the spirits": {
    name: "Consult the Spirits", sv: 1,
    uses: { max: 1, per: "sr" },
    unsupported: [
      { reason: "cast augury/clairvoyance spell without slot; spellcasting not tracked mechanically", tags: ["spellcasting"] },
    ],
  },

  "subclass|barbarian|path of the ancestral guardian|vengeful ancestors": {
    name: "Vengeful Ancestors", sv: 1,
    unsupported: [
      { reason: "reaction trigger: attacker takes force damage equal to damage reduced by Spirit Shield", tags: ["reaction", "damage", "conditional"] },
    ],
  },

  "subclass|barbarian|path of the battlerager|battlerager armor": {
    name: "Battlerager Armor", sv: 1,
    unsupported: [
      { reason: "bonus action melee attack with armor spikes (1d4 piercing) + grapple bonus damage (3 piercing); requires attack tracking", tags: ["attack", "grapple"] },
    ],
  },

  "subclass|barbarian|path of the battlerager|reckless abandon": {
    name: "Reckless Abandon", sv: 1,
    unsupported: [
      { reason: "temporary hit points while using Reckless Attack; temporary HP not tracked as a stat", tags: ["temp-hp"] },
    ],
  },

  "subclass|barbarian|path of the battlerager|spiked retribution": {
    name: "Spiked Retribution", sv: 1,
    unsupported: [
      { reason: "reaction: attacker takes 3 piercing damage when hitting you in melee while you're raging and wearing spiked armor", tags: ["reaction", "damage", "conditional"] },
    ],
  },

  "subclass|barbarian|path of the beast|form of the beast": {
    name: "Form of the Beast", sv: 1,
    unsupported: [
      { reason: "manifest natural weapon form while raging; requires weapon/attack module", tags: ["weapon", "natural-attack"] },
    ],
  },

  "subclass|barbarian|path of the beast|bestial soul": {
    name: "Bestial Soul", sv: 1,
    unsupported: [
      { reason: "natural weapons count as magical + adaptive forms (swim/climb/jump benefits); speed increases not modeled", tags: ["weapon", "speed", "conditional-benefit"] },
    ],
  },

  "subclass|barbarian|path of the beast|infectious fury": {
    name: "Infectious Fury", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [
      { reason: "Wisdom save triggers one of: forced melee attack on ally / 2d12 psychic damage; requires save effect and target-forcing mechanics", tags: ["save-effect", "forced-action"] },
    ],
  },

  "subclass|barbarian|path of the beast|call the hunt": {
    name: "Call the Hunt", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [
      { reason: "grant allies temp HP and d6 bonus on damage; ally buff mechanics and temp HP not tracked", tags: ["temp-hp", "ally-buff", "resource"] },
    ],
  },

  "subclass|barbarian|path of the berserker|frenzy": {
    name: "Frenzy", sv: 1,
    unsupported: [
      { reason: "bonus action melee attack each turn while frenzied + gain exhaustion when rage ends; requires attack action and exhaustion tracking", tags: ["attack", "action-economy", "exhaustion"] },
    ],
  },

  "subclass|barbarian|path of the berserker|mindless rage": {
    name: "Mindless Rage", sv: 1,
    unsupported: [
      { reason: "immunity to charmed/frightened while raging; condition-specific immunity not modeled", tags: ["condition-immunity", "conditional"] },
    ],
  },

  "subclass|barbarian|path of the berserker|intimidating presence": {
    name: "Intimidating Presence", sv: 1,
    unsupported: [
      { reason: "Wisdom save (DC 8 + prof + CHA mod) to avoid frightened; save DC uses CHA mod (non-standard for WIS save)", tags: ["save-effect", "condition", "non-standard-save"] },
    ],
  },

  "subclass|barbarian|path of the berserker|retaliation": {
    name: "Retaliation", sv: 1,
    unsupported: [
      { reason: "reaction melee weapon attack when hit by nearby creature; requires reaction and attack mechanics", tags: ["reaction", "attack"] },
    ],
  },

  "subclass|barbarian|path of the giant|giant's havoc": {
    name: "Giant's Havoc", sv: 1,
    unsupported: [
      { reason: "while raging: reach increase, size increase, bonus damage on weapon attacks; requires reach/size/damage integration", tags: ["reach", "size", "damage", "conditional"] },
    ],
  },

  "subclass|barbarian|path of the giant|elemental cleaver": {
    name: "Elemental Cleaver", sv: 1,
    unsupported: [
      { reason: "weapon infusion with damage type + 1d6 bonus damage + thrown property; requires weapon system", tags: ["weapon", "damage-type", "property"] },
    ],
  },

  "subclass|barbarian|path of the giant|mighty impel": {
    name: "Mighty Impel", sv: 1,
    unsupported: [
      { reason: "bonus action to teleport creature within reach to 30 feet away (Strength save negates); creature and movement mechanics", tags: ["action-economy", "teleport", "save-effect"] },
    ],
  },

  "subclass|barbarian|path of the giant|demiurgic colossus": {
    name: "Demiurgic Colossus", sv: 1,
    unsupported: [
      { reason: "reach +10, size increase to Large/Huge, Mighty Impel extends to Large creatures, Elemental Cleaver damage increases to 2d6", tags: ["reach", "size", "scaling", "conditional"] },
    ],
  },

  "subclass|barbarian|path of the storm herald|desert": {
    name: "Desert", sv: 1,
    unsupported: [
      { reason: "Storm Aura effect: 2 fire damage to creatures in aura (scales 3/4/5/6 at levels 5/10/15/20); fire resistance; bonus fire action damage", tags: ["aura", "damage", "resistance", "action-bonus", "scaling"] },
    ],
  },

  "subclass|barbarian|path of the storm herald|sea": {
    name: "Sea", sv: 1,
    unsupported: [
      { reason: "Storm Aura effect: 1d6 lightning damage save (scales 2d6/3d6/4d6 at levels 10/15/20); lightning resistance + swim speed; reaction knockdown on hit", tags: ["aura", "damage", "resistance", "speed", "reaction", "scaling"] },
    ],
  },

  "subclass|barbarian|path of the storm herald|tundra": {
    name: "Tundra", sv: 1,
    unsupported: [
      { reason: "Storm Aura effect: 2 temp HP to allies (scales 3/4/5/6 at levels 5/10/15/20); cold resistance + ice action; reaction speed reduction", tags: ["aura", "temp-hp", "resistance", "action-bonus", "reaction", "scaling"] },
    ],
  },

  "subclass|barbarian|path of the storm herald|shielding storm": {
    name: "Shielding Storm", sv: 1,
    unsupported: [
      { reason: "allies in aura gain your Storm Soul damage resistance; requires ally-buff and conditional resistance mechanics", tags: ["ally-buff", "resistance", "conditional"] },
    ],
  },

  "subclass|barbarian|path of the totem warrior|bear": {
    name: "Bear", sv: 1,
    unsupported: [
      { reason: "all damage resistance while raging (except psychic); doubled carrying capacity + advantage on Strength checks; melee enemies have disadvantage on non-you attacks", tags: ["resistance", "ability-bonus", "advantage", "conditional-adv"] },
    ],
  },

  "subclass|barbarian|path of the totem warrior|eagle": {
    name: "Eagle", sv: 1,
    unsupported: [
      { reason: "disadvantage immunity on opportunity attacks while raging; Dash bonus action; darkvision (1 mile); flying speed while raging; requires speed and vision mechanics", tags: ["disadvantage-immunity", "action-bonus", "vision", "speed"] },
    ],
  },

  "subclass|barbarian|path of the totem warrior|elk": {
    name: "Elk", sv: 1,
    unsupported: [
      { reason: "walking speed +15 while raging; doubled travel pace for self/allies; bonus action knockdown attack; requires speed and action mechanics", tags: ["speed", "travel-pace", "action-bonus", "knockdown"] },
    ],
  },

  "subclass|barbarian|path of the totem warrior|tiger": {
    name: "Tiger", sv: 1,
    unsupported: [
      { reason: "jump distance bonuses (+10 long, +3 high); 2 skill proficiencies (Athletics/Acrobatics/Stealth/Survival); bonus attack after 20-foot charge", tags: ["jump", "skill-prof", "attack", "action-bonus"] },
    ],
  },

  "subclass|barbarian|path of the totem warrior|wolf": {
    name: "Wolf", sv: 1,
    unsupported: [
      { reason: "allies have advantage on melee attacks vs. creatures within 5 feet of you while you're raging; tracking + movement while stealthy; bonus action knockdown", tags: ["ally-advantage", "tracking", "movement", "action-bonus"] },
    ],
  },

  "subclass|barbarian|path of the zealot|divine fury": {
    name: "Divine Fury", sv: 1,
    effects: [
      { target: "damage-bonus", op: "adddice", value: "1d6" },
      { target: "damage-bonus", op: "add", value: { floor: { mul: [0.5, { level: "class", class: "@self" }] } } },
      { target: "damage-bonus", op: "note", text: "first creature hit per turn only; necrotic or radiant damage (choose one at feature gain)" },
    ],
  },

  "subclass|barbarian|path of the zealot|fanatical focus": {
    name: "Fanatical Focus", sv: 1,
    unsupported: [
      { reason: "reroll failed save while raging (once per rage); requires roll history and reroll mechanics", tags: ["reroll", "save", "resource"] },
    ],
  },

  "subclass|barbarian|path of the zealot|zealous presence": {
    name: "Zealous Presence", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [
      { reason: "bonus action to grant allies advantage on attack rolls and saves until start of next turn; requires ally buff and action mechanics", tags: ["action-bonus", "ally-buff"] },
    ],
  },

  "subclass|barbarian|path of the zealot|rage beyond death": {
    name: "Rage Beyond Death", sv: 1,
    unsupported: [
      { reason: "0 HP doesn't knock you unconscious while raging; death save still tracked; death delayed until rage ends; requires death save integration", tags: ["death-save", "conditional", "HP-state"] },
    ],
  },

  "subclass|barbarian|path of wild magic|magic awareness": {
    name: "Magic Awareness", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [
      { reason: "action to detect concentrated magic within 60 feet for 1 round; identify school of magic; primarily scouting, no direct mechanical effect", tags: ["scouting", "detection", "action"] },
    ],
  },

  "subclass|barbarian|path of wild magic|wild surge": {
    name: "Wild Surge", sv: 1,
    unsupported: [
      { reason: "roll on Wild Magic table when entering rage; random magical effect; table-based outcome not automatable", tags: ["random", "table", "effect-variation"] },
    ],
  },

  "subclass|barbarian|path of wild magic|bolstering magic": {
    name: "Bolstering Magic", sv: 1,
    uses: { max: { prof: true }, per: "lr" },
    unsupported: [
      { reason: "action to touch creature: grant d3 on attack rolls/checks, or restore spell slot (d3 level); requires d3 rolling and ally buff mechanics", tags: ["d3-roll", "ally-buff", "spell-restoration"] },
    ],
  },

  "subclass|barbarian|path of wild magic|unstable backlash": {
    name: "Unstable Backlash", sv: 1,
    unsupported: [
      { reason: "reaction when damaged or failing save while raging: roll Wild Magic table and replace current effect; requires roll tracking and effect state", tags: ["reaction", "random", "table", "effect-state"] },
    ],
  },

  "subclass|barbarian|path of wild magic|controlled surge": {
    name: "Controlled Surge", sv: 1,
    unsupported: [
      { reason: "roll Wild Magic table twice, choose effect; if both rolls same, pick any effect; requires roll choice and table-based outcome", tags: ["random", "table", "choice"] },
    ],
  },
});
