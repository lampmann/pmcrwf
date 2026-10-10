const assert = require('node:assert/strict');
module.exports = async function checkSales(page) {
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'Seller', 'coin-gp': '100' }, classes: [], items: [
      { name: 'Scale Mail', qty: 2, eq: true, attuned: false, slot: 'armor', custom: { name: 'Scale Mail', source: 'Custom', weight: 45, valueGp: 50, text: '' } },
      { name: 'Unknown sale price', qty: 1, eq: false, slot: '' },
    ] });
  });
  const row = index => page.locator(`#char-item-list tr[data-invdrag="${index}"]`);
  const form = page.locator('#item-sale-editor');
  await row(0).locator('.inv-qty').fill('0');
  assert(await row(0).locator('.inv-sell').isDisabled());
  await row(0).locator('.inv-qty').fill('2');
  assert(await row(0).locator('.inv-sell').isEnabled());
  await row(0).locator('.inv-sell').click();
  assert.equal(await form.locator('[name="price"]').inputValue(), '25');
  await form.locator('[data-sale-cancel]').click();
  assert.equal(await row(0).locator('.inv-qty').inputValue(), '2');
  assert.equal(await page.locator('#coin-total-gp').innerText(), '100');
  await row(0).locator('.inv-sell').click();
  await form.locator('[name="qty"]').fill('3');
  await form.locator('[type="submit"]').click();
  assert.equal(await row(0).locator('.inv-qty').inputValue(), '2');
  await form.locator('[name="qty"]').fill('0');
  await form.locator('[type="submit"]').click();
  assert.equal(await row(0).locator('.inv-qty').inputValue(), '2');
  await form.locator('[name="qty"]').fill('1');
  await form.locator('[name="price"]').fill('12.5');
  await form.locator('[type="submit"]').click();
  assert.equal(await row(0).locator('.inv-qty').inputValue(), '1');
  assert.equal(await page.locator('#coin-total-gp').innerText(), '112.5');
  assert.equal(await page.evaluate(() => CHARACTER_ITEMS[0].slot), 'armor');
  assert.deepEqual(await page.evaluate(() => INVENTORY_TRANSACTIONS.slice(1).map(e => [e.amount, e.source])), [[12.5, 'Sale: Scale Mail']]);
  assert.match(await page.evaluate(() => INVENTORY_TRANSACTIONS.at(-1).date), /^\d{4}-\d{2}-\d{2}$/);
  await page.reload();
  await page.waitForFunction(() => CHARACTER_ITEMS[0]?.qty === 1);
  assert.equal(await page.locator('#coin-total-gp').innerText(), '112.5');
  await row(0).locator('.inv-sell').click();
  await form.locator('[type="submit"]').click();
  assert.equal(await page.evaluate(() => CHARACTER_ITEMS.some(i => i.name === 'Scale Mail')), false);
  assert.equal(await page.evaluate(() => itemInSlot('armor')), undefined);
  assert.equal(await page.locator('#coin-total-gp').innerText(), '137.5');
  await row(0).locator('.inv-sell').click();
  assert.equal(await form.locator('[name="price"]').inputValue(), '');
  await form.locator('[name="price"]').fill('7');
  await form.locator('[type="submit"]').click();
  assert.equal(await page.locator('#coin-total-gp').innerText(), '144.5');
  assert.equal(await page.evaluate(() => CHARACTER_ITEMS.length), 0);
  console.log('Sales: half-value defaults, negotiated prices, cancellation, quantity validation, equipped/custom and unknown items, ledger proceeds and reload passed.');
};
