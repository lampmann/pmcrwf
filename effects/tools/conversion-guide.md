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
- `"spell-grant"` — grants a spell (fixed name only — see below).

Do **not** invent other targets (no `ac`, `speed`, `hitdice`, etc. — not
wired up yet). If a feat needs one of those, use `unsupported` instead.

## Ops

- `add` — add a flat number (`value` required, see Value expressions)
- `adddice` — append dice notation, e.g. `value: "1d4"` (string)
- `min` / `max` — clamp: raises/lowers the target to at least/at most `value`
- `set` — force the target to exactly `value`
- `grant-free` / `grant-list` — see "Spell grants" below (only valid on
  target `"spell-grant"`)
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

## Level gating (optional `when` on an effect, alongside `activation`)

`{ when: { minLevel: N } }` only applies the effect once the character's
**total character level** (not class level — this is a known approximation;
see below) is at least N. Use this for a feature whose numeric effect
itself scales up at a later level within the *same* named feature (see
"Recurring/leveled features" below) — never invent a conditional inside a
value expression, `when` is the only conditional the engine has.

Because `minLevel` reads *total* level (multiclassing-aware, matches
`totalLevel()`), not "levels in this class," a effect gated this way is
approximate for multiclass characters (e.g. a Cleric 6 / Fighter 4 has
total level 10, so a `minLevel: 6` Cleric effect and a `minLevel: 8`
Fighter effect both read the same combined number). This is the existing
engine's limitation, not something to work around — just be aware a
`when`-gated entry is slightly optimistic for heavily multiclassed
characters, same tradeoff the rest of the sheet already makes (see
`profBonus()`, spell slots, etc., all keyed off total level too).

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
first pair and a second choice gated `when: { minLevel: 6 }` for the rest.

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

Two ops, matching the two ways 5e text grants a spell:

- `grant-free` — the spell is known/prepared **for free**: it never costs
  a known/prepared slot on any class, and doesn't count toward that
  class's Known/Prepared total. This is the "you innately know this
  spell, no strings attached" case (e.g. Telekinetic's Mage Hand).
- `grant-list` — the spell is merely **added to the character's spell
  list** — it's now *eligible*, but still has to be learned/prepared
  normally through a class, costing a real known/prepared slot there (e.g.
  a Dragonmark or Eldritch Knight-style list expansion).

**When to reach for this vs. `unsupported`:** only for a spell named
outright in the text with no further choice attached. If the text instead
says "choose a spell from the Wizard list" / "any level 1 spell of your
choice" — anything requiring picking from a filtered list rather than one
named spell — that's `unsupported` (reason: e.g. "spell chosen from a
class list — no way to enumerate/filter the spell library from an effects
entry"); don't try to fake it by picking one representative spell.

**This is not for at-will/daily innate casting** ("you can cast *X* once
per day without expending a spell slot") — that's a different mechanic
(no known/prepared slot is ever involved, and it needs its own uses/cast
tracking) and stays `unsupported` (reason: "at-will/daily innate
spellcasting, not modeled — no slot involved at all").

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
(Resilient), reserved attack-target + toggle (Sharpshooter), and a fixed
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
die), use `choices`/`effects` gated with `when: { minLevel: N }` (see
"Level gating" above) for the later-level increment — e.g. Expertise:
a `pick` choice for the level-1-or-3 picks (always active) plus a second
`pick` choice for the later-level picks, gated `when: { minLevel: N }`
using the *class's* stated level (accepting the total-level approximation
documented above).

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
  makes the effect inert forever rather than unconditional — only
  `minLevel`, `hasClass`, and `casting` exist.

Finally, open `tests/effects.html` through the local server and confirm it
still reports `N passed, 0 failed`.
