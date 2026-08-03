/* ============================================================
   EQUIPMENT SLOTS — a paper doll for what you're actually wearing.

   Replaces the flat "equipped" checkbox with named body slots, the way
   BG3 does it: two hands, armour, headwear, cloak, gloves, bracers and
   footwear, each holding one thing. Click a slot to see what fits, or drag
   an item onto it.

   WHY SLOTS EXIST AT ALL — PHB p141, "Multiple Items of the Same Kind":
   you can't normally wear more than one pair of footwear, one pair of
   gloves or gauntlets, one pair of bracers, one suit of armour, one item of
   headwear, and one cloak. A checkbox per item can't say that; a slot can,
   because a slot holds one thing by construction.

   ...AND WHY THEY DON'T ENFORCE. The same paragraph says "use common sense"
   and "You can make exceptions; a character might be able to wear a circlet
   under a helmet". So every slot's picker has a "show everything" toggle
   and will take any item you insist on. The slots are the default reading
   of the rule, not a rules lawyer.

   HOW AN ITEM FINDS ITS SLOT. 5e.tools has no body-slot field — armour and
   weapons are typed, but nothing marks Winged Boots as footwear. So slots
   are guessed from the item's type where the data knows (armour, shields,
   weapons) and from its name where it doesn't (/\bboots?\b/ and friends).
   A guess is only ever used to ORDER the picker and to auto-place a legacy
   equipped item; it never stops you putting something where you want it.

   `eq` REMAINS THE SOURCE OF TRUTH for "is this equipped", because the AC
   formula (armorClassAuto in derived.js) and the Attacks module's Fx toggle
   already read it. A slot assignment sets `eq` alongside `slot`, so nothing
   downstream had to learn about slots.
   ============================================================ */

const BODY_SLOTS = [
  { key: "mainHand", label: "Main hand", kind: "hand" },
  { key: "offHand", label: "Off hand", kind: "hand" },
  { key: "armor", label: "Armour", kind: "armor" },
  { key: "head", label: "Headwear", kind: "head" },
  { key: "cloak", label: "Cloak", kind: "cloak" },
  { key: "gloves", label: "Gloves", kind: "gloves" },
  { key: "bracers", label: "Bracers", kind: "bracers" },
  { key: "boots", label: "Footwear", kind: "boots" },
  /* Thri-kreen have four arms, but the lower pair "can't wield weapons or shields" (MPMM) — they
     hold things. Hidden unless the character has them, and typed so the picker won't offer a
     longsword for a hand that can't hold one. */
  { key: "hand3", label: "Secondary hand", kind: "hand-lesser", extra: true },
  { key: "hand4", label: "Secondary hand", kind: "hand-lesser", extra: true },
];

/* Name patterns for the slots the data can't type. Deliberately word-boundary searches rather than
   prefixes: "Winged Boots" and "Boots of Speed" are both footwear. */
const SLOT_PATTERNS = {
  head: /\b(helm|helmet|hat|cap|circlet|crown|coronet|diadem|mask|headband|goggles|spectacles|lenses)\b/i,
  cloak: /\b(cloak|cape|mantle)\b/i,
  gloves: /\b(gloves|gauntlets?)\b/i,
  bracers: /\b(bracers?|vambraces?)\b/i,
  boots: /\b(boots?|slippers|shoes|sandals)\b/i,
};

function extraArmsEnabled() {
  // Any character can turn them on (a DM might grant extra limbs); a thri-kreen gets them for free.
  if (typeof EQUIP_EXTRA_ARMS !== "undefined" && EQUIP_EXTRA_ARMS) return true;
  const race = (($("char-race") || {}).value || "") + " " + (($("char-subrace") || {}).value || "");
  return /thri-?kreen/i.test(race);
}
let EQUIP_EXTRA_ARMS = false;

function activeSlots() { return BODY_SLOTS.filter(s => !s.extra || extraArmsEnabled()); }
function slotByKey(k) { return BODY_SLOTS.find(s => s.key === k) || null; }

