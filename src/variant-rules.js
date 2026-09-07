/* ============================================================
   OPTIONAL & VARIANT RULES — 5e.tools' own catalogue of RAW options.

   Distinct from the Rulings tab next door, and the distinction matters:
   a ruling is one table's adjudication of ambiguous text, while these
   are printed alternatives the books themselves offer. Flanking, Gritty
   Realism, Proficiency Dice, Variant Encumbrance — a DM switches them
   on, and they are the same rules at every table that does.

   Imported, never bundled, exactly like the spell/item/race libraries:
   the catalogue comes from the user's own data/variantrules.json (see
   DOCS' "Where game data comes from"). Nothing here hardcodes a rule's
   text, so a data update is picked up for free and a table with no data
   folder simply sees an empty tab.

   WHICH ONES ACTUALLY DO SOMETHING. Most of the 116 are DM-facing
   procedure (Morale, Plot Points, downtime activities) with nothing for
   a character sheet to compute, so switching one on records the choice
   and shows its text. A handful genuinely change a character's numbers,
   and those say so and are wired up — see VR_EFFECTS. As everywhere
   else in this module, an entry states which it is rather than leaving
   you to guess.
   ============================================================ */

const VR_SCHEMA = 1;
let VARIANT_RULES = [];

// 5e.tools' Parser.RULE_TYPE_TO_FULL. A rule with no type is plain reference material that happens
// to live in the same file (ship combat, madness tables) rather than an option to switch on.
const VR_TYPE_NAMES = { O: "Optional", V: "Variant", VO: "Variant Optional", VV: "Variant Variant" };

function vrKey(r) { return r.name + "|" + r.source; }
function parseVariantRule(raw) {
  return {
    name: raw.name, source: raw.source || "", page: raw.page || null,
    ruleType: raw.ruleType || "", srd: !!raw.srd,
    text: (typeof stripTags === "function" && typeof flattenEntries === "function")
      ? stripTags(flattenEntries(raw.entries)) : "",
  };
}
function mergeVariantRules(list) {
  const seen = new Set(VARIANT_RULES.map(vrKey));
  list.forEach(r => { if (!seen.has(vrKey(r))) { VARIANT_RULES.push(r); seen.add(vrKey(r)); } });
  VARIANT_RULES.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}
function saveVariantRuleLib() {
  try { localStorage.setItem("charsheet-variantrules", JSON.stringify({ v: VR_SCHEMA, rules: VARIANT_RULES })); }
  catch (e) { console.warn("Variant-rule catalogue too large for localStorage; kept in memory for this session.", e); }
}
function loadVariantRuleLib() {
  try {
    const d = JSON.parse(localStorage.getItem("charsheet-variantrules"));
    if (d && d.v === VR_SCHEMA) VARIANT_RULES = d.rules || [];
    else { VARIANT_RULES = []; if (d) localStorage.removeItem("charsheet-variantrules"); }
  } catch (e) { VARIANT_RULES = []; }
}
async function autoLoadVariantRules() {
  try {
    const res = await dataFetch("data/variantrules.json");
    if (!res.ok) return { found: false, blocked: false };
    const j = await res.json();
    mergeVariantRules((j.variantrule || []).map(parseVariantRule));
    saveVariantRuleLib();
    return { found: true, blocked: false, count: VARIANT_RULES.length };
  } catch (e) { return { found: false, blocked: true }; }
}
function loadVariantRuleFiles(files) {
  let done = 0; const total = files.length, errs = [];
  [...files].forEach(file => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        if (!j.variantrule) errs.push(file.name + ": not a variantrules file");
        else mergeVariantRules(j.variantrule.map(parseVariantRule));
      } catch (e) { errs.push(file.name + ": " + e); }
      if (++done === total) {
        saveVariantRuleLib();
        if (typeof renderHouseRules === "function") renderHouseRules();
        if (errs.length) alert("Some files failed:\n" + errs.join("\n"));
      }
    };
    rd.readAsText(file);
  });
}

/* ----- which are switched on -----
   Stored with the ruleset rather than the character, since an optional rule is a table-wide choice —
   so it travels in an exported ruleset alongside the bans and settings. */
function enabledVariants() { return (HOUSE_RULES && Array.isArray(HOUSE_RULES.variants)) ? HOUSE_RULES.variants : []; }
function variantEnabled(key) { return enabledVariants().indexOf(key) >= 0; }
function toggleVariant(key) {
  if (!Array.isArray(HOUSE_RULES.variants)) HOUSE_RULES.variants = [];
  const at = HOUSE_RULES.variants.indexOf(key);
  if (at >= 0) HOUSE_RULES.variants.splice(at, 1); else HOUSE_RULES.variants.push(key);
  HOUSE_RULES.variants.sort();
  saveHouseRules();
}

