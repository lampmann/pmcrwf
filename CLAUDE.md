# Working on pmcrwf

## UI copy
- Keep interface text terse. Labels, values and the rule itself; no hint lines that explain what a control does, reassure, or narrate ("it goes on the sheet's Features module too"). If a sentence would only be read once, leave it out.
- No labels that only announce a feature or a fix ("(multiclass supported)", "all effects automated"). If it means nothing to someone opening the sheet for the first time, it goes.
- No em-dashes or middle dots in anything user-visible, commit messages, or new code comments. Use " - " or " | " instead (the sheet already uses " | " as its separator).
- Lists a user picks from are alphabetical. Abilities stay in STR, DEX, CON, INT, WIS, CHA order.

## Data
- `data/` and `characters/` are gitignored and must never be committed: game data is the user's own.
- Read structured fields from the 5e.tools records rather than parsing prose; when a record lacks a field, leave the choice to the player instead of guessing.

## Tests
- `node tools/run-browser-tests.cjs` runs every harness in `tests/` plus the browser checks in `tools/`. Move any local `data/` folder aside first: the runner serves the repo root and real data changes what the fixtures see.
