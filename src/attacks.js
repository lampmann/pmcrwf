/* ============================================================
   attacks.js — Attacks / Weapons (DRAFT).
   A table of weapon/attack rows. Per row: name, ability (Str / Dex /
   Finesse=higher of the two / —), proficient toggle, an "fx" toggle (see
   below), an attack "misc" field, damage dice, "add ability mod to damage"
   toggle, and a damage "misc" field. From those it computes a to-hit bonus
   and a damage expression, and gives you roll buttons: to hit, damage, or
   both at once.

   To-hit buttons use class "wpn-roll" so the shared dice engine
   (dice.js D20SEL / rollInfo / fireRoll) handles advantage/disadvantage,
   the right-click menu, and the modifier tooltip for free — attacks.js
   just keeps each button's data-bonus / data-dice / data-rolllabel current.
   The combined button (.wpn-both) is handled here instead, since it fires
   two rolls and reports them as one log entry.

   Each row carries a stable generated id (data-atkid) so the Routines
   module can reference an attack across renames and reordering.

   Rows live in the DOM (like the Classes table); getAttacks() serializes
   them and persistence.js stores the result in the character (collectState
   / applyState). Field edits autosave through app.js's global input
   listener; add/delete call scheduleSave directly.

   FEATURE EFFECTS: the engine's "attack-hit" and "damage-bonus" targets
   (Sharpshooter, Great Weapon Master, Rage, Divine Strike, Hexblade's
   Curse, …) fold into every row's to-hit and damage exactly like that
   row's own Hit+ / Dmg+ field, and an adv/dis on "attack-hit" (Reckless
   Attack, Vow of Enmity, Steady Aim) forces the to-hit roll's mode. The
   engine has no per-weapon predicate — one global bucket is all it can
   express — so each row carries an "fx" checkbox to opt out when a bonus
   doesn't belong to that weapon (Sharpshooter on your dagger, Rage on your
   longbow). New rows default to fx on. Whenever effects are folded in, the
   affected button is marked .has-eff and its tooltip names every
   contributing feature, so no number here is silently inflated; the roll
   log gets the same "[Feature +N]" annotations as the rest of the sheet.

   CRITS are modelled: a row's crit threshold comes from the engine's
   "attack-crit-range" target (Improved Critical's 19-20), and on a crit the
   damage dice are doubled and any "damage-crit" dice added on top. Both
   apply to a routine's swings as well as a single attack. What still can't
   be expressed is a crit die the WEAPON defines (Savage Attacks, Brutal
   Critical) — the engine has no per-weapon context, which is the same
   reason there's no weapon-property predicate.
   ============================================================ */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  // The shared escaper (text-utils.js), not a local quotes-only one: these values are written into
  // both HTML attributes and, via the roll log, into element bodies — a `"`-only escape is safe for
  // the former and not for the latter, and one attack name feeds both.
  const esc = v => escapeHtml(v || "");
  const signed = n => (n >= 0 ? "+" + n : "" + n);
  const ABILS = [["str", "Str"], ["dex", "Dex"], ["con", "Con"], ["int", "Int"], ["wis", "Wis"], ["cha", "Cha"], ["fin", "Finesse"], ["", "—"]];
  let idSeq = 0;
  const newId = () => "a" + (Date.now().toString(36)) + (++idSeq);

  /* Battle Smith / Hexblade-style "use INT instead of Strength or Dexterity": a feature effect can
     REPLACE the ability a row uses rather than adding to it, via `useability` on "attack-ability".
     Gated on the row's own fx flag like every other effect read, so a row it doesn't belong to opts
     out with the same checkbox as everything else. */
  function rowAbility(d) {
    const override = (d.fx && typeof effAbility === "function") ? effAbility("attack-ability") : null;
    return override || d.abil;
  }
  function attackAbilityMod(abil) {
    if (abil === "fin") return Math.max(abilityMod("str"), abilityMod("dex"));
    if (["str", "dex", "con", "int", "wis", "cha"].includes(abil)) return abilityMod(abil);
    return 0;
  }
  function rowData(tr) {
    return {
      id: tr.dataset.atkid,
      name: tr.querySelector(".atk-name").value,
      abil: tr.querySelector(".atk-abil").value,
      prof: tr.querySelector(".atk-prof").checked,
      fx: tr.querySelector(".atk-fx").checked,
      size: (tr.querySelector(".atk-size") || {}).value || "",   // only set for an oversized weapon
      atkMisc: tr.querySelector(".atk-misc").value,
      dmg: tr.querySelector(".atk-dmg").value,
      modDmg: tr.querySelector(".atk-moddmg").checked,
      dmgMisc: tr.querySelector(".atk-dmgmisc").value,
    };
  }
  const allRows = () => [...document.querySelectorAll("#attack-rows tr")];
  function getAttacks() { return allRows().map(rowData); }
  function rowById(id) { return allRows().find(tr => tr.dataset.atkid === id) || null; }

  /* ----- feature effects (see the header comment) — every read is gated on the row's own fx flag,
     so a row with fx off computes exactly as it did before the effects engine reached this module. */
  const fxFlat = (d, t) => (d.fx ? effFlat(t) : 0);
  const fxDice = (d, t) => (d.fx ? effDice(t) : "");
  const fxMode = (d, t) => (d.fx ? effMode(t) : null);
  const fxLabel = (d, t) => (d.fx ? effAnnotations(t) : "");
  // tooltip for a row button: which features contributed, plus any `note` reminders on that target
  function fxTitle(d, target, label) {
    if (!d.fx) return "";
    const parts = effContribs(target).map(c => `${c.source} ${typeof c.n === "number" ? signed(c.n) : c.n}`);
    const notes = effectsSnapshot().notes[target] || [];
    if (!parts.length && !notes.length) return "";
    return [parts.length ? `${label}: ${parts.join(", ")}` : "", ...notes].filter(Boolean).join("\n");
  }
  // The underline means "a number here was changed", so it tracks contributions only — a feature
  // that contributes nothing but a `note` still gets its reminder in the tooltip, unmarked.
  function paintFx(btn, d, target, label) {
    const title = fxTitle(d, target, label);
    btn.classList.toggle("has-eff", d.fx && effContribs(target).length > 0);
    if (title) btn.title = title; else btn.removeAttribute("title");
  }

  /* Proficiency Dice (DMG p263) applies to attack rolls as well as checks and saves, so a proficient
     row trades its flat bonus for the die — see proficiencyDiceTerm in variant-rules.js. */
  function toHit(d) {
    const pb = parseBonus(d.atkMisc);
    const profDie = (d.prof && typeof proficiencyDiceTerm === "function") ? proficiencyDiceTerm(1) : "";
    const flatProf = (d.prof && !profDie) ? profBonus() : 0;
    const b = attackAbilityMod(rowAbility(d)) + flatProf + pb.flat + fxFlat(d, "attack-hit");
    return { bonus: b, dice: pb.dice + profDie + fxDice(d, "attack-hit") };
  }
  function damageExpr(d) {
    const parts = [];
    if (d.dmg && d.dmg.trim()) parts.push(d.dmg.trim());
    if (d.modDmg) { const m = attackAbilityMod(rowAbility(d)); if (m) parts.push(signed(m)); }
    const pb = parseBonus(d.dmgMisc), flat = pb.flat + fxFlat(d, "damage-bonus");
    if (flat) parts.push(signed(flat));
    if (pb.dice) parts.push(pb.dice);   // already signed, e.g. "+1d6"
    const fd = fxDice(d, "damage-bonus");
    if (fd) parts.push(fd);
    // A row with no dice and no ability mod (a pure effect bonus, e.g. an unarmed row while Raging)
    // would otherwise start with a sign, which evalExpr can't parse as a leading unary operator.
    const expr = parts.join("");
    return /^\+/.test(expr) ? expr.slice(1) : /^-/.test(expr) ? "0" + expr : expr;
  }
  /* An oversized weapon gives disadvantage (DMG), which has to be reconciled with whatever a feature
     effect already forced on this row. Advantage and disadvantage cancel to a straight roll (PHB
     p173) rather than one winning, so that's what happens here. */
  function hitMode(d) {
    const fx = fxMode(d, "attack-hit") || "";
    const over = (typeof oversizedVerdict === "function") ? oversizedVerdict(d.size) : null;
    if (!over || !over.disadvantage) return fx;
    if (fx === "adv") return "";        // advantage + disadvantage = neither
    return "dis";
  }
  function updateRowDerived(tr) {
    const d = rowData(tr);
    const th = toHit(d), hitBtn = tr.querySelector(".wpn-roll");
    const over = (typeof oversizedVerdict === "function") ? oversizedVerdict(d.size) : null;
    hitBtn.dataset.bonus = th.bonus; hitBtn.dataset.dice = th.dice;
    hitBtn.dataset.mode = hitMode(d);   // read back by rollInfo() in dice.js
    // Improved Critical and friends widen the range; dice.js reads this off the button.
    hitBtn.dataset.critmin = (d.fx && typeof effCritMin === "function") ? effCritMin("attack-crit-range") : 20;
    hitBtn.dataset.rolllabel = (d.name || "Attack") + " to hit" + fxLabel(d, "attack-hit") +
      (over && over.disadvantage ? " (oversized)" : "");
    hitBtn.textContent = "to hit " + signed(th.bonus) + (th.dice || "");
    paintFx(hitBtn, d, "attack-hit", "To hit");
    /* Unusable is stated and styled, never blocked — the button still rolls. Same rule as the rest of
       the sheet: the DM is at the table and this one is explicitly a "you can rule that…" suggestion. */
    tr.classList.toggle("atk-oversized", !!(over && over.disadvantage));
    tr.classList.toggle("atk-unusable", !!(over && over.unusable));
    const sizeSel = tr.querySelector(".atk-size");
    if (sizeSel) sizeSel.title = (over && over.note) || "the size this weapon is made for — only set it for an oversized weapon";
    const dmg = damageExpr(d), dmgBtn = tr.querySelector(".wpn-dmg");
    dmgBtn.dataset.expr = dmg;
    // Savage Attacks / Brutal Critical: dice added only on a crit. Carried on the button so the
    // crit path can pick them up without recomputing the row.
    dmgBtn.dataset.critdice = (d.fx && typeof effDice === "function") ? effDice("damage-crit") : "";
    dmgBtn.textContent = dmg ? "dmg " + dmg : "dmg —";
    dmgBtn.disabled = !dmg;
    paintFx(dmgBtn, d, "damage-bonus", "Damage");
    const cm = Number(hitBtn.dataset.critmin) || 20;
    const cd = dmgBtn.dataset.critdice;
    if (cm < 20 || cd) {
      tr.querySelector(".atk-name").title =
        [cm < 20 ? `crits on ${cm}-20` : "", cd ? `crit adds ${cd}` : ""].filter(Boolean).join(" · ");
    }
  }
  function updateAllDerived() { allRows().forEach(updateRowDerived); }

  /* ----- rolling (shared with the Routines module) -----
     Rolls through the dice engine's evalExpr/applyMode rather than runRoll, so the caller decides
     how to present the result: a single attack logs one line, a routine collects many into one block. */
  function rollExpr(expr, mode) {
    const r = evalExpr(applyMode(expr, mode || "normal"));
    return { value: r.value, display: r.display, d20: (typeof _d20kept !== "undefined" ? _d20kept.slice() : []) };
  }
  /* The crit threshold for this row. Improved Critical / Superior Critical widen it to 19 or 18; the
     engine keeps the lowest, and the row's fx flag gates it like every other effect read. */
  function critMinFor(d) { return (d.fx && typeof effCritMin === "function") ? effCritMin("attack-crit-range") : 20; }
  function isCrit(d20, min) { return d20.length === 1 && d20[0] >= (min || 20); }
  function critNote(d20, min) {
    if (d20.length !== 1) return "";
    if (isCrit(d20, min)) return (min || 20) < 20 ? `  <b>Critical Success!</b> <i>(${min}-20)</i>` : "  <b>Critical Success!</b>";
    if (d20[0] === 1) return "  <b>Critical Failure!</b>";
    return "";
  }
  /* Crit damage: double every dice term (the standard rule), then add whatever `damage-crit` grants —
     Savage Attacks and Brutal Critical add dice ONLY on a crit, which is why they can't live in the
     ordinary damage expression. Those extra dice are added once, not doubled: the feature already
     says how many dice a crit adds. */
  function critDamageExpr(d, base) {
    const extra = (d.fx && typeof effDice === "function") ? effDice("damage-crit") : "";
    const doubled = doubleDiceExpr(base);
    return extra ? doubled + extra : doubled;
  }
  // Same policy as fireRoll() in dice.js: the caller's own Shift/Ctrl wins, and an effect-forced
  // mode (Reckless Attack, Vow of Enmity, Steady Aim) only applies to a plain "normal" roll.
  function resolveMode(d, mode) { return (mode && mode !== "normal") ? mode : (fxMode(d, "attack-hit") || "normal"); }

  // { hitText, dmgText, damage } for one swing of an attack; used by both .wpn-both and routines.
  function rollAttackOnce(d, requested) {
    const th = toHit(d), name = d.name || "Attack", mode = resolveMode(d, requested);
    const cm = critMinFor(d);
    const hit = rollExpr(`1d20${signed(th.bonus)}${th.dice || ""}`, mode);
    const modeTag = (mode && mode !== "normal") ? ` <i>(${mode})</i>` : "";
    const crit = isCrit(hit.d20, cm);
    const out = { hitText: `<b>${hit.value}</b> to hit${modeTag} ← ${hit.display}${critNote(hit.d20, cm)}`, dmgText: "", damage: 0, crit };
    const de = damageExpr(d);
    if (de) {
      const expr = crit ? critDamageExpr(d, de) : de;
      const dm = rollExpr(expr, "normal");
      out.dmgText = `<b>${dm.value}</b> damage${crit ? " <i>(crit)</i>" : ""} ← ${dm.display}`;
      out.damage = dm.value;
    }
    out.name = name;
    return out;
  }
  function rollBoth(tr, mode) {
    const d = rowData(tr), res = rollAttackOnce(d, mode);
    // res.name is a user-typed field; the log stores its HTML and re-injects it on every load, so it
    // has to be escaped here (hitText/dmgText are engine-built markup and are already safe).
    log(`<b>${esc(res.name)}</b> — ${res.hitText}${res.dmgText ? " · " + res.dmgText : ""}`);
  }

  // doubles each dice term in a damage expression (e.g. "1d8+3" -> "(1d8+1d8)+3") for crit damage,
  // per the standard 5e rule: roll damage dice twice, add flat modifiers once
  function doubleDiceExpr(expr) { return expr.replace(/\d*d\d+[a-z<>\d]*/gi, m => `(${m}+${m})`); }

  // one swing for the Routines module: same as rollAttackOnce, but also reports the raw to-hit total
  // (needed to build the AC-range damage table) and auto-doubles damage dice on a crit.
  function rollAttackForRoutine(tr, requested) {
    const d = rowData(tr), th = toHit(d), name = d.name || "Attack", mode = resolveMode(d, requested);
    const hit = rollExpr(`1d20${signed(th.bonus)}${th.dice || ""}`, mode);
    const modeTag = (mode && mode !== "normal") ? ` <i>(${mode})</i>` : "";
    // Named `crit` rather than shadowing the isCrit() helper above, and going through the same
    // threshold and crit-damage builder as rollAttackOnce so a widened crit range and any
    // damage-crit dice reach a routine's swings too.
    const cm = critMinFor(d);
    const crit = isCrit(hit.d20, cm);
    const out = { name, hitTotal: hit.value, isCrit: crit, hitText: `<b>${hit.value}</b> to hit${modeTag} ← ${hit.display}${critNote(hit.d20, cm)}`, dmgText: "", damage: 0 };
    const de = damageExpr(d);
    if (de) {
      const dm = rollExpr(crit ? critDamageExpr(d, de) : de, "normal");
      out.dmgText = `<b>${dm.value}</b> damage ← ${dm.display}${crit ? " <i>(crit, dice doubled)</i>" : ""}`;
      out.damage = dm.value;
    }
    return out;
  }

  function addAttackRow(data = {}) {
    const tr = document.createElement("tr");
    tr.dataset.atkid = data.id || newId();
    const opts = ABILS.map(([v, l]) => `<option value="${v}"${data.abil === v ? " selected" : ""}>${l}</option>`).join("");
    tr.innerHTML =
      `<td><input type="text" class="atk-name" value="${esc(data.name)}" style="width:8rem" placeholder="Longsword"></td>
       <td><select class="atk-abil">${opts}</select></td>
       <td style="text-align:center"><input type="checkbox" class="atk-prof"${data.prof ? " checked" : ""}></td>
       <td style="text-align:center"><input type="checkbox" class="atk-fx"${data.fx !== false ? " checked" : ""} title="apply feature effects (Sharpshooter, Rage, Divine Strike, …) to this attack"></td>
       <td><select class="atk-size" title="the size this weapon is made for — only set it for an oversized weapon">${
         [["", "—"], ["T", "T"], ["S", "S"], ["M", "M"], ["L", "L"], ["H", "H"], ["G", "G"]]
           .map(([v, l]) => `<option value="${v}"${(data.size || "") === v ? " selected" : ""}>${l}</option>`).join("")}</select></td>
       <td><input type="text" class="atk-misc tiny" value="${esc(data.atkMisc)}" placeholder="+0"></td>
       <td><button class="roll wpn-roll">to hit</button></td>
       <td><input type="text" class="atk-dmg" value="${esc(data.dmg)}" style="width:4.5rem" placeholder="1d8"></td>
       <td style="text-align:center"><input type="checkbox" class="atk-moddmg"${data.modDmg !== false ? " checked" : ""}></td>
       <td><input type="text" class="atk-dmgmisc tiny" value="${esc(data.dmgMisc)}" placeholder="+0"></td>
       <td><button class="roll wpn-dmg">dmg</button></td>
       <td><button class="roll wpn-both" title="roll the attack and its damage together (Shift = advantage, Ctrl = disadvantage)">atk+dmg</button></td>
       <td><button class="rowbtn atk-del">x</button></td>`;
    $("attack-rows").appendChild(tr);
    updateRowDerived(tr);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const add = $("btn-add-attack");
    if (add) add.addEventListener("click", () => { addAttackRow(); scheduleSave(); if (typeof renderRoutines === "function") renderRoutines(); });
    // Row fields, ability scores, level and proficiency all reach these numbers through recompute()
    // (derived.js), which calls updateAttackRows() below — the same pass that rebuilds the effects
    // snapshot, so a feature toggle flipped in the effects strip lands here too, not just typing.
    document.addEventListener("click", e => {
      const del = e.target.closest(".atk-del");
      if (del) { del.closest("tr").remove(); scheduleSave(); if (typeof renderRoutines === "function") renderRoutines(); return; }
      const both = e.target.closest(".wpn-both");
      if (both) { rollBoth(both.closest("tr"), modeFromEvent(e)); return; }
      const dmg = e.target.closest(".wpn-dmg");
      if (dmg && dmg.dataset.expr) {
        const tr = dmg.closest("tr"), d = rowData(tr);
        runRoll(dmg.dataset.expr + " " + (d.name || "Attack") + " damage" + fxLabel(d, "damage-bonus"));
      }
    });
    updateAllDerived();
  });

  // exposed for persistence.js, derived.js's recompute() and the Routines module
  window.getAttacks = getAttacks;
  window.addAttackRow = addAttackRow;
  window.updateAttackRows = () => { if ($("attack-rows")) updateAllDerived(); };
  // [{id, name, bonus, dice, dmg}] computed live — the Routines module's attack picker reads this
  window.attacksForRoutines = () => getAttacks().map(d => {
    const th = toHit(d);
    return { id: d.id, name: d.name || "(unnamed)", bonus: th.bonus, dice: th.dice, dmg: damageExpr(d) };
  });
  // one swing of the attack with this id, as text + damage total (no logging — the caller presents it)
  window.rollAttackById = (id, mode) => { const tr = rowById(id); return tr ? rollAttackOnce(rowData(tr), mode) : null; };
  // same, but for the Routines module: also reports the raw hit total and auto-doubles crit damage dice
  window.rollAttackForRoutineById = (id, mode) => { const tr = rowById(id); return tr ? rollAttackForRoutine(tr, mode) : null; };
  window.diceRollExpr = rollExpr;   // routines reuse the same roll/critical plumbing
})();