/* What the sheet does when a given rule is switched on. `does` is wired-up behaviour; `elsewhere`
   points at a control that already existed before this catalogue did, so enabling the entry doesn't
   imply a second switch that fights the first. Everything absent from this table is recorded and
   displayed only — which is most of them, and is the honest default for DM-facing procedure. */
const VR_EFFECTS = {
  "Encumbrance|PHB": { does: "your Speed drops as carried weight passes 5× and 10× your Strength score" },
  "Hero Points|DMG": { does: "a Hero Points counter beside your HP, with the level-scaled maximum" },
  "Proficiency Dice|DMG": { does: "skills, saving throws and attack to-hit roll a die in place of the flat proficiency bonus" },
  "Rest Variants|DMG": { does: "choose Gritty Realism or Epic Heroism in Settings — the rest buttons then state their durations" },
  "Feats|PHB": { elsewhere: "House Rules → Settings → Feats allowed" },
  "Multiclassing|PHB": { elsewhere: "House Rules → Settings → Multiclassing allowed" },
  "Optional Class Features|TCE": { elsewhere: "House Rules → Settings → Optional class features" },
  "Customizing Your Origin|TCE": { elsewhere: "the character creator's step 1" },
  "Equipment Sizes|PHB": { elsewhere: "House Rules → Settings → Oversized weapons, and the Attacks Size column" },
};

/* ----- Variant Encumbrance (PHB p176) -----
   "In excess of 5 times your Strength score" is encumbered, speed −10; "in excess of 10 times",
   heavily encumbered, speed −20 with disadvantage on Strength/Dexterity/Constitution checks, attacks
   and saves. The speed part is arithmetic the sheet already has the inputs for (itemsTotalWeight and
   the STR score), so it is applied; the disadvantage is stated rather than applied, because it is
   conditional on which ability a roll uses and the sheet has no per-ability disadvantage channel. */
function encumbranceState() {
  const off = { level: "", speedPenalty: 0, note: "" };
  if (!variantEnabled("Encumbrance|PHB")) return off;
  if (typeof itemsTotalWeight !== "function" || typeof abilityScore !== "function") return off;
  const str = abilityScore("str"), carried = itemsTotalWeight();
  if (carried > str * 10) {
    return { level: "heavily encumbered", speedPenalty: 20, carried, str,
      note: "carrying more than 10× your Strength — speed −20 ft, and disadvantage on Strength, Dexterity and Constitution checks, attack rolls and saving throws" };
  }
  if (carried > str * 5) {
    return { level: "encumbered", speedPenalty: 10, carried, str, note: "carrying more than 5× your Strength — speed −10 ft" };
  }
  return { ...off, carried, str };
}

/* ----- Hero Points (DMG p264) -----
   "5 hero points at 1st level. Each time the character gains a level, he or she loses any unspent
   hero points and gains a new total equal to 5 + half the character's level." Spending is left to
   the player: a hero point is spent AFTER the d20 is rolled but before the result is applied, so
   folding a d6 into the roll in advance would be the wrong shape entirely. */
function heroPointMax() {
  if (!variantEnabled("Hero Points|DMG")) return null;
  const lvl = (typeof totalLevel === "function" ? totalLevel() : 1) || 1;
  return 5 + Math.floor(lvl / 2);
}

/* ----- Proficiency Dice (DMG p263) -----
   Replaces the proficiency bonus with a die on ability checks, attack rolls and saving throws;
   expertise rolls it twice rather than doubling. Passive Perception keeps the flat bonus of
   necessity — there is no roll to make — which is why passivePerception() is left alone. */
const VR_PROF_DICE = { 2: "d4", 3: "d6", 4: "d8", 5: "d10", 6: "d12" };
function proficiencyDie() {
  if (!variantEnabled("Proficiency Dice|DMG")) return null;
  return VR_PROF_DICE[typeof profBonus === "function" ? profBonus() : 2] || null;
}
/* The signed dice term a proficiency multiplier contributes, e.g. "+2d6" for expertise at PB 3. */
function proficiencyDiceTerm(mult) {
  const die = proficiencyDie();
  if (!die || !mult) return "";
  return `+${mult}${die}`;
}

/* ----- Rest Variants (DMG p267) -----
   The entry offers two named variants, so enabling it isn't a choice by itself — the pick lives in
   Settings (restVariant) and this only supplies the durations to label the buttons with. */
const VR_REST_TIMES = {
  "": { short: "1 hour", long: "8 hours" },
  gritty: { short: "8 hours", long: "7 days" },
  epic: { short: "5 minutes", long: "1 hour" },
};
function restVariantTimes() {
  if (!variantEnabled("Rest Variants|DMG")) return VR_REST_TIMES[""];
  const pick = (typeof hrSetting === "function" && hrSetting("restVariant")) || "";
  return VR_REST_TIMES[pick] || VR_REST_TIMES[""];
}

/* ----- rendering ----- */
let VR_QUERY = "", VR_TYPE_FILTER = "options", VR_SOURCE_FILTER = "";

