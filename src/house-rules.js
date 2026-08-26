/* ============================================================
   HOUSE RULES — the table's ruleset, not the character's.

   Everything here belongs to the campaign rather than to any one
   character, which is why it persists to its own localStorage key
   instead of riding along in collectState(): switching to your
   familiar's tab must not change what the DM has banned. Exporting a
   character deliberately does not carry the ruleset with it — a
   character handed to another table is played under that table's rules.

   Three things live here, and they are genuinely different:

   1. BANS — named entities that are off the table (a spell, a subclass,
      an item). Checked at the point an entry is offered rather than by
      stripping the libraries, so the sheet can say "banned" instead of
      silently having fewer options. See isBanned/banNote.

   2. SOURCES — a denylist of books. Most tables run "everything official
      except a few", so this starts empty and only names exclusions;
      maintaining an allowlist of a hundred-odd books by hand is work
      nobody wants and that goes stale with every release. A banned source
      bans everything printed in it, which is why banNote distinguishes
      the two reasons.

   3. SETTINGS — campaign defaults (point buy, average HP, whether feats
      exist). Some of these drive the character creator; the rest are
      recorded so the table has one place to look them up. Each one says
      which it is, so nothing pretends to be enforced when it isn't.

   NOTHING HERE BLOCKS A ROLL. Bans grey out an Add button and mark a row;
   they never remove your ability to play a character you already have.
   Same reasoning as the combat tracker (see combat.js): a sheet that
   refused would be wrong at exactly the moment the DM said "yes, fine".
   ============================================================ */

const HOUSE_RULES_SCHEMA = 1;

/* Ban kinds. Each names a library the sheet already loads, so a ban is checked against real game
   data rather than needing its own copy of it. `other` is the escape hatch for rules with nothing
   behind them in any library — character-creation options, table conventions, whole strategies. */
const BAN_KINDS = [
  { key: "spell", label: "Spells", lib: () => (typeof SPELL_LIB !== "undefined" ? SPELL_LIB.map(s => s.name) : []) },
  { key: "item", label: "Items", lib: () => (typeof ITEM_LIB !== "undefined" ? ITEM_LIB.map(i => i.name) : []) },
  { key: "class", label: "Classes", lib: () => Object.keys(typeof CLASS_LIB !== "undefined" ? CLASS_LIB : {}) },
  { key: "subclass", label: "Subclasses", lib: hrSubclassNames },
  { key: "race", label: "Races", lib: () => Object.keys(typeof RACE_LIB !== "undefined" ? RACE_LIB : {}) },
  { key: "background", label: "Backgrounds", lib: () => Object.keys(typeof BACKGROUND_LIB !== "undefined" ? BACKGROUND_LIB : {}) },
  { key: "feat", label: "Feats", lib: () => Object.keys(typeof FEAT_LIB !== "undefined" ? FEAT_LIB : {}) },
  { key: "other", label: "Other", lib: () => [] },
];

/* Settings. `enforced` is the honest bit: true means something in the sheet actually reads this,
   false means it is recorded for the table to read and nothing more. Rendering is driven off this
   list so adding a setting is one entry rather than an entry plus a block of markup. */
const HR_SETTINGS = [
  { key: "abilityMethod", label: "Ability scores", kind: "choice", enforced: true,
    opts: [["", "no house rule"], ["pointbuy", "Point buy"], ["standard", "Standard array"], ["roll", "Roll 4d6 drop lowest"], ["manual", "Manual entry"]],
    hint: "the character creator opens on this method" },
  { key: "averageHp", label: "Average HP per level", kind: "bool", enforced: false,
    hint: "recorded; the creator already averages rather than rolling" },
  { key: "multiclass", label: "Multiclassing allowed", kind: "bool", enforced: true, def: true,
    hint: "off hides the creator's add-a-class control" },
  { key: "feats", label: "Feats allowed", kind: "bool", enforced: true, def: true,
    hint: "off means ASI only — the feat picker disappears from ASI slots" },
  { key: "optionalFeatures", label: "Optional class features (TCE)", kind: "bool", enforced: false, def: true },
  { key: "oversized", label: "Oversized weapons", kind: "choice", enforced: true, def: "allow",
    opts: [["allow", "Fully allowed"], ["twosize", "Not if sized for 2+ sizes larger"], ["banned", "Banned"]],
    hint: "set an attack's Size to apply it; extra damage dice belong to the weapon, the wielder's size sets the penalty" },
  { key: "magicItemPricing", label: "Magic item prices", kind: "choice", enforced: true, def: "",
    opts: [["", "as printed"], ["xge-mean", "Mean of XGtE asking price"]],
    hint: "fixed price per rarity, halved for consumables" },
  { key: "hirelings", label: "Hirelings allowed", kind: "bool", enforced: false, def: true },
  { key: "trinketsWorthless", label: "Trinkets are worth 0 gp", kind: "bool", enforced: true,
    hint: "R9 — overrides any price on a trinket, in the library and in your inventory total" },
  { key: "mundaneEquipment", label: "Starting equipment must be mundane", kind: "bool", enforced: true,
    hint: "R35 — stated on the creator's equipment step, where the open-ended picks are made" },
  { key: "restVariant", label: "Rest lengths", kind: "choice", enforced: true, def: "",
    opts: [["", "standard (1 hour / 8 hours)"], ["gritty", "Gritty Realism (8 hours / 7 days)"], ["epic", "Epic Heroism (5 minutes / 1 hour)"]],
    hint: "DMG p267 — takes effect once Rest Variants is switched on under Optional rules" },
  { key: "bonusActionSpellStrict", label: "A bonus-action spell always costs a bonus action", kind: "bool", enforced: true, def: true,
    hint: "R47 — with your bonus action spent, such a spell can't be cast at all" },
  /* R21/R22. Default true because that is RAW-as-argued (see boons.js's header), but a table that
     reads Combining Magical Effects the other way switches it off — and then the Guidance and
     Resistance counters go away with it, since counting to N is the only thing they were for.
     Death Ward is deliberately not covered: it isn't a die you stack onto a roll, it's a number of
     times you get saved from 0 HP, which is worth counting under either reading. */
  { key: "boonStacking", label: "Guidance / Resistance stack", kind: "bool", enforced: true, def: true,
    hint: "R21/R22 — off removes their counters entirely; Death Ward still stacks either way" },
];

