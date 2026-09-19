/* ============================================================
   companions.js — Companions & Summons.

   The character-side half of the Bestiary Library: statblocks you've added
   to your own sheet and actually play with. Added only from the library
   (like items and spells), so the statblock is looked up live by key rather
   than copied and hand-edited — COMPANIONS stores what's yours to change
   (how many, their current HP, what level you cast the summon at) and
   nothing else.

   Built around how this table actually uses monsters: summons are
   everybody's business, not the GM's, and they arrive eight at a time.
   So a companion is a STACK of tokens, not one creature — Conjure Animals
   gives you one entry with eight wolves, each tracking its own HP, and one
   "x8 Bite" button that rolls all eight attacks and reports the total
   damage as a by-AC table (the same summary the Offensive Routines module
   produces for your own turn, reusing its acRangeRows).

   Scaling summons work off your sheet rather than a fixed number. A
   Tasha's summon's statblock ships symbolic values — {@hitYourSpellAttack}
   for to-hit, "summonSpellLevel"/"PB" inside damage — which monster-library.js
   parses through unresolved; they're substituted here, at roll time, from
   spellAttackBonus() / profBonus() and the companion's own cast level, so a
   Bestial Spirit's Maul tracks your stats the way it should.

   Rolling goes through the shared dice engine: d20 rolls use class
   "mon-roll" (registered in D20SEL, so Shift/Ctrl advantage, the
   right-click menu and the modifier tooltip all work exactly as they do on
   your own stats), and damage buttons run through runRoll like the Attacks
   module's.

   COMPANIONS is character data, persisted via persistence.js.
   ============================================================ */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? "" : v).replace(/"/g, "&quot;");
  const signed = n => (n >= 0 ? "+" + n : String(n));
  const ABILS = [["str", "Str"], ["dex", "Dex"], ["con", "Con"], ["int", "Int"], ["wis", "Wis"], ["cha", "Cha"]];
  let seq = 0;
  const newId = () => "c" + Date.now().toString(36) + (++seq);

  window.COMPANIONS = window.COMPANIONS || [];   // [{id, key, note, spellLevel, maxHpOverride, tokens:[{hp}]}]
  const byId = id => COMPANIONS.find(c => c.id === id);
  const idxOf = id => COMPANIONS.findIndex(c => c.id === id);
  const statOf = c => (typeof findMonsterByKey === "function" ? findMonsterByKey(c.key) : null);
  const monMod = score => Math.floor(((Number(score) || 10) - 10) / 2);

  /* ---------- derived numbers ---------- */
  function maxHp(c, m) {
    if (c.maxHpOverride !== "" && c.maxHpOverride != null && !isNaN(Number(c.maxHpOverride))) return Number(c.maxHpOverride);
    return m && m.hpAvg != null ? m.hpAvg : 0;
  }
  // A token's hp is null when the statblock has no computable maximum - a scaling summon's HP is
  // prose ("20 + 5 per level above 2nd"), not a number. Unknown is NOT dead: the creature is up
  // until someone actually writes a number in, otherwise a freshly cast summon would arrive at 0.
  const aliveTokens = c => (c.tokens || []).filter(t => t.hp == null || Number(t.hp) > 0);
  // A summon's cast level: what you chose, else the statblock's own minimum ("Summon Beast" is 2nd).
  function castLevel(c, m) {
    if (c.spellLevel != null && c.spellLevel !== "") return Number(c.spellLevel);
    return m && m.summonSpellLevel != null ? m.summonSpellLevel : null;
  }
  const ctxOf = (c, m) => ({ spellLevel: castLevel(c, m), minLevel: m && m.summonSpellLevel });

  // to-hit for one parsed action; a summon's {@hitYourSpellAttack} resolves to the caster's own bonus
  function actionToHit(act) {
    if (act.spellAtk) return typeof spellAttackBonus === "function" ? spellAttackBonus() : 0;
    return act.hit == null ? 0 : act.hit;
  }
  // Damage expression with the summon placeholders substituted (see the header note).
  // Whitespace is stripped, not just trimmed: 5e.tools writes damage as "2d4 + 2", and runRoll()
  // splits a command at its first space, so a spaced expression would roll as bare "2d4" and treat
  // "+ 2 …" as the label - silently dropping the modifier.
  function actionDamage(act, c, m) {
    const lvl = castLevel(c, m), pb = typeof profBonus === "function" ? profBonus() : 2;
    return act.dmg.map(d => d
      .replace(/\bPB\b/g, String(pb))
      .replace(/\bsummonSpellLevel\b/g, lvl == null ? "0" : String(lvl))
      .replace(/\s+/g, "")
    ).filter(Boolean).join("+");
  }
  // A monster can attempt any save; the ones it's listed for just have a better bonus than raw ability.
  function saveBonus(m, ab) {
    const listed = (m.save || {})[ab];
    if (listed != null && listed !== "") { const n = Number(String(listed).replace(/[^\d+-]/g, "")); if (!isNaN(n)) return n; }
    return monMod(m[ab]);
  }
  function skillBonus(m, slug) {
    const n = Number(String((m.skill || {})[slug] || "").replace(/[^\d+-]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  /* ---------- mutation ---------- */
  function save() { if (typeof scheduleSave === "function") scheduleSave(); }
  function addCompanion(key) {
    const m = typeof findMonsterByKey === "function" ? findMonsterByKey(key) : null;
    if (!m) return;
    const c = { id: newId(), key, note: "", spellLevel: m.summonSpellLevel != null ? m.summonSpellLevel : "", maxHpOverride: "", tokens: [] };
    setCount(c, 1, m);
    COMPANIONS.push(c);
    renderCompanions(); save();
  }
  function setCount(c, n, m) {
    const want = Math.max(0, Math.min(50, Math.round(Number(n) || 0)));
    const max = maxHp(c, m || statOf(c));
    c.tokens = c.tokens || [];
    while (c.tokens.length > want) c.tokens.pop();
    while (c.tokens.length < want) c.tokens.push({ hp: max > 0 ? max : null });
    return c;
  }

  /* ---------- rendering ---------- */
  function tokenHtml(c, i, t, max) {
    const unknown = t.hp == null;
    const dead = !unknown && Number(t.hp) <= 0;
    return `<span class="cmp-token${dead ? " dead" : ""}" aria-label="${dead ? "Down" : unknown ? "HP (maximum unknown)" : "Hit points"}">
      <input type="text" inputmode="numeric" class="tiny cmp-hp" data-cid="${c.id}" data-i="${i}" value="${unknown ? "" : Number(t.hp)}"
        data-prev="${unknown ? 0 : Number(t.hp)}" data-min="0"${max ? ` data-max="${max}"` : ""} data-allow-empty aria-label="type -7 to take 7 damage, +3 to heal 3">
      <span class="hint">/${max || "?"}</span></span>`;
  }
  function actionHtml(c, m, act, ai, group) {
    const alive = aliveTokens(c).length;
    const label = escapeHtml(act.name || "Attack");
    if (!act.isAttack) {
      const dc = act.dc != null ? ` <span class="hint">(DC ${act.dc}${act.saveAbil ? " " + act.saveAbil : ""})</span>` : "";
      return `<div class="cmp-act"><b>${label}.</b>${dc} <span class="cmp-act-text">${monsterInlineText(act.raw, m.name + " - " + act.name, ctxOf(c, m))}</span></div>`;
    }
    const hit = actionToHit(act), dmg = actionDamage(act, c, m);
    const reach = act.reach ? `reach ${act.reach} ft.` : act.range ? `range ${act.range} ft.` : "";
    return `<div class="cmp-act"><b>${label}</b> <span class="hint">${escapeHtml(reach)}</span>
      <button class="roll mon-roll" data-attack="true" data-bonus="${hit}" data-rolllabel="${esc(m.name + " - " + act.name)}">to hit ${signed(hit)}</button>
      ${dmg ? `<button class="roll cmp-dmg" data-expr="${esc(dmg)}" data-rolllabel="${esc(m.name + " - " + act.name)}">dmg ${escapeHtml(dmg)}</button>` : ""}
      ${alive > 1 ? `<button class="roll cmp-mass" data-cid="${c.id}" data-grp="${group}" data-ai="${ai}"
        aria-label="Roll all ${escapeHtml(m.name)} attacks">&times;${alive} all</button>` : ""}
    </div>`;
  }
  function companionHtml(c) {
    const m = statOf(c);
    if (!m) {
      return `<fieldset data-cid="${c.id}"><legend>${escapeHtml(c.key.split("|")[0])}
        <button class="rowbtn cmp-del" data-cid="${c.id}" aria-label="remove">x</button></legend>

      </fieldset>`;
    }
    const max = maxHp(c, m), alive = aliveTokens(c).length, n = (c.tokens || []).length;
    const isSummon = m.summonSpellLevel != null || !!m.summonedBySpell || !!m.summonedByClass;
    const meta = [(m.size || []).join("/") + " " + m.type, "AC " + (m.acText || "-"), "CR " + (m.cr || "-"), m.speedText].filter(Boolean).join(" · ");
    const traitNames = (m.traits || []).map(t => t.name).filter(Boolean);
    const acts = (m.actions || []).map((a, i) => actionHtml(c, m, a, i, "actions")).join("") +
      (m.bonusActions || []).map((a, i) => actionHtml(c, m, a, i, "bonusActions")).join("") +
      (m.reactions || []).map((a, i) => actionHtml(c, m, a, i, "reactions")).join("");
    return `<fieldset data-cid="${c.id}">
      <legend>
        <input type="number" class="tiny cmp-count" data-cid="${c.id}" min="0" max="50" value="${n}" aria-label="how many of them">&times;
        <a class="feat-link cmp-link" data-cid="${c.id}"><b>${escapeHtml(m.name)}</b></a>
        <span class="hint">${escapeHtml(m.source)}</span>
        <input type="text" class="cmp-note" data-cid="${c.id}" value="${esc(c.note)}" placeholder="note (Conjure Animals…)" style="width:11rem">
        ${isSummon ? `<label class="hint">
          cast at level <input type="number" class="tiny cmp-lvl" data-cid="${c.id}" min="1" max="9" value="${c.spellLevel === "" ? "" : c.spellLevel}"></label>` : ""}
        <button class="roll mon-roll" data-bonus="${monMod(m.dex) + 0}" data-rolllabel="${esc(m.name)} initiative">init ${signed(monMod(m.dex))}</button>
        <button class="rowbtn cmp-del" data-cid="${c.id}" aria-label="remove">x</button>
      </legend>
      <div class="hint">${escapeHtml(meta)}${traitNames.length ? " · traits: " + escapeHtml(traitNames.join(", ")) : ""}</div>
      <div class="cmp-hp-row">
        HP <span class="hint">(each)</span>
        ${(c.tokens || []).map((t, i) => tokenHtml(c, i, t, max)).join("")}
        <label class="hint">
          max <input type="number" class="tiny cmp-maxhp" data-cid="${c.id}" value="${c.maxHpOverride}" placeholder="${m.hpAvg == null ? "?" : m.hpAvg}"></label>
        <button class="cmp-heal" data-cid="${c.id}" aria-label="restore every token to full HP">full</button>
        <span class="hint">${alive}/${n} up${m.hpSpecial ? " · " + escapeHtml(m.hpSpecial) : ""}</span>
      </div>
      <div class="cmp-checks">
        <span class="hint">saves</span> ${ABILS.map(([k, l]) =>
          `<button class="roll mon-roll" data-bonus="${saveBonus(m, k)}" data-rolllabel="${esc(m.name)} ${l} save">${l} ${signed(saveBonus(m, k))}</button>`).join("")}
        ${Object.keys(m.skill || {}).length ? `<span class="hint">skills</span> ` + Object.keys(m.skill).map(s =>
          `<button class="roll mon-roll" data-bonus="${skillBonus(m, s)}" data-rolllabel="${esc(m.name)} ${s}">${escapeHtml(s)} ${signed(skillBonus(m, s))}</button>`).join("") : ""}
      </div>
      ${acts || `<div class="hint">This statblock has no actions.</div>`}
    </fieldset>`;
  }
  function renderCompanions() {
    const host = $("companions-list"); if (!host) return;
    host.innerHTML = COMPANIONS.length ? COMPANIONS.map(companionHtml).join("")
      : ``;
  }
  function toggleDetail(link) {
    const fs = link.closest("fieldset");
    const existing = fs.querySelector(".feat-detail");
    if (existing) { existing.remove(); return; }
    const c = byId(link.dataset.cid), m = c && statOf(c); if (!m) return;
    const d = document.createElement("div"); d.className = "feat-detail";
    d.innerHTML = monsterStatblockHtml(m, ctxOf(c, m));
    fs.appendChild(d);
  }

  /* ---------- rolling ---------- */
  // Every living token makes the same attack once. Reported as one log entry with a damage-by-AC
  // table (shared with the Offensive Routines module) so eight wolves read as one decision, not
  // eight lines of arithmetic.
  function rollMass(c, act, m, mode) {
    const alive = aliveTokens(c).length;
    if (!alive) { log(`<b>${escapeHtml(m.name)}</b> - none are still up.`); return; }
    const bonus = actionToHit(act), expr = actionDamage(act, c, m);
    const lines = [], hits = [];
    for (let i = 0; i < alive; i++) {
      const hit = diceRollExpr(`1d20${signed(bonus)}`, mode || "normal");
      const isCrit = hit.d20.length === 1 && hit.d20[0] === 20;
      let dmg = 0, dmgText = "";
      if (expr) {
        const dm = diceRollExpr(isCrit ? doubleDice(expr) : expr, "normal");
        dmg = dm.value;
        dmgText = ` · ${totalHtml(dm)} damage ← ${dm.display}${isCrit ? " <i>(crit, dice doubled)</i>" : ""}`;
      }
      lines.push(`  #${i + 1} - ${totalHtml(hit)} to hit ← ${attackRollDisplay(hit)}${dmgText}`);
      hits.push({ total: hit.value, damage: dmg });
    }
    const modeTag = mode && mode !== "normal" ? ` <i>(${mode})</i>` : "";
    const table = (typeof acRangeRows === "function" && typeof fmtAcRow === "function")
      ? acRangeRows(hits).map(r => "  " + fmtAcRow(r, 0)).join("\n") : "";
    log(`&times;${alive} <b>${escapeHtml(m.name)} - ${escapeHtml(act.name)}</b>${modeTag}\n${table}\n` +
      `<details><summary class="hint">individual rolls</summary>\n${lines.join("\n")}\n</details>`);
  }
  // same rule as the Attacks module: damage dice roll twice on a crit, flat modifiers once
  function doubleDice(expr) { return expr.replace(/\d*d\d+[a-z<>\d]*/gi, x => `(${x}+${x})`); }

  /* ---------- events ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    const host = $("companions-list"); if (!host) return;

    host.addEventListener("click", e => {
      const del = e.target.closest(".cmp-del");
      if (del) {
        const i = idxOf(del.dataset.cid);
        if (i >= 0 && confirm("Remove this companion from your sheet?")) { COMPANIONS.splice(i, 1); renderCompanions(); save(); }
        return;
      }
      const heal = e.target.closest(".cmp-heal");
      if (heal) {
        const c = byId(heal.dataset.cid); if (!c) return;
        const max = maxHp(c, statOf(c));
        (c.tokens || []).forEach(t => { t.hp = max > 0 ? max : null; });   // no known max -> back to "unknown", not to 0
        renderCompanions(); save(); return;
      }
      const mass = e.target.closest(".cmp-mass");
      if (mass) {
        const c = byId(mass.dataset.cid), m = c && statOf(c); if (!m) return;
        const act = (m[mass.dataset.grp] || [])[Number(mass.dataset.ai)]; if (!act) return;
        rollMass(c, act, m, modeFromEvent(e)); return;
      }
      const dmg = e.target.closest(".cmp-dmg");
      if (dmg) { runRoll(`${dmg.dataset.expr} ${dmg.dataset.rolllabel || "damage"} damage`); return; }
      const link = e.target.closest(".cmp-link");
      if (link) { e.preventDefault(); toggleDetail(link); }
    });

    // Field edits update the model in place. HP boxes are committed through commitMath() here rather
    // than by tagging them [data-math]: the global [data-math] handler in app.js would run after this
    // one (it's bound on document, this is bound on the container), so it would still be reading the
    // raw "-7" the player typed when this listener needs the committed number.
    host.addEventListener("change", e => {
      const t = e.target;
      const hp = t.closest(".cmp-hp");
      if (hp) {
        const c = byId(hp.dataset.cid); if (!c) return;
        if (typeof commitMath === "function") commitMath(hp);
        const tok = c.tokens[Number(hp.dataset.i)];
        if (tok) tok.hp = hp.value === "" ? null : (Number(hp.value) || 0);
        renderCompanions(); save(); return;
      }
      const cnt = t.closest(".cmp-count");
      if (cnt) { const c = byId(cnt.dataset.cid); if (c) { setCount(c, cnt.value); renderCompanions(); save(); } return; }
      const mx = t.closest(".cmp-maxhp");
      if (mx) {
        const c = byId(mx.dataset.cid); if (!c) return;
        c.maxHpOverride = mx.value;
        const max = maxHp(c, statOf(c));
        // typing a max for a summon that had none fills in every token that was still unknown,
        // and clamps any that are now over it
        (c.tokens || []).forEach(t2 => { if (t2.hp == null) { if (max > 0) t2.hp = max; } else if (Number(t2.hp) > max && max > 0) t2.hp = max; });
        renderCompanions(); save(); return;
      }
      const lvl = t.closest(".cmp-lvl");
      if (lvl) { const c = byId(lvl.dataset.cid); if (c) { c.spellLevel = lvl.value === "" ? "" : Number(lvl.value); renderCompanions(); save(); } return; }
    });
    host.addEventListener("input", e => {
      const note = e.target.closest(".cmp-note");
      if (note) { const c = byId(note.dataset.cid); if (c) { c.note = note.value; save(); } }
    });

    renderCompanions();
    // If the character already has companions, their statblocks have to resolve on load - that's the
    // other trigger for the bestiary's lazy auto-load (see monster-library.js).
    if (COMPANIONS.length && typeof ensureBestiary === "function") ensureBestiary();
  });

  /* ---------- exposed for the library, persistence.js and recompute() ---------- */
  window.addCompanion = addCompanion;
  window.renderCompanions = renderCompanions;
  window.setCompanions = list => {
    window.COMPANIONS = Array.isArray(list) ? list : [];
    renderCompanions();
    if (COMPANIONS.length && typeof ensureBestiary === "function") ensureBestiary();
  };
})();
