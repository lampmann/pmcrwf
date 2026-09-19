/* ============================================================
   BESTIARY LIBRARY — import & search 5e.tools monster JSON.

   Same shape as the Spell and Equipment libraries (parse once into a flat
   record, filter with the shared tri-state engine in filters.js, click a
   name to expand, "+" to add to the sheet) with three differences that
   the data itself forces:

   1. _copy RESOLUTION. ~30% of 5e.tools' monsters are declared as a diff
      against another monster ("Acidic Mist Apparition" is an Air Elemental
      with some text swapped), and a copy may reference a base in a
      different file. So every raw monster is indexed first and resolution
      happens after all files are in, rather than parsing file-by-file the
      way spells and items do. See resolveCopy() for which _mod modes are
      supported.

   2. LAZY AUTO-LOAD, NO CACHE. The bestiary is ~9 MB across ~96 files —
      an order of magnitude more than the spell (1 MB) and item (2 MB)
      libraries, which load eagerly on every page load. Fetching that for
      every player on every reload, when many will never open the module,
      isn't worth it, so the bestiary loads on first need instead: when you
      open the library, or on page load if your character already has
      companions whose statblocks need resolving. It's still zero-click in
      both cases, just deferred, and takes about a second from a local
      server. It is also the one library that isn't cached to localStorage
      — see saveLib() for why.

   3. SCALING SUMMONS. Tasha's-style summons (Summon Beast, Summon Fey, …)
      ship their statblock with placeholders instead of numbers —
      {@hitYourSpellAttack} for the to-hit, and "summonSpellLevel"/"PB"
      inside damage expressions. Those are parsed through to the record
      unresolved and only substituted at roll time against the caster's own
      sheet (see companions.js), so a Bestial Spirit's Maul actually reads
      the caster's spell attack bonus and the level it was cast at.

   Nothing from 5e.tools is bundled — data/bestiary/ is user-supplied and
   gitignored, exactly like data/spells/ and data/items.json.
   ============================================================ */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const MON_LIB_SCHEMA = 1;   // bump when the parsed-monster shape changes (forces a one-time re-import)
  let MON_LIB = [];
  let LOAD_STATE = "idle";    // idle | loading | loaded — drives lazy auto-load (see ensureBestiary)

  /* ---------- 5e.tools code tables (short, fixed, prose-free — see DOCS "Where game data comes from") ---------- */
  const SIZES = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
  const ALIGN = {
    L: "lawful", N: "neutral", C: "chaotic", G: "good", E: "evil",
    U: "unaligned", A: "any alignment", NX: "neutral", NY: "neutral",
  };
  const SENSE_TAGS = { B: "Blindsight", D: "Darkvision", SD: "Superior Darkvision", T: "Tremorsense", U: "Truesight" };
  // DMG (2014) p.274 "Experience Points by Challenge Rating" — a number per CR, no prose.
  const CR_XP = {
    "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
    "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000,
    "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
    "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000,
    "28": 120000, "29": 135000, "30": 155000,
  };
  const CR_NUM = { "0": 0, "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 };
  const SPEED_KINDS = ["walk", "burrow", "climb", "fly", "swim"];
  const ABIL_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
  const capWord = s => (s ? String(s)[0].toUpperCase() + String(s).slice(1) : "");

  /* ============================================================
     _copy resolution
     A copy inherits every field of its base, then applies its own fields as
     overrides, then applies _mod operations. Supported modes cover ~99% of
     what the 2014 bestiary actually uses; the spell-list modes
     (replaceSpells/addSpells/removeSpells, ~20 monsters) and _templates
     (~190 monsters, which graft on a whole creature template) are not
     applied — those records still resolve to a correct base statblock and
     are flagged with `partial` so the UI can say so rather than quietly
     presenting an incomplete block as authoritative.
     ============================================================ */
  const rawKey = (name, source) => String(name || "").toLowerCase() + "|" + String(source || "").toLowerCase();

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  // recursive substring replace across every string in a statblock ("elemental" -> "apparition")
  function replaceTxtDeep(node, find, repl) {
    if (typeof node === "string") {
      const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      return node.replace(re, m => (m[0] === m[0].toUpperCase() ? capWord(repl) : repl));
    }
    if (Array.isArray(node)) return node.map(n => replaceTxtDeep(n, find, repl));
    if (node && typeof node === "object") {
      const out = {};
      // "name" is a string like any other here — 5e.tools' replaceTxt deliberately renames actions too.
      Object.keys(node).forEach(k => { out[k] = replaceTxtDeep(node[k], find, repl); });
      return out;
    }
    return node;
  }
  const asArray = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const modItems = m => asArray(m.items);
  const namesOf = m => asArray(m.names).map(n => String(n).toLowerCase());

  function applyMod(target, prop, mod) {
    const mode = mod.mode;
    if (mode === "replaceTxt") {
      const scope = prop === "*" ? Object.keys(target) : [prop];
      scope.forEach(k => {
        if (k === "name" || k === "source" || k === "_copy") return;   // never rewrite the record's own identity
        target[k] = replaceTxtDeep(target[k], mod.replace, mod.with);
      });
      return;
    }
    if (mode === "setProp") { target[mod.prop] = mod.value; return; }
    if (mode === "addSkills") {
      target.skill = Object.assign({}, target.skill);
      Object.entries(mod.skills || {}).forEach(([k, v]) => { target.skill[k] = typeof v === "number" ? (v > 0 ? "+" + v : String(v)) : v; });
      return;
    }
    const arr = Array.isArray(target[prop]) ? target[prop].slice() : [];
    if (mode === "appendArr") target[prop] = arr.concat(modItems(mod));
    else if (mode === "prependArr") target[prop] = modItems(mod).concat(arr);
    else if (mode === "insertArr") { arr.splice(Number(mod.index) || 0, 0, ...modItems(mod)); target[prop] = arr; }
    else if (mode === "appendIfNotExistsArr") {
      const have = new Set(arr.map(e => String(e && e.name || e).toLowerCase()));
      target[prop] = arr.concat(modItems(mod).filter(e => !have.has(String(e && e.name || e).toLowerCase())));
    } else if (mode === "removeArr") {
      const kill = new Set(namesOf(mod));
      target[prop] = arr.filter(e => !kill.has(String(e && e.name || e).toLowerCase()));
    } else if (mode === "replaceArr") {
      const find = String(mod.replace && mod.replace.name || mod.replace || "").toLowerCase();
      const i = arr.findIndex(e => String(e && e.name || e).toLowerCase() === find);
      if (i >= 0) { arr.splice(i, 1, ...modItems(mod)); target[prop] = arr; }
      else target[prop] = arr.concat(modItems(mod));   // base changed shape upstream — append rather than drop
    }
    // unsupported (spell-list) modes fall through untouched; the record is flagged `partial` by resolveCopy
  }

  const SPELL_MODES = new Set(["replaceSpells", "addSpells", "removeSpells"]);

  function resolveCopy(raw, index, depth) {
    if (!raw._copy) return raw;
    if ((depth || 0) > 5) return raw;                        // cyclic/very deep chains: give up, keep the stub
    const base = index[rawKey(raw._copy.name, raw._copy.source)];
    if (!base) return raw;                                   // base lives in a file the user didn't load
    const out = deepClone(resolveCopy(base, index, (depth || 0) + 1));
    let partial = !!raw._copy._templates;
    // the copy's own literal fields win over anything inherited
    Object.keys(raw).forEach(k => { if (k !== "_copy") out[k] = deepClone(raw[k]); });
    out.name = raw.name; out.source = raw.source;
    Object.entries(raw._copy._mod || {}).forEach(([prop, spec]) => {
      asArray(spec).forEach(mod => {
        if (!mod || !mod.mode) return;
        if (SPELL_MODES.has(mod.mode)) { partial = true; return; }
        applyMod(out, prop, mod);
      });
    });
    delete out._copy;
    out._partialCopy = partial;
    out._copiedFrom = raw._copy.name;
    return out;
  }

  /* ============================================================
     Parsing one (already _copy-resolved) monster into a flat record
     ============================================================ */
  function acInfo(ac) {
    const list = asArray(ac);
    let num = null; const parts = [];
    list.forEach(a => {
      if (typeof a === "number") { if (num == null) num = a; parts.push(String(a)); return; }
      if (!a || typeof a !== "object") return;
      if (a.special) { parts.push(a.special); return; }
      if (typeof a.ac === "number" && num == null) num = a.ac;
      const from = (a.from || []).map(f => stripTags(String(f))).join(", ");
      parts.push(String(a.ac) + (from ? " (" + from + ")" : "") + (a.condition ? " " + stripTags(a.condition) : ""));
    });
    return { ac: num, acText: parts.join(", ") };
  }
  function hpInfo(hp) {
    if (!hp || typeof hp !== "object") return { avg: null, formula: "", special: "" };
    if (hp.special) return { avg: null, formula: "", special: stripTags(hp.special) };
    return { avg: typeof hp.average === "number" ? hp.average : null, formula: hp.formula || "", special: "" };
  }
  function speedInfo(sp) {
    if (typeof sp === "number") return { speeds: { walk: sp }, text: sp + " ft." };
    if (!sp || typeof sp !== "object") return { speeds: {}, text: "" };
    const speeds = {}, parts = [];
    SPEED_KINDS.forEach(k => {
      const v = sp[k]; if (v == null) return;
      const n = typeof v === "object" ? v.number : v;
      if (typeof n !== "number") return;
      speeds[k] = n;
      parts.push((k === "walk" ? "" : k + " ") + n + " ft." + (typeof v === "object" && v.condition ? " " + stripTags(v.condition) : ""));
    });
    if (sp.canHover) parts.push("(hover)");
    return { speeds, text: parts.join(", ") };
  }
  function typeInfo(t) {
    if (typeof t === "string") return { type: t, tags: [] };
    if (!t || typeof t !== "object") return { type: "", tags: [] };
    const tags = (t.tags || []).map(x => (typeof x === "string" ? x : (x && x.tag) || "")).filter(Boolean);
    return { type: t.type || "", tags };
  }
  function alignText(al) {
    const list = asArray(al);
    if (!list.length) return "";
    const words = [];
    list.forEach(a => {
      if (typeof a === "string") words.push(ALIGN[a] || a);
      else if (a && a.special) words.push(stripTags(a.special));
      else if (a && a.alignment) words.push(asArray(a.alignment).map(c => ALIGN[c] || c).join(" ") + (a.chance ? ` (${a.chance}%)` : ""));
    });
    // ["N"] is "neutral", but ["N","G"] is "neutral good" — dedupe only the doubled-neutral case
    const joined = words.join(" ");
    return joined === "neutral neutral" ? "neutral" : joined;
  }
  // resist/immune/vulnerable/conditionImmune: a flat list of names, possibly wrapped in
  // {resist:[…], note:"from nonmagical attacks", cond:true} groups. Keep both a flat array
  // (for filtering) and the full text (for display), since "immune to fire" and "immune to
  // fire from nonmagical attacks" are very different facts at the table.
  function dmgTypes(list, key) {
    const flat = [], parts = [];
    asArray(list).forEach(e => {
      if (typeof e === "string") { flat.push(e); parts.push(e); return; }
      if (!e || typeof e !== "object") return;
      if (e.special) { parts.push(stripTags(e.special)); return; }
      const inner = asArray(e[key]).map(x => (typeof x === "string" ? x : ""));
      inner.filter(Boolean).forEach(x => flat.push(x));
      const txt = inner.filter(Boolean).join(", ");
      parts.push([e.preNote ? stripTags(e.preNote) : "", txt, e.note ? stripTags(e.note) : ""].filter(Boolean).join(" "));
    });
    return { flat: [...new Set(flat)], text: parts.filter(Boolean).join("; ") };
  }

  /* ----- actions: pull the rollable parts out of 5e.tools' attack sentence -----
     "{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}7 ({@damage 2d4 + 2}) piercing damage."
     A summon's version instead reads "{@atk mw} {@hitYourSpellAttack} to hit … {@damage 1d8 + 4 +
     summonSpellLevel}" — both the to-hit and the damage stay symbolic here and are resolved against
     the caster's sheet at roll time (companions.js). */
  const ATK_KIND = { mw: "Melee Weapon Attack", rw: "Ranged Weapon Attack", ms: "Melee Spell Attack", rs: "Ranged Spell Attack", m: "Melee Attack" };
  // An action's own name can carry tags — almost always {@recharge N}, which stripTags would reduce to
  // a bare "4". Spell it out first ("Whirlwind (Recharge 4-6)"), since when an ability comes back is
  // exactly the kind of thing you need on the button, not buried in the statblock text.
  function actionName(name) {
    return stripTags(String(name || "")
      .replace(/\{@recharge (\d+)\}/gi, (m, n) => (n === "6" ? "(Recharge 6)" : `(Recharge ${n}-6)`))
      .replace(/\{@recharge\}/gi, "(Recharge 6)"));
  }
  function parseAction(a, kind) {
    const raw = flattenEntries(a.entries);
    const plain = stripTags(raw);
    const atkM = /\{@atk ([^}]+)\}/i.exec(raw);
    const kinds = atkM ? atkM[1].split(",").map(s => s.trim()) : [];
    const hitM = /\{@hit ([^}|]+)\}/i.exec(raw);
    const spellAtk = /\{@hitYourSpellAttack/i.test(raw);
    const dmg = [...raw.matchAll(/\{@damage ([^}|]+)\}/gi)].map(m => m[1].trim());
    const dcM = /\{@dc (\d+)\}/i.exec(raw);
    const saveM = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i.exec(plain);
    const reachM = /reach (\d+)\s*ft/i.exec(plain);
    const rangeM = /range (\d+)(?:\/(\d+))?\s*ft/i.exec(plain);
    return {
      name: actionName(a.name), kind,
      raw, text: plain,
      isAttack: !!(atkM && (hitM || spellAtk)),
      atkKinds: kinds.map(k => ATK_KIND[k] || k),
      hit: hitM ? Number(hitM[1]) : null,      // null + spellAtk => use the caster's spell attack bonus
      spellAtk,
      dmg,                                     // expressions, placeholders intact
      dc: dcM ? Number(dcM[1]) : null,
      saveAbil: saveM ? saveM[1].slice(0, 3) : "",
      reach: reachM ? Number(reachM[1]) : null,
      range: rangeM ? (rangeM[2] ? rangeM[1] + "/" + rangeM[2] : rangeM[1]) : null,
    };
  }
  function parseActionList(list, kind) { return asArray(list).filter(a => a && typeof a === "object").map(a => parseAction(a, kind)); }

  function parseMonster(raw) {
    const { ac, acText } = acInfo(raw.ac);
    const hp = hpInfo(raw.hp);
    const sp = speedInfo(raw.speed);
    const ty = typeInfo(raw.type);
    const cr = typeof raw.cr === "object" && raw.cr ? (raw.cr.cr || raw.cr.coven || "") : (raw.cr || "");
    const abil = {}; ABIL_KEYS.forEach(k => { abil[k] = typeof raw[k] === "number" ? raw[k] : 10; });
    const res = dmgTypes(raw.resist, "resist"), imm = dmgTypes(raw.immune, "immune"), vul = dmgTypes(raw.vulnerable, "vulnerable");
    const actions = parseActionList(raw.action, "action");
    return {
      name: raw.name, source: raw.source || "", page: raw.page || null,
      size: (asArray(raw.size).map(c => SIZES[c] || c)),
      type: ty.type, typeTags: ty.tags,
      alignment: alignText(raw.alignment),
      ac, acText,
      hpAvg: hp.avg, hpFormula: hp.formula, hpSpecial: hp.special,
      speeds: sp.speeds, speedText: sp.text,
      ...abil,
      save: raw.save || {}, skill: sanitizeSkills(raw.skill),
      senses: asArray(raw.senses).filter(s => typeof s === "string"), senseTags: (raw.senseTags || []).map(t => SENSE_TAGS[t] || t),
      passive: typeof raw.passive === "number" ? raw.passive : null,
      languages: asArray(raw.languages).filter(s => typeof s === "string"),
      cr: String(cr), crNum: crToNum(cr), xp: CR_XP[String(cr)] != null ? CR_XP[String(cr)] : null,
      resistText: res.text, resist: res.flat,
      immuneText: imm.text, immune: imm.flat,
      vulnerableText: vul.text, vulnerable: vul.flat,
      conditionImmune: dmgTypes(raw.conditionImmune, "conditionImmune").flat,
      traits: parseActionList(raw.trait, "trait"),
      actions,
      bonusActions: parseActionList(raw.bonus, "bonus"),
      reactions: parseActionList(raw.reaction, "reaction"),
      legendary: parseActionList(raw.legendary, "legendary"),
      legendaryHeader: raw.legendaryHeader ? stripTags(flattenEntries(raw.legendaryHeader)) : "",
      spellcasting: asArray(raw.spellcasting).map(sc => ({
        name: sc.name || "Spellcasting",
        text: stripTags(flattenEntries(sc.headerEntries)),
        raw: flattenEntries(sc.headerEntries),
        lists: spellLists(sc),
      })),
      environment: raw.environment || [],
      traitTags: raw.traitTags || [], actionTags: raw.actionTags || [],
      damageTags: (raw.damageTags || []).map(t => (typeof DMG_TYPE_NAMES !== "undefined" && DMG_TYPE_NAMES[t]) || t),
      summonedBySpell: raw.summonedBySpell ? String(raw.summonedBySpell).split("|")[0] : "",
      summonSpellLevel: typeof raw.summonedBySpellLevel === "number" ? raw.summonedBySpellLevel : null,
      summonedByClass: raw.summonedByClass ? String(raw.summonedByClass).split("|")[0] : "",
      srd: !!raw.srd || !!raw.basicRules,
      partial: !!raw._partialCopy, copiedFrom: raw._copiedFrom || "",
      hasAttacks: actions.some(a => a.isAttack),
    };
  }
  // 5e.tools stores per-skill bonuses as strings ("+3"), but a homebrew file may use a number,
  // and an "other" key holds free-form conditional bonuses we can't turn into a roll button.
  function sanitizeSkills(sk) {
    if (!sk || typeof sk !== "object") return {};
    const out = {};
    Object.entries(sk).forEach(([k, v]) => { if (k !== "other" && (typeof v === "string" || typeof v === "number")) out[k] = String(v); });
    return out;
  }
  // null, not 0, when a statblock has no CR at all (summon spirits, NPC stat arrays): Number("") is 0,
  // which would quietly slip every CR-less creature into a "CR <= 2" search as if it were CR 0.
  function crToNum(cr) {
    const s = String(cr == null ? "" : cr).trim();
    if (!s) return null;
    if (s in CR_NUM) return CR_NUM[s];
    const n = Number(s);
    return isNaN(n) ? null : n;
  }
  function spellLists(sc) {
    const out = [];
    if (sc.will) out.push({ label: "At will", spells: flatSpellNames(sc.will) });
    Object.entries(sc.daily || {}).forEach(([k, v]) => out.push({ label: k.replace("e", "") + "/day" + (k.endsWith("e") ? " each" : ""), spells: flatSpellNames(v) }));
    Object.entries(sc.spells || {}).forEach(([lvl, info]) => {
      const slots = info && info.slots ? ` (${info.slots} slot${info.slots === 1 ? "" : "s"})` : "";
      out.push({ label: (lvl === "0" ? "Cantrips" : "Level " + lvl) + slots, spells: flatSpellNames(info && info.spells) });
    });
    return out;
  }
  function flatSpellNames(list) {
    return asArray(list).map(s => stripTags(typeof s === "string" ? s : (s && s.entry) || "")).filter(Boolean);
  }

  /* ============================================================
     Library assembly
     ============================================================ */
  function ingest(rawLists) {
    const index = {};
    rawLists.forEach(list => asArray(list).forEach(m => { if (m && m.name) index[rawKey(m.name, m.source)] = m; }));
    const seen = new Set(MON_LIB.map(m => m.name + "|" + m.source));
    const out = [];
    Object.values(index).forEach(m => {
      const k = m.name + "|" + (m.source || "");
      if (seen.has(k)) return;
      try { out.push(parseMonster(resolveCopy(m, index, 0))); seen.add(k); }
      catch (e) { console.warn("Skipped a malformed monster entry:", m && m.name, e); }
    });
    MON_LIB = MON_LIB.concat(out);
    MON_LIB.sort((a, b) => a.name.localeCompare(b.name));
  }
  function sources() { return [...new Set(MON_LIB.map(m => m.source))].sort(); }

  /* ----- auto-load from a local data/ folder (see the header note on why this one is lazy) ----- */
  const BESTIARY_INDEX = "data/bestiary/index.json";
  async function autoLoad() {
    let idx;
    try {
      const res = await dataFetch(BESTIARY_INDEX);
      if (!res.ok) return { found: false, blocked: false };
      idx = await res.json();
    } catch (e) { return { found: false, blocked: true }; }
    const files = Object.values(idx);
    const results = await Promise.allSettled(
      files.map(f => dataFetch("data/bestiary/" + f).then(r => (r.ok ? r.json() : Promise.reject(r.status))))
    );
    const lists = []; let filesLoaded = 0;
    results.forEach(r => { if (r.status === "fulfilled") { lists.push(r.value.monster || []); filesLoaded++; } });
    if (lists.length) { ingest(lists); saveLib(); }
    return { found: true, blocked: false, filesLoaded, filesTotal: files.length };
  }
  function loadFiles(files) {
    const total = files.length; let done = 0; const lists = [], errs = [];
    [...files].forEach(file => {
      const rd = new FileReader();
      rd.onload = () => {
        try { lists.push((JSON.parse(rd.result).monster) || []); }
        catch (e) { errs.push(file.name + ": " + e); }
        if (++done === total) {
          ingest(lists); saveLib(); render();
          if (errs.length) alert("Some files failed:\n" + errs.join("\n"));
        }
      };
      rd.readAsText(file);
    });
  }
  /* The other three libraries cache their parsed form in localStorage. This one deliberately does
     not: the full parsed bestiary is ~14 MB, about 7x the equipment library and larger than every
     other cache combined, so keeping it would spend most of the origin's storage budget — and risk
     evicting the spell and item caches, which are read far more often — to save a load that the
     lazy fetch already defers and that takes about a second from a local server. Files imported by
     hand through the picker live for the session only, same as any other uncached library. */
  function saveLib() { localStorage.removeItem("charsheet-monsterlib"); }   // also clears the key older builds wrote
  function loadLib() { localStorage.removeItem("charsheet-monsterlib"); }

  /* ----- lazy auto-load: run once, on first actual need, and let every caller await the same run ----- */
  let _loadPromise = null;
  function ensureBestiary() {
    if (LOAD_STATE === "loaded") return Promise.resolve({ cached: true });
    if (_loadPromise) return _loadPromise;
    LOAD_STATE = "loading";
    setStatus("loading the bestiary from data/ … (this one is big - ~9 MB)");
    _loadPromise = autoLoad().then(res => {
      LOAD_STATE = "loaded";
      setStatus(typeof autoStatusText === "function" ? autoStatusText(res, "monsters") : "");
      render();
      if (typeof renderCompanions === "function") renderCompanions();
      return res;
    }).catch(e => {
      LOAD_STATE = "idle"; _loadPromise = null;
      setStatus("bestiary load failed - see the console, or import files manually below");
      throw e;
    });
    return _loadPromise;
  }
  function setStatus(txt) { const el = $("mon-lib-autostatus"); if (el) el.textContent = txt; }

  /* Connecting a data/ folder mid-session invalidates whatever this module concluded earlier —
     usually "there is no bestiary here". Throw away the memoised load and the parsed monsters and
     go back to idle, so the next thing that needs a monster loads from the new folder. Deliberately
     does NOT start that load: the bestiary is ~9 MB and stays lazy for the same reason it always
     was — someone who never opens the module shouldn't pay for it. */
  function resetBestiary() {
    MON_LIB = []; LOAD_STATE = "idle"; _loadPromise = null;
    setStatus("");
    render();
    if (typeof renderCompanions === "function") renderCompanions();
  }

  /* ============================================================
     Filters — mirrors 5e.tools' own bestiary filter panel, minus the facets
     that need data we don't parse. The numeric ones (CR/AC/HP/speed) matter
     most in practice: "beast, CR <= 2, has a fly speed" is the Conjure
     Animals shopping list.
     ============================================================ */
  const dynOf = get => () => [...new Set(MON_LIB.flatMap(get).filter(Boolean))].sort();
  const FGROUPS = [
    { key: "source", label: "Source", dynamic: true, get: m => [m.source],
      dynOpts: () => sources().map(s => [s, s, (typeof SOURCE_NAMES !== "undefined" && SOURCE_NAMES[s]) || s]) },
    { key: "srcgroup", label: "Source Group", get: m => [typeof sourceGroupOf === "function" ? sourceGroupOf(m.source) : "supplement"],
      opts: [["core", "Core"], ["supplement", "Supplement"], ["adventure", "Adventure"]] },
    { key: "type", label: "Type", dynamic: true, get: m => (m.type ? [m.type] : []), dynOpts: dynOf(m => [m.type]) },
    { key: "size", label: "Size", get: m => m.size || [], opts: Object.values(SIZES).map(s => [s, s]) },
    { key: "cr", label: "CR", kind: "range", unit: "CR", min: 0, max: 30, getNum: m => m.crNum },
    { key: "ac", label: "AC", kind: "range", unit: "AC", min: 0, max: 30, getNum: m => m.ac },
    { key: "hp", label: "HP", kind: "range", unit: "hp", min: 0, max: 700, getNum: m => m.hpAvg },
    { key: "speedwalk", label: "Walk Speed", kind: "range", unit: "ft", min: 0, max: 120, getNum: m => (m.speeds && m.speeds.walk != null ? m.speeds.walk : null) },
    { key: "speedfly", label: "Fly Speed", kind: "range", unit: "ft", min: 0, max: 200, getNum: m => (m.speeds && m.speeds.fly != null ? m.speeds.fly : null) },
    { key: "movement", label: "Movement", get: m => SPEED_KINDS.filter(k => m.speeds && m.speeds[k] != null), opts: SPEED_KINDS.map(k => [k, capWord(k)]) },
    { key: "senses", label: "Senses", dynamic: true, get: m => m.senseTags || [], dynOpts: dynOf(m => m.senseTags || []) },
    { key: "env", label: "Environment", dynamic: true, get: m => m.environment || [], dynOpts: dynOf(m => m.environment || []) },
    { key: "summon", label: "Summoned By", dynamic: true, get: m => [m.summonedBySpell, m.summonedByClass].filter(Boolean),
      dynOpts: dynOf(m => [m.summonedBySpell, m.summonedByClass]) },
    { key: "dmgdealt", label: "Damage Dealt", dynamic: true, get: m => m.damageTags || [], dynOpts: dynOf(m => m.damageTags || []) },
    { key: "resist", label: "Resistance", get: m => m.resist || [], opts: (typeof DMG_FILTER_TYPES !== "undefined" ? DMG_FILTER_TYPES : []).map(x => [x, capWord(x)]) },
    { key: "immune", label: "Immunity", get: m => m.immune || [], opts: (typeof DMG_FILTER_TYPES !== "undefined" ? DMG_FILTER_TYPES : []).map(x => [x, capWord(x)]) },
    { key: "vuln", label: "Vulnerability", get: m => m.vulnerable || [], opts: (typeof DMG_FILTER_TYPES !== "undefined" ? DMG_FILTER_TYPES : []).map(x => [x, capWord(x)]) },
    { key: "condimm", label: "Condition Immunity", get: m => m.conditionImmune || [],
      opts: ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"].map(x => [x, capWord(x)]) },
    { key: "traits", label: "Traits", dynamic: true, get: m => m.traitTags || [], dynOpts: dynOf(m => m.traitTags || []) },
    { key: "actions", label: "Actions", dynamic: true, get: m => m.actionTags || [], dynOpts: dynOf(m => m.actionTags || []) },
    { key: "misc", label: "Misc", opts: [["legendary", "Legendary"], ["spellcaster", "Spellcaster"], ["summon", "Summonable"], ["srd", "SRD"], ["partial", "Partial (unresolved copy)"]],
      get: m => [m.legendary.length ? "legendary" : "", m.spellcasting.length ? "spellcaster" : "",
                 (m.summonedBySpell || m.summonedByClass) ? "summon" : "", m.srd ? "srd" : "", m.partial ? "partial" : ""].filter(Boolean) },
  ];
  const FILTERS = createFilterSet({ ns: "monster", groups: FGROUPS, areaId: "mon-filter-area", searchId: "mon-search", onChange: () => renderResults() });

  /* ============================================================
     Rendering
     ============================================================ */
  const keyOf = m => m.name + "|" + m.source;
  function find(key) { return MON_LIB.find(m => keyOf(m) === key) || null; }
  function findByName(name) {
    const q = String(name || "").trim().toLowerCase(); if (!q) return null;
    return MON_LIB.find(m => m.name.toLowerCase() === q) || null;
  }

  function render() {
    const c = $("mon-lib-count"); if (!c) return;
    c.textContent = MON_LIB.length ? (MON_LIB.length + " creatures · " + sources().length + " source(s)") : "no bestiary loaded";
    FILTERS.renderArea();
    renderResults();
  }
  function renderResults() {
    const el = $("mon-results"); if (!el) return;
    const q = ($("mon-search").value || "").toLowerCase().trim();
    const active = FILTERS.activeGroups();
    const rows = []; let more = 0;
    for (const m of MON_LIB) {
      if (q && !(m.name + " " + m.type + " " + m.source + " " + (m.typeTags || []).join(" ")).toLowerCase().includes(q)) continue;
      if (!FILTERS.passes(m, active)) continue;
      if (rows.length >= 250) { more++; continue; }
      rows.push(m);
    }
    if (!MON_LIB.length) {
      el.innerHTML = LOAD_STATE === "loading"
        ? "<div class='hint'>loading…</div>"
        : "<div class='hint'>No bestiary loaded.</div>";
      return;
    }
    if (!rows.length) { el.innerHTML = "<div class='hint'>no matches</div>"; return; }
    el.innerHTML = `<table class="spell-table"><tbody>${rows.map(rowHtml).join("")}</tbody></table>` +
      (more ? `<div class='hint'>…and ${more} more - narrow your search</div>` : "");
  }
  function rowHtml(m) {
    const key = escapeHtml(keyOf(m)).replace(/"/g, "&quot;");
    const size = (m.size || []).join("/");
    return `<tr>
      <td><button class="mon-lib-add" data-key="${key}" aria-label="add as a companion / summon">+</button></td>
      <td class="c"><b>${escapeHtml(m.cr || "-")}</b></td>
      <td class="nm"><a class="mon-name-link" data-key="${key}">${escapeHtml(m.name)}</a>${m.partial ? ` <span class="hint">*</span>` : ""}</td>
      <td class="hint">${escapeHtml(size)} ${escapeHtml(m.type)}</td>
      <td class="c hint">${m.ac == null ? "" : m.ac}</td>
      <td class="c hint">${m.hpAvg == null ? "" : m.hpAvg}</td>
      <td class="hint">${escapeHtml(m.speedText)}</td>
      <td class="hint">${escapeHtml(m.source)}</td>
    </tr>`;
  }

  /* ----- full statblock -----
     Text goes through renderInlineSpellText() (spellcasting.js) so every {@damage}/{@dice}/{@hit}
     inside a statblock is click-to-roll, exactly like an expanded spell description. Three 5e.tools
     tags it doesn't know about are normalized first: {@atk …} to its English label, {@h} to "Hit: ",
     and a summon's {@hitYourSpellAttack} to the caster's own live spell attack bonus. */
  function inlineText(raw, label, ctx) {
    let s = String(raw || "")
      .replace(/\{@atk ([^}]+)\}/gi, (m, k) => k.split(",").map(x => ATK_KIND[x.trim()] || x.trim()).join(" or ") + ":")
      .replace(/\{@h\}/gi, "Hit: ")
      // renderInlineSpellText turns {@hit 4} into the link text "+4 to hit", and a statblock's own
      // sentence already continues "… to hit, reach 5 ft." - drop the duplicate rather than the tag,
      // so the number stays clickable.
      .replace(/\{@hit ([^}|]+)\}\s+to hit\b/gi, "{@hit $1}")
      // {@dc 11} is only the number; without this it reads "a 11 Strength saving throw"
      .replace(/\{@dc (\d+)\}/gi, "DC $1");
    if (/\{@hitYourSpellAttack/i.test(s)) {
      const b = typeof spellAttackBonus === "function" ? spellAttackBonus() : 0;
      s = s.replace(/\{@hitYourSpellAttack[^}]*\}/gi, `{@hit ${b}}`);
    }
    s = resolvePlaceholders(s, ctx);
    return typeof renderInlineSpellText === "function" ? renderInlineSpellText(s, label) : escapeHtml(stripTags(s));
  }
  // "summonSpellLevel" and "PB" appear inside damage expressions on Tasha's-style summons; the caster's
  // own sheet is the only place their values exist. ctx is supplied by companions.js for an added
  // companion, and defaults to the statblock's own minimum level when just browsing the library.
  function resolvePlaceholders(s, ctx) {
    const lvl = ctx && ctx.spellLevel != null ? ctx.spellLevel : (ctx && ctx.minLevel) || null;
    const pb = typeof profBonus === "function" ? profBonus() : 2;
    let out = String(s == null ? "" : s);
    if (lvl != null) out = out.replace(/\bsummonSpellLevel\b/g, String(lvl)).replace(/the level of the spell/gi, "the level of the spell (" + lvl + ")");
    out = out.replace(/\bPB\b/g, String(pb));
    if (typeof spellSaveDC === "function" && $("spell-ability") && $("spell-ability").value) {
      out = out.replace(/your spell save DC/gi, "your spell save DC (" + spellSaveDC() + ")");
    }
    return out;
  }

  function blockLine(label, val) { return val ? `<div><b>${label}</b> ${val}</div>` : ""; }
  function abilRow(m) {
    return `<table class="spell-table"><tbody><tr>${ABIL_KEYS.map(k =>
      `<td class="c"><b>${k.toUpperCase()}</b> ${m[k]} (${sign(Math.floor((m[k] - 10) / 2))})</td>`).join("")}</tr></tbody></table>`;
  }
  function sign(n) { return n >= 0 ? "+" + n : String(n); }
  function entryBlock(title, list, m, ctx) {
    if (!list || !list.length) return "";
    return `<div style="margin-top:.3rem"><b><i>${title}</i></b></div>` + list.map(a =>
      `<div><b>${escapeHtml(a.name)}${a.name ? "." : ""}</b> ${inlineText(a.raw, m.name + " - " + (a.name || title), ctx)}</div>`).join("");
  }
  function statblockHtml(m, ctx) {
    const meta = [(m.size || []).join("/"), m.type + ((m.typeTags || []).length ? " (" + m.typeTags.join(", ") + ")" : ""), m.alignment].filter(Boolean).join(" ");
    const hp = m.hpSpecial ? m.hpSpecial : (m.hpAvg == null ? "-" : m.hpAvg + (m.hpFormula ? ` (${m.hpFormula})` : ""));
    const saves = Object.entries(m.save || {}).map(([k, v]) => capWord(k) + " " + v).join(", ");
    const skills = Object.entries(m.skill || {}).map(([k, v]) => capWord(k) + " " + v).join(", ");
    const senses = (m.senses || []).concat(m.passive != null ? ["passive Perception " + m.passive] : []).join(", ");
    const spellBlocks = (m.spellcasting || []).map(sc =>
      `<div style="margin-top:.3rem"><b>${escapeHtml(sc.name)}.</b> ${inlineText(sc.raw, m.name + " - " + sc.name, ctx)}` +
      sc.lists.map(l => `<div><i>${escapeHtml(l.label)}:</i> ${escapeHtml(l.spells.join(", "))}</div>`).join("") + `</div>`).join("");
    return `<div class="hint">${escapeHtml(meta)}${m.page ? " · p." + m.page : ""}${m.source ? " · " + escapeHtml(m.source) : ""}</div>` +
      (m.partial ? `<div class="hint" style="color:var(--danger)">Derived from ${escapeHtml(m.copiedFrom)} via a 5e.tools _copy whose template/spell-list changes this sheet doesn't apply - the base statblock below is right, but check the book for what this variant adds.</div>` : "") +
      blockLine("Armor Class", escapeHtml(m.acText)) +
      blockLine("Hit Points", escapeHtml(String(hp))) +
      blockLine("Speed", escapeHtml(m.speedText)) +
      abilRow(m) +
      blockLine("Saving Throws", escapeHtml(saves)) +
      blockLine("Skills", escapeHtml(skills)) +
      blockLine("Damage Vulnerabilities", escapeHtml(m.vulnerableText)) +
      blockLine("Damage Resistances", escapeHtml(m.resistText)) +
      blockLine("Damage Immunities", escapeHtml(m.immuneText)) +
      blockLine("Condition Immunities", escapeHtml((m.conditionImmune || []).join(", "))) +
      blockLine("Senses", escapeHtml(senses)) +
      blockLine("Languages", escapeHtml((m.languages || []).join(", "))) +
      blockLine("Challenge", escapeHtml(m.cr || "-") + (m.xp != null ? ` (${m.xp.toLocaleString()} XP)` : "")) +
      entryBlock("Traits", m.traits, m, ctx) + spellBlocks +
      entryBlock("Actions", m.actions, m, ctx) +
      entryBlock("Bonus Actions", m.bonusActions, m, ctx) +
      entryBlock("Reactions", m.reactions, m, ctx) +
      (m.legendary && m.legendary.length ? `<div style="margin-top:.3rem"><b><i>Legendary Actions</i></b></div>` +
        (m.legendaryHeader ? `<div class="hint">${escapeHtml(m.legendaryHeader)}</div>` : "") +
        m.legendary.map(a => `<div><b>${escapeHtml(a.name)}.</b> ${inlineText(a.raw, m.name + " - " + a.name, ctx)}</div>`).join("") : "");
  }
  function toggleDetail(link) {
    const tr = link.closest("tr"), next = tr.nextElementSibling;
    if (next && next.classList.contains("sp-detail")) { next.remove(); return; }
    const m = find(link.dataset.key); if (!m) return;
    const det = document.createElement("tr"); det.className = "sp-detail";
    det.innerHTML = `<td></td><td colspan="7">${statblockHtml(m, { minLevel: m.summonSpellLevel })}</td>`;
    tr.after(det);
  }

  /* ============================================================
     Wiring
     ============================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    if (!$("mon-results")) return;
    loadLib(); FILTERS.load(); render();
    $("mon-search").addEventListener("input", renderResults);
    $("mon-filter-area").addEventListener("click", e => FILTERS.handleClick(e));
    $("mon-filter-area").addEventListener("input", e => FILTERS.handleInput(e));
    $("mon-results").addEventListener("click", e => {
      const add = e.target.closest(".mon-lib-add");
      if (add) { if (typeof addCompanion === "function") addCompanion(add.dataset.key); return; }
      const link = e.target.closest(".mon-name-link");
      if (link) { e.preventDefault(); toggleDetail(link); }
    });
    $("mon-import").addEventListener("change", e => { if (e.target.files.length) loadFiles(e.target.files); e.target.value = ""; });
    $("mon-lib-reload").addEventListener("click", () => { LOAD_STATE = "idle"; _loadPromise = null; ensureBestiary(); });
    $("mon-lib-clear").addEventListener("click", () => {
      if (confirm("Clear the imported bestiary? (does not affect your character's companions)")) {
        MON_LIB = []; LOAD_STATE = "idle"; _loadPromise = null;
        localStorage.removeItem("charsheet-monsterlib");
        render();
      }
    });
    // Library starts collapsed, like the Spell and Equipment libraries; opening it is also what
    // triggers the lazy load (see the header note).
    $("mon-lib-toggle").addEventListener("click", () => {
      const open = $("mon-library-body").style.display === "none";
      $("mon-library-body").style.display = open ? "" : "none";
      if (open) {
        ensureBestiary();
        $("mon-search").focus();
        $("mon-library-body").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  });

  /* ----- exposed for companions.js, persistence.js and app.js ----- */
  window.findMonsterByKey = find;
  window.findMonsterByName = findByName;
  window.monsterStatblockHtml = statblockHtml;
  window.monsterInlineText = inlineText;
  window.monsterResolvePlaceholders = resolvePlaceholders;
  window.monsterLibCount = () => MON_LIB.length;
  window.monsterLibLoaded = () => LOAD_STATE === "loaded";
  window.ensureBestiary = ensureBestiary;
  window.resetBestiary = resetBestiary;
  window.renderMonsterLibrary = render;
})();
