const assert = require('node:assert/strict');
module.exports = async function checkEquipmentSort(page) {
  await page.evaluate(() => {
    ITEM_LIB = [
      { name: 'Zulu', type: 'Weapon', weight: 20, valueGp: 400, rarity: 'rare', reqAttune: 'requires attunement', source: 'ZZZ' },
      { name: 'Alpha', type: 'Armor', weight: 5, valueGp: 10, rarity: 'common', reqAttune: '', source: 'AAA' },
      { name: 'Beta', type: 'Gear', weight: 0, valueGp: 0, rarity: 'legendary', reqAttune: '', source: 'MMM' },
      { name: 'Unknown', type: '', weight: '', valueGp: '', rarity: 'unknown', reqAttune: '', source: '' },
    ].map(item => ({ ...item, text: '' }));
    document.getElementById('item-search').value = ''; renderItemLibrary();
  });
  await page.locator('#item-lib-toggle').click();
  const names = () => page.locator('#item-results .itm-name-link').allTextContents();
  assert.deepEqual(await names(), ['Alpha', 'Beta', 'Unknown', 'Zulu']);
  assert.equal(await page.locator('.itm-sort[data-sort="name"]').innerText(), 'Name ▲');
  assert.match(await page.locator('#item-results tbody tr').filter({ hasText: 'Zulu' }).innerText(), /20 lb\./);
  assert.match(await page.locator('#item-results tbody tr').filter({ hasText: 'Zulu' }).innerText(), /400 gp/);
  for (const key of ['name', 'type', 'weight', 'attunement', 'rarity', 'source', 'price']) assert.equal(await page.locator(`.itm-sort[data-sort="${key}"]`).count(), 1);
  await page.locator('.itm-sort[data-sort="name"]').click();
  assert.deepEqual(await names(), ['Zulu', 'Unknown', 'Beta', 'Alpha']);
  assert.equal(await page.locator('.itm-sort[data-sort="name"]').innerText(), 'Name ▼');
  await page.locator('.itm-sort[data-sort="weight"]').click();
  assert.deepEqual(await names(), ['Zulu', 'Alpha', 'Beta', 'Unknown']);
  assert.equal(await page.locator('.itm-sort[data-sort="weight"]').locator('..').getAttribute('aria-sort'), 'descending');
  await page.locator('.itm-sort[data-sort="weight"]').click();
  assert.deepEqual(await names(), ['Beta', 'Alpha', 'Zulu', 'Unknown']);
  await page.locator('.itm-sort[data-sort="rarity"]').click();
  assert.deepEqual(await names(), ['Beta', 'Zulu', 'Alpha', 'Unknown']);
  await page.locator('.itm-sort[data-sort="attunement"]').click();
  assert.equal((await names())[0], 'Zulu');
  await page.locator('.itm-sort[data-sort="type"]').click();
  assert.deepEqual(await names(), ['Alpha', 'Beta', 'Zulu', 'Unknown']);
  await page.locator('.itm-sort[data-sort="source"]').click();
  assert.deepEqual(await names(), ['Alpha', 'Beta', 'Zulu', 'Unknown']);
  await page.locator('.itm-sort[data-sort="price"]').click();
  assert.deepEqual(await names(), ['Zulu', 'Alpha', 'Beta', 'Unknown']);
  await page.evaluate(() => {
    ITEM_LIB = Array.from({ length: 260 }, (_, index) => ({ name: 'Item ' + index, source: 'Test', type: 'Gear', rarity: '', weight: index, valueGp: index, text: '' }));
    renderItemLibrary();
  });
  assert.equal((await names())[0], 'Item 259');
  assert.equal((await names()).length, 250);
  await page.locator('#item-search').fill('Item 1');
  assert.equal((await names())[0], 'Item 199');
  console.log('Equipment columns: units, labels, default A–Z, reversible numeric/text/rarity sorting, direction indicators, unknown values, full-list sorting and search passed.');
};
