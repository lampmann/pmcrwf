/* ============================================================
   DICE ENGINE — 5ecrawler/Avrae-style command parser
   ============================================================ */
function rollDie(sides) { return 1 + Math.floor(Math.random() * sides); }
let _d20kept = []; // kept d20 faces from the last evalExpr — used for crit detection (only the d20 crits)

function parseSel(s) {
  if (!s) return { type: "=", n: NaN };
  if (s[0] === ">") return { type: ">", n: +s.slice(1) };
  if (s[0] === "<") return { type: "<", n: +s.slice(1) };
  if (s[0] === "h") return { type: "h", n: +s.slice(1) };
  if (s[0] === "l") return { type: "l", n: +s.slice(1) };
  return { type: "=", n: +s };
}
function matchSel(v, sel) {
  if (sel.type === ">") return v > sel.n;
  if (sel.type === "<") return v < sel.n;
  return v === sel.n;
}
function applyOp(dice, op, selRaw, sides) {
  if (op === "mi") { const n = +selRaw; dice.forEach(d => { if (!d.dropped && d.v < n) d.v = n; }); return; }
  if (op === "ma") { const n = +selRaw; dice.forEach(d => { if (!d.dropped && d.v > n) d.v = n; }); return; }
  if (op === "kh" || op === "kl" || op === "ph" || op === "pl") {
    const n = +selRaw, high = op[1] === "h", keep = op[0] === "k";
    const active = dice.filter(d => !d.dropped);
    const sorted = [...active].sort((a, b) => high ? b.v - a.v : a.v - b.v);
    const chosen = new Set(sorted.slice(0, n));
    active.forEach(d => { const inC = chosen.has(d); d.dropped = keep ? !inC : inC; });
    return;
  }
  if (op === "k" || op === "p") {
    const sel = parseSel(selRaw), keep = op === "k";
    dice.forEach(d => { if (d.dropped) return; const m = matchSel(d.v, sel); d.dropped = keep ? !m : m; });
    return;
  }
  const sel = selRaw ? parseSel(selRaw) : { type: "=", n: sides }; // default: on max face
  if (op === "e") {
    for (let idx = 0, guard = 0; idx < dice.length && guard < 1000; idx++) {
      if (!dice[idx].dropped && matchSel(dice[idx].v, sel)) { dice.push({ v: rollDie(sides), dropped: false, exp: true }); guard++; }
    }
    return;
  }
  if (op === "ro") { dice.forEach(d => { if (!d.dropped && matchSel(d.v, sel)) { d.v = rollDie(sides); d.rer = true; } }); return; }
  if (op === "rr") { dice.forEach(d => { let g = 0; while (!d.dropped && matchSel(d.v, sel) && g < 1000) { d.v = rollDie(sides); d.rer = true; g++; } }); return; }
  if (op === "ra") { const add = []; dice.forEach(d => { if (!d.dropped && matchSel(d.v, sel)) add.push({ v: rollDie(sides), dropped: false, exp: true }); }); dice.push(...add); return; }
}
function evalDice(tok, termIdx) {
  const mm = tok.match(/^(\d*)d(\d+)(.*)$/i);
  const count = mm[1] === "" ? 1 : +mm[1], sides = +mm[2], rest = mm[3] || "";
  // Hard cap on dice per term, so a typo ("1000d6") can't lock the tab up. It is reported in the
  // roll's own render rather than applied quietly — a silently truncated roll is a wrong number
  // presented as a right one, which is the one thing this sheet never does (see DOCS: degrade to
  // manual, never guess).
  const MAX_DICE = 500, rolledCount = Math.min(count, MAX_DICE);
  const capped = count > MAX_DICE;
  const dice = [];
  for (let i = 0; i < rolledCount; i++) dice.push({ v: rollDie(sides), dropped: false });
  const opRe = /(rr|ro|ra|mi|ma|kh|kl|ph|pl|k|p|e)([<>]?\d+|h\d+|l\d+)?/gi;
  let om; while ((om = opRe.exec(rest))) applyOp(dice, om[1].toLowerCase(), om[2], sides);
  const total = dice.filter(d => !d.dropped).reduce((s, d) => s + d.v, 0);
  if (sides === 20) dice.forEach(d => { if (!d.dropped) _d20kept.push(d.v); });
  /* Each face is its own element carrying the die it came off and the number it settled on, which
     is what lets the tumbling animation flash it through other faces of the SAME die and then put
     it back (see animateRoll in roll-anim.js). Dropped and rerolled faces keep their own markup —
     a dropped die is still a die, and watching the one advantage discarded is half the fun. */
  const face = d => {
    const cls = "die" + (d.dropped ? " die-dropped" : "") + (d.rer || d.exp ? " die-note" : "");
    const inner = `<span class="${cls}" data-sides="${sides}" data-final="${d.v}" data-term="${termIdx == null ? "" : termIdx}">${d.v}</span>`;
    return d.dropped ? "<s>" + inner + "</s>" : (d.rer || d.exp ? "<b>" + inner + "</b>" : inner);
  };
  const render = escapeHtml(tok) + " (" + dice.map(face).join(", ") + ")"
    + (capped ? ` <b>[capped at ${MAX_DICE} of ${count} dice]</b>` : "");
  return { value: total, render, dice, sides };
}
function evalExpr(expr) {
  _d20kept = [];
  const annotations = [];
  expr = expr.replace(/\[[^\]]*\]/g, m => { annotations.push(m.slice(1, -1)); return ""; });
  const re = /(\d*d\d+[hlkproaeim<>\d]*|\d+|[+\-*()])/gi;
  const tokens = []; let m; while ((m = re.exec(expr))) tokens.push(m[1]);
  const out = [], ops = [], prec = { "+": 1, "-": 1, "*": 2 }, display = [];
  let termIdx = 0;   // die terms in source order — the animation keys each face back to its term
  for (const t of tokens) {
    if (/^[+\-*]$/.test(t)) {
      while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop());
      ops.push(t); display.push(" " + t + " ");
    } else if (t === "(") { ops.push(t); display.push("("); }
    else if (t === ")") { while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()); ops.pop(); display.push(")"); }
    else if (/d/i.test(t)) { const r = evalDice(t, termIdx++); out.push(r); display.push(r.render); }
    else { out.push({ value: Number(t) }); display.push(t); }
  }
  while (ops.length) out.push(ops.pop());
  const run = () => {
    const st = [];
    for (const o of out) {
      if (typeof o === "string") { const b = st.pop(), a = st.pop(); st.push(o === "+" ? a + b : o === "-" ? a - b : a * b); }
      else st.push(o.value);
    }
    return st.length ? st[0] : 0;
  };
  const value = run();
  /* How much the total moves per point on each die term, measured rather than assumed: bump the
     term by one, re-run the same RPN, take the difference. That's +1 for "1d20+5", -1 for "10-1d6"
     and 2 for "2*1d6" — so the tumbling animation can show a live total without re-parsing anything.
     It is exact for any expression linear in that term, which is every expression anyone rolls; a
     die multiplied by another die would only be approximate, and only mid-flash. */
  const terms = out.filter(o => o && typeof o === "object" && o.dice);
  terms.forEach(t => {
    const was = t.value;
    t.value = was + 1;
    t.coeff = run() - value;
    t.value = was;
  });
  return { value, display: display.join(""), annotations, terms, coeffs: terms.map(t => t.coeff) };
}

