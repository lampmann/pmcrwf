/* ============================================================
   SENSES MODULE

   Each range is the best of: the race or subrace record's own field
   ("darkvision": 60), any feature effect granting one (op "min" on
   sense-<name>), and the Other box for items, spells and anything the
   sheet can't see. Senses don't stack, so grants take the highest; an
   effect with op "add" extends a sense that something else already
   grants (Umbral Sight's +30). Special senses without a single range
   (Devil's Sight, Blindsense) are sense-special tags, listed as text.
   ============================================================ */
const SENSE_NAMES = ["blindsight", "darkvision", "tremorsense", "truesight"];

function raceSenseGrant(sense) {
  if (typeof ciFindRace !== "function") return null;
  const rec = ciFindRace((($("char-race") || {}).value || "").trim()); if (!rec) return null;
  // This record advertises darkvision even though Variable Trait makes it optional.
  // The conditional feature effect owns Custom Lineage's darkvision.
  if (sense === "darkvision" && rec.name.toLowerCase() === "custom lineage") return null;
  const sub = ciFindRaceSub(rec, (($("char-subrace") || {}).value || "").trim());
  const n = (sub && sub.senses && sub.senses[sense]) || (rec.senses && rec.senses[sense]) || 0;
  return n ? { n, source: sub && sub.senses && sub.senses[sense] ? sub.name + " " + rec.name : rec.name } : null;
}
/* { n, sources } for one sense. */
function senseRange(sense) {
  const grants = [], adds = [];
  const race = raceSenseGrant(sense); if (race) grants.push(race);
  const other = Number((($("sense-" + sense + "-other") || {}).value || "").trim()) || 0;
  if (other) grants.push({ n: other, source: "Other" });
  (typeof effContribs === "function" ? effContribs("sense-" + sense) : []).forEach(c => {
    if (c.op === "min") grants.push({ n: Number(c.n) || 0, source: c.source });
    else if (c.op === "add") adds.push({ n: Number(c.n) || 0, source: c.source });
  });
  let best = grants.reduce((a, g) => g.n > a.n ? g : a, { n: 0, source: "" });
  let n = best.n; const sources = best.n ? [best.source] : [];
  adds.forEach(a => {
    if (grants.some(g => g.source !== a.source && g.n > 0)) { n += a.n; sources.push(a.source + " +" + a.n); }
  });
  return { n, sources };
}
function passiveOf(skill) { return 10 + checkBonus("skill-" + skill); }
function renderSenses() {
  applySenseOrder();
  SENSE_NAMES.forEach(sense => {
    const el = $("sense-" + sense); if (!el) return;
    const r = senseRange(sense);
    el.textContent = r.n ? String(r.n) : "-";
    el.title = r.sources.join(", ");
  });
  const special = $("sense-special");
  if (special) special.textContent = (typeof effTags === "function" ? effTags("sense-special") : []).map(t => t.label).join(" | ");
  const pp = $("passive-perc"), pp2 = $("passive-perc-2");
  if (pp2) pp2.textContent = pp ? pp.textContent : String(passiveOf("perception"));
}

/* Like skills, sense order belongs to the character and travels in its saved fields. */
function currentSenseOrder() {
  return [...document.querySelectorAll("#sense-rows tr")].map(tr => tr.dataset.senseKey);
}
function applySenseOrder() {
  const body = $("sense-rows"); if (!body) return;
  let order;
  try { order = JSON.parse(($("sense-order") || {}).value || "[]"); } catch (e) { order = []; }
  if (!Array.isArray(order)) order = [];
  const rows = new Map([...body.rows].map(tr => [tr.dataset.senseKey, tr]));
  const defaults = SENSE_NAMES;
  let index = 0;
  [...new Set([...order, ...defaults])].forEach(k => {
    const row = rows.get(k); if (!row) return;
    if (body.rows[index] !== row) body.insertBefore(row, body.rows[index] || null);
    index++;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const body = $("sense-rows"); if (!body) return;
  let dragged = null;
  const clear = () => [...body.rows].forEach(tr => tr.classList.remove("drop-before", "drop-after"));
  const finish = () => {
    clear(); dragged = null;
    [...body.rows].forEach(tr => { tr.draggable = false; tr.classList.remove("dragging"); });
  };
  body.addEventListener("mousedown", e => {
    const grip = e.target.closest(".sense-grip"); if (grip) grip.closest("tr").draggable = true;
  });
  document.addEventListener("mouseup", () => { if (!dragged) finish(); });
  body.addEventListener("dragstart", e => {
    const tr = e.target.closest("tr"); if (!tr || !tr.draggable) return;
    dragged = tr; tr.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tr.dataset.senseKey);
  });
  body.addEventListener("dragend", finish);
  body.addEventListener("dragover", e => {
    if (!dragged) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; clear();
    const tr = e.target.closest("tr");
    if (tr && tr !== dragged) tr.classList.add(skillDropAfter(tr, e.clientY) ? "drop-after" : "drop-before");
  });
  body.addEventListener("drop", e => {
    if (!dragged) return;
    e.preventDefault();
    const tr = e.target.closest("tr");
    if (tr && tr !== dragged) {
      if (skillDropAfter(tr, e.clientY)) tr.after(dragged); else tr.before(dragged);
      $("sense-order").value = JSON.stringify(currentSenseOrder());
      if (typeof scheduleSave === "function") scheduleSave();
    }
    finish();
  });
  $("btn-sense-reset-order").addEventListener("click", () => {
    $("sense-order").value = ""; applySenseOrder();
    if (typeof scheduleSave === "function") scheduleSave();
  });
});
