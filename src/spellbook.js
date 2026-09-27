/* ============================================================
   SPELLBOOK - the Spellcasting module's main view.

   Top: modifier, spell attack and save DC per casting class. Then a
   search box, the filter panel toggle and Manage Spells (the dialog that
   adds, removes and prepares spells and holds the slot table). Then
   quick filters, and one section per spell level with its slot boxes and
   a table of what you can cast at that level: your own spells, lower-
   level spells you could upcast into that slot, and spells features and
   items give you.

   Rows are rebuilt from CHARACTER_SPELLS, the class rows and the spell
   library on every renderSpellList() (so on every recompute); they hold
   buttons only, never an input, so a redraw can't eat typing.
   ============================================================ */
const CLASS_SPELL_ABILITY = { artificer: "int", bard: "cha", cleric: "wis", druid: "wis", paladin: "cha", ranger: "wis",
  sorcerer: "cha", warlock: "cha", wizard: "int" };
const SB_ABBR = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
const SB_QUICK = { levels: new Set(), conc: false, ritual: false, times: new Set() };
let SB_OPEN_DETAIL = new Set();   // "level|name" rows whose description is expanded

/* ----- numbers ----- */
function defaultSpellAbility() {
  const sel = ($("spell-ability") || {}).value;
  if (sel) return sel;
  const c = spellcastingClasses()[0];
  return c ? classSpellAbility(c) : "";
}
function classSpellAbility(c) {
  const sub = (c.sub || "").trim().toLowerCase();
  if (typeof SUBCLASS_CASTING_STYLE === "object" && SUBCLASS_CASTING_STYLE[sub]) return "int";
  return CLASS_SPELL_ABILITY[c.name.trim().toLowerCase()] || ($("spell-ability") || {}).value || "";
}
function spellcastingClasses() {
  return getClasses().filter(c => c.name.trim() && ((c.casting === "auto" ? classCasting(c.name, c.sub) : c.casting) !== "none"));
}
/* { mod, atk, dc } for an ability, with the sheet's spell attack / DC misc boxes and effects. */
function spellStatsFor(ab) {
  if (!ab) return null;
  const mod = abilityMod(ab);
  const atk = profBonus() + mod + parseBonus(($("spell-atk-misc") || {}).value).flat + effFlat("spellatk");
  const dc = 8 + profBonus() + mod + num($("spell-dc-misc")) + effFlat("spelldc");
  return { mod, atk, dc, ab };
}

/* ----- rows ----- */
function sbLib(name) { return findLibSpellByName(name); }
/* Every castable spell as { name, lvl, lib, origins: [{ label, cls, ab, mode, item }] }, one per spell
   name however many classes or features give it. */
function spellbookRows() {
  const rows = new Map();
  const add = (name, lvl, origin) => {
    const lib = sbLib(name), level = lib ? lib.level : (lvl || 0), shown = lib ? lib.name : name;
    const k = shown.toLowerCase();
    const r = rows.get(k) || { name: shown, lvl: level, lib, origins: [] };
    if (!r.origins.some(o => o.label === origin.label)) r.origins.push(origin);
    rows.set(k, r);
  };
  const classes = getClasses().filter(c => c.name.trim());
  const byName = new Map(classes.map(c => [c.name.trim(), c]));
  classes.forEach(c => {
    const info = classSpellAllowance(c);
    CHARACTER_SPELLS.filter(s => !s.grantSrc && s.cls === c.name.trim()).forEach(s => {
      if (s.lvl > 0 && info && info.style === "prepared" && !s.prep) return;   // unprepared: in Manage Spells only
      add(s.name, s.lvl, { label: c.name.trim(), cls: c.name.trim(), ab: classSpellAbility(c), mode: "slot" });
    });
  });
  CHARACTER_SPELLS.filter(s => !s.grantSrc && !s.cls).forEach(s => add(s.name, s.lvl, { label: "Other", cls: "", ab: defaultSpellAbility(), mode: "slot" }));
  CHARACTER_SPELLS.filter(s => s.grantSrc).forEach(s => {
    const c = byName.get(s.cls);
    add(s.name, s.lvl, { label: s.grantSrc, cls: s.cls || "", ab: c ? classSpellAbility(c) : defaultSpellAbility(), mode: c ? "slot" : "use" });
  });
  if (typeof derivedSpellGroups === "function") derivedSpellGroups().forEach(g => {
    const m = g.meta || {}, c = m.cls ? byName.get(m.cls) : null;
    const ab = m.item ? (m.own ? defaultSpellAbility() : "") : (m.ability || (c ? classSpellAbility(c) : defaultSpellAbility()));
    g.names.forEach(n => add(n, 0, { label: g.header, cls: m.cls || "", ab, mode: m.mode || "use", item: !!m.item }));
  });
  return [...rows.values()];
}