/* A shield is identified by its armour CATEGORY, not by an `armor` flag: 5e.tools' base shield entry
   is `{ type: "S", ac: 2 }` with no `armor` field at all, which is why armorClassAuto (derived.js)
   tests armorCat too. Getting this wrong made shields fall through as "no slot" and let a thri-kreen's
   lesser hand accept one. */
function isShield(lib) { return !!lib && lib.armorCat === "shield"; }
function isBodyArmor(lib) { return !!lib && (lib.armor || ["light", "medium", "heavy"].includes(lib.armorCat)) && !isShield(lib); }

/* The slot an item most likely belongs in, or "" when nothing suggests one. */
function guessSlot(name) {
  const lib = (typeof findLibItemByName === "function") ? findLibItemByName(name) : null;
  if (lib) {
    if (isShield(lib)) return "offHand";
    if (isBodyArmor(lib)) return "armor";
    if (lib.weapon) return "mainHand";
  }
  for (const [slot, re] of Object.entries(SLOT_PATTERNS)) if (re.test(name)) return slot;
  return "";
}

/* Can this item go in this slot? Only ever a "should we offer it" question — see the header. */
function fitsSlot(name, slotKey) {
  const slot = slotByKey(slotKey); if (!slot) return false;
  const lib = (typeof findLibItemByName === "function") ? findLibItemByName(name) : null;
  if (slot.kind === "hand") return true;                       // you can hold anything in a hand
  if (slot.kind === "hand-lesser") {                           // ...except a weapon or shield, in these
    if (!lib) return true;
    return !lib.weapon && !isShield(lib);
  }
  if (slot.kind === "armor") return isBodyArmor(lib);
  const re = SLOT_PATTERNS[slot.kind];
  return re ? re.test(name) : false;
}
function isTwoHanded(name) {
  const lib = (typeof findLibItemByName === "function") ? findLibItemByName(name) : null;
  return !!(lib && (lib.weaponProps || []).includes("2H"));
}

function itemInSlot(key) { return (typeof CHARACTER_ITEMS !== "undefined") ? CHARACTER_ITEMS.find(it => it.slot === key) : null; }

/* ----- equipping ----- */
function equipToSlot(idx, slotKey) {
  const it = CHARACTER_ITEMS[idx]; if (!it) return;
  // One thing per slot: whatever was there comes off first.
  CHARACTER_ITEMS.forEach(other => { if (other !== it && other.slot === slotKey) unequipItem(other, true); });
  // A two-handed weapon takes both primary hands, so the other one is emptied with it.
  if (slotKey === "mainHand" && isTwoHanded(it.name)) {
    CHARACTER_ITEMS.forEach(other => { if (other !== it && other.slot === "offHand") unequipItem(other, true); });
  }
  // ...and equipping into a hand that a two-handed weapon is using displaces that weapon.
  if (slotKey === "offHand") {
    const main = itemInSlot("mainHand");
    if (main && main !== it && isTwoHanded(main.name)) unequipItem(main, true);
  }
  it.slot = slotKey;
  it.eq = true;                          // `eq` still drives AC and the Attacks module — see the header
  afterEquipChange(`Equipped <b>${escapeHtml(it.name)}</b> <span class="hint">(${slotByKey(slotKey).label.toLowerCase()})</span>`);
}
function unequipItem(it, quiet) {
  if (!it) return;
  it.slot = "";
  it.eq = false;
  if (!quiet) afterEquipChange(`Unequipped <b>${escapeHtml(it.name)}</b>`);
}
function unequipSlot(slotKey) {
  const it = itemInSlot(slotKey); if (!it) return;
  unequipItem(it);
}
function afterEquipChange(msg) {
  renderEquipSlots();
  if (typeof renderItemList === "function") renderItemList();
  recompute();
  if (typeof scheduleSave === "function") scheduleSave();
  if (msg && typeof logEvent === "function") logEvent("info", msg);
}

/* Characters from before slots existed have `eq` set and no `slot`. Place each one in its guessed
   slot if that slot is free — purely additive (it never changes `eq`), so the worst case is an item
   left unslotted and still equipped, exactly as it was. */
