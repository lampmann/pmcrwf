const assert = require('node:assert/strict');

/* The HP bar, defence checklists, counter layout, exhaustion rows, roll-mode badges and Level Up
   multiclass proficiencies. Needs no vendor data: the one class record is injected. */
module.exports = async function checkSheetUi(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#class-rows tr').forEach(t => t.remove());
    addClassRow({ name: 'Fighter', sub: '', lvl: 5 });
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(a => { document.getElementById('score-' + a).value = 14; });
    recompute();
    const cur = document.getElementById('hp-cur'); cur.value = '31'; commitMath(cur);
    const temp = document.getElementById('hp-temp'); temp.value = '8'; commitMath(temp);
    recompute();
  });
  await page.locator('#hp-cur').fill('-5');
  await page.locator('#hp-cur').press('Enter');
  const hp = await page.evaluate(() => ({ cur: hpFieldValue(document.getElementById('hp-cur')), max: Number(document.getElementById('hp-max').textContent),
    fill: parseFloat(document.getElementById('hp-fill').style.width), tempEmpty: document.getElementById('hp-temp-bar').classList.contains('hp-temp-empty') }));
  assert.equal(hp.cur, 26);
  assert.equal(Math.round(hp.fill), Math.round(26 / hp.max * 100));
  assert.equal(hp.tempEmpty, false);
  const bars = await page.evaluate(() => [document.getElementById('hp-temp-bar'), document.querySelector('.hp-bar')].map(e => e.getBoundingClientRect().top));
  assert(bars[0] < bars[1], 'temp HP bar sits above the health bar');
  // Temp HP past max stacks full rows under the remainder, all the same height as the health bar.
  await page.evaluate(() => { const t = document.getElementById('hp-temp'); t.value = String(Number(document.getElementById('hp-max').textContent) * 2 + 3); commitMath(t); renderHpBar(); });
  assert.equal(await page.locator('#hp-temp-full .hp-temp-bar').count(), 2);
  const heights = await page.evaluate(() => [...document.querySelectorAll('.hp-temp-bar, .hp-bar')].map(e => e.offsetHeight));
  assert.equal(new Set(heights).size, 1);
  // A reload keeps current HP (it used to clamp to the not-yet-computed max of 0).
  await page.evaluate(() => { saveState(); });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#class-lib-autostatus').textContent.includes('loading'));
  assert.equal(await page.locator('#hp-cur').inputValue(), '26');

  await page.locator('.dd-check[data-field="def-resist"] .dd-check-btn').click();
  await page.locator('.dd-check[data-field="def-resist"] input[value="fire"]').check();
  await page.locator('.dd-check[data-field="def-resist"] input[value="cold"]').check();
  assert.equal(await page.locator('#def-resist').inputValue(), 'cold, fire');
  assert.match(await page.locator('#defenses-row').innerText(), /cold/i);
  await page.locator('h1, h2').first().click();
  assert.equal(await page.locator('.dd-check[data-field="def-resist"] input[value="fire"]').isVisible(), false);

  // Counter names sit above their controls.
  const ctr = await page.evaluate(() => { renderBoons(); const c = document.querySelector('.boon-ctr'); if (!c) return null;
    const label = c.querySelector('.boon-label').getBoundingClientRect(), box = c.querySelector('.boon-count').getBoundingClientRect(); return label.bottom <= box.top + 1; });
  if (ctr !== null) assert.equal(ctr, true);

  await page.locator('#exhaustion-effect [data-exh="3"]').click();
  assert.equal(await page.locator('#exhaustion-effect .exh-on').count(), 3);
  assert(await page.locator('.rm-badge.rm-dis').count() > 0, 'exhaustion 3 marks attack and save rolls with the disadvantage badge');
  assert.equal(await page.locator('.rm-badge.rm-dis').first().innerText(), 'D');
  await page.locator('#exhaustion-effect [data-exh="3"]').click();
  await page.evaluate(() => { const l = document.getElementById('exhaustion-level'); l.value = '0'; l.dispatchEvent(new Event('change', { bubbles: true })); recompute(); });
  assert.equal(await page.locator('.rm-badge').count(), 0);

  // Multiclassing through Level Up grants the class's multiclass proficiencies.
  await page.evaluate(() => {
    CLASS_LIB.Rogue = { name: 'Rogue', source: 'PHB', feats: [], subs: {}, mcProf: { armor: ['light'],
      skills: [{ choose: { from: ['acrobatics', 'stealth', 'deception'], count: 1 } }], toolProficiencies: [{ "thieves' tools": true }] } };
    openLevelUp();
  });
  await page.locator('#lu-target').selectOption('new');
  await page.locator('#lu-newclass').fill('Rogue');
  await page.waitForFunction(() => document.querySelector('.lu-pick'));
  assert.equal(await page.locator('#lu-confirm').isDisabled(), true);
  assert.deepEqual(await page.locator('.lu-pick option').allTextContents(), ['- choose -', 'Acrobatics', 'Deception', 'Stealth']);
  await page.locator('.lu-pick').selectOption('Stealth');
  await page.locator('#lu-confirm').click();
  assert.deepEqual(await page.evaluate(() => [$('prof-armor-light').checked, $('skillprof-stealth').checked,
    PROFICIENCIES.tools.includes("Thieves' Tools")]), [true, true, true]);
  await page.evaluate(() => { delete CLASS_LIB.Rogue; });
  console.log('Sheet UI: HP bar, defence checklists, counters, exhaustion rows, roll-mode badges and Level Up multiclass proficiencies passed.');
};
