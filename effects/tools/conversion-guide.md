# Feature-effects conversion guide (for LLM conversion passes)

You are converting D&D 5e (2014) feat/feature *text* into small JSON-like
entries for this project's declarative effects overlay (see
`src/effects.js` for the engine, `DOCS.md`'s "Feature effects" section for
the human-readable spec, `effects/db/handwritten.js` for worked examples).

**Golden rule: never copy sourcebook prose into the entry.** Entries are
mechanics-only (targets, numbers, operations) — no flavor text, no
restated rules text beyond a short `note` when the engine can't otherwise
represent a caveat (e.g. "can't be surprised while conscious").

## Output format

A JS file loaded as a plain `<script>` (not a module), calling
`registerEffects({ ... })` once with every entry for your batch, e.g.:

```js
registerEffects({
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
});
```

Key = `"feat|" + name.trim().toLowerCase()`.

Each entry:
- `name` (string, required) — the feat's exact display name.
- `sv: 1` (required) — schema version, always the literal number 1.
- `effects` (array, optional) — see below.
- `choices` (array, optional) — see below.
- `unsupported` (array, optional) — `[{ reason: "...", tags: [...] }]`. Use
  **only** when the feat has a genuinely automatable-sounding effect that
  the engine still can't represent (needs a roll-history model, an
  attacks/weapons table that doesn't exist yet, DM adjudication, random
  tables, etc.) — see Lucky and Sharpshooter in handwritten.js.
- `uses` (object, optional) — see "Limited uses" below.
- An entry must have at least one of `effects` / `unsupported` / `uses`.
  Effects and a uses tracker aren't exclusive: a feature can have both (an
  automatable numeric effect *and* a finite-use tracker), or just one.

**If a feat has no automatable numeric/mechanical effect at all** (pure
roleplay flavor, or a benefit entirely outside this sheet's current scope
like "you can breathe underwater"), **omit it from the output entirely** —
don't create an empty entry just to have one.

## Targets (only these are understood by the engine)

- `"init"` — initiative
- `"hpmax"` — max HP
- `"profbonus"` — proficiency bonus
- `"spelldc"` / `"spellatk"` — spell save DC / spell attack bonus
- `"passive-perception"`
- `"save-<ability>"` where ability ∈ `str dex con int wis cha`
- `"skill-<slug>"` where slug is the skill name lowercased with spaces/
  punctuation stripped: `acrobatics animalhandling arcana athletics
  deception history insight intimidation investigation medicine nature
  perception performance persuasion religion sleightofhand stealth
  survival`
- `"score-<ability>"` — a raw ability score (str/dex/con/int/wis/cha)
- `"attack-hit"` / `"damage-bonus"` (and other `attack-`/`damage-`
  prefixed names) — **reserved**: always valid to write (e.g. for
  Sharpshooter/GWM-style feats), but never actually applied yet since
  there's no weapons/attacks module. Use these rather than `unsupported`
  when the *only* blocker is "needs the attacks table."
- `"score-{choice:someId}"` — templated target resolved from a choice
  (see Resilient/Observant in handwritten.js).

Do **not** invent other targets (no `ac`, `speed`, `hitdice`, etc. — not
wired up yet). If a feat needs one of those, use `unsupported` instead.

## Ops

- `add` — add a flat number (`value` required, see Value expressions)
- `adddice` — append dice notation, e.g. `value: "1d4"` (string)
- `min` / `max` — clamp: raises/lowers the target to at least/at most `value`
- `set` — force the target to exactly `value`
- `prof` — grant proficiency (for `save-*`/`skill-*` targets)
- `expertise` — grant expertise (double proficiency)
- `adv` / `dis` — force advantage/disadvantage on that target's rolls
- `note` — attach a short reminder string (`text`, not mechanically applied)

## Value expressions (for `add`/`min`/`max`/`set`)

- A plain number: `5`
- `{ mod: "int" }` — that ability's modifier
- `{ prof: true }` — proficiency bonus
- `{ level: "total" }` — total character level
- `{ level: "class", class: "@self" }` — levels in the class/subclass
  that granted this feature (or `class: "Wizard"` for a specific class)
- `{ choice: "someId" }` — a numeric choice value
- `{ sum: [a, b, ...] }`, `{ mul: [a, b, ...] }`, `{ floor: a }`,
  `{ max: [a, b] }`, `{ min: [a, b] }` — composition, each element itself
  a value expression. Example: Tough's `{ mul: [2, { level: "total" }] }`.

There is deliberately **no** way to read another computed stat (no
"current initiative", no "current AC") — only ability scores, proficiency
bonus, level, and choices.

## Activation (on an effect, optional — omit for always-on)

- Omit entirely (or `{ kind: "always" }`) — applies unconditionally
  whenever the feature is active.