/* ----- concurrent casting limits (H4) -----
   "Only one casting of Planar Binding per player character may be active at a time" generalizes to
   "at most N of X running at once", so it's stored as a table rather than special-cased: any spell a
   table wants to cap goes in the same map, and boons.js renders a counter for each. The counts
   themselves are per character (BOONS.castings); only the limits live here, with the ruleset. */
function spellLimits() { return (HOUSE_RULES.spellLimits && typeof HOUSE_RULES.spellLimits === "object") ? HOUSE_RULES.spellLimits : {}; }
function spellLimitFor(name) {
  const lim = spellLimits();
  const q = hrNorm(name);
  const hit = Object.keys(lim).find(k => hrNorm(k) === q);
  return hit ? Math.max(1, Math.floor(Number(lim[hit])) || 1) : null;
}
function setSpellLimit(name, n) {
  const clean = String(name || "").trim(); if (!clean) return;
  if (!HOUSE_RULES.spellLimits || typeof HOUSE_RULES.spellLimits !== "object") HOUSE_RULES.spellLimits = {};
  const existing = Object.keys(HOUSE_RULES.spellLimits).find(k => hrNorm(k) === hrNorm(clean));
  const key = existing || clean;
  const v = Math.floor(Number(n));
  if (!v || v < 1) delete HOUSE_RULES.spellLimits[key];
  else HOUSE_RULES.spellLimits[key] = Math.min(99, v);
  saveHouseRules();
}

/* XGtE gives an asking price as a die expression per rarity. A table that wants fixed prices takes
   the mean of that expression rather than rolling per item, halved for consumables (potions and
   scrolls), which is what the `xge-mean` pricing option computes. */
const XGE_PRICE_MEAN = {
  common: 45, uncommon: 350, rare: 11000, "very rare": 35000, legendary: 175000,
};

let HOUSE_RULES = blankHouseRules();

function blankHouseRules() {
  return {
    v: HOUSE_RULES_SCHEMA,
    preset: "",                       // which preset was loaded, purely for the status line
    bans: BAN_KINDS.reduce((o, k) => { o[k.key] = []; return o; }, {}),
    sourcesOff: [],                   // denylisted source codes
    settings: {},                     // sparse: only what's been set, defaults come from HR_SETTINGS
    spellLimits: {},                  // spell name -> max concurrent castings (H4)
    rulingSet: "",                    // which RULING_SETS entry supplies the Rulings tab
    variants: [],                     // RAW optional/variant rules switched on (src/variant-rules.js)
  };
}

/* A saved ruleset predating a field gets today's default rather than `undefined`, the same
   normalizing that combat.js's normalizeCombat does and for the same reason — a stored object is
   whatever shape it was written in, and trusting it crashes the first time something new is read. */
function normalizeHouseRules(saved) {
  const blank = blankHouseRules();
  if (!saved || typeof saved !== "object") return blank;
  const bans = { ...blank.bans };
  BAN_KINDS.forEach(k => { if (Array.isArray(saved.bans && saved.bans[k.key])) bans[k.key] = saved.bans[k.key].slice(); });
  return {
    ...blank, ...saved, bans,
    sourcesOff: Array.isArray(saved.sourcesOff) ? saved.sourcesOff.slice() : [],
    settings: (saved.settings && typeof saved.settings === "object") ? { ...saved.settings } : {},
    spellLimits: (saved.spellLimits && typeof saved.spellLimits === "object") ? { ...saved.spellLimits } : {},
    rulingSet: typeof saved.rulingSet === "string" ? saved.rulingSet : "",
    variants: Array.isArray(saved.variants) ? saved.variants.slice() : [],
  };
}

