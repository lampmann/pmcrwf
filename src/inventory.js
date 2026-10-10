/* ============================================================
   INVENTORY MODULE - the character's owned items, rendered like the
   Spellcasting module: expandable lines, click a name to show/hide its
   description (looked up from the Equipment Library by name), with an
   "x" to remove. Library items resolve their details by name; custom items
   keep editable details in their own `custom` record. Library additions use
   addCharacterItem() - same shape as addCharacterSpell() in
   spellcasting.js. CHARACTER_ITEMS is persisted as part of the
   character (see persistence.js), same as CHARACTER_SPELLS.
   ============================================================ */
// [{name, qty, eq, attuned, slot}] - `slot` names the body slot it occupies (src/equip-slots.js);
// `eq` remains the source of truth for "equipped", since AC and the Attacks module read it.
let CHARACTER_ITEMS = [];

function addCharacterItem(name) {
  CHARACTER_ITEMS.push({ name, qty: 1, eq: false, attuned: false, slot: "" });
  renderItemList(); recompute(); scheduleSave();
}
function buyCharacterItem(name, record = null) {
  const lib = record || findLibItemByName(name);
  if (!lib || !recordItemPurchase(name, 1, itemValueGp(lib))) return;
  addCharacterItem(name);
}
function buyMoreItem(index) {
  const item = CHARACTER_ITEMS[index]; if (!item) return;
  const resolved = resolvedItem(item);
  const price = item.custom ? item.custom.valueGp : resolved.lib ? itemValueGp(resolved.lib) : "";
  if (!recordItemPurchase(item.name, 1, price)) return;
  item.qty += 1; renderItemList(); recompute(); scheduleSave();
}
let sellingItem = null;
function closeItemSale() {
  sellingItem = null;
  const form = $("item-sale-editor");
  if (form) { form.hidden = true; form.innerHTML = ""; }
}
function openItemSale(index) {
  const item = CHARACTER_ITEMS[index]; if (!item || !(item.qty > 0)) return;
  closeCustomRecordEditors();
  sellingItem = item;
  const r = resolvedItem(item);
  const price = item.custom ? item.custom.valueGp : r.lib ? itemValueGp(r.lib) : "";
  const form = $("item-sale-editor");
  form.innerHTML = `<b>Sell ${escapeHtml(item.name)}</b>` +
    customRecordField("Quantity", "qty", Math.min(1, item.qty), "number", `min="0" max="${item.qty}" step="any" required`) +
    customRecordField("Price each (gp)", "price", price === "" ? "" : Number(price) / 2, "number", 'min="0" step="any" required') +
    '<div class="hint">The default sale price is half the listed value. Adjust it for your agreed price.</div>' +
    '<div><button type="submit">Sell</button> <button type="button" data-sale-cancel>Cancel</button></div>';
  form.hidden = false;
  form.elements.qty.focus(); form.elements.qty.select();
}
function sellCharacterItem(item, quantity, unitPrice) {
  const index = CHARACTER_ITEMS.indexOf(item);
  if (index < 0 || !Number.isFinite(quantity) || quantity <= 0 || quantity > item.qty ||
      !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(quantity * unitPrice)) return false;
  const proceeds = Math.round(quantity * unitPrice * 100) / 100;
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  INVENTORY_TRANSACTIONS.push({ amount: proceeds, source: "Sale: " + (quantity === 1 ? "" : quantity + " × ") + item.name, date });
  item.qty -= quantity;
  closeItemSale();
  if (item.qty === 0) removeCharacterItem(index);
  else { renderItemList(); renderEquipSlots(); recompute(); scheduleSave(); }
  renderInventoryTracker(); scheduleSave();
  return true;
}
function removeCharacterItem(idx) {
  if (typeof closeCustomRecordEditors === "function") closeCustomRecordEditors();
  CHARACTER_ITEMS.splice(idx, 1);
  renderItemList(); if (typeof renderEquipSlots === "function") renderEquipSlots();
  recompute(); scheduleSave();
}
/* Quantity is typed, so this must NOT re-render the list - that would replace the input mid-edit
   (see recomputeInventory's comment in derived.js). Only the row's own derived totals change, and
   they're patched in place. */
