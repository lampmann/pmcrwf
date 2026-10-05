const assert = require('node:assert/strict');

/* The HP bar, defence checklists, counter layout, exhaustion rows, roll-mode badges and Level Up
   multiclass proficiencies. Needs no vendor data: the one class record is injected. */
module.exports = async function checkSheetUi(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#class-rows tr').forEach(t => t.remove());
    addClassRow({ name: 'Fighter', sub: '', lvl: 5 });
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(a => { document.getElementById('score-' + a).value = 14; });
    recompute();
    const cur = document.getElementById('hp-cur'); cur.value = '31'; commitMath(cur);
    const temp = document.getElementById('hp-temp'); temp.value = '8'; commitMath(temp);
    recompute();
  });
  await page.locator('#hp-cur').fill('-5');
  await page.locator('#hp-cur').press('Enter');
  const hp = await page.evaluate(() => ({ cur: hpFieldValue(document.getElementById('hp-cur')), max: Number(document.getElementById('hp-max').textContent),
    fill: parseFloat(document.getElementById('hp-fill').style.width), tempEmpty: document.getElementById('hp-temp-row').classList.contains('hp-temp-empty') }));
  assert.equal(hp.cur, 26);
  // Enter keeps the box focused with its value selected, so adjustments chain without clicking back in.
  assert.equal(await page.evaluate(() => document.activeElement.id), 'hp-cur');
  await page.keyboard.type('+2'); await page.keyboard.press('Enter');
  await page.keyboard.type('-2'); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#hp-cur').inputValue(), '26');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'hp-cur');
  assert.equal(Math.round(hp.fill), Math.round(26 / hp.max * 100));
  assert.equal(hp.tempEmpty, false);
  const bars = await page.evaluate(() => [document.getElementById('hp-temp-row'), document.querySelector('.hp-bar')].map(e => e.getBoundingClientRect().top));
  assert(bars[0] < bars[1], 'temp HP bar sits above the health bar');
  // Temp HP past max stacks full rows under the remainder, all the same height as the health bar.
  await page.evaluate(() => { const t = document.getElementById('hp-temp'); t.value = String(Number(document.getElementById('hp-max').textContent) * 2 + 3); commitMath(t); renderHpBar(); });
  assert.equal(await page.locator('#hp-temp-full .hp-temp-bar').count(), 2);
  const tempRows = await page.evaluate(() => [...document.querySelectorAll('#hp-temp-full .hp-temp-bar, #hp-temp-row')].map(e => ({ top: e.getBoundingClientRect().top, input: !!e.querySelector('input') })));
  assert.equal(tempRows.filter(r => r.input).length, 1);
  assert.equal(tempRows.reduce((a, b) => b.top > a.top ? b : a).input, true, 'the number sits on the bottom temp HP row');
  const heights = await page.evaluate(() => [...document.querySelectorAll('#hp-temp-full .hp-temp-bar, #hp-temp-row, .hp-bar')].map(e => e.offsetHeight));
  assert.equal(new Set(heights).size, 1);
  // A small temp HP stays to scale and its label moves beside the fill; a big one holds it inside.
  const labelAt = temp => page.evaluate(t => { const el = document.getElementById('hp-temp'); el.value = String(t); commitMath(el); renderHpBar();
    const bar = document.getElementById('hp-temp-bar'), max = Number(document.getElementById('hp-max').textContent);
    return { pct: parseFloat(bar.style.width), want: Math.round(t / max * 1000) / 10, outside: document.getElementById('hp-temp-label').classList.contains('hp-temp-outside'),
      text: document.getElementById('hp-temp-label').textContent.trim() }; }, temp);
  const small = await labelAt(1);
  assert.equal(Math.round(small.pct * 10) / 10, small.want);
  assert.equal(small.outside, true);
  assert.equal(small.text, 'THP:');
  const big = await labelAt(Math.round(Number(await page.locator('#hp-max').innerText()) * 0.9));
  assert.equal(big.outside, false);
  assert.match(await page.evaluate(() => [...document.querySelector('.hp-bar-text').childNodes]
    .map(n => n.tagName === 'INPUT' ? n.value : n.textContent).join('').replace(/\s+/g, ' ').trim()), /^HP: 26 ?\/ ?\d+$/);
  // A reload keeps current HP (it used to clamp to the not-yet-computed max of 0).
  await page.evaluate(() => { saveState(); });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#class-lib-autostatus').textContent.includes('loading'));
  assert.equal(await page.locator('#hp-cur').inputValue(), '26');

  await page.locator('.dd-check[data-field="def-resist"] .dd-check-btn').click();
  await page.locator('.dd-check[data-field="def-resist"] input[value="fire"]').check();
  await page.locator('.dd-check[data-field="def-resist"] input[value="cold"]').check();
  assert.equal(await page.locator('#def-resist').inputValue(), 'cold, fire');
  assert.match(await page.locator('#defenses-row').innerText(), /cold/i);
  await page.locator('h1, h2').first().click();
  assert.equal(await page.locator('.dd-check[data-field="def-resist"] input[value="fire"]').isVisible(), false);

  // Defense menus escape a small module's scroll area and keep every option reachable.
  await page.evaluate(() => {
    window.defLayoutBefore = JSON.parse(JSON.stringify(__layout.state));
    __layout.state.free = true; __layout.apply(); __layout.state.free = false;
    __layout.state.map.defenses.w = 220; __layout.state.map.defenses.h = 110; __layout.apply();
  });
  for (const [field, last] of [['def-resist', 'thunder'], ['def-immune', 'unconscious'], ['def-vuln', 'thunder']]) {
    await page.locator(`.dd-check[data-field="${field}"] .dd-check-btn`).click();
    const panel = page.locator(`.dd-check[data-field="${field}"] .dd-check-panel`);
    assert.equal(await panel.evaluate(el => el.matches(':popover-open')), true);
    const fits = await panel.evaluate(el => {
      const r = el.getBoundingClientRect(), b = el.closest('.lay-body').getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.height > b.height;
    });
    assert.equal(fits, true, 'menu fits the viewport and extends beyond the module body');
    await panel.locator(`input[value="${last}"]`).check();
    assert((await page.locator('#' + field).inputValue()).includes(last));
    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false);
  }
  await page.evaluate(() => { Object.assign(__layout.state, window.defLayoutBefore); __layout.apply(); });

  // Counter names sit above their controls.
  const ctr = await page.evaluate(() => { renderBoons(); const c = document.querySelector('.boon-ctr'); if (!c) return null;
    const label = c.querySelector('.boon-label').getBoundingClientRect(), box = c.querySelector('.boon-count').getBoundingClientRect(); return label.bottom <= box.top + 1; });
  if (ctr !== null) assert.equal(ctr, true);

  await page.locator('#exhaustion-effect [data-exh="3"]').click();
  assert.equal(await page.locator('#exhaustion-effect .exh-on').count(), 3);
  assert(await page.locator('.rm-badge.rm-dis').count() > 0, 'exhaustion 3 marks attack and save rolls with the disadvantage badge');
  assert.equal(await page.locator('.rm-badge.rm-dis').first().innerText(), 'D');
  await page.locator('#exhaustion-effect [data-exh="3"]').click();
  await page.evaluate(() => { const l = document.getElementById('exhaustion-level'); l.value = '0'; l.dispatchEvent(new Event('change', { bubbles: true })); recompute(); });
  assert.equal(await page.locator('.rm-badge').count(), 0);

  // Multiclassing through Level Up grants the class's multiclass proficiencies.
  await page.evaluate(() => {
    CLASS_LIB.Rogue = { name: 'Rogue', source: 'PHB', feats: [], subs: {}, mcProf: { armor: ['light'],
      skills: [{ choose: { from: ['acrobatics', 'stealth', 'deception'], count: 1 } }], toolProficiencies: [{ "thieves' tools": true }] } };
    openLevelUp();
  });
  await page.locator('#lu-target').selectOption('new');
  await page.locator('#lu-newclass').fill('Rogue');
  await page.waitForFunction(() => document.querySelector('.lu-pick'));
  assert.equal(await page.locator('#lu-confirm').isDisabled(), true);
  assert.deepEqual(await page.locator('.lu-pick option').allTextContents(), ['- choose -', 'Acrobatics', 'Deception', 'Stealth']);
  await page.locator('.lu-pick').selectOption('Stealth');
  await page.locator('#lu-confirm').click();
  assert.deepEqual(await page.evaluate(() => [$('prof-armor-light').checked, $('skillprof-stealth').checked,
    PROFICIENCIES.tools.includes("Thieves' Tools")]), [true, true, true]);
  await page.evaluate(() => { delete CLASS_LIB.Rogue; });
  // Spells: a class only takes spells on its list up to the level it casts; features and items list theirs.
  const spellChecks = await page.evaluate(() => {
    const savedSpells = SPELL_LIB, savedItems = ITEM_LIB, savedChar = CHARACTER_ITEMS;
    SPELL_LIB = [{ name: 'Fireball', source: 'PHB', level: 3, classes: ['Wizard', 'Sorcerer'] },
      { name: 'Magic Missile', source: 'PHB', level: 1, classes: ['Wizard', 'Sorcerer'] },
      { name: 'Cure Wounds', source: 'PHB', level: 1, classes: ['Cleric', 'Bard'] },
      { name: 'Shield', source: 'PHB', level: 1, classes: ['Wizard', 'Sorcerer'] }];
    document.querySelectorAll('#class-rows tr').forEach(t => t.remove());
    addClassRow({ name: 'Wizard', sub: '', lvl: 3 }); addClassRow({ name: 'Bard', sub: '', lvl: 10 }); recompute();
    const f = n => SPELL_LIB.find(x => x.name === n);
    const out = { tooHigh: spellAddBlock(f('Fireball'), 'Wizard'), ok: spellAddBlock(f('Magic Missile'), 'Wizard'),
      offList: spellAddBlock(f('Cure Wounds'), 'Wizard'), secrets: spellAddBlock(f('Magic Missile'), 'Bard'), other: spellAddBlock(f('Fireball'), '') };
    ITEM_LIB = [{ name: 'Wand of Fireballs', source: 'DMG', reqAttune: 'requires attunement', spells: ['fireball'], text: '' },
      { name: 'Spell Scroll (1st Level)', source: 'DMG', reqAttune: '', spells: [], spellCarrier: 1, text: '' }];
    CHARACTER_ITEMS = [{ name: 'Wand of Fireballs', qty: 1, attuned: false }, { name: 'Spell Scroll (1st Level)', qty: 1, attuned: false, spell: 'Shield' }];
    const headers = () => derivedSpellGroups().map(g => g.header + ':' + g.names.join(','));
    out.unattuned = headers();
    CHARACTER_ITEMS[0].attuned = true;
    out.attuned = headers();
    renderItemList();
    out.scrollOptions = [...document.querySelectorAll('.inv-spell option')].map(o => o.textContent);
    out.carrier = [spellCarrierLevel('Spell Scroll (Cantrip)'), spellCarrierLevel('Spellwrought Tattoo (3rd-Level)'), spellCarrierLevel('Wand of Fireballs')];
    SPELL_LIB = savedSpells; ITEM_LIB = savedItems; CHARACTER_ITEMS = savedChar; renderItemList(); renderSpellList();
    return out;
  });
  assert.equal(spellChecks.tooHigh, 'Wizard 3 casts up to 2nd level');
  assert.equal(spellChecks.ok, '');
  assert.equal(spellChecks.offList, 'not on the Wizard spell list');
  assert.equal(spellChecks.secrets, '', 'Magical Secrets opens every list');
  assert.equal(spellChecks.other, '');
  assert.deepEqual(spellChecks.unattuned, ['Spell Scroll (1st Level):Shield']);
  assert.deepEqual(spellChecks.attuned, ['Wand of Fireballs:fireball', 'Spell Scroll (1st Level):Shield']);
  assert.deepEqual(spellChecks.scrollOptions, ['- spell -', 'Cure Wounds', 'Magic Missile', 'Shield']);
  assert.deepEqual(spellChecks.carrier, [0, 3, null]);
  // Senses: the best grant wins, an extension adds only onto someone else's grant, Other counts as a grant.
  const senses = await page.evaluate(() => {
    const savedContribs = effContribs, savedRace = RACE_LIB.Testling;
    RACE_LIB.Testling = { name: 'Testling', source: 'X', entries: [], subs: {}, senses: { darkvision: 60 } };
    const race = document.getElementById('char-race'), prevRace = race.value; race.value = 'Testling';
    const other = document.getElementById('sense-darkvision-other'); other.value = '';
    let contribs = [];
    effContribs = t => t === 'sense-darkvision' ? contribs : [];
    const out = {};
    out.race = senseRange('darkvision').n;
    contribs = [{ op: 'min', n: 60, source: 'Umbral Sight' }, { op: 'add', n: 30, source: 'Umbral Sight' }];
    out.extended = senseRange('darkvision').n;
    race.value = '';
    out.alone = senseRange('darkvision').n;
    contribs = [{ op: 'min', n: 120, source: 'Stone Rune' }];
    other.value = '90';
    out.best = senseRange('darkvision').n;
    renderSenses();
    out.shown = document.getElementById('sense-darkvision').textContent;
    other.value = ''; race.value = prevRace; effContribs = savedContribs;
    if (savedRace) RACE_LIB.Testling = savedRace; else delete RACE_LIB.Testling;
    recompute();
    return out;
  });
  assert.deepEqual(senses, { race: 60, extended: 90, alone: 60, best: 120, shown: '120' });
  // Spellbook: per-class numbers, level sections, upcast rows with scaled dice, casting spends the right slot.
  const book = await page.evaluate(() => {
    const saved = { lib: SPELL_LIB, spells: CHARACTER_SPELLS, conc: CONCENTRATING };
    const raw = (name, level, extra) => Object.assign({ name, source: 'PHB', level, school: 'V', time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 60 } }, duration: [{ type: 'instant' }], components: { v: true, s: true }, entries: ['x'] }, extra);
    SPELL_LIB = [
      raw('Fireball', 3, { savingThrow: ['dexterity'], damageInflict: ['fire'], entries: ['{@damage 8d6} fire damage.'],
        entriesHigherLevel: [{ type: 'entries', name: 'At Higher Levels', entries: ['When you cast this spell using a spell slot of 4th level or higher, the damage increases by {@scaledamage 8d6|3-9|1d6} for each slot level above 3rd.'] }] }),
      raw('Cure Wounds', 1, { miscTags: ['HL'], range: { type: 'point', distance: { type: 'touch' } }, entries: ['regains {@dice 1d8} + your spellcasting ability modifier hit points.'],
        entriesHigherLevel: [{ type: 'entries', entries: ['the healing increases by {@scaledice 1d8|1-9|1d8} for each slot level above 1st.'] }] }),
      raw('Bless', 1, { duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }] }),
      raw('Hex', 1, { time: [{ number: 1, unit: 'bonus' }], duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 }, concentration: true }] }),
      raw('Alarm', 1, { time: [{ number: 1, unit: 'minute' }], meta: { ritual: true } }),
    ].map(parseSpell);
    SPELL_LIB.forEach(x => { x.classes = { Fireball: ['Wizard'], 'Cure Wounds': ['Cleric'], Bless: ['Cleric'], Hex: ['Warlock'], Alarm: ['Wizard'] }[x.name]; });
    document.querySelectorAll('#class-rows tr').forEach(t => t.remove());
    addClassRow({ name: 'Wizard', sub: '', lvl: 5 }); addClassRow({ name: 'Cleric', sub: '', lvl: 1 }); addClassRow({ name: 'Warlock', sub: '', lvl: 2 });
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(a => { document.getElementById('score-' + a).value = 10; });
    document.getElementById('score-int').value = 18; document.getElementById('score-wis').value = 16; document.getElementById('score-cha').value = 14;
    for (let i = 1; i <= 9; i++) document.getElementById('slot-used-' + i).value = '';
    document.getElementById('pact-used').value = '';
    CONCENTRATING = null;
    CHARACTER_SPELLS = [['Wizard', 3, 'Fireball'], ['Cleric', 1, 'Cure Wounds'], ['Cleric', 1, 'Bless'], ['Warlock', 1, 'Hex'], ['Wizard', 1, 'Alarm']]
      .map(([cls, lvl, name]) => ({ cls, lvl, name, prep: true, grantSrc: '', note: '' }));
    recompute();
    const out = {};
    out.parsed = ['timeStr', 'rangeStr', 'durStr'].map(k => SPELL_LIB.find(x => x.name === 'Hex')[k]).join(',');
    out.stats = [...document.querySelectorAll('#sb-stats .sb-stat-val')].map(e => e.textContent);
    out.statTitles = [...document.querySelectorAll('#sb-stats .sb-stat-val')][2].querySelector('[title]').title;
    const sec = L => document.querySelector(`.sb-level[data-level="${L}"]`);
    const names = L => [...sec(L).querySelectorAll('.sb-name-link')].map(a => a.textContent);
    out.third = names(3);
    const cureAt3 = [...sec(3).querySelectorAll('.sb-row')].find(r => r.querySelector('.sb-name-link').textContent === 'Cure Wounds');
    out.cure3 = cureAt3.querySelector('.sb-effect').dataset.dice + ' ' + cureAt3.querySelector('.sb-lvl-badge').textContent;
    out.fire3 = [...sec(3).querySelectorAll('.sb-row')].find(r => r.querySelector('.sb-name-link').textContent === 'Fireball').children[4].textContent.trim();
    out.slotsAt1 = sec(1).querySelectorAll('.sb-slots[data-kind="slot"] .sb-slot').length + '/' + sec(1).querySelectorAll('.sb-slots[data-kind="pact"] .sb-slot').length;
    const castBtn = (L, name) => [...sec(L).querySelectorAll('.sb-row')].find(r => r.querySelector('.sb-name-link').textContent === name).querySelector('.sb-cast');
    castBtn(3, 'Fireball').click();
    out.after3 = document.getElementById('slot-used-3').value;
    castBtn(1, 'Hex').click();
    out.pact = document.getElementById('pact-used').value + '/' + document.getElementById('slot-used-1').value;
    out.conc = CONCENTRATING && CONCENTRATING.name;
    sec(1).querySelectorAll('.sb-slots[data-kind="slot"] .sb-slot')[3].click();
    out.fill = document.getElementById('slot-used-1').value;
    sec(1).querySelector('.sb-slots[data-kind="slot"] .sb-slot.used').click();
    out.unfill = document.getElementById('slot-used-1').value;
    document.querySelector('.sb-q[data-q="ritual"]').click();
    out.ritual = [...document.querySelectorAll('.sb-name-link')].map(a => a.textContent);
    document.querySelector('.sb-q[data-q="ritual"]').click();
    out.ritualOff = [...document.querySelectorAll('.sb-name-link')].map(a => a.textContent).includes('Alarm') + ',' + document.querySelector('.sb-q[data-q="ritual"]').className;
    document.querySelector('.sb-q[data-q="ritual"]').click();
    out.ritualBlank = document.querySelector('.sb-q[data-q="ritual"]').className;
    out.aligned = new Set([...document.querySelectorAll('.sb-row .sb-name')].map(td => Math.round(td.getBoundingClientRect().left))).size;
    document.querySelector('.sb-q[data-q="all"]').click();
    refreshSpellAddClassSelect(); document.getElementById('spell-add-class').value = 'Wizard'; renderSpellResults();
    const libBtn = n => [...document.querySelectorAll('#spell-results tbody tr')].find(r => r.querySelector('.nm a').textContent === n).querySelector('.sp-lib-add');
    out.libButtons = [libBtn('Fireball').textContent, libBtn('Alarm').textContent];
    libBtn('Fireball').click();
    out.removed = CHARACTER_SPELLS.some(x => x.name === 'Fireball') + ',' + libBtn('Fireball').textContent;
    SPELL_LIB = saved.lib; CHARACTER_SPELLS = saved.spells; CONCENTRATING = saved.conc;
    for (let i = 1; i <= 9; i++) document.getElementById('slot-used-' + i).value = '';
    document.getElementById('pact-used').value = '';
    recompute();
    return out;
  });
  assert.equal(book.parsed, 'BA,60 ft,1 h');
  assert.deepEqual(book.stats, ['+4 | +3 | +2', '+7 | +6 | +5', '15 | 14 | 13']);
  assert.equal(book.statTitles, 'Wizard (INT)');
  assert.deepEqual(book.third, ['Alarm', 'Bless', 'Cure Wounds', 'Fireball', 'Hex']);
  assert.equal(book.cure3, '3d8+3 1st');
  assert.equal(book.fire3, 'DEX 15');
  assert.equal(book.slotsAt1, '4/2');
  assert.equal(book.after3, '1');
  assert.equal(book.pact, '1/', 'a Warlock spell spends a pact slot first');
  assert.equal(book.conc, 'Hex');
  assert.equal(book.fill, '1');
  assert.equal(book.unfill, '');
  assert.deepEqual(book.ritual, ['Alarm', 'Alarm', 'Alarm']);
  assert.equal(book.ritualOff, 'false,sb-q exc', 'a second click excludes');
  assert.equal(book.ritualBlank, 'sb-q', 'a third click clears');
  assert.equal(book.aligned, 1, 'the Name column lines up across levels');
  assert.deepEqual(book.libButtons, ['-', '-']);
  assert.equal(book.removed, 'false,+');

  // XP bar: progress through the current level, above and as wide as the XP / Level / next-level text.
  const xpBar = await page.evaluate(() => {
    document.querySelectorAll('#class-rows tr').forEach(t => t.remove()); addClassRow({ name: 'Fighter', sub: '', lvl: 3 });
    const x = document.getElementById('char-xp'), prev = x.value; x.value = '1800'; commitMath(x); recompute();
    const bar = document.getElementById('xp-bar').getBoundingClientRect(), label = document.getElementById('char-xp').getBoundingClientRect();
    const next = document.getElementById('xp-next').getBoundingClientRect();
    const group = document.querySelector('.xp-group'), mod = group.closest('.module').getBoundingClientRect();
    const others = [...group.parentElement.children].filter(e => e !== group).map(e => e.getBoundingClientRect())
      .filter(r => r.width && r.right > group.getBoundingClientRect().left && r.left < group.getBoundingClientRect().right && r.bottom <= label.top);
    const range = document.createRange(); range.selectNodeContents(group.closest('.module').querySelector(':scope > h2'));
    const g = group.getBoundingClientRect();
    const title = [...range.getClientRects()].filter(r => r.width && r.right > g.left && r.left < g.right && r.bottom <= label.top);
    const aboveEdge = Math.max(mod.top, ...others.map(r => r.bottom), ...title.map(r => r.bottom));
    const gapAbove = bar.top - aboveEdge, gapBelow = label.top - bar.bottom;
    const out = { fill: document.getElementById('xp-fill').style.width, above: bar.bottom <= label.top, spans: bar.right >= next.right - 1,
      centred: gapBelow > 2 && Math.abs(gapAbove - gapBelow) <= 2 };
    x.value = prev; commitMath(x); recompute();
    return out;
  });
  assert.deepEqual(xpBar, { fill: '50%', above: true, spans: true, centred: true });

  // Creator spell step: a checklist per list, capped at the count, plus the library's filters.
  const crSpells = await page.evaluate(() => {
    const saved = SPELL_LIB;
    localStorage.removeItem('charsheet-crspellfilters'); CR_SPELL_FILTERS = null; CR_SPELL_FILTERS_OPEN = false; CR_SPELL_OPEN = '';
    const sp = (name, level, school) => ({ name, source: 'PHB', level, school, classes: ['Druid'], comp: {}, dmgTypes: [], conds: [], areaTags: [] });
    SPELL_LIB = [sp('Guidance', 0, 'Divination'), sp('Produce Flame', 0, 'Conjuration'), sp('Shillelagh', 0, 'Transmutation'),
      sp('Cure Wounds', 1, 'Evocation'), sp('Entangle', 1, 'Conjuration'), sp('Thunderwave', 1, 'Evocation')];
    openCreator(); CREATOR.classes = [{ name: 'Druid', sub: '', lvl: 1 }]; goToCreatorStep(CR_STEP.spells);
    const out = {};
    document.querySelector('.cr-spelldd-btn[data-dd="Druid|cantrips"]').click();
    const boxes = () => [...document.querySelectorAll('.cr-spelldd[data-dd="Druid|cantrips"] .cr-spellcheck')];
    out.options = boxes().map(b => b.value);
    boxes()[0].click(); boxes()[1].click();
    out.picked = crSpellStore('Druid').cantrips.join(',');
    out.thirdDisabled = boxes()[2].disabled;
    out.stillOpen = !document.querySelector('.cr-spelldd[data-dd="Druid|cantrips"] .cr-spell-panel').hidden;
    document.getElementById('cr-spell-filter-btn').click();
    const evo = [...document.querySelectorAll('#cr-spell-filter-area .fbtn')].find(b => b.textContent.trim() === 'Evocation');
    evo.click();
    document.querySelector('.cr-spelldd-btn[data-dd="Druid|spells"]').click();
    out.evocationOnly = [...document.querySelectorAll('.cr-spelldd[data-dd="Druid|spells"] .cr-spellcheck')].map(b => b.value).join(',');
    out.cantripsKeptPicked = boxes().map(b => b.value).join(',');
    closeCreator(); SPELL_LIB = saved; localStorage.removeItem('charsheet-crspellfilters'); CR_SPELL_FILTERS = null; CR_SPELL_FILTERS_OPEN = false;
    return out;
  });
  assert.deepEqual(crSpells, { options: ['Guidance', 'Produce Flame', 'Shillelagh'], picked: 'Guidance,Produce Flame', thirdDisabled: true,
    stillOpen: true, evocationOnly: 'Cure Wounds,Thunderwave', cantripsKeptPicked: 'Guidance,Produce Flame' });

  // Background module: the background's feature from the data, and the three groups of fields.
  const bgm = await page.evaluate(() => {
    const saved = BACKGROUND_LIB.Sage, prev = document.getElementById('char-bg').value;
    BACKGROUND_LIB.Sage = { name: 'Sage', source: 'PHB', feature: { name: 'Researcher', text: 'You know where to look.' } };
    document.getElementById('char-bg').value = 'sage'; recompute();
    document.getElementById('bgm-feature-link').click();
    const out = { head: document.getElementById('bgm-head').innerText.replace(/\s+/g, ' ').trim(),
      groups: [...document.querySelectorAll('[data-module="background"] legend')].map(l => l.textContent),
      persisted: ['bg-sex', 'bg-height', 'bg-weight', 'bg-age', 'bg-hair', 'bg-eyes', 'bg-skin', 'bg-physical', 'bg-alignment', 'bg-traits', 'bg-ideals', 'bg-bonds', 'bg-flaws']
        .every(id => document.getElementById(id) && document.getElementById(id).hasAttribute('data-persist')) };
    document.getElementById('bgm-feature-link').click();
    if (saved) BACKGROUND_LIB.Sage = saved; else delete BACKGROUND_LIB.Sage;
    document.getElementById('char-bg').value = prev; recompute();
    return out;
  });
  assert.deepEqual(bgm, { head: 'Sage PHB Feature: Researcher You know where to look.', groups: ['Appearance', 'Alignment', 'Personality'], persisted: true });

  // Speed: custom speeds added by name and feet, edited in place and removed; a typed edit isn't redrawn under the cursor.
  await page.fill('#speed-add-name', 'Glide'); await page.fill('#speed-add-ft', '15'); await page.click('#speed-add-btn');
  await page.locator('#speed-rows .speed-custom-ft').fill('20');
  const spd = await page.evaluate(() => ({ list: document.getElementById('speed-custom').value,
    focused: document.activeElement && document.activeElement.classList.contains('speed-custom-ft'),
    rows: [...document.querySelectorAll('#speed-rows tr:not([data-speed-i]) td:nth-child(2)')].map(td => td.textContent) }));
  await page.click('#speed-rows .speed-custom-del');
  assert.deepEqual(spd, { list: '[{"name":"Glide","ft":"20"}]', focused: true, rows: ['Walk', 'Burrow', 'Climb', 'Fly', 'Swim'] });
  assert.equal(await page.evaluate(() => document.getElementById('speed-custom').value + document.querySelectorAll('#speed-rows tr[data-speed-i]').length), '0');

  // Movement rows use real grip drags, retain editable values, and travel with the character.
  const speedOrder = () => page.evaluate(() => currentSpeedOrder());
  const dragSpeed = async (from, to) => {
    const grip = page.locator(`#speed-rows [data-speed-key="${from}"] .speed-grip`);
    await grip.scrollIntoViewIfNeeded();
    const start = await grip.boundingBox();
    const target = await page.locator(`#speed-rows [data-speed-key="${to}"]`).boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 10, target.y + 2, { steps: 12 });
    await page.mouse.up();
  };
  await dragSpeed('fly', 'walk');
  assert.deepEqual(await speedOrder(), ['fly', 'walk', 'burrow', 'climb', 'swim']);
  await page.fill('#speed-fly-misc', '+10 wings');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'speed-fly-misc');
  await page.fill('#speed-add-name', 'Glide'); await page.fill('#speed-add-ft', '15'); await page.click('#speed-add-btn');
  await dragSpeed('custom:0', 'fly');
  await page.locator('#speed-rows .speed-custom-ft').fill('25');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('speed-custom-ft')), true);
  const ordered = ['custom:0', 'fly', 'walk', 'burrow', 'climb', 'swim'];
  assert.deepEqual(await speedOrder(), ordered);
  await page.evaluate(() => { window.speedSaved = collectState(); applyState({ fields: {} }); });
  assert.deepEqual(await speedOrder(), ['walk', 'burrow', 'climb', 'fly', 'swim']);
  await page.evaluate(() => { applyState(window.speedSaved); saveState(); });
  await page.reload();
  assert.deepEqual(await speedOrder(), ordered);
  assert.equal(await page.locator('#speed-rows .speed-custom-ft').inputValue(), '25');
  await page.fill('#speed-add-name', 'Teleport'); await page.fill('#speed-add-ft', '30'); await page.click('#speed-add-btn');
  await dragSpeed('custom:1', 'custom:0');
  await page.locator('#speed-rows [data-speed-key="custom:0"] .speed-custom-del').click();
  assert.deepEqual(await speedOrder(), ordered);
  assert.equal(await page.locator('#speed-rows .speed-custom-name').inputValue(), 'Teleport');
  await page.click('#btn-speed-reset-order');
  assert.deepEqual(await speedOrder(), ['walk', 'burrow', 'climb', 'fly', 'swim', 'custom:0']);
  await page.click('#speed-rows .speed-custom-del');
  await page.fill('#speed-fly-misc', '');

  // Duplicate: a copy right after the original, named "(copy)", active, with the same fields.
  const dup = await page.evaluate(() => {
    document.getElementById('char-name').value = 'Dup Source'; document.getElementById('bg-hair').value = 'red'; saveState();
    const before = ROSTER.chars.length, srcId = ROSTER.activeId;
    document.getElementById('char-tab-dup').click();
    const i = ROSTER.chars.findIndex(c => c.id === ROSTER.activeId);
    const out = { added: ROSTER.chars.length - before, after: ROSTER.chars[i - 1].id === srcId, name: document.getElementById('char-name').value,
      hair: document.getElementById('bg-hair').value, own: ROSTER.activeId !== srcId };
    const copy = ROSTER.activeId; switchCharacter(srcId); ROSTER.chars = ROSTER.chars.filter(c => c.id !== copy); persistRoster(); renderCharacterTabs();
    document.getElementById('bg-hair').value = ''; saveState();
    return out;
  });
  assert.deepEqual(dup, { added: 1, after: true, name: 'Dup Source (copy)', hair: 'red', own: true });

  // Merging modules: the stationary one keeps its box and its tab comes first; tabs switch; detaching dissolves.
  await page.evaluate(() => { const L = __layout; L.state.free = true; L.apply(); });
  // An arranged module can be dragged narrower than the flow layout's 240px minimum (Conditions is narrow).
  assert.equal(await page.evaluate(() => { const m = document.querySelector('[data-module="conditions"]'); m.style.width = '150px';
    const w = Math.round(m.getBoundingClientRect().width); m.style.width = ''; __layout.apply(); return w; }), 150);
  const merged = await page.evaluate(() => {
    const L = __layout, saves = document.querySelector('[data-module="saves"]'), senses = document.querySelector('[data-module="senses"]');
    const before = { ...L.state.map.saves };
    L.mergeInto(senses, saves);
    const shown = () => ['saves', 'senses'].filter(k => document.querySelector(`[data-module="${k}"]`).offsetParent);
    const p = L.state.map;
    return { tabs: [...saves.querySelectorAll('.lay-tab')].map(t => t.textContent), shown: shown(),
      sameBox: p.senses.x === before.x && p.senses.y === before.y && p.senses.w === before.w && p.senses.h === p.saves.h };
  });
  assert.deepEqual(merged, { tabs: ['Saving Throws', 'Senses'], shown: ['saves'], sameBox: true });
  await page.evaluate(() => { __layout.state.free = false; __layout.apply(); });
  await page.locator('[data-module="saves"] .lay-tab[data-tab="senses"]').click();
  assert.deepEqual(await page.evaluate(() => ['saves', 'senses'].filter(k => document.querySelector(`[data-module="${k}"]`).offsetParent)), ['senses']);
  // A short, narrow merged module scrolls only its body; tabs, title and toggle stay put.
  await page.evaluate(() => {
    __layout.switchTab('saves');
    const p = __layout.state.map.saves; p.h = 180; p.w = 250; __layout.apply();
  });
  const pinned = await page.evaluate(() => {
    const m = document.querySelector('[data-module="saves"]'), body = m.querySelector('.lay-body');
    const controls = [m.querySelector('h2'), m.querySelector('.lay-collapse-btn'), m.querySelector('.lay-tabs')];
    const before = controls.map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y]; });
    body.scrollTop = 100; body.scrollLeft = 100;
    return { scrolled: body.scrollTop > 0, horizontal: body.scrollLeft > 0,
      fixed: controls.every((el, i) => { const r = el.getBoundingClientRect(); return r.x === before[i][0] && r.y === before[i][1]; }) };
  });
  assert.deepEqual(pinned, { scrolled: true, horizontal: true, fixed: true });
  await page.locator('[data-module="saves"] .lay-collapse-btn').click();
  assert.equal(await page.locator('[data-module="saves"] .lay-body').isVisible(), false);
  await page.locator('[data-module="saves"] .lay-collapse-btn').click();
  await page.locator('[data-module="saves"] .lay-tab[data-tab="senses"]').click();
  // Tabs reorder by dragging, like the character tabs: drop Senses before Saving Throws.
  {
    const from = await page.locator('.module:not(.lay-stack-hidden) .lay-tab[data-tab="senses"]').boundingBox();
    const to = await page.locator('.module:not(.lay-stack-hidden) .lay-tab[data-tab="saves"]').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 8 });
    assert.equal(await page.locator('.lay-tab.drop-before').count() >= 1, true);
    await page.mouse.up();
    assert.equal(await page.evaluate(() => Object.values(__layout.state.stacks)[0].members.join(',')), 'senses,saves');
  }
  assert.equal(await page.evaluate(() => { __layout.detach(document.querySelector('[data-module="senses"]')); return Object.keys(__layout.state.stacks).length + document.querySelectorAll('.lay-tab').length; }), 0);
  await page.evaluate(() => { const L = __layout; Object.assign(L.state, { map: {}, stacks: {}, free: false, activated: false }); L.apply(); L.save(); });

  console.log('Sheet UI: HP bar, defence checklists, counters, exhaustion rows, roll-mode badges, Level Up multiclass proficiencies, spell limits, item/feature spells, senses, the spellbook, the XP bar, creator spell checklists, the Background module, custom speeds, duplicating a character and merged modules passed.');
};
