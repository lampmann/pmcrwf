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
function evalDice(tok) {
  const mm = tok.match(/^(\d*)d(\d+)(.*)$/i);
  const count = mm[1] === "" ? 1 : +mm[1], sides = +mm[2], rest = mm[3] || "";
  const dice = [];
  for (let i = 0; i < Math.min(count, 500); i++) dice.push({ v: rollDie(sides), dropped: false });
  const opRe = /(rr|ro|ra|mi|ma|kh|kl|ph|pl|k|p|e)([<>]?\d+|h\d+|l\d+)?/gi;
  let om; while ((om = opRe.exec(rest))) applyOp(dice, om[1].toLowerCase(), om[2], sides);
  const total = dice.filter(d => !d.dropped).reduce((s, d) => s + d.v, 0);
  if (sides === 20) dice.forEach(d => { if (!d.dropped) _d20kept.push(d.v); });
  const render = tok + " (" + dice.map(d => d.dropped ? "<s>" + d.v + "</s>" : (d.rer || d.exp ? "<b>" + d.v + "</b>" : String(d.v))).join(", ") + ")";
  return { value: total, render, dice };
}
function evalExpr(expr) {
  _d20kept = [];
  const annotations = [];
  expr = expr.replace(/\[[^\]]*\]/g, m => { annotations.push(m.slice(1, -1)); return ""; });
  const re = /(\d*d\d+[hlkproaeim<>\d]*|\d+|[+\-*()])/gi;
  const tokens = []; let m; while ((m = re.exec(expr))) tokens.push(m[1]);
  const out = [], ops = [], prec = { "+": 1, "-": 1, "*": 2 }, display = [];
  for (const t of tokens) {
    if (/^[+\-*]$/.test(t)) {
      while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop());
      ops.push(t); display.push(" " + t + " ");
    } else if (t === "(") { ops.push(t); display.push("("); }
    else if (t === ")") { while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()); ops.pop(); display.push(")"); }
    else if (/d/i.test(t)) { const r = evalDice(t); out.push(r); display.push(r.render); }
    else { out.push({ value: Number(t) }); display.push(t); }
  }
  while (ops.length) out.push(ops.pop());
  const st = [];
  for (const o of out) {
    if (typeof o === "string") { const b = st.pop(), a = st.pop(); st.push(o === "+" ? a + b : o === "-" ? a - b : a * b); }
    else st.push(o.value);
  }
  return { value: st.length ? st[0] : 0, display: display.join(""), annotations };
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
function fmtAnns(anns) { return anns.length ? " <i>[" + anns.join("][") + "]</i>" : ""; }

function runRoll(s, forceMode) {
  let { expr, mode, label } = splitRoll(s);
  if (forceMode) mode = forceMode;
  const rolled = evalExpr(applyMode(expr, mode));
  const modeTag = mode === "normal" ? "" : ` <i>(${mode})</i>`;
  let crit = "";  // only the kept d20 can crit (deviates from 5eCrawler, which crits off any die's max/min)
  if (_d20kept.length === 1) { if (_d20kept[0] === 20) crit = "  <b>Critical Success!</b>"; else if (_d20kept[0] === 1) crit = "  <b>Critical Failure!</b>"; }
  log(`<b>${rolled.value}</b> &larr; ${label || "roll"}${modeTag}: ${rolled.display}${fmtAnns(rolled.annotations)}${crit}`);
  return rolled.value;
}
function runMultiroll(n, s) {
  const { expr, mode, label } = splitRoll(s);
  const lines = []; let sum = 0;
  for (let i = 0; i < n; i++) { const r = evalExpr(applyMode(expr, mode)); sum += r.value; lines.push(`  ${r.value}  ⇐ ${r.display}`); }
  log(`<b>${label || "multiroll"} ×${n}</b> (sum ${sum})\n${lines.join("\n")}`);
}
function runIterroll(n, dc, s) {
  const { expr, mode, label } = splitRoll(s);
  const lines = []; let succ = 0;
  for (let i = 0; i < n; i++) { const r = evalExpr(applyMode(expr, mode)); const ok = r.value >= dc; if (ok) succ++; lines.push((ok ? "✓" : "✗") + " " + r.value); }
  log(`<b>${label || "iterroll"}: ${succ}/${n} ≥ DC ${dc}</b>\n  ${lines.join(",  ")}`);
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
const D20SEL = "[data-roll-check], .atk-roll";   // buttons that roll a d20 check (adv/dis applies)
function modeFromEvent(ev) { return ev && ev.shiftKey ? "adv" : (ev && (ev.ctrlKey || ev.metaKey || ev.altKey)) ? "dis" : "normal"; }
function rollInfo(btn) {
  if (btn.dataset.rollCheck) {
    const k = btn.dataset.rollCheck;
    return { bonus: checkBonus(k), dice: checkDice(k), label: btn.dataset.label + effAnnotations(k), mode: effMode(k) };
  }
  // inline "spell attack" phrase inside an expanded spell description (see renderInlineSpellText)
  if (btn.classList.contains("atk-roll")) {
    return { bonus: spellAttackBonus(), dice: spellAttackDice(), label: (btn.dataset.rolllabel || "spell attack") + effAnnotations("spellatk"), mode: effMode("spellatk") };
  }
  return null;
}
function fireRoll(btn, mode) {
  const info = rollInfo(btn); if (!info) return;
  // info.dice already carries its sign(s), e.g. "+1d4" (from the Misc field or an effect)
  // A click's own Shift/Ctrl modifier wins over an effect-forced mode (e.g. Alert doesn't force
  // advantage); an effect wins only when the user didn't ask for anything ("normal" from a plain click).
  const forced = (mode && mode !== "normal") ? mode : (info.mode || undefined);
  runRoll(`1d20${info.bonus >= 0 ? "+" + info.bonus : info.bonus}${info.dice || ""} ${info.label}`, forced);
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

/* ---------- Log ---------- */
function log(html) { const d = document.createElement("div"); d.innerHTML = html; const el = $("dicelog"); el.insertBefore(d, el.children[1] || null); }
function clearLog() { $("dicelog").innerHTML = "<div>— roll log —</div>"; }
