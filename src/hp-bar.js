/* ============================================================
   HP BAR AND DEFENCE CHECKLISTS (HP & Defenses module)

   The health bar is drawn around the existing inputs rather than
   replacing them: #hp-cur and #hp-temp are still the persisted math
   fields everything else reads and writes (rests, Hit Dice, Death Ward,
   damage from the roller), so this file only sizes the fills. Colours
   follow Risk of Rain 2: green health, yellow barrier, dark track. The
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
function renderHpBar() {
  const fill = document.getElementById("hp-fill"), tempBar = document.getElementById("hp-temp-bar");
  if (!fill && !tempBar) return;
  const max = Math.max(0, Number((document.getElementById("hp-max") || {}).textContent) || 0);
  const cur = hpFieldValue(document.getElementById("hp-cur"));
  const temp = hpFieldValue(document.getElementById("hp-temp"));
  if (fill) fill.style.width = (max ? Math.max(0, Math.min(100, cur / max * 100)) : 0) + "%";
  if (tempBar) {
    tempBar.style.width = `max(3.2rem, ${max ? Math.min(100, temp / max * 100) : 0}%)`;
    tempBar.classList.toggle("hp-temp-empty", !temp);
  }
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
    <button type="button" class="dd-check-btn">${def.label}${vals.length ? `: <b>${escapeHtml(vals.map(title).join(", "))}</b>` : ""} &#9662;</button>
    <span class="dd-check-panel"${open ? "" : " hidden"}>${opts.map(o =>
      `<label><input type="checkbox" value="${escapeHtml(o)}"${lower.includes(o.toLowerCase()) ? " checked" : ""}> ${escapeHtml(title(o))}</label>`).join("")}</span>
  </span>`;
}
let DEF_OPEN = null;   // the field whose panel is open, so a redraw keeps it open
function renderDefenceChecklists() {
  const el = document.getElementById("def-manual"); if (!el) return;
  el.innerHTML = DEF_LISTS.map(d => defChecklistHtml(d, DEF_OPEN === d.field)).join("");
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
});
