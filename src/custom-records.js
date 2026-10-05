/* Custom records live in the character, so library reloads cannot erase them. */
let customItemEditing = null, customCreatureEditing = null;
function customRecordField(label, name, value = '', type = 'text', attrs = '') {
  return `<label>${escapeHtml(label)} <input name="${name}" type="${type}" value="${escapeHtml(String(value))}" ${attrs}></label>`;
}
function customRecordText(label, name, value = '') {
  return `<label>${escapeHtml(label)} <textarea name="${name}" rows="3">${escapeHtml(value)}</textarea></label>`;
}
function customRecordButtons(label) {
  return `<div><button type="submit">${label}</button> <button type="button" data-custom-cancel>Cancel</button></div>`;
}
function closeCustomRecordEditors() {
  ['custom-item-editor', 'custom-creature-editor'].forEach(id => { if ($(id)) { $(id).hidden = true; $(id).innerHTML = ''; } });
  customItemEditing = null; customCreatureEditing = null;
}
function openCustomItem(index = null) {
  customItemEditing = index;
  const item = index === null ? null : CHARACTER_ITEMS[index], record = item?.custom || {};
  const form = $('custom-item-editor');
  form.innerHTML = '<b>Custom Item</b>' + customRecordField('Name', 'name', item?.name || '', 'text', 'required maxlength="200"') +
    customRecordField('Quantity', 'qty', item?.qty ?? 1, 'number', 'min="0" step="1" required') +
    customRecordField('Weight each (lb)', 'weight', record.weight ?? 0, 'number', 'min="0" step="any" required') +
    customRecordField('Value each (gp)', 'value', record.valueGp ?? 0, 'number', 'min="0" step="any" required') +
    customRecordField('Type', 'type', record.type || '') +
    `<label><input name="attunement" type="checkbox"${record.reqAttune ? ' checked' : ''}> Requires attunement</label>` +
    customRecordText('Description', 'description', record.text || '') + customRecordButtons('Save item');
  form.hidden = false; form.elements.name.focus();
}
function customActionEditor(action = {}) {
  return `<fieldset class="custom-action-row"><legend>Trait or action</legend>
    <label>Kind <select name="action-kind">${['trait', 'action', 'bonus', 'reaction', 'legendary'].map(kind => `<option${kind === (action.kind || 'action') ? ' selected' : ''}>${kind}</option>`).join('')}</select></label>` +
    customRecordField('Name', 'action-name', action.name || '', 'text', 'required') +
    customRecordField('Attack bonus (optional)', 'action-hit', action.hit ?? '', 'text', 'pattern="[+-]?[0-9]+"') +
    customRecordField('Damage dice (optional)', 'action-damage', action.damage || '', 'text', 'placeholder="1d6+3"') +
    customRecordText('Description', 'action-description', action.description || '') +
    '<button type="button" data-custom-action-remove>Remove action</button></fieldset>';
}
function openCustomCreature(id = null) {
  customCreatureEditing = id;
  const companion = id === null ? null : COMPANIONS.find(c => c.id === id), raw = companion?.customRaw || {};
  const form = $('custom-creature-editor');
  form.innerHTML = '<b>Custom Stat Block</b>' + customRecordField('Name', 'name', raw.name || '', 'text', 'required maxlength="200"') +
    `<label>Size <select name="size">${Object.entries({ T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' }).map(([key, label]) => `<option value="${key}"${key === (raw.size?.[0] || 'M') ? ' selected' : ''}>${label}</option>`).join('')}</select></label>` +
    customRecordField('Creature type', 'type', raw.type || 'humanoid') +
    customRecordField('Armor Class', 'ac', raw.ac?.[0] ?? 10, 'number', 'min="0" required') +
    customRecordField('Hit Points', 'hp', raw.hp?.average ?? 10, 'number', 'min="1" required') +
    customRecordField('Speed (ft)', 'speed', raw.speed?.walk ?? 30, 'number', 'min="0" required') +
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => customRecordField(ab.toUpperCase(), ab, raw[ab] ?? 10, 'number', 'min="1" max="30" required')).join('') +
    customRecordField('Saving throws (e.g. str +3, dex +2)', 'saves', Object.entries(raw.save || {}).map(([key, value]) => `${key} ${value}`).join(', ')) +
    customRecordField('Skills (e.g. perception +4)', 'skills', Object.entries(raw.skill || {}).map(([key, value]) => `${key} ${value}`).join(', ')) +
    customRecordField('Senses', 'senses', (raw.senses || []).join(', ')) + customRecordField('Languages', 'languages', (raw.languages || []).join(', ')) +
    customRecordField('Damage resistances', 'resist', (raw.resist || []).join(', ')) + customRecordField('Damage immunities', 'immune', (raw.immune || []).join(', ')) +
    customRecordField('Damage vulnerabilities', 'vulnerable', (raw.vulnerable || []).join(', ')) + customRecordField('Condition immunities', 'conditionImmune', (raw.conditionImmune || []).join(', ')) +
    customRecordField('Challenge rating', 'cr', raw.cr || '') +
    '<div id="custom-creature-actions">' + (raw._editorActions || []).map(customActionEditor).join('') + '</div>' +
    '<button type="button" data-custom-action-add>Add trait or action</button>' + customRecordButtons('Save stat block');
  form.hidden = false; form.elements.name.focus();
}
function customBonusMap(text) {
  const entries = text.split(',').map(part => part.trim()).filter(Boolean).map(part => {
    const match = /^([a-z ]+)\s+([+-]?\d+)$/i.exec(part);
    if (!match) throw new Error('Use a name and signed bonus, such as perception +4.');
    return [match[1].trim().toLowerCase(), match[2]];
  });
  return Object.fromEntries(entries);
}
document.addEventListener('DOMContentLoaded', () => {
  $('custom-item-add').addEventListener('click', () => openCustomItem());
  $('custom-creature-add').addEventListener('click', () => openCustomCreature());
  document.addEventListener('click', event => {
    const editItem = event.target.closest('[data-custom-item-edit]');
    if (editItem) openCustomItem(Number(editItem.dataset.customItemEdit));
    const editCreature = event.target.closest('[data-custom-creature-edit]');
    if (editCreature) openCustomCreature(editCreature.dataset.customCreatureEdit);
    if (event.target.closest('[data-custom-cancel]')) closeCustomRecordEditors();
    if (event.target.closest('[data-custom-action-add]')) $('custom-creature-actions').insertAdjacentHTML('beforeend', customActionEditor());
    const remove = event.target.closest('[data-custom-action-remove]'); if (remove) remove.closest('fieldset').remove();
  });
  $('custom-item-editor').addEventListener('submit', event => {
    event.preventDefault(); const form = event.target, data = new FormData(form), name = data.get('name').trim(); if (!name) return;
    const custom = { name, source: 'Custom', type: data.get('type'), weight: Number(data.get('weight')), valueGp: Number(data.get('value')), text: data.get('description'), reqAttune: data.has('attunement') ? 'requires attunement' : '' };
    if (customItemEditing === null) CHARACTER_ITEMS.push({ name, custom, qty: Number(data.get('qty')), eq: false, attuned: false, slot: '' });
    else { const item = CHARACTER_ITEMS[customItemEditing]; Object.assign(item, { name, custom, qty: Number(data.get('qty')) }); if (!custom.reqAttune) item.attuned = false; }
    closeCustomRecordEditors(); renderItemList(); if (typeof renderEquipSlots === 'function') renderEquipSlots(); recompute(); scheduleSave();
  });
  $('custom-creature-editor').addEventListener('submit', event => {
    event.preventDefault(); const form = event.target, data = new FormData(form), name = data.get('name').trim(); if (!name) return;
    let saves, skills;
    try { saves = customBonusMap(data.get('saves')); skills = customBonusMap(data.get('skills')); }
    catch (error) { let message = form.querySelector('.custom-record-error'); if (!message) { message = document.createElement('p'); message.className = 'custom-record-error'; form.prepend(message); } message.textContent = error.message; return; }
    const raw = { name, source: 'Custom', size: [data.get('size')], type: data.get('type'), ac: [Number(data.get('ac'))], hp: { average: Number(data.get('hp')) }, speed: { walk: Number(data.get('speed')) }, save: saves, skill: skills, cr: data.get('cr'), _editorActions: [] };
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ab => { raw[ab] = Number(data.get(ab)); });
    ['senses', 'languages', 'resist', 'immune', 'vulnerable', 'conditionImmune'].forEach(key => { raw[key] = data.get(key).split(',').map(value => value.trim()).filter(Boolean); });
    form.querySelectorAll('.custom-action-row').forEach(row => {
      const get = key => row.querySelector(`[name="action-${key}"]`).value;
      const action = { kind: get('kind'), name: get('name'), hit: get('hit'), damage: get('damage'), description: get('description') };
      raw._editorActions.push(action);
      const attack = action.hit !== '' ? `{@atk mw} {@hit ${action.hit}} to hit. ` : '';
      const damage = action.damage ? `Hit: {@damage ${action.damage}} damage. ` : '';
      (raw[action.kind] || (raw[action.kind] = [])).push({ name: action.name, entries: [attack + damage + action.description] });
    });
    if (customCreatureEditing === null) COMPANIONS.push({ id: 'custom-' + crypto.randomUUID(), key: name + '|Custom', customRaw: raw, note: '', spellLevel: '', maxHpOverride: '', tokens: [{ hp: raw.hp.average }] });
    else { const companion = COMPANIONS.find(c => c.id === customCreatureEditing); companion.customRaw = raw; companion.key = name + '|Custom'; companion.tokens.forEach(token => { if (token.hp != null) token.hp = Math.min(token.hp, Number(companion.maxHpOverride) || raw.hp.average); }); }
    closeCustomRecordEditors(); renderCompanions(); scheduleSave();
  });
});