function saveHouseRules() {
  try { localStorage.setItem("charsheet-houserules", JSON.stringify(HOUSE_RULES)); }
  catch (e) { console.warn("Could not save house rules", e); }
}
function loadHouseRules() {
  try { HOUSE_RULES = normalizeHouseRules(JSON.parse(localStorage.getItem("charsheet-houserules"))); }
  catch (e) { HOUSE_RULES = blankHouseRules(); }
}

/* ----- reading the ruleset ----- */

function hrSettingDef(key) { return HR_SETTINGS.find(s => s.key === key) || null; }
/* A setting's value, falling back to its declared default. Callers get a usable value whether or not
   the DM has ever opened this module, so every consumer can read it unconditionally. */
function hrSetting(key) {
  const def = hrSettingDef(key);
  const v = HOUSE_RULES.settings[key];
  if (v === undefined) return def ? (def.def !== undefined ? def.def : (def.kind === "bool" ? false : "")) : undefined;
  return v;
}
function hrSetSetting(key, value) { HOUSE_RULES.settings[key] = value; saveHouseRules(); }

/* Names are matched case-insensitively and trimmed, because a ban is written down the way a DM says
   it ("fabricate") and read against library data that is capitalized however its book was. Source is
   deliberately NOT part of the key: banning Fabricate bans it in every printing. */
function hrNorm(name) { return String(name == null ? "" : name).trim().toLowerCase(); }

function isBannedName(kind, name) {
  const list = HOUSE_RULES.bans[kind] || [];
  const q = hrNorm(name);
  return !!q && list.some(b => hrNorm(b) === q);
}
function isBannedSource(source) {
  const q = hrNorm(source);
  return !!q && HOUSE_RULES.sourcesOff.some(s => hrNorm(s) === q);
}
/* The one call every consumer makes. `source` is optional — pass it and a banned book bans the
   entry too, which is what makes the source denylist actually do something at the point of use. */
function isBanned(kind, name, source) {
  return isBannedName(kind, name) || (source !== undefined && isBannedSource(source));
}
/* Why something is banned, for a tooltip. Null when it isn't, so callers can use it as the test. */
function banNote(kind, name, source) {
  if (isBannedName(kind, name)) return "banned by house rule";
  if (source !== undefined && isBannedSource(source)) return `${source} is not an allowed source`;
  return null;
}

/* ----- marking banned options wherever one is offered -----
   Banned entries are shown and coloured red, never removed. A ban is information the player needs
   at the moment they would have picked the thing; an option that silently vanishes reads as missing
   data, and the sheet has no way to say "your DM banned this" once it's gone. Same rule the Spell
   and Equipment libraries already follow with their struck-through rows.

   `prefix` reconciles how an option is *offered* with how a ban is *stored*: a subclass picker lists
   a bare "Champion" while the ban reads "Fighter: Champion". */
const BAN_MARK_CLASS = "banned-opt";
function isBannedOption(kind, name, prefix) {
  if (!kind || typeof isBanned !== "function") return false;
  return isBanned(kind, (prefix || "") + name);
}
/* Reads a widget's own declared ban kind/prefix off the element, so the two dropdown widgets
   (combobox.js, typeahead.js) share one contract and a caller only has to say it once, in markup. */
function banInfoOf(el) {
  if (!el || !el.dataset || !el.dataset.banKind) return null;
  return { kind: el.dataset.banKind, prefix: el.dataset.banPrefix || "" };
}
/* Red the input itself when what's *already* selected is banned — the picker only warns while it's
   open, and a character carrying a banned choice should keep saying so afterwards. */
function markBannedInput(el) {
  const info = banInfoOf(el); if (!el.classList) return;
  const bad = !!info && !!(el.value || "").trim() && isBannedOption(info.kind, el.value.trim(), info.prefix);
  el.classList.toggle("banned-value", bad);
  if (bad) el.title = banNote(info.kind, info.prefix + el.value.trim()) || "banned by house rule";
  else if (el.title === "banned by house rule") el.removeAttribute("title");
}
function markBannedInputs(root) {
  (root || document).querySelectorAll("[data-ban-kind]").forEach(markBannedInput);
}