function placeLegacyEquipped() {
  if (typeof CHARACTER_ITEMS === "undefined") return;
  CHARACTER_ITEMS.forEach(it => {
    if (!it.eq || it.slot) return;
    const g = guessSlot(it.name);
    if (g && !itemInSlot(g)) it.slot = g;
  });
}

/* ----- rendering ----- */
function slotCellHtml(slot) {
  const it = itemInSlot(slot.key);
  const filled = !!it;
  const twoH = filled && isTwoHanded(it.name);
  return `<div class="eq-slot${filled ? " filled" : ""}" data-slot="${slot.key}" tabindex="0"
      title="${filled ? `${escapeHtml(it.name)} — click to change, × to remove` : `${slot.label} — click to equip something`}">
    <div class="eq-slot-label hint">${escapeHtml(slot.label)}${slot.kind === "hand-lesser" ? " <span title=\"can hold objects, but not weapons or shields\">*</span>" : ""}</div>
    <div class="eq-slot-item">${filled ? escapeHtml(it.name) : "<span class='hint'>empty</span>"}</div>
    ${twoH ? `<div class="hint">two-handed</div>` : ""}
    ${filled ? `<button type="button" class="eq-slot-x" data-unslot="${slot.key}" title="unequip">×</button>` : ""}
  </div>`;
}

function renderEquipSlots() {
  const el = $("equip-slots"); if (!el) return;
  placeLegacyEquipped();
  const slots = activeSlots();
  el.innerHTML =
    `<div class="eq-doll">${slots.map(slotCellHtml).join("")}</div>
     <div class="hint">Drag an item from the list below onto a slot, or click a slot to pick one.
       One of each per PHB p141 — but every picker has a <b>show everything</b> toggle, because the same
       page says to use common sense and allow exceptions.
       <label style="margin-left:.5rem"><input type="checkbox" id="eq-extra-arms"${extraArmsEnabled() ? " checked" : ""}${/thri-?kreen/i.test((($("char-race")||{}).value||"")) ? " disabled" : ""}> extra arms</label></div>`;
}

/* The picker. Same popup idiom as the combat tracker's menus. */
let EQ_PICKER = null;   // { slotKey, showAll }

function closeEquipPicker() {
  const m = document.querySelector(".eq-picker"); if (m) m.remove();
  EQ_PICKER = null;
}

function openEquipPicker(slotKey, anchor) {
  closeEquipPicker();
  EQ_PICKER = { slotKey, showAll: false };
  paintEquipPicker(anchor);
}

