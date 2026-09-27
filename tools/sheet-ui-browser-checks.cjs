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
  console.log('Sheet UI: HP bar, defence checklists, counters, exhaustion rows, roll-mode badges, Level Up multiclass proficiencies, spell limits, item/feature spells and senses passed.');
};
