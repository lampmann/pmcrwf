/* ============================================================
   HP BAR (HP module) AND DEFENCE CHECKLISTS (Defenses module)

   The health bar is drawn around the existing inputs rather than
   replacing them: #hp-cur and #hp-temp are still the persisted math
   fields everything else reads and writes (rests, Hit Dice, Death Ward,
   damage from the roller), so this file only sizes the fills. Colours
   are solid Tango palette: green health, yellow temp HP, dark track. The
   temp bar sits above the health bar at a width proportional to temp/max.

   Resist / Immune / Vulnerable are hidden persisted fields holding comma
   lists (derived.js's manualDefences reads them). The checklists write
   those lists; a value typed under the old text boxes that isn't in the
   option list stays, shown as its own checked row.
   ============================================================ */

const DEF_DAMAGE = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing",
  "poison", "psychic", "radiant", "slashing", "thunder"];
const DEF_CONDITIONS = ["blinded", "charmed", "deafened", "disease", "exhaustion", "frightened", "grappled",
  "incapacitated", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
const DEF_LISTS = [
  { field: "def-resist", label: "Resist", options: DEF_DAMAGE },
  { field: "def-immune", label: "Immune", options: [...DEF_DAMAGE, ...DEF_CONDITIONS] },
  { field: "def-vuln", label: "Vulnerable", options: DEF_DAMAGE },
];

/* A committed number, not a half-typed "-7": the fill follows what the field will settle on. */
function hpFieldValue(el) {
  if (!el) return 0;
  const v = (el.value || "").trim();
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : Number(el.dataset.prev || 0) || 0;
}
/* Each box is as wide as what's typed in it (or its placeholder), since Firefox has no field-sizing. */
function fitHpInputs() {
  document.querySelectorAll(".hp-bar input, .hp-temp-label input").forEach(el => {
    const n = Math.max(1, (el.value || el.placeholder || "").length);
    el.style.width = `calc(${n}ch + 3px)`;
  });
}
/* Temp HP past max HP stacks upward: the bottom row holds the number and is full width, a full row
   sits above it per further whole max, and the remainder tops the stack. The bottom fill is always
   to scale; its "THP: n" label is centred in it when it fits and sits just right of it when not. */
function renderHpBar() {
  fitHpInputs();
  const fill = document.getElementById("hp-fill"), row = document.getElementById("hp-temp-row");
  if (!fill && !row) return;
  const max = Math.max(0, Number((document.getElementById("hp-max") || {}).textContent) || 0);
  const cur = hpFieldValue(document.getElementById("hp-cur"));
  const temp = hpFieldValue(document.getElementById("hp-temp"));
  if (fill) fill.style.width = (max ? Math.max(0, Math.min(100, cur / max * 100)) : 0) + "%";
  if (!row) return;
  const rows = max ? Math.ceil(temp / max) : 0;
  const pct = rows > 1 ? 100 : max ? Math.min(100, temp / max * 100) : 0;
  row.classList.toggle("hp-temp-empty", !temp);
  document.getElementById("hp-temp-bar").style.width = pct + "%";
  const label = document.getElementById("hp-temp-label");
  const fillPx = row.clientWidth * pct / 100, labelPx = label.offsetWidth, pad = 6;
  const inside = !!temp && labelPx + 2 * pad <= fillPx;
  label.classList.toggle("hp-temp-outside", !inside);
  label.style.left = (inside ? (fillPx - labelPx) / 2 : (temp ? fillPx + pad : 0)) + "px";
  const stack = document.getElementById("hp-temp-full"); if (!stack) return;
  const extra = Math.min(Math.max(0, rows - 1), 4);
  const topPct = rows > 1 ? (temp - (rows - 1) * max) / max * 100 : 100;
  const html = extra ? `<div class="hp-temp-bar" style="width:${rows - 1 > 4 ? 100 : topPct}%"></div>` +
    '<div class="hp-temp-bar"></div>'.repeat(extra - 1) : "";
  if (stack.innerHTML !== html) stack.innerHTML = html;
}

function defValues(field) {
  const el = document.getElementById(field);
  return el ? el.value.split(",").map(s => s.trim()).filter(Boolean) : [];
}
function defChecklistHtml(def, open) {
  const vals = defValues(def.field), lower = vals.map(v => v.toLowerCase());
  const extras = vals.filter(v => !def.options.includes(v.toLowerCase()));
  const opts = [...def.options, ...extras].sort((a, b) => a.localeCompare(b));
  const title = s => s.charAt(0).toUpperCase() + s.slice(1);
  return `<span class="dd-check${open ? " open" : ""}" data-field="${def.field}">
    <button type="button" class="dd-check-btn" aria-expanded="${open}" aria-controls="${def.field}-panel">${def.label}${vals.length ? `: <b>${escapeHtml(vals.map(title).join(", "))}</b>` : ""} &#9662;</button>
    <span class="dd-check-panel" id="${def.field}-panel" popover="manual"${open ? "" : " hidden"}>${opts.map(o =>
      `<label><input type="checkbox" value="${escapeHtml(o)}"${lower.includes(o.toLowerCase()) ? " checked" : ""}> ${escapeHtml(title(o))}</label>`).join("")}</span>
  </span>`;
}
let DEF_OPEN = null;   // the field whose panel is open, so a redraw keeps it open
function renderDefenceChecklists() {
  const el = document.getElementById("def-manual"); if (!el) return;
  el.innerHTML = DEF_LISTS.map(d => defChecklistHtml(d, DEF_OPEN === d.field)).join("");
  const panel = el.querySelector(".dd-check.open .dd-check-panel");
  if (panel) { panel.showPopover(); positionDefenceChecklist(); }
}

/* A top-layer popover escapes the module's scroll clipping while keeping its event handlers. */
function positionDefenceChecklist() {
  const wrap = document.querySelector("#def-manual .dd-check.open"); if (!wrap) return;
  const button = wrap.querySelector(".dd-check-btn"), panel = wrap.querySelector(".dd-check-panel");
  const r = button.getBoundingClientRect(), body = wrap.closest(".lay-body");
  const visible = body ? body.getBoundingClientRect() : { top: 0, bottom: innerHeight };
  if (!r.height || r.bottom <= Math.max(0, visible.top) || r.top >= Math.min(innerHeight, visible.bottom)) {
    DEF_OPEN = null; renderDefenceChecklists(); return;
  }
  const below = Math.max(0, innerHeight - r.bottom - 8), above = Math.max(0, r.top - 8);
  const flip = below < Math.min(panel.scrollHeight, 320) && above > below;
  panel.style.maxHeight = Math.min(320, flip ? above : below) + "px";
  panel.style.left = Math.max(8, Math.min(r.left, innerWidth - panel.offsetWidth - 8)) + "px";
  panel.style.top = (flip ? r.top - panel.offsetHeight : r.bottom) + "px";
}

document.addEventListener("DOMContentLoaded", () => {
  // Typing in either box moves the bar straight away; the committed value follows on blur/Enter.
  document.addEventListener("input", e => { if (e.target.id === "hp-cur" || e.target.id === "hp-temp") renderHpBar(); });
  document.addEventListener("change", e => { if (e.target.id === "hp-cur" || e.target.id === "hp-temp") renderHpBar(); });

  const box = document.getElementById("def-manual"); if (!box) return;
  renderDefenceChecklists();
  box.addEventListener("click", e => {
    const btn = e.target.closest(".dd-check-btn"); if (!btn) return;
    const field = btn.closest(".dd-check").dataset.field;
    DEF_OPEN = DEF_OPEN === field ? null : field;
    renderDefenceChecklists();
  });
  box.addEventListener("change", e => {
    const wrap = e.target.closest(".dd-check"); if (!wrap) return;
    const field = document.getElementById(wrap.dataset.field);
    field.value = [...wrap.querySelectorAll("input:checked")].map(c => c.value).join(", ");
    // The page's own input listener recomputes and saves, exactly as typing in the old box did.
    field.dispatchEvent(new Event("input", { bubbles: true }));
    renderDefenceChecklists();
  });
  // composedPath, not closest: the box's own handler may already have redrawn (and detached) the
  // element that was clicked by the time this runs.
  document.addEventListener("click", e => {
    if (DEF_OPEN && !e.composedPath().includes(box)) { DEF_OPEN = null; renderDefenceChecklists(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !DEF_OPEN) return;
    const field = DEF_OPEN; DEF_OPEN = null; renderDefenceChecklists();
    box.querySelector(`[data-field="${field}"] .dd-check-btn`).focus();
  });
  window.addEventListener("resize", positionDefenceChecklist);
  window.addEventListener("scroll", positionDefenceChecklist, true);
});
