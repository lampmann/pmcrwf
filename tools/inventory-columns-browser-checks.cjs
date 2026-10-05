const assert = require('node:assert/strict');
module.exports = async function checkInventoryColumns(page) {
  await page.evaluate(() => {
    applyState({ fields: {}, classes: [] });
    CHARACTER_ITEMS = [
      { name: 'Short', qty: 1, eq: false, slot: '', custom: { name: 'Short', source: 'Custom', weight: 1, valueGp: 2, text: 'Description', reqAttune: '' } },
      { name: 'Much longer custom item name', qty: 2, eq: true, slot: 'armor', attuned: true, custom: { name: 'Much longer custom item name', source: 'Custom', weight: 45, valueGp: 50, text: 'Another description', reqAttune: 'requires attunement' } },
    ]; renderItemList(); recompute();
  });
  const rows = page.locator('#char-item-list tr[data-invdrag]');
  assert.equal(await rows.count(), 2);
  for (let column = 0; column < 12; column++) {
    const first = await rows.nth(0).locator('td').nth(column).boundingBox();
    const second = await rows.nth(1).locator('td').nth(column).boundingBox();
    assert(Math.abs(first.x - second.x) < 1, 'Column ' + column + ' aligned');
  }
  const short = page.locator('#char-item-list tr[data-invdrag="0"]');
  await short.locator('.inv-qty').fill('3');
  assert.equal(await short.locator('[data-figure="2"]').innerText(), '3 lb.');
  assert.equal(await short.locator('[data-figure="3"]').innerText(), '6 gp');
  await short.locator('.inv-qty').blur();
  await short.locator('.inv-link').click();
  assert.match(await page.locator('#char-item-list .feat-detail').innerText(), /Description/);
  assert.equal(await page.locator('#char-item-list .feat-detail td').getAttribute('colspan'), '12');
  await short.locator('.inv-link').click();
  assert.equal(await page.locator('#char-item-list .feat-detail').count(), 0);
  console.log('Inventory columns: aligned controls and numeric columns, quantity editing, totals, expanded descriptions and drag rows passed.');
};
