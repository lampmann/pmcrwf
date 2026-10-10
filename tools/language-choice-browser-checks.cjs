const assert = require('node:assert/strict');
module.exports = async function checkLanguages(page) {
  await page.evaluate(() => {
    LANGUAGE_LIB = {};
    parseLanguageFile({ language: [
      { name: 'Common', source: 'PHB', type: 'standard' }, { name: 'Elvish', source: 'PHB', type: 'standard' },
      { name: 'Dwarvish', source: 'PHB', type: 'standard' },
      { name: 'Abyssal', source: 'PHB', type: 'exotic' }, { name: 'Infernal', source: 'PHB', type: 'exotic' },
      { name: 'Druidic', source: 'PHB', type: 'secret' },
    ] });
    parseRaceFile({ race: [{ name: 'Custom Lineage', source: 'TCE', languageProficiencies: [{ common: true, anyStandard: 1 }], entries: [] }] });
    BACKGROUND_LIB['Language Test'] = { name: 'Language Test', source: 'PHB', languages: [{ anyStandard: 2 }] };
    openCreator(); Object.assign(CREATOR, { race: 'Custom Lineage', subrace: '', background: 'Language Test', customBg: false, bgChoices: { skills: [], tools: [], languages: [] } });
    CREATOR.picks['langs:race'] = ['Dwarvish']; renderCreator();
  });
  const options = locator => locator.locator('option').evaluateAll(opts => opts.map(o => o.value).filter(Boolean).sort());
  const raceLanguage = page.locator('#cr-body .cr-pick[data-crkey="langs:race"]');
  assert.deepEqual(await options(raceLanguage), ['Abyssal', 'Dwarvish', 'Elvish', 'Infernal']);
  assert.equal(await raceLanguage.inputValue(), 'Dwarvish');
  await raceLanguage.selectOption('Abyssal');
  assert(await page.evaluate(() => creatorBuildState().proficiencies.languages.includes('Abyssal')));
  await page.evaluate(() => goToCreatorStep(CR_STEP.desc));
  const background = slot => page.locator('#cr-body [data-bgkind="languages"]').nth(slot);
  assert((await options(background(0))).includes('Infernal'));
  await background(0).selectOption('Infernal');
  assert(!(await options(background(1))).includes('Infernal'), 'duplicate language choices stay excluded');
  await background(1).selectOption('Elvish');
  assert.deepEqual(await page.evaluate(() => creatorBuildState().proficiencies.languages.sort()), ['Abyssal', 'Common', 'Elvish', 'Infernal']);
  assert.deepEqual(await page.evaluate(() => chooseBlocks([{ choose: { from: ['elvish', 'dwarvish'], count: 1 } }], 'languages')[0].from), ['dwarvish', 'elvish']);
  assert.deepEqual(await page.evaluate(() => proficiencyOptions('languages', 'anyExotic')), ['Abyssal', 'Infernal']);
  assert(!(await page.evaluate(() => proficiencyOptions('languages', 'anyStandard'))).includes('Druidic'));
  await page.locator('#cr-cancel').click();
  console.log('Languages: race/background exotic choices, saved language lists, duplicate exclusion, explicit lists and exotic-only restrictions passed.');
};
