const assert = require('node:assert/strict');
module.exports = async function checkExpertise(page) {
  await page.evaluate(() => {
    CLASS_LIB.Ranger = { name: 'Ranger', source: 'PHB', hd: 'd10', feats: [{ name: 'Deft Explorer', level: 1, source: 'TCE', text: 'Choose a proficient skill for Canny.' }], subs: {},
      startProf: { skills: [{ choose: { from: ['stealth', 'perception', 'athletics', 'survival'], count: 3 } }] } };
    parseRaceFile({ race: [{ name: 'Expertise Test Elf', source: 'PHB', skillProficiencies: [{ insight: true }], entries: [] }] });
    openCreator();
    Object.assign(CREATOR, { classes: [{ name: 'Ranger', sub: '', lvl: 1 }], race: 'Expertise Test Elf', subrace: '', customBg: true, bgSkills: ['History', 'Arcana'], picks: { 'skills:Ranger': ['stealth', 'perception', 'athletics'] } });
    goToCreatorStep(2);
  });
  const canny = page.locator('#cr-body .cr-effchoice[data-choice="canny"]');
  const options = locator => locator.locator('option').evaluateAll(opts => opts.map(o => o.value).filter(Boolean).sort());
  assert.deepEqual(await options(canny), ['arcana', 'athletics', 'history', 'insight', 'perception', 'stealth']);
  await canny.selectOption('stealth');
  assert.equal(await canny.inputValue(), 'stealth');
  assert.equal(await page.evaluate(() => creatorChoiceBlocker(2)), '');
  await page.evaluate(() => {
    CREATOR.picks['skills:Ranger'] = ['survival', 'perception', 'athletics']; renderCreator();
  });
  assert(!(await options(canny)).includes('stealth'));
  assert.match(await page.evaluate(() => creatorChoiceBlocker(2)), /Deft Explorer/);
  await canny.selectOption('athletics');
  await page.locator('#cr-cancel').click();
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'Canny test', 'skillprof-stealth': true, 'skillprof-perception': true, 'skillprof-athletics': true }, classes: [{ name: 'Ranger', lvl: 1 }] });
    openLevelUp();
  });
  const levelChoice = page.locator('#lu-body .cr-effchoice[data-choice="canny"]');
  assert.deepEqual(await options(levelChoice), ['athletics', 'perception', 'stealth']);
  await levelChoice.selectOption('perception');
  await page.locator('#lu-confirm').click();
  assert.equal(await page.evaluate(() => skillProfMult('perception')), 2);
  assert.deepEqual(await options(page.locator('#class-feat-results .eff-choice[data-choice="canny"]')), ['athletics', 'perception', 'stealth']);
  await page.evaluate(() => {
    CLASS_LIB.Rogue = { name: 'Rogue', source: 'PHB', hd: 'd8', feats: [{ name: 'Expertise', level: 1, source: 'PHB' }], subs: {} };
    openCreator(); Object.assign(CREATOR, { classes: [{ name: 'Rogue', sub: '', lvl: 1 }], race: '', subrace: '', customBg: true, bgSkills: [], picks: { 'skills:Rogue': ['stealth', 'perception'] } }); goToCreatorStep(2);
  });
  assert.deepEqual(await options(page.locator('#cr-body .cr-effchoice[data-choice="exp1a"]')), ['perception', 'stealth']);
  await page.locator('#cr-cancel').click();
  await page.evaluate(() => {
    FEAT_LIB['Skill Expert'] = { name: 'Skill Expert', source: 'TCE', text: '' };
    CLASS_LIB.Ranger.feats.push({ name: 'Ability Score Improvement', level: 4, source: 'PHB' });
    openCreator(); Object.assign(CREATOR, { classes: [{ name: 'Ranger', sub: '', lvl: 4 }], race: '', subrace: '', customBg: true, bgSkills: [], picks: { 'skills:Ranger': ['stealth', 'perception', 'athletics'] } });
    CREATOR.asiFeats[fkeyFor('Ranger', 'Ability Score Improvement', 4)] = 'Skill Expert'; goToCreatorStep(3);
  });
  const gainProf = page.locator('#cr-body .cr-effchoice[data-choice="skillprof"]');
  assert(!(await options(gainProf)).includes('stealth'), 'new proficiency still excludes an existing skill');
  await gainProf.selectOption('arcana');
  const gainExp = page.locator('#cr-body .cr-effchoice[data-choice="skillexp"]');
  assert.deepEqual(await options(gainExp), ['arcana', 'athletics', 'perception', 'stealth']);
  await gainExp.selectOption('arcana');
  assert.equal(await gainExp.inputValue(), 'arcana', 'Skill Expert can improve the skill it just granted');
  await page.locator('#cr-cancel').click();
  console.log('Expertise: Canny class/race/background eligibility, stale choices, Level Up, Features, Rogue and Skill Expert proficiency versus expertise filtering passed.');
};
