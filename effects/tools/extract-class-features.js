#!/usr/bin/env node
/* ============================================================
   Dev-only helper: flattens every class/subclass feature out of
   data/class/class-*.json into plain {key, name, className, subclassName,
   level, text} records for an LLM conversion pass over the effects
   database (see DOCS.md "Feature effects" section and
   effects/tools/conversion-guide.md), mirroring what extract-feats.py does
   for feats.json. Uses the exact same text extraction (flattenEntries/
   stripTags from src/text-utils.js) the live app uses, so the text an
   agent sees is byte-identical to what a player would see.

   "Ability Score Improvement" entries are excluded: the live app never
   looks up an ASI class feature's own effKey (see activeFeatures() in
   src/class-library.js) — it always resolves to the *chosen feat's* key
   instead — so converting the ASI placeholder text itself would be inert
   dead weight.

   Not committed output — run it yourself:
     node effects/tools/extract-class-features.js > /tmp/class-features.json
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { flattenEntries, stripTags } = require("../../src/text-utils.js");

const DATA_DIR = path.join(__dirname, "..", "..", "data", "class");

function textOf(entries) { return stripTags(flattenEntries(entries)); }
function isAsi(name) { return (name || "").trim().toLowerCase() === "ability score improvement"; }

// "You gain a feature from your <subclass-choice>" style stubs — 5e.tools marks the level a
// subclass grants something with a placeholder record carrying no mechanic of its own.
const PLACEHOLDER_RE = /you gain (a|another) feature (granted by|from) your/i;

function main() {
  const raw = [];
  fs.readdirSync(DATA_DIR).filter(f => /^class-.*\.json$/.test(f)).forEach(file => {
    const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
    const subclassNameByShort = {};
    (d.subclass || []).forEach(sc => { subclassNameByShort[sc.className + "|" + sc.shortName] = sc.name; });

    (d.classFeature || []).forEach(f => {
      if (isAsi(f.name)) return;
      raw.push({
        key: "class|" + f.className.trim().toLowerCase() + "|" + f.name.trim().toLowerCase(),
        name: f.name, className: f.className, subclassName: null, level: f.level,
        text: textOf(f.entries),
      });
    });
    (d.subclassFeature || []).forEach(f => {
      if (isAsi(f.name)) return;
      const subclassName = subclassNameByShort[f.className + "|" + f.subclassShortName] || f.subclassShortName;
      raw.push({
        key: "subclass|" + f.className.trim().toLowerCase() + "|" + subclassName.trim().toLowerCase() + "|" + f.name.trim().toLowerCase(),
        name: f.name, className: f.className, subclassName, level: f.level,
        text: textOf(f.entries),
      });
    });
  });

  const filtered = raw.filter(r => !PLACEHOLDER_RE.test(r.text));

  // A feature recurring across levels (e.g. Channel Divinity, Expertise) shares one effKey — see
  // effKeyFor() in src/effects.js, which never includes level. Merge those records into one, with
  // each level's text kept distinct and labeled, so a conversion pass sees the whole progression
  // and writes exactly one DB entry (see conversion-guide.md's "Class/subclass features" section).
  const byKey = new Map();
  filtered.forEach(r => {
    if (!byKey.has(r.key)) byKey.set(r.key, { ...r, levels: [{ level: r.level, text: r.text }] });
    else byKey.get(r.key).levels.push({ level: r.level, text: r.text });
  });
  const out = [...byKey.values()].map(r => {
    r.levels.sort((a, b) => a.level - b.level);
    r.level = r.levels[0].level;   // the level it first becomes available
    r.text = r.levels.length === 1
      ? r.levels[0].text
      : r.levels.map(l => `[Level ${l.level}] ${l.text}`).join("\n");
    delete r.levels;
    return r;
  });

  // Stable order: by class, base-class features before subclass features, then by level.
  out.sort((a, b) => a.className.localeCompare(b.className)
    || (a.subclassName || "").localeCompare(b.subclassName || "")
    || a.level - b.level || a.name.localeCompare(b.name));
  console.log(JSON.stringify(out, null, 2));
}

main();
