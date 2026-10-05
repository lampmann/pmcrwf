const assert = require('node:assert/strict');
module.exports = async function checkAnnotatedFields(page) {
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'Annotated fields', 'ac-misc': '+1 (Blessing of the Forge)',
      'savemisc-str': '+2 (Protection)', 'skillmisc-performance': '+3 (Training)',
      'spell-dc-misc': '+1 (Magic focus)', 'spell-atk-misc': '+1d4 (Bless)', 'init-misc': '+2 (Gift)' }, classes: [] });
  });
  assert.equal(await page.evaluate(() => checkBonus('ac')), 11);
  assert.equal(await page.evaluate(() => checkBonus('save-str')), 2);
  assert.equal(await page.evaluate(() => checkBonus('skill-performance')), 3);
  assert.equal(await page.evaluate(() => spellSaveDC()), 11);
  assert.equal(await page.evaluate(() => spellAttackDice()), '+1d4');
  const field = page.locator('#ac-misc');
  const before = await field.boundingBox();
  await field.click();
  const expanded = await field.boundingBox();
  assert(expanded.width > before.width * 2);
  assert(await field.evaluate(el => el.scrollWidth <= el.clientWidth + 2));
  assert.equal(await field.inputValue(), '+1 (Blessing of the Forge)');
  await field.fill('+2 (Blessing of the Forge, level 3)');
  assert.equal(await page.evaluate(() => checkBonus('ac')), 12);
  await field.blur();
  assert(Math.abs((await field.boundingBox()).width - before.width) < 1);
  assert.equal(await page.locator('[data-editing-placeholder]').count(), 0);
  await page.locator('#custom-feature-add').click();
  const description = page.locator('#custom-feature-description');
  const small = await description.boundingBox();
  await description.fill(Array.from({ length: 14 }, (_, index) => 'Description line ' + index).join('\n'));
  assert((await description.boundingBox()).height > small.height);
  await page.locator('#custom-feature-cancel').click();
  await page.reload();
  await page.waitForFunction(() => document.getElementById('char-name').value === 'Annotated fields');
  assert.equal(await field.inputValue(), '+2 (Blessing of the Forge, level 3)');
  assert.equal(await page.evaluate(() => checkBonus('ac')), 12);
  console.log('Annotated fields: labelled numeric/dice bonuses, AC/saves/skills/spell DC, expanding text and multiline descriptions, blur restoration and reload passed.');
};