/* split "1d20+5 adv Attack!" -> {expr, mode, label} (space at bracket-depth 0 ends the expression) */
function splitRoll(s) {
  s = s.trim();
  let depth = 0, idx = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[") depth++; else if (c === "]") depth--;
    else if (/\s/.test(c) && depth <= 0) { idx = i; break; }
  }
  let expr = idx < 0 ? s : s.slice(0, idx);
  let rest = idx < 0 ? "" : s.slice(idx + 1).trim();
  let mode = "normal";
  const mm = rest.match(/^(adv|advantage|dis|disadvantage)\b\s*/i);
  if (mm) { mode = /^adv/i.test(mm[1]) ? "adv" : "dis"; rest = rest.slice(mm[0].length).trim(); }
  return { expr, mode, label: rest };
}
function applyMode(expr, mode) {
  if (mode === "normal") return expr;
  const repl = mode === "adv" ? "2d20kh1" : "2d20kl1";
  let done = false;
  return expr.replace(/\b(\d*)d20\b/i, (full, cnt) => {
    if (!done && (cnt === "" || cnt === "1")) { done = true; return repl; }
    return full;
  });
}
/* Labels and [bracket annotations] are free text — typed into the command line, or carried on a
   button from a weapon/spell/companion name. The log stores its HTML and re-injects it with
   innerHTML on every load (see event-log.js / repaintEventLog), so anything user- or data-supplied
   is escaped on the way in; only engine-built markup (a roll's own `display`) goes through raw. */