/* ----- dice ----- */
function sbAddDice(base, per, times) {
  if (!times) return base;
  const b = /^(\d+)d(\d+)(.*)$/.exec(base), p = /^(\d+)d(\d+)$/.exec(per);
  if (b && p && b[2] === p[2]) return (Number(b[1]) + Number(p[1]) * times) + "d" + b[2] + b[3];
  if (p) return base + "+" + (Number(p[1]) * times) + "d" + p[2];
  if (/^\d+$/.test(per)) return base + "+" + Number(per) * times;
  return base;
}
/* The Effect button's dice at a slot level (a cantrip scales with character level instead). */
function sbEffectDice(row, slotLevel, stats) {
  const lib = row.lib; if (!lib) return "";
  let dice = "";
  if (lib.level === 0 && lib.cantripScale) {
    const lvl = totalLevel() || 1;
    Object.keys(lib.cantripScale).map(Number).sort((a, b) => a - b).forEach(t => { if (lvl >= t) dice = lib.cantripScale[t]; });
  }
  if (!dice && lib.effect) dice = lib.effect.dice;
  if (!dice) return "";
  if (lib.level > 0 && lib.upScale && slotLevel > lib.level) dice = sbAddDice(dice, lib.upScale.per, Math.floor((slotLevel - lib.level) / (lib.upScale.step || 1)));
  if (lib.effect && lib.effect.addMod && stats) dice += (stats.mod >= 0 ? "+" : "") + stats.mod;
  return dice;
}

function sbShorten(t, n) {
  if (t.length <= n) return t;
  const cut = t.slice(0, n), sp = cut.lastIndexOf(" ");
  return (sp > n * .6 ? cut.slice(0, sp) : cut).replace(/[,;:.]$/, "") + "...";
}
/* ----- symbols ----- */
function sbConcIcon() {
  return `<span class="sb-sym" title="Concentration"><svg viewBox="0 0 20 20" aria-label="Concentration"><path d="M10 1 19 10 10 19 1 10z"/><text x="10" y="14">C</text></svg></span>`;
}
function sbRitualIcon() {
  return `<span class="sb-sym" title="Ritual"><svg viewBox="0 0 20 20" aria-label="Ritual"><rect x="2" y="2" width="16" height="16"/><text x="10" y="14.5">R</text></svg></span>`;
}

