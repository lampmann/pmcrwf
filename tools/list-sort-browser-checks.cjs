const assert = require('node:assert/strict');
module.exports = async function checkListSorting(page) {
  await page.evaluate(() => {
    SPELL_LIB = [
      { name: 'Zulu Sort', level: 1, school: 'V', range: 120 },
      { name: 'Alpha Sort', level: 1, school: 'A', range: 30 },
      { name: 'Beta Sort', level: 2, school: 'C', range: 60 },
    ].map(s => parseSpell({ ...s, source: 'PHB', time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: s.range } },
      classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] }, entries: ['Sort test'] }));
    applyState({ fields: { 'score-int': '18' }, classes: [{ name: 'Wizard', lvl: 5, sub: '' }],
      spells: [{ name: 'Zulu Sort', cls: 'Wizard', lvl: 1, prep: true },
        { name: 'Alpha Sort', cls: 'Wizard', lvl: 1, prep: true },
        { name: 'Beta Sort', cls: 'Wizard', lvl: 2, prep: true }] });
    document.getElementById('spell-search').value = ''; renderSpellResults();
  });
  const firstLevel = page.locator('#sb-sections .sb-level[data-level="1"]');
  const bookNames = () => firstLevel.locator('.sb-name-link').allTextContents();
  assert.deepEqual(await bookNames(), ['Alpha Sort', 'Zulu Sort']);
  await firstLevel.locator('.list-sort[data-sort="range"]').click();
  assert.deepEqual(await bookNames(), ['Zulu Sort', 'Alpha Sort']);
  assert.equal(await firstLevel.locator('th[aria-sort="descending"]').innerText(), 'Range ▲');
  await firstLevel.locator('.list-sort[data-sort="range"]').click();
  assert.deepEqual(await bookNames(), ['Alpha Sort', 'Zulu Sort']);
  // Actions still target the selected spell after sorting changes the row indexes.
  await firstLevel.locator('.sb-row').filter({ hasText: 'Zulu Sort' }).locator('.sb-cast').click();
  assert.match(await page.locator('#dicelog').innerText(), /Zulu Sort/);
  await page.locator('#spell-lib-toggle').click();
  const library = page.locator('#spell-results');
  const libraryNames = () => library.locator('.sp-name-link').allTextContents();
  assert.deepEqual(await libraryNames(), ['Alpha Sort', 'Beta Sort', 'Zulu Sort']);
  await library.locator('.list-sort[data-sort="level"]').click();
  assert.deepEqual(await libraryNames(), ['Beta Sort', 'Alpha Sort', 'Zulu Sort']);
  await library.locator('.list-sort[data-sort="level"]').click();
  assert.deepEqual(await libraryNames(), ['Alpha Sort', 'Zulu Sort', 'Beta Sort']);
  const manager = page.locator('#spell-feat-results');
  assert.deepEqual(await manager.locator('.sp2-link').allTextContents(), ['1st Alpha Sort', '2nd Beta Sort', '1st Zulu Sort']);
  await manager.locator('.list-sort[data-sort="level"]').click();
  assert.deepEqual(await manager.locator('.sp2-link').allTextContents(), ['2nd Beta Sort', '1st Alpha Sort', '1st Zulu Sort']);
  await manager.locator('.sp2-del[data-idx="0"]').click();
  assert(await page.evaluate(() => !CHARACTER_SPELLS.some(s => s.name === 'Zulu Sort') && CHARACTER_SPELLS.some(s => s.name === 'Alpha Sort')));
  await page.evaluate(() => {
    SPELL_LIB = Array.from({ length: 260 }, (_, i) => ({ name: 'Limit Sort ' + String(i).padStart(3, '0'), level: i === 259 ? 9 : 1, source: 'PHB', classes: [], comp: {} }));
    renderSpellResults();
  });
  await library.locator('.list-sort[data-sort="level"]').click();
  assert.equal(await library.locator('.sp-name-link').count(), 250);
  assert.equal((await libraryNames())[0], 'Limit Sort 259');
  await page.locator('#spell-manage-close').click();
  await page.evaluate(() => {
    CHARACTER_ITEMS = [{ name: 'Zulu Sort Item', qty: 1, custom: { name: 'Zulu Sort Item', source: 'Custom', weight: 20, valueGp: 30 } },
      { name: 'Alpha Sort Item', qty: 2, custom: { name: 'Alpha Sort Item', source: 'Custom', weight: 5, valueGp: 10 } }];
    renderItemList();
  });
  const inventory = page.locator('#char-item-list');
  assert.deepEqual(await inventory.locator('.inv-link').allTextContents(), ['Alpha Sort Item', 'Zulu Sort Item']);
  await inventory.locator('.list-sort[data-sort="weight"]').click();
  assert.deepEqual(await inventory.locator('.inv-link').allTextContents(), ['Zulu Sort Item', 'Alpha Sort Item']);
  await inventory.locator('.inv-del[data-idx="0"]').click();
  assert.deepEqual(await page.evaluate(() => CHARACTER_ITEMS.map(i => i.name)), ['Alpha Sort Item']);
  await page.locator('#mon-lib-toggle').click();
  await page.locator('#mon-import').setInputFiles({ name: 'sorting-monsters.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ monster: [
    { name: 'Sort Monster Alpha', source: 'MM', cr: '1/2', ac: [12], hp: { average: 10 }, type: 'beast', size: ['S'] },
    { name: 'Sort Monster Zulu', source: 'MM', cr: '2', ac: [14], hp: { average: 30 }, type: 'beast', size: ['L'] },
    { name: 'Sort Monster Beta', source: 'MM', cr: '1/4', ac: [10], hp: { average: 5 }, type: 'beast', size: ['T'] },
  ] })) });
  await page.locator('#mon-search').fill('Sort Monster');
  const monsters = page.locator('#mon-results');
  await page.waitForFunction(() => document.querySelectorAll('#mon-results .mon-name-link').length === 3);
  assert.deepEqual(await monsters.locator('.mon-name-link').allTextContents(), ['Sort Monster Alpha', 'Sort Monster Beta', 'Sort Monster Zulu']);
  await monsters.locator('.list-sort[data-sort="cr"]').click();
  assert.deepEqual(await monsters.locator('.mon-name-link').allTextContents(), ['Sort Monster Zulu', 'Sort Monster Alpha', 'Sort Monster Beta']);
  await monsters.locator('.list-sort[data-sort="cr"]').click();
  assert.deepEqual(await monsters.locator('.mon-name-link').allTextContents(), ['Sort Monster Beta', 'Sort Monster Alpha', 'Sort Monster Zulu']);
  console.log('List sorting: spellbook, managed spells, spell library, inventory and Bestiary, reversible numeric sorting, arrows, original action targets, full-list limit and fractional CR passed.');
};