function fmtAnns(anns) { return anns.length ? " <i>[" + anns.map(escapeHtml).join("][") + "]</i>" : ""; }
/* The total, as an element the tumbling animation can rewrite. It carries the number it settles on
   and how much each die term moves it, so the running total during the flash is computed rather
   than faked — see animateRoll in roll-anim.js. */
function totalHtml(rolled) {
  const coeffs = (rolled.coeffs || []).join(",");
  return `<b class="roll-total" data-final="${rolled.value}"${coeffs ? ` data-coeffs="${coeffs}"` : ""}>${rolled.value}</b>`;
}
function fmtLabel(label, fallback) { return escapeHtml(label || fallback); }

/* `opts` carries what a feature effect can change about a d20 roll itself rather than its total:
     dieFloor — "treat a roll of N or lower as N" (Reliable Talent). Expressed with the roller's own
                `mi` operator so it shows in the displayed dice rather than silently adjusting a total.
     critMin  — a widened crit range (Improved Critical's 19-20).
   Both are read off the effects snapshot by the caller, never inferred here. */
function runRoll(s, forceMode, opts) {
  let { expr, mode, label } = splitRoll(s);
  if (forceMode) mode = forceMode;
  const floor = opts && opts.dieFloor;
  if (floor > 1) expr = expr.replace(/\b(\d*)d20\b/i, (m0, n) => `${n || 1}d20mi${floor}`);
  const rolled = evalExpr(applyMode(expr, mode));
  const modeTag = mode === "normal" ? "" : ` <i>(${mode})</i>`;
  const critMin = (opts && opts.critMin) || 20;
  let crit = "";  // only the kept d20 can crit (deviates from 5eCrawler, which crits off any die's max/min)
  if (_d20kept.length === 1) { if (_d20kept[0] >= critMin) crit = "  <b>Critical Success!</b>"; else if (_d20kept[0] === 1) crit = "  <b>Critical Failure!</b>"; }
  log(`${totalHtml(rolled)} &larr; ${fmtLabel(label, "roll")}${modeTag}: ${rolled.display}${fmtAnns(rolled.annotations)}${crit}`);
  return rolled.value;
}
function runMultiroll(n, s) {
  const { expr, mode, label } = splitRoll(s);
  const lines = []; let sum = 0;
  for (let i = 0; i < n; i++) { const r = evalExpr(applyMode(expr, mode)); sum += r.value; lines.push(`  ${totalHtml(r)}  ⇐ ${r.display}`); }
  log(`<b>${fmtLabel(label, "multiroll")} ×${n}</b> (sum ${sum})\n${lines.join("\n")}`);
}
function runIterroll(n, dc, s) {
  const { expr, mode, label } = splitRoll(s);
  const lines = []; let succ = 0;
  for (let i = 0; i < n; i++) { const r = evalExpr(applyMode(expr, mode)); const ok = r.value >= dc; if (ok) succ++; lines.push((ok ? "✓" : "✗") + " " + totalHtml(r)); }
  log(`<b>${fmtLabel(label, "iterroll")}: ${succ}/${n} ≥ DC ${dc}</b>\n  ${lines.join(",  ")}`);
}
function runCommand(input) {
  let s = (input || "").trim(); if (!s) return;
  if (/^[!/]?(clear|clr|cls)$/i.test(s)) { clearLog(); return; }
  let cmd = "roll";
  const m = s.match(/^[!/]?(iterroll|multiroll|roll|rrr|rr|r)\b\s*/i);
  if (m) { const c = m[1].toLowerCase(); cmd = ({ r: "roll", rr: "multiroll", rrr: "iterroll" })[c] || c; s = s.slice(m[0].length); }
  if (cmd === "multiroll") {
    let mm = s.match(/^(\d+)\s+([\s\S]+)$/);                                        // /rr N roll
    if (!mm) { const t = s.match(/^([\s\S]+?)\s+(\d+)$/); if (t) mm = [t[0], t[2], t[1]]; }  // /rr roll N (Discord order)
    if (!mm) { log("? usage: /rr &lt;N&gt; &lt;roll&gt;  (N and roll may be in either order)"); return; }
    runMultiroll(Math.min(+mm[1], 100), mm[2]); return;
  }
  if (cmd === "iterroll") {
    const mm = s.match(/^(\d+)\s+(-?\d+)\s+([\s\S]+)$/); if (!mm) { log("? usage: /rrr &lt;N&gt; &lt;DC&gt; &lt;roll&gt;"); return; }
    runIterroll(Math.min(+mm[1], 100), +mm[2], mm[3]); return;
  }
  runRoll(s);
}
/* Whether a check button's target is one you add your proficiency bonus to — the precondition
   Reliable Talent and its cousins state. Expertise counts, being a doubled proficiency. */
