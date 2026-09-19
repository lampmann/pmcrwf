/* ============================================================
   RULINGS — the part of a house ruleset that can't be a checkbox.

   Most of a table's rules are adjudication, not mechanics: "Total Cover
   applies to all effects", "a Challenge Rating of '—' is not equal to
   itself". The sheet can't apply those, and shouldn't pretend to. But
   there's a failure mode in only ever building the automatable half —
   the Bans tab has buttons and "ability checks are only called for when
   the outcome is uncertain" has nothing to click, so over time the
   rules with switches start feeling like the real ones and the judgment
   calls read as flavour text. That's backwards: the judgment calls are
   where a table's character actually lives.

   Three things guard against that here.

   1. EVERY ruling is listed, automated or not, and each says which it
      is. A ruling the sheet enforces is marked; the rest are marked
      "yours to apply" rather than left to look like leftovers.
   2. They're grouped by SUBJECT and searchable, so a ruling is findable
      at the moment it comes up rather than only readable end to end.
      Seven of these are Echo Knight; nobody wants to scroll past them.
   3. Rulings that touch what YOUR character actually has float to the
      top. An Echo Knight sees the Echo rulings first; a Life cleric
      with Goodberry sees the Lifeberry one. See rulingsForCharacter().

   The set is data, so a different table ships a different file. Ids
   match the source document (house-rules/lampmann.md) so a ruling can
   be cross-referenced with whatever the DM actually wrote down.
   ============================================================ */

const RULING_SUBJECTS = [
  ["table", "Table &amp; social"],
  ["space", "Physics, space &amp; targeting"],
  ["timing", "Action economy &amp; timing"],
  ["spells", "Spells"],
  ["items", "Items &amp; equipment"],
  ["features", "Class features"],
  ["echo", "Echo Knight"],
  ["creatures", "Creatures &amp; stat blocks"],
];

/* { id, subject, text, tags?, auto? }
   `tags` are names to match against what a character actually has — a class, subclass, spell or feat
   — and drive the "relevant to this character" section. `auto` names the part of the sheet that
   already applies the ruling, and is the honest half: anything without it is yours to remember. */
