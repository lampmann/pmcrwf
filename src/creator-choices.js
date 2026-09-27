/* ============================================================
   CHARACTER CREATOR: THE CHOICES YOUR RACE, CLASS AND FEATS HAND YOU

   creator.js walks the PHB's five steps; this file fills in what those
   steps used to leave for later, or leave out altogether:

     step 1  racial languages and tools, and any trait choice an effects
             entry models (Variant Human's skill, Half-Elf's two skills)
     step 2  saving throws, armor, weapons, class skills and tools, the
             multiclass subset for a second class, optional features
             (Fighting Style, Invocations, Metamagic, Maneuvers...), and
             class feature choices such as Expertise
     step 3  Ability Score Improvements for a character starting at 4th
             level or higher: a feat, or +1 to two scores
     step 4  spells: cantrips, spells known, a Wizard's spellbook, and a
             prepared caster's prepared list

   Everything is written in the shapes the sheet already reads (fields,
   PROFICIENCIES, FEAT_CHOICES, ASI_CHOICES, EFFECT_CHOICES,
   OPTFEATURE_CHOICES, CHARACTER_SPELLS), so a created character is the
   same thing as one filled in by hand, and every choice here stays
   editable on the sheet afterwards.

   Proficiency data comes from the class and race records in the user's
   own data (startingProficiencies, multiclassing.proficienciesGained,
   languageProficiencies...). A class the data doesn't have contributes
   nothing, and nothing is guessed in its place.
   ============================================================ */

