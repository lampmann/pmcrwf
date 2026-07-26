/* ============================================================
   routines.js — Offensive Routines.
   A routine is a named sequence of steps you fire in one click: your
   actual turn. Two kinds of step:

     • attack step — references a row in the Attacks module by its stable
       id, with a count ("2× Halberd" for Extra Attack, "1× Halberd (PAM)"
       for the bonus-action swing). Referencing by id, not by name, means
       renaming or reordering attacks doesn't break a routine.
     • save step — a save-based effect (Toll the Dead, Fireball). It has no
       to-hit roll; it reports the DC and which save the target makes, then
       rolls its damage. The DC defaults to the sheet's own spell save DC
       (auto, so it tracks your stats) but can be overridden per step, since
       a routine might mix a class DC with an item's fixed DC.

   Running a routine emits ONE log entry containing every roll in order plus
   a damage total, instead of many separate lines — the roll log prepends
   entries, so separate lines would read backwards.

   Rolls reuse the Attacks module's plumbing (rollAttackById / diceRollExpr),
   which in turn uses the dice engine, so advantage/disadvantage and crit
   flagging behave exactly like a single attack: Shift/Ctrl on Run applies to
   every attack roll in the routine.

   ROUTINES is character data, persisted via persistence.js.
   ============================================================ */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? "" : v).replace(/"/g, "&quot;");
  const ABILS = [["str", "Str"], ["dex", "Dex"], ["con", "Con"], ["int", "Int"], ["wis", "Wis"], ["cha", "Cha"]];
  const abilLabel = a => (ABILS.find(x => x[0] === a) || [, a])[1];
  let seq = 0;
  const newId = () => "r" + Date.now().toString(36) + (++seq);

  window.ROUTINES = window.ROUTINES || [];
  const routineById = id => ROUTINES.find(r => r.id === id);

  function attackChoices() { return (typeof attacksForRoutines === "function") ? attacksForRoutines() : []; }
  function attackLabel(atkId) {
    const a = attackChoices().find(x => x.id === atkId);
    return a ? { name: a.name, detail: `to hit ${a.bonus >= 0 ? "+" + a.bonus : a.bonus}${a.dice || ""}${a.dmg ? ", dmg " + a.dmg : ""}` }
             : { name: "(deleted attack)", detail: "this attack no longer exists — remove the step or re-add it" };
  }

  /* ---------- rendering ---------- */
  function stepRowHtml(rt, st, i) {
    const del = `<td><button class="rowbtn rt-step-del" data-rid="${rt.id}" data-i="${i}">x</button></td>`;
    if (st.t === "atk") {
      const { name, detail } = attackLabel(st.atkId);
      return `<tr><td style="white-space:nowrap">
          <input type="number" class="tiny rt-count" data-rid="${rt.id}" data-i="${i}" min="1" max="20" value="${Number(st.count) || 1}">×
        </td><td><b>${escapeHtml(name)}</b> <span class="hint">${escapeHtml(detail)}</span></td>
        <td class="hint">attack</td>${del}</tr>`;
    }
    const dcAuto = st.dcMode !== "custom";
    const dcNow = dcAuto ? (typeof spellSaveDC === "function" ? spellSaveDC() : 0) : (Number(st.dc) || 0);
    return `<tr><td colspan="2">
        <input type="text" class="rt-sv-name" data-rid="${rt.id}" data-i="${i}" value="${esc(st.name)}" placeholder="Toll the Dead" style="width:9rem">
        <select class="rt-sv-abil" data-rid="${rt.id}" data-i="${i}">
          ${ABILS.map(([v, l]) => `<option value="${v}"${st.abil === v ? " selected" : ""}>${l}</option>`).join("")}
        </select> save
        <label class="hint" title="use the sheet's own spell save DC, so it follows your stats">
          <input type="checkbox" class="rt-sv-auto" data-rid="${rt.id}" data-i="${i}"${dcAuto ? " checked" : ""}> auto DC
        </label>
        <input type="number" class="tiny rt-sv-dc" data-rid="${rt.id}" data-i="${i}" value="${dcNow}"${dcAuto ? " disabled" : ""}>
        <input type="text" class="rt-sv-dmg" data-rid="${rt.id}" data-i="${i}" value="${esc(st.dmg)}" placeholder="2d8" style="width:4.5rem">
        <select class="rt-sv-onsave" data-rid="${rt.id}" data-i="${i}">
          <option value="none"${st.onSave === "none" ? " selected" : ""}>no damage on save</option>
          <option value="half"${st.onSave === "half" ? " selected" : ""}>half on save</option>
        </select>
      </td><td class="hint">save</td>${del}</tr>`;
  }
  function routineHtml(rt) {
    const opts = attackChoices().map(a => `<option value="${esc(a.id)}">${escapeHtml(a.name)}</option>`).join("");
    const steps = rt.steps.length
      ? `<table><tbody>${rt.steps.map((st, i) => stepRowHtml(rt, st, i)).join("")}</tbody></table>`
      : `<div class="hint">No steps yet — add an attack or a save-based effect below.</div>`;
    return `<fieldset data-rid="${rt.id}">
      <legend>
        <input type="text" class="rt-name" data-rid="${rt.id}" value="${esc(rt.name)}" placeholder="Routine name" style="width:12rem">
        <button class="roll rt-run" data-rid="${rt.id}" title="roll every step (Shift = advantage, Ctrl = disadvantage on all attacks)">▶ run</button>
        <button class="rowbtn rt-del" data-rid="${rt.id}" title="delete this routine">x</button>
      </legend>
      ${steps}
      <div style="margin-top:.3rem">
        ${opts ? `<select class="rt-add-atk-sel" data-rid="${rt.id}">${opts}</select>
        <button class="rt-add-atk" data-rid="${rt.id}">+ attack step</button>`
        : `<span class="hint">Add an attack in the Attacks module first.</span>`}
        <button class="rt-add-save" data-rid="${rt.id}">+ save step</button>
      </div>
    </fieldset>`;
  }
  function renderRoutines() {
    const host = $("routines-list"); if (!host) return;
    host.innerHTML = ROUTINES.length ? ROUTINES.map(routineHtml).join("")
      : `<div class="hint">No routines yet. Click <b>+ add routine</b>, then add steps — e.g. 2× Halberd plus 1× Halberd (Polearm Master bonus action).</div>`;
  }

  /* ---------- running ---------- */
  function runRoutine(rt, mode) {
    const lines = []; let total = 0, anyDamage = false;
    rt.steps.forEach(st => {
      if (st.t === "atk") {
        const n = Math.max(1, Math.min(20, Number(st.count) || 1));
        for (let i = 0; i < n; i++) {
          const res = (typeof rollAttackById === "function") ? rollAttackById(st.atkId, mode) : null;
          if (!res) { lines.push(`  <i>(skipped a step — its attack no longer exists)</i>`); break; }
          lines.push(`  <b>${escapeHtml(res.name)}</b>${n > 1 ? ` #${i + 1}` : ""} — ${res.hitText}${res.dmgText ? " · " + res.dmgText : ""}`);
          if (res.dmgText) { total += res.damage; anyDamage = true; }
        }
      } else {
        const dc = st.dcMode === "custom" ? (Number(st.dc) || 0) : (typeof spellSaveDC === "function" ? spellSaveDC() : 0);
        const name = st.name || "Save effect";
        let dmgTxt = "";
        if (st.dmg && st.dmg.trim() && typeof diceRollExpr === "function") {
          const dm = diceRollExpr(st.dmg.trim(), "normal");
          total += dm.value; anyDamage = true;
          dmgTxt = ` · <b>${dm.value}</b> damage ← ${dm.display}`;
        }
        const onSave = st.onSave === "half" ? " <span class='hint'>[half on save]</span>" : " <span class='hint'>[none on save]</span>";
        lines.push(`  <b>${escapeHtml(name)}</b> — <b>DC ${dc} ${abilLabel(st.abil || "dex")}</b> save${dmgTxt}${onSave}`);
      }
    });
    if (!lines.length) { log(`<b>${escapeHtml(rt.name || "Routine")}</b> — no steps to roll.`); return; }
    const modeTag = (mode && mode !== "normal") ? ` <i>(${mode})</i>` : "";
    const totalLine = anyDamage ? `\n  <b>Total damage: ${total}</b> <span class="hint">(before resistances; crits don't auto-double dice yet)</span>` : "";
    log(`▶ <b>${escapeHtml(rt.name || "Routine")}</b>${modeTag}\n${lines.join("\n")}${totalLine}`);
  }

  /* ---------- events ---------- */
  function save() { if (typeof scheduleSave === "function") scheduleSave(); }
  function withStep(el, fn) {
    const rt = routineById(el.dataset.rid); if (!rt) return;
    const st = rt.steps[Number(el.dataset.i)]; if (!st) return;
    fn(rt, st);
  }
  document.addEventListener("DOMContentLoaded", () => {
    const add = $("btn-add-routine");
    if (add) add.addEventListener("click", () => {
      ROUTINES.push({ id: newId(), name: "New routine", steps: [] });
      renderRoutines(); save();
    });
    const host = $("routines-list");
    if (!host) return;
    host.addEventListener("click", e => {
      const run = e.target.closest(".rt-run");
      if (run) { const rt = routineById(run.dataset.rid); if (rt) runRoutine(rt, modeFromEvent(e)); return; }
      const del = e.target.closest(".rt-del");
      if (del) { const i = ROUTINES.findIndex(r => r.id === del.dataset.rid); if (i >= 0 && confirm("Delete this routine?")) { ROUTINES.splice(i, 1); renderRoutines(); save(); } return; }
      const addA = e.target.closest(".rt-add-atk");
      if (addA) {
        const rt = routineById(addA.dataset.rid); if (!rt) return;
        const sel = host.querySelector(`.rt-add-atk-sel[data-rid="${addA.dataset.rid}"]`);
        if (sel && sel.value) { rt.steps.push({ t: "atk", atkId: sel.value, count: 1 }); renderRoutines(); save(); }
        return;
      }
      const addS = e.target.closest(".rt-add-save");
      if (addS) {
        const rt = routineById(addS.dataset.rid); if (!rt) return;
        rt.steps.push({ t: "save", name: "", abil: "wis", dcMode: "auto", dc: 0, dmg: "", onSave: "none" });
        renderRoutines(); save(); return;
      }
      const delStep = e.target.closest(".rt-step-del");
      if (delStep) {
        const rt = routineById(delStep.dataset.rid); if (!rt) return;
        rt.steps.splice(Number(delStep.dataset.i), 1); renderRoutines(); save(); return;
      }
    });
    // field edits: update the model in place (no re-render, so focus/caret stay put)
    host.addEventListener("input", e => {
      const t = e.target;
      if (t.classList.contains("rt-name")) { const rt = routineById(t.dataset.rid); if (rt) { rt.name = t.value; save(); } return; }
      if (t.classList.contains("rt-count")) { withStep(t, (rt, st) => { st.count = Math.max(1, Math.min(20, Number(t.value) || 1)); save(); }); return; }
      if (t.classList.contains("rt-sv-name")) { withStep(t, (rt, st) => { st.name = t.value; save(); }); return; }
      if (t.classList.contains("rt-sv-dmg")) { withStep(t, (rt, st) => { st.dmg = t.value; save(); }); return; }
      if (t.classList.contains("rt-sv-dc")) { withStep(t, (rt, st) => { st.dc = Number(t.value) || 0; save(); }); return; }
    });
    host.addEventListener("change", e => {
      const t = e.target;
      if (t.classList.contains("rt-sv-abil")) { withStep(t, (rt, st) => { st.abil = t.value; save(); }); return; }
      if (t.classList.contains("rt-sv-onsave")) { withStep(t, (rt, st) => { st.onSave = t.value; save(); }); return; }
      if (t.classList.contains("rt-sv-auto")) {
        withStep(t, (rt, st) => { st.dcMode = t.checked ? "auto" : "custom"; save(); });
        renderRoutines(); return;   // re-render to enable/disable the DC box and show the auto value
      }
    });
    renderRoutines();
  });

  // exposed for persistence.js and for the Attacks module (so renames/deletions refresh the pickers)
  window.renderRoutines = renderRoutines;
  window.setRoutines = list => { window.ROUTINES = Array.isArray(list) ? list : []; renderRoutines(); };
})();
