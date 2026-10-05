const assert = require('node:assert/strict');
module.exports = async function checkPurchases(page) {
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'Buyer', 'coin-gp': '175' }, classes: [] });
    ITEM_LIB = [
      { name: 'Purchase Sword', source: 'PHB', type: 'Weapon', rarity: '', weight: 3, valueGp: 25, text: '', reqAttune: '' },
      { name: 'Unknown Price', source: 'PHB', type: 'Gear', rarity: '', weight: 1, valueGp: '', text: '' },
      { name: 'Sword Category', source: 'PHB', type: 'Weapon', rarity: '', weight: '', valueGp: '', text: '', groupItems: ['Purchase Sword'] },
    ];
    saveItemLib(); document.getElementById('item-search').value = ''; renderItemLibrary();
  });
  await page.locator('#item-lib-toggle').click();
  await page.locator('.itm-lib-buy[data-key="Purchase Sword|PHB"]').click();
  assert.equal(await page.locator('#coin-total-gp').innerText(), '150');
  assert.deepEqual(await page.evaluate(() => INVENTORY_TRANSACTIONS.slice(1).map(entry => [entry.amount, entry.source])), [[-25, 'Purchase: Purchase Sword']]);
  assert.match(await page.evaluate(() => INVENTORY_TRANSACTIONS[1].date), /^\d{4}-\d{2}-\d{2}$/);
  await page.locator('#char-item-list .inv-buy').click();
  assert.equal(await page.locator('#coin-total-gp').innerText(), '125');
  assert.equal(await page.locator('#char-item-list .inv-qty').inputValue(), '2');
  await page.locator('.itm-lib-add[data-key="Purchase Sword|PHB"]').click();
  assert.equal(await page.locator('#coin-total-gp').innerText(), '125');
  assert.equal(await page.locator('.itm-lib-buy[data-key="Unknown Price|PHB"]').count(), 0);
  await page.locator('.itm-lib-add[data-key="Sword Category|PHB"]').click();
  await page.locator('.itm-group-buy[data-name="Purchase Sword"]').click();
  assert.equal(await page.locator('#coin-total-gp').innerText(), '100');
  await page.locator('#custom-item-add').click();
  const form = page.locator('#custom-item-editor');
  await form.locator('[name="name"]').fill('Custom Purchase');
  await form.locator('[name="qty"]').fill('3');
  await form.locator('[name="value"]').fill('2.5');
  await form.locator('[data-custom-item-buy]').click();
  assert.equal(await page.locator('#coin-total-gp').innerText(), '92.5');
  assert.equal(await page.evaluate(() => INVENTORY_TRANSACTIONS.at(-1).source), 'Purchase: 3 × Custom Purchase');
  await page.reload();
  await page.waitForFunction(() => CHARACTER_ITEMS.length === 4);
  assert.equal(await page.locator('#coin-total-gp').innerText(), '92.5');
  assert.equal(await page.evaluate(() => INVENTORY_TRANSACTIONS.length), 5);
  await page.locator('#char-item-list .inv-del').first().click();
  assert.equal(await page.locator('#coin-total-gp').innerText(), '92.5');
  assert.equal(await page.evaluate(() => INVENTORY_TRANSACTIONS.length), 5);
  console.log('Purchases: library, category and owned/custom items, quantity/price, dated ledger deductions, free additions, unknown prices and reload passed.');
};
