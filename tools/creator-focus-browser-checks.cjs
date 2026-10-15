const assert = require('node:assert/strict');
module.exports = async function checkCreatorFocus(page) {
  await page.evaluate(() => { openCreator(); goToCreatorStep(2); });
  const field = page.locator('#cr-body .cr-cls').first();
  await field.fill('');
  await field.click();
  for (const [index, letter] of [...'Ranger'].entries()) {
    await page.keyboard.type(letter);
    await page.waitForTimeout(150);
    assert.equal(await field.inputValue(), 'Ranger'.slice(0, index + 1));
    assert(await field.evaluate(el => document.activeElement === el));
    assert.equal(await field.evaluate(el => el.selectionStart), index + 1);
  }
  // A warning class disappears as soon as a banned class name is edited. It must not be
  // part of the identity used to find the replacement input after the redraw.
  await page.evaluate(() => {
    HOUSE_RULES.bans.class.push('Ranger');
    renderCreator();
  });
  assert(await field.evaluate(el => el.classList.contains('banned-value')));
  await field.click();
  await field.press('End');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);
  assert(await field.evaluate(el => document.activeElement === el));
  assert.equal(await field.inputValue(), 'Range');
  await page.keyboard.type('r');
  assert.equal(await field.inputValue(), 'Ranger');
  await page.evaluate(() => { HOUSE_RULES.bans.class = HOUSE_RULES.bans.class.filter(name => name !== 'Ranger'); });
  await field.press('ControlOrMeta+A');
  for (const [index, letter] of [...'Wizard'].entries()) {
    await page.keyboard.type(letter);
    await page.waitForTimeout(150);
    assert.equal(await field.inputValue(), 'Wizard'.slice(0, index + 1));
    assert(await field.evaluate(el => document.activeElement === el));
  }
  await page.locator('#cr-cancel').click();
  console.log('Creator focus: real keyboard typing, caret position and edits that remove warning styles retain class-field focus.');
};