const RULINGS_LAMPMANN = [
  // ----- table & social -----
  { id: "H1", subject: "table", text: "If you correctly rules-lawyer the DM, you may grant one Inspiration to a character of your choice." },
  { id: "H2", subject: "table", text: "Metagaming is based. Look up the stat blocks of the monsters you're fighting, and read the module if you want - being able to interface with the game's mechanics creatively and transparently is a good thing." },
  { id: "H3", subject: "table", text: "The DM does not fudge dice." },
  { id: "R42", subject: "table", text: "The gentlemyowwas' agreement (\"gentlemen and women\"): no breaking terrain to make an open field and kiting 99% of encounters." },
  { id: "R23", subject: "table", text: "Directed at a specific player; no mechanical content." },

  // ----- physics, space & targeting -----
  { id: "R1", subject: "space", text: "No creature, object, magical force, or image may move through a wall or solid object unless explicitly stated." },
  { id: "R2", subject: "space", text: "Total Cover applies to all effects, not just attacks and spells." },
  { id: "R16", subject: "space", text: "Unless otherwise specified, any given creature only has two hands." },
  { id: "R41", subject: "space", text: "You may not target objects worn, carried, or held by a creature." },
  { id: "R44", subject: "space", text: "Anything that has an unspecified range has a range of 5 ft." },
  { id: "R34", subject: "space", text: "Something is magical if any of the following is true: it is a magic item; it is a spell; it lets you create the effects of a spell mentioned in its description; it is a spell attack; it is fueled by the use of spell slots; or its description refers to it as magical." },

  // ----- action economy & timing -----
  { id: "R7", subject: "timing", text: "Use group initiative for summons and monsters." },
  { id: "R38", subject: "timing", text: "Stealth (to determine surprise) is rolled immediately before initiative." },
  { id: "R43", subject: "timing", text: "Turns exist outside of combat." },
  { id: "R45", subject: "timing", text: "An untriggered Ready action ends right before initiative is rolled." },
  { id: "R47", subject: "timing", auto: "Combat tracker - Cast a Spell is unavailable under Bonus Action once it's spent",
    text: "A spell cast with a bonus action must always use a bonus action to cast, regardless of whether you have already taken a bonus action this turn. The reading this rejects treats the PHB's \"provided that you haven't already taken a bonus action this turn\" as lapsing once you have, making the spell free rather than uncastable." },
  { id: "H4", subject: "timing", tags: ["Planar Binding"], auto: "Concurrent-casting counter beside your HP",
    text: "Only one casting of Planar Binding per player character may be active at a time." },

  // ----- spells -----
  { id: "R4", subject: "spells", text: "Spells do not unleash the caster's desired effect. The PHB's flavour text is not a mechanical grant - a spell does only what its description says. (\"I cast Fire Bolt, with the desired effect of killing all my enemies\" does not work.)" },
  { id: "R13", subject: "spells", tags: ["Dispel Magic"], text: "Dispel Magic can't dispel magical effects themselves, only spells \"on\" magical effects." },
  { id: "R14", subject: "spells", tags: ["Hunger of Hadar"], text: "Hunger of Hadar's \"blackness\" is not darkness." },
  { id: "R15", subject: "spells", tags: ["Animate Dead"], text: "Due to how prepositional phrases work, Animate Dead's target reads as \"'a pile of bones' OR 'a corpse of a Medium or Small humanoid' within range\"." },
  { id: "R18", subject: "spells", tags: ["Invisibility"], text: "The invisible condition ends on everything affected by that casting of Invisibility when the spell ends." },
  { id: "R21", subject: "spells", tags: ["Guidance", "Resistance"], auto: "Guidance / Resistance counters beside your HP",
    text: "\"The die\" in Guidance and Resistance refers to the d4, so stacking works even without dropping concentration. Two castings suppress rather than end one another (PHB p205), and a spell's end condition is part of its effect rather than its duration - so expending the active one wakes the suppressed one with \"after making the ability check\" still true." },
  { id: "R22", subject: "spells", tags: ["Death Ward"], auto: "Death Ward counter beside your HP", text: "Death Ward stacking also works." },
  { id: "R24", subject: "spells", tags: ["Wizard", "School of Divination"], text: "Expert Divination only lets you regain one spell slot per expended spell slot." },
  { id: "R33", subject: "spells", tags: ["Shapechange"], text: "Shapechange isn't considered a source of benefits for the purposes of itself." },
  { id: "R46", subject: "spells", tags: ["Wristpocket"], text: "Wristpocket doesn't generate extra copies of the object." },
  { id: "R48", subject: "spells", tags: ["Shadow Blade"], text: "No passing Shadow Blades. Passing an item isn't a thing in 5e - you'd have to drop or throw it for someone else to pick up, and either dissipates the blade." },

  // ----- items & equipment -----
  { id: "R9", subject: "items", auto: "House Rules → Settings, \"Trinkets are worth 0 gp\"", text: "Trinkets have a value of 0 gp." },
  { id: "R10", subject: "items", text: "Trinkets do not have any mechanical properties." },
  { id: "R11", subject: "items", tags: ["Spellwrought Tattoo"], text: "Spellwrought Tattoos vanish when you cast the spell using the tattoo, instead of at the end of the spell's duration." },
  { id: "R8", subject: "items", tags: ["The Genie", "Genie"], text: "Genie's Vessels cannot function as anything other than a Genie's Vessel." },
  { id: "R17", subject: "items", auto: "Attacks module Size column + House Rules → Settings",
    text: "Oversized weapons can be wielded by PCs; the DMG's optional \"two or more sizes larger is too big to use at all\" clause does not apply by default. The extra damage dice belong to the weapon - a greataxe sized for a Large creature deals 2d12 whoever swings it - and the wielder's size sets only the penalty." },
  { id: "R35", subject: "items", auto: "Stated on the character creator's equipment step", text: "Unless explicitly stated, you must choose a mundane item when choosing an equipment." },
  { id: "R36", subject: "items", tags: ["Goodberry", "Life Domain", "Cleric"], text: "Lifeberry works - Goodberry cast by a Life Domain cleric gets Disciple of Life, so each berry heals 2 + the spell's level rather than 1." },
  { id: "R49", subject: "items", text: "You can't craft animals." },

  // ----- class features -----
  { id: "R19", subject: "features", tags: ["Barbarian", "Druid"], text: "You may concentrate on spells while raging in wild shape." },
  { id: "R20", subject: "features", tags: ["Sorcerer"], text: "Taking a Sorcerer level for the first time counts as gaining a sorcerer level." },
  { id: "R37", subject: "features", tags: ["Cartomancer"], text: "Cartomancer doesn't give you a free cast of the spell." },
  { id: "R39", subject: "features", tags: ["Divine Soul"], text: "If you choose to replace a Divine Magic spell, you must replace it with a spell from the cleric spell list, no matter when you replace it. (Deliberately not implemented - the original rationale isn't recalled.)" },
  { id: "R40", subject: "features", text: "You can't will yourself into becoming a half-dragon, or any other template." },

  // ----- Echo Knight -----
  { id: "R26", subject: "echo", tags: ["Echo Knight"], text: "An Echo Knight's Echo can only be moved by them once per round." },
  { id: "R27", subject: "echo", tags: ["Echo Knight"], text: "You cannot attack through Echo Avatar." },
  { id: "R28", subject: "echo", tags: ["Echo Knight"], text: "The Echo is neither a creature nor an object." },
  { id: "R29", subject: "echo", tags: ["Echo Knight"], text: "The Echo can move in any direction, including up." },
  { id: "R30", subject: "echo", tags: ["Echo Knight"], text: "The Echo's pseudo-opportunity attack can trigger on forced movement." },
  { id: "R31", subject: "echo", tags: ["Echo Knight"], text: "When you're attacking through your Echo and are out of line of sight, you're an unseen attacker." },
  { id: "R32", subject: "echo", tags: ["Echo Knight"], text: "You may attack as if you are in the Echo's space, meaning you may make melee attacks through the Echo." },

  // ----- creatures & stat blocks -----
  { id: "R3", subject: "creatures", text: "Ability checks are only called for when success or failure is meaningfully uncertain; otherwise the DM determines the outcome narratively." },
  { id: "R6", subject: "creatures", text: "Contracts, Pacts, Blessings, and Charms can only be given by willing and unthreatened entities that are not controlled by the players." },
  { id: "R12", subject: "creatures", tags: ["Trident of Fish Command"], text: "Bears are fish - a joke recording a real ruling: the Trident of Fish Command affects beasts with an innate swimming speed, which includes polar bears and cave bears." },
  { id: "R25", subject: "creatures", text: "A Challenge Rating of \"-\" is not equal to itself, so it never satisfies a CR comparison. Without this, a Druid could wild shape into a Nystul'd Mighty Servant of Leuk-o and similar. This deliberately overlaps the Nystul's Magic Aura ban - there are ways to summon CR 0 creatures without it, so both are load-bearing." },
];