function toggleBan(kind, name) {
  const list = HOUSE_RULES.bans[kind]; if (!list) return;
  const q = hrNorm(name); if (!q) return;
  const at = list.findIndex(b => hrNorm(b) === q);
  if (at >= 0) list.splice(at, 1); else list.push(String(name).trim());
  list.sort((a, b) => a.localeCompare(b));
  saveHouseRules();
}
function toggleSourceBan(src) {
  const q = hrNorm(src); if (!q) return;
  const at = HOUSE_RULES.sourcesOff.findIndex(s => hrNorm(s) === q);
  if (at >= 0) HOUSE_RULES.sourcesOff.splice(at, 1); else HOUSE_RULES.sourcesOff.push(String(src).trim());
  HOUSE_RULES.sourcesOff.sort((a, b) => a.localeCompare(b));
  saveHouseRules();
}
function totalBanCount() { return BAN_KINDS.reduce((n, k) => n + (HOUSE_RULES.bans[k.key] || []).length, 0); }

/* The XGtE fixed price for a rarity, or null when the pricing house rule is off or the rarity has no
   entry (mundane gear, artifacts, "varies"). Returns gp; consumables are halved per XGtE's footnote. */
function hrMagicItemPrice(rarity, isConsumable) {
  if (hrSetting("magicItemPricing") !== "xge-mean") return null;
  const base = XGE_PRICE_MEAN[hrNorm(rarity)];
  if (base === undefined) return null;
  return isConsumable ? base / 2 : base;
}

/* ----- oversized weapons (R17) -----
   The DMG prices a weapon sized for a bigger creature two ways, and only one of them is a rule:
   you have *disadvantage* on attacks with it (rule), and the DM *can* rule that two or more sizes
   larger is unusable (suggestion). The extra damage dice belong to the weapon — a greataxe sized
   for a Large creature is 2d12 for whoever swings it — so nothing here touches damage; that number
   is whatever the attack row says. Only the penalty and the limit depend on who's holding it.

   Three settings, because tables land in different places: `allow` takes the rule and drops the
   suggestion, `twosize` takes both, `banned` refuses oversized weapons outright. */
const CREATURE_SIZES = ["T", "S", "M", "L", "H", "G"];
function sizeIndex(sz) { const i = CREATURE_SIZES.indexOf(String(sz || "M").toUpperCase()); return i < 0 ? 2 : i; }
function characterSize() {
  const el = document.getElementById("char-size");
  return (el && el.value) || "M";
}
/* How a weapon sized `weaponSize` behaves in the hands of `wielderSize`:
     { steps, disadvantage, unusable, note }
   `steps` is how many sizes too big it is (0 or less = fine). */
function oversizedVerdict(weaponSize, wielderSize) {
  const steps = sizeIndex(weaponSize) - sizeIndex(wielderSize == null ? characterSize() : wielderSize);
  if (!weaponSize || steps <= 0) return { steps: Math.min(0, steps), disadvantage: false, unusable: false, note: "" };
  const rule = (typeof hrSetting === "function" && hrSetting("oversized")) || "allow";
  if (rule === "banned") {
    return { steps, disadvantage: true, unusable: true, note: "oversized weapons are banned in this campaign" };
  }
  if (rule === "twosize" && steps >= 2) {
    return { steps, disadvantage: true, unusable: true,
      note: `sized for a creature ${steps} sizes larger — too big to use under this campaign's House Rules` };
  }
  return { steps, disadvantage: true, unusable: false,
    note: `sized for a creature ${steps} size${steps === 1 ? "" : "s"} larger — disadvantage on attack rolls` };
}

/* Every subclass the class library knows, as "Class: Subclass" — the form a DM bans them in, and
   unambiguous where two classes share a subclass name (Circle of the Land vs. anything else). */
function hrSubclassNames() {
  if (typeof CLASS_LIB === "undefined") return [];
  const out = [];
  Object.values(CLASS_LIB).forEach(c => Object.values(c.subs || {}).forEach(s => {
    if (s && s.name) out.push(`${c.name}: ${s.name}`);
  }));
  return out.sort();
}

/* Sources to offer in the denylist grid: whatever the loaded libraries actually contain, so the list
   tracks the data rather than a hardcoded table that drifts. */
function hrKnownSources() {
  const set = new Set();
  if (typeof SPELL_LIB !== "undefined") SPELL_LIB.forEach(s => s.source && set.add(s.source));
  if (typeof ITEM_LIB !== "undefined") ITEM_LIB.forEach(i => i.source && set.add(i.source));
  [typeof RACE_LIB !== "undefined" ? RACE_LIB : {}, typeof CLASS_LIB !== "undefined" ? CLASS_LIB : {},
   typeof BACKGROUND_LIB !== "undefined" ? BACKGROUND_LIB : {}, typeof FEAT_LIB !== "undefined" ? FEAT_LIB : {}]
    .forEach(lib => Object.values(lib).forEach(r => r && r.source && set.add(r.source)));
  HOUSE_RULES.sourcesOff.forEach(s => set.add(s));   // a banned book stays listed even if its data isn't loaded
  return [...set].sort();
}

