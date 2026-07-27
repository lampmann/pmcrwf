/* ============================================================
   EFFECTS UI — the per-feature inline controls rendered inside the
   Features panel (renderEffectControls, called from class-library.js),
   the always-visible active-effects strip (#effects-strip, between the
   toolbar and the modules — deliberately not a .module, since layout.js
   disables pointer events on module contents while free-layout editing is
   on, which would make the strip unusable exactly when you're mid-drag),
   and the audit trail that makes every effect-touched number traceable
   back to the feature that produced it (paintEffectAudit).
   ============================================================ */

/* ----- inline controls: toggle / choice / always-on chip / unsupported marker, appended after
   a feature's uses-tracker in the Features panel (class-library.js's renderRaceSection/renderClassFeatures) ----- */
function renderEffectControls(feature) {
  const entry = dbEntryFor(feature);
  if (!entry) return "";
  let html = "";
  const seenToggle = new Set();
  (entry.effects || []).forEach(effect => {
    if (effect.target === "spell-grant") {
      // Reuses the exact same .gsp-link/.gsp-expanded markup and click handler as the
      // race/subclass additionalSpells-driven grants (grantedSpellsHtml in class-library.js) —
      // "grant-free" behaves like a domain spell (added via addCharacterSpell w/ grantSrc, never
      // touches a class's Known/Prepared count), "grant-list" like a Dragonmark (opens the
      // "prepare from which class?" modal — still costs a normal known/prepared slot). See
      // effects.js's header comment and conversion-guide.md for why this target is separate from
      // the numeric snapshot pipeline.
      const name = effect.value && effect.value.name;
      if (!name) return;
      const expanded = effect.op === "grant-list";
      const title = expanded ? ` title="added to your spell list — still needs to be prepared/known normally, via a class"` : "";
      html += ` <a class="feat-link gsp-link${expanded ? " gsp-expanded" : ""}" data-name="${escapeHtml(name)}" data-cls="" data-header="${escapeHtml(feature.name)}" data-expanded="${expanded ? "1" : "0"}"${title}>${escapeHtml(name)}${expanded ? "*" : ""}</a>`;
      return;
    }
    const act = effect.activation || { kind: "always" };
    const target = resolveTarget(feature, effect.target);
    const reserved = isReservedTarget(target);
    if (act.kind === "toggle") {
      if (seenToggle.has(act.id)) return; seenToggle.add(act.id);
      const key = feature.fkey + "|" + act.id, on = !!EFFECT_TOGGLES[key];
      html += ` <button type="button" class="eff-toggle${on ? " on" : ""}" data-fkey="${feature.fkey}" data-toggle="${act.id}"${reserved ? " disabled" : ""} title="${reserved ? "serialized; attacks module not implemented yet" : "click to toggle"}">${on ? "◉" : "○"} ${escapeHtml(act.label || act.id)}</button>`;
    } else if (act.kind === "always" && !reserved && effect.op !== "note") {
      html += ` <span class="eff-chip" title="${escapeHtml(effect.op + " " + target)}">⚙ ${escapeHtml(target)}</span>`;
    }
  });
  (entry.choices || []).forEach(c => {
    if (c.kind === "ability") {
      const cur = choiceValue(feature, c.id) || "";
      const opts = ABILITIES.map(a => `<option value="${a.key}"${cur === a.key ? " selected" : ""}>${a.name}</option>`).join("");
      html += ` <label class="hint">${escapeHtml(c.label || "choice")}: <select class="eff-choice" data-fkey="${feature.fkey}" data-choice="${c.id}"><option value="">—</option>${opts}</select></label>`;
    } else if (c.kind === "pick") {
      // n > 1 ("pick 2 of these skills") renders one <select> per slot, each excluding whatever
      // the other slots already picked, so the same option can't be chosen twice — see resolveTargetsAll
      // in effects.js for how an array of per-slot values turns into one effect application per slot.
      const n = Math.max(1, c.n || 1);
      const curArr = n > 1 ? (Array.isArray(choiceValue(feature, c.id)) ? choiceValue(feature, c.id) : []) : [choiceValue(feature, c.id) || ""];
      let selects = "";
      for (let i = 0; i < n; i++) {
        const cur = curArr[i] || "";
        const others = curArr.filter((v, j) => j !== i && v);
        const opts = (c.options || []).filter(o => !others.includes(o)).map(o => `<option value="${o}"${cur === o ? " selected" : ""}>${escapeHtml(String(o))}</option>`).join("");
        selects += `<select class="eff-choice" data-fkey="${feature.fkey}" data-choice="${c.id}"${n > 1 ? ` data-slot="${i}"` : ""}><option value="">—</option>${opts}</select> `;
      }
      html += ` <label class="hint">${escapeHtml(c.label || "choice")}: ${selects}</label>`;
    }   // "skill" choice kind: deferred, none of the shipped entries use it yet
  });
  (entry.unsupported || []).forEach(u => { html += ` <span class="eff-unsup" title="${escapeHtml(u.reason)}">⚠ not automated</span>`; });
  return html;
}

