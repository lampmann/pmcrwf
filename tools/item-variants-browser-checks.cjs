const assert = require('node:assert/strict');
module.exports = async function checkItemVariants(page) {
  const bases = [
    { name: 'Longsword', source: 'PHB', type: 'M', weapon: true, weight: 3, value: 1500, dmg1: '1d8', dmgType: 'S', property: ['V'] },
    { name: 'Plate Armor', source: 'PHB', type: 'HA', armor: true, weight: 65, value: 150000, ac: 18 },
    { name: 'Shield', source: 'PHB', type: 'S', weight: 6, value: 1000, ac: 2 },
    { name: 'Net', source: 'PHB', type: 'R', weapon: true, net: true, weight: 3 },
  ];
  const variants = [1, 2, 3].flatMap(n => [
    { name: `+${n} Weapon`, type: 'GV', requires: [{ weapon: true }], excludes: { net: true }, inherits: { source: 'DMG', namePrefix: `+${n} `, rarity: n === 1 ? 'uncommon' : 'rare', bonusWeapon: `+${n}`, entries: ['Bonus {=bonusWeapon} to attack and damage.'] } },
    { name: `+${n} Armor`, type: 'GV', requires: [{ armor: true }], inherits: { source: 'DMG', namePrefix: `+${n} `, rarity: 'rare', bonusAc: `+${n}`, entries: ['Bonus {=bonusAc} to AC.'] } },
    { name: `+${n} Shield (*)`, type: 'GV', requires: [{ type: 'S' }], inherits: { source: 'DMG', namePrefix: `+${n} `, rarity: 'uncommon', bonusAc: `+${n}` } },
  ]);
  const result = await page.evaluate(async ({ bases, variants }) => {
    const originalFetch = dataFetch;
    resetItemLibrary();
    dataFetch = async url => ({ ok: true, json: async () => url.endsWith('items-base.json') ? { baseitem: bases } : url.endsWith('magicvariants.json') ? { magicvariant: variants } : {} });
    try { await autoLoadItems(); } finally { dataFetch = originalFetch; }
    renderItemLibrary();
    const records = [1, 2, 3].flatMap(n => ['Longsword', 'Plate Armor', 'Shield'].map(name => findLibItemByName(`+${n} ${name}`)));
    const weapon = findLibItemByName('+1 Longsword');
    const noNet = !findLibItemByName('+1 Net');
    const group = findLibItemByName('+1 Weapon');
    saveItemLib(); resetItemLibrary(); loadItemLib();
    const cached = !!findLibItemByName('+3 Plate Armor');
    // Templates can arrive before their bases, even in a later session.
    resetItemLibrary(); mergeItems(parseItemArrays({ magicvariant: variants })); saveItemLib();
    resetItemLibrary(); loadItemLib(); mergeItems(parseItemArrays({ baseitem: bases }));
    const separate = !!findLibItemByName('+2 Longsword');
    const count = ITEM_LIB.length;
    mergeItems(parseItemArrays({ baseitem: bases, magicvariant: variants }));
    const deduped = count === ITEM_LIB.length;
    applyState({ fields: { 'score-dex': '10' }, classes: [], items: [
      { name: '+2 Plate Armor', qty: 1, eq: true, slot: 'armor' },
      { name: '+3 Shield', qty: 1, eq: true, slot: 'offHand' },
    ] });
    const ac = armorClassAuto();
    const newer = { ...variants[0], inherits: { ...variants[0].inherits, source: 'XDMG' } };
    mergeItems(parseItemArrays({ magicvariant: [newer] }));
    const classic = findLibItemByName('+1 Longsword').source;
    const was2024 = USE_2024; USE_2024 = true;
    try { resetItemLibrary(); mergeItems(parseItemArrays({ baseitem: bases, magicvariant: [variants[0], newer] })); }
    finally { USE_2024 = was2024; }
    const modern = findLibItemByName('+1 Longsword').source;
    resetItemLibrary();
    const reset = ITEM_BASE_RECORDS.length === 0 && ITEM_MAGIC_VARIANTS.length === 0;
    return { names: records.map(i => i?.name), weapon, noNet, group: group.groupItems, cached, separate, deduped, ac, classic, modern, reset };
  }, { bases, variants });
  assert.equal(result.names.filter(Boolean).length, 9);
  assert.equal(result.weapon.weight, 3);
  assert.equal(result.weapon.dmg1, '1d8');
  assert.equal(result.weapon.bonusWeapon, 1);
  assert.equal(result.weapon.valueGp, 350); // Never price magic gear at its mundane value.
  assert.match(result.weapon.text, /Bonus \+1 to attack/);
  assert.equal(result.weapon.category, 'Specific Variant');
  assert(result.noNet && result.cached && result.separate && result.deduped && result.reset);
  assert.deepEqual(result.group, ['+1 Longsword']);
  assert.equal(result.ac, 25); // Plate 18 +2, shield 2 +3.
  assert.equal(result.classic, 'DMG'); assert.equal(result.modern, 'XDMG');
  console.log('Bonus equipment: auto-load templates, +1/+2/+3 weapon/armor/shield stats, prices, descriptions, groups, exclusions, separate imports, cache, reset, edition selection and equipped AC passed.');
};
