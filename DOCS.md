# Modular Character Sheet — Documentation

An offline HTML character sheet for **D&D 5e (2014 rules)**, built for optimized play. The page (`character-sheet.html`) loads its logic from small modules in `src/`. **Serve the folder** rather than opening the file directly — there's a ready `static` config in `.claude/launch.json` (`python3 -m http.server`) — this is required for the spell/equipment libraries to auto-load (see below); browsers block `fetch()` of local files opened via `file://`. No install, no accounts; game data is user-supplied (see below).

> **Status:** prototype (v0.10), deliberately unstyled ("function over form"). Cosmetics/theming come later.

---

## Contents
- [Where game data comes from](#where-game-data-comes-from)
- [Number boxes (math input)](#number-boxes-math-input)
- [Modules](#modules)
- [Dice roller (command mode)](#dice-roller-command-mode)
- [Roll buttons](#roll-buttons)
- [Spell library (5e.tools import)](#spell-library-5etools-import)
- [Features (5e.tools import: race + class + feats)](#features-5etools-import-race--class--feats)
- [Equipment library (5e.tools import)](#equipment-library-5etools-import)
- [Theme](#theme)
- [Layout (move / resize / snap)](#layout-move--resize--snap)
- [Saving & loading](#saving--loading)
- [Keyboard](#keyboard)
- [Roadmap / known limits](#roadmap--known-limits)

---

## Where game data comes from
The sheet draws a line between two kinds of game data:

- **Small SRD facts get hardcoded.** Things like each class's hit die and casting type (`CLASS_DATA`/`SUBCLASS_CASTING` in [data.js](src/data.js)), the multiclass spellcaster slot table (`MULTICLASS_SLOTS` in [derived.js](src/derived.js)), or the default magic-item prices by rarity (`RARITY_DEFAULT_GP` in [item-library.js](src/item-library.js), averaged from XGE's Magic Item Price table), are short, fixed, and covered by the SRD/sourcebooks — so they live directly in the code as lookup tables and drive the auto-calculated fields (selectable as "auto", with an explicit override always available).
- **Large or non-SRD content is user-supplied.** Anything that's a lot of data (the full spell list, the equipment list) or not in the SRD (most sourcebook content beyond it) is never bundled — you supply it yourself by dropping 5e.tools' own `data/` directory next to `character-sheet.html` (see [Spell library](#spell-library-5etools-import) / [Equipment library](#equipment-library-5etools-import)). This is also why `data/` is gitignored rather than committed.

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
- **Character** — name, race, subrace, background, and a multiclass table (each class + subclass + level + Hit Die + Casting type). Hit Die and Casting type default to **auto** — looked up from the SRD class/subclass name you type (see [Where game data comes from](#where-game-data-comes-from)) — and can be set explicitly to override the lookup. Total level auto-drives **proficiency bonus** (with an override box).
- **Ability Scores** — scores → live modifiers.
- **Saving Throws** — proficiency toggle + misc bonus → auto total, with a roll button. The **Misc** field accepts dice (e.g. `10+1d4`).
- **Skills** — proficiency / expertise (mutually exclusive) + misc → auto total + roll button. Passive Perception computed. The **Misc** field accepts dice (see [Roll buttons](#roll-buttons)).
- **HP & Defenses** — current/temp HP, AC, speed, hit dice, auto initiative + roll button. **Max HP** is auto-calculated from each class's Hit Die & level (fixed/"consistent" value per level, not rolled) + CON mod per level, with an override box.
- **Inventory & Equipment** — coin purse (cp/sp/ep/gp/pp, auto-summed to a gp total via SRD exchange rates), plus a Features-styled item list: each line shows qty, name (click to show/hide its description, looked up from the Equipment Library by name), equipped toggle, and — for items that require it — an attuned toggle, with an **Attuned X/3** counter above the list. Items are added only from the Equipment Library (click "+ Add Item" to open it), same as Spells below; weight/value are looked up live from the library entry, not hand-edited. The footer totals weight and item value, and shows **total wealth = coins + items** in gp.
- **Dice Roller** — see below.
- **Features** — import race/class/feat data to see the traits and features your race, subrace, and classes/levels grant, plus a feat picker for Ability Score Improvements. Spell grants (Cleric domain spells, Mark of \* traits, Eldritch Knight/Divine Soul/Warlock-patron/Wizard-subschool spell-list expansions, etc.) show as clickable spell names alongside the granting trait, in two flavors per 5e.tools' own data: free/innate grants (e.g. Cleric domain spells) add straight to Spellcasting under their own header, separate from and not counted against any class's Known/Prepared total; **list-expansion** grants (marked with a trailing `*`, e.g. Dragonmark or Eldritch Knight spells) only make the spell *eligible* — clicking one opens a dialog asking which class you're preparing/learning it from, and it's added as a normal spell for that class (counts toward its Known/Prepared total, shows a prepared checkbox if applicable), annotated with its granting trait's name for reference.
- **Spellcasting** — spellcasting ability → auto save DC & spell attack; a collapsed **Spell Library** subsection (click "+ Add Spell" to open it) for importing & searching spells; spell-slot grid **auto-calculated from total casting level** (per the multiclass spellcaster table — Warlock/Pact levels aren't included, since Pact Magic is a separate slot pool), with a per-level override box; a Features-styled **Spells** list (grouped by class, added only from the Spell Library) with a known/prepared/cantrip counter per class, plus a separate group per granted-spell source (domain/subrace).

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
- A stat's **Misc** field may contain **dice** (e.g. `10+1d4`): the flat part folds into the shown total, and the dice are appended to the roll — handy for always-on effects like Pass Without Trace + Guidance on Stealth.

## Spell library (5e.tools import)
**Zero-click setup:** download the [5e.tools source data](https://github.com/5etools-mirror-3/5etools-2014-src) (the whole repo, or just its `data/` folder) and drop that `data/` folder next to `character-sheet.html`, so `data/spells/index.json` exists at that relative path. Reload the page — the sheet fetches `data/spells/index.json`, then every spell file it lists (`spells-phb.json`, `spells-xge.json`, …), and merges them in automatically. **Use the 2014 data** — the mirror above is the 2014 ruleset; don't point it at a 2024-only clone, and any stray `spells-xphb.json` (2024 PHB) is simply ignored since it's not referenced by the 2014 index.
- The **reload from data/ folder** button re-runs the fetch (e.g. after you add more source files) without a full page reload.
- If auto-load can't find `data/`, or the page was opened via `file://` (browsers block local-file `fetch()`), a status message next to the count explains which — and the old manual **import files** picker below it still works as a fallback for one-off or homebrew files.
- The library is cached locally either way, so this only costs time on first load.

This panel is **collapsed by default** — click **+ Add Spell** in the Spellcasting module (below) to open it; it stays open until you click that again.

**Browsing:** Each filter category (Source, Class, Level, School, Damage, Save, Cast, Components, Misc) is a row of **tri-state buttons** — click a button to cycle **neutral → include (blue) → exclude (red)**.
- **Per category:** `All` (include all), `Clear` (neutral), `None` (exclude all), a **blue** combine-mode button (how the include buttons combine) and a **red** one (how the excludes combine) — each cycles `OR → AND → XOR` — and `Hide`.
- **Module bar:** `Combine as AND/OR` (how categories combine with each other), `Show All` / `Hide All`, `Reset`, and `Manage Defaults` (saves the current filters as the default that `Reset` restores).
- **Source** buttons show the full book name on hover. A plain **search** box filters by name.
- **Class** is populated from `data/spells/sources.json` (5e.tools' separate per-spell class-list file — not part of `spells-*.json` itself), auto-fetched alongside the spell files; also detected by filename in the manual import picker. Without it, this row shows no buttons.
- Results are shown in aligned columns (level, name, school, save/attack, damage, conc, ritual, source).
- Click a spell's **name** to expand its full **description** (and higher-level text); click again to collapse.
- Click **`+`** to add it to whichever class is selected in the **Add to class** dropdown above the search box (auto-set to your only spellcasting class; pick one yourself if you're multiclassed) — it appears in the Spellcasting module's Spells list under that class.

*Note: nothing from 5e.tools is bundled with the sheet; `data/` is gitignored — you supply it, it's parsed in your browser.*

**Spells list (in the Spellcasting module):** spells you've added render like the Features panel — grouped by class, click a spell's **name** to expand its description with clickable inline dice (click a die roll to roll it) and "spell attack" text (click to make that attack, same as the old to-hit roll). Leveled spells get a **prepared** checkbox (cantrips don't — they're always available); **x** removes a spell. Above each class's spells, a summary line shows **Cantrips**, and either **Known** (Bard/Ranger/Sorcerer/Warlock/Eldritch Knight/Arcane Trickster) or **Prepared** (and, for Wizards, **Spellbook** too) against that class's computed maximum — these are informational only and never stop you from adding more.

## Features (5e.tools import: race + class + feats)
Same zero-click setup as the equipment library:
1. With the same `data/` folder in place (see above), the sheet auto-fetches the 2014 `class-*.json` files (fighter, wizard, etc.) from `data/class/`, plus `data/races.json` and `data/feats.json`, on load — no picker needed. **Reload from data/ folder** re-runs the fetch; **import files** below it is the fallback for `file://` use, or homebrew class/race/feat files (auto-detected by content, so class/race/feat JSON can all be dropped into the same picker).
2. The panel reads your **Race** + **Subrace** fields and lists your racial traits, then reads your **Classes** table (class name, subclass, level) and lists every class feature and matching subclass feature you'd have at that level. Names match case-insensitively; it updates live as you edit any of those fields.
3. Click a feature's **name** to expand its description; click again to collapse.
4. For any feature literally named **Ability Score Improvement**, a **Feat** dropdown appears next to it (populated from `feats.json`) — pick one and its description shows in place of the ASI's own boilerplate when you expand that feature. Your picks are saved as part of your character (export/import), not just cached locally like the rest of the library.
5. **Limited uses:** feature/feat text is scanned for a handful of common finite-use phrasings — e.g. "a number of times equal to your proficiency bonus / your \<Ability\> modifier", "you can use this \[ability/feature/reaction\] twice", "once per day", and the delayed "...you can't use it again until you finish 1d4 long rests" pattern — and, where recognized, a row of **●/○** pips appears next to the feature showing uses remaining out of the computed max (proficiency bonus and ability modifiers are read live from your sheet). Click a pip to mark/unmark uses. **Short Rest** / **Long Rest** buttons in this module reset everything that recharges on that rest type (Short Rest also covers anything that recharges on a Long Rest); the "1d4 long rests" style delayed recharge is only rolled and counted down by **Long Rest**. This is phrasing-based, not a full rules engine — features worded differently (e.g. "you have 3 luck points") won't be picked up.

The library itself (class/race/feat data) is cached locally, separate from your character; use counts are saved as part of your character, same as feat picks. *Subraces that use 5e.tools' internal `_copy` inheritance (mostly non-PHB reprints/variants) aren't resolved and are skipped — direct-entry subraces (the PHB ones: High Elf, Drow, Hill Dwarf, etc.) work fine. Optional/choice class features that live in their own files — Fighting Styles, Battle Master maneuvers, Warlock invocations, Metamagic, etc. — aren't imported yet.*

## Equipment library (5e.tools import)
Same zero-click setup as the spell library, and deliberately the simplest importer on the sheet:
1. With the same `data/` folder in place (see above), the sheet auto-fetches `data/items-base.json` (mundane gear, weapons, armor) and `data/items.json` (magic items) on load — no format to pick, no per-file settings.
2. **Reload from data/ folder** re-runs the fetch; the **import files** picker below it is the fallback for `file://` use or homebrew item files.
3. The library is cached locally, so this only costs time once.

**Browsing:** a single **search** box matches name, type, rarity, and source all at once — type "potion", "rare", or "phb" and it filters. Results show name, type, rarity, weight (lb), and value (gp, converted from 5e.tools' copper-piece figure). Click **`+`** to add a row straight into your Inventory table (qty 1, weight and value pre-filled) — from there it's counted in the item-value and total-wealth sums automatically.

**Default magic item prices:** individual magic items rarely carry an explicit price in the source data — when one doesn't, the sheet fills in the average of XGE's "Magic Item Price" table (Xanathar's Guide to Everything, p.126) instead of leaving it blank: **common 45gp · uncommon 350gp · rare 11,000gp · very rare 35,000gp · legendary 175,000gp** (halved for single-use consumables, per that table's own footnote, when the item's data marks it as one). Artifact/varies/unknown-rarity items are left blank rather than guessed — that table doesn't cover them. Defaulted values show with a `~` prefix in the results table so they're never confused for an item's actual listed price.

*Note: nothing from 5e.tools is bundled with the sheet; `data/` is gitignored — you supply it, it's parsed in your browser.*

## Theme
The **Theme** dropdown in the toolbar swaps the sheet's look via `css/themes/*.css` (each just redefines the CSS custom properties set on `:root` in `css/base.css` — colors, borders, fonts). Ships with 5 alternates (Illuminated Manuscript, Cyber Grimoire, Blood Moon Gothic, Verdant Feywild, Infernal Bronze) alongside the plain **Default (unstyled)** look; your choice is remembered (localStorage) across reloads. Drop your own `css/themes/your-theme.css` and add it to `css/themes/index.json` to add more.

## Layout (move / resize / snap)
By default modules flow down the page. The **Layout** bar (above the modules) turns on free-form arranging:
- **Free (move/resize)** — EDIT mode. Modules become freely positioned; **drag anywhere on a module** to move it, and **drag any edge or corner** (8 handles) to resize. While editing, the modules' inputs are disabled and text-selection is off (so dragging never fights the controls), and — when snap-to-grid is on — a grey grid is overlaid. The arrangement is **kept when you turn Free off**; leaving edit mode just re-enables the inputs, it doesn't revert your layout.
- **Snap to grid** — positions and sizes (drag **and** resize) snap to a grid; the **grid** box sets the cell size in px. When editing with snap-to-grid on, a grey grid is overlaid.
- **Snap to modules** — while dragging or resizing, edges snap to align with (or sit flush against) other modules' edges.
- **Multi-select** — drag a box across empty space to marquee-select modules (Shift-click to add/remove one; Esc clears). Then **drag any selected module to move them all together**, or drag the selection box's handles to **resize them all at once**. A module you move jumps to the **front and stays there**.
- While dragging, the page **auto-scrolls** when you near an edge (faster the closer you get), and modules track the scroll so they never lag behind.
- **reset** returns to the default flow; **save file** / **load** export and import the arrangement as a JSON file.

Your arrangement is also saved locally (separate from the character; per browser). Styles live in [css/layout.css](css/layout.css) (theme-aware) and the logic in [layout.js](src/layout.js) — a self-contained module that works on any `.module`, so new modules are automatically arrangeable.

*(Known rough edge: a module's text can reflow oddly mid-resize — to be smoothed once the modules are finalized.)*

## Saving & loading
- **Autosave** to the browser (localStorage) on every change.
- **Export JSON** downloads your character. **Import** loads one back. **Reset** clears the sheet.
- The spell library and equipment library are stored separately from your character.

## Keyboard
- **Enter** in a number box commits the math and moves on.
- **Enter** on a focused checkbox toggles it.
- **Enter** in the dice box runs the command.

## Roadmap / known limits
- Layout engine (drag / resize / snap-to-grid) and icon variants — not built yet.
- Spell damage shown/rolled from an expanded spell description is base dice only (no upcast math beyond what 5e.tools' own scaling data already resolves for cantrips).
- **Deferred spell filters** (data mostly parsed already, easy to add): Conditions Inflicted, Spell Attack type (melee/ranged), Range, Area style, Duration, Cast-time sub-types. 5etools' Core/Supplements/Adventures source *groupings* are also deferred (individual sources work).
- **Inventory and equipment revamp** Bring it up to standard with the spellcasting section, ideally copy functionality to make them similar.
- A step-by-step character creator, rules-as-written defaults with house-rule toggles, and an allowed-books toggle list are planned.
- **Not planned:** personality traits, ideals, bonds, flaws, backstory, and appearance fields (age/height/eyes/etc.). This sheet targets optimized play, not roleplay journaling — that content belongs in a separate document, not on the sheet.
- **Missing vs. big-name sheets (D&D Beyond, Roll20, Fight Club 5e), still worth doing:**
  - Weapons/attacks table (melee & ranged, separate from the spell table) with to-hit and damage roll buttons.
  - Proficiencies — armor, weapon, tool, and language proficiencies have no home (only skill/save proficiency toggles exist).
  - Death saves, exhaustion, and a conditions tracker.
  - A concentration indicator tied to the currently-active concentration spell (spell data already flags `conc`, just not surfaced as an active tracker).
  - Short/long rest buttons that auto-restore HP, hit dice, and spell slots.
  - Resistances/immunities/vulnerabilities, an XP tracker, and a print/PDF-friendly view.
