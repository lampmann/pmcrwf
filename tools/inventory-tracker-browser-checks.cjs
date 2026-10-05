const assert = require('node:assert/strict');
module.exports = async function checkTracker(page) {
  assert.equal(await page.locator('#coin-gp').getAttribute('type'), 'hidden');
  await page.locator('#tracker-add').click();
  await page.locator('#tracker-rows [data-field="amount"]').fill('+180,000');
  await page.locator('#tracker-rows [data-field="source"]').fill('Creation');
  await page.locator('#tracker-rows [data-field="date"]').fill('Creation');
  await page.locator('#tracker-add').click();
  const row = page.locator('#tracker-rows tr').nth(1);
  await row.locator('[data-field="amount"]').fill('-2,000');
  await row.locator('[data-field="source"]').fill('Superior Ability (PC)');
  assert.equal(await page.locator('#tracker-balance').innerText(), '+178,000');
  assert.equal(await page.locator('#coin-counts').innerText(), '0 cp, 0 sp, 0 ep, 178000 gp, 0 pp');
  assert.equal(await page.locator('#coin-total-gp').innerText(), '178000');
  assert(await row.locator('[data-field="amount"]').evaluate(el => el.classList.contains('spent')));
  await row.locator('[data-field="amount"]').fill('bad');
  assert.equal(await page.locator('#tracker-balance').innerText(), '+178,000');
  assert.equal(await row.locator('[data-field="amount"]').getAttribute('aria-invalid'), 'true');
  await row.locator('[data-field="amount"]').fill('-2,500.25');
  assert.equal(await page.locator('#tracker-balance').innerText(), '+177,499.75');
  await page.reload();
  await page.waitForFunction(() => INVENTORY_TRANSACTIONS.length === 2);
  assert.equal(await page.locator('#tracker-balance').innerText(), '+177,499.75');
  assert.equal(await page.locator('#tracker-rows [data-field="date"]').first().inputValue(), 'Creation');
  await page.evaluate(() => {
    const saved = JSON.stringify(collectState());
    applyState({ fields: { 'char-name': 'Other' }, classes: [] });
    if (INVENTORY_TRANSACTIONS.length || document.getElementById('tracker-balance').textContent !== '0') throw new Error('Ledger leaked across characters');
    importCharacterState(saved);
    if (INVENTORY_TRANSACTIONS.length !== 2) throw new Error('Ledger import failed');
    try { validateCharacterState({ fields: {}, inventoryTransactions: [{ amount: 'bad', source: '', date: '' }] }); }
    catch { return; }
    throw new Error('Invalid amount accepted');
  });
  await page.locator('[data-tracker-remove="1"]').click();
  assert.equal(await page.locator('#tracker-balance').innerText(), '+180,000');
  await page.reload();
  assert.equal(await page.locator('#tracker-rows tr').count(), 1);
  await page.evaluate(() => {
    applyState({ fields: { 'coin-gp': '175', 'coin-sp': '5' }, classes: [] });
    if (INVENTORY_TRANSACTIONS[0]?.amount !== 175) throw new Error('Opening gold lost');
    if (document.getElementById('coin-counts').textContent !== '0 cp, 5 sp, 0 ep, 175 gp, 0 pp') throw new Error('Coin breakdown incorrect');
    if (document.getElementById('coin-total-gp').textContent !== '175.5') throw new Error('Coin conversion incorrect');
    applyState({ fields: {}, classes: [] });
    if (document.getElementById('coin-counts').textContent !== '0 cp, 0 sp, 0 ep, 0 gp, 0 pp') throw new Error('Coins leaked across characters');
  });
  console.log('Inventory tracker: signed/comma/decimal amounts, balance, editing, validation, removal, reload and character export/import passed.');
};
