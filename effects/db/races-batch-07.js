/* ============================================================
   Racial trait effects conversion (batch 07)
   Converted from races.json feature text via LLM pass.
   See effects/tools/conversion-guide.md for targets/ops/schema.

   Traits with no automatable mechanic per the conversion guide
   (darkvision, resistances, speed, languages, size, pure flavor,
   or context outside the engine's target list) are omitted.
   ============================================================ */
registerEffects({
  "race|orc (ixalan)|menacing": {
    name: "Menacing", sv: 1,
    effects: [{ target: "skill-intimidation", op: "prof" }],
  },
  "race|orc (ixalan)|relentless endurance": {
    name: "Relentless Endurance", sv: 1,
    uses: { max: 1, per: "lr" },
    unsupported: [{ reason: "0-HP triggered damage negation; no trigger model", tags: ["trigger"] }],
  },
  "race|orc (ixalan)|savage attacks": {
    name: "Savage Attacks", sv: 1,
    unsupported: [{ reason: "critical hit triggered extra damage die roll; no crit context model", tags: ["attack", "trigger"] }],
  },
  "race|owlin|silent feathers": {
    name: "Silent Feathers", sv: 1,
    effects: [{ target: "skill-stealth", op: "prof" }],
  },
  "race|plasmoid|amorphous": {
    name: "Amorphous", sv: 1,
    unsupported: [{ reason: "grapple check advantage; no per-action-type advantage target", tags: ["advantage"] }],
  },
  "race|plasmoid|natural resilience": {
    name: "Natural Resilience", sv: 1,
    unsupported: [{ reason: "condition-specific save advantage (poisoned); no per-condition save target", tags: ["advantage", "condition"] }],
  },
  "race|reborn|ancestral legacy": {
    name: "Ancestral Legacy", sv: 1,
    choices: [
      { id: "skill1", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "First skill proficiency" },
      { id: "skill2", kind: "pick", n: 1, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Second skill proficiency" },
    ],
    effects: [
      { target: "skill-{choice:skill1}", op: "prof", activation: { kind: "choice", choice: "skill1" } },
      { target: "skill-{choice:skill2}", op: "prof", activation: { kind: "choice", choice: "skill2" } },
    ],
  },
  "race|reborn|deathless nature": {
    name: "Deathless Nature", sv: 1,
    unsupported: [{ reason: "death saving throw advantage; no death-save target", tags: ["save"] }],
  },
  "race|satyr|magic resistance": {
    name: "Magic Resistance", sv: 1,
    unsupported: [{ reason: "spell-context save advantage; no per-spell-type advantage target", tags: ["advantage", "spell"] }],
  },
  "race|satyr|ram": {
    name: "Ram", sv: 1,
    unsupported: [{ reason: "custom unarmed strike damage (1d6 + STR bludgeoning); an effect can't create an attack row — add one by hand", tags: ["attack"] }],
  },
  "race|satyr|reveler": {
    name: "Reveler", sv: 1,
    effects: [
      { target: "skill-performance", op: "prof" },
      { target: "skill-persuasion", op: "prof" },
    ],
  },
  "race|sea elf|fey ancestry": {
    name: "Fey Ancestry", sv: 1,
    unsupported: [{ reason: "condition-specific save advantage (charmed); no per-condition save target", tags: ["advantage", "condition"] }],
  },
  "race|sea elf|keen senses": {
    name: "Keen Senses", sv: 1,
    effects: [{ target: "skill-perception", op: "prof" }],
  },
  "race|sea elf|trance": {
    name: "Trance", sv: 1,
    unsupported: [{ reason: "choice-based weapon/tool proficiencies; not in 18-skill scope", tags: ["choice"] }],
  },
  "race|shadar-kai|fey ancestry": {
    name: "Fey Ancestry", sv: 1,
    unsupported: [{ reason: "condition-specific save advantage (charmed); no per-condition save target", tags: ["advantage", "condition"] }],
  },
  "race|shadar-kai|keen senses": {
    name: "Keen Senses", sv: 1,
    effects: [{ target: "skill-perception", op: "prof" }],
  },
  "race|shifter|bestial instincts": {
    name: "Bestial Instincts", sv: 1,
    choices: [
      { id: "skill", kind: "pick", n: 1, options: ["acrobatics", "athletics", "intimidation", "survival"], label: "Bestial Instincts skill" },
    ],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" } },
    ],
  },
  "subrace|beasthide|natural athlete": {
    name: "Natural Athlete", sv: 1,
    effects: [{ target: "skill-athletics", op: "prof" }],
  },
  "subrace|beasthide|shifting feature": {
    name: "Shifting Feature", sv: 1,
    unsupported: [{ reason: "state-dependent temp HP + AC bonus while shifted; no state/toggle tracking for shifting form", tags: ["state", "ac"] }],
  },
  "subrace|longtooth|fierce": {
    name: "Fierce", sv: 1,
    effects: [{ target: "skill-intimidation", op: "prof" }],
  },
  "subrace|longtooth|shifting feature": {
    name: "Shifting Feature", sv: 1,
    unsupported: [{ reason: "custom unarmed strike bonus action while shifted (1d6 + STR piercing); an effect can't create an attack row, and shifting isn't tracked", tags: ["attack", "state"] }],
  },
  "subrace|swiftstride|graceful": {
    name: "Graceful", sv: 1,
    effects: [{ target: "skill-acrobatics", op: "prof" }],
  },
  "subrace|swiftstride|shifting feature": {
    name: "Shifting Feature", sv: 1,
    unsupported: [{ reason: "state-dependent speed increase + reaction movement while shifted; no state/speed model", tags: ["state", "speed"] }],
  },
  "subrace|wildhunt|natural tracker": {
    name: "Natural Tracker", sv: 1,
    effects: [{ target: "skill-survival", op: "prof" }],
  },
  "subrace|wildhunt|shifting feature": {
    name: "Shifting Feature", sv: 1,
    unsupported: [{ reason: "ability-check advantage (WIS) and defensive aura while shifted; no state tracking or aura model", tags: ["advantage", "state"] }],
  },
  "race|simic hybrid|animal enhancement": {
    name: "Animal Enhancement", sv: 1,
    unsupported: [{ reason: "complex leveled choice-driven enhancement picks (1st and 5th level); incomplete specification", tags: ["choice"] }],
  },
  "race|tabaxi|cat's claws": {
    name: "Cat's Claws", sv: 1,
    unsupported: [{ reason: "custom unarmed strike damage (1d4 + STR slashing) + climbing speed; an effect can't create an attack row, and speed isn't a target", tags: ["attack", "speed"] }],
  },
  "race|tabaxi|cat's talents": {
    name: "Cat's Talents", sv: 1,
    effects: [
      { target: "skill-perception", op: "prof" },
      { target: "skill-stealth", op: "prof" },
    ],
  },
  "race|thri-kreen|chameleon carapace": {
    name: "Chameleon Carapace", sv: 1,
    unsupported: [{ reason: "armor-class calculation (13 + DEX unarmored) + conditional stealth advantage; needs AC model", tags: ["ac", "advantage"] }],
  },
});
