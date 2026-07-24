/* ============================================================
   INVENTORY MODULE — the character's owned items, rendered like the
   Spellcasting module: expandable lines, click a name to show/hide its
   description (looked up from the Equipment Library by name), with an
   "x" to remove. Items are added only from the Equipment Library (name/
   weight/value come from there and aren't hand-edited) via
   addCharacterItem() — same shape as addCharacterSpell() in
   spellcasting.js. CHARACTER_ITEMS is persisted as part of the
   character (see persistence.js), same as CHARACTER_SPELLS.
   ============================================================ */
let CHARACTER_ITEMS = []; // [{name, qty, eq, attuned}]

function addCharacterItem(name) {
  CHARACTER_ITEMS.push({ name, qty: 1, eq: false, attuned: false });
  renderItemList(); recompute(); scheduleSave();
}
function removeCharacterItem(idx) {
  CHARACTER_ITEMS.splice(idx, 1);
  renderItemList(); recompute(); scheduleSave();
}
function setItemQty(idx, qty) {
  const it = CHARACTER_ITEMS[idx]; if (!it) return;
  it.qty = Math.max(0, Number(qty) || 0);
  renderItemList(); recompute(); scheduleSave();
}
function setItemFlag(idx, key, val) {
  const it = CHARACTER_ITEMS[idx]; if (!it) return;
  it[key] = val;
  renderItemList(); recompute(); scheduleSave();
}
function resolvedItem(it) {
  const lib = findLibItemByName(it.name);
  return {
    ...it, lib,
    wt: lib && lib.weight !== "" ? Number(lib.weight) : 0,
    val: lib && lib.valueGp !== "" ? Number(lib.valueGp) : 0,
  };
}
function itemsTotalValue() { return CHARACTER_ITEMS.reduce((s, it) => { const r = resolvedItem(it); return s + r.qty * r.val; }, 0); }
function itemsTotalWeight() { return CHARACTER_ITEMS.reduce((s, it) => { const r = resolvedItem(it); return s + r.qty * r.wt; }, 0); }
function renderItemList() {
  const el = $("char-item-list"); if (!el) return;
  $("attuned-count").textContent = String(CHARACTER_ITEMS.filter(it => it.attuned).length);
  if (!CHARACTER_ITEMS.length) { el.innerHTML = "<div class='hint'>no items yet — use \"+ Add Item\" above</div>"; return; }
  el.innerHTML = CHARACTER_ITEMS.map((it, i) => {
    const r = resolvedItem(it);
    const src = r.lib ? r.lib.source : "";
    const missing = r.lib ? "" : ` <span class="hint">(not found in Equipment Library — load it to see weight/value/description)</span>`;
    const attuneBox = r.lib && r.lib.reqAttune
      ? `<label class="hint" style="margin-left:.4rem" title="${escapeHtml(r.lib.reqAttune)}"><input type="checkbox" class="inv-attuned" data-idx="${i}" ${it.attuned ? "checked" : ""}> attuned</label>` : "";
    return `<div>
      <input type="text" inputmode="numeric" class="tiny inv-qty" data-idx="${i}" value="${it.qty}">
      <a class="feat-link inv-link" data-idx="${i}"><b>${escapeHtml(it.name)}</b></a> <span class="hint">${src}</span>${missing}
      <label class="hint" style="margin-left:.4rem"><input type="checkbox" class="inv-eq" data-idx="${i}" ${it.eq ? "checked" : ""}> equipped</label>${attuneBox}
      <span class="hint">&mdash; ${fmtGP(r.wt)} lb ea &middot; ${fmtGP(r.val)} gp ea &middot; ${fmtGP(it.qty * r.wt)} lb / ${fmtGP(it.qty * r.val)} gp total</span>
      <button class="rowbtn inv-del" data-idx="${i}" title="remove">x</button>
    </div>`;
  }).join("");
}
function toggleInvDetail(link) {
  const div = link.closest("div");
  if (div.nextElementSibling && div.nextElementSibling.classList.contains("feat-detail")) { div.nextElementSibling.remove(); return; }
  const it = CHARACTER_ITEMS[Number(link.dataset.idx)]; if (!it) return;
  const lib = findLibItemByName(it.name);
  const d = document.createElement("div"); d.className = "feat-detail";
  if (!lib) {
    d.innerHTML = `<div class="hint">No item named "${escapeHtml(it.name)}" found in the Equipment Library — load/import it above to see its description.</div>`;
  } else {
    const meta = [lib.type, lib.rarity, lib.reqAttune].filter(Boolean).join(" · ");
    d.innerHTML = `<div class="hint">${meta}</div><div>${escapeHtml(lib.text).replace(/\n/g, "<br>")}</div>`;
  }
  div.after(d);
}

document.addEventListener("DOMContentLoaded", () => {
  const results = $("char-item-list"); if (!results) return;
  results.addEventListener("click", e => {
    const del = e.target.closest(".inv-del"); if (del) { removeCharacterItem(Number(del.dataset.idx)); return; }
    // handled on click, not "change" — see the identical comment on .sp2-prep in spellcasting.js
    const eq = e.target.closest(".inv-eq"); if (eq) { setItemFlag(Number(eq.dataset.idx), "eq", eq.checked); return; }
    const attuned = e.target.closest(".inv-attuned"); if (attuned) { setItemFlag(Number(attuned.dataset.idx), "attuned", attuned.checked); return; }
    const link = e.target.closest(".inv-link"); if (link) { e.preventDefault(); toggleInvDetail(link); }
  });
  results.addEventListener("change", e => {
    const qty = e.target.closest(".inv-qty"); if (qty) setItemQty(Number(qty.dataset.idx), qty.value);
  });
});
