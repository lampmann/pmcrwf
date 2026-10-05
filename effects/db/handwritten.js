/* ============================================================
   Hand-authored effects entries — proves the schema end to end before any
   LLM conversion pipeline exists. Small and curated on purpose; bulk
   coverage (the rest of feats.json, every class/subclass, races.json) is
   meant to come later from an offline Haiku 4.5 conversion pass over the
   user's own data/ (see DOCS.md), not from hand-editing this file forever.
   ============================================================ */
registerEffects({
  // ----- class/subclass features -----
  "subclass|wizard|war magic|tactical wit": {
    name: "Tactical Wit", sv: 1,
    effects: [{ target: "init", op: "add", value: { mod: "int" } }],
  },
  "subclass|wizard|chronurgy magic|temporal awareness": {
    name: "Temporal Awareness", sv: 1,
    effects: [{ target: "init", op: "add", value: { mod: "int" } }],
  },

  // ----- feats -----
  "feat|alert": {
    name: "Alert", sv: 1,
    effects: [
      { target: "init", op: "add", value: 5 },
      { target: "init", op: "note", text: "can't be surprised while conscious" },
    ],
  },
  "feat|tough": {
    name: "Tough", sv: 1,
    effects: [{ target: "hpmax", op: "add", value: { mul: [2, { level: "total" }] } }],
  },
  "feat|observant": {
    name: "Observant", sv: 1,
    choices: [{ id: "ability", kind: "pick", n: 1, options: ["int", "wis"], label: "+1 to" }],
    effects: [
      { target: "passive-perception", op: "add", value: 5 },
      { target: "score-{choice:ability}", op: "add", value: 1, activation: { kind: "choice", choice: "ability" } },
    ],
  },
  "feat|resilient": {
    name: "Resilient", sv: 1,
    choices: [{ id: "ability", kind: "ability", label: "Resilient ability" }],
    effects: [
      { target: "save-{choice:ability}", op: "prof", activation: { kind: "choice", choice: "ability" } },
      { target: "score-{choice:ability}", op: "add", value: 1, activation: { kind: "choice", choice: "ability" } },
    ],
  },
  // Written against attack-hit/damage-bonus while both were still reserved, and applied — with no
  // re-conversion — the day the Attacks module learned to read them. The working example of why
  // the reserved-target scheme exists (see the header comment in src/effects.js).
  "feat|sharpshooter": {
    name: "Sharpshooter", sv: 1,
    effects: [
      { target: "attack-hit", op: "add", value: -5,
        activation: { kind: "toggle", id: "power-shot", label: "Sharpshooter −5/+10", default: false } },
      { target: "damage-bonus", op: "add", value: 10,
        activation: { kind: "toggle", id: "power-shot", label: "Sharpshooter −5/+10", default: false } },
      { target: "attack-hit", op: "note", text: "ignores long-range disadvantage and half/three-quarters cover" },
    ],
  },
  "feat|lucky": {
    name: "Lucky", sv: 1,
    uses: { max: 3, per: "lr" },
    unsupported: [{ reason: "post-hoc reroll of any d20; no roll-history model", tags: ["reroll", "resource"] }],
  },

  /* ----- races -----
     Custom Lineage (TCE p8) had no entry at all, which mattered more than most gaps: it is the one
     race whose entire point is that everything about it is a choice. Its +2 is handled by the
     creator (racialAbilityBonus reads the `choose` block's amount) and its feat now has a slot of
     its own (traitGrantsFeat, src/class-library.js); this is the third piece.

     Variable Trait is a two-stage choice: darkvision or a skill, followed by the skill itself. */
  "race|custom lineage|variable trait": {
    name: "Variable Trait", sv: 1,
    choices: [{ id: "trait", kind: "pick", n: 1, options: ["darkvision", "skill"], label: "Choice 1" },
      { id: "skill", kind: "pick", n: 1, when: { choice: { id: "trait", is: "skill" } }, options: ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"], label: "Choice 2: Skill" }],
    effects: [
      { target: "skill-{choice:skill}", op: "prof", activation: { kind: "choice", choice: "skill" }, when: { choice: { id: "trait", is: "skill" } } },
      { target: "sense-darkvision", op: "min", value: 60, when: { choice: { id: "trait", is: "darkvision" } } },
    ],
  },

});