- `{ kind: "toggle", id: "some-id", label: "Button label", default: false }`
  — player-flipped switch (e.g. Sharpshooter's power-shot mode).
- `{ kind: "choice", choice: "someId" }` — only active once that choice
  has been made (paired with a `choices` entry of the same id).

## Choices (top-level `choices` array on the entry)

- `{ id: "ability", kind: "ability", label: "..." }` — a full
  ability-score picker (str/dex/con/int/wis/cha) — use for "choose an
  ability score" style feats (Resilient).
- `{ id: "ability", kind: "pick", n: 1, options: ["int", "wis"], label: "..." }`
  — pick N from a fixed list (Observant's INT-or-WIS).

## Limited uses (top-level `uses` object on the entry)

For a feature/feat with a finite number of uses that recharges on a rest —
"you can use this feature a number of times equal to your proficiency
bonus," "once per day," "twice, regaining all uses on a long rest," "you
have 3 luck points... regain expended points after a long rest," etc. —
declare it explicitly instead of leaving it for guesswork:

```js
uses: {
  max: { prof: true },   // or a number, or { max: [{ mod: "con" }, 1] } for "CON mod, min 1"
  per: "lr",             // "sr" (also recovers on a long rest) or "lr" (long-rest only)
},
```

`max` is an ordinary [value expression](#value-expressions-for-addminmaxset)
— reuse `{ prof: true }`, a plain number, `{ mod: "<ability>" }`, or a
composition like `{ max: [{ mod: "con" }, 1] }` for "your CON modifier,
minimum 1" (the outer `max` here is the *value-expression* op that takes
the larger of its two arguments — not the `uses.max` field itself).

For the "once fully expended, roll NdN — that many long rests until it
recharges" pattern (e.g. Bloodwell Vial-style features), add `delayed`:

```js
uses: { max: 1, per: "lr", delayed: { expr: "1d4" } },
```

When `delayed` is present, `per` is still required but only `"lr"`
actually matters — delayed recharge is only ever counted down by a long
rest, per the sheet's Short/Long Rest buttons.

**Only declare `uses` when the feat text gives an explicit finite count
and recharge** — don't invent one for "you can use this feature" phrasing
that's actually at-will, and don't guess a recharge if the text doesn't
state one plainly. If a feature clearly has limited uses but the count or
recharge is genuinely ambiguous or non-standard (e.g. depends on a
resource this sheet doesn't model, like sorcery points or ki), use
`unsupported` instead of guessing.

## Worked examples to imitate

See `effects/db/handwritten.js` in full before starting — it has one
example each of: flat add (Alert), scaling add via level (Tough),
ability-choice + flat bonus (Observant), full-ability choice + prof grant
(Resilient), reserved attack-target + toggle (Sharpshooter), and a fixed
uses-tracker paired with `unsupported` (Lucky — its 3 luck points get a
pip tracker even though spending one to reroll isn't automated).

## Common feat patterns you'll see

- "+N to an ability score, to a max of 20" → this is **ability-score
  improvement flavor**, already handled generically by the sheet's ASI
  picker — do **not** emit a `score-*` add effect for the feat's own
  built-in `+1 ability` clause unless the feat's ability bump is
  *conditional on a choice specific to that feat* (like Resilient/
  Observant picking which ability). Most feats with a flat "+1 to an
  ability of your choice, max 20" and nothing else can be omitted, or
  captured with just `choices` if there's a genuine associated mechanic
  (saving throw proficiency, skill, etc.) tied to the same choice.
- "gain proficiency in X skill/save/tool" with a fixed (non-chosen) skill
  → `{ target: "skill-<slug>", op: "prof" }`, no choice needed.
- "gain proficiency in one skill of your choice from a list" → use a
  `pick` choice + `{ target: "skill-{choice:id}", op: "prof",
  activation: { kind: "choice", choice: "id" } }`. **Only do this if the
  slug set covers the list** — if the list includes things not in the 18
  skills (tools, languages), fall back to `unsupported`.
- "advantage on saving throws against being frightened/charmed/poisoned/
  etc." — there's no per-condition save target, only per-ability
  (`save-str`..`save-cha`). If the feat grants advantage tied to a specific
  *condition* rather than a specific ability, that's `unsupported`
  (reason: "conditional advantage, not modeled per-ability").
- Weapon/attack-related feats (Great Weapon Master, Sharpshooter, Crossbow
  Expert, Polearm Master's extra attack, Dual Wielder, etc.) → use the
  reserved `attack-`/`damage-` targets where the mechanic is a flat
  to-hit/damage modifier gated by a toggle (see Sharpshooter). Anything
  needing an actual extra attack action, not just a number tweak, is
  `unsupported`.
- Anything requiring tracking a resource this sheet has no model for
  (extra reactions, uses tied to a homebrew resource pool not covered by
  the Features panel's pip-counting, rerolls, "once per turn" riders on
  attacks) → `unsupported`.

## Before you finish

Run the validator against your output file:

```bash
node effects/tools/validate-db.js
```

Fix anything it flags. It only checks structural shape (valid targets/ops/
choice references) — it can't tell you whether the *mechanics* are game-
accurate, so double check values against the feat text yourself.