/* ----- slots ----- */
function slotUsed(i) { return num($("slot-used-" + i)); }
function pactUsed() { return num($("pact-used")); }
function setSlotField(id, n) {
  const el = $(id); if (!el) return;
  el.value = n ? String(n) : ""; el.dataset.prev = String(n || 0);
}
function sbSlotBoxes(kind, level, total, used) {
  if (!total) return "";
  let html = `<span class="sb-slots" data-kind="${kind}" data-level="${level}" title="${kind === "pact" ? "Pact Magic slots" : "Spell slots"}">`;
  for (let i = 0; i < total; i++) html += `<button type="button" class="sb-slot${i < used ? " used" : ""}" data-kind="${kind}" data-level="${level}" data-full="${i < used ? 1 : 0}" aria-label="${i < used ? "used slot" : "open slot"}"></button>`;
  return html + `<span class="sb-slots-label">${kind === "pact" ? "Pact" : "Slots"}</span></span>`;
}
/* Fills from the left: an empty box uses one more slot, a full box gives one back. */
function toggleSlotBox(kind, level, full) {
  const id = kind === "pact" ? "pact-used" : "slot-used-" + level;
  const total = kind === "pact" ? pactSlots().count : slotTotal(level);
  const used = kind === "pact" ? pactUsed() : slotUsed(level);
  setSlotField(id, Math.max(0, Math.min(total, used + (full ? -1 : 1))));
  recompute(); scheduleSave();
}
/* Which pool a cast at `level` spends: Pact Magic first for a Warlock's spell, class slots first otherwise. */
function slotForCast(row, level) {
  const pact = pactSlots(), pactLeft = pact.level === level ? pact.count - pactUsed() : 0;
  const regLeft = slotTotal(level) - slotUsed(level);
  const warlock = row.origins.some(o => /^warlock$/i.test(o.cls || ""));
  if (warlock) return pactLeft > 0 ? "pact" : regLeft > 0 ? "slot" : "";
  return regLeft > 0 ? "slot" : pactLeft > 0 ? "pact" : "";
}
function castSpell(row, level) {
  const pool = slotForCast(row, level); if (!pool) return;
  if (pool === "pact") setSlotField("pact-used", pactUsed() + 1); else setSlotField("slot-used-" + level, slotUsed(level) + 1);
  if (row.lib && row.lib.conc) startConcentrating(row.name, (row.origins[0] || {}).cls || "");
  logEvent("resource", `<b>Cast</b> ${escapeHtml(row.name)}${level > row.lvl ? ` at ${ordinalLevel(level)} level` : ""} <span class="hint">(${pool === "pact" ? "pact slot" : ordinalLevel(level) + "-level slot"})</span>`);
  recompute(); scheduleSave();
}
function useSpell(row) {
  if (row.lib && row.lib.conc) startConcentrating(row.name, "");
  const src = row.origins.filter(o => o.mode === "use").map(o => o.label).join(", ");
  logEvent("resource", `<b>Cast</b> ${escapeHtml(row.name)}${src ? ` <span class="hint">(${escapeHtml(src)})</span>` : ""}`);
  recompute(); scheduleSave();
}

/* ----- filters ----- */
function sbMatchesSearch(row) {
  const q = (($("sb-search") || {}).value || "").trim().toLowerCase(); if (!q) return true;
  const lib = row.lib || {};
  return [row.name, lib.timeStr, lib.school, ...(lib.dmgTypes || []), ...(lib.conds || []), lib.effect && lib.effect.kind, ...row.origins.map(o => o.label)]
    .some(v => v && String(v).toLowerCase().includes(q));
}
function sbPassesQuick(row, level) {
  const lib = row.lib || {};
  if (SB_QUICK.levels.size && !SB_QUICK.levels.has(level)) return false;
  if (SB_QUICK.conc && !lib.conc) return false;
  if (SB_QUICK.ritual && !lib.ritual) return false;
  if (SB_QUICK.times.size && !SB_QUICK.times.has(lib.castKind || "other")) return false;
  return true;
}
function sbPassesPanel(row) {
  if (typeof MY_SPELL_FILTERS === "undefined" || !row.lib) return true;
  return MY_SPELL_FILTERS.passes(row.lib, MY_SPELL_FILTERS.activeGroups());
}