function isProficientCheck(key) {
  if (typeof key !== "string") return false;
  if (key.startsWith("skill-") && typeof skillProfMult === "function") return skillProfMult(key.slice(6)) > 0;
  if (key.startsWith("save-") && typeof saveProfMult === "function") return saveProfMult(key.slice(5)) > 0;
  return false;
}
const D20SEL = "[data-roll-check], .atk-roll, .wpn-roll, .mon-roll";   // buttons that roll a d20 check (adv/dis applies)
/* The value + check-key of the most recent d20 roll, for callers that need to react to what a roll
   actually came up as (combat.js reads this off an Initiative roll to seed the turn-order tracker)
   without re-rolling it themselves — a second roll would land on a different number than the one
   already in the log. */
let LAST_D20_ROLL = null;
function modeFromEvent(ev) { return ev && ev.shiftKey ? "adv" : (ev && (ev.ctrlKey || ev.metaKey || ev.altKey)) ? "dis" : "normal"; }
function rollInfo(btn) {
  if (btn.dataset.rollCheck) {
    const k = btn.dataset.rollCheck;
    return { bonus: checkBonus(k), dice: checkDice(k), label: btn.dataset.label + effAnnotations(k),
      // Conditions and exhaustion force a mode the same way a feature does — combined, not replaced,
      // so Poisoned cancelling a feature's advantage lands on a straight roll rather than one winning.
      mode: (typeof conditionMode === "function") ? combineModes(effMode(k), conditionMode(k)) : effMode(k),
      // Reliable Talent floors a check you're proficient in; the engine records the floor per target.
      // Reliable Talent floors any check you can add your proficiency bonus to, so it's declared on
      // "check-proficient" rather than per skill; a floor aimed at one specific check still works.
      dieFloor: (typeof effDieFloor === "function")
        ? Math.max(effDieFloor(k), isProficientCheck(k) ? effDieFloor("check-proficient") : 0) : 0 };
  }
  // inline "spell attack" phrase inside an expanded spell description (see renderInlineSpellText)
  if (btn.classList.contains("atk-roll")) {
    return { bonus: spellAttackBonus(), dice: spellAttackDice(), label: (btn.dataset.rolllabel || "spell attack") + effAnnotations("spellatk"),
      mode: (typeof conditionMode === "function") ? combineModes(effMode("spellatk"), conditionMode("spellatk")) : effMode("spellatk") };
  }
  // weapon attack to-hit button (Attacks module) — bonus/dice/label/mode are all set on the button by
  // attacks.js, which is what already folds that row's feature effects (attack-hit) into them
  if (btn.classList.contains("wpn-roll")) {
    return { bonus: Number(btn.dataset.bonus) || 0, dice: btn.dataset.dice || "", label: btn.dataset.rolllabel || "attack",
      mode: btn.dataset.mode || null, critMin: Number(btn.dataset.critmin) || 20 };
  }
  // a companion/summon's own d20 roll — attack, save, skill or initiative (companions.js). Same
  // button contract as .wpn-roll above, but the numbers come from a monster statblock rather than
  // from your sheet, so no feature effects apply and there's never a forced mode.
  if (btn.classList.contains("mon-roll")) {
    return { bonus: Number(btn.dataset.bonus) || 0, dice: btn.dataset.dice || "", label: btn.dataset.rolllabel || "roll", mode: null };
  }
  return null;
}
function fireRoll(btn, mode) {
  const info = rollInfo(btn); if (!info) return;
  // info.dice already carries its sign(s), e.g. "+1d4" (from the Misc field or an effect)
  // A click's own Shift/Ctrl modifier wins over an effect-forced mode (e.g. Alert doesn't force
  // advantage); an effect wins only when the user didn't ask for anything ("normal" from a plain click).
  const forced = (mode && mode !== "normal") ? mode : (info.mode || undefined);
  const value = runRoll(`1d20${info.bonus >= 0 ? "+" + info.bonus : info.bonus}${info.dice || ""} ${info.label}`, forced,
    { dieFloor: info.dieFloor, critMin: info.critMin });
  LAST_D20_ROLL = { key: btn.dataset.rollCheck || null, value };
  // Guidance/Resistance are one-shot: the dice were already folded into the expression above (via
  // checkDice), so this only marks them used. Here rather than in rollInfo() because that also runs
  // for the hover tooltip and the right-click menu, neither of which is a roll.
  if (typeof spendBoonsFor === "function" && btn.dataset.rollCheck) spendBoonsFor(btn.dataset.rollCheck);
}

