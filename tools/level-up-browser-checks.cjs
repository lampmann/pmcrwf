const assert = require('node:assert/strict');
module.exports = async function checkAdvancement(page) {
  await page.evaluate(() => {
    CLASS_LIB = {
      Wizard: { name: 'Wizard', source: 'PHB', hd: 'd6', subLevel: 2, feats: [], subs: { Evocation: { name: 'School of Evocation', shortName: 'Evocation', feats: [{ name: 'Sculpt Spells', level: 2, source: 'PHB', text: 'Protect your allies.' }] } } },
      Fighter: { name: 'Fighter', source: 'PHB', hd: 'd10', subLevel: 3, feats: [{ name: 'Ability Score Improvement', level: 4, source: 'PHB' }], subs: {} },
      Warlock: { name: 'Warlock', source: 'PHB', hd: 'd8', feats: [], subs: {}, optProg: [{ name: 'Invocations', featureType: ['EI'], progression: { 2: 2 } }] },
    };
    OPTFEATURE_LIB = Object.fromEntries(['Invocation A', 'Invocation B'].map(name => [name, { name, types: ['EI'], minLevel: 2, source: 'PHB', text: 'An invocation.' }]));
    SPELL_LIB = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(name => ({ name, level: 1, source: 'PHB', classes: ['Wizard', 'Warlock'], text: 'Spell.' }));
    RACE_LIB = {}; SUBRACE_LIB = {}; BACKGROUND_LIB = {}; FEAT_LIB = {};
    applyState({ fields: { 'char-name': 'Advancement', 'score-int': '16', 'score-con': '14' }, classes: [{ name: 'Wizard', lvl: 1 }], spells: ['A', 'B', 'C', 'D', 'E', 'F'].map(name => ({ name, cls: 'Wizard', lvl: 1, prep: false })) });
    openLevelUp();
  });
  assert.equal(await page.locator('#btn-add-class').count(), 0);
  assert(await page.locator('#lu-confirm').isDisabled());
  await page.locator('.lu-spell[data-list="spells"][value="G"]').check();
  await page.locator('#lu-subclass').selectOption('Evocation');
  assert(await page.locator('.lu-spell[data-list="spells"][value="G"]').isChecked(), 'changing subclass keeps other draft selections');
  assert.match(await page.locator('#lu-options').innerText(), /Sculpt Spells/);
  await page.locator('.lu-spell[data-list="spells"][value="G"]').check();
  await page.locator('.lu-spell[data-list="spells"][value="H"]').check();
  await page.locator('.lu-spell[data-list="prepared"][value="G"]').check();
  assert(await page.locator('#lu-confirm').isEnabled());
  assert.equal(await page.evaluate(() => CHARACTER_SPELLS.length), 6, 'draft spell choices do not change the sheet');
  await page.locator('#lu-cancel').click();
  assert.deepEqual(await page.evaluate(() => getClasses().map(c => [c.lvl, c.sub])), [[1, '']]);
  assert.equal(await page.evaluate(() => CHARACTER_SPELLS.length), 6);
  await page.evaluate(() => openLevelUp());
  await page.locator('#lu-subclass').selectOption('Evocation');
  for (const name of ['G', 'H']) await page.locator(`.lu-spell[data-list="spells"][value="${name}"]`).check();
  await page.locator('.lu-spell[data-list="prepared"][value="G"]').check();
  await page.locator('#lu-confirm').click();
  assert.deepEqual(await page.evaluate(() => getClasses().map(c => [c.lvl, c.sub])), [[2, 'Evocation']]);
  assert.equal(await page.evaluate(() => CHARACTER_SPELLS.length), 8);
  assert(await page.evaluate(() => CHARACTER_SPELLS.find(s => s.name === 'G').prep));
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'ASI', 'score-con': '14' }, classes: [{ name: 'Fighter', lvl: 3 }] });
    openLevelUp();
  });
  assert(await page.locator('#lu-confirm').isDisabled());
  assert.equal(await page.locator('#lu-options details summary').filter({ hasText: /^Ability Score Improvement$/ }).count(), 0);
  await page.locator('.lu-asi[data-slot="0"]').selectOption('con');
  await page.locator('.lu-asi[data-slot="1"]').selectOption('con');
  const hpBefore = await page.evaluate(() => maxHP());
  assert(await page.locator('#lu-confirm').isEnabled());
  await page.locator('#lu-confirm').click();
  assert.equal(await page.evaluate(() => abilityScore('con')), 16);
  assert((await page.evaluate(() => maxHP())) > hpBefore + 7, 'CON increase also updates HP for previous levels');
  assert.equal(await page.evaluate(() => Object.values(ASI_CHOICES)[0].join(',')), 'con,con');
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'Invocations', 'score-cha': '14' }, classes: [{ name: 'Warlock', lvl: 1 }], spells: ['A', 'B'].map(name => ({ name, cls: 'Warlock', lvl: 1 })) });
    openLevelUp();
  });
  await page.locator('.lu-opt[data-slot="0"]').selectOption('Invocation A');
  await page.locator('.lu-opt[data-slot="1"]').selectOption('Invocation B');
  await page.locator('.lu-spell[data-list="spells"][value="C"]').check();
  assert(await page.locator('#lu-confirm').isEnabled());
  await page.locator('#lu-confirm').click();
  assert.deepEqual(await page.evaluate(() => Object.values(OPTFEATURE_CHOICES)[0]), ['Invocation A', 'Invocation B']);
  assert.equal(await page.evaluate(() => CHARACTER_SPELLS.length), 3);
  assert.equal(await page.evaluate(() => collectState().classes[0].lvl), 2);
  await page.evaluate(() => {
    FEAT_LIB.Resilient = { name: 'Resilient', source: 'PHB', text: 'Increase an ability and gain save proficiency.' };
    applyState({ fields: { 'char-name': 'Feat test', 'score-con': '14' }, classes: [{ name: 'Fighter', lvl: 3 }] });
    openLevelUp();
  });
  assert.equal(await page.locator('.lu-feat').count(), 0);
  await page.locator('.lu-asimode').selectOption('feat');
  assert.equal(await page.locator('.lu-asi').count(), 0);
  assert(await page.locator('#lu-confirm').isDisabled());
  await page.locator('.lu-feat').fill('Resilient');
  await page.locator('.lu-asimode').selectOption('asi');
  assert.equal(await page.locator('.lu-feat').count(), 0);
  assert.equal(await page.locator('.lu-asi').count(), 2);
  assert.equal(await page.evaluate(() => Object.values(luDraft().asiFeats)[0]), '');
  await page.locator('.lu-asimode').selectOption('feat');
  await page.locator('.lu-feat').fill('Resilient');
  await page.locator('#lu-options .cr-effchoice[data-choice="ability"]').selectOption('con');
  assert(await page.locator('#lu-confirm').isEnabled());
  await page.locator('#lu-confirm').click();
  assert.equal(await page.evaluate(() => abilityScore('con')), 15);
  assert.equal(await page.evaluate(() => Object.values(FEAT_CHOICES)[0]), 'Resilient');
  await page.evaluate(() => {
    parseRaceFile({ race: [{ name: 'Advancement Elf', source: 'PHB', entries: [{ name: 'Training', entries: ['Choose a skill at level 3.'] }] }] });
    EFFECTS_DB['race|advancement elf|training'] = {
      choices: [{ id: 'skill', kind: 'pick', n: 1, options: ['stealth', 'perception'], when: { minLevel: 3 } }],
      effects: [{ target: 'skill-{choice:skill}', op: 'prof', value: 1, when: { minLevel: 3 } }],
    };
    applyState({ fields: { 'char-name': 'Racial advancement', 'char-race': 'Advancement Elf' }, classes: [{ name: 'Fighter', lvl: 2 }] });
    openLevelUp();
  });
  assert(await page.locator('#lu-confirm').isDisabled());
  await page.locator('#lu-options .cr-effchoice[data-choice="skill"]').selectOption('stealth');
  assert.equal(await page.evaluate(() => Object.keys(EFFECT_CHOICES).length), 0);
  await page.locator('#lu-confirm').click();
  assert.equal(await page.evaluate(() => skillProfMult('stealth')), 1);
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'Cap' }, classes: [{ name: 'Fighter', lvl: 20 }] }); openLevelUp();
  });
  assert(await page.locator('#lu-confirm').isDisabled());
  assert.match(await page.locator('#lu-option-error').innerText(), /Maximum total level/);
  await page.locator('#lu-cancel').click();
  await page.evaluate(() => {
    applyState({ fields: { 'char-name': 'Racial advancement', 'char-race': 'Advancement Elf' }, classes: [{ name: 'Fighter', lvl: 3 }], effectChoices: { [raceFkey('Advancement Elf', 'Training')]: { skill: 'stealth' } } });
    openLevelUp();
  });
  await page.setViewportSize({ width: 500, height: 240 });
  assert(await page.locator('#lu-confirm').isVisible());
  assert(await page.evaluate(() => {
    const b = document.getElementById('lu-body'), confirm = document.getElementById('lu-confirm').getBoundingClientRect();
    return b.scrollHeight > b.clientHeight && confirm.bottom <= innerHeight;
  }), 'choices scroll while confirmation stays inside the viewport');
  await page.evaluate(() => {
    const b = document.getElementById('lu-body'); b.scrollTop = b.scrollHeight;
  });
  assert(await page.evaluate(() => {
    const box = document.querySelector('#levelup-modal .modal-box').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('#levelup-modal .modal-actions button')].map(b => b.getBoundingClientRect());
    const body = document.getElementById('lu-body').getBoundingClientRect();
    return buttons.every(b => b.top >= body.bottom && b.bottom < box.bottom && b.bottom < innerHeight);
  }), 'entire footer stays below the scroll area and inside the dialog');
  await page.locator('#lu-cancel').click();
  await page.setViewportSize({ width: 1280, height: 720 });
  const saved = await page.evaluate(() => collectState());
  await page.evaluate(state => applyState(state), saved);
  assert.equal(await page.evaluate(() => skillProfMult('stealth')), 1);
  await page.evaluate(() => {
    openCreator(); CREATOR.classes = [{ name: 'Fighter', lvl: 4, sub: '' }]; goToCreatorStep(3);
  });
  assert.equal(await page.locator('.cr-asifeat').count(), 0);
  await page.locator('.cr-asimode').selectOption('feat');
  assert.equal(await page.locator('.cr-asiscore').count(), 0);
  await page.locator('.cr-asifeat').fill('Resilient');
  await page.locator('.cr-asimode').selectOption('asi');
  assert.equal(await page.locator('.cr-asiscore').count(), 2);
  await page.locator('#cr-cancel').click();
  assert.equal(await page.evaluate(() => stripTags('Left \u2014 right \u00b7 next')), 'Left - right | next');
  console.log('Level Up: cancellable drafts, Wizard learning/preparation, subclasses, ASIs with retroactive CON HP, invocation slots, known spells, half-feat choices and level-gated racial choices passed.');
};
