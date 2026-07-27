/* ============================================================
   TRI-STATE FILTER ENGINE — shared by the Spell Library and the Equipment
   Library. Extracted from spell-library.js so the two don't keep two copies
   of the same ~80 lines of state machine.

   A filter set owns one filter area in the DOM and one localStorage slot.
   Everything specific to a library lives in its group list:

     { key, label, get(record) -> [values], opts: [[value, label, title?]] }
     { key, label, dynamic: true, get(record) -> [values], dynOpts() -> [...] }

   `dynOpts()` may return plain strings or [value, label, title] triples; it's
   re-read on every render, so a dynamic group (Source, Found On) tracks
   whatever is actually loaded.

   Each option cycles neutral -> include (blue) -> exclude (red). Within a
   group the includes combine by its blue mode and the excludes by its red
   mode (OR / AND / XOR each); across groups, the set's own combine mode
   (AND / OR) applies. A group with every option neutral is ignored entirely,
   so an untouched filter area never narrows anything.
   ============================================================ */
function filterNextMode(m) { return m === "or" ? "and" : m === "and" ? "xor" : "or"; }
// Resolved locally rather than through data.js's $ so this module stays a leaf with no load-order
// dependency — it's included by the standalone tests/filters.html, which loads nothing else.
function filterEl(id) { return id ? document.getElementById(id) : null; }

