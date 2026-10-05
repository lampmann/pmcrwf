const assert = require('node:assert/strict');
module.exports = async function checkCustomFeatures(page) {
  await page.evaluate(() => applyState({ fields: { 'char-name': 'Custom Feature Test' }, classes: [] }));
  await page.locator('#custom-feature-add').click();
  await page.locator('#custom-feature-name').fill('Homebrew <feature>');
  await page.locator('#custom-feature-description').fill('First line\nSecond line <script>bad()</script>');
  await page.locator('#custom-feature-editor button[type="submit"]').click();
  assert.equal(await page.locator('#custom-feature-list summary').innerText(), 'Homebrew <feature>');
  assert.equal(await page.locator('.custom-feature-text').innerText(), 'First line\nSecond line <script>bad()</script>');
  assert.equal(await page.locator('#custom-feature-list script').count(), 0);
  assert.deepEqual(await page.evaluate(() => collectState().customFeatures), [{ name: 'Homebrew <feature>', description: 'First line\nSecond line <script>bad()</script>' }]);
  await page.reload();
  await page.waitForFunction(() => CUSTOM_FEATURES.length === 1);
  await page.locator('#custom-feature-list summary').click();
  await page.locator('[data-custom-edit="0"]').click();
  await page.locator('#custom-feature-name').fill('Changed');
  await page.locator('#custom-feature-cancel').click();
  assert.equal(await page.locator('#custom-feature-list summary').innerText(), 'Homebrew <feature>');
  await page.locator('[data-custom-edit="0"]').click();
  await page.locator('#custom-feature-name').fill('Updated feature');
  await page.locator('#custom-feature-editor button[type="submit"]').click();
  assert.equal(await page.locator('#custom-feature-list summary').innerText(), 'Updated feature');
  await page.evaluate(() => {
    const saved = JSON.stringify(collectState());
    applyState({ fields: { 'char-name': 'Other character' }, classes: [] });
    if (CUSTOM_FEATURES.length || document.getElementById('custom-feature-list').children.length) throw new Error('Custom features leaked across characters');
    importCharacterState(saved);
    if (CUSTOM_FEATURES[0].name !== 'Updated feature') throw new Error('Custom feature import failed');
    try { validateCharacterState({ fields: {}, customFeatures: [{ name: 'Invalid', description: {} }] }); }
    catch { return; }
    throw new Error('Malformed custom feature accepted');
  });
  await page.locator('#custom-feature-list summary').click();
  await page.locator('[data-custom-remove="0"]').click();
  assert.equal(await page.locator('#custom-feature-list details').count(), 0);
  await page.reload();
  assert.equal(await page.evaluate(() => CUSTOM_FEATURES.length), 0);
  console.log('Custom features: add, edit, cancel, remove, safe descriptions, reload, character isolation, export/import and validation passed.');
};