/* ----- presets -----
   A preset is a starting point, not a lock: loading one writes into HOUSE_RULES and everything stays
   editable afterwards. Lampmann's is the ruleset this module was built against (see
   house-rules/lampmann.md for the full document, including the ~50 rulings that are reference text
   rather than anything the sheet can enforce). */
const HR_PRESETS = {
  lampmann: {
    label: "Lampmann's House Rules",
    hint: "2014 rules, everything official and non-partnered, point buy, average everything",
    build: () => ({
      preset: "Lampmann's House Rules",
      bans: {
        spell: ["Nystul's Magic Aura", "Fabricate"],
        item: ["Blood of the Lycanthrope", "Cube of Force", "Wave", "Bag of Beans", "Deck of Wonder", "Harkon's Bite"],
        subclass: ["Wizard: School of Conjuration", "Bard: College of Creation"],
        race: [], background: [], feat: [],
        other: ["Inheritor (VRGR)", "Fateful Moments (EGW)", "This Is Your Life (XGE)",
          "Feat/spell backgrounds", "Hirelings", "Infinite money loops", "Infinities in general",
          "Shemeshka, the Fortune's Wheel and the time chamber"],
      },
      sourcesOff: [],
      spellLimits: { "Planar Binding": 1 },   // H4
      rulingSet: "lampmann",                  // the ~50 adjudication rulings (src/rulings.js)
      settings: {
        abilityMethod: "pointbuy", averageHp: true, multiclass: true, feats: true,
        optionalFeatures: true, oversized: "allow", magicItemPricing: "xge-mean", hirelings: false,
        trinketsWorthless: true, mundaneEquipment: true, bonusActionSpellStrict: true,
        boonStacking: false,
      },
    }),
  },
};
function loadHousePreset(key) {
  const p = HR_PRESETS[key]; if (!p) return;
  HOUSE_RULES = normalizeHouseRules(p.build());
  saveHouseRules();
  if (typeof logEvent === "function") logEvent("info", `<b>House rules</b> — loaded ${escapeHtml(p.label)}`);
  refreshAfterHouseRules();
}
function clearHouseRules() {
  HOUSE_RULES = blankHouseRules();
  saveHouseRules();
  refreshAfterHouseRules();
}

/* ----- exchanging a ruleset -----
   A whole ruleset as one file, so a DM configures a table once and hands out the result rather than
   everyone retyping a ban list from a chat message. Exported by value, not by reference to a preset:
   the file carries the bans, sources, settings and limits as they stand, so a table that started
   from a preset and then changed six things exports what it actually plays with.

   The rulings themselves are NOT copied in — they're bulk prose that ships with the sheet
   (src/rulings.js), so only the *name* of the set travels. A file naming a set the recipient doesn't
   have still imports cleanly; their Rulings tab just says nothing is loaded. */