/* modifier-aware tooltip + right-click menu on d20 roll buttons */
let _mouse = { x: 0, y: 0 }, _hoverRoll = null, _curMod = null, _tip = null, _menuOpen = false;
function rollTip() { if (!_tip) { _tip = document.createElement("div"); _tip.id = "rolltip"; document.body.appendChild(_tip); } return _tip; }
function refreshRollTip() {
  const t = rollTip();
  if (_hoverRoll && _curMod) { t.textContent = _curMod === "adv" ? "⬆ Advantage" : "⬇ Disadvantage"; t.style.display = "block"; t.style.left = (_mouse.x + 12) + "px"; t.style.top = (_mouse.y + 14) + "px"; }
  else t.style.display = "none";
}
function modKey(e) { return e.shiftKey ? "adv" : (e.ctrlKey || e.metaKey || e.altKey) ? "dis" : null; }
function closeRollMenu() { const m = document.getElementById("rollmenu"); if (m) m.remove(); _menuOpen = false; }
function showRollMenu(x, y, btn) {
  closeRollMenu();
  const m = document.createElement("div"); m.id = "rollmenu";
  [["Normal", "normal"], ["Advantage", "adv"], ["Disadvantage", "dis"]].forEach(([lab, mode]) => {
    const it = document.createElement("div"); it.textContent = lab;
    it.addEventListener("click", ev => { ev.stopPropagation(); fireRoll(btn, mode); closeRollMenu(); });
    m.appendChild(it);
  });
  document.body.appendChild(m); m.style.left = x + "px"; m.style.top = y + "px"; _menuOpen = true;
}

/* ---------- Log ----------
   log()/clearLog() moved to src/event-log.js when the roll log became a general Event Log —
   log(html) is now logEvent("roll", html). See that file to add a new kind of event. */
