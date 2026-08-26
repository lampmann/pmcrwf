/* ============================================================
   CONDITIONS AND EXHAUSTION, APPLIED TO THE NUMBERS.

   The Conditions and Exhaustion modules have always been trackers: ticking
   Poisoned recorded that you were poisoned and changed nothing. This applies
   the parts a character sheet can honestly apply, and lists the rest.

   WHAT GETS APPLIED — advantage/disadvantage on your own d20 rolls, your
   speed, and your hit point maximum. Those are the effects that are purely a
   function of the condition being ticked: nothing else has to be true for
   Poisoned to give you disadvantage on an attack.

   WHAT GETS LISTED INSTEAD, AND WHY — three kinds of effect are deliberately
   shown rather than applied:

     - "Attack rolls against you have advantage" (Blinded, Paralyzed, Prone,
       Restrained, Stunned, Unconscious). That's someone else's roll. This
       sheet has no model of being attacked, and inventing one to hold a
       number nobody rolls here would be worse than a sentence.
     - "You automatically fail Strength and Dexterity saving throws"
       (Paralyzed, Petrified, Stunned, Unconscious). An auto-fail is not
       disadvantage, and dressing it as disadvantage would be a lie that
       sometimes succeeds. The save button says it instead.
     - "You can't take actions or reactions" (Incapacitated). The round
       tracker is advisory by design — it never blocks a spend — so zeroing
       your action here would be the one place the sheet started refusing.

   CONDITIONAL CONDITIONS. Frightened only applies "while the source of your
   fear is within line of sight", and Blinded's auto-fail only bites on checks
   that actually need sight. The sheet can't see either. Frightened is applied
   anyway, because being frightened with the source out of sight is the
   unusual case and the tooltip says so; the sight/hearing auto-fails are
   listed, because "which checks need sight" is a judgement per check.

   Everything here is advisory in the same sense as the rest of the sheet:
   it moves the number the button rolls and says why, and you can still roll
   whatever you like.
   ============================================================ */

/* Per condition: what it does to YOUR rolls. `attack`/`check`/`save` are roll modes; `saveOnly`
   narrows a save mode to named abilities; the note strings are what gets listed rather than applied.
   PHB'14 Appendix A. */
const CONDITION_EFFECTS = {
  blinded:      { attack: "dis", notes: ["auto-fails any check needing sight", "attacks against you have advantage"] },
  charmed:      { notes: ["can't attack the charmer; they have advantage on social checks with you"] },
  deafened:     { notes: ["auto-fails any check needing hearing"] },
  frightened:   { attack: "dis", check: "dis", notes: ["applies while the source is in line of sight"] },
  grappled:     { speed: 0, notes: ["speed 0"] },
  incapacitated:{ notes: ["can't take actions or reactions"] },
  invisible:    { attack: "adv", notes: ["attacks against you have disadvantage"] },
  paralyzed:    { autoFail: ["str", "dex"], speed: 0, notes: ["auto-fails Str and Dex saves", "attacks against you have advantage; hits within 5 ft crit"] },
  petrified:    { autoFail: ["str", "dex"], speed: 0, notes: ["auto-fails Str and Dex saves", "resistant to all damage; immune to poison and disease"] },
  poisoned:     { attack: "dis", check: "dis" },
  prone:        { attack: "dis", notes: ["attacks against you have advantage within 5 ft, disadvantage beyond"] },
  restrained:   { attack: "dis", saveOnly: { dex: "dis" }, speed: 0, notes: ["speed 0"] },
  stunned:      { autoFail: ["str", "dex"], speed: 0, notes: ["auto-fails Str and Dex saves", "attacks against you have advantage"] },
  unconscious:  { autoFail: ["str", "dex"], speed: 0, notes: ["auto-fails Str and Dex saves", "attacks against you have advantage; hits within 5 ft crit"] },
};
const CONDITION_KEYS = Object.keys(CONDITION_EFFECTS);

function conditionOn(key) {
  const el = document.getElementById("cond-" + key);
  return !!(el && el.checked);
}
function activeConditions() { return CONDITION_KEYS.filter(conditionOn); }

function exhaustionLevel() {
  const el = document.getElementById("exhaustion-level");
  return Math.max(0, Math.min(6, Math.floor(Number(el && el.value)) || 0));
}

/* adv + dis = neither, however many of each — PHB p173. Sources don't accumulate. */
function combineModes(a, b) {
  const has = m => x => x === m;
  const list = [a, b].filter(Boolean).filter(m => m !== "normal");
  const adv = list.some(has("adv")), dis = list.some(has("dis"));
  if (adv && dis) return "normal";
  if (adv) return "adv";
  if (dis) return "dis";
  return null;
}

/* Which bucket a roll target falls into. "init" is a Dexterity check (PHB p189), so anything that
   hits ability checks hits initiative too — the same rule Guidance already follows here. */
function rollBucket(target) {
  const t = target || "";
  if (t === "attack-hit" || t === "spellatk" || t === "attack") return "attack";
  if (t === "init" || t.startsWith("skill-")) return "check";
  if (t.startsWith("save-")) return "save";
  return null;
}