/* ---------- names ---------- */
function crTitle(s) { return String(s || "").replace(/(^|[\s(\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()); }
function crSkillSlug(n) { return String(n || "").toLowerCase().replace(/[^a-z]/g, ""); }
function crSkillName(n) { const hit = SKILLS.find(s => crSkillSlug(s[0]) === crSkillSlug(n)); return hit ? hit[0] : crTitle(n); }
/* "{@item hand crossbow|phb|hand crossbows}", "battleaxe|phb" and "simple" all reduce to the item. */
function crRefName(x) {
  const raw = typeof x === "string" ? x : (x && x.proficiency) || "";
  const tag = /^\{@\w+\s+([^|}]+)/.exec(raw);
  return crTitle((tag ? tag[1] : raw.split("|")[0]).trim());
}
function crSort(list) { return [...new Set((list || []).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function crUniqueCI(list) {
  const seen = new Set(), out = [];
  (list || []).forEach(x => { const k = String(x).toLowerCase(); if (x && !seen.has(k)) { seen.add(k); out.push(x); } });
  return out;
}

/* ---------- class rows ---------- */
/* The rows as the rest of the creator should see them: a subclass chosen before the level that grants
   it is dropped (the picker is hidden in that case too; see creator.js). */
function crRows() {
  return CREATOR.classes.map(r => {
    const rec = ciFindClass(r.name);
    const locked = rec && rec.subLevel && (Number(r.lvl) || 0) < rec.subLevel;
    return { name: r.name, sub: locked ? "" : r.sub, lvl: Number(r.lvl) || 0 };
  });
}
function crFirstRow() { return CREATOR.classes.findIndex(r => (r.name || "").trim()); }
/* What a class row grants. The first class gets its full starting set and its saving throws; every
   later class gets only what multiclassing into it gives (PHB p164), and never saves. */
function crRowProf(i) {
  const r = CREATOR.classes[i], rec = r && (r.name || "").trim() ? ciFindClass(r.name) : null;
  if (!rec) return null;
  if (i === crFirstRow()) {
    const sp = rec.startProf || {};
    return { rec, first: true, saves: rec.saves || [], skills: sp.skills, weapons: sp.weapons, armor: sp.armor, tools: sp.toolProficiencies };
  }
  const mc = rec.mcProf || {};
  return { rec, first: false, saves: [], skills: mc.skills, weapons: mc.weapons, armor: mc.armor, tools: mc.toolProficiencies };
}

/* ---------- choice slots ---------- */
function crSkillBlocks(list) {
  return chooseBlocks(list, "skills").map(b => ({ count: b.count, from: crSort(b.from.map(crSkillName)) }));
}
/* Several tool objects that are all choices are alternatives ("any artisan's tools or any musical
   instrument"), so they become one slot over the union rather than one slot each. */
function crToolBlocks(list) {
  const entries = (Array.isArray(list) ? list : []).filter(e => e && typeof e === "object");
  const pureChoice = e => Object.entries(e).every(([k, v]) => k === "choose" || (/^any/.test(k) && Number.isInteger(v)));
  if (entries.length > 1 && entries.every(pureChoice)) {
    const blocks = entries.flatMap(e => chooseBlocks([e], "tools"));
    return blocks.length ? [{ count: Math.max(...blocks.map(b => b.count)), from: crSort(blocks.flatMap(b => b.from)) }] : [];
  }
  return chooseBlocks(entries, "tools").map(b => ({ count: b.count, from: crSort(b.from) }));
}
function crLangBlocks(list) {
  return chooseBlocks(list, "languages").map(b => ({ count: b.count, from: crSort(b.from.map(crTitle)) }));
}
function crFixedNames(list, skip) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach(entry => Object.entries(entry || {}).forEach(([k, v]) => {
    if (v !== true || /^(choose|any|other)/i.test(k) || (skip && skip.test(k))) return;
    out.push(crRefName(k));
  }));
  return out;
}

/* A row of <select>s for a set of blocks, stored in CREATOR.picks[key] one value per slot. `taken`
   names are left out of every slot except one already holding them. An empty option list (no item
   or language data loaded) becomes a text box, so the pick can still be written down. */
function crPickSlotsHtml(key, blocks, taken) {
  const picks = CREATOR.picks[key] || [];
  const total = blocks.reduce((n, b) => n + b.count, 0);
  let slot = 0;
  const html = blocks.map(b => {
    const out = [];
    for (let i = 0; i < b.count; i++) {
      const idx = slot++, cur = picks[idx] || "";
      if (!b.from.length) {
        out.push(`<input type="text" class="cr-pick" data-crkey="${escapeHtml(key)}" data-crslot="${idx}" value="${escapeHtml(cur)}" style="width:9rem">`);
        continue;
      }
      const others = new Set([...picks.filter((v, j) => j !== idx && v), ...(taken || [])].map(x => x.toLowerCase()));
      const list = b.from.filter(o => o === cur || !others.has(o.toLowerCase()));
      out.push(`<select class="cr-pick" data-crkey="${escapeHtml(key)}" data-crslot="${idx}"><option value="">- choose -</option>` +
        list.map(o => `<option value="${escapeHtml(o)}"${o === cur ? " selected" : ""}>${escapeHtml(o)}</option>`).join("") + `</select>`);
    }
    return out.join(" ");
  }).join(" ");
  return { html, total };
}
function crUnfilled(key, blocks) {
  const picks = CREATOR.picks[key] || [];
  let slot = 0, missing = 0;
  blocks.forEach(b => { for (let i = 0; i < b.count; i++) { const idx = slot++; if (b.from.length && !(picks[idx] || "").trim()) missing++; } });
  return missing;
}
function crPicked(key) { return (CREATOR.picks[key] || []).map(v => (v || "").trim()).filter(Boolean); }

/* ---------- features the character will have ---------- */
function creatorFeatChoices() {
  const out = { ...creatorRaceFeatChoices() };
  Object.entries(CREATOR.asiFeats).forEach(([k, v]) => { if ((v || "").trim()) out[k] = v.trim(); });
  return out;
}
function creatorFeatureList() {
  if (typeof featuresFor !== "function") return [];
  return featuresFor({ race: CREATOR.race, subrace: CREATOR.subrace, classes: crRows(),
    featChoices: creatorFeatChoices(), optChoices: CREATOR.optChoices });
}

/* ---------- skills already granted from somewhere else ---------- */
function crEffectSkillGrants(features) {
  const out = [];
  features.forEach(f => {
    const entry = dbEntryFor(f); if (!entry) return;
    (entry.effects || []).forEach(e => {
      const m = /^skill-([a-z]+)$/.exec(e.target || "");
      if (m && (e.op === "prof" || e.op === "expertise") && !(e.activation && e.activation.kind !== "always")) out.push(crSkillName(m[1]));
    });
    const chosen = CREATOR.effectChoices[f.fkey] || {};
    (entry.choices || []).forEach(c => {
      if (c.kind !== "pick") return;
      [].concat(chosen[c.id] || []).forEach(v => {
        if (v && SKILLS.some(s => crSkillSlug(s[0]) === crSkillSlug(v)) &&
            (entry.effects || []).some(e => e.op === "prof" && String(e.target).includes("{choice:" + c.id + "}"))) out.push(crSkillName(v));
      });
    });
  });
  return out;
}
function crBackgroundSkills() {
  const c = CREATOR;
  if (c.customBg) return c.bgSkills.filter(Boolean).map(crSkillName);
  const rec = ciFindBackground(c.background);
  return rec ? [...flatProfNames(rec.skills), ...((c.bgChoices && c.bgChoices.skills) || [])].filter(Boolean).map(crSkillName) : [];
}
/* Every skill proficiency except the ones stored under `exceptKey`. */
function crTakenSkills(exceptKey) {
  const out = [...crBackgroundSkills(), ...crEffectSkillGrants(creatorFeatureList())];
  Object.keys(CREATOR.picks).filter(k => k.startsWith("skills:") && k !== exceptKey).forEach(k => out.push(...crPicked(k)));
  return out;
}

/* ---------- effects-entry choices (Expertise, a racial skill, Resilient's ability) ---------- */
function crRefsChoice(e, id) {
  const tag = "{choice:" + id + "}";
  return (e.activation && e.activation.kind === "choice" && e.activation.choice === id) ||
    String(e.target || "").includes(tag) || JSON.stringify(e.value || "").includes(tag);
}
function crClassLevel(name) {
  const r = crRows().find(r => (r.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase());
  return r ? r.lvl : 0;
}
/* The effects engine's `when` conditions, evaluated against the character being built. Armor and shield
   conditions are situational, so a choice behind one still has to be made. */
function crWhen(when, f) {
  if (!when) return true;
  return Object.entries(when).every(([k, v]) => {
    if (k === "minLevel") return creatorTotalLevel() >= v;
    if (k === "maxLevel") return creatorTotalLevel() <= v;
    if (k === "hasClass") return crClassLevel(v) > 0;
    if (k === "casting") return crRows().some(r => r.name && classCasting(r.name, r.sub) !== "none");
    if (k === "minClassLevel" || k === "maxClassLevel") {
      const cls = (v.class === "@self" || v.class == null) ? ((f.origin && f.origin.className) || "") : v.class;
      return k === "minClassLevel" ? crClassLevel(cls) >= v.level : crClassLevel(cls) <= v.level;
    }
    if (k === "armor" || k === "notArmor" || k === "shield") return true;
    return false;
  });
}
function crSpellFilterOptions(c) {
  return (typeof SPELL_LIB !== "undefined" ? SPELL_LIB : []).filter(sp => spellMatchesFilterSpec(sp, c.filter))
    .map(sp => sp.name.toLowerCase()).sort((a, b) => a.localeCompare(b));
}
function crLiveChoices(f) {
  const entry = dbEntryFor(f);
  if (!entry || !entry.choices) return [];
  return entry.choices.filter(c => {
    if (c.kind === "spellfilter" && !crSpellFilterOptions(c).length) return false;
    if (!["ability", "pick", "spellfilter"].includes(c.kind)) return false;
    const effs = (entry.effects || []).filter(e => crRefsChoice(e, c.id));
    return !effs.length || effs.some(e => crWhen(e.when, f));
  });
}
function crChoiceMissing(f, c) {
  const v = (CREATOR.effectChoices[f.fkey] || {})[c.id];
  const n = c.kind === "pick" ? Math.max(1, c.n || 1) : 1;
  const have = [].concat(v || []).filter(x => x != null && x !== "").length;
  return Math.max(0, n - have);
}
function crChoicesHtml(f) {
  const live = crLiveChoices(f);
  if (!live.length) return "";
  const cur = CREATOR.effectChoices[f.fkey] || {};
  const attrs = (c, i) => `class="cr-effchoice" data-fkey="${f.fkey}" data-choice="${c.id}"${i != null ? ` data-slot="${i}"` : ""}`;
  const parts = live.map(c => {
    if (c.kind === "ability") {
      const v = cur[c.id] || "";
      return `<label>${escapeHtml(c.label || "Ability")}: <select ${attrs(c)}><option value="">-</option>` +
        ABILITIES.map(a => `<option value="${a.key}"${v === a.key ? " selected" : ""}>${a.name}</option>`).join("") + `</select></label>`;
    }
    if (c.kind === "spellfilter") {
      const v = cur[c.id] || "";
      return `<label>${escapeHtml(c.label || "Spell")}: <select ${attrs(c)}><option value="">-</option>` +
        crSpellFilterOptions(c).map(o => `<option value="${escapeHtml(o)}"${v === o ? " selected" : ""}>${escapeHtml(crTitle(o))}</option>`).join("") + `</select></label>`;
    }
    const n = Math.max(1, c.n || 1);
    const vals = n > 1 ? [].concat(cur[c.id] || []) : [cur[c.id] || ""];
    const skillish = (c.options || []).every(o => SKILLS.some(s => crSkillSlug(s[0]) === o));
    const taken = skillish ? new Set(crTakenSkills().map(crSkillSlug)) : new Set();
    // Skills this same choice already holds don't count as taken elsewhere.
    vals.forEach(v => taken.delete(v));
    const selects = [];
    for (let i = 0; i < n; i++) {
      const v = vals[i] || "";
      const others = new Set(vals.filter((x, j) => j !== i && x));
      const opts = (c.options || []).filter(o => o === v || (!others.has(o) && !taken.has(o)))
        .map(o => ({ o, label: choiceOptionLabel(o) })).sort((a, b) => a.label.localeCompare(b.label));
      selects.push(`<select ${attrs(c, n > 1 ? i : null)}><option value="">-</option>` +
        opts.map(({ o, label }) => `<option value="${escapeHtml(String(o))}"${v === o ? " selected" : ""}>${escapeHtml(label)}</option>`).join("") + `</select>`);
    }
    return `<label>${escapeHtml(c.label || "Choice")}: ${selects.join(" ")}</label>`;
  });
  return `<div class="cr-feature-choice"><b>${escapeHtml(f.name)}</b> ${parts.join(" ")}</div>`;
}
function crFeaturesForStep(step) {
  return creatorFeatureList().filter(f => {
    const k = f.origin && f.origin.kind;
    if (step === 1) return k === "race" || k === "subrace";
    if (step === 2) return (k === "class" || k === "subclass" || k === "optfeature") && !f.isAsi;
    if (step === 3) return !!f.isAsi && !!f.asiChosen;
    return false;
  });
}
/* Step 1's racial feat renders its choices under the feat box (raceFeatHtml), so it's left out here. */
function crStepChoicesHtml(step) { return crFeaturesForStep(step).filter(f => !f.isRaceFeat).map(crChoicesHtml).join(""); }

/* ---------- step 1: languages and tools from the race ---------- */
function crRaceRecs() {
  const rec = ciFindRace(CREATOR.race);
  return { rec, sub: rec ? findSubByName(rec, CREATOR.subrace) : null };
}
function crRaceList(field) {
  const { rec, sub } = crRaceRecs();
  return [...((rec && rec[field]) || []), ...((sub && sub[field]) || [])];
}
function crBackgroundLanguages() {
  const rec = !CREATOR.customBg ? ciFindBackground(CREATOR.background) : null;
  const fixed = rec ? flatProfNames(rec.languages).map(crTitle) : [];
  const picked = rec ? ((CREATOR.bgChoices && CREATOR.bgChoices.languages) || []) : CREATOR.bgTools.filter(t => ciFind(LANGUAGE_LIB, t));
  return [...fixed, ...picked].filter(Boolean);
}
function crRaceProfHtml() {
  const langs = crRaceList("languages"), tools = crRaceList("tools"), weapons = crRaceList("weapons");
  const fixedLangs = crFixedNames(langs), fixedTools = crFixedNames(tools), fixedWeapons = crFixedNames(weapons);
  const lang = crPickSlotsHtml("langs:race", crLangBlocks(langs), [...fixedLangs, ...crBackgroundLanguages()]);
  const tool = crPickSlotsHtml("tools:race", crToolBlocks(tools), fixedTools);
  const rows = [];
  if (fixedLangs.length || lang.total) rows.push(`<div>Languages ${escapeHtml(fixedLangs.join(", "))} ${lang.html}</div>`);
  if (fixedWeapons.length) rows.push(`<div>Weapons ${escapeHtml(fixedWeapons.join(", "))}</div>`);
  if (fixedTools.length || tool.total) rows.push(`<div>Tools ${escapeHtml(fixedTools.join(", "))} ${tool.html}</div>`);
  return rows.length ? `<div style="margin-top:.4rem">${rows.join("")}</div>` : "";
}

/* ---------- step 2: what each class grants ---------- */
const CR_ARMOR = { light: "light", medium: "medium", heavy: "heavy", shield: "shields", shields: "shields" };
function crArmorKeys(list) {
  return crUniqueCI((list || []).map(a => CR_ARMOR[String(typeof a === "string" ? a : (a && a.proficiency) || "").toLowerCase()]).filter(Boolean));
}
function crWeaponSplit(list) {
  const cats = [], named = [];
  (list || []).forEach(w => {
    if (w && typeof w === "object" && w.optional) return;
    const raw = typeof w === "string" ? w : (w && w.proficiency) || "";
    if (/^(simple|martial)$/i.test(raw)) cats.push(raw.toLowerCase()); else if (raw) named.push(crRefName(raw));
  });
  return { cats: crUniqueCI(cats), named: crSort(crUniqueCI(named)) };
}
function crClassBlockHtml(i) {
  const p = crRowProf(i); if (!p) return "";
  const name = p.rec.name;
  const w = crWeaponSplit(p.weapons), armor = crArmorKeys(p.armor);
  const facts = [];
  if (p.saves.length) facts.push(`Saves ${p.saves.map(a => a.toUpperCase()).join(", ")}`);
  if (armor.length) facts.push(`Armor ${armor.join(", ")}`);
  if (w.cats.length || w.named.length) facts.push(`Weapons ${[...w.cats, ...w.named].join(", ")}`);
  const fixedTools = crFixedNames(p.tools);
  if (fixedTools.length) facts.push(`Tools ${fixedTools.join(", ")}`);
  const skills = crPickSlotsHtml("skills:" + name, crSkillBlocks(p.skills), crTakenSkills("skills:" + name));
  const tools = crPickSlotsHtml("tools:" + name, crToolBlocks(p.tools), fixedTools);
  const row = crRows()[i];
  const groups = optGroupsFor(p.rec, ciFindSub(p.rec, row.sub || ""), row.lvl).map(g =>
    `<div>${escapeHtml(g.name)}: ${optSlotsHtml(g, row.lvl, CREATOR.optChoices, "cr-optf")}</div>`).join("");
  const choices = crFeaturesForStep(2).filter(f => (f.origin.className || "").toLowerCase() === name.toLowerCase()).map(crChoicesHtml).join("");
  return `<div class="cr-classblock"><b>${escapeHtml(name)}</b>${p.first ? "" : ` <span class="hint">(multiclass)</span>`}
    ${facts.length ? `<div class="hint">${escapeHtml(facts.join(" | "))}</div>` : ""}
    ${skills.total ? `<div>Skills ${skills.html}</div>` : ""}
    ${tools.total ? `<div>Tools ${tools.html}</div>` : ""}
    ${groups}${choices}</div>`;
}
function crClassesHtml() { return CREATOR.classes.map((r, i) => crClassBlockHtml(i)).join(""); }

/* ---------- step 3: Ability Score Improvements ---------- */
function crAsiSlots() { return creatorFeatureList().filter(f => f.isAsi); }
function creatorAsiIncrease(ab) {
  let n = 0;
  crAsiSlots().forEach(f => {
    if ((CREATOR.asiFeats[f.fkey] || "").trim()) return;
    (CREATOR.asiScores[f.fkey] || []).forEach(p => { if (p === ab) n++; });
  });
  return n;
}
function creatorScoreWithAsi(ab) { return Math.min(30, creatorFinalScore(ab) + creatorAsiIncrease(ab)); }
function crAsiHtml() {
  const slots = crAsiSlots(); if (!slots.length) return "";
  const featsOff = typeof hrSetting === "function" && hrSetting("feats") === false;
  const rows = slots.map((f, n) => {
    const feat = CREATOR.asiFeats[f.fkey] || "";
    const picks = CREATOR.asiScores[f.fkey] || ["", ""];
    const sel = i => `<select class="cr-asiscore" data-fkey="${f.fkey}" data-slot="${i}"${feat.trim() ? " disabled" : ""}><option value="">-</option>` +
      ABILITIES.map(a => `<option value="${a.key}"${picks[i] === a.key ? " selected" : ""}>${a.key.toUpperCase()}</option>`).join("") + `</select>`;
    const featBox = featsOff ? "" : comboboxHtml({ id: "cr-asifeat-" + n, value: feat, options: filteredNames("feat", FEAT_LIB, feat),
      placeholder: "feat", extraClass: "cr-asifeat", width: "11rem", dataAttr: `data-fkey="${f.fkey}"`, banKind: "feat" }) + " or ";
    return `<div>${escapeHtml(f.origin.className)} ${f.level}: ${featBox}+1 ${sel(0)} +1 ${sel(1)}</div>${feat.trim() ? crChoicesHtml(f) : ""}`;
  }).join("");
  return `<div style="margin-top:.5rem"><b>Ability Score Improvements</b>${rows}</div>`;
}

/* ---------- step 4: spells ---------- */
function crSpellListClass(r) { return SUBCLASS_CASTING_STYLE[(r.sub || "").trim().toLowerCase()] ? "Wizard" : r.name; }
function crSpellCandidates(r, minLvl, maxLvl) {
  const list = (crSpellListClass(r) || "").toLowerCase();
  return (typeof SPELL_LIB !== "undefined" ? SPELL_LIB : [])
    .filter(sp => sp.level >= minLvl && sp.level <= maxLvl && (sp.classes || []).some(c => c.toLowerCase() === list))
    .sort((a, b) => a.name.localeCompare(b.name));
}
/* What one class row needs picked: { cantrips, spells, prepared, wizard } counts and the lists to pick from. */
function crSpellNeeds(r) {
  const modOf = ab => mod(creatorScoreWithAsi(ab));
  const cantrips = classCantripsKnown(r);
  const maxLvl = classMaxSpellLevel(r);
  const allow = maxLvl ? classSpellAllowance(r, modOf) : null;
  const wizard = r.name.trim().toLowerCase() === "wizard";
  return {
    cantrips, maxLvl, wizard,
    style: allow ? allow.style : null,
    spells: allow ? (wizard ? allow.spellbookMax : allow.max) : 0,
    prepared: allow && wizard ? allow.max : 0,
    cantripList: cantrips ? crSpellCandidates(r, 0, 0) : [],
    spellList: maxLvl ? crSpellCandidates(r, 1, maxLvl) : [],
  };
}
function crSpellStore(name) { return CREATOR.spells[name] || (CREATOR.spells[name] = { cantrips: [], spells: [], prepared: [] }); }
function crSpellSelects(name, list, key, count, pool) {
  const store = crSpellStore(name), picks = store[key];
  const out = [];
  for (let i = 0; i < count; i++) {
    const cur = picks[i] || "";
    const others = new Set(picks.filter((v, j) => j !== i && v));
    out.push(`<select class="cr-spell" data-cls="${escapeHtml(name)}" data-list="${key}" data-slot="${i}"><option value="">-</option>` +
      pool.filter(sp => sp.name === cur || !others.has(sp.name))
        .map(sp => `<option value="${escapeHtml(sp.name)}"${sp.name === cur ? " selected" : ""}>${escapeHtml(sp.name)}${key === "spells" ? ` (${ordinalLevel(sp.level)})` : ""}</option>`).join("") +
      `</select>`);
  }
  return out.join(" ");
}
function crCasterRows() {
  return crRows().filter(r => (r.name || "").trim()).map(r => ({ r, need: crSpellNeeds(r) }))
    .filter(x => x.need.cantrips > 0 || (x.need.maxLvl > 0 && x.need.spells > 0));
}
function crSpellsStepHtml() {
  const rows = crCasterRows();
  if (!rows.length) return `<div class="hint">No spellcasting at these levels.</div>`;
  if (!(typeof SPELL_LIB !== "undefined" && SPELL_LIB.length)) return `<div class="hint">No spell data loaded.</div>`;
  return rows.map(({ r, need }) => {
    const store = crSpellStore(r.name);
    const label = need.wizard ? "Spellbook" : need.style === "prepared" ? "Prepared" : "Spells known";
    const parts = [];
    if (need.cantrips) parts.push(`<div>Cantrips (${need.cantrips}) ${crSpellSelects(r.name, need.cantripList, "cantrips", need.cantrips, need.cantripList)}</div>`);
    if (need.maxLvl && need.spells) parts.push(`<div>${label} (${need.spells}) ${crSpellSelects(r.name, need.spellList, "spells", need.spells, need.spellList)}</div>`);
    if (need.wizard && need.prepared) {
      const book = store.spells.filter(Boolean);
      parts.push(`<div>Prepared (${need.prepared}) ${book.map(n => `<label><input type="checkbox" class="cr-spellprep" data-cls="${escapeHtml(r.name)}" value="${escapeHtml(n)}"${store.prepared.includes(n) ? " checked" : ""}> ${escapeHtml(n)}</label>`).join(" ")}</div>`);
    }
    return `<div class="cr-classblock"><b>${escapeHtml(r.name)} ${r.lvl}</b>${parts.join("")}</div>`;
  }).join("");
}

/* ---------- validation ---------- */
function creatorChoiceBlocker(step) {
  if (step === 1) {
    const langs = crRaceList("languages"), tools = crRaceList("tools");
    if (crUnfilled("langs:race", crLangBlocks(langs))) return "Choose your race's languages.";
    if (crUnfilled("tools:race", crToolBlocks(tools))) return "Choose your race's tool proficiency.";
    const f = crFeaturesForStep(1).find(f => crLiveChoices(f).some(c => crChoiceMissing(f, c)));
    if (f) return `Make the choice for ${f.name}.`;
  }
  if (step === 2) {
    for (let i = 0; i < CREATOR.classes.length; i++) {
      const p = crRowProf(i); if (!p) continue;
      const name = p.rec.name;
      if (crUnfilled("skills:" + name, crSkillBlocks(p.skills))) return `Choose ${name} skills.`;
      if (crUnfilled("tools:" + name, crToolBlocks(p.tools))) return `Choose ${name} tools.`;
      const bg = new Set(crBackgroundSkills().map(s => s.toLowerCase()));
      const clash = crPicked("skills:" + name).find(s => bg.has(s.toLowerCase()));
      if (clash) return `${clash} is also a background skill; pick another ${name} skill.`;
      const row = crRows()[i];
      const g = optGroupsFor(p.rec, ciFindSub(p.rec, row.sub || ""), row.lvl).find(g => {
        if (!optOptionsFor(g, row.lvl).length) return false;
        const free = Math.max(0, g.count - g.required.length);
        return ((CREATOR.optChoices[g.key] || []).filter(Boolean).length) < free;
      });
      if (g) return `Choose ${name}: ${g.name}.`;
    }
    const f = crFeaturesForStep(2).find(f => crLiveChoices(f).some(c => crChoiceMissing(f, c)));
    if (f) return `Make the choice for ${f.name}.`;
  }
  if (step === 3) {
    const open = crAsiSlots().find(f => !(CREATOR.asiFeats[f.fkey] || "").trim() && (CREATOR.asiScores[f.fkey] || []).filter(Boolean).length < 2);
    if (open) return `Spend the Ability Score Improvement at ${open.origin.className} ${open.level}.`;
    const over = CREATOR_ABILITIES.find(ab => creatorAsiIncrease(ab) && creatorFinalScore(ab) + creatorAsiIncrease(ab) > 20);
    if (over) return `An Ability Score Improvement can't raise ${over.toUpperCase()} above 20.`;
    const f = crFeaturesForStep(3).find(f => crLiveChoices(f).some(c => crChoiceMissing(f, c)));
    if (f) return `Make the choice for ${f.name}.`;
  }
  if (step === 4 && typeof SPELL_LIB !== "undefined" && SPELL_LIB.length) {
    for (const { r, need } of crCasterRows()) {
      const store = crSpellStore(r.name);
      const have = key => store[key].filter(Boolean).length;
      if (have("cantrips") < Math.min(need.cantrips, need.cantripList.length)) return `Choose ${r.name} cantrips.`;
      if (need.maxLvl && have("spells") < Math.min(need.spells, need.spellList.length)) return `Choose ${r.name} spells.`;
      if (need.wizard && need.prepared) {
        const want = Math.min(need.prepared, have("spells"));
        const got = store.prepared.filter(n => store.spells.includes(n)).length;
        if (got !== want) return `Prepare ${want} ${r.name} spell${want === 1 ? "" : "s"}.`;
      }
    }
  }
  return "";
}

/* ---------- writing it onto the character ---------- */
function creatorApplyChoices(state) {
  const f = state.fields, prof = state.proficiencies;
  const addTo = (list, names) => { names.forEach(n => { if (n && !list.some(x => x.toLowerCase() === n.toLowerCase())) list.push(n); }); };

  CREATOR.classes.forEach((r, i) => {
    const p = crRowProf(i); if (!p) return;
    p.saves.forEach(ab => { f["saveprof-" + ab] = true; });
    crArmorKeys(p.armor).forEach(a => { f["prof-armor-" + a] = true; });
    const w = crWeaponSplit(p.weapons);
    w.cats.forEach(c => { f["prof-weapon-" + c] = true; });
    addTo(prof.weapons, w.named);
    addTo(prof.tools, crFixedNames(p.tools));
    addTo(prof.tools, crPicked("tools:" + p.rec.name));
    crPicked("skills:" + p.rec.name).forEach(s => { f["skillprof-" + crSkillSlug(s)] = true; });
  });

  addTo(prof.languages, crFixedNames(crRaceList("languages")));
  addTo(prof.languages, crPicked("langs:race"));
  addTo(prof.weapons, crFixedNames(crRaceList("weapons")));
  // Background names arrive in the data's lower case ("vehicles (land)"); everything else is titled.
  ["weapons", "tools", "languages"].forEach(k => { prof[k] = crUniqueCI(prof[k].map(crTitle)); });
  addTo(prof.tools, crFixedNames(crRaceList("tools")));
  addTo(prof.tools, crPicked("tools:race"));

  state.featChoices = creatorFeatChoices();
  state.asiChoices = {};
  crAsiSlots().forEach(s => {
    if ((CREATOR.asiFeats[s.fkey] || "").trim()) return;
    const picks = (CREATOR.asiScores[s.fkey] || []).filter(Boolean);
    if (picks.length) state.asiChoices[s.fkey] = picks;
  });
  state.effectChoices = JSON.parse(JSON.stringify(CREATOR.effectChoices));
  state.optFeatureChoices = JSON.parse(JSON.stringify(CREATOR.optChoices));

  const spells = [];
  crCasterRows().forEach(({ r, need }) => {
    const store = crSpellStore(r.name);
    store.cantrips.filter(Boolean).slice(0, need.cantrips).forEach(n => spells.push({ cls: r.name, lvl: 0, name: n, prep: false, grantSrc: "", note: "" }));
    store.spells.filter(Boolean).slice(0, need.spells).forEach(n => {
      const sp = need.spellList.find(x => x.name === n);
      const prep = need.style === "prepared" && (!need.wizard || store.prepared.includes(n));
      spells.push({ cls: r.name, lvl: sp ? sp.level : 1, name: n, prep, grantSrc: "", note: "" });
    });
  });
  state.spells = spells;
  return state;
}

/* ---------- wiring ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const body = $("cr-body"); if (!body) return;
  const setPick = (t, rerender) => {
    const key = t.dataset.crkey, slot = Number(t.dataset.crslot);
    const list = (CREATOR.picks[key] || []).slice(); list[slot] = t.value;
    CREATOR.picks[key] = list;
    rerender ? renderCreator() : renderCreatorChrome();
  };
  body.addEventListener("change", e => {
    const t = e.target; if (!CREATOR) return;
    if (t.classList.contains("cr-pick") && t.tagName === "SELECT") { setPick(t, true); return; }
    if (t.classList.contains("cr-effchoice")) {
      const store = CREATOR.effectChoices[t.dataset.fkey] || (CREATOR.effectChoices[t.dataset.fkey] = {});
      if (t.dataset.slot != null) {
        const arr = [].concat(store[t.dataset.choice] || []); arr[Number(t.dataset.slot)] = t.value;
        store[t.dataset.choice] = arr;
      } else store[t.dataset.choice] = t.value;
      renderCreator(); return;
    }
    if (t.classList.contains("cr-optf") && t.tagName === "SELECT") {
      const list = (CREATOR.optChoices[t.dataset.optkey] || []).slice(); list[Number(t.dataset.slot)] = t.value;
      CREATOR.optChoices[t.dataset.optkey] = list;
      renderCreator(); return;
    }
    if (t.classList.contains("cr-asiscore")) {
      const picks = (CREATOR.asiScores[t.dataset.fkey] || ["", ""]).slice(); picks[Number(t.dataset.slot)] = t.value;
      CREATOR.asiScores[t.dataset.fkey] = picks;
      renderCreator(); return;
    }
    if (t.classList.contains("cr-spell")) {
      const store = crSpellStore(t.dataset.cls), list = store[t.dataset.list];
      list[Number(t.dataset.slot)] = t.value;
      store.prepared = store.prepared.filter(n => store.spells.includes(n));
      renderCreator(); return;
    }
    if (t.classList.contains("cr-spellprep")) {
      const store = crSpellStore(t.dataset.cls);
      store.prepared = t.checked ? crUniqueCI([...store.prepared, t.value]) : store.prepared.filter(n => n !== t.value);
      renderCreatorChrome(); return;
    }
  });
  // Text boxes (the fallbacks when no library data is loaded, and the ASI feat box) never rebuild on
  // `change`, for the reason creator.js's header gives.
  body.addEventListener("input", e => {
    const t = e.target; if (!CREATOR) return;
    if (t.classList.contains("cr-pick") && t.tagName === "INPUT") { setPick(t, false); return; }
    if (t.classList.contains("cr-optf") && t.tagName === "INPUT") {
      const list = (CREATOR.optChoices[t.dataset.optkey] || []).slice(); list[Number(t.dataset.slot)] = t.value;
      CREATOR.optChoices[t.dataset.optkey] = list;
      renderCreatorChrome(); return;
    }
    if (t.classList.contains("cr-asifeat")) {
      CREATOR.asiFeats[t.dataset.fkey] = t.value;
      renderCreatorKeepingFocus(t); return;
    }
  });
});
