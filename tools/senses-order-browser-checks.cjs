const assert = require('node:assert/strict');
module.exports = async function checkSenseOrder(page) {
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'Sense order', 'sense-darkvision-other': '60' }, classes: [] });
    const body = document.getElementById('sense-rows');
    const from = body.querySelector('[data-sense-key="darkvision"]'), to = body.querySelector('[data-sense-key="blindsight"]');
    // Ordinary cells remain selectable and don't start a drag.
    from.querySelector('input').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    if (from.draggable) throw new Error('Sense inputs must not start a drag');
    from.querySelector('.sense-grip').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const dataTransfer = new DataTransfer();
    from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientY: to.getBoundingClientRect().top }));
    saveState();
  });
  const expected = ['darkvision', 'blindsight', 'tremorsense', 'truesight'];
  assert.deepEqual(await page.evaluate(() => currentSenseOrder()), expected);
  assert.equal(await page.evaluate(() => senseRange('darkvision').n), 60);
  assert.deepEqual(await page.evaluate(() => JSON.parse(collectState().fields['sense-order'])), expected);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('char-name').value === 'Sense order');
  assert.deepEqual(await page.evaluate(() => currentSenseOrder()), expected);
  await page.evaluate(() => {
    const reordered = collectState();
    applyState({ fields: {}, classes: [] });
    if (JSON.stringify(currentSenseOrder()) !== JSON.stringify(SENSE_NAMES)) throw new Error('Order leaked into another character');
    applyState(reordered);
    document.getElementById('btn-sense-reset-order').click();
  });
  assert.deepEqual(await page.evaluate(() => currentSenseOrder()), ['blindsight', 'darkvision', 'tremorsense', 'truesight']);
  assert.equal(await page.locator('#sense-order').inputValue(), '');
  assert.equal(await page.evaluate(() => senseRange('darkvision').n), 60);
  console.log('Senses: grip-only dragging, saved/exported order, reload, character isolation, reset and unchanged sense values passed.');
};
