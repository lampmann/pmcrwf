/* Advancement choices share the creator's feature definitions, while remaining a cancellable draft. */
function luWithDraft(fn) {
  const previous = CREATOR; CREATOR = luDraft();
  CREATOR.levelUpSkills = LEVELUP.picks.skills || [];
  try { return fn(CREATOR); } finally { CREATOR = previous; }
}
function luDraft() {
  const rows = levelUpClasses(), old = rows[LEVELUP.target];
  const name = LEVELUP.target === 'new' ? LEVELUP.newClass.trim() : old?.name || '';
  const level = LEVELUP.target === 'new' ? 1 : (old?.lvl || 0) + 1;
  const signature = LEVELUP.target + '|' + name + '|' + level + '|' + (LEVELUP.subclass || '');
  if (LEVELUP.draftSignature === signature) return LEVELUP.draft;
  const draft = blankCreator();
  draft.race = $('char-race').value; draft.subrace = $('char-subrace').value;
  draft.background = BACKGROUND_GRANTS ? $('char-bg').value : ''; draft.customBg = !BACKGROUND_GRANTS;
  draft.classes = rows.map(r => ({ name: r.name, sub: r.sub, lvl: r.lvl }));
  const row = { name, sub: LEVELUP.subclass || old?.sub || '', lvl: level };
  if (LEVELUP.target === 'new') draft.classes.push(row); else draft.classes[LEVELUP.target] = row;
  const copy = value => JSON.parse(JSON.stringify(value));
  draft.effectChoices = copy(EFFECT_CHOICES); draft.optChoices = copy(OPTFEATURE_CHOICES);
  draft.asiFeats = copy(FEAT_CHOICES); draft.asiScores = copy(ASI_CHOICES); draft.picks = copy(GRANT_SPELL_CHOICES);
  draft.raceFeats = {}; draft.backgroundFeats = copy(FEAT_CHOICES);
  draft.existingSkills = SKILLS.map(s => crSkillSlug(s[0])).filter(slug =>
    $('skillprof-' + slug).checked || $('skillexp-' + slug).checked);
  ABILITIES.forEach(a => { draft.scores[a.key] = Number($('score-' + a.key).value) || 10; });
  CHARACTER_SPELLS.filter(s => !s.grantSrc).forEach(s => {
    const store = draft.spells[s.cls] || (draft.spells[s.cls] = { cantrips: [], spells: [], prepared: [] });
    (s.lvl === 0 ? store.cantrips : store.spells).push(s.name);
    if (s.prep && s.lvl > 0) store.prepared.push(s.name);
  });
  LEVELUP.draft = draft; LEVELUP.draftSignature = signature;
  return draft;
}
function luRow() { const d = luDraft(); return d.classes[LEVELUP.target === 'new' ? d.classes.length - 1 : LEVELUP.target]; }
function luFeatures() {
  const d = luDraft();
  return featuresFor({ race: d.race, subrace: d.subrace, background: d.background,
    classes: d.classes, featChoices: d.asiFeats, optChoices: d.optChoices });
}
function luNewAsis() { const before = new Set(activeFeatures().filter(f => f.isAsi).map(f => f.fkey)); return luFeatures().filter(f => f.isAsi && !before.has(f.fkey)); }
function luScore(ab) {
  const d = luDraft(); let score = abilityScore(ab);
  luNewAsis().forEach(f => {
    if (!d.asiFeats[f.fkey]) score += (d.asiScores[f.fkey] || []).filter(x => x === ab).length;
    else {
      const entry = dbEntryFor(f), choices = d.effectChoices[f.fkey] || {};
      (entry?.effects || []).forEach(e => {
        if (e.op !== 'add' || typeof e.value !== 'number') return;
        const target = e.target.replace(/\{choice:(\w+)\}/g, (_, id) => choices[id] || '');
        if (target === 'score-' + ab) score += e.value;
      });
    }
  });
  return score;
}
function luSpellPlan() {
  const r = luRow(), old = levelUpClasses().find(c => c.name === r.name);
  const caster = classSpellAllowance(r, ab => mod(luScore(ab)));
  if (!caster) return null;
  const before = old ? classSpellAllowance(old, abilityMod) : null;
  const owned = CHARACTER_SPELLS.filter(s => s.cls === r.name && !s.grantSrc);
  const wizard = /^wizard$/i.test(r.name);
  const cantrips = owned.filter(s => s.lvl === 0).length + Math.max(0, classCantripsKnown(r) - (old ? classCantripsKnown(old) : 0));
  const oldSpells = owned.filter(s => s.lvl > 0).length;
  const spells = wizard ? oldSpells + (old ? 2 : 6) : caster.style === 'known'
    ? oldSpells + Math.max(0, caster.max - (before?.max || 0)) : caster.max;
  return { r, owned, wizard, cantrips, spells, prepared: caster.max, style: caster.style, maxLevel: classMaxSpellLevel(r) };
}
function luOptionGroups() {
  const r = luRow(), rec = ciFindClass(r.name);
  return rec ? optGroupsFor(rec, ciFindSub(rec, r.sub), r.lvl) : [];
}
function luSources() { const d = luDraft(); return spellGrantSources(d.race, d.subrace, d.background, d.asiFeats); }
function luOptionsHtml() {
  if (!luRow().name) return '';
  return luWithDraft(d => {
    const r = luRow(), rec = ciFindClass(r.name), before = new Set(activeFeatures().map(f => f.fkey));
    const subclass = rec && Object.keys(rec.subs || {}).length && r.lvl >= (rec.subLevel || 1) && !levelUpClasses().find(c => c.name === r.name)?.sub
      ? `<label>Subclass <select id="lu-subclass"><option value="">- choose -</option>${Object.values(rec.subs || {}).map(s => `<option value="${escapeHtml(s.shortName || s.name)}"${r.sub === (s.shortName || s.name) ? ' selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select></label>` : '';
    const asis = luNewAsis().map((f, i) => `<fieldset><legend>Ability Score Improvement / Feat</legend>${asiChoiceHtml(d, f, i, 'lu')}</fieldset>`).join('');
    const options = luOptionGroups().map(g => `<fieldset><legend>${escapeHtml(g.name)}</legend>${optSlotsHtml(g, r.lvl, d.optChoices, 'lu-opt')}</fieldset>`).join('');
    const newlyActive = f => (dbEntryFor(f)?.effects || []).some(e => e.when?.minLevel > totalLevel() && e.when.minLevel <= creatorTotalLevel());
    const newAsiKeys = new Set(luNewAsis().map(f => f.fkey));
    const features = luFeatures().filter(f => !newAsiKeys.has(f.fkey) && (!before.has(f.fkey) || newlyActive(f) || crLiveChoices(f).some(c => crChoiceMissing(f, c))));
    const choices = features.map(f => `<details${crLiveChoices(f).length ? ' open' : ''}><summary>${escapeHtml(f.name)}${f.origin?.raceName ? ' (racial)' : ''}</summary><div>${escapeHtml(normalizeDisplayPunctuation(f.text || '')).replace(/\n/g, '<br>')}</div>${crChoicesHtml(f)}</details>`).join('');
    const automaticGrants = luSources().flatMap(source => flattenGrantedSpells(source.spells).filter(g => !g.choose && !g.expanded && g.minLevel > totalLevel() && g.minLevel <= creatorTotalLevel()).map(g => `<div>${escapeHtml(source.name)}: ${escapeHtml(grantSpellName(g.name))} (automatically granted)</div>`)).join('');
    const grants = luSources().map(source => flattenGrantedSpells(source.spells).map((grant, index) => {
      if (!grant.choose || grant.expanded || grant.minLevel > creatorTotalLevel()) return '';
      const key = source.key + '|' + index, pool = grantedSpellPool(grant), picks = d.picks[key] || [];
      if (!pool.length) return `<div class="hint">Load spell data to choose ${escapeHtml(source.name)} spells.</div>`;
      return `<div>${escapeHtml(source.name)} spells: ${Array.from({ length: grant.count }, (_, slot) => `<select class="lu-grant" data-key="${escapeHtml(key)}" data-slot="${slot}"><option value="">- choose -</option>${pool.filter(s => s.name === picks[slot] || !picks.includes(s.name)).map(s => `<option${s.name === picks[slot] ? ' selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select>`).join(' ')}</div>`;
    }).join('')).join('');
    const plan = luSpellPlan(); let spells = '';
    if (plan && SPELL_LIB.length) {
      const store = crSpellStore(r.name);
      const list = (key, label, count, pool, lockOld) => `<details open><summary>${label} (${store[key].length}/${count})</summary><input type="search" class="lu-spell-search" placeholder="Search spells" aria-label="Search ${label}"><div class="lu-spell-list">${pool.map(s => {
        const on = store[key].includes(s.name), old = plan.owned.some(o => o.name === s.name);
        return `<label data-name="${escapeHtml(s.name.toLowerCase())}"><input type="checkbox" class="lu-spell" data-list="${key}" value="${escapeHtml(s.name)}"${on ? ' checked' : ''}${(lockOld && old) || (!on && store[key].length >= count) ? ' disabled' : ''}>${escapeHtml(s.name)} <span class="hint">${ordinalLevel(s.level)}</span></label>`;
      }).join('')}</div></details>`;
      const cantrips = crSpellCandidates(r, 0, 0), leveled = crSpellCandidates(r, 1, plan.maxLevel);
      spells = (plan.cantrips ? list('cantrips', 'Cantrips', plan.cantrips, cantrips, true) : '') +
        (plan.maxLevel ? list('spells', plan.wizard ? 'Spellbook - learn two spells each Wizard level' : plan.style === 'known' ? 'Spells known - you may replace one existing spell' : 'Prepared spells', plan.spells, leveled, plan.wizard) : '');
      if (plan.wizard) spells += list('prepared', 'Prepared', plan.prepared, leveled.filter(s => store.spells.includes(s.name)), false);
    } else if (plan) spells = '<div class="hint">Load the Spell Library to select spells for this level.</div>';
    return `<div id="lu-options">${subclass}${asis}${options}${choices}${automaticGrants}${grants}${spells}<div id="lu-option-error" class="cr-blocker"></div></div>`;
  });
}
function luOptionsBlocker() {
  if (totalLevel() >= 20) return 'Maximum total level is 20.';
  return luWithDraft(d => {
    const r = luRow(), rec = ciFindClass(r.name);
    if (rec && Object.keys(rec.subs || {}).length && r.lvl >= (rec.subLevel || 1) && !r.sub) return 'Choose a subclass.';
    for (const f of luNewAsis()) {
      const feat = d.asiFeats[f.fkey];
      if (asiChoiceMode(d, f.fkey) === 'feat' && !feat) return 'Choose a feat.';
      if (feat) { if (!ciFindFeat(feat)) return 'Choose a feat from the loaded library.'; }
      else {
        const picks = d.asiScores[f.fkey] || [];
        if (picks.length < 2 || picks.some(p => !p)) return 'Choose both ability increases or a feat.';
        if (picks.some(ab => luScore(ab) > 20)) return 'An Ability Score Improvement cannot raise a score above 20.';
      }
    }
    for (const g of luOptionGroups()) if (optOptionsFor(g, r.lvl).length && optGroupPicks(g, d.optChoices).length < g.count) return `Choose ${g.name}.`;
    for (const f of luFeatures()) if (crLiveChoices(f).some(c => crChoiceMissing(f, c))) return `Make the choice for ${f.name}.`;
    for (const source of luSources()) for (const [i, grant] of flattenGrantedSpells(source.spells).entries()) {
      if (grant.choose && !grant.expanded && grant.minLevel <= creatorTotalLevel() && grantedSpellPool(grant).length && (d.picks[source.key + '|' + i] || []).filter(Boolean).length < grant.count) return `Choose ${source.name} spells.`;
    }
    const plan = luSpellPlan();
    if (plan && SPELL_LIB.length) {
      const store = crSpellStore(r.name);
      if (crSpellCandidates(r, 0, 0).length && store.cantrips.length !== plan.cantrips) return 'Choose your new cantrips.';
      if ((plan.wizard || plan.style === 'known') && crSpellCandidates(r, 1, plan.maxLevel).length && store.spells.length !== plan.spells) return 'Choose your newly learned spells.';
      if (plan.style === 'known' && plan.owned.filter(s => s.lvl > 0 && !store.spells.includes(s.name)).length > 1) return 'You can replace only one previously known spell at this level.';
      if (store.prepared.length > plan.prepared || (plan.style === 'prepared' && !plan.wizard && store.spells.length > plan.spells)) return 'Too many prepared spells.';
    }
    return '';
  });
}
function luApplyOptions(d, r, plan) {
  FEAT_CHOICES = d.asiFeats; ASI_CHOICES = d.asiScores; EFFECT_CHOICES = d.effectChoices;
  OPTFEATURE_CHOICES = d.optChoices; GRANT_SPELL_CHOICES = d.picks;
  const tr = [...document.querySelectorAll('#class-rows tr')].find(tr => tr.querySelector('.cls-name').value === r.name);
  if (tr) tr.querySelector('.cls-sub').value = r.sub;
  if (plan && d.spells[r.name]) {
    const store = d.spells[r.name];
    CHARACTER_SPELLS = CHARACTER_SPELLS.filter(s => s.cls !== r.name || s.grantSrc);
    [...store.cantrips, ...store.spells].forEach(name => {
      const old = plan.owned.find(s => s.name === name), lib = findLibSpellByName(name);
      CHARACTER_SPELLS.push({ ...old, name, cls: r.name, lvl: lib?.level ?? old?.lvl ?? 0,
        prep: plan.wizard ? store.prepared.includes(name) : plan.style === 'prepared' || !!old?.prep });
    });
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const body = $('lu-body');
  const redraw = () => { const top = body.scrollTop; renderLevelUp(); body.scrollTop = top; };
  body.addEventListener('change', e => {
    if (!LEVELUP) return; const t = e.target, d = luDraft();
    const listPick = (store, key, slot, value) => { const a = [...(store[key] || [])]; a[slot] = value; store[key] = a; };
    if (t.id === 'lu-subclass') { const r = luRow(); LEVELUP.subclass = t.value; d.classes[LEVELUP.target === 'new' ? d.classes.length - 1 : LEVELUP.target].sub = t.value; LEVELUP.draftSignature = LEVELUP.target + '|' + r.name + '|' + r.lvl + '|' + t.value; LEVELUP.draft = d; redraw(); return; }
    if (t.classList.contains('lu-asimode')) { setAsiChoiceMode(d, t.dataset.fkey, t.value); }
    else if (t.classList.contains('cr-effchoice')) {
      const choices = d.effectChoices[t.dataset.fkey] || (d.effectChoices[t.dataset.fkey] = {});
      if (t.dataset.slot != null) listPick(choices, t.dataset.choice, Number(t.dataset.slot), t.value); else choices[t.dataset.choice] = t.value;
    } else if (t.classList.contains('lu-asi')) listPick(d.asiScores, t.dataset.fkey, Number(t.dataset.slot), t.value);
    else if (t.classList.contains('lu-opt')) listPick(d.optChoices, t.dataset.optkey, Number(t.dataset.slot), t.value);
    else if (t.classList.contains('lu-grant')) listPick(d.picks, t.dataset.key, Number(t.dataset.slot), t.value);
    else if (t.classList.contains('lu-spell')) {
      const r = luRow(), store = d.spells[r.name] || (d.spells[r.name] = { cantrips: [], spells: [], prepared: [] });
      store[t.dataset.list] = t.checked ? [...store[t.dataset.list], t.value] : store[t.dataset.list].filter(n => n !== t.value);
      store.prepared = store.prepared.filter(n => store.spells.includes(n));
    } else return;
    redraw();
  });
  body.addEventListener('input', e => {
    if (!LEVELUP) return; const t = e.target;
    if (t.classList.contains('lu-spell-search')) {
      t.parentElement.querySelectorAll('.lu-spell-list label').forEach(label => { label.hidden = !label.dataset.name.includes(t.value.toLowerCase()); }); return;
    }
    if (t.classList.contains('lu-feat')) {
      luDraft().asiFeats[t.dataset.fkey] = t.value; const id = t.id, pos = t.selectionStart;
      redraw(); const field = $(id); field.focus(); field.setSelectionRange(pos, pos);
    }
  });
});
