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
