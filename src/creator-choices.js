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
  const bg = !CREATOR.customBg ? ciFindBackground(CREATOR.background) : null;
  backgroundFeatSlots(bg).forEach(slot => {
    const name = slot.fixed || CREATOR.backgroundFeats[slot.fkey];
    if (name) out[slot.fkey] = name;
  });
  Object.entries(CREATOR.asiFeats).forEach(([k, v]) => { if ((v || "").trim()) out[k] = v.trim(); });
  return out;
}
function creatorFeatureList() {
  if (typeof featuresFor !== "function") return [];
  return featuresFor({ race: CREATOR.race, subrace: CREATOR.subrace, background: CREATOR.customBg ? "" : CREATOR.background, classes: crRows(),
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
      if (c.kind !== "pick" || (c.when && !crWhen(c.when, f))) return;
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
function crTakenSkills(exceptKey, includeBackground = true) {
  const swapped = new Set(crOriginSwaps().filter(s => s.kind === "skills").map(s => crSkillSlug(s.from)));
  const features = creatorFeatureList();
  const out = [...(includeBackground ? crBackgroundSkills() : []), ...crResolvedRaceProfs().skills,
    ...crEffectSkillGrants(features.filter(f => !["race", "subrace"].includes((f.origin || {}).kind))),
    ...crEffectSkillGrants(features.filter(f => ["race", "subrace"].includes((f.origin || {}).kind))).filter(s => !swapped.has(crSkillSlug(s)))];
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
    if (k === "choice") {
      const values = [].concat((CREATOR.effectChoices[f.fkey] || {})[v.id] || []).filter(Boolean);
      return values.length > 0 && (v.is != null ? values.includes(v.is) : v.not != null ? !values.includes(v.not) : false);
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
    if (c.when && !crWhen(c.when, f)) return false;
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
  const attrs = (c, i) => `aria-label="${escapeHtml(c.label || f.name + " " + c.id)}" class="cr-effchoice" data-fkey="${f.fkey}" data-choice="${c.id}"${i != null ? ` data-slot="${i}"` : ""}`;
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
    return `<label>${c.label === "" ? "" : escapeHtml(c.label || "Choice") + ": "}${selects.join(" ")}</label>`;
  });
  return `<div class="cr-feature-choice"><b>${escapeHtml(f.name)}</b> ${parts.join(" ")}</div>`;
}
function crFeaturesForStep(step) {
  return creatorFeatureList().filter(f => {
    const k = f.origin && f.origin.kind;
    if (step === 1) return k === "race" || k === "subrace";
    if (step === 2) return (k === "class" || k === "subclass" || k === "optfeature") && !f.isAsi;
    if (step === 3) return !!f.isAsi && !!f.asiChosen;
    if (step === 5) return !!f.isBackgroundFeat;
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
  const resolved = crResolvedRaceProfs();
  const fixedLangs = resolved.languages, fixedTools = resolved.tools, fixedWeapons = resolved.weapons;
  const lang = crPickSlotsHtml("langs:race", crLangBlocks(langs), [...fixedLangs, ...crBackgroundLanguages()]);
  const tool = crPickSlotsHtml("tools:race", crToolBlocks(tools), fixedTools);
  const rows = [];
  if (fixedLangs.length || lang.total) rows.push(`<div>Languages ${escapeHtml(fixedLangs.join(", "))} ${lang.html}</div>`);
  if (fixedWeapons.length) rows.push(`<div>Weapons ${escapeHtml(fixedWeapons.join(", "))}</div>`);
  if (fixedTools.length || tool.total) rows.push(`<div>Tools ${escapeHtml(fixedTools.join(", "))} ${tool.html}</div>`);
  if (resolved.skills.length) rows.push(`<div>Skills ${escapeHtml(resolved.skills.join(", "))}</div>`);
  if (resolved.armor.length) rows.push(`<div>Armor ${escapeHtml(resolved.armor.join(", "))}</div>`);
  return (rows.length ? `<div style="margin-top:.4rem">${rows.join("")}</div>` : "") + crOriginSwapsHtml();
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
/* What the draft's feats (a racial feat, an ASI taken as a feat) add to a score: every score add in
   their effects entries, including a half feat's own +1, with picks read from the draft. A feat can't
   take a score past 20. The built character gets these through its effects, not its base scores. */
function creatorFeatIncrease(ab) {
  let n = 0;
  if (typeof creatorFeatureList !== "function") return 0;
  creatorFeatureList().filter(f => (f.effKey || "").startsWith("feat|")).forEach(f => {
    const entry = dbEntryFor(f); if (!entry) return;
    const picks = (CREATOR.effectChoices || {})[f.fkey] || {};
    (entry.effects || []).forEach(e => {
      if (e.op !== "add" || typeof e.value !== "number") return;
      const m = /^score-(?:\{choice:([a-zA-Z0-9_]+)\}|(str|dex|con|int|wis|cha))$/.exec(e.target || ""); if (!m) return;
      const hits = m[2] ? (m[2] === ab ? 1 : 0) : [].concat(picks[m[1]] || []).filter(v => v === ab).length;
      n += hits * e.value;
    });
  });
  return n;
}
function creatorScoreWithAsi(ab) {
  const withAsi = creatorFinalScore(ab) + creatorAsiIncrease(ab);
  return Math.min(30, withAsi + Math.min(creatorFeatIncrease(ab), Math.max(0, 20 - withAsi)));
}
function asiChoiceMode(draft, key) {
  return draft.asiModes?.[key] || (draft.asiFeats[key] ? "feat" : "asi");
}
function setAsiChoiceMode(draft, key, mode) {
  (draft.asiModes || (draft.asiModes = {}))[key] = mode;
  draft.asiFeats[key] = "";
  draft.asiScores[key] = [];
  delete draft.effectChoices[key];
}
/* Choose ASI or feat first, then show only the controls for that benefit. */
function asiChoiceHtml(draft, feature, index, prefix) {
  const key = feature.fkey, mode = asiChoiceMode(draft, key);
  const feat = draft.asiFeats[key] || "", picks = draft.asiScores[key] || [];
  const featsOff = typeof hrSetting === "function" && hrSetting("feats") === false;
  const modeClass = prefix + "-asimode", abilityClass = prefix === 'lu' ? 'lu-asi' : 'cr-asiscore';
  const featClass = prefix === 'lu' ? 'lu-feat' : 'cr-asifeat';
  const select = slot => `<label>+1 <select aria-label="Ability increase ${slot + 1}" class="${abilityClass}" data-fkey="${key}" data-slot="${slot}"><option value="">- ability -</option>${ABILITIES.map(a => `<option value="${a.key}"${picks[slot] === a.key ? ' selected' : ''}>${a.name}</option>`).join('')}</select></label>`;
  const featBox = comboboxHtml({ id: prefix + '-asifeat-' + index, value: feat, options: filteredNames('feat', FEAT_LIB, feat), extraClass: featClass,
    placeholder: 'Choose feat', dataAttr: `data-fkey="${key}"`, banKind: 'feat' });
  return `<div class="asi-choice"><select aria-label="Ability Score Improvement or Feat" class="${modeClass}" data-fkey="${key}"><option value="asi"${mode === 'asi' ? ' selected' : ''}>Ability Score Improvement</option>${featsOff ? '' : `<option value="feat"${mode === 'feat' ? ' selected' : ''}>Feat</option>`}</select>
    ${mode === 'feat' && !featsOff ? featBox : select(0) + ' ' + select(1)}</div>${mode === 'feat' && feat ? crChoicesHtml(feature) : ''}`;
}
function crAsiHtml() {
  const slots = crAsiSlots(); if (!slots.length) return "";
  return `<div style="margin-top:.5rem"><b>Ability Score Improvements</b>${slots.map((f, n) => `<div>${escapeHtml(f.origin.className)} ${f.level}: ${asiChoiceHtml(CREATOR, f, n, 'cr')}</div>`).join('')}</div>`;
}

/* ---------- step 4: spells ---------- */
function crSpellListClass(r) { return SUBCLASS_CASTING_STYLE[(r.sub || "").trim().toLowerCase()] ? "Wizard" : r.name; }
function crSpellCandidates(r, minLvl, maxLvl) {
  const list = (crSpellListClass(r) || "").toLowerCase();
  const expanded = crGrantSources().flatMap(source => resolvedSpellGrants(source, creatorTotalLevel(), CREATOR.picks)).filter(g => g.expanded).map(g => grantSpellName(g.name).toLowerCase());
  return (typeof SPELL_LIB !== "undefined" ? SPELL_LIB : [])
    .filter(sp => sp.level >= minLvl && sp.level <= maxLvl && ((sp.classes || []).some(c => c.toLowerCase() === list) || expanded.includes(sp.name.toLowerCase())))
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
/* One list (cantrips, or spells) as a button that opens a checklist of every spell the class can
   take, grouped by level: tick to add, untick to drop, and once the count is reached the rest wait
   until something is unticked. A filter box narrows the list without redrawing it. */
let CR_SPELL_OPEN = "";   // "<class>|<list>" whose checklist is open
/* The Spell Library's own include/exclude filters, as a separate set (its own saved state), narrowing
   every checklist in the spell step. A spell already ticked stays listed whatever the filters say. */
let CR_SPELL_FILTERS = null, CR_SPELL_FILTERS_OPEN = false;
function crSpellFilters() {
  if (!CR_SPELL_FILTERS && typeof createFilterSet === "function" && typeof SPELL_FGROUPS !== "undefined") {
    CR_SPELL_FILTERS = createFilterSet({ ns: "crspell", groups: SPELL_FGROUPS, areaId: "cr-spell-filter-area", searchId: null,
      onChange: () => crRenderKeepingScroll() });
    CR_SPELL_FILTERS.load();
  }
  return CR_SPELL_FILTERS;
}
function crAfterRender() {
  const area = document.getElementById("cr-spell-filter-area");
  if (area && !area.hidden && crSpellFilters()) CR_SPELL_FILTERS.renderArea();
}
function crRenderKeepingScroll() {
  const open = document.querySelector(".cr-spelldd .cr-spell-panel:not([hidden])");
  if (open) { crRenderKeepingSpellPanel(open); return; }
  const body = document.getElementById("cr-body"), top = body ? body.scrollTop : 0;
  renderCreator(); if (body) body.scrollTop = top;
}
function crSpellChecklist(name, label, key, count, pool) {
  const store = crSpellStore(name), picks = store[key].filter(Boolean);
  const id = name + "|" + key, open = CR_SPELL_OPEN === id, full = picks.length >= count;
  const fs = crSpellFilters(), active = fs ? fs.activeGroups() : [];
  if (active.length) pool = pool.filter(sp => picks.includes(sp.name) || fs.passes(sp, active));
  const levels = [...new Set(pool.map(sp => sp.level))].sort((a, b) => a - b);
  const group = L => {
    const rows = pool.filter(sp => sp.level === L).map(sp => {
      const on = picks.includes(sp.name);
      return `<label class="cr-spell-opt" data-name="${escapeHtml(sp.name.toLowerCase())}"><input type="checkbox" class="cr-spellcheck" data-cls="${escapeHtml(name)}" data-list="${key}" value="${escapeHtml(sp.name)}"${on ? " checked" : ""}${!on && full ? " disabled" : ""}> ${escapeHtml(sp.name)}</label>`;
    }).join("");
    return (key === "spells" ? `<div class="cr-spell-lvl">${ordinalLevel(L)} level</div>` : "") + `<div class="cr-spell-grid">${rows}</div>`;
  };
  return `<div class="cr-spelldd" data-dd="${escapeHtml(id)}">
    <button type="button" class="cr-spelldd-btn" data-dd="${escapeHtml(id)}">${label} <b>${picks.length}/${count}</b>${picks.length ? ": " + escapeHtml(picks.join(", ")) : ""} ${open ? "&#9652;" : "&#9662;"}</button>
    <div class="cr-spell-panel"${open ? "" : " hidden"}>
      <input type="search" class="cr-spellfilter" placeholder="filter" aria-label="Filter spells">
      ${levels.map(group).join("")}
    </div></div>`;
}
function crCasterRows() {
  return crRows().filter(r => (r.name || "").trim()).map(r => ({ r, need: crSpellNeeds(r) }))
    .filter(x => x.need.cantrips > 0 || (x.need.maxLvl > 0 && x.need.spells > 0));
}
function crSpellsStepHtml() {
  const rows = crCasterRows();
  const grants = crGrantedSpellsHtml();
  if (!rows.length) return grants || `<div class="hint">No spellcasting at these levels.</div>`;
  if (!(typeof SPELL_LIB !== "undefined" && SPELL_LIB.length)) return `<div class="hint">No spell data loaded.</div>`;
  const filterBar = `<div class="cr-spell-filterbar"><button type="button" id="cr-spell-filter-btn"${CR_SPELL_FILTERS_OPEN ? ' class="active"' : ""}>Filters</button></div>
    <div id="cr-spell-filter-area" class="cr-spell-filter-area"${CR_SPELL_FILTERS_OPEN ? "" : " hidden"}></div>`;
  return grants + filterBar + rows.map(({ r, need }) => {
    const store = crSpellStore(r.name);
    const label = need.wizard ? "Spellbook" : need.style === "prepared" ? "Prepared" : "Spells known";
    const parts = [];
    if (need.cantrips) parts.push(crSpellChecklist(r.name, "Cantrips", "cantrips", need.cantrips, need.cantripList));
    if (need.maxLvl && need.spells) parts.push(crSpellChecklist(r.name, label, "spells", need.spells, need.spellList));
    if (need.wizard && need.prepared) {
      const book = store.spells.filter(Boolean);
      parts.push(`<div>Prepared (${need.prepared}) ${book.map(n => `<label><input type="checkbox" class="cr-spellprep" data-cls="${escapeHtml(r.name)}" value="${escapeHtml(n)}"${store.prepared.includes(n) ? " checked" : ""}> ${escapeHtml(n)}</label>`).join(" ")}</div>`);
    }
    return `<div class="cr-classblock"><b>${escapeHtml(r.name)} ${r.lvl}</b>${parts.join("")}</div>`;
  }).join("");
}

/* Redraws the step with the open checklist left open, scrolled where it was, and still filtered. */
function crRenderKeepingSpellPanel(from) {
  const dd = from.closest(".cr-spelldd"), panel = dd && dd.querySelector(".cr-spell-panel");
  const scroll = panel ? panel.scrollTop : 0, filter = dd ? (dd.querySelector(".cr-spellfilter") || {}).value || "" : "";
  const body = document.getElementById("cr-body"), bodyScroll = body ? body.scrollTop : 0;
  renderCreator();
  const again = dd && document.querySelector(`.cr-spelldd[data-dd="${CSS.escape(dd.dataset.dd)}"]`);
  if (again) {
    const f = again.querySelector(".cr-spellfilter");
    if (f && filter) { f.value = filter; crFilterSpellPanel(f); }
    const p2 = again.querySelector(".cr-spell-panel"); if (p2) p2.scrollTop = scroll;
  }
  if (body) body.scrollTop = bodyScroll;
}
function crFilterSpellPanel(input) {
  const q = input.value.trim().toLowerCase(), panel = input.closest(".cr-spell-panel");
  panel.querySelectorAll(".cr-spell-opt").forEach(l => { l.style.display = !q || l.dataset.name.includes(q) ? "" : "none"; });
  panel.querySelectorAll(".cr-spell-grid").forEach(g => {
    const any = [...g.children].some(l => l.style.display !== "none");
    g.style.display = any ? "" : "none";
    const head = g.previousElementSibling; if (head && head.classList.contains("cr-spell-lvl")) head.style.display = any ? "" : "none";
  });
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
  if (step === 5) {
    const skills = crBackgroundSkills().map(s => s.toLowerCase());
    if (new Set(skills).size !== skills.length) return "Choose different background skills.";
    const chosen = CREATOR.customBg ? CREATOR.bgSkills : (CREATOR.bgChoices?.skills || []);
    const taken = new Set(crTakenSkills(null, false).map(s => s.toLowerCase()));
    const clash = chosen.filter(Boolean).find(s => taken.has(crSkillName(s).toLowerCase()));
    if (clash) return `${crSkillName(clash)} is already proficient; choose another background skill.`;
  }
  if (step === 5 && !CREATOR.customBg) {
    const slot = backgroundFeatSlots(ciFindBackground(CREATOR.background)).find(s => !s.fixed && !CREATOR.backgroundFeats[s.fkey]);
    if (slot) return "Choose your background feat.";
    const missing = crFeaturesForStep(5).find(f => crLiveChoices(f).some(c => crChoiceMissing(f, c)));
    if (missing) return `Make the choice for ${missing.name}.`;
  }
  if (step === 4 && typeof SPELL_LIB !== "undefined" && SPELL_LIB.length) {
    for (const source of crGrantSources()) {
      const missing = flattenGrantedSpells(source.spells).find((g, i) => g.choose && !g.expanded && g.minLevel <= creatorTotalLevel() &&
        (CREATOR.picks[source.key + "|" + i] || []).filter(Boolean).length < Math.min(g.count, grantedSpellPool(g).length));
      if (missing) return `Choose ${source.name} spells.`;
    }
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

  const race = crResolvedRaceProfs();
  state.originSwaps = crOriginSwaps();
  state.grantSpellChoices = Object.fromEntries(Object.entries(CREATOR.picks).filter(([key]) => key.startsWith("race|") || key.startsWith("subrace|") || key.startsWith("background|") || key.startsWith("feat|")));
  state.backgroundGrants = !CREATOR.customBg;
  const dynamicSkills = new Set(crEffectSkillGrants(creatorFeatureList().filter(feature => ["race", "subrace"].includes(feature.origin?.kind) && !feature.isRaceFeat)).map(crSkillSlug));
  const fixedSkills = new Set(crFixedNames(crRaceList("skills")).map(crSkillSlug));
  race.skills.forEach(name => {
    const slug = crSkillSlug(name), swapped = state.originSwaps.some(swap => swap.toKind === "skills" && crSkillSlug(swap.to) === slug);
    // Feature choices remain derived, so changing the choice on the sheet can remove the grant.
    if (!dynamicSkills.has(slug) || fixedSkills.has(slug) || swapped) f["skillprof-" + slug] = true;
  });
  race.armor.forEach(name => { const key = CR_ARMOR[name.toLowerCase()]; if (key) f["prof-armor-" + key] = true; });
  addTo(prof.languages, race.languages);
  addTo(prof.languages, crPicked("langs:race"));
  addTo(prof.weapons, race.weapons);
  // Background names arrive in the data's lower case ("vehicles (land)"); everything else is titled.
  ["weapons", "tools", "languages"].forEach(k => { prof[k] = crUniqueCI(prof[k].map(crTitle)); });
  addTo(prof.tools, race.tools);
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
    if (t.classList.contains("cr-origin-swap")) {
      CREATOR.originSwaps[t.dataset.swapkey] = t.value; renderCreator(); return;
    }
    if (t.classList.contains("cr-background-feat")) {
      CREATOR.backgroundFeats[t.dataset.fkey] = t.value; renderCreator(); return;
    }
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
    if (t.classList.contains("cr-asimode")) {
      setAsiChoiceMode(CREATOR, t.dataset.fkey, t.value); renderCreator(); return;
    }
    if (t.classList.contains("cr-asiscore")) {
      const picks = (CREATOR.asiScores[t.dataset.fkey] || ["", ""]).slice(); picks[Number(t.dataset.slot)] = t.value;
      CREATOR.asiScores[t.dataset.fkey] = picks;
      renderCreator(); return;
    }
    if (t.classList.contains("cr-spellcheck")) {
      const store = crSpellStore(t.dataset.cls), key = t.dataset.list;
      const list = store[key].filter(Boolean);
      store[key] = t.checked ? crUniqueCI([...list, t.value]) : list.filter(n => n !== t.value);
      store.prepared = store.prepared.filter(n => store.spells.includes(n));
      crRenderKeepingSpellPanel(t); return;
    }
    if (t.classList.contains("cr-spellprep")) {
      const store = crSpellStore(t.dataset.cls);
      store.prepared = t.checked ? crUniqueCI([...store.prepared, t.value]) : store.prepared.filter(n => n !== t.value);
      renderCreatorChrome(); return;
    }
  });
  // Text boxes (the fallbacks when no library data is loaded, and the ASI feat box) never rebuild on
  // `change`, for the reason creator.js's header gives.
  body.addEventListener("click", e => {
    if (!CREATOR) return;
    if (e.target.closest("#cr-spell-filter-btn")) { CR_SPELL_FILTERS_OPEN = !CR_SPELL_FILTERS_OPEN; crRenderKeepingScroll(); return; }
    if (e.target.closest("#cr-spell-filter-area")) { if (crSpellFilters()) CR_SPELL_FILTERS.handleClick(e); return; }
    const b = e.target.closest(".cr-spelldd-btn"); if (!b) return;
    CR_SPELL_OPEN = CR_SPELL_OPEN === b.dataset.dd ? "" : b.dataset.dd;
    crRenderKeepingSpellPanel(b);
  });
  body.addEventListener("input", e => {
    const t = e.target; if (!CREATOR) return;
    if (t.classList.contains("cr-spellfilter")) { crFilterSpellPanel(t); return; }
    if (t.closest("#cr-spell-filter-area")) { if (crSpellFilters()) CR_SPELL_FILTERS.handleInput(e); return; }
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

/* TCE p8: each racial proficiency is its own optional swap. */
const CR_ORIGIN_LANGUAGES = ["Abyssal", "Celestial", "Common", "Deep Speech", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Infernal", "Orc", "Primordial", "Sylvan", "Undercommon"];
const CR_SIMPLE_WEAPONS = ["Club", "Dagger", "Greatclub", "Handaxe", "Javelin", "Light Hammer", "Mace", "Quarterstaff", "Sickle", "Spear", "Light Crossbow", "Dart", "Shortbow", "Sling"];
function crOriginSlots() {
  const features = creatorFeatureList().filter(f => ["race", "subrace"].includes((f.origin || {}).kind) && !f.isRaceFeat);
  const lists = Object.fromEntries(["languages", "skills", "armor", "weapons", "tools"].map(kind => [kind, crFixedNames(crRaceList(kind))]));
  lists.skills = crSort([...lists.skills.map(crSkillName), ...crEffectSkillGrants(features)]);
  return Object.entries(lists).flatMap(([kind, names]) => names.map(from => ({ kind, from, key: kind + "|" + from })));
}
function crOriginOptions(slot) {
  const tools = proficiencyOptions("tools").map(name => ({ kind: "tools", name }));
  const weapons = ITEM_LIB.filter(i => i.weaponCategory && !i.rarity).map(i => ({ kind: "weapons", name: i.name, simple: i.weaponCategory === "simple" }));
  if (!weapons.length) CR_SIMPLE_WEAPONS.forEach(name => weapons.push({ kind: "weapons", name, simple: true }));
  const original = ITEM_LIB.find(i => i.name.toLowerCase() === slot.from.toLowerCase());
  const simple = original ? original.weaponCategory === "simple" : CR_SIMPLE_WEAPONS.some(n => n.toLowerCase() === slot.from.toLowerCase());
  if (slot.kind === "languages") return CR_ORIGIN_LANGUAGES.map(name => ({ kind: "languages", name }));
  if (slot.kind === "skills") return SKILLS.map(s => ({ kind: "skills", name: s[0] }));
  if (slot.kind === "tools" || (slot.kind === "weapons" && simple)) return [...tools, ...weapons.filter(w => w.simple)];
  return [...tools, ...weapons];
}
function crOriginSwaps() {
  if (!CREATOR.customOrigin) return [];
  return crOriginSlots().flatMap(slot => {
    const choice = CREATOR.originSwaps[slot.key];
    const selected = crOriginOptions(slot).find(o => o.kind + "|" + o.name === choice);
    return selected && (selected.kind !== slot.kind || selected.name.toLowerCase() !== slot.from.toLowerCase())
      ? [{ kind: slot.kind, from: slot.from, toKind: selected.kind, to: selected.name, race: CREATOR.race }] : [];
  });
}
function crResolvedRaceProfs() {
  const out = { languages: [], skills: [], armor: [], weapons: [], tools: [] }, swaps = crOriginSwaps();
  crOriginSlots().forEach(slot => {
    const swap = swaps.find(s => s.kind === slot.kind && s.from === slot.from);
    out[swap ? swap.toKind : slot.kind].push(swap ? swap.to : slot.from);
  });
  return out;
}
function crOriginSwapsHtml() {
  if (!CREATOR.customOrigin) return "";
  return `<div class="cr-origin-swaps"><b>Customize racial languages and proficiencies</b>` + crOriginSlots().map(slot => {
    const cur = CREATOR.originSwaps[slot.key] || "";
    const options = crOriginOptions(slot).map(o => {
      const value = o.kind + "|" + o.name;
      return `<option value="${escapeHtml(value)}"${value === cur ? " selected" : ""}>${escapeHtml(o.name)} (${o.kind})</option>`;
    }).join("");
    return `<div><label>${escapeHtml(slot.from)} → <select class="cr-origin-swap" data-swapkey="${escapeHtml(slot.key)}" aria-label="Replace ${escapeHtml(slot.from)}"><option value="">Keep ${escapeHtml(slot.from)}</option>${options}</select></label></div>`;
  }).join("") + `</div>`;
}
function crBackgroundFeatsHtml(rec) {
  return backgroundFeatSlots(rec).map(slot => {
    const selected = slot.fixed || CREATOR.backgroundFeats[slot.fkey] || "";
    const feature = creatorFeatureList().find(f => f.fkey === slot.fkey);
    return `<div>Background feat: ${slot.fixed ? escapeHtml(crTitle(slot.fixed)) : `<select class="cr-background-feat" data-fkey="${escapeHtml(slot.fkey)}"><option value="">- choose -</option>${Object.values(FEAT_LIB).sort((a,b) => a.name.localeCompare(b.name)).map(f => `<option value="${escapeHtml(f.name)}"${f.name === selected ? " selected" : ""}>${escapeHtml(f.name)}</option>`).join("")}</select>`}${feature ? crChoicesHtml(feature) : ""}</div>`;
  }).join("");
}
function crGrantSources() {
  return spellGrantSources(CREATOR.race, CREATOR.subrace, CREATOR.customBg ? "" : CREATOR.background, creatorFeatChoices());
}
function crGrantedSpellsHtml() {
  return crGrantSources().map(source => {
    const rows = flattenGrantedSpells(source.spells).filter(g => g.minLevel <= creatorTotalLevel());
    const fixed = resolvedSpellGrants(source, creatorTotalLevel(), CREATOR.picks).filter(g => !g.expanded).map(g => grantSpellName(g.name));
    const choices = flattenGrantedSpells(source.spells).map((g, i) => {
      if (!g.choose || g.expanded || g.minLevel > creatorTotalLevel()) return "";
      return crPickSlotsHtml(source.key + "|" + i, [{ count: g.count, from: grantedSpellPool(g).map(sp => sp.name).sort() }], []).html;
    }).join(" ");
    const expanded = rows.filter(g => g.expanded).map(g => g.name ? grantSpellName(g.name) : describeSpellFilter(g.spec));
    return `<div class="cr-classblock"><b>${escapeHtml(source.name)} spells</b><div>${escapeHtml(crUniqueCI(fixed).join(", "))}</div>${choices}${expanded.length ? `<div class="hint">Added to your class spell list; choose and prepare normally: ${escapeHtml(expanded.join(", "))}</div>` : ""}</div>`;
  }).join("");
}