/* The mode conditions and exhaustion force on a given roll target, or null for none.
   Combined with whatever the effects engine says at the call site. */
function conditionMode(target) {
  const bucket = rollBucket(target); if (!bucket) return null;
  const ability = bucket === "save" ? target.slice(5) : "";
  let mode = null;
  activeConditions().forEach(key => {
    const c = CONDITION_EFFECTS[key];
    if (bucket === "attack" && c.attack) mode = combineModes(mode, c.attack);
    if (bucket === "check" && c.check) mode = combineModes(mode, c.check);
    if (bucket === "save") {
      if (c.save) mode = combineModes(mode, c.save);
      if (c.saveOnly && c.saveOnly[ability]) mode = combineModes(mode, c.saveOnly[ability]);
    }
  });
  // Exhaustion: 1 hits ability checks, 3 also hits attack rolls and saving throws (PHB p291).
  const exh = exhaustionLevel();
  if (exh >= 1 && bucket === "check") mode = combineModes(mode, "dis");
  if (exh >= 3 && (bucket === "attack" || bucket === "save")) mode = combineModes(mode, "dis");
  return mode;
}

/* Which conditions are behind that mode, for the tooltip — a forced roll should always be able to
   say what forced it, the same way an effect-driven one names its feature. */
function conditionReasons(target) {
  const bucket = rollBucket(target); if (!bucket) return [];
  const ability = bucket === "save" ? target.slice(5) : "";
  const out = [];
  activeConditions().forEach(key => {
    const c = CONDITION_EFFECTS[key];
    const m = bucket === "attack" ? c.attack
      : bucket === "check" ? c.check
      : (c.save || (c.saveOnly && c.saveOnly[ability]));
    if (m) out.push(`${capitalize(key)} (${m === "adv" ? "advantage" : "disadvantage"})`);
  });
  const exh = exhaustionLevel();
  if ((exh >= 1 && bucket === "check") || (exh >= 3 && (bucket === "attack" || bucket === "save"))) {
    out.push(`Exhaustion ${exh} (disadvantage)`);
  }
  return out;
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/* Saves an active condition makes you fail outright. Listed, never applied — see the header. */
function autoFailedSaves() {
  const out = {};
  activeConditions().forEach(key => {
    (CONDITION_EFFECTS[key].autoFail || []).forEach(ab => { (out[ab] || (out[ab] = [])).push(capitalize(key)); });
  });
  return out;
}

/* Speed after conditions and exhaustion: Grappled and Restrained stop you outright, exhaustion 2
   halves your speed and exhaustion 5 stops you (PHB p291). Returns a multiplier and a floor so
   speedTotal() can apply both without this file knowing how speed is otherwise computed. */
function conditionSpeed(base) {
  let n = base;
  const exh = exhaustionLevel();
  if (exh >= 2) n = Math.floor(n / 2);
  if (activeConditions().some(k => CONDITION_EFFECTS[k].speed === 0)) n = 0;
  if (exh >= 5) n = 0;
  return Math.max(0, n);
}
/* Exhaustion 4 halves your hit point maximum. */
function conditionMaxHp(base) { return exhaustionLevel() >= 4 ? Math.floor(base / 2) : base; }

/* Everything active that the sheet is NOT applying, for the Conditions module to show. */
function conditionNotes() {
  const out = [];
  activeConditions().forEach(key => {
    (CONDITION_EFFECTS[key].notes || []).forEach(n => out.push(`<b>${capitalize(key)}</b> ${n}`));
  });
  return out;
}

/* Two lines under the condition list, and the split between them is the point: the first is what
   the sheet has already done to your numbers, the second is what it is leaving to you. A tracker
   that silently did some of these and not others would be worse than one that did none. */
function renderConditionEffects() {
  const applied = document.getElementById("cond-applied");
  const manual = document.getElementById("cond-manual");
  if (!applied || !manual) return;

  const bits = [];
  [["attack rolls", "attack-hit"], ["ability checks", "init"],
   ["Str saves", "save-str"], ["Dex saves", "save-dex"], ["Con saves", "save-con"],
   ["Int saves", "save-int"], ["Wis saves", "save-wis"], ["Cha saves", "save-cha"]].forEach(([label, target]) => {
    const m = conditionMode(target);
    if (!m || m === "normal") return;
    bits.push(`${m === "adv" ? "advantage" : "disadvantage"} on <b>${label}</b> <span class="hint">(${escapeHtml(conditionReasons(target).join(", "))})</span>`);
  });
  const exh = exhaustionLevel();
  const speedNow = (typeof speedTotal === "function") ? speedTotal() : null;
  if (activeConditions().some(k => CONDITION_EFFECTS[k].speed === 0) || exh >= 2) {
    bits.push(`<b>speed</b> ${speedNow} ft`);
  }
  if (exh >= 4) bits.push("<b>hit point maximum</b> halved");
  applied.innerHTML = bits.length ? "Applied: " + bits.join(" &middot; ") : "";

  const notes = conditionNotes();
  manual.innerHTML = notes.length
    ? `<span title="the sheet can't apply these — they depend on someone else's roll, or on a judgement per check">Yours to apply: ${notes.join(" &middot; ")}</span>`
    : "";
}
