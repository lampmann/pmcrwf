#!/usr/bin/env node
/* ============================================================
   Dev-only helper: flattens every race/subrace trait out of
   data/races.json into plain {key, name, raceName, subraceName, text}
   records for an LLM conversion pass over the effects database (see
   DOCS.md "Feature effects" section and effects/tools/conversion-guide.md),
   mirroring extract-class-features.js for class/subclass features. Uses
   the exact same text extraction (flattenEntries/stripTags from
   src/text-utils.js) the live app uses, so the text an agent sees is
   byte-identical to what a player would see.

   Mirrors parseRaceFile()'s rules in src/class-library.js exactly, so a
   record only exists here if the live app would actually surface it:
     - only named trait blocks with `entries` count as features (plain
       flavor-text strings are skipped) — see parseRaceEntries().
     - a race name repeated across the file (reprints/parity updates)
       collapses to the *last* occurrence in file order, since RACE_LIB[name]
       is fully overwritten on each later parse.
     - `_copy`-based subraces (5e.tools' copy-inheritance for reprints/
       variants) are skipped entirely — parseRaceFile() never resolves them.

   Key scheme matches effKeyFor() in src/effects.js: a base race trait is
   "race|" + raceName + "|" + traitName; a subrace trait is "subrace|" +
   subraceName + "|" + traitName (no race name in the subrace key — that's
   the engine's actual scheme, not an oversight here).

   Not committed output — run it yourself:
     node effects/tools/extract-race-features.js > /tmp/race-features.json
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { flattenEntries, stripTags } = require("../../src/text-utils.js");

const DATA_FILE = path.join(__dirname, "..", "..", "data", "races.json");

function textOf(entries) { return stripTags(flattenEntries(entries)); }

function main() {
  const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  // Last-occurrence-wins, matching parseRaceFile()'s RACE_LIB[r.name] = {...} overwrite.
  const raceByName = {};
  (d.race || []).forEach(r => { raceByName[r.name] = r; });

  const out = [];
  Object.values(raceByName).forEach(r => {
    (r.entries || []).filter(e => e && e.name && e.entries).forEach(e => {
      out.push({
        key: "race|" + r.name.trim().toLowerCase() + "|" + e.name.trim().toLowerCase(),
        name: e.name, raceName: r.name, subraceName: null,
        text: textOf(e.entries),
      });
    });
  });

  (d.subrace || []).forEach(s => {
    if (s._copy) return;
    const raceName = s.raceName || (s._copy && s._copy.raceName);
    if (!raceByName[raceName]) return;
    (s.entries || []).filter(e => e && e.name && e.entries).forEach(e => {
      out.push({
        key: "subrace|" + s.name.trim().toLowerCase() + "|" + e.name.trim().toLowerCase(),
        name: e.name, raceName, subraceName: s.name,
        text: textOf(e.entries),
      });
    });
  });

  out.sort((a, b) => (a.raceName || "").localeCompare(b.raceName || "")
    || (a.subraceName || "").localeCompare(b.subraceName || "")
    || a.name.localeCompare(b.name));
  console.log(JSON.stringify(out, null, 2));
}

main();
