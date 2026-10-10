const assert = require('node:assert/strict');
module.exports = async function checkCreatorFocus(page) {
  await page.evaluate(() => { openCreator(); goToCreatorStep(2); });
  const field = page.locator('#cr-body .cr-cls').first();
  await field.fill('');
  await field.pressSequentially('Ranger', { delay: 80 });
  assert.equal(await field.inputValue(), 'Ranger');
  assert(await field.evaluate(el => document.activeElement === el));
  assert.equal(await field.evaluate(el => el.selectionStart), 6);
  await page.locator('#cr-cancel').click();
  console.log('Creator focus: class search retains focus and caret through successive keystrokes.');
};
