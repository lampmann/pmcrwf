/* ============================================================
   RESTING — Hit Dice pool tracking, plus the Short/Long Rest buttons'
   full automation (PHB'14 p186). applyRest() in class-library.js already
   owns feature-effect uses trackers (limited-use pips) and stays scoped to
   exactly that — this file adds everything else a rest actually does
   (temporary HP, current HP, Hit Dice, spell slots) and calls applyRest()
   itself, so the two rest buttons end up doing the whole job in one click.

   Hit Dice are tracked per class-table row, not as one undifferentiated
   pool: a multiclass character's dice are different sizes (a Fighter
   5 / Wizard 3 has 5d10 + 3d6, not 8 of one size), and each row already
   carries its own resolved Hit Die and level. Persisted state records only
   how many of a pool are spent — the max is always read live from the
   Classes table, the same "derive max live, persist only the counter"
   split every other tracker in this app uses (see USES_STATE).
   ============================================================ */
let HD_STATE = {};   // { "hd|<class name lowercased>": { spent: N } }
function hdKeyFor(className) { return "hd|" + (className || "").trim().toLowerCase(); }

/* One entry per class-table row with at least 1 level, mirroring maxHPAuto()'s own filter (derived.js)
   so "Hit Dice" and "Max HP" never disagree about which rows count. `spent` is clamped for *display*
   only — like renderUsesTracker's `Math.min(st.used, max)` — so a level dropped below its spent count
   isn't destructively lost if the level comes back up. */
function hitDicePools() {
  return getClasses().filter(c => c.lvl > 0).map(c => {
    const hitDie = c.hitDie === "auto" ? classHitDie(c.name) : c.hitDie;
    const key = hdKeyFor(c.name);
    const max = c.lvl;
    const spentRaw = (HD_STATE[key] && HD_STATE[key].spent) || 0;
    return { key, className: c.name.trim(), hitDie, max, spent: Math.max(0, Math.min(spentRaw, max)) };
  });
}

function renderHitDice() {
  const el = $("hit-dice-pools"); if (!el) return;
  const pools = hitDicePools();
  if (!pools.length) { el.innerHTML = `<span class="hint">add a class above to track Hit Dice</span>`; return; }
  el.innerHTML = pools.map(p => `
    <span class="hd-pool" style="white-space:nowrap;margin-right:.7rem">
      <b>${p.hitDie}</b>
      <input type="text" inputmode="numeric" class="tiny hd-spent" data-hdkey="${p.key}" value="${p.spent}" title="Hit Dice spent — edit to correct, or use roll to spend one and heal">
      / ${p.max}
      <button type="button" class="roll" data-hdkey="${p.key}"${p.spent >= p.max ? " disabled" : ""} title="spend one Hit Die: roll ${p.hitDie} + CON mod, heal (min 0), mark it spent">roll</button>
      <span class="hint">${escapeHtml(p.className || "class")}</span>
    </span>`).join("");
}

/* Spend one Hit Die from a pool: roll it (logged, like every other roll in the app), heal for the
   total (minimum 0 per PHB'14 p186 — a negative CON mod can zero it out but never costs HP), and mark
   the die spent. This is the only place Hit Dice get spent — short rest itself doesn't force it,
   since spending is explicitly the player's per-die choice ("the player CAN decide to spend..."). */
function spendHitDie(key) {
  const pool = hitDicePools().find(p => p.key === key);
  if (!pool || pool.spent >= pool.max) return;
  const dieMax = HIT_DIE_MAX[pool.hitDie] || 8;
  const conMod = abilityMod("con");
  const modStr = conMod === 0 ? "" : sign(conMod);
  const rolled = runRoll(`1d${dieMax}${modStr} Hit Die (${pool.className || "class"})`);
  const healed = Math.max(0, rolled);
  const st = HD_STATE[key] || (HD_STATE[key] = { spent: 0 });
  st.spent = Math.min(pool.max, st.spent + 1);
  if (healed > 0) {
    $("hp-cur").value = String(Math.min(maxHP(), num($("hp-cur")) + healed));
    commitMath($("hp-cur"));
  }
  recompute(); renderHitDice(); scheduleSave();
}

