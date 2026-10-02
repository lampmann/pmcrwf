# pmcrwf

pmcrwf is an offline HTML character sheet for D&D 5.14e. It's very easy to use, extremely customizable, and moderately easy to install. Or just use https://lampmann.github.io/pmcrwf/ instead.

Here's a list of features:
- Automatic calculation of ability modifiers, saves, skills, passive Perception, spellcasting, and a lot of other things. If you use homebrew or have other modifiers, there are override boxes to change the math.
- A 5eCrawler/Avrae-compatible dice roller and inline dice in feature/spell text.
- Spell, feature (racial, class, or feat) and equipment libraries that you should import directly from 5etools. Nothing from 5etools is bundled with this repo.
- Limited-use feature and spell tracking with short/long rest recovery, parsed from feature text. (This doesn't work all that well though, lol.)
- Swappable CSS themes that you can add to by just adding more to the folder.
- A free-form layout engine to move things where you want them to be.
- Autosaving to `localStorage` and JSON export/import for your character.

To get started, download [5e.tools' 2014 source data](https://github.com/5etools-mirror-3/5etools-2014-src) and drop the `data` folder next to `index.html`. This is technically optional, but if you don't do it a lot of the sheet stops working. After that, run `python3 -m http.server 8931` in Bash and open `http://localhost:8931/index.html`. If any of this is confusing to you, go to any of these websites and paste in a link to this repo to have it explained to you: [1](https://claude.ai) [2](https://chatgpt.com) [3](https://gemini.google.com) [4](https://grok.com).

On first launch, the character creator opens automatically if there are no saved characters. Its **How to download the 5etools data folder** guide walks you through setup:

1. Open the [5etools source mirror](https://github.com/5etools-mirror-3/5etools-src).
2. Choose **Code → Download ZIP** and extract the ZIP.
3. Find the **data** folder inside it, containing **spells** and **bestiary**.
4. Select it with **Choose data folder** in the creator, or connect it from the bar above the sheet. The browser remembers it for next time.

The creator supports Tasha's racial language and proficiency swaps, racial spell choices, and background spells and feats. Racial spell choices and background feats can also be changed in the Features module after creation. Spells added to a class's spell list still use its normal learning/preparation limits.
