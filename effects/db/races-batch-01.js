/* ============================================================
   Race/lineage feature effects conversion batch 01 — LLM-generated
   from 5e.tools race data using the conversion guide
   (see effects/tools/conversion-guide.md for patterns and rationale).
   Only includes entries with automatable numeric/mechanical effects;
   see input batch for full list of traits including flavor-only ones.
   ============================================================ */
registerEffects({
  // ===== SKILL PROFICIENCIES =====
  "race|aetherborn|menacing": {
    name: "Menacing", sv: 1,
    effects: [
      { target: "skill-intimidation", op: "prof" },
    ],
  },

  "race|astral elf|keen senses": {
    name: "Keen Senses", sv: 1,
    effects: [
      { target: "skill-perception", op: "prof" },
    ],
  },

  "race|aven|hawkeyed": {
    name: "Hawkeyed", sv: 1,
    effects: [
      { target: "skill-perception", op: "prof" },
    ],
  },

  "subrace|hawk-headed|hawkeyed": {
    name: "Hawkeyed", sv: 1,
    effects: [
      { target: "skill-perception", op: "prof" },
    ],
  },

  "race|bugbear|sneaky": {
    name: "Sneaky", sv: 1,
    effects: [
      { target: "skill-stealth", op: "prof" },
    ],
  },

  // ===== SKILL CHOICE + PROFICIENCY =====
  "race|centaur|natural affinity": {
    name: "Natural Affinity", sv: 1,
    choices: [
      { id: "skillchoice", kind: "pick", n: 1, options: ["animalhandling", "medicine", "nature", "survival"], label: "Natural Affinity skill" },
    ],
    effects: [
      { target: "skill-{choice:skillchoice}", op: "prof", activation: { kind: "choice", choice: "skillchoice" } },
    ],
  },

  "race|changeling|changeling instincts": {
    name: "Changeling Instincts", sv: 1,
    choices: [
      { id: "skillchoice", kind: "pick", n: 2, options: ["deception", "insight", "intimidation", "performance", "persuasion"], label: "Changeling Instincts skills" },
    ],
    effects: [
      { target: "skill-{choice:skillchoice}", op: "prof", activation: { kind: "choice", choice: "skillchoice" } },
    ],
  },

  // ===== UNSUPPORTED MECHANICS =====
  "race|aarakocra|talons": {
    name: "Talons", sv: 1,
    unsupported: [{ reason: "natural unarmed strike damage die (1d6 + STR); an effect can't create an attack row - add one by hand", tags: ["attack", "damage"] }],
  },

  "race|aarakocra|wind caller": {
    name: "Wind Caller", sv: 1,
    unsupported: [{ reason: "spellcasting (gust of wind) with ability choice and level gating; spell system not modeled", tags: ["spellcasting", "choice"] }],
  },

  "subrace|fallen|necrotic shroud": {
    name: "Necrotic Shroud", sv: 1,
    unsupported: [{ reason: "conditional save DC (8 + prof + CHA mod) and transform-gated damage bonus; action/condition mechanics not modeled", tags: ["spellcasting", "condition", "action"] }],
  },

  "subrace|scourge|radiant consumption": {
    name: "Radiant Consumption", sv: 1,
    unsupported: [{ reason: "transform action with aura damage (half level to self/nearby) and damage bonus rider; action/condition mechanics not modeled", tags: ["spellcasting", "action", "aura"] }],
  },

  "race|aetherborn|gift of the aetherborn": {
    name: "Gift of the Aetherborn", sv: 1,
    unsupported: [{ reason: "special resource (life drain ability with weekly depletion mechanic); no model for homebrew resource pools", tags: ["resource", "special-ability"] }],
  },

  "subrace|ibis-headed|kefnet's blessing": {
    name: "Kefnet's Blessing", sv: 1,
    unsupported: [{ reason: "bonus to raw ability checks (not saves, not skills); ability-check target not modeled", tags: ["ability-check"] }],
  },

  "race|autognome|armored casing": {
    name: "Armored Casing", sv: 1,
    unsupported: [{ reason: "AC bonus (13 + DEX when unarmored); AC target not yet wired", tags: ["ac"] }],
  },

  "race|bugbear|long-limbed": {
    name: "Long-Limbed", sv: 1,
    unsupported: [{ reason: "melee reach bonus on attacks (+5 ft); reach isn't modeled", tags: ["attack", "range"] }],
  },

  "race|bugbear|surprise attack": {
    name: "Surprise Attack", sv: 1,
    unsupported: [{ reason: "conditional extra damage (2d6) on first-turn surprise attack; requires turn/combat state tracking", tags: ["attack", "damage", "conditional"] }],
  },

  "race|bullywug|swamp camouflage": {
    name: "Swamp Camouflage", sv: 1,
    effects: [
      { target: "situational-advantage", op: "tag", value: "on Stealth checks in swampy terrain" },
    ],
  },

  "race|centaur|charge": {
    name: "Charge", sv: 1,
    unsupported: [{ reason: "conditional bonus attack on movement+hit combo; requires action/movement tracking and multi-turn state", tags: ["attack", "action", "conditional"] }],
  },

  "race|centaur|hooves": {
    name: "Hooves", sv: 1,
    unsupported: [{ reason: "natural unarmed strike damage die (1d6 + STR); an effect can't create an attack row - add one by hand", tags: ["attack", "damage"] }],
  },

  "race|deep gnome|gift of the svirfneblin": {
    name: "Gift of the Svirfneblin", sv: 1,
    unsupported: [{ reason: "spellcasting (disguise self, nondetection) with ability choice and level gating (3rd, 5th); spell system not modeled", tags: ["spellcasting", "choice", "level-scaling"] }],
  },

  "race|deep gnome|gnomish magic resistance": {
    name: "Gnomish Magic Resistance", sv: 1,
    effects: [
      { target: "save-vs-magic", op: "tag", value: "spells (INT, WIS and CHA saves)" },
    ],
  },

  "race|dhampir|spider climb": {
    name: "Spider Climb", sv: 1,
    effects: [
      { target: "speed-climb", op: "tag", value: "equal to your walking speed" },
      { target: "speed-climb", op: "note", text: "from 3rd level you can also move up vertical surfaces and across ceilings, hands free" },
    ],
  },

  "race|dragonborn|breath weapon": {
    name: "Breath Weapon", sv: 1,
    unsupported: [{ reason: "spellcasting-like ability (save DC = 8 + prof + CON mod, damage 2d6+ scaling with level); spell/action mechanics not modeled", tags: ["spellcasting", "save", "level-scaling"] }],
  },

  "subrace|draconblood|forceful presence": {
    name: "Forceful Presence", sv: 1,
    effects: [
      { target: "situational-advantage", op: "tag", value: "on one Intimidation or Persuasion check, once per short rest" },
    ],
  },

  "subrace|ravenite|vengeful assault": {
    name: "Vengeful Assault", sv: 1,
    unsupported: [{ reason: "reaction attack bonus when damaged; requires action/reaction tracking and multi-turn state", tags: ["attack", "reaction", "conditional"] }],
  },
});
