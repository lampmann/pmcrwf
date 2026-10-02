const assert = require('node:assert/strict');

module.exports = async function checkOrigin(page) {
  await page.evaluate(async () => {
    const files = {
      'races.json': {
        race: [{ name: 'Elf', source: 'PHB', ability: [{ dex: 2 }], size: ['M'], speed: 30,
          skillProficiencies: [{ perception: true }], armorProficiencies: [{ light: true }],
          weaponProficiencies: [{ 'longsword|phb': true, 'spear|phb': true }],
          toolProficiencies: [{ "smith's tools": true }], languageProficiencies: [{ common: true, elvish: true }],
          entries: [{ name: 'Keen Senses', entries: ['You know Perception.'] }],
          additionalSpells: [{ ability: 'int', known: { '1': ['ancestor glow'] } }] }],
        subrace: [{ name: 'High', raceName: 'Elf', raceSource: 'PHB', source: 'PHB', ability: [{ int: 1 }],
          additionalSpells: [{ ability: 'int', known: { '1': [{ choose: 'level=0|class=Wizard', count: 1 }], '3': ['moon glow'] } }] }],
      },
      'backgrounds.json': { background: [{ name: 'Origin Scholar', source: 'PHB', feats: [{ any: 1 }],
        additionalSpells: [{ innate: { '1': ['background light'] }, expanded: { s1: ['sky ward'] } }] }] },
      'feats.json': { feat: [{ name: 'Alert', source: 'PHB', entries: [] }] },
      'class/class-origin-fighter.json': { class: [{ name: 'Origin Fighter', source: 'PHB', hd: { faces: 10 } }] },
      'items-base.json': { baseitem: [
        { name: 'Longsword', source: 'PHB', type: 'M', weapon: true, weaponCategory: 'martial' },
        { name: 'Rapier', source: 'PHB', type: 'M', weapon: true, weaponCategory: 'martial' },
        { name: 'Spear', source: 'PHB', type: 'M', weapon: true, weaponCategory: 'simple' },
        { name: 'Dagger', source: 'PHB', type: 'M', weapon: true, weaponCategory: 'simple' },
        { name: "Smith's Tools", source: 'PHB', type: 'AT' },
        { name: 'Flute', source: 'PHB', type: 'INS' },
      ] },
      'spells/index.json': { PHB: 'spells-test.json' },
      'spells/spells-test.json': { spell: [
        { name: 'Frost Pebble', level: 0 }, { name: 'Ancestor Glow', level: 0 },
        { name: 'Moon Glow', level: 1 }, { name: 'Background Light', level: 0 }, { name: 'Sky Ward', level: 1 },
      ].map(sp => ({ ...sp, source: 'PHB', school: 'A', time: [{ number: 1, unit: 'action' }],
        classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] }, entries: [] })) },
    };
    const picked = Object.entries(files).map(([path, data]) => {
      const file = new File([JSON.stringify(data)], path.split('/').pop());
      Object.defineProperty(file, 'webkitRelativePath', { value: 'data/' + path });
      return file;
    });
    await importPickedFolder(picked);
    openCreator();
    Object.assign(CREATOR, { race: 'Elf', subrace: 'High', background: 'Origin Scholar',
      classes: [{ name: 'Origin Fighter', sub: '', lvl: 3 }], method: 'manual', name: 'Origin Test' });
    renderCreator();
  });
  await page.locator('#cr-custom-origin').check();
  await page.locator('.cr-racial[data-crslot="fixed:0"]').selectOption('dex');
  await page.locator('.cr-racial[data-crslot="fixed:1"]').selectOption('int');
  const swap = name => page.locator(`.cr-origin-swap[data-swapkey="${name}"]`);
  await swap('languages|Common').selectOption('languages|Draconic');
  await swap('skills|Perception').selectOption('skills|Performance');
  await swap('weapons|Longsword').selectOption('tools|Flute');
  await swap("tools|Smith's Tools").selectOption('weapons|Dagger');
  await swap('armor|Light').selectOption('weapons|Rapier');
  assert.equal(await swap('weapons|Spear').locator('option[value="weapons|Rapier"]').count(), 0);
  assert.equal(await swap("tools|Smith's Tools").locator('option[value="weapons|Rapier"]').count(), 0);
  await page.evaluate(() => goToCreatorStep(5));
  await page.locator('.cr-background-feat').selectOption('Alert');
  await page.evaluate(() => goToCreatorStep(4));
  await page.locator('.cr-pick[data-crkey^="subrace|High|"]').selectOption('Frost Pebble');
  assert.match(await page.locator('#cr-body').innerText(), /Ancestor Glow|ancestor glow/);
  assert.match(await page.locator('#cr-body').innerText(), /Moon Glow|moon glow/);
  assert(await page.evaluate(() => crSpellCandidates({ name: 'Sorcerer', sub: '', lvl: 1 }, 1, 1).some(sp => sp.name === 'Sky Ward')));
  await page.evaluate(() => goToCreatorStep(6));
  await page.locator('#cr-create').click();
  const result = await page.evaluate(() => ({
    langs: PROFICIENCIES.languages, tools: PROFICIENCIES.tools, weapons: PROFICIENCIES.weapons,
    perception: skillProfMult('perception'), performance: skillProfMult('performance'),
    armor: document.getElementById('prof-armor-light').checked,
    alert: activeFeatures().some(f => f.isBackgroundFeat && f.name === 'Alert'),
    dexTooltip: document.getElementById('score-eff-dex').title,
    init: effFlat('init'), spells: derivedSpellGroups().flatMap(g => g.names),
  }));
  assert.deepEqual(result.langs.sort(), ['Draconic', 'Elvish']);
  assert.deepEqual(result.tools, ['Flute']);
  assert.deepEqual(result.weapons.sort(), ['Dagger', 'Rapier', 'Spear']);
  assert.equal(result.perception, 0);
  assert.equal(result.performance, 1);
  assert.equal(result.armor, false);
  assert.equal(result.alert, true);
  assert.equal(result.init, 5);
  assert.equal(result.dexTooltip, "10 Base\n+2 Elf");
  for (const name of ['Ancestor Glow', 'Frost Pebble', 'Moon Glow', 'Background Light']) {
    assert(result.spells.some(n => n.toLowerCase() === name.toLowerCase()), name + ' is available');
  }
  assert(!result.spells.some(n => n.toLowerCase() === 'sky ward'), 'expanded spells are not free casts');
  await page.reload();
  await page.waitForFunction(() => document.getElementById('char-name').value === 'Origin Test');
  assert.equal(await page.evaluate(() => skillProfMult('perception')), 0);
  assert.equal(await page.evaluate(() => effFlat('init')), 5);
  assert.equal(await page.locator('#score-eff-dex').getAttribute('title'), '10 Base\n+2 Elf');
  assert(await page.evaluate(() => derivedSpellGroups().some(g => g.names.includes('Frost Pebble'))));
  await page.locator('#spell-lib-toggle').click();
  await page.locator('#spell-feat-results .grant-spell-choice[data-grantkey^="subrace|High|"]').selectOption('Ancestor Glow');
  assert(await page.evaluate(() => !derivedSpellGroups().some(g => g.names.includes('Frost Pebble'))));
  await page.reload();
  await page.waitForFunction(() => Object.values(GRANT_SPELL_CHOICES).some(picks => picks.includes('Ancestor Glow')));
  assert.equal(await page.locator('#spell-feat-results .grant-spell-choice[data-grantkey^="subrace|High|"]').inputValue(), 'Ancestor Glow');
  await page.evaluate(() => {
    const saved = collectState();
    const example = JSON.parse(JSON.stringify(saved));
    example.fields['score-dex'] = '15';
    example.fields['scoremisc-dex'] = '+2';
    example.racialAbilityIncreases.dex = { amount: 2, source: 'Aarakocra' };
    applyState(example);
    if (document.getElementById('score-eff-dex').title !== '13 Base\n+2 Aarakocra\n+2 Misc') throw new Error('Racial tooltip breakdown');
    const legacy = JSON.parse(JSON.stringify(saved));
    delete legacy.racialAbilityIncreases;
    applyState(legacy);
    if (document.getElementById('score-eff-dex').title !== '10 Base\n+2 Elf') throw new Error('Legacy racial tooltip breakdown');
    applyState(saved);
  });
  console.log('Origin: legal proficiency swaps, racial spell choices, both race/subrace grants, background feats/spells, expansion eligibility, and reload passed.');
};