/* Direct correction of a pool's spent count (e.g. a misclick, or importing a character mid-adventure)
   — doesn't roll or touch HP, same "always give an override" rule the rest of the sheet follows. */
function correctHitDiceSpent(input) {
  const key = input.dataset.hdkey;
  const pool = hitDicePools().find(p => p.key === key);
  if (!pool) return;
  const v = Math.max(0, Math.min(pool.max, Math.round(Number(input.value)) || 0));
  HD_STATE[key] = { spent: v };
  recompute(); renderHitDice(); scheduleSave();
}

/* Clears a math-field-style HP box (data-allow-empty) the same way a user emptying it by hand would,
   so it participates correctly in commitMath's own min/max/prev bookkeeping. */
function clearHpField(id) {
  const el = $(id); if (!el || el.value === "") return;
  el.value = ""; commitMath(el);
}

/* Full rest automation (PHB'14 p186), on top of applyRest()'s feature-effect uses reset:
     - Temporary HP "last until they're depleted or you finish A rest" (p197) — cleared on both.
     - Short rest: nothing else is automatic. Hit Dice healing is the player's per-die choice
       (see spendHitDie above), and normal spell slots don't recover on a short rest.
     - Long rest: full HP, spent Hit Dice regained up to half the total (min 1), all spell slots
       reset. A character "must have at least 1 hit point at the start of the rest to gain its
       benefits" (p186) — below that, a long rest does nothing at all, so the guard returns before
       touching any state, exactly like getting no benefit from one. */
function performRest(kind) {
  if (kind === "lr") {
    const raw = ($("hp-cur").value || "").trim();
    if (raw !== "" && Number(raw) <= 0) {
      const ok = confirm("This character is at 0 HP or below. Per PHB p186, a long rest grants no benefit unless you have at least 1 hit point at the start of it — nothing will be restored. Apply it anyway?");
      if (!ok) return;
    }
  }
  clearHpField("hp-temp");
  if (kind === "lr") {
    $("hp-cur").value = String(maxHP());
    commitMath($("hp-cur"));

    // Regain spent Hit Dice up to half the total (minimum 1 if you have any at all). RAW doesn't say
    // which pool a multiclass character regains into when dice of different sizes are mixed — this
    // fills pools in Classes-table order, the same "approximate for multiclass, documented" tradeoff
    // the rest of the sheet already makes for total-level-driven values (see conversion-guide.md).
    const pools = hitDicePools();
    const totalDice = pools.reduce((s, p) => s + p.max, 0);
    if (totalDice > 0) {
      let regain = Math.max(1, Math.floor(totalDice / 2));
      pools.forEach(p => {
        if (regain <= 0) return;
        const st = HD_STATE[p.key] || (HD_STATE[p.key] = { spent: 0 });
        const give = Math.min(st.spent, regain);
        st.spent -= give; regain -= give;
      });
    }

    for (let i = 1; i <= 9; i++) clearHpField("slot-used-" + i);
  }
  applyRest(kind);   // feature-effect uses trackers (class-library.js) — also renders the Features panel
  recompute(); renderHitDice(); scheduleSave();
}

document.addEventListener("DOMContentLoaded", () => {
  const area = $("hit-dice-pools");
  if (area) {
    area.addEventListener("click", e => {
      const btn = e.target.closest("[data-hdkey]"); if (btn && btn.tagName === "BUTTON" && !btn.disabled) spendHitDie(btn.dataset.hdkey);
    });
    area.addEventListener("change", e => {
      const inp = e.target.closest(".hd-spent"); if (inp) correctHitDiceSpent(inp);
    });
  }
  // Re-render only when the Classes table structurally changes (row added/removed, or a name/level/
  // Hit Die edit commits) — never from the blanket recompute() (see derived.js's comment on why).
  // Mirrors class-library.js's identical observer for the Features panel exactly. renderHitDice()
  // itself no-ops if #hit-dice-pools isn't on the page, so this is safe to register regardless.
  const cr = $("class-rows");
  if (cr) new MutationObserver(() => renderHitDice()).observe(cr, { childList: true });
  document.addEventListener("input", e => { if (e.target.closest && e.target.closest("#class-rows")) renderHitDice(); });
  renderHitDice();   // initial paint — a fresh sheet's empty class-rows table still needs its hint shown
});