/* ----- render ----- */
function renderSpellStats() {
  const el = $("sb-stats"); if (!el) return;
  const casters = spellcastingClasses();
  const list = casters.length ? casters.map(c => ({ label: c.name.trim(), st: spellStatsFor(classSpellAbility(c)) })).filter(x => x.st)
    : (defaultSpellAbility() ? [{ label: "Default", st: spellStatsFor(defaultSpellAbility()) }] : []);
  const cell = (key, fmt, label) => `<div class="sb-stat"><div class="sb-stat-val">${list.length ? list.map(x =>
    `<span title="${escapeHtml(x.label)} (${x.st.ab.toUpperCase()})">${fmt(x.st)}</span>`).join('<span class="sb-sep"> | </span>') : "-"}</div><div class="sb-stat-label">${label}</div></div>`;
  el.innerHTML = cell("mod", s => sign(s.mod), "Modifier") + cell("atk", s => sign(s.atk), "Spell Attack") + cell("dc", s => String(s.dc), "Save DC");
}
function sbHitDc(row) {
  const lib = row.lib; if (!lib || (!lib.attack && !lib.save)) return "-";
  const parts = row.origins.map(o => {
    const st = spellStatsFor(o.ab); if (!st) return "-";
    return lib.attack ? sign(st.atk) : `${SB_ABBR[lib.save] || String(lib.save).slice(0, 3).toUpperCase()} ${st.dc}`;
  });
  return [...new Set(parts)].map((p, i) => `<span title="${escapeHtml(row.origins[i] ? row.origins[i].label : "")}">${p}</span>`).join(" | ");
}
function sbRowHtml(row, level, rowId) {
  const lib = row.lib || {};
  const upcast = level > row.lvl && row.lvl > 0;
  const slotOrigins = row.origins.filter(o => o.mode === "slot");
  const mode = row.lvl === 0 ? "atwill" : upcast || slotOrigins.length ? "slot" : "use";
  const pool = mode === "slot" ? slotForCast(row, level) : "";
  const action = mode === "atwill" ? `<span class="sb-atwill">At will</span>`
    : mode === "use" ? `<button type="button" class="sb-cast sb-use" data-row="${rowId}" data-level="${level}">Use</button>`
    : `<button type="button" class="sb-cast" data-row="${rowId}" data-level="${level}"${pool ? "" : ` disabled title="No ${ordinalLevel(level)}-level slots left"`}>Cast</button>`;
  const badge = upcast ? `<span class="sb-lvl-badge" title="${ordinalLevel(row.lvl)}-level spell">${ordinalLevel(row.lvl)}</span>` : "";
  const firstStats = spellStatsFor((row.origins.find(o => o.ab) || {}).ab);
  const dice = sbEffectDice(row, level, firstStats);
  const kind = lib.effect ? lib.effect.kind : "";
  const effect = dice ? `<button type="button" class="dice-roll sb-effect" data-dice="${escapeHtml(dice)}" data-rolllabel="${escapeHtml(row.name + (kind ? " " + kind : ""))}">${escapeHtml(dice)}${kind ? ` <span class="sb-eff-kind">${escapeHtml(kind)}</span>` : ""}</button>` : "-";
  const up = row.lvl === 0
    ? (lib.cantripScale ? `<span title="Scales with character level">${escapeHtml(Object.entries(lib.cantripScale).map(([l, d]) => d + " at " + l).join(", "))}</span>` : "-")
    : lib.upScale ? `+${escapeHtml(lib.upScale.per)} per ${lib.upScale.step === 2 ? "two slot levels" : "slot level"}`
    : lib.upText ? `<span class="sb-uptext" title="${escapeHtml(lib.upText)}">${escapeHtml(sbShorten(lib.upText, 70))}</span>` : "-";
  const comps = lib.comp ? ["v", "s", "m"].filter(k => lib.comp[k]).map(k => k.toUpperCase()).join("/") : "";
  const detailKey = level + "|" + row.name;
  return `<tr class="sb-row" data-detail="${escapeHtml(detailKey)}">
      <td class="sb-act">${action}${badge}</td>
      <td class="sb-name"><a class="feat-link sb-name-link" data-name="${escapeHtml(row.name)}">${escapeHtml(row.name)}</a>${lib.conc ? sbConcIcon() : ""}${lib.ritual ? sbRitualIcon() : ""}</td>
      <td>${escapeHtml(lib.timeStr || "-")}</td>
      <td>${escapeHtml(lib.rangeStr || "-")}</td>
      <td>${sbHitDc(row)}</td>
      <td>${effect}</td>
      <td>${escapeHtml(lib.durStr || "-")}</td>
      <td class="sb-up">${up}</td>
      <td${lib.material ? ` title="${escapeHtml(lib.material)}"` : ""}>${escapeHtml(comps || "-")}</td>
      <td class="hint">${escapeHtml(row.origins.map(o => o.label).join(" | "))}</td>
    </tr>` + (SB_OPEN_DETAIL.has(detailKey) ? sbDetailHtml(row) : "");
}
function sbDetailHtml(row) {
  const lib = row.lib;
  const body = !lib ? `<div class="hint">No spell named "${escapeHtml(row.name)}" in the Spell Library.</div>`
    : `<div class="hint">${escapeHtml([lib.school, lib.material ? "M: " + lib.material : ""].filter(Boolean).join(" | "))}</div><div>${renderInlineSpellText(lib.rawText, lib.name)}</div>` +
      (lib.rawHigher ? `<div style="margin-top:3px"><b>At Higher Levels:</b> ${renderInlineSpellText(lib.rawHigher, lib.name)}</div>` : "");
  return `<tr class="sb-detail"><td></td><td colspan="9"><div class="feat-detail">${body}</div></td></tr>`;
}
let SB_ROWS = [];
function renderSpellbook() {
  renderSpellStats();
  const el = $("sb-sections"); if (!el) return;
  const rows = spellbookRows();
  SB_ROWS = [];
  const pact = pactSlots();
  const levels = [], sections = [];
  for (let L = 0; L <= 9; L++) {
    const slots = L ? slotTotal(L) : 0, pactHere = L && pact.level === L ? pact.count : 0;
    const own = rows.filter(r => r.lvl === L);
    // Lower-level spells cast with a slot of this level: only where there's a slot to cast them with.
    const up = L >= 2 ? rows.filter(r => r.lvl > 0 && r.lvl < L && r.origins.some(o => o.mode === "slot") &&
      (slots > 0 || (pactHere && r.origins.some(o => /^warlock$/i.test(o.cls || ""))))) : [];
    if (!own.length && !up.length && !slots && !pactHere) continue;
    levels.push(L);
    const visible = [...own.sort((a, b) => a.name.localeCompare(b.name)), ...up.sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name))]
      .filter(r => sbMatchesSearch(r) && sbPassesQuick(r, L) && sbPassesPanel(r));
    const filtering = SB_QUICK.levels.size || SB_QUICK.conc || SB_QUICK.ritual || SB_QUICK.times.size || (($("sb-search") || {}).value || "").trim();
    if (filtering && !visible.length) continue;
    const body = visible.map(r => { SB_ROWS.push(r); return sbRowHtml(r, L, SB_ROWS.length - 1); }).join("");
    const head = `<div class="sb-level-head"><span class="sb-level-title">${L ? ordinalLevel(L) + " Level" : "Cantrip"}</span>
      <span class="sb-level-slots">${sbSlotBoxes("slot", L, slots, slotUsed(L))}${pactHere ? sbSlotBoxes("pact", L, pact.count, pactUsed()) : ""}</span></div>`;
    const table = body ? `<div class="sb-table-wrap"><table class="sb-table"><thead><tr><th></th><th>Name</th><th>Time</th><th>Range</th><th>Hit / DC</th>
      <th>Effect</th><th>Duration</th><th>Upcasting</th><th>Comp.</th><th>Class</th></tr></thead><tbody>${body}</tbody></table></div>` : "";
    sections.push(`<section class="sb-level" data-level="${L}">${head}${table}</section>`);
  }
  const html = sections.join("") || `<div class="hint">No spells.</div>`;
  el.innerHTML = (typeof concentrationBannerHtml === "function" ? concentrationBannerHtml() : "") + html;
  renderQuickFilters(levels);
}
function renderQuickFilters(levels) {
  const el = $("sb-quick"); if (!el) return;
  const b = (attr, val, label, on, title) => `<button type="button" class="sb-q${on ? " active" : ""}" data-q="${attr}" data-v="${val}"${title ? ` title="${title}"` : ""}>${label}</button>`;
  const none = !SB_QUICK.levels.size && !SB_QUICK.conc && !SB_QUICK.ritual && !SB_QUICK.times.size;
  el.innerHTML = b("all", "", "All", none, "Show everything") +
    levels.map(L => b("level", L, L ? ordinalLevel(L) : "0", SB_QUICK.levels.has(L), L ? ordinalLevel(L) + " level" : "Cantrips")).join("") +
    b("conc", "", sbConcIcon(), SB_QUICK.conc, "Concentration") + b("ritual", "", sbRitualIcon(), SB_QUICK.ritual, "Ritual") +
    b("time", "action", "A", SB_QUICK.times.has("action"), "Action") + b("time", "bonus", "BA", SB_QUICK.times.has("bonus"), "Bonus Action") +
    b("time", "reaction", "R", SB_QUICK.times.has("reaction"), "Reaction") + b("time", "other", "Misc", SB_QUICK.times.has("other"), "Other casting times");
}
function sbQuickClick(btn) {
  const q = btn.dataset.q, v = btn.dataset.v;
  if (q === "all") { SB_QUICK.levels.clear(); SB_QUICK.times.clear(); SB_QUICK.conc = SB_QUICK.ritual = false; }
  if (q === "level") { const n = Number(v); SB_QUICK.levels.has(n) ? SB_QUICK.levels.delete(n) : SB_QUICK.levels.add(n); }
  if (q === "conc") SB_QUICK.conc = !SB_QUICK.conc;
  if (q === "ritual") SB_QUICK.ritual = !SB_QUICK.ritual;
  if (q === "time") SB_QUICK.times.has(v) ? SB_QUICK.times.delete(v) : SB_QUICK.times.add(v);
  renderSpellbook();
}