function vrSources() { return [...new Set(VARIANT_RULES.map(r => r.source).filter(Boolean))].sort(); }
function vrMatches(r) {
  if (VR_TYPE_FILTER === "options" && !r.ruleType) return false;   // hide the plain reference entries
  if (VR_TYPE_FILTER === "on" && !variantEnabled(vrKey(r))) return false;
  if (VR_SOURCE_FILTER && r.source !== VR_SOURCE_FILTER) return false;
  const q = VR_QUERY.trim().toLowerCase();
  if (!q) return true;
  return (r.name + " " + r.source + " " + r.text).toLowerCase().includes(q);
}
function vrRowHtml(r) {
  const key = vrKey(r), on = variantEnabled(key), eff = VR_EFFECTS[key];
  const attr = escapeHtml(key).replace(/"/g, "&quot;");
  const badge = eff && eff.does ? `<span class="ruling-auto" title="${escapeHtml(eff.does)}">the sheet applies this</span>`
    : eff && eff.elsewhere ? `<span class="ruling-auto" title="already switched on at: ${escapeHtml(eff.elsewhere)}">set elsewhere</span>`
    : `<span class="ruling-manual">recorded only</span>`;
  return `<div class="vr-rule${on ? " vr-on" : ""}">
    <label class="vr-head"><input type="checkbox" class="vr-toggle" data-vr="${attr}"${on ? " checked" : ""}>
      <b>${escapeHtml(r.name)}</b></label>
    <span class="hint">${escapeHtml(r.source)}${r.page ? " p" + r.page : ""}${r.ruleType ? " &middot; " + (VR_TYPE_NAMES[r.ruleType] || r.ruleType) : ""}</span>
    ${badge}
    <button type="button" class="vr-more" data-vrtext="${attr}" title="show the rule text">&hellip;</button>
    ${on && eff && (eff.does || eff.elsewhere) ? `<div class="hint vr-effect">${escapeHtml(eff.does || ("Set at: " + eff.elsewhere))}</div>` : ""}
  </div>`;
}
function hrRenderVariants() {
  if (!VARIANT_RULES.length) {
    return `<div class="hint">No optional-rule catalogue loaded. It comes from 5e.tools' own
      <code>data/variantrules.json</code>, auto-loaded like the spell and equipment libraries &mdash; drop that file in
      your <code>data/</code> folder, or
      <label style="display:inline">import it here <input type="file" id="vr-import" accept="application/json"></label>.</div>`;
  }
  const shown = VARIANT_RULES.filter(vrMatches);
  const on = enabledVariants().length;
  const typeBtn = (v, label, title) =>
    `<button type="button" class="fbtn${VR_TYPE_FILTER === v ? " inc" : ""}" data-vrtype="${v}" title="${escapeHtml(title)}">${label}</button>`;
  const srcOpts = ['<option value="">every book</option>']
    .concat(vrSources().map(s => `<option value="${escapeHtml(s)}"${VR_SOURCE_FILTER === s ? " selected" : ""}>${escapeHtml(s)}</option>`)).join("");
  return `<div class="hint">The books' own optional and variant rules, imported from
      <code>data/variantrules.json</code> rather than written into the sheet. These are <b>RAW alternatives</b>,
      not this table's rulings &mdash; switching one on is a campaign choice, and travels in an exported ruleset.
      <b>${on}</b> switched on of ${VARIANT_RULES.length} catalogued.</div>
    <div class="fbody" style="margin:.4rem 0">
      ${typeBtn("options", "Options &amp; variants", "only entries the books mark Optional or Variant")}
      ${typeBtn("all", "Everything", "including the plain reference entries in the same file")}
      ${typeBtn("on", "Switched on", "only what this campaign uses")}
      <label style="margin-left:.5rem">Book <select id="vr-source">${srcOpts}</select></label>
      <input type="text" id="vr-search" placeholder="search rules…" value="${escapeHtml(VR_QUERY)}" style="width:14rem;margin-left:.4rem" autocomplete="off">
      <span class="hint">${shown.length} shown</span>
    </div>
    ${shown.length ? shown.map(vrRowHtml).join("") : `<div class="hint">no matches</div>`}`;
}
/* Rule text expands inline under its row, the same click-to-expand the spell and item libraries use
   rather than a popup — these run to several paragraphs and a tooltip would be unreadable. */
function toggleVariantText(btn) {
  const row = btn.closest(".vr-rule");
  const open = row.querySelector(".vr-text");
  if (open) { open.remove(); return; }
  const r = VARIANT_RULES.find(x => vrKey(x) === btn.dataset.vrtext); if (!r) return;
  const d = document.createElement("div");
  d.className = "vr-text";
  d.innerHTML = `${escapeHtml(r.text).replace(/\n/g, "<br>")}` +
    `<div class="hint">&mdash; ${escapeHtml(r.source)}${r.page ? ", p." + r.page : ""}</div>`;
  row.appendChild(d);
}
