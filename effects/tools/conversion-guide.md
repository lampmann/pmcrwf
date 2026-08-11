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
  action-economy model, a crit model, DM adjudication, random tables,
  etc.) — see Lucky in handwritten.js.
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
- `"ac"` — armor class. Adds on top of whatever `armorClassAuto()` computes
  (or the AC override, if set) — see `baseOf("ac")`/`checkBonus("ac")` in
  src/derived.js. Fine for a flat bonus (a ring of protection, a shield
  spell's duration-based bonus if you're tracking it manually, etc.).
  **Not yet suited to a *replacement* base-AC formula** (e.g. an
  alternate Unarmored Defense like 13 + DEX, or a toggled +4 like Shell
  Defense) — there's no way to express "use this formula instead, but
  only when unarmored/toggled on" yet; use `unsupported` for those.
- `"save-<ability>"` where ability ∈ `str dex con int wis cha`
- `"skill-<slug>"` where slug is the skill name lowercased with spaces/
  punctuation stripped: `acrobatics animalhandling arcana athletics
  deception history insight intimidation investigation medicine nature
  perception performance persuasion religion sleightofhand stealth
  survival`
- `"score-<ability>"` — a raw ability score (str/dex/con/int/wis/cha)
- `"speed"` — walking speed, in feet. Adds on top of whatever the user typed
  into the Speed box — see `speedTotal()` in src/derived.js (same
  base-input + effects-total pattern as an ability score). Conditional
  bonuses are fine too now: Fast Movement's "+10 ft while not wearing heavy
  armor" is `when: { notArmor: ["heavy"] }`, and Unarmored Movement's level
  table is one banded effect per step (see "Level gating"). Anything gated
  on being mounted, raging or dashing still has no predicate and stays
  `unsupported`.