/* ----- Manage Spells dialog ----- */
function openSpellManager() {
  const m = $("spell-manage"); if (!m) return;
  m.style.display = "flex";
  refreshSpellAddClassSelect(); renderSpellList(); renderSpellResults();
  $("spell-search").focus();
}
function closeSpellManager() { const m = $("spell-manage"); if (m) m.style.display = "none"; }

let MY_SPELL_FILTERS;
document.addEventListener("DOMContentLoaded", () => {
  if (typeof createFilterSet === "function" && typeof SPELL_FGROUPS !== "undefined" && $("sb-filter-area")) {
    MY_SPELL_FILTERS = createFilterSet({ ns: "myspell", groups: SPELL_FGROUPS, areaId: "sb-filter-area", searchId: "sb-search", onChange: () => renderSpellbook() });
    MY_SPELL_FILTERS.load();
    $("sb-filter-area").addEventListener("click", e => MY_SPELL_FILTERS.handleClick(e));
    $("sb-filter-area").addEventListener("input", e => MY_SPELL_FILTERS.handleInput(e));
  }
  const toggle = $("sb-filter-btn");
  if (toggle) toggle.addEventListener("click", () => {
    const area = $("sb-filter-area"); area.hidden = !area.hidden;
    toggle.classList.toggle("active", !area.hidden);
    if (!area.hidden && MY_SPELL_FILTERS) MY_SPELL_FILTERS.renderArea();
  });
  const search = $("sb-search"); if (search) search.addEventListener("input", renderSpellbook);
  const quick = $("sb-quick"); if (quick) quick.addEventListener("click", e => { const b = e.target.closest(".sb-q"); if (b) sbQuickClick(b); });
  const sections = $("sb-sections");
  if (sections) sections.addEventListener("click", e => {
    const slot = e.target.closest(".sb-slot");
    if (slot) { toggleSlotBox(slot.dataset.kind, Number(slot.dataset.level), slot.dataset.full === "1"); return; }
    const cast = e.target.closest(".sb-cast");
    if (cast && !cast.disabled) {
      const row = SB_ROWS[Number(cast.dataset.row)]; if (!row) return;
      if (cast.classList.contains("sb-use")) useSpell(row); else castSpell(row, Number(cast.dataset.level));
      return;
    }
    if (e.target.closest(".sp2-conc-drop")) { dropConcentration(); return; }
    const link = e.target.closest(".sb-name-link");
    if (link) {
      e.preventDefault();
      const key = link.closest("tr").dataset.detail;
      SB_OPEN_DETAIL.has(key) ? SB_OPEN_DETAIL.delete(key) : SB_OPEN_DETAIL.add(key);
      renderSpellbook();
    }
  });
  const modal = $("spell-manage");
  if (modal) {
    modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("#spell-manage-close")) closeSpellManager(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.style.display !== "none") closeSpellManager(); });
  }
});