/* ----- toggle collection shared by the strip and (implicitly, via renderEffectControls) the inline controls ----- */
function collectToggles() {
  const out = new Map();
  (typeof activeFeatures === "function" ? activeFeatures() : []).forEach(f => {
    const entry = dbEntryFor(f); if (!entry) return;
    (entry.effects || []).forEach(effect => {
      const act = effect.activation;
      if (!act || act.kind !== "toggle") return;
      const key = f.fkey + "|" + act.id;
      const reserved = isReservedTarget(resolveTarget(f, effect.target));
      if (!out.has(key)) out.set(key, { fkey: f.fkey, id: act.id, label: act.label || act.id, on: !!EFFECT_TOGGLES[key], reserved, source: f.name });
      else if (reserved) out.get(key).reserved = true;
    });
  });
  return [...out.values()];
}

/* ----- always-visible strip: every declared toggle (on or off) + a coverage counter ----- */
function renderEffectsStrip() {
  const el = $("effects-strip"); if (!el) return;
  const snap = effectsSnapshot();
  const toggles = collectToggles();
  if (!toggles.length && !snap.unapplied.length) { el.innerHTML = ""; el.classList.remove("has-content"); return; }
  el.classList.add("has-content");
  const chips = toggles.map(t =>
    `<button type="button" class="eff-strip-toggle${t.on ? " on" : ""}" data-fkey="${t.fkey}" data-toggle="${t.id}"${t.reserved ? " disabled" : ""} title="${t.reserved ? t.source + ": serialized, not automated yet" : t.source}">${t.on ? "◉" : "○"} ${escapeHtml(t.label)}</button>`
  ).join(" ");
  const counter = snap.unapplied.length
    ? `<span class="hint eff-strip-counter" title="${escapeHtml(snap.unapplied.map(u => u.source + (u.reason ? " — " + u.reason : "")).join("\n"))}">${snap.unapplied.length} feature effect(s) not automated</span>`
    : `<span class="hint eff-strip-counter">all detected effects automated</span>`;
  el.innerHTML = chips + counter;
}

/* ----- audit trail: title tooltips + a dotted underline on every effect-touched derived value,
   plus the ability-score / AC / speed "base + effects = total" breakdown spans. Required so a
   number an LLM-authored DB entry changed is always visibly attributable, never silent. ----- */
function hasMiscConflict(key) {
  const misc = (typeof miscOf === "function") ? miscOf(key) : "";
  return !!(misc && misc.trim()) && !!effFlat(key);
}
function contribTitle(label, key) {
  const contribs = effContribs(key);
  if (!contribs.length) return "";
  const parts = contribs.map(c => `${c.source} ${typeof c.n === "number" ? sign(c.n) : c.n}`);
  const warn = hasMiscConflict(key) ? "\n⚠ misc field also set — check for double-counting" : "";
  return `${label}: ${parts.join(", ")}${warn}`;
}
function paintEffectSpan(el, key, label) {
  if (!el) return;
  const contribs = effContribs(key);
  el.classList.toggle("has-eff", contribs.length > 0);
  el.title = contribs.length ? contribTitle(label, key) : "";
}
function paintEffectAudit() {
  paintEffectSpan($("init"), "init", "Initiative");
  paintEffectSpan($("ac"), "ac", "AC");
  paintEffectSpan($("passive-perc"), "passive-perception", "Passive Perception");
  paintEffectSpan($("hp-max"), "hpmax", "Max HP");
  paintEffectSpan($("pb"), "profbonus", "Proficiency Bonus");
  paintEffectSpan($("spell-dc"), "spelldc", "Spell Save DC");
  paintEffectSpan($("spell-atk"), "spellatk", "Spell Attack");
  ABILITIES.forEach(a => paintEffectSpan($("savebonus-" + a.key), "save-" + a.key, a.name + " Save"));
  document.querySelectorAll("#skill-rows tr").forEach(tr => paintEffectSpan($("skillbonus-" + tr.dataset.slug), "skill-" + tr.dataset.slug, "Skill"));

  ABILITIES.forEach(a => {
    const key = "score-" + a.key, eff = effFlat(key), el = $("score-eff-" + a.key);
    if (!el) return;
    if (eff) {
      const base = num($("score-" + a.key)), total = base + eff;
      el.style.display = ""; el.textContent = `= ${total}`;
      el.title = `${base} base ${sign(eff)} (${effContribs(key).map(c => c.source).join(", ")}) = ${total}`;
    } else { el.style.display = "none"; el.title = ""; }
  });
  { // speed is still a plain input (not auto-calculated) — same "base + effects = total" audit span as before
    const key = "speed", eff = effFlat(key), el = $(key + "-total");
    if (el) {
      if (eff) {
        const base = num($(key)), total = base + eff;
        el.style.display = ""; el.textContent = `= ${total}`;
        el.title = contribTitle("Speed", key);
      } else { el.style.display = "none"; el.title = ""; }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const strip = $("effects-strip");
  if (strip) strip.addEventListener("click", e => {
    const b = e.target.closest(".eff-strip-toggle");
    if (b && !b.disabled) toggleEffect(b.dataset.fkey, b.dataset.toggle);
  });
});