function houseRulesExport() {
  return { kind: "pmcrwf-house-rules", v: HOUSE_RULES_SCHEMA, exported: new Date().toISOString(),
    ...normalizeHouseRules(HOUSE_RULES) };
}
function exportHouseRules() {
  const blob = new Blob([JSON.stringify(houseRulesExport(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ((HOUSE_RULES.preset || "house-rules").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "house-rules") + ".json";
  a.click();
}
/* Returns an error string, or null on success — the caller decides how loudly to complain. Anything
   shaped like a ruleset is accepted; normalizeHouseRules fills in whatever the file predates, so a
   file written by an older copy of the sheet still loads. */
function importHouseRules(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return "that isn't valid JSON (" + e.message + ")"; }
  if (!data || typeof data !== "object") return "that file doesn't contain a ruleset";
  if (data.kind && data.kind !== "pmcrwf-house-rules") {
    // A character export is the likeliest wrong file to pick, and silently replacing the ruleset
    // with an empty one would be a confusing way to find that out.
    return "that looks like a " + String(data.kind) + " file, not a ruleset";
  }
  if (!data.bans && !data.settings && !data.sourcesOff) return "that file doesn't contain a ruleset";
  HOUSE_RULES = normalizeHouseRules(data);
  saveHouseRules();
  if (typeof logEvent === "function") {
    logEvent("info", `<b>House rules</b> — imported${HOUSE_RULES.preset ? ` ${escapeHtml(HOUSE_RULES.preset)}` : ""}` +
      ` <span class="hint">(${totalBanCount()} ban(s), ${HOUSE_RULES.sourcesOff.length} source(s) excluded)</span>`);
  }
  refreshAfterHouseRules();
  return null;
}
/* Repaint everything a ruleset change can affect. The libraries mark banned rows and grey their Add
   buttons, so they have to be told; each is optional because the tests load this module alone. */
function refreshAfterHouseRules() {
  renderHouseRules();
  if (typeof renderSpellResults === "function" && document.getElementById("spell-results")) renderSpellResults();
  if (typeof renderItemResults === "function" && document.getElementById("item-results")) renderItemResults();
  if (typeof renderItemList === "function") renderItemList();
  if (typeof renderBoons === "function") renderBoons();   // concurrent-casting + Hero Point counters
  if (typeof renderRestButtons === "function") renderRestButtons();   // Gritty/Epic durations on the labels
  // The Features module draws the ASI feat picker, which the `feats` setting can remove.
  if (typeof renderClassFeatures === "function" && document.getElementById("class-feat-results")) renderClassFeatures();
  // Only if the wizard is actually open — renderCreator() throws on a null CREATOR.
  if (typeof renderCreator === "function" && typeof CREATOR !== "undefined" && CREATOR) renderCreator();
  markBannedInputs();   // a name that just became (un)banned should recolour where it's already chosen
  // The oversized-weapon rule changes an attack row's mode and label, and recompute() is what drives
  // updateAttackRows() (see attacks.js).
  if (typeof recompute === "function") recompute();
}

/* ----- rendering ----- */

let HR_TAB = "bans";
const HR_TABS = [["bans", "Bans"], ["sources", "Sources"], ["settings", "Settings"], ["variants", "Optional rules"], ["rulings", "Rulings"]];

function hrTabsHtml() {
  return HR_TABS.map(([k, label]) =>
    `<button type="button" class="hr-tab${HR_TAB === k ? " active" : ""}" data-hrtab="${k}">${label}</button>`).join("");
}

/* One ban list: a combobox that type-aheads over the matching library, plus the current bans as
   removable chips. The combobox is why banning is a two-word job rather than typing an exact name —
   it is the same widget the creator's race/class pickers use, so it filters as you type and still
   accepts free text for anything the libraries don't know about. */
function hrBanKindHtml(kind) {
  const list = HOUSE_RULES.bans[kind.key] || [];
  const options = kind.lib();
  const chips = list.length
    ? list.map(n => `<span class="hr-chip">${escapeHtml(n)}<button type="button" class="hr-chip-x" data-hrunban="${kind.key}" data-hrname="${escapeHtml(n).replace(/"/g, "&quot;")}" title="remove this ban">&times;</button></span>`).join("")
    : `<span class="hint">nothing banned</span>`;
  return `<div class="hr-ban-kind">
    <div class="flabel">${kind.label} <span class="hint">${list.length || ""}</span></div>
    <div class="fbody">
      ${comboboxHtml({ options, placeholder: options.length ? "type to search…" : "type a name", extraClass: "hr-ban-add", width: "14rem", dataAttr: `data-hrkind="${kind.key}"` })}
      <button type="button" class="hr-ban-go" data-hrkind="${kind.key}">Ban</button>
      <div class="hr-chips">${chips}</div>
    </div>
  </div>`;
}

function hrRenderBans() {
  return `<div class="hint">Banned entries stay visible in the libraries, marked and with their Add button disabled &mdash;
      so a missing option reads as "the DM banned this" rather than as the sheet losing data.
      Nothing here blocks a character you already have.</div>
    ${BAN_KINDS.map(hrBanKindHtml).join("")}`;
}

function hrRenderSources() {
  const srcs = hrKnownSources();
  const off = HOUSE_RULES.sourcesOff;
  if (!srcs.length) return `<div class="hint">No sources loaded yet &mdash; import or auto-load some game data and the books will be listed here.</div>`;
  const chips = srcs.map(s => {
    const banned = isBannedSource(s);
    const full = (typeof SOURCE_NAMES !== "undefined" && SOURCE_NAMES[s]) || s;
    return `<button type="button" class="fbtn${banned ? " exc" : ""}" data-hrsrc="${escapeHtml(s).replace(/"/g, "&quot;")}" title="${escapeHtml(full)}">${escapeHtml(s)}</button>`;
  }).join("");
  return `<div class="hint">A denylist, not an allowlist: every book starts allowed and you name the exceptions,
      because "everything official except a few" is how most tables actually run and an allowlist goes stale with every release.
      A banned book bans everything printed in it. ${off.length ? `<b>${off.length}</b> excluded.` : ""}</div>
    <div class="fbody" style="margin-top:.35rem">${chips}</div>`;
}

function hrSettingRowHtml(s) {
  const v = hrSetting(s.key);
  const control = s.kind === "bool"
    ? `<label><input type="checkbox" class="hr-set" data-hrset="${s.key}"${v ? " checked" : ""}> ${escapeHtml(s.label)}</label>`
    : `<label>${escapeHtml(s.label)} <select class="hr-set" data-hrset="${s.key}">${
        s.opts.map(([val, lab]) => `<option value="${escapeHtml(val)}"${v === val ? " selected" : ""}>${escapeHtml(lab)}</option>`).join("")
      }</select></label>`;
  const note = [s.hint || "", s.enforced ? "" : "recorded only"].filter(Boolean).join(" &middot; ");
  return `<div class="hr-setting">${control}${note ? ` <span class="hint">${note}</span>` : ""}</div>`;
}
/* Concurrent-casting limits (H4). Its own block rather than an HR_SETTINGS row, because it's a
   table of spell -> number instead of one value. */
function hrRenderSpellLimits() {
  const lim = spellLimits();
  const names = Object.keys(lim).sort();
  const options = (typeof SPELL_LIB !== "undefined") ? [...new Set(SPELL_LIB.map(s => s.name))].sort() : [];
  const rows = names.length
    ? names.map(n => `<span class="hr-chip">${escapeHtml(n)} <b>&times;${spellLimitFor(n)}</b>
        <button type="button" class="hr-chip-x" data-hrunlimit="${escapeHtml(n).replace(/"/g, "&quot;")}" title="remove this limit">&times;</button></span>`).join("")
    : `<span class="hint">no limits set</span>`;
  return `<div class="hr-ban-kind" style="margin-top:.6rem">
    <div class="flabel">Concurrent castings</div>
    <div class="fbody">
      <div class="hint">At most N of a spell running at once, per character &mdash; a counter for each appears beside your HP.
        Going over is shown, never prevented.</div>
      ${comboboxHtml({ options, placeholder: options.length ? "spell name…" : "spell name", extraClass: "hr-limit-name", width: "14rem" })}
      <input type="text" inputmode="numeric" class="tiny hr-limit-n" value="1" title="how many may be active at once">
      <button type="button" id="hr-limit-add">Limit</button>
      <div class="hr-chips">${rows}</div>
    </div>
  </div>`;
}
function hrRenderSettings() {
  return `<div class="hint">Settings marked <i>recorded only</i> are here so the table has one place to look them up &mdash;
      nothing in the sheet reads them yet. The rest change how the sheet behaves.</div>
    ${HR_SETTINGS.map(hrSettingRowHtml).join("")}
    ${hrRenderSpellLimits()}`;
}

function renderHouseRules() {
  const el = document.getElementById("hr-body"); if (!el) return;
  const tabs = document.getElementById("hr-tabs");
  if (tabs) tabs.innerHTML = hrTabsHtml();
  const status = document.getElementById("hr-status");
  if (status) {
    // Assigned through textContent below, so this must NOT be escaped — doing both renders the
    // entities literally ("Lampmann&#39;s House Rules").
    const bits = [];
    if (HOUSE_RULES.preset) bits.push(HOUSE_RULES.preset);
    const n = totalBanCount();
    if (n) bits.push(`${n} ban${n === 1 ? "" : "s"}`);
    if (HOUSE_RULES.sourcesOff.length) bits.push(`${HOUSE_RULES.sourcesOff.length} source(s) excluded`);
    status.textContent = bits.join(" · ");
  }
  const presetBar = `<div class="hr-presets">
    <button type="button" id="hr-export" title="save this whole ruleset — bans, sources, settings, limits and rulings — as one file">Export ruleset</button>
    <label style="margin-right:.5rem">Import <input type="file" id="hr-import" accept="application/json" style="width:11rem"></label>
    ${Object.entries(HR_PRESETS).map(([k, p]) => `<button type="button" data-hrpreset="${k}" title="${escapeHtml(p.hint)}">Load ${escapeHtml(p.label)}</button>`).join("")}
    <button type="button" id="hr-clear" title="clear every ban, source exclusion and setting">Clear all</button>
  </div>`;
  const body = HR_TAB === "sources" ? hrRenderSources()
    : HR_TAB === "settings" ? hrRenderSettings()
    : HR_TAB === "variants" ? (typeof hrRenderVariants === "function" ? hrRenderVariants() : "")
    : HR_TAB === "rulings" ? (typeof hrRenderRulings === "function" ? hrRenderRulings() : "")
    : hrRenderBans();
  el.innerHTML = presetBar + body;
  if (typeof initComboboxes === "function") initComboboxes(el);
}

/* ----- wiring ----- */
/* Any ban-aware input recolours as it changes, wherever it lives — the creator's pickers, the
   Character module's race/class boxes, an ASI feat slot. Delegated at the document so a widget that
   is rebuilt (and every one of them is, constantly) never needs re-binding. */
document.addEventListener("input", e => { if (e.target && e.target.dataset && e.target.dataset.banKind) markBannedInput(e.target); });
document.addEventListener("change", e => { if (e.target && e.target.dataset && e.target.dataset.banKind) markBannedInput(e.target); });

document.addEventListener("DOMContentLoaded", () => {
  const mod = document.getElementById("hr-body"); if (!mod) return;
  loadHouseRules();
  if (typeof loadVariantRuleLib === "function") {
    loadVariantRuleLib();
    // Auto-load like every other library: cached copy shows instantly, the fetch refreshes it.
    if (typeof autoLoadVariantRules === "function") autoLoadVariantRules().then(() => renderHouseRules());
  }
  renderHouseRules();
  markBannedInputs();

  const commitBan = kindKey => {
    const inp = document.querySelector(`.hr-ban-add[data-hrkind="${kindKey}"]`); if (!inp) return;
    const name = (inp.value || "").trim(); if (!name) return;
    toggleBan(kindKey, name);
    inp.value = "";
    refreshAfterHouseRules();
  };

  document.getElementById("hr-tabs").addEventListener("click", e => {
    const t = e.target.closest("[data-hrtab]"); if (!t) return;
    HR_TAB = t.dataset.hrtab; renderHouseRules();
  });

  mod.addEventListener("click", e => {
    const preset = e.target.closest("[data-hrpreset]");
    if (preset) { loadHousePreset(preset.dataset.hrpreset); return; }
    if (e.target.id === "hr-export") { exportHouseRules(); return; }
    if (e.target.id === "hr-clear") {
      if (confirm("Clear every ban, source exclusion and setting?")) clearHouseRules();
      return;
    }
    const go = e.target.closest(".hr-ban-go");
    if (go) { commitBan(go.dataset.hrkind); return; }
    const unban = e.target.closest("[data-hrunban]");
    if (unban) { toggleBan(unban.dataset.hrunban, unban.dataset.hrname); refreshAfterHouseRules(); return; }
    const src = e.target.closest("[data-hrsrc]");
    if (src) { toggleSourceBan(src.dataset.hrsrc); refreshAfterHouseRules(); return; }
    const vrMore = e.target.closest("[data-vrtext]");
    if (vrMore) { toggleVariantText(vrMore); return; }
    const vrType = e.target.closest("[data-vrtype]");
    if (vrType) { VR_TYPE_FILTER = vrType.dataset.vrtype; renderHouseRules(); return; }
    const unlimit = e.target.closest("[data-hrunlimit]");
    if (unlimit) { setSpellLimit(unlimit.dataset.hrunlimit, 0); refreshAfterHouseRules(); return; }
    if (e.target.id === "hr-limit-add") {
      const nameEl = mod.querySelector(".hr-limit-name"), nEl = mod.querySelector(".hr-limit-n");
      if (nameEl && (nameEl.value || "").trim()) {
        setSpellLimit(nameEl.value, (nEl && nEl.value) || 1);
        nameEl.value = "";
        refreshAfterHouseRules();
      }
      return;
    }
  });

  // Enter in a ban combobox commits it, the same as clicking Ban. Keydown rather than change so it
  // fires while the combobox panel is open, which is where the user actually is when they finish typing.
  mod.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const inp = e.target.closest(".hr-ban-add"); if (!inp) return;
    e.preventDefault();
    setTimeout(() => commitBan(inp.dataset.hrkind), 0);   // let the combobox's own Enter handler pick first
  });

  /* The rulings search re-renders the tab on every keystroke, which destroys the box it was typed
     into — so focus and caret are put back afterwards, the same problem (and fix) the character
     creator's own comboboxes have. */
  mod.addEventListener("input", e => {
    const box = e.target.closest("#hr-ruling-search") || e.target.closest("#vr-search");
    if (!box) return;
    if (box.id === "vr-search") VR_QUERY = box.value; else RULINGS_QUERY = box.value;
    const id = box.id, at = box.selectionStart;
    renderHouseRules();
    const again = document.getElementById(id);
    if (again) { again.focus(); try { again.setSelectionRange(at, at); } catch (err) {} }
  });

  mod.addEventListener("change", e => {
    const imp = e.target.closest("#hr-import");
    if (imp) {
      const file = imp.files && imp.files[0];
      imp.value = "";                                  // so re-picking the same file fires again
      if (!file) return;
      const rd = new FileReader();
      rd.onload = () => { const err = importHouseRules(rd.result); if (err) alert("Could not import that ruleset — " + err); };
      rd.onerror = () => alert("Could not read that file: " + ((rd.error && rd.error.message) || "unknown error"));
      rd.readAsText(file);
      return;
    }
    const vrToggle = e.target.closest(".vr-toggle");
    if (vrToggle) { toggleVariant(vrToggle.dataset.vr); refreshAfterHouseRules(); return; }
    const vrSrc = e.target.closest("#vr-source");
    if (vrSrc) { VR_SOURCE_FILTER = vrSrc.value; renderHouseRules(); return; }
    const vrImp = e.target.closest("#vr-import");
    if (vrImp) { const f = vrImp.files; if (f && f.length) loadVariantRuleFiles(f); vrImp.value = ""; return; }
    const set = e.target.closest(".hr-set"); if (!set) return;
    const def = hrSettingDef(set.dataset.hrset); if (!def) return;
    hrSetSetting(def.key, def.kind === "bool" ? set.checked : set.value);
    refreshAfterHouseRules();
  });
});
