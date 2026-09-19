const assert = require('node:assert/strict');
const path = require('node:path');

// Optional end-to-end check against a locally supplied 5etools directory; nothing is bundled.
module.exports = async function checkDataFolder(page, directory) {
  await page.evaluate(() => {
    const original = importPickedFolder;
    importPickedFolder = async files => {
      window.testFolderImported = await original(files);
      return window.testFolderImported;
    };
  });
  await page.locator('#data-folder-input').setInputFiles(directory);
  await page.waitForFunction(() => window.testFolderImported === true, null, { timeout: 180000 });
  const imported = await page.evaluate(() => ({
    files: SNAPSHOT.count, classes: Object.keys(CLASS_LIB).length, races: Object.keys(RACE_LIB).length,
    backgrounds: Object.keys(BACKGROUND_LIB).length, languages: Object.keys(LANGUAGE_LIB).length,
    items: ITEM_LIB.length, spells: SPELL_LIB.length,
  }));
  for (const count of Object.values(imported)) assert(count > 0);
  // Discard the derived localStorage caches: the stored folder alone must restore all libraries.
  await page.evaluate(() => {
    for (const key of ['charsheet-classlib', 'charsheet-racelib', 'charsheet-bglib', 'charsheet-languagelib', 'charsheet-itemlib', 'charsheet-spelllib']) localStorage.removeItem(key);
  });
  await page.reload();
  await page.waitForFunction(() => ciFindClass('Druid')?.mcReq?.wis === 13 && ITEM_LIB.length > 100 && SPELL_LIB.length > 100 && Object.keys(LANGUAGE_LIB).length > 10, null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => CLASS_LIB.Barbarian.mcReq.str), 13);
  assert.equal(await page.evaluate(() => CLASS_LIB.Barbarian.source), 'PHB');
  assert.equal(await page.evaluate(() => BACKGROUND_LIB.Acolyte.source), 'PHB');
  assert.equal(await page.evaluate(() => SNAPSHOT.count), imported.files);
  await page.evaluate(() => { openCreator(); });
  await page.locator('#cr-race').fill('High Elf');
  await page.locator('.combo-child').filter({ hasText: /^High$/ }).click();
  assert.equal(await page.locator('#cr-race').inputValue(), 'Elf');
  assert.equal(await page.locator('#cr-subrace').inputValue(), 'High');
  await page.evaluate(() => { CREATOR.background = 'Folk Hero'; goToCreatorStep(4); });
  assert(await page.locator('[data-bgkind="tools"] option').count() > 10);
  await page.evaluate(() => { CREATOR.background = 'Acolyte'; renderCreator(); });
  assert.equal(await page.locator('[data-bgkind="languages"]').count(), 2);
  assert(await page.locator('[data-bgkind="languages"]').first().locator('option').count() > 5);
  if (process.env.PMCRWF_TEST_SCREENSHOTS) {
    await page.screenshot({ path: path.join(process.env.PMCRWF_TEST_SCREENSHOTS, 'creator-background.png'), animations: 'disabled' });
    await page.locator('[data-crstep="1"]').click();
    await page.locator('#cr-race').fill('Elf');
    await page.screenshot({ path: path.join(process.env.PMCRWF_TEST_SCREENSHOTS, 'creator-races.png'), animations: 'disabled' });
  }
  await page.setViewportSize({ width: 480, height: 640 });
  const box = await page.locator('#creator-modal .modal-box').boundingBox();
  assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= 480 && box.y + box.height <= 640);
  for (const step of [2, 3, 4, 5]) {
    await page.locator(`[data-crstep="${step}"]`).click();
    assert.deepEqual(await page.locator('#creator-modal .modal-box').boundingBox(), box);
    assert(await page.locator('#cr-close').isVisible());
  }
  await page.locator('#cr-close').click();
  console.log('Local 5etools folder: directory picker, snapshot, cache-free reload, prerequisites, race search, tool/language choices and small viewport passed:', imported);
};
