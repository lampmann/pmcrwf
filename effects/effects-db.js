/* ============================================================
   Feature effects — declarative mechanics overlay. See src/effects.js for
   the schema these entries follow and the engine that applies them, and
   DOCS.md for the human-readable version.

   Loaded as a plain <script>, not fetch()'d, so it works even under file://
   where the data/ auto-loaders are blocked. Entries are keyed by feature
   name and origin (see effKeyFor in src/effects.js) and are inert unless
   the character's own imported data/ actually contains a feature whose key
   matches — this file ships mechanics only, never descriptive prose, and
   never bundles any 5e.tools content itself.
   ============================================================ */
let EFFECTS_DB = {};
function registerEffects(entries) { Object.assign(EFFECTS_DB, entries); }