function createFilterSet(cfg) {
  // cfg: { ns, groups, areaId, searchId, onChange }
  const fs = {
    groups: cfg.groups,
    areaId: cfg.areaId,
    searchId: cfg.searchId,
    state: {},            // { groupKey: { states:{val:'ignore'|'include'|'exclude'}, blueMode, redMode, hidden } }
    combine: "and",       // how groups combine with each other
    storeKey: "charsheet-" + cfg.ns + "filters",
    defaultsKey: "charsheet-" + cfg.ns + "filter-defaults",
  };

  fs.groupDef = key => fs.groups.find(g => g.key === key);
  fs.opts = g => {
    if (!g.dynamic) return (g.opts || []).map(o => [o[0], o[1], o[2] || ""]);
    return (g.dynOpts ? g.dynOpts() : []).map(o => Array.isArray(o) ? [o[0], o[1] == null ? o[0] : o[1], o[2] || ""] : [o, o, ""]);
  };
  fs.ensureStates = () => {
    fs.groups.forEach(g => {
      if (!fs.state[g.key]) fs.state[g.key] = { states: {}, blueMode: "or", redMode: "or", hidden: false };
      fs.opts(g).forEach(([v]) => { if (!(v in fs.state[g.key].states)) fs.state[g.key].states[v] = "ignore"; });
    });
  };

  /* ----- persistence ----- */
  fs.persist = () => { try { localStorage.setItem(fs.storeKey, JSON.stringify({ combine: fs.combine, state: fs.state })); } catch (e) {} };
  fs.load = () => {
    try { const d = JSON.parse(localStorage.getItem(fs.storeKey)); if (d) { fs.combine = d.combine || "and"; fs.state = d.state || {}; } } catch (e) {}
  };
  fs.saveDefaults = () => { try { localStorage.setItem(fs.defaultsKey, JSON.stringify({ combine: fs.combine, state: fs.state })); } catch (e) {} fs.persist(); };
  fs.reset = () => {
    let d = null; try { d = JSON.parse(localStorage.getItem(fs.defaultsKey)); } catch (e) {}
    if (d) { fs.combine = d.combine || "and"; fs.state = JSON.parse(JSON.stringify(d.state || {})); }
    else { fs.state = {}; fs.combine = "and"; }
    fs.ensureStates();
    const search = filterEl(fs.searchId);
    if (search) search.value = "";
    fs.persist();
  };

  /* ----- interactions ----- */
  fs.cycle = (gkey, v) => {
    const st = fs.state[gkey].states;
    st[v] = st[v] === "ignore" ? "include" : st[v] === "include" ? "exclude" : "ignore";
  };
  fs.ctrl = (action, gkey) => {
    const st = fs.state[gkey], g = fs.groupDef(gkey);
    if (action === "all") fs.opts(g).forEach(([v]) => st.states[v] = "include");
    else if (action === "clear") Object.keys(st.states).forEach(v => st.states[v] = "ignore");
    else if (action === "none") fs.opts(g).forEach(([v]) => st.states[v] = "exclude");
    else if (action === "bluemode") st.blueMode = filterNextMode(st.blueMode);
    else if (action === "redmode") st.redMode = filterNextMode(st.redMode);
    else if (action === "hide") st.hidden = !st.hidden;
  };

  /* ----- matching ----- */
  fs.constrained = g => Object.values(fs.state[g.key].states).some(x => x !== "ignore");
  fs.groupPass = (g, rec) => {
    const st = fs.state[g.key], vals = g.get(rec) || [];
    const inc = Object.keys(st.states).filter(v => st.states[v] === "include");
    const exc = Object.keys(st.states).filter(v => st.states[v] === "exclude");
    let incPass = true;
    if (inc.length) { const p = inc.filter(v => vals.includes(v)).length; incPass = st.blueMode === "and" ? p === inc.length : st.blueMode === "xor" ? p === 1 : p > 0; }
    let excPass = true;
    if (exc.length) { const p = exc.filter(v => vals.includes(v)).length; const excluded = st.redMode === "and" ? p === exc.length : st.redMode === "xor" ? p === 1 : p > 0; excPass = !excluded; }
    return incPass && excPass;
  };
  // Which groups are actually doing something, computed once per result render rather than per record.
  fs.activeGroups = () => { fs.ensureStates(); return fs.groups.filter(fs.constrained); };
  fs.passes = (rec, active) => {
    const groups = active || fs.activeGroups();
    if (!groups.length) return true;
    return fs.combine === "and" ? groups.every(g => fs.groupPass(g, rec)) : groups.some(g => fs.groupPass(g, rec));
  };

  /* ----- rendering ----- */
  fs.renderArea = () => {
    const el = filterEl(fs.areaId); if (!el) return;
    fs.ensureStates();
    const modBar = `<div class="modbar">
      <button data-fmod="combine" title="how filter categories combine">Combine as ${fs.combine.toUpperCase()}</button>
      <button data-fmod="showall">Show All</button><button data-fmod="hideall">Hide All</button>
      <button data-fmod="reset">Reset</button><button data-fmod="savedefault" title="save current filters as the default that Reset restores">Manage Defaults</button>
    </div>`;
    const groups = fs.groups.map(g => {
      const st = fs.state[g.key];
      const ctrl = `<span class="fctrl">` +
        `<button class="fctrl-btn" data-fctrl="all" data-fg="${g.key}">All</button>` +
        `<button class="fctrl-btn" data-fctrl="clear" data-fg="${g.key}">Clear</button>` +
        `<button class="fctrl-btn" data-fctrl="none" data-fg="${g.key}">None</button>` +
        `<button class="fctrl-btn blue fmode" data-fctrl="bluemode" data-fg="${g.key}" title="how INCLUDE (blue) options combine">${st.blueMode.toUpperCase()}</button>` +
        `<button class="fctrl-btn red fmode" data-fctrl="redmode" data-fg="${g.key}" title="how EXCLUDE (red) options combine">${st.redMode.toUpperCase()}</button>` +
        `<button class="fctrl-btn" data-fctrl="hide" data-fg="${g.key}">${st.hidden ? "Show" : "Hide"}</button></span>`;
      const opts = st.hidden ? "" : fs.opts(g).map(([v, lab, title]) => {
        const s = st.states[v] || "ignore", cls = s === "include" ? "inc" : s === "exclude" ? "exc" : "";
        return `<button class="fbtn ${cls}" data-fgroup="${g.key}" data-fval="${String(v).replace(/"/g, "&quot;")}"${title ? ` title="${String(title).replace(/"/g, "&quot;")}"` : ""}>${lab}</button>`;
      }).join("");
      // A dynamic group with nothing loaded yet would render as a bare label + controls; say so instead.
      const body = st.hidden ? "" : (opts || `<span class="hint">nothing loaded for this category</span>`);
      return `<div class="fgroup"><div class="flabel">${g.label}</div><div class="fbody">${ctrl}${body}</div></div>`;
    }).join("");
    el.innerHTML = modBar + groups;
  };

  /* ----- one delegated click handler for the whole area; returns true if it handled the event ----- */
  fs.handleClick = e => {
    const opt = e.target.closest("[data-fval]");
    if (opt) { fs.cycle(opt.dataset.fgroup, opt.dataset.fval); fs.persist(); fs.renderArea(); cfg.onChange && cfg.onChange(); return true; }
    const ctrl = e.target.closest("[data-fctrl]");
    if (ctrl) { fs.ctrl(ctrl.dataset.fctrl, ctrl.dataset.fg); fs.persist(); fs.renderArea(); cfg.onChange && cfg.onChange(); return true; }
    const mod = e.target.closest("[data-fmod]");
    if (!mod) return false;
    switch (mod.dataset.fmod) {
      case "combine": fs.combine = fs.combine === "and" ? "or" : "and"; fs.persist(); fs.renderArea(); cfg.onChange && cfg.onChange(); break;
      case "showall": fs.groups.forEach(g => fs.state[g.key].hidden = false); fs.persist(); fs.renderArea(); break;
      case "hideall": fs.groups.forEach(g => fs.state[g.key].hidden = true); fs.persist(); fs.renderArea(); break;
      case "reset": fs.reset(); fs.renderArea(); cfg.onChange && cfg.onChange(); break;
      case "savedefault": fs.saveDefaults(); alert("Current filters saved as the default (Reset restores them)."); break;
    }
    return true;
  };

  return fs;
}