const RULING_SETS = {
  lampmann: { label: "Lampmann's House Rules", rulings: RULINGS_LAMPMANN },
};
/* Which set is showing. Part of the ruleset, so loading a preset (or importing a file) switches it. */
function activeRulings() {
  const set = RULING_SETS[(typeof HOUSE_RULES !== "undefined" && HOUSE_RULES.rulingSet) || ""];
  return set ? set.rulings : [];
}

/* ----- relevance -----
   Every name this character actually has: classes, subclasses, the spells on their list, and any
   feat taken at an ASI. A ruling matches when one of its tags appears among them, so the Echo Knight
   block surfaces for an Echo Knight and stays out of everyone else's way. Matching is substring and
   case-insensitive in both directions, because a tag says "Echo Knight" while the subclass field may
   read "Echo Knight" or the class row "Fighter" — and "Cleric" should match "Cleric" the class. */
function characterRulingTerms() {
  const terms = [];
  if (typeof getClasses === "function") {
    getClasses().forEach(c => { if (c.name) terms.push(c.name); if (c.sub) terms.push(c.sub); });
  }
  if (typeof CHARACTER_SPELLS !== "undefined") CHARACTER_SPELLS.forEach(s => s.name && terms.push(s.name));
  if (typeof FEAT_CHOICES !== "undefined") Object.values(FEAT_CHOICES).forEach(f => f && terms.push(f));
  if (typeof CHARACTER_ITEMS !== "undefined") CHARACTER_ITEMS.forEach(i => i.name && terms.push(i.name));
  const race = document.getElementById("char-race"), sub = document.getElementById("char-subrace");
  if (race && race.value) terms.push(race.value);
  if (sub && sub.value) terms.push(sub.value);
  return terms.map(t => String(t).toLowerCase()).filter(Boolean);
}
/* Matching runs both ways so a tag of "Echo Knight" catches a subclass field reading "Echo Knight
   (Wildemount)" and a tag of "Genie" catches "The Genie". Terms shorter than three characters are
   ignored: a one-letter item name would otherwise be a substring of half the tag list. */
