# pmcrwf

pmcrwf is an offline, single-page HTML character sheet for **D&D 5e (2014 rules)**, built for optimized play. It's extremely customizable, runs entirely in your browser with no account or internet connection, and is fully AI-made — zero lines of code were written by humans.

## Features
- **Automatic math** — ability modifiers, saving throws, skills, passive Perception, AC, spell save DC/attack, spell slots, and more. Homebrew or an odd modifier? Every calculated value has an override box.
- **Dice roller** — a 5eCrawler/Avrae-compatible command roller, roll buttons on every stat (Shift = advantage, Ctrl = disadvantage, right-click for a menu), and clickable inline dice inside feature/spell text.
- **Import from 5e.tools** — spells, features (race/class/feat), and equipment load from your own copy of the 5e.tools data (see setup below). Nothing from 5e.tools is bundled with this repo.
- **Automatic feature effects** — recognized feats/features apply their mechanics for you (Alert's +5 initiative, Tough's HP, etc.), with a hover audit trail showing what contributed to each number.
- **Companions & summons** — add any statblock from the bestiary to your own sheet: familiars, steeds, wild shapes, and summons. Tracked as a stack (one entry, eight wolves, each with its own HP) with an **×N all** button that rolls the whole stack's attacks into one damage-by-AC table, and Tasha's-style summons that scale off *your* spell attack bonus and cast level.
- **Trackers** — conditions, exhaustion, death saves, and limited-use features with short/long-rest recovery.
- **Free-form layout** — drag, resize, and snap modules wherever you want them; save the arrangement to a file.
- **Themes** — swappable CSS themes; add your own by dropping a file in `css/themes/`.
- **Your data stays yours** — autosaves to your browser, with JSON export/import for the whole character.

## Getting started

You need two things: **the sheet's files** and **a way to serve them locally** (a tiny web server — opening the `.html` file directly won't work, because browsers block local file loading).

### 1. Get the files
Download this repository (green **Code** button → **Download ZIP**, then unzip it) or `git clone` it. You'll end up with a folder containing `character-sheet.html`, `src/`, `css/`, etc.

### 2. Add the 5e.tools data (strongly recommended)
Most of the sheet (spells, features, equipment) is empty until you supply the game data — it is **not** bundled here, on purpose.
- Download [5e.tools' 2014 source data](https://github.com/5etools-mirror-3/5etools-2014-src) (its green **Code** button → **Download ZIP**).
- Inside it, find the **`data`** folder and copy it so it sits **right next to `character-sheet.html`**. When done, the path `…/better character sheet/data/spells/index.json` should exist.

*(You can skip this, but the spell/feature/equipment libraries will be empty.)*

### 3. Install Python (if you don't have it)
Get it from [python.org](https://www.python.org/downloads/). On Windows, tick **"Add Python to PATH"** during install. Verify in a terminal: `python --version`.

### 4. Start the local server
Open a terminal **in the sheet's folder**, then run the server. The most reliable way is to `cd` into the folder first:

**Windows (Command Prompt):**
```
cd /d "C:\path\to\better character sheet"
python -m http.server 8931
```

**macOS / Linux:**
```
cd "/path/to/better character sheet"
python3 -m http.server 8931
```

Leave that terminal open — the server runs until you close it or press **Ctrl+C**.

### 5. Open the sheet
Go to **http://localhost:8931/character-sheet.html** in your browser.

### Shortcut: just type `pmcrwf`
The repo ships a launcher that does steps 4–5 in one word — it starts the server (or reuses one that's already running), waits for it to come up, then opens the sheet in your browser:

```
pmcrwf          start the server and open the sheet
pmcrwf stop     stop the server
pmcrwf help     usage, including which folder and port it will use
```

Run it from the project folder as `.\pmcrwf` (Windows) or `./pmcrwf` (macOS/Linux/Git Bash). **To type `pmcrwf` from anywhere**, put a copy on your PATH — on Windows the simplest spot is `%LOCALAPPDATA%\Microsoft\WindowsApps`, which is already on PATH, so no PATH editing is needed:

```
copy pmcrwf.cmd "%LOCALAPPDATA%\Microsoft\WindowsApps\"
```

On macOS/Linux, `ln -s "$PWD/pmcrwf" ~/.local/bin/pmcrwf` does the same job. The launcher finds its own folder, so it keeps working wherever the project lives. Override the port with `PMCRWF_PORT` (default 8931), or set `PMCRWF_NO_OPEN=1` to start the server without opening a browser.

### Troubleshooting
- **`404 / File not found`** — the server is running in the wrong folder. Its startup line prints the directory it's serving; make sure you `cd`'d into the folder that actually contains `character-sheet.html`. Visiting `http://localhost:8931/` should list `character-sheet.html`, `src/`, `css/`, `data/`.
- **`Address already in use` / port busy** — a server is already running on 8931 (reuse it), or pick another port, e.g. `python -m http.server 8080`, then open `http://localhost:8080/character-sheet.html`.
- **Empty spell/equipment/feature libraries** — the `data` folder isn't next to `character-sheet.html`, or it's nested one level too deep (you want `data/`, not `5etools-…/data/`).
- **Opened the file directly and nothing loads** — don't use a `file://` path; you must go through the local server (steps 4–5).

If any of this is confusing, paste a link to this repo into an AI assistant ([Claude](https://claude.ai), [ChatGPT](https://chatgpt.com), [Gemini](https://gemini.google.com), [Grok](https://grok.com)) and ask it to walk you through it.

---

The full running list of current and planned features lives in [DOCS.md](DOCS.md).
