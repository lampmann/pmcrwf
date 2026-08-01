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
   isn't destructively lost if the level comes back up.

   `spent` is what gets persisted (it starts at 0 for a fresh character, so a new pool needs no
   initialisation), but `remaining` is what the UI counts down: 17 Hit Dice reads "17/17", and drops
   to "16/17" once you roll one — the same direction as every other consumable pool on a sheet. */
function hitDicePools() {
  return getClasses().filter(c => c.lvl > 0).map(c => {
    const hitDie = c.hitDie === "auto" ? classHitDie(c.name) : c.hitDie;
    const key = hdKeyFor(c.name);
    const max = c.lvl;
    const spentRaw = (HD_STATE[key] && HD_STATE[key].spent) || 0;
    const spent = Math.max(0, Math.min(spentRaw, max));
    return { key, className: c.name.trim(), hitDie, max, spent, remaining: max - spent };
  });
}

/* Shared by the HP module's inline row and the Short Rest dialog, so the two can never drift apart
   in what they show or which pools they consider spendable. */
function hitDicePoolHtml(p) {
  return `<span class="hd-pool" style="white-space:nowrap;margin-right:.7rem">
      <b>${p.hitDie}</b>
      <input type="text" inputmode="numeric" class="tiny hd-remaining" data-hdkey="${p.key}" value="${p.remaining}" title="Hit Dice remaining — edit to correct, or use roll to spend one and heal">
      / ${p.max}
      <button type="button" class="roll" data-hdkey="${p.key}"${p.remaining <= 0 ? " disabled" : ""} title="spend one Hit Die: roll ${p.hitDie} + CON mod, heal (min 0), mark it spent">roll</button>
      <span class="hint">${escapeHtml(p.className || "class")}</span>
    </span>`;
}

function renderHitDice() {
  const el = $("hit-dice-pools"); if (!el) return;
  const pools = hitDicePools();
  if (!pools.length) { el.innerHTML = `<span class="hint">add a class above to track Hit Dice</span>`; return; }
  el.innerHTML = pools.map(hitDicePoolHtml).join("");
}

/* Spend one Hit Die from a pool: roll it (logged, like every other roll in the app), heal for the
   total (minimum 0 per PHB'14 p186 — a negative CON mod can zero it out but never costs HP), and mark
   the die spent. This is the only place Hit Dice get spent — short rest itself doesn't force it,
   since spending is explicitly the player's per-die choice ("the player CAN decide to spend..."). */
function spendHitDie(key) {
  const pool = hitDicePools().find(p => p.key === key);
  if (!pool || pool.remaining <= 0) return;
  const dieMax = HIT_DIE_MAX[pool.hitDie] || 8;
  const conMod = abilityMod("con");
  const modStr = conMod === 0 ? "" : sign(conMod);
  const rolled = runRoll(`1d${dieMax}${modStr} Hit Die (${pool.className || "class"})`);
  const healed = Math.max(0, rolled);
  const st = HD_STATE[key] || (HD_STATE[key] = { spent: 0 });
  st.spent = Math.min(pool.max, st.spent + 1);
  const before = num($("hp-cur"));
  if (healed > 0) {
    $("hp-cur").value = String(Math.min(maxHP(), num($("hp-cur")) + healed));
    commitMath($("hp-cur"));
  }
  // The roll itself is already in the log via runRoll; this second line reports what it did to the
  // sheet, which the roll line can't know (overheal clamping, the min-0 floor, remaining dice).
  const gained = num($("hp-cur")) - before;
  logEvent("hp", `<b>${gained >= 0 ? "+" : ""}${gained} HP</b> &larr; Hit Die (${escapeHtml(pool.className || "class")}), ` +
    `now ${num($("hp-cur"))}/${maxHP()} &middot; ${pool.remaining - 1}/${pool.max} ${pool.hitDie} left`);
  recompute(); renderHitDice(); renderShortRestModal(); scheduleSave();
}

/* Direct correction of a pool's remaining count (e.g. a misclick, or importing a character
   mid-adventure) — doesn't roll or touch HP, same "always give an override" rule the rest of the
   sheet follows. The box shows *remaining*, so it's stored back as max - remaining. */
