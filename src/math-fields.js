/* ---------- Math-aware number fields (type "+5"/"-3" to adjust; clamps to bounds) ---------- */
function evalArith(s) {
  // safe arithmetic for the number boxes: regex whitelist means no code injection is possible
  if (!/^[\d+\-*\/().\s]+$/.test(s)) return null;
  try { const v = Function('"use strict"; return (' + s + ')')(); return typeof v === "number" && isFinite(v) ? v : null; }
  catch (e) { return null; }
}
function commitMath(el) {
  let raw = (el.value || "").trim();
  const allowEmpty = el.hasAttribute("data-allow-empty");
  const prev = Number(el.dataset.prev || 0);
  let val;
  if (raw === "") { if (allowEmpty) { el.value = ""; el.dataset.prev = "0"; return; } val = prev; }
  else if (/^[+-]\d+$/.test(raw)) { val = prev + Number(raw); }              // typed just "+5" / "-3"
  else if (/^-?\d+$/.test(raw)) { val = Number(raw); }                       // plain absolute number
  else { const a = evalArith(raw); val = a === null ? prev : a; }            // arithmetic, e.g. "30+5"
  const min = el.dataset.min !== undefined ? Number(el.dataset.min) : -Infinity;
  let max = el.dataset.max !== undefined ? Number(el.dataset.max) : Infinity;
  if (el.dataset.maxFrom) {
    const f = $(el.dataset.maxFrom);
    const raw = f ? (f.value !== undefined ? f.value : f.textContent) : "";
    if (raw !== "" && !isNaN(Number(raw))) max = Math.min(max, Number(raw));
  }
  val = Math.round(val);
  val = Math.min(max, Math.max(min, val));
  el.value = String(val);
  el.dataset.prev = String(val);
}
function commitMathField(el) {
  commitMath(el);
  if (el.classList.contains("cls-lvl")) enforceTotalLevelCap(el);  // total across all classes <= 30
  recompute(); scheduleSave();
}
function enforceTotalLevelCap(changed) {
  const rows = [...document.querySelectorAll(".cls-lvl")];
  const others = rows.filter(r => r !== changed).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const maxAllowed = Math.max(1, Math.min(20, 20 - others)); // per-class cap 20, total cap 20
  if ((Number(changed.value) || 0) > maxAllowed) { changed.value = String(maxAllowed); changed.dataset.prev = String(maxAllowed); }
}
function initMathFields() {
  document.querySelectorAll("[data-math]").forEach(el => {
    el.dataset.prev = (el.value !== "" && !isNaN(Number(el.value))) ? String(Number(el.value)) : "0";
    if (el.value !== "") commitMath(el);
  });
}
