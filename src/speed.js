/* ============================================================
   SPEED MODULE

   One row per movement type. Each total is a base plus a Misc field
   (signed terms with optional labels, like an ability's Misc) plus what
   features add, and an Override box replaces the base the way AC's does:

     walk     the race's walking speed (the hidden #speed field, which
              syncRaceSpeed keeps in step with the race); features add to it
     others   the best of the race record's own speed ("fly": 50, or true
              for "equal to your walking speed") and any feature granting
              one (op "add" on speed-fly etc. is a grant, so grants don't stack)

   Grappled, Restrained and exhaustion reach every row; encumbrance only
   slows walking. Speeds a feature describes rather than numbers ("+10 ft,
   if you have one") are listed under the table as the feature words them.
   Custom speeds are name and feet pairs in the hidden #speed-custom field.
   ============================================================ */
const SPEED_TYPES = ["walk", "burrow", "climb", "fly", "swim"];

function speedMiscTerms(type) {
  const el = $("speed-" + type + "-misc");
  return el && typeof parseMiscTerms === "function" ? parseMiscTerms(el.value) : [];
}
function speedOverride(type) {
  const el = $("speed-" + type + "-override"); if (!el) return null;
  const v = el.value.trim();
  return v !== "" && !isNaN(Number(v)) ? Number(v) : null;
}
/* The race record's own speed of one type: { n, source, cond } or { walk: true } for a speed equal to
   your walking speed, or null. */
function raceSpeedOf(type) {
  if (typeof ciFindRace !== "function") return null;
  const rec = ciFindRace((($("char-race") || {}).value || "").trim()); if (!rec) return null;
  const sub = ciFindRaceSub(rec, (($("char-subrace") || {}).value || "").trim());
  const sp = (sub && sub.speed != null) ? sub.speed : rec.speed;
  if (!sp || typeof sp !== "object") return null;
  const v = sp[type], source = rec.name;
  if (v === true) return { walk: true, source };
  if (typeof v === "number" && v > 0) return { n: v, source };
  if (v && typeof v === "object" && Number(v.number) > 0) return { n: Number(v.number), source, cond: v.condition || "" };
  return null;
}

/* { n, parts } before conditions: n is the speed, parts the breakdown shown on hover. */
function speedBreakdown(type) {
  const parts = [], ov = speedOverride(type);
  let n;
  if (type === "walk") {
    if (ov != null) { n = ov; parts.push(ov + " override"); }
    else { n = num($("speed")); parts.push(n + " base"); }
    const eff = typeof effFlat === "function" ? effFlat("speed") : 0;
    if (eff) { n += eff; parts.push(sign(eff) + " (" + effContribs("speed").map(c => c.source).join(", ") + ")"); }
  } else if (ov != null) { n = ov; parts.push(ov + " override"); }
  else {
    const race = raceSpeedOf(type), grant = typeof effFlat === "function" ? effFlat("speed-" + type) : 0;
    const raceN = race ? (race.walk ? speedBreakdown("walk").n : race.n) : 0;
    n = Math.max(raceN, grant);
    if (n) parts.push(n === grant && grant > raceN
      ? n + " (" + effContribs("speed-" + type).map(c => c.source).join(", ") + ")"
      : n + " (" + race.source + (race.walk ? ", equal to walking" : "") + (race.cond ? " " + race.cond : "") + ")");
  }
  speedMiscTerms(type).forEach(t => { n += t.n; parts.push(sign(t.n) + (t.label ? " " + t.label : "")); });
  if (type === "walk") {
    const enc = typeof encumbranceState === "function" ? encumbranceState().speedPenalty : 0;
    if (enc) { n -= enc; parts.push("-" + enc + " encumbered"); }
  }
  return { n: Math.max(0, n), parts };
}
/* A movement type's speed in feet, after conditions and exhaustion. */
function speedOf(type) {
  const n = speedBreakdown(type).n;
  return typeof conditionSpeed === "function" ? conditionSpeed(n) : n;
}

function speedCustomList() {
  try { const v = JSON.parse((($("speed-custom") || {}).value) || "[]"); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function setSpeedCustomList(list) {
  const el = $("speed-custom"); if (!el) return;
  el.value = list.length ? JSON.stringify(list) : "";
  SPEED_CUSTOM_DRAWN = el.value;
  el.dispatchEvent(new Event("input", { bubbles: true }));   // the page's own listener recomputes and saves
}
let SPEED_CUSTOM_DRAWN = null;   // what the custom rows were last drawn from, so typing in one isn't redrawn under you
function renderSpeedCustomRows() {
  const body = $("speed-custom-rows"), field = $("speed-custom"); if (!body || !field) return;
  if (field.value === SPEED_CUSTOM_DRAWN) return;
  SPEED_CUSTOM_DRAWN = field.value;
  body.innerHTML = speedCustomList().map((c, i) => `<tr data-speed-i="${i}">
    <td><input type="text" class="speed-custom-name" value="${escapeHtml(c.name || "")}" aria-label="Speed name"></td>
    <td><input type="text" inputmode="numeric" class="tiny speed-custom-ft" value="${escapeHtml(String(c.ft ?? ""))}" aria-label="Feet"></td>
    <td></td>
    <td><button type="button" class="speed-custom-del" aria-label="remove">&times;</button></td></tr>`).join("");
}

function renderSpeed() {
  SPEED_TYPES.forEach(type => {
    const el = $("speed-" + type + "-total"); if (!el) return;
    const b = speedBreakdown(type), n = speedOf(type);
    el.textContent = n || type === "walk" ? String(n) : "-";
    el.title = b.n || type === "walk" ? b.parts.join(" ") + " = " + b.n + (n !== b.n ? "; " + n + " with conditions" : "") : "";
  });
  renderSpeedCustomRows();
  const extra = $("speed-extra");
  if (extra && typeof effTagsByPrefix === "function") {
    extra.innerHTML = effTagsByPrefix("speed-").map(t =>
      `<b>${escapeHtml(t.kind)}</b> ${escapeHtml(t.items.map(i => i.label).join(", "))}`).join("<br>");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const box = $("speed-table"); if (!box) return;
  box.addEventListener("input", e => {
    const tr = e.target.closest("[data-speed-i]"); if (!tr) return;
    e.stopPropagation();
    const list = speedCustomList(), c = list[Number(tr.dataset.speedI)]; if (!c) return;
    if (e.target.classList.contains("speed-custom-name")) c.name = e.target.value;
    if (e.target.classList.contains("speed-custom-ft")) c.ft = e.target.value.trim();
    setSpeedCustomList(list);
  });
  box.addEventListener("click", e => {
    const del = e.target.closest(".speed-custom-del");
    if (del) {
      const list = speedCustomList(); list.splice(Number(del.closest("[data-speed-i]").dataset.speedI), 1);
      setSpeedCustomList(list); SPEED_CUSTOM_DRAWN = null; renderSpeedCustomRows(); return;
    }
    if (e.target.id === "speed-add-btn") {
      const name = $("speed-add-name"), ft = $("speed-add-ft");
      if (!name.value.trim()) { name.focus(); return; }
      const list = speedCustomList(); list.push({ name: name.value.trim(), ft: ft.value.trim() });
      name.value = ""; ft.value = "";
      setSpeedCustomList(list); SPEED_CUSTOM_DRAWN = null; renderSpeedCustomRows();
    }
  });
  box.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.target.id === "speed-add-name" || e.target.id === "speed-add-ft")) { e.preventDefault(); $("speed-add-btn").click(); }
  });
});
