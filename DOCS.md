# Modular Character Sheet — Documentation

An offline HTML character sheet for **D&D 5e (2014 rules)**, built for optimized play. The page (`character-sheet.html`) loads its logic from small modules in `src/`. **Serve the folder** rather than opening the file directly — there's a ready `static` config in `.claude/launch.json` (`python3 -m http.server`) — this is required for the spell/equipment libraries to auto-load (see below); browsers block `fetch()` of local files opened via `file://`. No install, no accounts; game data is user-supplied (see below).

> **Status:** prototype (v0.12), deliberately unstyled ("function over form"). Cosmetics/theming come later.

---

## Contents
- [Where game data comes from](#where-game-data-comes-from)
- [Number boxes (math input)](#number-boxes-math-input)
- [Modules](#modules)
- [Dice roller (command mode)](#dice-roller-command-mode)
- [Roll buttons](#roll-buttons)
- [Spell library (5e.tools import)](#spell-library-5etools-import)
- [Features (5e.tools import: race + class + feats)](#features-5etools-import-race--class--feats)
- [Feature effects (automatic mechanics)](#feature-effects-automatic-mechanics)
- [Equipment library (5e.tools import)](#equipment-library-5etools-import)
- [Theme](#theme)
- [Layout (move / resize / snap)](#layout-move--resize--snap)
- [Saving & loading](#saving--loading)
- [Keyboard](#keyboard)
- [Roadmap / known limits](#roadmap--known-limits)

---

## Where game data comes from
The sheet draws a line between two kinds of game data:

- **Small, fixed facts get hardcoded — mechanics only, never prose.** Things like each class's hit die and casting type (`CLASS_DATA`/`SUBCLASS_CASTING` in [data.js](src/data.js), which includes non-SRD facts like Eldritch Knight/Arcane Trickster's third-caster progression), the multiclass spellcaster slot table (`MULTICLASS_SLOTS` in [derived.js](src/derived.js)), the default magic-item prices by rarity (`RARITY_DEFAULT_GP` in [item-library.js](src/item-library.js), averaged from XGE's Magic Item Price table), and the [feature effects database](#feature-effects-automatic-mechanics) (`effects/`) are short, contain no descriptive text lifted from any sourcebook, and drive the auto-calculated fields (selectable as "auto", with an explicit override always available). The effects database in particular is inert overlay, not content — an entry only ever does anything if your own imported `data/` happens to contain a feature with a matching name.
- **Bulk or descriptive content is user-supplied.** Anything that's a lot of data (the full spell list, the equipment list, every class/race/feat's actual description text) is never bundled — you supply it yourself by dropping 5e.tools' own `data/` directory next to `character-sheet.html` (see [Spell library](#spell-library-5etools-import) / [Features](#features-5etools-import-race--class--feats) / [Equipment library](#equipment-library-5etools-import)). This is also why `data/` is gitignored rather than committed.

When adding a new auto-calculated feature, ask which bucket it falls into: a short, fixed, prose-free table → hardcode it with an override box (see Max HP and Spell Slots below, or the effects database); anything bigger, descriptive, or that reproduces sourcebook text → make it an import, not a bundled dataset.

## Number boxes (math input)
Any bounded number box (ability scores, class level, current/temp HP, AC, speed, spell slots used) accepts arithmetic:

| You type | Result (box was `30`) |
|----------|-----------------------|
| `35`     | sets to **35** (absolute) |
| `+5`     | **35** (add to current) |
| `-10`    | **20** (subtract) |
| `30+5`   | **35** (evaluates the expression) |
| `(4+1)*3`| **15** |

Values are clamped to their limits: ability scores **1–30**, class level **1–20** (total across classes also capped at 20), HP/speed **≥ 0**, current HP **≤ max HP**. (AC is auto-calculated, not a bounded number box — see HP & Defenses below.)

## Modules
- **Character** — name, race, subrace, background, and a multiclass table (each class + subclass + level + Hit Die + Casting type). Hit Die and Casting type default to **auto** — looked up from the SRD class/subclass name you type (see [Where game data comes from](#where-game-data-comes-from)) — and can be set explicitly to override the lookup. Total level auto-drives **proficiency bonus** (with an override box).
- **Ability Scores** — scores → live modifiers.
- **Saving Throws** — proficiency toggle + misc bonus → auto total, with a roll button. The **Misc** field accepts dice (e.g. `10+1d4`).
- **Skills** — proficiency / expertise (mutually exclusive) + misc → auto total + roll button. Passive Perception computed. The **Misc** field accepts dice (see [Roll buttons](#roll-buttons)).
- **HP & Defenses** — current/temp HP, speed, hit dice, auto initiative + roll button. **Max HP** is auto-calculated from each class's Hit Die & level (fixed/"consistent" value per level, not rolled) + CON mod per level, with an override box. **AC** is likewise auto-calculated (like initiative) from your equipped armor in the Inventory module: no armor equipped → 10 + DEX; light armor → armor AC + full DEX; medium → armor AC + DEX (capped at +2); heavy → armor AC alone; any equipped shield adds a flat +2 (shields don't stack). A misc field and an override box cover everything the formula can't — Unarmored Defense, natural armor, magic items not itemized in Inventory, etc.
- **Conditions** — a stacked list of toggles for the 14 conditions (hover any for a multi-line effect reminder). Checking **Paralyzed, Petrified, Stunned, or Unconscious** also flags **Incapacitated** (which they each impose).
- **Exhaustion** — a clickable 0–6 effect table: click a level to set it (click your current level to step down), with rows up to your level highlighted since the 2014 effects are cumulative.
- **Death Saves** — 3 success / 3 failure boxes, plus a **Roll Death Save** button that rolls 1d20 to the dice log and auto-marks a box (10+ success, &lt;10 failure, nat 20 clears saves and sets HP to 1, nat 1 marks two failures).
- *(Conditions, Exhaustion, and Death Saves are separate modules and, for now, display-only trackers — they don't yet auto-apply their mechanics (disadvantage, halved HP, etc.) to the sheet's math.)*
- **Inventory & Equipment** — coin purse (cp/sp/ep/gp/pp, auto-summed to a gp total via SRD exchange rates), plus a Features-styled item list: each line shows qty, name (click to show/hide its description, looked up from the Equipment Library by name), equipped toggle, and — for items that require it — an attuned toggle, with an **Attuned X/3** counter above the list. Items are added only from the Equipment Library (click "+ Add Item" to open it), same as Spells below; weight/value are looked up live from the library entry, not hand-edited. The footer totals weight and item value, and shows **total wealth = coins + items** in gp.
- **Attacks** *(draft)* — a weapons table. Per attack: an ability (Str / Dex / **Finesse** = higher of the two / —), a proficiency toggle, and Hit+/Dmg+ fields (flat or dice). From those it computes the to-hit bonus and the damage expression and gives roll buttons for each — plus an **atk+dmg** button on the far right that rolls the attack and its damage together as one log entry. The to-hit button rolls through the shared engine, so Shift/Ctrl and the right-click menu give advantage/disadvantage. *(Not yet wired: the effects engine's reserved `attack-hit`/`damage-bonus` targets — Sharpshooter, Great Weapon Master. Crits are flagged but don't auto-double damage dice.)*
- **Offensive Routines** *(draft)* — program a turn once and fire it with one click. A routine is a named list of steps: **attack steps** reference a row in the Attacks module with a count (*2× Halberd* for Extra Attack, plus *1× Halberd* for a Polearm Master bonus action), and **save steps** cover save-based effects like Toll the Dead or Fireball — no to-hit roll, instead they report **DC + which save** the target makes and roll their damage (the DC follows your own spell save DC by default, or set a custom one per step). Running a routine emits a single log block with every roll in order and a **damage total**; Shift-click **run** for advantage on every attack in it, Ctrl for disadvantage. Attack steps reference attacks by a stable id, so renaming or reordering your attacks won't break a routine (deleting one leaves the step visibly marked instead of silently mis-rolling).
- **Dice Roller** — see below.
- **Features** — import race/class/feat data to see the traits and features your race, subrace, and classes/levels grant, plus a feat picker for Ability Score Improvements. Spell grants (Cleric domain spells, Mark of \* traits, Eldritch Knight/Divine Soul/Warlock-patron/Wizard-subschool spell-list expansions, etc.) show as clickable spell names alongside the granting trait, in two flavors per 5e.tools' own data: free/innate grants (e.g. Cleric domain spells) add straight to Spellcasting under their own header, separate from and not counted against any class's Known/Prepared total; **list-expansion** grants (marked with a trailing `*`, e.g. Dragonmark or Eldritch Knight spells) only make the spell *eligible* — clicking one opens a dialog asking which class you're preparing/learning it from, and it's added as a normal spell for that class (counts toward its Known/Prepared total, shows a prepared checkbox if applicable), annotated with its granting trait's name for reference. Some grants aren't a list of names at all but a *filter* — "every EGW spell" (Chronurgy Magic), "any Wizard cantrip" (Eldritch Knight), "any level 0–3 spell, choose 1" (College of Lore). Those can't be click-to-add, so they're shown in italics as a plain description of what you're entitled to; add the ones you actually use from the Spell Library.
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
5. **Limited uses:** where a feature's [feature-effects](#feature-effects-automatic-mechanics) database entry declares a `uses` spec (max — e.g. proficiency bonus, an ability modifier with a minimum, or a fixed number — plus a short/long-rest recharge, or the delayed "roll 1d4 long rests to recharge" pattern), a row of **●/○** pips appears next to the feature showing uses remaining out of the computed max (proficiency bonus and ability modifiers are read live from your sheet). Click a pip to mark/unmark uses. **Short Rest** / **Long Rest** buttons in this module reset everything that recharges on that rest type (Short Rest also covers anything that recharges on a Long Rest); the delayed recharge is only rolled and counted down by **Long Rest**. Like the rest of the effects database, this is declared per-feature and inert unless your own imported `data/` contains a feature by that name — nothing is guessed from feature text at render time; a feature only gets a tracker once its `uses` spec has been written into the database (see [where game data comes from](#where-game-data-comes-from)).

The library itself (class/race/feat data) is cached locally, separate from your character; use counts are saved as part of your character, same as feat picks. *Subraces that use 5e.tools' internal `_copy` inheritance (mostly non-PHB reprints/variants) aren't resolved and are skipped — direct-entry subraces (the PHB ones: High Elf, Drow, Hill Dwarf, etc.) work fine. Optional/choice class features that live in their own files — Fighting Styles, Battle Master maneuvers, Warlock invocations, Metamagic, etc. — aren't imported yet.*

## Feature effects (automatic mechanics)
Some features do more than describe themselves — they change a number elsewhere on the sheet. War Wizard's Tactical Wit adds your INT modifier to initiative; Alert adds a flat +5; Tough adds 2×level to max HP. Where the sheet recognizes a feature this way, it applies the effect automatically instead of asking you to type it into a Misc box.

**How it works:** a small, hand-authored, committed database (`effects/effects-db.js` + `effects/db/*.js`) maps a feature's name and origin (e.g. `feat|alert`, `subclass|wizard|war magic|tactical wit`) to a short declarative description of its mechanics — a target (`init`, `save-con`, `hpmax`, a skill, spell DC/attack, proficiency bonus, an ability score, …), an operation (add a flat bonus, add dice, grant proficiency/expertise, force advantage/disadvantage, …), and sometimes a value expression (an ability modifier, proficiency bonus, character/class level) or a choice (which ability Resilient boosts, which skill a feature picks). See [where game data comes from](#where-game-data-comes-from) for why this database is committed while the feature *text* it describes is not: the entries contain no sourcebook prose, and are inert unless your own imported `data/` actually contains a feature by that name — the file ships mechanics as an overlay, never content.

- **Always-on effects** (Tactical Wit, Alert, Tough) just apply — no interaction needed.
- **Toggleable effects** (things you turn on/off in play) show a small button both inline next to the feature in the Features panel and in the **always-visible effects strip** just under the toolbar, so you don't have to go hunting for it mid-combat. Click either one to flip it; both stay in sync.
- **Choice-driven effects** (Resilient's chosen ability, Observant's +1 ability) show a dropdown next to the feature; the effect only applies once you've picked.
- **Auditability:** any number the engine touched gets a dotted underline — hover it (or an ability score's small `= 17` note) to see exactly which features contributed what, e.g. `+7 = +2 DEX, +5 Alert`, or `16 base +1 (Observant) = 17`. Roll-log entries are annotated the same way (`[Alert +5]`). If you've also typed something into that stat's own Misc field, the tooltip warns you to check for double-counting rather than silently stacking.
- **Not everything is automatable yet.** Anything that would require a weapons/attacks table (Sharpshooter's −5/+10, Great Weapon Master) is recognized and shown — its toggle renders but stays disabled, labeled "serialized; attacks module not implemented yet" — so it'll switch on automatically once that module exists, with no re-conversion needed. Anything the engine genuinely can't represent (Lucky's reroll, anything needing a roll-history model) shows a plain `⚠ not automated` marker with the reason on hover. The effects strip's coverage counter (e.g. "3 feature effect(s) not automated") totals both categories so gaps are visible, never silent.
- Coverage today: a handful of hand-written entries proving the schema (`effects/db/handwritten.js`) plus a full pass over the 2014 feats (`effects/db/feats.js`, generated by an LLM conversion pass over `data/feats.json` and merged after passing `effects/tools/validate-db.js` — see `effects/tools/conversion-guide.md` for the schema/process used). Classes, subclasses, and races aren't converted yet — same pipeline, just not run over them yet; nothing in it talks to your character or your `data/` folder without you explicitly running it.

## Equipment library (5e.tools import)
Same zero-click setup as the spell library, and deliberately the simplest importer on the sheet:
1. With the same `data/` folder in place (see above), the sheet auto-fetches `data/items-base.json` (mundane gear, weapons, armor) and `data/items.json` (magic items) on load — no format to pick, no per-file settings.
2. **Reload from data/ folder** re-runs the fetch; the **import files** picker below it is the fallback for `file://` use or homebrew item files.
3. The library is cached locally, so this only costs time once.

**Browsing:** a single **search** box matches name, type, rarity, and source all at once — type "potion", "rare", or "phb" and it filters. Results show name, type, rarity, weight (lb), and value (gp, converted from 5e.tools' copper-piece figure). Click **`+`** to add a row straight into your Inventory table (qty 1, weight and value pre-filled) — from there it's counted in the item-value and total-wealth sums automatically.

**Default magic item prices:** individual magic items rarely carry an explicit price in the source data — when one doesn't, the sheet fills in the average of XGE's "Magic Item Price" table (Xanathar's Guide to Everything, p.126) instead of leaving it blank: **common 45gp · uncommon 350gp · rare 11,000gp · very rare 35,000gp · legendary 175,000gp** (halved for single-use consumables, per that table's own footnote, when the item's data marks it as one). Artifact/varies/unknown-rarity items are left blank rather than guessed — that table doesn't cover them. Defaulted values show with a `~` prefix in the results table so they're never confused for an item's actual listed price.

*Note: nothing from 5e.tools is bundled with the sheet; `data/` is gitignored — you supply it, it's parsed in your browser.*

## Theme
The **Theme** dropdown in the toolbar swaps the sheet's look via `css/themes/*.css` (each just redefines the CSS custom properties set on `:root` in `css/base.css` — colors, borders, fonts). Ships with 7 alternates (Illuminated Manuscript, Cyber Grimoire, Blood Moon Gothic, Verdant Feywild, Infernal Bronze, Celestial Aurora, Deep Sea Leviathan) alongside the plain **Default (unstyled)** look; your choice is remembered (localStorage) across reloads. Drop your own `css/themes/your-theme.css` and add it to `css/themes/index.json` to add more.

## Layout (move / resize / snap)
By default modules flow down the page. The **Layout** bar (above the modules) turns on free-form arranging:
- **Free (move/resize)** — EDIT mode. Modules become freely positioned; **drag anywhere on a module** to move it, and **drag any edge or corner** (8 handles) to resize. While editing, the modules' inputs are disabled and text-selection is off (so dragging never fights the controls), and — when snap-to-grid is on — a grey grid is overlaid. The arrangement is **kept when you turn Free off**; leaving edit mode just re-enables the inputs, it doesn't revert your layout.
- **Snap to grid** — positions and sizes (drag **and** resize) snap to a grid; the **grid** box sets the cell size in px. When editing with snap-to-grid on, a grey grid is overlaid.
- **Snap to modules** — while dragging or resizing, edges snap to align with (or sit flush against) other modules' edges.
- **Multi-select** — drag a box across empty space to marquee-select modules (Shift-click to add/remove one; Esc clears). Then **drag any selected module to move them all together**, or drag the selection box's handles to **resize them all at once**. A module you move jumps to the **front and stays there**.
- While dragging, the page **auto-scrolls** when you near an edge (faster the closer you get), and modules track the scroll so they never lag behind.
- **reset** returns to the default flow; **save file** / **load** export and import the arrangement as a JSON file.

When a module is smaller than its content (after resizing), it **scrolls** — mouse wheel, scrollbars on both axes, and native middle-click autoscroll — as long as you're **not** in Free mode. (While Free is on, overflow is clipped instead, so the resize handles stay pinned to the module's edges rather than scrolling away.)

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
- A step-by-step character creator, rules-as-written defaults with house-rule toggles, and an allowed-books toggle list are planned.
- **Rules-reference buttons** — a small **ⓘ** button next to relevant elements (conditions, exhaustion, death saves, features, spells, etc.) that opens a popover quoting the relevant rules text and its sourcebook page number, so you can check the exact wording without leaving the sheet.
- **Not planned:** personality traits, ideals, bonds, flaws, backstory, and appearance fields (age/height/eyes/etc.). This sheet targets optimized play, not roleplay journaling — that content belongs in a separate document, not on the sheet.
- **[Feature effects](#feature-effects-automatic-mechanics)** now cover all 2014 feats (`effects/db/feats.js`, converted from `data/feats.json` and validated by `effects/tools/validate-db.js`) plus a handful of hand-written class/subclass examples, and only targets that already exist on the sheet (initiative, saves, skills, passive perception, max HP, spell DC/attack, proficiency bonus, ability scores). Effects that need a weapons/attacks table (Sharpshooter, GWM, and similar feats) are recognized and serialized but stay disabled until that module exists. Running the same conversion pipeline over class/subclass features and races is the next step.
- **Missing vs. big-name sheets (D&D Beyond, Roll20, Fight Club 5e), still worth doing:**
  - Weapons/attacks table with to-hit and damage roll buttons — **drafted** (the Attacks module). Still to wire: the effects engine's reserved `attack-hit`/`damage-bonus` targets (Sharpshooter/GWM), and melee/ranged/thrown niceties.
  - Proficiencies — armor, weapon, tool, and language proficiencies have no home (only skill/save proficiency toggles exist).
  - Death saves, exhaustion, and a conditions tracker — **done** (three separate modules; mechanically applying their effects is the next step).
  - A concentration indicator tied to the currently-active concentration spell (spell data already flags `conc`, just not surfaced as an active tracker).
  - Short/long rest buttons that auto-restore HP, hit dice, and spell slots.
  - Resistances/immunities/vulnerabilities, an XP tracker, and a print/PDF-friendly view.
