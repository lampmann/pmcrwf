const assert = require('node:assert/strict');
module.exports = async function checkWizardRituals(page) {
  await page.evaluate(() => {
    SPELL_LIB = [
      { name: 'Find Familiar', level: 1, classes: ['Wizard'], ritual: true },
      { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
      { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
      { name: 'Cleric Ritual', level: 1, classes: ['Cleric'], ritual: true },
    ].map(spell => ({ ...spell, source: 'PHB', school: 'C', meta: { ritual: !!spell.ritual }, classes: { fromClassList: spell.classes.map(name => ({ name, source: 'PHB' })) }, time: [{ number: 1, unit: 'action' }], entries: ['Description'] })).map(parseSpell);
    saveSpellLib();
    applyState({ fields: { 'char-name': 'Multiclass ritual test', 'score-int': '16', 'score-wis': '14' },
      classes: [{ name: 'Cleric', lvl: 1, sub: 'Forge Domain' }, { name: 'Wizard', lvl: 2, sub: 'Chronurgy Magic' }],
      spells: [{ name: 'Find Familiar', cls: 'Wizard', lvl: 1, prep: false }, { name: 'Magic Missile', cls: 'Wizard', lvl: 1, prep: true },
        { name: 'Cleric Ritual', cls: 'Cleric', lvl: 1, prep: false }, { name: 'Fire Bolt', cls: 'Wizard', lvl: 0, prep: false }] });
    refreshSpellAddClassSelect(); document.getElementById('spell-add-class').value = 'Cleric'; renderSpellResults();
  });
  await page.locator('#spell-lib-toggle').click();
  const libraryButton = name => page.locator(`.sp-lib-add[data-key="${name}|PHB"]`);
  assert(await libraryButton('Magic Missile').isDisabled());
  await page.locator('#spell-feat-results .sp2-del[data-idx="1"]').click();
  assert.equal(await page.locator('#spell-add-class').inputValue(), 'Wizard');
  assert(await libraryButton('Magic Missile').isEnabled());
  assert.equal(await libraryButton('Magic Missile').innerText(), '+');
  await libraryButton('Magic Missile').click();
  assert(await page.evaluate(() => CHARACTER_SPELLS.some(spell => spell.name === 'Magic Missile' && spell.cls === 'Wizard')));
  const familiar = page.locator('#sb-sections .sb-row').filter({ has: page.locator('.sb-name-link').filter({ hasText: /^Find Familiar$/ }) });
  assert.equal(await familiar.count(), 1);
  assert.equal(await familiar.locator('.sb-ritual').count(), 1);
  assert.equal(await familiar.locator('.sb-cast:not(.sb-ritual)').count(), 0);
  assert.equal(await page.locator('#sb-sections .sb-name-link').filter({ hasText: /^Cleric Ritual$/ }).count(), 0);
  await page.locator('#spell-feat-results .sp2-prep[data-idx="1"]').check();
  assert.equal(await page.locator('#sb-sections .sb-row[data-detail="1|Cleric Ritual"]').count(), 1);
  await page.locator('#spell-feat-results .sp2-del[data-idx="2"]').click();
  assert.equal(await page.locator('#spell-add-class').inputValue(), 'Wizard');
  assert(await libraryButton('Fire Bolt').isEnabled());
  await libraryButton('Fire Bolt').click();
  assert(await page.evaluate(() => CHARACTER_SPELLS.some(spell => spell.name === 'Fire Bolt' && spell.cls === 'Wizard')));
  await page.locator('#spell-manage-close').click();
  const used = await page.evaluate(() => slotUsed(1));
  await familiar.locator('.sb-ritual').click();
  assert.equal(await page.evaluate(() => slotUsed(1)), used);
  assert.match(await page.locator('#dicelog').innerText(), /Ritual.*Find Familiar/);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('char-name').value === 'Multiclass ritual test');
  assert.equal(await familiar.locator('.sb-ritual').count(), 1);
  assert.equal(await page.evaluate(() => slotUsed(1)), used);
  console.log('Wizard spells: multiclass removal refreshes class/plus buttons, spells and cantrips can be re-added, unprepared Wizard rituals appear and cast without slots, Cleric preparation and reload passed.');
};
