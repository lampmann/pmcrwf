# Modular Character Sheet — Documentation

A single-file, offline HTML character sheet for **D&D 5e (2014 rules)**, built for optimized play.
Open `character-sheet.html` in any modern browser. No install, no server, no account.

> **Status:** prototype (v0.6), deliberately unstyled ("function over form"). Cosmetics/theming come later.

---

## Contents
- [Where game data comes from](#where-game-data-comes-from)
- [Number boxes (math input)](#number-boxes-math-input)
- [Modules](#modules)
- [Dice roller (command mode)](#dice-roller-command-mode)
- [Roll buttons](#roll-buttons)
- [Spell library (5e.tools import)](#spell-library-5etools-import)
- [Saving & loading](#saving--loading)
- [Keyboard](#keyboard)
- [Roadmap / known limits](#roadmap--known-limits)

---

## Where game data comes from
The sheet draws a line between two kinds of game data:

- **Small SRD facts get hardcoded.** Things like each class's hit die and casting type (`CLASS_DATA`/`SUBCLASS_CASTING` in [data.js](src/data.js)), or the multiclass spellcaster slot table (`MULTICLASS_SLOTS` in [derived.js](src/derived.js)), are short, fixed, and covered by the SRD — so they live directly in the code as lookup tables and drive the auto-calculated fields (selectable as "auto", with an explicit override always available).
- **Large or non-SRD content is user-supplied.** Anything that's a lot of data (the full spell list) or not in the SRD (most sourcebook content beyond it) is never bundled — you import it yourself (see [Spell library](#spell-library-5etools-import)). This is also why `spells-*.json` files are gitignored rather than committed.

When adding a new auto-calculated feature, ask which bucket it falls into: a small SRD table → hardcode it with an override box (see Max HP and Spell Slots below); anything bigger or non-SRD → make it an import, not a bundled dataset.

## Number boxes (math input)
Any bounded number box (ability scores, class level, current/temp HP, AC, speed, spell slots used) accepts arithmetic:

| You type | Result (box was `30`) |
|----------|-----------------------|
| `35`     | sets to **35** (absolute) |
| `+5`     | **35** (add to current) |
| `-10`    | **20** (subtract) |
| `30+5`   | **35** (evaluates the expression) |
| `(4+1)*3`| **15** |

Values are clamped to their limits: ability scores **1–30**, class level **1–20** (total across classes also capped at 20), HP/AC/speed **≥ 0**, current HP **≤ max HP**.

## Modules
- **Character** — name, race, background, and a multiclass table (each class + subclass + level + Hit Die + Casting type). Hit Die and Casting type default to **auto** — looked up from the SRD class/subclass name you type (see [Where game data comes from](#where-game-data-comes-from)) — and can be set explicitly to override the lookup. Total level auto-drives **proficiency bonus** (with an override box).
- **Ability Scores** — scores → live modifiers.
- **Saving Throws** — proficiency toggle + misc bonus → auto total, with a roll button.
- **Skills** — proficiency / expertise (mutually exclusive) + misc → auto total + roll button. Passive Perception computed.
- **HP & Defenses** — current/temp HP, AC, speed, hit dice, auto initiative + roll button. **Max HP** is auto-calculated from each class's Hit Die & level (fixed/"consistent" value per level, not rolled) + CON mod per level, with an override box.
- **Dice Roller** — see below.
- **Spell Library** — import & search spells; see below.
- **Spellcasting** — spellcasting ability → auto save DC & spell attack; spell-slot grid **auto-calculated from total casting level** (per the multiclass spellcaster table — Warlock/Pact levels aren't included, since Pact Magic is a separate slot pool), with a per-level override box; spell table with per-spell to-hit and damage roll buttons.

## Dice roller (command mode)
Type a command and press **Enter**. Prefix is `/` (also accepts `!`). Bare notation works too (`4d6kh3`).

| Command | Meaning |
|---------|---------|
| `/r <roll>` or `/roll` | roll dice |
| `/rr <N> <roll>` or `/multiroll` | roll N times (N and roll may be swapped if no label) |
| `/rrr <N> <DC> <roll>` or `/iterroll` | roll N times, count successes vs DC |
| `clear` | clear the log |

**Roll syntax** (5eCrawler / Avrae compatible):
- Dice: `2d6`, `1d20+5`, `2d6+1d4+3`, `1d4*2`, with `+ - *` and parentheses.
- Keep/drop: `4d6kh3` (keep highest 3), `kl`, `ph`, `pl`, `k>4`, `p<2`.
- Reroll: `ro` (once), `rr` (infinite), `ra` (reroll & add). e.g. `8d6ro<3`.
- Explode: `e` (on max) or `e6`. Min/max each die: `mi2`, `ma5`.
- `adv` / `dis` — rolls the d20 with advantage/disadvantage (ignored if there's no d20).
- Label: any text after the roll (`/r 1d20+7 Stealth`). Annotations: `4d6mi2[fire]`.

**Crits:** only the kept **d20** triggers *Critical Success* (nat 20) / *Critical Failure* (nat 1) — other dice never do. (This deliberately fixes a 5eCrawler bug.)

## Roll buttons
Every save / skill / initiative / spell-attack has a `roll` button that uses its computed bonus.
- **Shift-click** = advantage, **Ctrl-click** = disadvantage.
- Hold **Shift / Ctrl** while hovering a roll button to see the active mode as a tooltip.
- **Right-click** a roll button for a *Normal / Advantage / Disadvantage* menu.

## Spell library (5e.tools import)
1. Download the 5e.tools source data. Spells live in `data/spells/`.
2. **Load spell files** → pick one or more `spells-*.json`. **Use 2014 files** (`spells-phb.json`, `spells-xge.json`, `spells-tce.json`, …) — **not** `spells-xphb.json` (that's the 2024 PHB).
3. The library is cached locally, so you only import once.

**Browsing:** Each filter category (Source, Level, School, Damage, Save, Cast, Components, Misc) is a row of **tri-state buttons** — click a button to cycle **neutral → include (blue) → exclude (red)**.
- **Per category:** `All` (include all), `Clear` (neutral), `None` (exclude all), a **blue** combine-mode button (how the include buttons combine) and a **red** one (how the excludes combine) — each cycles `OR → AND → XOR` — and `Hide`.
- **Module bar:** `Combine as AND/OR` (how categories combine with each other), `Show All` / `Hide All`, `Reset`, and `Manage Defaults` (saves the current filters as the default that `Reset` restores).
- **Source** buttons show the full book name on hover. A plain **search** box filters by name.
- Click **`+`** on a spell to add it to your Spellcasting table (fills name, level, and damage — cantrip damage scales to your current level).

*Note: nothing from 5e.tools is bundled with the sheet; you supply the JSON, it's parsed in your browser.*

## Saving & loading
- **Autosave** to the browser (localStorage) on every change.
- **Export JSON** downloads your character. **Import** loads one back. **Reset** clears the sheet.
- The spell library is stored separately from your character.

## Keyboard
- **Enter** in a number box commits the math and moves on.
- **Enter** on a focused checkbox toggles it.
- **Enter** in the dice box runs the command.

## Roadmap / known limits
- Layout engine (drag / resize / snap-to-grid), theming, and icon variants — not built yet.
- Class-features / feats / items / races importers — spells only, for now.
- Spell rows: save spells still show a "to hit" button; leveled-spell damage shows base dice only (no upcast math); cantrip damage is set at add-time.
- **Deferred spell filters** (data mostly parsed already, easy to add): Conditions Inflicted, Spell Attack type (melee/ranged), Range, Area style, Duration, Cast-time sub-types, and **Class/Subclass** (needs the class→spell mapping). 5etools' Core/Supplements/Adventures source *groupings* are also deferred (individual sources work).
- A step-by-step character creator, rules-as-written defaults with house-rule toggles, and an allowed-books toggle list are planned.