- `"speed-fly"` / `"speed-swim"` / `"speed-climb"` / `"speed-burrow"` — a
  *separate* movement speed rather than an addition to walking speed. Use
  `add` with a number where the rules give one ("a flying speed of 30
  feet"), and `tag` with the rules' own words where they don't ("equal to
  your walking speed", "+10 ft, if you have one") — a value expression
  deliberately can't read another target, so those cannot be computed and
  must not be guessed at. Both forms show on the defences line.
- `"resist-<type>"` / `"immune-<type>"` / `"vuln-<type>"` — damage
  resistance/immunity/vulnerability, always with op `tag`. The suffix is
  free text and is what gets printed, so keep it the type as the book names
  it (`resist-poison`, `resist-all damage except psychic`).
- `"save-vs-<condition>"` — advantage on saves against a condition
  (Fey Ancestry, Brave, Gnome Cunning), op `tag`. Note this is *not*
  `save-<ability>`, which is the numeric bonus target.
- `"situational-advantage"` / `"situational-disadvantage"` — advantage or
  disadvantage whose trigger is terrain, lighting, or what another creature
  is doing, op `tag`, with the value phrased as a clause that reads after
  the word: `"on Stealth checks in rocky terrain"`. **These are listed, not
  applied** — the sheet can't see the trigger, so applying them would be
  wrong more often than right. Use this rather than `adv` on a skill for
  anything conditional, and rather than `unsupported`, which would hide it.
- `"check-proficient"` — every check you're proficient in, which is the
  Reliable Talent / Silver Tongue shape. Pair with op `diefloor`.
- `"attack-hit"` / `"damage-bonus"` — a flat/dice bonus on a weapon
  attack's to-hit roll and damage roll. **Live**: the Attacks module folds
  these into every attack row (rows can opt out individually). `adv`/`dis`
  on `"attack-hit"` forces that row's roll mode.
- Any *other* `attack-`/`damage-`-prefixed name (`"damage-crit"`,
  `"damage-type"`, …) — **reserved**: always valid to write, but nothing
  reads it, so it lands in the audit's "not automated" bucket instead of
  applying. Use one rather than `unsupported` when the mechanic is a clean
  number on a target the engine will plausibly grow later; `attack-hit` /
  `damage-bonus` reached the Attacks module exactly this way.
- `"score-{choice:someId}"` — templated target resolved from a choice
  (see Resilient/Observant in handwritten.js).
- `"spell-grant"` — grants a spell (fixed name only — see below).

Do **not** invent other targets (no `hitdice`, etc. — genuinely not wired
up: nothing in src/derived.js reads effFlat("hitdice") the way it does for
ac/init/speed/save-*/skill-*). If a feat needs one of those, use
`unsupported` instead.

## Ops

- `add` — add a flat number (`value` required, see Value expressions)
- `adddice` — append dice, either a literal (`value: "1d4"`) or a computed
  term `value: { count: <value expr>, die: "d6" }`. The computed form is
  how a die count that scales gets written once instead of as a band per
  level: Sneak Attack is `{ count: { ceil: { div: [{ level: "class",
  class: "@self" }, 2] } }, die: "d6" }`. A count of zero contributes no
  term at all rather than a bogus `0d6`.
- `min` / `max` — clamp: raises/lowers the target to at least/at most `value`
- `set` — force the target to exactly `value`
- `grant-free` / `grant-list` — see "Spell grants" below (only valid on
  target `"spell-grant"`)
- `prof` — grant proficiency (for `save-*`/`skill-*` targets)
- `expertise` — grant expertise (double proficiency)
- `adv` / `dis` — force advantage/disadvantage on that target's rolls
- `note` — attach a short reminder string (`text`, not mechanically applied)
- `diefloor` — treat a die result below `value` as `value` ("treat a d20 of
  9 or lower as a 10"). Routed through the roller's own `mi` operator, so
  the floor shows in the rolled dice rather than quietly adjusting a total.
- `critrange` — the lowest d20 that counts as a critical hit (`value: 19`).
  The lowest declared value wins when several apply.
- `useability` — *replace* the ability a roll uses (`value: "int"`), rather
  than adding to it. This is Battle Ready / Hexblade's shape.
- `tag` — record a standing fact rather than a number. `value` is the
  string the defences line prints. See the tag targets above; `tag` is only
  meaningful on those.

## Value expressions (for `add`/`min`/`max`/`set`)

- A plain number: `5`
- `{ mod: "int" }` — that ability's modifier
- `{ prof: true }` — proficiency bonus
- `{ level: "total" }` — total character level
- `{ level: "class", class: "@self" }` — levels in the class/subclass
  that granted this feature (or `class: "Wizard"` for a specific class)
- `{ choice: "someId" }` — a numeric choice value
- `{ sum: [a, b, ...] }`, `{ mul: [a, b, ...] }`, `{ div: [a, b] }`,
  `{ floor: a }`, `{ ceil: a }`, `{ round: a }`, `{ max: [a, b] }`,
  `{ min: [a, b] }` — composition, each element itself a value expression.
  Example: Tough's `{ mul: [2, { level: "total" }] }`. `div` takes exactly
  two elements; division is not integer division, so wrap it in `floor`,
  `ceil` or `round` to say which way a half rounds.

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

## Level gating (optional `when` on an effect, alongside `activation`)

`when` is the only conditional the engine has — never invent one inside a
value expression. Every predicate on it must hold for the effect to apply,
and **an unrecognized predicate leaves the effect inactive** rather than
applying it, so a typo fails safe (and `validate-db.js` catches it).

- `{ minLevel: N }` / `{ maxLevel: N }` — total character level, matching
  `totalLevel()`. Right for anything keyed off character level (a feat's
  scaling, a racial trait), wrong for a class feature on a multiclass
  character.
- `{ minClassLevel: { class: "@self", level: N } }` and its `maxClassLevel`
  twin — levels in one class, `"@self"` meaning the class this feature came
  from, which is what a class/subclass feature almost always wants. Prefer
  these over `minLevel` for anything a class grants: a Cleric 6 / Fighter 4
  reads total level 10, so `minLevel` would fire a Cleric 8 feature early.
- `{ hasClass: "Wizard" }`, `{ casting: true }` — has levels in that class;
  is a spellcaster at all.
- `{ armor: ["none", "light"] }` — an allow-list of body-armour categories
  you may be wearing; `{ notArmor: ["heavy"] }` is the deny-list form the
  rules usually phrase themselves in. Categories are `none`/`light`/
  `medium`/`heavy`, read from what's actually equipped through the same
  lookup the AC formula uses, so a predicate and the AC it implies can't
  disagree.
- `{ shield: false }` — whether a shield is equipped. A shield is
  deliberately **not** body armour, so "no armour" and "no shield" are two
  separate predicates and a feature that means both must say both
  (Unarmored Movement does).

**Level bands.** A feature whose number steps at set levels is written as
one effect per band, each carrying both ends — `minClassLevel` *and*
`maxClassLevel` — except the last, which is open-ended. The bands must not
overlap, or every one of them applies at once and the bonuses stack
(`tests/effects.html` pins this for Unarmored Movement). Where the scaling
is arithmetic rather than a table, prefer a computed `adddice` count over a
stack of bands.

## Choices (top-level `choices` array on the entry)

- `{ id: "ability", kind: "ability", label: "..." }` — a full
  ability-score picker (str/dex/con/int/wis/cha) — use for "choose an
  ability score" style feats (Resilient).
- `{ id: "ability", kind: "pick", n: 1, options: ["int", "wis"], label: "..." }`
  — pick N from a fixed list (Observant's INT-or-WIS).

**`n > 1` is supported: one `<select>` is rendered per slot.** A `pick` with
`n: 2` stores an *array* of chosen values, `renderEffectControls()` draws one
dropdown per slot (each excluding what the other slots already took, so the
same skill can't be picked twice), and `resolveTargetsAll()` in `effects.js`
expands a `{choice:id}` target into one application per filled slot. So
"choose two skills" is a single `{ n: 2 }` choice, not two ids.

Separate ids are still correct when the picks are *mechanically distinct* —
most often when a later batch of picks is level-gated, e.g. Rogue Expertise
grants two at 1st level and two more at 6th, so it uses one choice for the
first pair and a second choice gated
`when: { minClassLevel: { class: "@self", level: 6 } }` for the rest.

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

## Spell grants (target `"spell-grant"`)

For a feature that adds a **specific, fixed-name spell** to the character's
spell list — "you learn the *X* spell", "*X* is added to your spell list"
— declare one effect per spell:

```js
effects: [{ target: "spell-grant", op: "grant-free", value: { name: "mage hand" } }]
```

Three ops, matching the three ways 5e text grants a spell:

- `grant-free` — the spell is known/prepared **for free**: it never costs
  a known/prepared slot on any class, and doesn't count toward that
  class's Known/Prepared total. This is the "you innately know this
  spell, no strings attached" case (e.g. Telekinetic's Mage Hand).
- `grant-list` — the spell is merely **added to the character's spell
  list** — it's now *eligible*, but still has to be learned/prepared
  normally through a class, costing a real known/prepared slot there (e.g.
  a Dragonmark or Eldritch Knight-style list expansion).
- `grant-innate` — "you can cast *X* once per day/rest without expending a
  spell slot" (e.g. Telepathic's Detect Thoughts). Renders identically to
  `grant-free` (same link, same header) — the difference is purely that
  this is an at-will/daily cast, not a permanently-known spell, so **pair
  it with an entry-level `uses` block** (see "Limited uses" above) so it
  gets a real pip tracker instead of being silently treated as unlimited:
  ```js
  effects: [{ target: "spell-grant", op: "grant-innate", value: { name: "detect thoughts" } }],
  uses: { max: 1, per: "lr" },
  ```
  If the text also says the spell can be cast normally via spell slots
  once you have them (many feats phrase it this way), that's a *separate*
  `grant-free`/`grant-list` effect for the same spell name, alongside the
  `grant-innate` one — see Fey Touched-style feats.

**When to reach for `unsupported` instead:** if the text names one
specific spell outright, always use one of the three ops above — don't
fall back to `unsupported` just because it's "only" an at-will cast
(that's exactly what `grant-innate` is for). `unsupported` is still right
when there's a genuinely non-representable rider: a resource this sheet
doesn't model (sorcery points, Hit Dice spent), a save DC needing an
ability the feat itself doesn't fix, DM-adjudicated randomness, etc.

**Choosing from a filtered spell list** ("any level 1 spell of your
choice from the Wizard list", "choose a cantrip"): use a `spellfilter`
choice instead of guessing one spell. It populates its dropdown live from
the user's own loaded Spell Library (SPELL_LIB), filtered by the *same*
`"level=X|class=Y;Z"` spec syntax already used to describe class-side
filter grants (see `describeSpellFilter` in `class-library.js` — pipe
`|` = AND across categories, semicolon `;` = OR within one):

```js
choices: [
  { id: "feySpell", kind: "spellfilter", filter: "level=1|school=E;D", label: "Choose a 1st-level divination/enchantment spell" },
],
effects: [
  { target: "spell-grant", op: "grant-free", value: { name: "{choice:feySpell}" }, activation: { kind: "choice", choice: "feySpell" } },
],
```

The `{choice:id}` template in `value.name` resolves the same way target
templates do. The link only renders once a choice has been made (gated by
`activation: { kind: "choice", ... }`, same as any other choice-gated
effect) — before that, nothing shows for that effect. **Still don't use
this** for a choice that depends on *another* choice already made on the
same entry (e.g. Magic Initiate's "pick a class, then pick spells from
that class's list") — the filter spec is static, it can't reference
another choice's value; that stays `unsupported`.

**Why this exists / when NOT to use it:** race and subclass spell grants
(Cleric domain spells, Mark of \* dragonmarks, Eldritch Knight/Divine
Soul/Warlock-patron/Wizard-subschool expansions) are **already fully
automatic** via a separate mechanism — the app parses 5e.tools'
`additionalSpells` field on the race/subclass record directly (see
`flattenGrantedSpells`/`grantedSpellsHtml` in `src/class-library.js`) —
so don't write a `spell-grant` effect for those; if you see one already
working in the Features panel, that feature's `additionalSpells` is
already covered and any matching effects-db entry should just omit the
spell-grant part entirely. `spell-grant` is for filling the gap that
pipeline doesn't reach — **chiefly feats**, whose own `additionalSpells`
field the app currently ignores outright.

## Worked examples to imitate

See `effects/db/handwritten.js` in full before starting — it has one
example each of: flat add (Alert), scaling add via level (Tough),
ability-choice + flat bonus (Observant), full-ability choice + prof grant
(Resilient), weapon to-hit/damage + toggle (Sharpshooter), and a fixed
uses-tracker paired with `unsupported` (Lucky — its 3 luck points get a
pip tracker even though spending one to reroll isn't automated).

## Class/subclass features: key scheme and recurring features

Same output format as feats, different key: `"class|" + className.trim().toLowerCase() + "|" + featureName.trim().toLowerCase()`
for a base-class feature, `"subclass|" + className + "|" + subclassName + "|" + featureName`
(all lowercased/trimmed) for a subclass feature — see `effKeyFor()` in
src/effects.js. Both `name` in the entry and the key's last segment must
match the feature's exact display name.

**A feature that recurs at multiple levels collapses to ONE key.** 5e.tools
often splits one feature across several `classFeature`/`subclassFeature`
records at different levels (e.g. Cleric's "Channel Divinity" has separate
level-2/6/18 records; Bard/Rogue's "Expertise" grants two more skill picks
at a second level). Your input batch pre-merges every level's text for the
same feature name under one record, in level order — write **one** DB
entry per key, not one per level-record. For a feature whose *mechanic
itself* grows at a later level (more uses, more skill picks, a bigger
die), use `choices`/`effects` gated with `when` (see
"Level gating" above) for the later-level increment — e.g. Expertise:
a `pick` choice for the level-1-or-3 picks (always active) plus a second
`pick` choice for the later-level picks, gated
`when: { minClassLevel: { class: "@self", level: N } }`.

**Skip pure placeholder stubs.** Some records exist only to mark "you gain
a subclass feature at this level" with no mechanical content of their own
(e.g. a generic "Divine Domain Feature" or "Path Feature" entry whose only
text is "At Nth level, you gain a feature from your Divine Domain.") —
these have already been filtered out of your batch where recognized, but
if you see another one like it (all filler, no mechanic, no reason to
even mark `unsupported`), omit it rather than manufacture an empty entry.

**Everything else about deciding effects/unsupported/uses/omit is
identical to feats** — see the rest of this guide, especially "Common feat
patterns" below, most of which applies just as much to class features
(fixed skill/save proficiency grants, ability-choice patterns, weapon/
attack-related features needing the reserved targets, condition-specific
advantage, etc.).

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
- Weapon/attack-related feats and features (Great Weapon Master,
  Sharpshooter, Rage, Divine Strike, Hexblade's Curse, etc.) → use
  `attack-hit` / `damage-bonus` where the mechanic is a flat or dice
  to-hit/damage modifier (see Sharpshooter). Three rules matter, because
  this bucket applies to **every** attack row the player hasn't opted out
  of:
  - **Anything that costs a resource or a declaration gets a `toggle`** —
    a Channel Divinity spend, a −5/+10 choice, a "while raging" rider.
    Leaving it always-on quietly inflates every weapon on the sheet.
  - **Always-on is only for a passive that really is passive** (Improved
    Divine Smite, Aura of Hate). Add a `note` naming the restriction the
    engine can't check ("melee weapon attacks only", "once per turn") —
    it surfaces in the row's tooltip, which is what tells the player to
    untick that row's Fx box.
  - **`adddice` accumulates**, so a feature that grows from 1d8 to 2d8 at
    14th writes the *increment* — `"1d8"` plus a second `"1d8"` gated
    `when: { minClassLevel: { class: "@self", level: 14 } }`, never
    `"2d8"`. A *replacement* table (2d6 → 3d6 → 5d6 → 8d6, where the
    later number is the whole die count rather than an increment) is the
    other shape: write it as non-overlapping bands, each with both
    `minClassLevel` and `maxClassLevel`.

  A crit-only die, a widened crit range and an ability *swap* all have ops
  now (`damage-crit`, `critrange`, `useability`). Anything needing an
  actual extra attack action, a weapon proficiency, or per-weapon context
  ("heavy weapons only") is still `unsupported`.
- Anything requiring tracking a resource this sheet has no model for
  (extra reactions, uses tied to a homebrew resource pool not covered by
  the Features panel's pip-counting, rerolls, "once per turn" riders on
  attacks) → `unsupported`.

## Before you finish

**Add a `<script>` tag for your new file** to both `character-sheet.html`
and `tests/effects.html`, next to the other `effects/db/*.js` tags. A DB
file with no script tag parses fine, validates fine, and is never loaded by
anything — the entries simply never fire. The validator checks this now, but
it's the easiest step to forget.

**Move any keys you converted out of `effects/db/uses-*.js`.**
`registerEffects()` does `Object.assign`, so it replaces whole entries
rather than merging fields: if a key lives in both your batch and a
generated `uses-*.js` file, one of them wins outright and the other's data
vanishes silently (which way depends on script order). Your batch entry is
the richer record, so it keeps the key — carry the generated `uses` block
into it and delete the duplicate. Re-running `generate-uses.js` skips
already-converted keys for you.

Then run the validator:

```bash
node effects/tools/validate-db.js
```

Fix anything it flags. It checks structural shape (valid targets/ops/choice
references), fields the engine would silently ignore, duplicate keys, and
script-tag wiring — but it can't tell you whether the *mechanics* are
game-accurate, so double check values against the feature text yourself.
Two things it will catch that are worth understanding, because both look
correct and mean something else:

- `{ mod: "con", min: 1 }` is **not** "CON modifier, minimum 1" —
  `evalValue()` dispatches on the first key it recognizes and ignores the
  rest, so this is a bare CON modifier and the floor is lost. Write
  `{ max: [{ mod: "con" }, 1] }`.
- A `when` predicate the engine doesn't know (`{ wearingArmor: true }`)
  makes the effect inert forever rather than unconditional — only the keys
  listed under "Level gating" exist. `validate-db.js` checks both the key
  and its payload shape, so run it rather than trusting the read.
- Overlapping level bands all apply at once and their bonuses stack. A band
  that isn't the last one needs `maxClassLevel` as well as `minClassLevel`.

Finally, open `tests/effects.html` through the local server and confirm it
still reports `N passed, 0 failed`.