function rulingIsRelevant(r, terms) {
  if (!r.tags || !r.tags.length) return false;
  return r.tags.some(tag => {
    const t = tag.toLowerCase();
    return terms.some(term => term.length >= 3 && (term.includes(t) || t.includes(term)));
  });
}
function rulingsForCharacter() {
  const terms = characterRulingTerms();
  return activeRulings().filter(r => rulingIsRelevant(r, terms));
}

/* ----- search ----- */
function rulingMatches(r, q) {
  if (!q) return true;
  const hay = (r.id + " " + r.text + " " + (r.tags || []).join(" ") + " " + (r.auto || "")).toLowerCase();
  return hay.includes(q);
}

/* ----- rendering ----- */
let RULINGS_QUERY = "";

function rulingHtml(r) {
  // "Yours to apply" is stated as plainly as "the sheet does this" — the un-automated rulings are the
  // majority and the point, not leftovers, so they get a label rather than the absence of one.
  const badge = r.auto
    ? `<span class="ruling-auto" title="${escapeHtml(r.auto)}">the sheet applies this</span>`
    : `<span class="ruling-manual">yours to apply</span>`;
  return `<div class="ruling"><span class="ruling-id">${escapeHtml(r.id)}</span>
    <span class="ruling-text">${escapeHtml(r.text)}</span> ${badge}</div>`;
}

function hrRenderRulings() {
  const all = activeRulings();
  if (!all.length) {
    return `<div class="hint">No rulings.</div>`;
  }
  const q = RULINGS_QUERY.trim().toLowerCase();
  const shown = all.filter(r => rulingMatches(r, q));
  const relevant = q ? [] : rulingsForCharacter();
  const autoCount = all.filter(r => r.auto).length;

  const relevantHtml = relevant.length ? `<div class="ruling-group">
    <div class="flabel">Relevant to this character <span class="hint">${relevant.length}</span></div>

    ${relevant.map(rulingHtml).join("")}
  </div>` : "";

  const groups = RULING_SUBJECTS.map(([key, label]) => {
    const rows = shown.filter(r => r.subject === key);
    if (!rows.length) return "";
    return `<div class="ruling-group"><div class="flabel">${label} <span class="hint">${rows.length}</span></div>
      ${rows.map(rulingHtml).join("")}</div>`;
  }).join("");

  return `<div class="hint">${all.length} rulings: <b>${autoCount}</b> automated, <b>${all.length - autoCount}</b> manual.</div>
    <div style="margin:.4rem 0">
      <input type="text" id="hr-ruling-search" placeholder="search rulings…" value="${escapeHtml(RULINGS_QUERY)}" style="width:18rem" autocomplete="off">
      ${q ? `<span class="hint">${shown.length} match${shown.length === 1 ? "" : "es"}</span>` : ""}
    </div>
    ${relevantHtml}
    ${groups || `<div class="hint">no matches</div>`}`;
}