function correctHitDiceRemaining(input) {
  const key = input.dataset.hdkey;
  const pool = hitDicePools().find(p => p.key === key);
  if (!pool) return;
  const remaining = Math.max(0, Math.min(pool.max, Math.round(Number(input.value)) || 0));
  HD_STATE[key] = { spent: pool.max - remaining };
  recompute(); renderHitDice(); renderShortRestModal(); scheduleSave();
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
  const notes = [];                                    // what actually changed, for the event log
  if (($("hp-temp").value || "").trim() !== "") notes.push("Temp HP cleared");
  clearHpField("hp-temp");
  if (kind === "lr") {
    const hpBefore = num($("hp-cur"));
    $("hp-cur").value = String(maxHP());
    commitMath($("hp-cur"));
    if (maxHP() !== hpBefore) notes.push(`HP ${hpBefore} &rarr; ${maxHP()}`);

    // Regain spent Hit Dice up to half the total (minimum 1 if you have any at all). RAW doesn't say
    // which pool a multiclass character regains into when dice of different sizes are mixed — this
    // fills pools in Classes-table order, the same "approximate for multiclass, documented" tradeoff
    // the rest of the sheet already makes for total-level-driven values (see conversion-guide.md).
    const pools = hitDicePools();
    const totalDice = pools.reduce((s, p) => s + p.max, 0);
    if (totalDice > 0) {
      let regain = Math.max(1, Math.floor(totalDice / 2)), regained = 0;
      pools.forEach(p => {
        if (regain <= 0) return;
        const st = HD_STATE[p.key] || (HD_STATE[p.key] = { spent: 0 });
        const give = Math.min(st.spent, regain);
        st.spent -= give; regain -= give; regained += give;
      });
      if (regained) notes.push(`${regained} Hit ${regained === 1 ? "Die" : "Dice"} regained`);
    }

    const usedSlots = [];
    for (let i = 1; i <= 9; i++) if (($("slot-used-" + i).value || "").trim() !== "") usedSlots.push(i);
    for (let i = 1; i <= 9; i++) clearHpField("slot-used-" + i);
    if (usedSlots.length) notes.push(`spell slots restored (level${usedSlots.length === 1 ? " " + usedSlots[0] : "s " + usedSlots.join(", ")})`);
  }
  const recovered = applyRest(kind);   // feature-effect uses trackers (class-library.js) — also renders the Features panel
  if (recovered) notes.push(`${recovered} feature${recovered === 1 ? "" : "s"} recovered`);
  logEvent("rest", `<b>${kind === "lr" ? "Long Rest" : "Short Rest"}</b>` +
    (notes.length ? " &mdash; " + notes.join(" &middot; ") : " &mdash; nothing to restore"));
  recompute(); renderHitDice(); scheduleSave();
}

/* ===== Short Rest dialog =====
   Spending Hit Dice is explicitly a per-die decision made at the end of a short rest ("the player can
   decide to spend an additional Hit Die after each roll", PHB p186), so the dialog rolls them one at a
   time and shows the running HP total between rolls rather than asking for a count up front.

   Each roll applies immediately — it's a real roll, already in the event log, and undoing it would
   mean rewinding HP and the die. "Finish Short Rest" is what applies the *rest* (temp HP, feature
   uses); closing without it leaves any dice you rolled spent, which the dialog says outright. */
function renderShortRestModal() {
  const modal = $("short-rest-modal");
  if (!modal || modal.style.display === "none") return;   // only re-render while it's actually open
  const pools = hitDicePools();
  const hpEl = $("sr-modal-hp"), poolsEl = $("sr-modal-pools");
  if (hpEl) hpEl.innerHTML = `Current HP: <b>${num($("hp-cur"))}</b> / ${maxHP()}`;
  if (poolsEl) {
    poolsEl.innerHTML = pools.length
      ? pools.map(hitDicePoolHtml).join("")
      : `<span class="hint">no Hit Dice — add a class in the Character module</span>`;
  }
}
function openShortRestModal() {
  const modal = $("short-rest-modal"); if (!modal) { performRest("sr"); return; }
  modal.style.display = "";
  renderShortRestModal();
}
function closeShortRestModal() {
  const modal = $("short-rest-modal"); if (modal) modal.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  // The HP module's inline row and the Short Rest dialog render identical pool markup
  // (hitDicePoolHtml), so they take the identical pair of handlers.
  [$("hit-dice-pools"), $("sr-modal-pools")].forEach(area => {
    if (!area) return;
    area.addEventListener("click", e => {
      const btn = e.target.closest("[data-hdkey]"); if (btn && btn.tagName === "BUTTON" && !btn.disabled) spendHitDie(btn.dataset.hdkey);
    });
    area.addEventListener("change", e => {
      const inp = e.target.closest(".hd-remaining"); if (inp) correctHitDiceRemaining(inp);
    });
  });
  const srCancel = $("sr-modal-cancel"), srFinish = $("sr-modal-finish"), srModal = $("short-rest-modal");
  if (srCancel) srCancel.addEventListener("click", closeShortRestModal);
  if (srFinish) srFinish.addEventListener("click", () => { closeShortRestModal(); performRest("sr"); });
  // Click the backdrop (never the box itself) or press Esc to dismiss, same as any modal.
  if (srModal) srModal.addEventListener("click", e => { if (e.target === srModal) closeShortRestModal(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && srModal && srModal.style.display !== "none") closeShortRestModal();
  });
  // Re-render only when the Classes table structurally changes (row added/removed, or a name/level/
  // Hit Die edit commits) — never from the blanket recompute() (see derived.js's comment on why).
  // Mirrors class-library.js's identical observer for the Features panel exactly. renderHitDice()
  // itself no-ops if #hit-dice-pools isn't on the page, so this is safe to register regardless.
  const cr = $("class-rows");
  if (cr) new MutationObserver(() => renderHitDice()).observe(cr, { childList: true });
  document.addEventListener("input", e => { if (e.target.closest && e.target.closest("#class-rows")) renderHitDice(); });
  renderHitDice();   // initial paint — a fresh sheet's empty class-rows table still needs its hint shown
});
