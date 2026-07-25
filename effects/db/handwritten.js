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
  "feat|sharpshooter": {   // serialized now; applied once a weapons/attacks module exists (attack-*/damage-* are reserved targets)
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
});
