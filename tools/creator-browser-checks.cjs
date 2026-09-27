const assert = require('node:assert/strict');

module.exports = async function checkCreator(page) {
  await page.waitForFunction(() => !document.querySelector('#class-lib-autostatus').textContent.includes('loading'));
  // Same folder snapshot and reload path used by Firefox's directory picker. No vendor data required.
  await page.evaluate(async () => {
    const files = {
      'class/class-barbarian.json': {
        class: [
          { name: 'Barbarian', source: 'PHB', hd: { faces: 12 }, multiclassing: { requirements: { str: 13 } } },
          { name: 'Barbarian', source: 'XPHB', hd: { faces: 12 } },
        ],
        classFeature: [
          { name: 'Original feature', className: 'Barbarian', classSource: 'PHB', level: 1, entries: ['Original'] },
          { name: 'Revised feature', className: 'Barbarian', classSource: 'XPHB', level: 1, entries: ['Revised'] },
        ],
      },
      'class/class-druid.json': { class: [
        { name: 'Druid', source: 'XPHB', hd: { faces: 8 } },
        { name: 'Druid', source: 'PHB', hd: { faces: 8 }, multiclassing: { requirements: { wis: 13 } } },
      ] },
      'races.json': {
        race: [{ name: 'Elf', source: 'PHB' }, { name: 'Elf', source: 'XPHB' }, { name: 'Sylph', source: 'TCE' }],
        subrace: [{ name: 'High', raceName: 'Elf', source: 'PHB' }, { name: 'Moon', raceName: 'Elf', source: 'TCE' },
          { name: 'Moon', raceName: 'Sylph', source: 'TCE' }],
      },
      'backgrounds.json': { background: [
        { name: 'Acolyte', source: 'PHB', languageProficiencies: [{ anyStandard: 2 }] },
        { name: 'Acolyte', source: 'XPHB' },
        { name: 'Artisan', source: 'PHB', toolProficiencies: [{ anyArtisansTool: 1 }] },
      ] },
      'languages.json': { language: [
        { name: 'Common', source: 'PHB', type: 'standard' }, { name: 'Elvish', source: 'PHB', type: 'standard' },
        { name: 'Abyssal', source: 'PHB', type: 'exotic' },
      ] },
      'items-base.json': { baseitem: [{ name: "Carpenter's Tools", source: 'PHB', type: 'AT' }] },
      'items.json': { item: [{ name: 'Disguise Kit', source: 'PHB', type: 'T' }] },
    };
    const picked = Object.entries(files).map(([rel, json]) => {
      const f = new File([JSON.stringify(json)], rel.split('/').pop());
      Object.defineProperty(f, 'webkitRelativePath', { value: '5etools-test/data/' + rel });
      return f;
    });
    const persist = navigator.storage.persist;
    navigator.storage.persist = () => new Promise(() => {});
    try {
      // An unanswered storage-permission prompt must not hold up the library load.
      const imported = await Promise.race([importPickedFolder(picked), new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Folder load waited for storage permission')), 10000))]);
      if (!imported) throw new Error('Folder import failed');
    } finally { navigator.storage.persist = persist; }
  });
  await page.reload();
  await page.waitForFunction(() => ciFindClass('Druid')?.mcReq?.wis === 13 && Object.keys(LANGUAGE_LIB).length === 3);
  assert.deepEqual(await page.evaluate(() => [CLASS_LIB.Barbarian.mcReq, CLASS_LIB.Druid.mcReq]), [{ str: 13 }, { wis: 13 }]);
  assert.deepEqual(await page.evaluate(() => CLASS_LIB.Barbarian.feats.map(f => f.name)), ['Original feature']);
  assert.equal(await page.evaluate(() => RACE_LIB.Elf.source), 'PHB');
  assert.equal(await page.evaluate(() => BACKGROUND_LIB.Acolyte.source), 'PHB');
  assert.equal(await page.evaluate(() => SNAPSHOT.count), 7);

  // Text-selection drags in Firefox have Text targets, not Elements.
  await page.evaluate(() => {
    for (const selector of ['#char-tabs', '#skill-rows', 'label']) {
      const host = document.querySelector(selector);
      if (!host) throw new Error("Missing drag test target: " + selector);
      const text = document.createTextNode('drag selection'); host.append(text);
      text.dispatchEvent(new Event('dragstart', { bubbles: true })); text.remove();
    }
    openCreator();
  });
  await page.locator('#cr-race').fill('Moon');
  await page.waitForFunction(() => document.querySelectorAll('.combo-child').length === 2);
  assert.deepEqual(await page.locator('.combo-opt').allTextContents().then(a => a.map(s => s.trim().replace(/^[▾▸]\s*/, ''))), ['Elf', 'Moon', 'Sylph', 'Moon']);
  await page.locator('.combo-child').first().click();
  assert.equal(await page.locator('#cr-race').inputValue(), 'Elf');
  assert.equal(await page.locator('#cr-subrace').inputValue(), 'Moon');
  assert.equal(await page.locator('.combo-panel').count(), 0);
  await page.locator('#cr-race').fill('High Elf');
  await page.waitForFunction(() => document.querySelector('.combo-child')?.textContent === 'High');
  await page.locator('#cr-race').press('ArrowDown');
  await page.locator('#cr-race').press('ArrowDown');
  await page.locator('#cr-race').press('Enter');
  assert.equal(await page.locator('#cr-subrace').inputValue(), 'High');
  await page.locator('#cr-race').fill('');
  await page.locator('.combo-expand[aria-label="Expand Elf"]').click();
  await page.locator('.combo-child').filter({ hasText: 'Moon' }).click();
  assert.equal(await page.locator('#cr-subrace').inputValue(), 'Moon');
  await page.locator('#cr-race').fill('Elf');
  await page.locator('.combo-opt').filter({ has: page.locator('.combo-expand') }).click();
  assert.equal(await page.locator('#cr-subrace').inputValue(), '');

  // Clicking the backdrop or pressing Escape cannot discard a draft.
  await page.locator('[data-crstep="5"]').click();
  await page.locator('#cr-name').fill('Keep this draft');
  await page.locator('#creator-modal').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#cr-name').inputValue(), 'Keep this draft');
  const box = await page.locator('#creator-modal .modal-box').boundingBox();
  const tabs = await page.locator('#cr-stepper').boundingBox();
  for (const step of [1, 2, 3, 4, 5, 6]) {
    await page.locator(`[data-crstep="${step}"]`).click();
    assert.deepEqual(await page.locator('#creator-modal .modal-box').boundingBox(), box);
    assert.deepEqual(await page.locator('#cr-stepper').boundingBox(), tabs);
  }
  await page.evaluate(() => {
    CREATOR.classes = [{ name: 'Barbarian', sub: '', lvl: 1 }, { name: 'Druid', sub: '', lvl: 1 }];
    goToCreatorStep(2);
  });
  assert.match(await page.locator('#cr-body').innerText(), /STR 13/);
  assert.match(await page.locator('#cr-body').innerText(), /WIS 13/);
  assert(!/not in your data|PHB p\d|\u00b7|\u2014/.test(await page.locator('#cr-body').innerText()));
  await page.locator('[data-crstep="1"]').click();
  await page.locator('.cr-sources summary').click();
  assert.equal(await page.locator('[data-src="PHB"]').innerText(), "Player's Handbook (2014)");
  assert.equal(await page.locator('[data-src="PHB"]').getAttribute('title'), null);
  assert.deepEqual(await page.locator('#creator-modal .modal-box').boundingBox(), box);

  await page.evaluate(() => { CREATOR.background = 'Acolyte'; goToCreatorStep(CR_STEP.desc); });
  assert.equal(await page.locator('[data-bgkind="languages"]').count(), 2);
  assert.deepEqual(await page.locator('[data-bgkind="languages"]').first().locator('option').allTextContents(), ['- choose -', 'Common', 'Elvish']);
  await page.locator('[data-bgkind="languages"]').nth(0).selectOption('Common');
  await page.locator('[data-bgkind="languages"]').nth(1).selectOption('Elvish');
  assert.deepEqual(await page.evaluate(() => creatorBuildState().proficiencies.languages), ['Common', 'Elvish']);
  await page.evaluate(() => { CREATOR.background = 'Artisan'; CREATOR.bgChoices = {}; renderCreator(); });
  await page.locator('[data-bgkind="tools"]').selectOption("Carpenter's Tools");
  assert.deepEqual(await page.evaluate(() => creatorBuildState().proficiencies.tools), ["Carpenter's Tools"]);
  await page.locator('#cr-custom-bg').check();
  assert.deepEqual(await page.evaluate(() => comboOptionsOf(document.querySelector('.cr-bgtool'))), ['Abyssal', "Carpenter's Tools", 'Common', 'Disguise Kit', 'Elvish']);
  await page.evaluate(() => { CREATOR.bgTools = ['Elvish', 'Disguise Kit']; });
  assert.deepEqual(await page.evaluate(() => creatorBuildState().proficiencies), { weapons: [], tools: ['Disguise Kit'], languages: ['Elvish'] });
  // A race that grants a feat (Variant Human, Custom Lineage) asks which one in step 1, and hands it
  // to the built character under the same fkey the Features module reads back — one slot seen twice
  // rather than two places a feat can hide. Injected straight into the libraries rather than through
  // the folder snapshot, so the counts and option lists asserted above stay as they were.
  await page.evaluate(() => {
    RACE_LIB['Custom Lineage'] = { name: 'Custom Lineage', source: 'TCE', ability: [], size: ['M'], speed: 30, subs: {},
      entries: [{ name: 'Feat', source: 'TCE', text: 'You gain one feat of your choice.' }] };
    RACE_LIB.Halfling = { name: 'Halfling', source: 'PHB', ability: [], size: ['S'], speed: 25, subs: {},
      entries: [{ name: 'Lucky', source: 'PHB', text: 'Reroll a 1.' }] };
    FEAT_LIB.Alert = { name: 'Alert', source: 'PHB', text: '+5 initiative.' };
    CREATOR.race = 'Custom Lineage'; CREATOR.subrace = ''; CREATOR.raceFeats = {};
    goToCreatorStep(1);
  });
  assert.equal(await page.locator('[id^="cr-racefeat-"]').count(), 1);
  assert.match(await page.evaluate(() => creatorStepBlockerFor(1)), /Choose the feat your race grants/);
  await page.evaluate(() => { CREATOR.raceFeats.Feat = 'Alert'; renderCreator(); });
  assert.equal(await page.evaluate(() => creatorStepBlockerFor(1)), '');
  assert.deepEqual(await page.evaluate(() => creatorBuildState().featChoices), { 'race||Custom Lineage||Feat': 'Alert' });
  // A race that grants no feat gets no picker and no blocker.
  await page.evaluate(() => { CREATOR.race = 'Halfling'; CREATOR.raceFeats = {}; renderCreator(); });
  assert.equal(await page.locator('[id^="cr-racefeat-"]').count(), 0);
  assert.equal(await page.evaluate(() => creatorStepBlockerFor(1)), '');
  assert.deepEqual(await page.evaluate(() => creatorBuildState().featChoices), {});

  await page.locator('#cr-close').click();
  assert.equal(await page.locator('#creator-modal').isVisible(), false);
  assert.equal(await page.locator('.combo-panel').count(), 0);
  console.log('Creator: persistent folder data, 2014 records, nested race search, mouse/keyboard selection, background choices, racial feat grants, fixed dialog, deliberate close, full book names, and text drags passed.');
};