function setItemQty(idx, qty) {
  const it = CHARACTER_ITEMS[idx]; if (!it) return;
  it.qty = Math.max(0, Number(qty) || 0);
  const sell = document.querySelector(`.inv-sell[data-idx="${idx}"]`);
  if (sell) sell.disabled = !(it.qty > 0);
  const figures = itemRowFigures(it);
  document.querySelectorAll(`.inv-totals[data-idx="${idx}"]`).forEach(el => { el.textContent = figures[Number(el.dataset.figure)]; });
  recompute(); scheduleSave();
}
function setItemFlag(idx, key, val) {
  const it = CHARACTER_ITEMS[idx]; if (!it) return;
  it[key] = val;
  // Unticking "equipped" also empties whatever slot it was in - the checkbox and the paper doll are
  // two views of the same fact, and leaving a slot holding an unequipped item would be a lie.
  if (key === "eq" && !val) it.slot = "";
  if (key === "eq" && val && !it.slot && typeof guessSlot === "function") {
    const g = guessSlot(it.name);
    if (g && typeof itemInSlot === "function" && !itemInSlot(g)) it.slot = g;
  }
  renderItemList(); if (typeof renderEquipSlots === "function") renderEquipSlots();
  recompute(); scheduleSave();
}
function resolvedItem(it) {
  const lib = it.custom || findLibItemByName(it.name);
  return {
    ...it, lib,
    wt: lib && lib.weight !== "" ? Number(lib.weight) : 0,
    // Through itemValueGp so a house-rule price (or a worthless trinket) reaches the inventory
    // totals, not just the library's own Cost column - see item-library.js.
    val: (() => { const v = it.custom ? it.custom.valueGp : lib ? itemValueGp(lib) : ""; return v === "" ? 0 : Number(v); })(),
  };
}
function itemsTotalValue() { return CHARACTER_ITEMS.reduce((s, it) => { const r = resolvedItem(it); return s + r.qty * r.val; }, 0); }
function itemsTotalWeight() { return CHARACTER_ITEMS.reduce((s, it) => { const r = resolvedItem(it); return s + r.qty * r.wt; }, 0); }
const INVENTORY_SORT = createListSort([
  { key: "qty", label: "Qty", numeric: true, get: r => r.it.qty },
  { key: "name", label: "Item", get: r => r.it.name },
  { key: "source", label: "Source", get: r => resolvedItem(r.it).lib?.source },
  { key: "eq", label: "Equipped", numeric: true, get: r => !!r.it.eq },
  { key: "attuned", label: "Attunement", numeric: true, get: r => !!r.it.attuned },
  { key: "weight", label: "Weight each", numeric: true, get: r => resolvedItem(r.it).wt },
  { key: "value", label: "Value each", numeric: true, get: r => resolvedItem(r.it).val },
  { key: "totalWeight", label: "Total weight", numeric: true, get: r => resolvedItem(r.it).wt * r.it.qty },
  { key: "totalValue", label: "Total value", numeric: true, get: r => resolvedItem(r.it).val * r.it.qty },
]);
function renderItemList() {
  const el = $("char-item-list"); if (!el) return;
  $("attuned-count").textContent = String(CHARACTER_ITEMS.filter(it => it.attuned).length);
  if (!CHARACTER_ITEMS.length) { el.innerHTML = "<div class='hint'>no items yet - use \"+ Add Item\" above</div>"; return; }
  const rows = INVENTORY_SORT.rows(CHARACTER_ITEMS.map((it, i) => ({ it, i }))).map(({ it, i }) => {
    const r = resolvedItem(it);
    const src = r.lib ? r.lib.source : "";
    const missing = r.lib ? "" : ` <span class="hint">(not found in Equipment Library - load it to see weight/value/description)</span>`;
    const attuneBox = r.lib && r.lib.reqAttune
      ? `<label class="hint" style="margin-left:.4rem" title="${escapeHtml(r.lib.reqAttune)}"><input type="checkbox" class="inv-attuned" data-idx="${i}" ${it.attuned ? "checked" : ""}> attuned</label>` : "";
    return `<tr draggable="true" data-invdrag="${i}" aria-label="drag onto an Equipped slot above">
      <td><input type="text" inputmode="numeric" class="tiny inv-qty" data-idx="${i}" value="${it.qty}" aria-label="Quantity of ${escapeHtml(it.name)}"></td>
      <td class="inv-name"><a class="feat-link inv-link" data-idx="${i}"><b>${escapeHtml(it.name)}</b></a>${missing}${r.lib && r.lib.spellCarrier != null ? invSpellPickHtml(it, i, r.lib.spellCarrier) : ""}</td>
      <td class="hint">${escapeHtml(src)}</td>
      <td><label class="hint"><input type="checkbox" class="inv-eq" data-idx="${i}" ${it.eq ? "checked" : ""} aria-label="Equip ${escapeHtml(it.name)}">${it.slot && typeof slotByKey === "function" && slotByKey(it.slot) ? ` ${escapeHtml(slotByKey(it.slot).label.toLowerCase())}` : ""}</label></td>
      <td>${attuneBox}</td>
      <td>${r.lib && (it.custom ? it.custom.valueGp : itemValueGp(r.lib)) !== "" ? `<button type="button" class="inv-buy" data-idx="${i}" title="Buy one for ${fmtGP(r.val)} gp">Buy +1</button>` : ""} <button type="button" class="inv-sell" data-idx="${i}"${it.qty > 0 ? "" : " disabled"}>Sell</button></td>
      ${itemRowTotalsHtml(it, i)}
      <td>${it.custom ? `<button type="button" data-custom-item-edit="${i}">Edit</button>` : ""}</td>
      <td><button class="rowbtn inv-del" data-idx="${i}" aria-label="Remove ${escapeHtml(it.name)}">x</button></td>
    </tr>`;
  }).join("");
  el.innerHTML = `<table class="inventory-table"><thead><tr>${[["qty","Qty"],["name","Item"],["source","Source"],["eq","Equipped"],["attuned","Attunement"],["","Buy/Sell"],["weight","Weight each"],["value","Value each"],["totalWeight","Total weight"],["totalValue","Total value"],["","Edit"],["","Remove"]].map(([key,label]) => INVENTORY_SORT.header(key,label)).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}
/* Which spell a scroll or tattoo holds: any spell of its level, or free text before spells load. */
function invSpellPickHtml(it, i, level) {
  const names = [...new Set((typeof SPELL_LIB !== "undefined" ? SPELL_LIB : []).filter(s => s.level === level).map(s => s.name))]
    .sort((a, b) => a.localeCompare(b));
  if (!names.length) return ` <input type="text" class="inv-spell" data-idx="${i}" value="${escapeHtml(it.spell || "")}" placeholder="spell" style="width:9rem">`;
  if (it.spell && !names.includes(it.spell)) names.unshift(it.spell);
  return ` <select class="inv-spell" data-idx="${i}"><option value="">- spell -</option>${names.map(n =>
    `<option value="${escapeHtml(n)}"${n === it.spell ? " selected" : ""}>${escapeHtml(n)}</option>`).join("")}</select>`;
}
/* Repaint numeric cells without replacing editable quantity controls. */
function itemRowFigures(it) {
  const r = resolvedItem(it);
  return [`${fmtGP(r.wt)} lb.`, `${fmtGP(r.val)} gp`, `${fmtGP(it.qty * r.wt)} lb.`, `${fmtGP(it.qty * r.val)} gp`];
}
function itemRowTotalsHtml(it, index) {
  return itemRowFigures(it).map((figure, column) => `<td class="inv-number hint"><span class="inv-totals" data-idx="${index}" data-figure="${column}">${figure}</span></td>`).join("");
}
function toggleInvDetail(link) {
  const div = link.closest("tr");
  if (div.nextElementSibling && div.nextElementSibling.classList.contains("feat-detail")) { div.nextElementSibling.remove(); return; }
  const it = CHARACTER_ITEMS[Number(link.dataset.idx)]; if (!it) return;
  const lib = it.custom || findLibItemByName(it.name);
  const d = document.createElement("tr"); d.className = "feat-detail";
  const detail = document.createElement("td"); detail.colSpan = 12; d.appendChild(detail);
  if (!lib) {
    detail.innerHTML = `<div class="hint">No item named "${escapeHtml(it.name)}" found in the Equipment Library - load/import it above to see its description.</div>`;
  } else {
    const meta = [lib.type, lib.rarity, lib.reqAttune].filter(Boolean).join(" | ");
    detail.innerHTML = `<div class="hint">${meta}</div><div>${escapeHtml(normalizeDisplayPunctuation(lib.text)).replace(/\n/g, "<br>")}</div>`;
  }
  div.after(d);
}

document.addEventListener("DOMContentLoaded", () => {
  const results = $("char-item-list"); if (!results) return;
  results.addEventListener("click", e => {
    if (INVENTORY_SORT.click(e, renderItemList)) return;
    const buy = e.target.closest(".inv-buy"); if (buy) { buyMoreItem(Number(buy.dataset.idx)); return; }
    const sell = e.target.closest(".inv-sell"); if (sell) { openItemSale(Number(sell.dataset.idx)); return; }
    const del = e.target.closest(".inv-del"); if (del) { removeCharacterItem(Number(del.dataset.idx)); return; }
    // handled on click, not "change" - see the identical comment on .sp2-prep in spellcasting.js
    const eq = e.target.closest(".inv-eq"); if (eq) { setItemFlag(Number(eq.dataset.idx), "eq", eq.checked); return; }
    const attuned = e.target.closest(".inv-attuned"); if (attuned) { setItemFlag(Number(attuned.dataset.idx), "attuned", attuned.checked); return; }
    const link = e.target.closest(".inv-link"); if (link) { e.preventDefault(); toggleInvDetail(link); }
  });
  // `input`, not `change`: the totals should follow what you're typing, and nothing here re-renders
  // the list, so there's no field to lose.
  results.addEventListener("change", e => {
    const sp = e.target.closest(".inv-spell"); if (!sp) return;
    const it = CHARACTER_ITEMS[Number(sp.dataset.idx)]; if (!it) return;
    it.spell = sp.value.trim();
    if (typeof renderSpellList === "function") renderSpellList();
    scheduleSave();
  });
  results.addEventListener("input", e => {
    const qty = e.target.closest(".inv-qty"); if (qty) setItemQty(Number(qty.dataset.idx), qty.value);
  });
  const sale = $("item-sale-editor");
  if (!sale) return;
  sale.addEventListener("click", e => { if (e.target.closest("[data-sale-cancel]")) closeItemSale(); });
  sale.addEventListener("input", () => sale.elements.qty.setCustomValidity(""));
  sale.addEventListener("submit", e => {
    e.preventDefault();
    if (!sale.reportValidity()) return;
    if (!sellCharacterItem(sellingItem, Number(sale.elements.qty.value), Number(sale.elements.price.value))) {
      sale.elements.qty.setCustomValidity("Choose a quantity greater than zero and no more than you own.");
      sale.reportValidity();
    }
  });
});