function paintEquipPicker(anchor) {
  if (!EQ_PICKER) return;
  const slot = slotByKey(EQ_PICKER.slotKey); if (!slot) return;
  let m = document.querySelector(".eq-picker");
  if (!m) { m = document.createElement("div"); m.className = "eq-picker"; document.body.appendChild(m); }

  const entries = [];
  (CHARACTER_ITEMS || []).forEach((it, idx) => {
    if (it.slot === EQ_PICKER.slotKey) return;                       // already here
    const fits = fitsSlot(it.name, EQ_PICKER.slotKey);
    if (!fits && !EQ_PICKER.showAll) return;
    entries.push({ idx, name: it.name, fits, where: it.slot ? (slotByKey(it.slot) || {}).label : "" });
  });
  entries.sort((a, b) => (b.fits - a.fits) || a.name.localeCompare(b.name));

  const current = itemInSlot(EQ_PICKER.slotKey);
  m.innerHTML =
    `<div class="cbt-menu-title">${escapeHtml(slot.label)}</div>` +
    (current ? `<div class="cbt-item" data-eqclear="1"><span>Unequip ${escapeHtml(current.name)}</span></div>` : "") +
    (entries.length ? entries.map(e =>
      `<div class="cbt-item" data-eqidx="${e.idx}">
         <span>${escapeHtml(e.name)}</span>
         <span class="hint">${e.where ? "in " + escapeHtml(e.where.toLowerCase()) : (e.fits ? "" : "doesn't fit")}</span>
       </div>`).join("")
      : `<div class="cbt-item disabled"><span class="hint">${EQ_PICKER.showAll ? "nothing in your inventory" : "nothing in your inventory fits this slot"}</span></div>`) +
    `<div class="cbt-item" data-eqall="1"><span>${EQ_PICKER.showAll ? "☑" : "☐"} show everything</span>
       <span class="hint">PHB p141 allows exceptions</span></div>`;

  if (anchor) {
    const r = anchor.getBoundingClientRect();
    m.style.left = r.left + "px";
    const room = window.innerHeight - r.bottom;
    if (room < 220 && r.top > room) { m.style.top = ""; m.style.bottom = (window.innerHeight - r.top + 2) + "px"; }
    else { m.style.bottom = ""; m.style.top = (r.bottom + 2) + "px"; }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const el = $("equip-slots"); if (!el) return;
  renderEquipSlots();

  el.addEventListener("click", e => {
    if (e.target.id === "eq-extra-arms") { EQUIP_EXTRA_ARMS = e.target.checked; renderEquipSlots(); scheduleSave(); return; }
    const x = e.target.closest("[data-unslot]");
    if (x) { e.stopPropagation(); unequipSlot(x.dataset.unslot); return; }
    const cell = e.target.closest("[data-slot]");
    if (cell) {
      if (EQ_PICKER && EQ_PICKER.slotKey === cell.dataset.slot) { closeEquipPicker(); return; }
      openEquipPicker(cell.dataset.slot, cell);
    }
  });

  document.addEventListener("click", e => {
    const item = e.target.closest(".eq-picker .cbt-item");
    if (!item) { if (!e.target.closest("[data-slot]")) closeEquipPicker(); return; }
    if (!EQ_PICKER) return;
    if (item.dataset.eqall) {
      EQ_PICKER.showAll = !EQ_PICKER.showAll;
      paintEquipPicker(document.querySelector(`[data-slot="${EQ_PICKER.slotKey}"]`));
      return;
    }
    if (item.dataset.eqclear) { unequipSlot(EQ_PICKER.slotKey); closeEquipPicker(); return; }
    if (item.dataset.eqidx != null) { equipToSlot(Number(item.dataset.eqidx), EQ_PICKER.slotKey); closeEquipPicker(); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeEquipPicker(); });

  /* ----- drag and drop -----
     Inventory row -> slot equips it; slot -> anywhere outside the doll unequips. The drag payload is
     the inventory index, which is stable for the length of a drag. */
  document.addEventListener("dragstart", e => {
    const row = e.target.closest("[data-invdrag]");
    if (row) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "inv:" + row.dataset.invdrag); } catch (err) {} return; }
    const cell = e.target.closest(".eq-slot.filled");
    if (cell) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "slot:" + cell.dataset.slot); } catch (err) {} }
  });
  el.addEventListener("dragover", e => {
    const cell = e.target.closest("[data-slot]"); if (!cell) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".eq-slot.drop").forEach(c => c.classList.remove("drop"));
    cell.classList.add("drop");
  });
  el.addEventListener("dragleave", e => { const c = e.target.closest("[data-slot]"); if (c) c.classList.remove("drop"); });
  el.addEventListener("drop", e => {
    const cell = e.target.closest("[data-slot]"); if (!cell) return;
    e.preventDefault();
    document.querySelectorAll(".eq-slot.drop").forEach(c => c.classList.remove("drop"));
    let payload = ""; try { payload = e.dataTransfer.getData("text/plain"); } catch (err) {}
    if (payload.startsWith("inv:")) { equipToSlot(Number(payload.slice(4)), cell.dataset.slot); return; }
    if (payload.startsWith("slot:")) {
      const from = payload.slice(5);
      const it = itemInSlot(from);
      if (it) equipToSlot(CHARACTER_ITEMS.indexOf(it), cell.dataset.slot);
    }
  });
  // Dropping a slotted item onto the inventory list takes it off.
  const list = $("char-item-list");
  if (list) {
    list.addEventListener("dragover", e => { if ((e.dataTransfer.types || []).includes("text/plain")) e.preventDefault(); });
    list.addEventListener("drop", e => {
      let payload = ""; try { payload = e.dataTransfer.getData("text/plain"); } catch (err) {}
      if (!payload.startsWith("slot:")) return;
      e.preventDefault();
      unequipSlot(payload.slice(5));
    });
  }
});
