/* ============================================================
   DATA FOLDER — one shim so "where does data/ come from" is asked once.

   Every library in this sheet reads the user's own copy of 5e.tools' data/
   directory: spells, equipment, classes, races, feats, backgrounds, the
   bestiary, conditions and variant rules. None of it is bundled and none of
   it ever will be (DOCS.md, "Where game data comes from"), so each loader
   has always just fetched a relative path and failed open if it wasn't
   there.

   That works when the sheet is served out of a folder that HAS a data/ next
   to it, which is what pmcrwf.cmd does. It does not work when the sheet is
   served from a website, because the website deliberately does not carry the
   data. So this file adds a second place a data/ path can be answered from:
   a folder on the user's own disk, picked once and remembered.

   The whole mechanism is a single function. dataFetch(url) looks like
   fetch(url) and is used in place of it by every loader:

     - no folder connected  -> a real fetch(), byte for byte what happened
                               before this file existed
     - folder connected     -> the file is read off the user's disk through
                               the File System Access API and handed back in
                               a response-shaped wrapper

   Because the shape matches, the loaders did not have to learn anything.
   They still get {ok, status, json(), text()}, still return "not found" for
   a missing file, and still fail open. A hosted visitor and a local player
   run identical code down to the parse.

   WHY A HANDLE AND NOT A FILE PICKER. <input type="file" multiple> already
   exists next to every library and still does — it is the fallback and it
   works everywhere. But it forgets. Every session you would re-pick several
   thousand JSON files, and the bestiary in particular is deliberately never
   cached (~14 MB parsed; see monster-library.js), so "re-import by hand"
   would be the first thing you did at every session. A directory handle is
   the only thing a browser will remember across restarts, so it is the only
   thing that makes a hosted copy usable at a table.

   WHY INDEXEDDB. A FileSystemDirectoryHandle is structured-cloneable but not
   JSON-serialisable, so localStorage — where every other preference in this
   project lives — physically cannot hold one. IndexedDB can. That is the
   entire reason this file talks to a second storage API, and it stores
   exactly one value.

   PERMISSION IS NOT STORAGE. Remembering the handle and being allowed to
   read it are separate. After a browser restart the handle is still there
   and its permission is back to "prompt", and a browser will only upgrade
   that inside a user gesture. So a returning visitor gets a button, not a
   silent read — one click, no re-picking. When the permission did survive
   (Chrome keeps it for installed apps and for folders you use repeatedly)
   the connection is restored with no click at all.

   Chromium only, today. Firefox and Safari have no showDirectoryPicker, and
   there is no polyfill worth the name — so the bar says so plainly and
   points at the manual importers rather than pretending.
   ============================================================ */

const DATA_IDB_NAME = "pmcrwf-data-folder";
const DATA_IDB_STORE = "handles";
const DATA_IDB_KEY = "root";

/* The connected folder, or null. Read by dataFetch and by the bar; nothing else should touch it. */
let DATA_DIR = null;
/* Why there is no folder: "unsupported" | "none" | "needs-permission" | "denied" | null (connected). */
let DATA_DIR_STATE = "none";
/* True when a plain fetch() of data/ works — i.e. the sheet is served next to a real data/ folder.
   Set by probeServedData() at startup. When it's true the bar stays out of the way entirely. */
let DATA_SERVED = false;

function dataFolderSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/* ---------- the one IndexedDB value ---------- */
function dataIdb() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DATA_IDB_NAME, 1); }
    catch (e) { return reject(e); }   // private-mode Firefox used to throw here outright
    req.onupgradeneeded = () => req.result.createObjectStore(DATA_IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(key, val) {
  return dataIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_IDB_STORE, "readwrite");
    tx.objectStore(DATA_IDB_STORE).put(val, key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}
function idbGet(key) {
  return dataIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_IDB_STORE, "readonly");
    const r = tx.objectStore(DATA_IDB_STORE).get(key);
    r.onsuccess = () => { db.close(); resolve(r.result); };
    r.onerror = () => { db.close(); reject(r.error); };
  }));
}
function idbDel(key) {
  return dataIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_IDB_STORE, "readwrite");
    tx.objectStore(DATA_IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

/* ---------- resolving a data/ path against the connected folder ---------- */

/* "data/bestiary/index.json" -> ["bestiary", "index.json"]. Returns null for anything that isn't a
   data/ path, and for anything containing ".." — a loader has no business escaping the folder the
   user pointed at, and the check is cheaper than reasoning about whether one ever could. */
function dataRelPath(url) {
  if (typeof url !== "string") return null;
  const clean = url.split("?")[0].split("#")[0].replace(/^\.\//, "");
  if (!/^data\//.test(clean)) return null;
  const parts = clean.slice(5).split("/").filter(p => p && p !== ".");
  if (!parts.length || parts.some(p => p === "..")) return null;
  return parts;
}

/* Walks the handle tree to a file. Returns null rather than throwing when any segment is missing,
   because "this file isn't in your data/ folder" is the ordinary case for every optional library —
   the loaders are all written to treat a miss as "nothing to load", not as an error. */
async function dataDirFile(parts) {
  if (!DATA_DIR) return null;
  let dir = DATA_DIR;
  try {
    for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    return await fh.getFile();
  } catch (e) { return null; }
}

/* A response-shaped object. Only the four members the loaders actually use are implemented — ok,
   status, json(), text() — so this is honestly not a Response and isn't pretending to be one for
   any other purpose. Anything else reaching for .headers would be a bug worth seeing loudly. */
function dataFileResponse(text) {
  return {
    ok: true, status: 200,
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}
function dataMissResponse() {
  const gone = async () => { throw new Error("not found in the connected data folder"); };
  return { ok: false, status: 404, json: gone, text: gone };
}

/* Resolves once the stored handle has been looked at, so a loader that fires on DOMContentLoaded
   can't race the restore and fetch over the network from under a perfectly good folder. Every
   dataFetch awaits it; it settles in single-digit milliseconds and only ever settles once. */
let DATA_READY = null;
function dataReady() {
  // Swallowed on purpose: a browser that refuses IndexedDB, or a handle that has gone bad, must
  // leave the sheet loading from the network rather than taking every loader down with it.
  return DATA_READY ? DATA_READY.catch(() => {}) : Promise.resolve();
}

/* THE shim. Drop-in for fetch() at every data/ call site.

   Three places a data/ path can be answered from, in descending order of freshness:

     1. A LIVE HANDLE (src/data-folder.js, Chromium only). Re-reads the disk on demand, so editing a
        JSON file shows up on the next reload.
     2. A STORED COPY (src/data-snapshot.js). Firefox's only option, and the fallback in Chrome when
        a handle's permission has lapsed and the user hasn't re-granted it.
     3. THE NETWORK. A local server with a real data/ folder sitting next to the sheet.

   The network outranks the stored copy whenever there IS one, because the server is live and a copy
   is not — somebody running pmcrwf.cmd should never be served a month-old snapshot of files that are
   right there on the disk. */
async function dataFetch(url) {
  await dataReady();
  const parts = dataRelPath(url);
  if (!parts) return fetch(url);
  if (DATA_DIR) {
    const file = await dataDirFile(parts);
    return file ? dataFileResponse(await file.text()) : dataMissResponse();
  }
  if (SNAPSHOT && !DATA_SERVED) {
    const text = await snapshotFileText(parts.join("/"));
    return text == null ? dataMissResponse() : dataFileResponse(text);
  }
  return fetch(url);
}

/* ---------- connecting ---------- */

/* People click the folder they think of as "the data", and that is sometimes data/ itself and
   sometimes the folder that CONTAINS data/ (pmcrwf's own directory, say — which is exactly what the
   file dialog opens on if they navigate there). Both are the right answer to the question they were
   asked, so accept both: if the picked folder looks like a data/ directory, use it; if it holds one,
   descend into it; otherwise use it anyway and let the status line report zero files, which is a
   truthful answer to "I pointed you at my Downloads folder". */
const DATA_DIR_MARKERS = ["spells", "bestiary", "class"];
const DATA_FILE_MARKERS = ["items.json", "items-base.json", "races.json", "feats.json"];
async function resolveDataRoot(handle) {
  for (const d of DATA_DIR_MARKERS) {
    try { await handle.getDirectoryHandle(d); return handle; } catch (e) { /* keep looking */ }
  }
  for (const f of DATA_FILE_MARKERS) {
    try { await handle.getFileHandle(f); return handle; } catch (e) { /* keep looking */ }
  }
  try { return await handle.getDirectoryHandle("data"); } catch (e) { return handle; }
}

async function connectDataFolder() {
  if (!dataFolderSupported()) return false;
  let picked;
  try { picked = await window.showDirectoryPicker({ id: "pmcrwf-data", mode: "read" }); }
  catch (e) { return false; }   // the user cancelled the dialog; not an error
  DATA_DIR = await resolveDataRoot(picked);
  DATA_DIR_STATE = null;
  try { await idbPut(DATA_IDB_KEY, DATA_DIR); }
  catch (e) { console.warn("Connected, but could not remember the data folder for next time", e); }
  renderDataBar();
  await reloadAllLibraries();
  return true;
}

/* The returning visitor's one click: the handle is already stored, only the permission lapsed. */
async function reconnectDataFolder() {
  const stored = await idbGet(DATA_IDB_KEY).catch(() => null);
  if (!stored) { DATA_DIR_STATE = "none"; renderDataBar(); return false; }
  let perm = "denied";
  try { perm = await stored.requestPermission({ mode: "read" }); } catch (e) { /* falls through to denied */ }
  if (perm !== "granted") { DATA_DIR_STATE = "denied"; renderDataBar(); return false; }
  DATA_DIR = stored; DATA_DIR_STATE = null;
  renderDataBar();
  await reloadAllLibraries();
  return true;
}

async function forgetDataFolder() {
  DATA_DIR = null;
  DATA_DIR_STATE = dataFolderSupported() ? "none" : "unsupported";
  await idbDel(DATA_IDB_KEY).catch(() => {});
  renderDataBar();
  // Dropping the live handle can uncover a stored copy underneath it, which dataFetch will now start
  // answering from — so the libraries have to be re-read rather than left holding the handle's data.
  await reloadAllLibraries();
  renderDataBar();
}

/* Reads a folder the user picked through the webkitdirectory input and stores it. The only route
   into a snapshot, and the only one Firefox has at all. */
let DATA_IMPORT = null;        // {done, total, phase} while a folder is being read, else null
let DATA_IMPORT_ERROR = null;  // a one-line explanation to show in the bar, or null
let DATA_LAST_DIFF = null;     // what the most recent re-pick changed, for the bar to report

async function importPickedFolder(fileList) {
  if (!fileList || !fileList.length) return false;
  DATA_IMPORT_ERROR = null; DATA_LAST_DIFF = null;
  DATA_IMPORT = { done: 0, total: fileList.length, phase: "reading" };
  renderDataBar();
  let res;
  try { res = await importFolderFiles(fileList, p => { DATA_IMPORT = p; renderDataBar(); }); }
  catch (e) {
    DATA_IMPORT = null;
    DATA_IMPORT_ERROR = "Could not store that folder: " + ((e && e.message) || e);
    console.error("Data folder import failed", e);
    renderDataBar();
    return false;
  }
  DATA_IMPORT = null;
  if (res.empty) {
    // Almost always someone picking their whole Downloads folder, or the pmcrwf folder on a copy
    // that never had data/ next to it. Say which folder we wanted rather than just failing.
    DATA_IMPORT_ERROR = "No game data in that folder — pick 5e.tools' own data/ directory "
      + "(the one containing spells/ and bestiary/), or the folder that holds it.";
    renderDataBar();
    return false;
  }
  DATA_LAST_DIFF = res.diff;
  await requestPersistentStorage();
  renderDataBar();
  await reloadAllLibraries();
  renderDataBar();
  return true;
}

async function dropSnapshot() {
  await clearSnapshot();
  DATA_LAST_DIFF = null; DATA_IMPORT_ERROR = null;
  renderDataBar();
  await reloadAllLibraries();
  renderDataBar();
}

/* Startup: is there a handle, and may we still read it? Never prompts — a permission dialog with no
   click behind it is exactly the thing browsers forbid, and would be obnoxious even if they didn't. */
async function restoreDataFolder() {
  if (!dataFolderSupported()) { DATA_DIR_STATE = "unsupported"; return; }
  let stored = null;
  try { stored = await idbGet(DATA_IDB_KEY); } catch (e) { stored = null; }
  if (!stored) { DATA_DIR_STATE = "none"; return; }
  let perm = "prompt";
  try { perm = await stored.queryPermission({ mode: "read" }); } catch (e) { perm = "prompt"; }
  if (perm === "granted") { DATA_DIR = stored; DATA_DIR_STATE = null; }
  else DATA_DIR_STATE = perm === "denied" ? "denied" : "needs-permission";
}

/* Is the sheet being served out of a folder that has a real data/ next to it? Deliberately a raw
   fetch and not dataFetch: the question is about the SERVER, and a connected folder would answer it
   wrongly. Three probes because a data/ folder trimmed down to just what someone uses is legitimate
   and shouldn't read as "no data at all". */
const DATA_PROBES = ["data/spells/index.json", "data/items.json", "data/bestiary/index.json"];
async function probeServedData() {
  for (const url of DATA_PROBES) {
    try { const r = await fetch(url, { method: "GET" }); if (r.ok) return true; }
    catch (e) { /* file:// or offline — try the next, then give up */ }
  }
  return false;
}

/* ---------- re-running the loaders ---------- */

/* Empties every imported library. Needed because the loaders MERGE — they are built for "import
   another book on top of what I have", which is right for the per-library file pickers and wrong for
   a folder. Without this, re-picking a folder that no longer contains something leaves it behind:
   pick a folder with Halflings, re-pick one without, and your race list still has Halflings, from a
   file that no longer exists anywhere. A folder is a statement about what your data IS, so switching
   folders has to be able to take things away as well as add them.

   The cost is that anything hand-imported through a library's own file picker goes too. That is the
   right trade — "this folder is the truth" is a rule someone can hold in their head, and "the folder
   plus whatever you happened to import in some earlier session" is not. */
function resetDataLibraries() {
  if (typeof SPELL_LIB !== "undefined") SPELL_LIB = [];
  if (typeof ITEM_LIB !== "undefined") ITEM_LIB = [];
  if (typeof CLASS_LIB !== "undefined") CLASS_LIB = {};
  if (typeof RACE_LIB !== "undefined") RACE_LIB = {};
  if (typeof FEAT_LIB !== "undefined") FEAT_LIB = {};
  if (typeof BACKGROUND_LIB !== "undefined") BACKGROUND_LIB = {};
  if (typeof VARIANT_RULES !== "undefined") VARIANT_RULES = [];
  if (typeof RULES_CONDITIONS !== "undefined") RULES_CONDITIONS = {};
  // The bestiary keeps its own copy and its own memoised load; resetBestiary clears both.
  if (typeof resetBestiary === "function") resetBestiary();
}

/* Connecting a folder mid-session has to reach every library, including the two that don't have a
   visible reload button (conditions text, variant rules) and the one that is lazy (the bestiary,
   which memoises its load and so needs its own reset — see resetBestiary in monster-library.js).
   Kept tolerant of missing functions because the test harnesses load a subset of these files. */
async function reloadAllLibraries() {
  resetDataLibraries();
  const jobs = [];
  if (typeof runSpellAutoLoad === "function") jobs.push(runSpellAutoLoad());
  if (typeof runItemAutoLoad === "function") jobs.push(runItemAutoLoad());
  if (typeof runClassAutoLoad === "function") jobs.push(runClassAutoLoad());
  if (typeof loadRulesRef === "function") jobs.push(loadRulesRef());
  if (typeof autoLoadVariantRules === "function") {
    jobs.push(autoLoadVariantRules().then(() => {
      if (typeof renderHouseRules === "function") renderHouseRules();
    }));
  }
  // The bestiary was re-armed by resetDataLibraries and deliberately stays lazy: the next thing that
  // needs a monster loads it, but someone who never opens the module doesn't pay ~9 MB for it.
  await Promise.allSettled(jobs);
}

/* ---------- the bar ---------- */

function dataBarEl() { return document.getElementById("data-bar"); }

/* Numbers a human can read: 3214 files, 41.2 MB, "3 months". */
function fmtCount(n) { return Number(n).toLocaleString(); }
function fmtBytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)) + " " + u[i];
}
function fmtWhen(ts) {
  try { return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  catch (e) { return "an earlier session"; }
}

/* What a re-pick actually changed. The point of saying it out loud is that a stored copy is the one
   thing in this sheet that can silently be wrong, so the moment we DO know something about it is
   worth spending a sentence on — including, especially, "nothing changed", which tells the user
   their copy was already current and the re-pick was unnecessary. */
function diffLine(d) {
  if (!d) return "";
  if (!d.total) return `<span class="hint">Copy up to date.</span>`;
  const bits = [];
  if (d.changed.length) bits.push(fmtCount(d.changed.length) + " updated");
  if (d.added.length) bits.push(fmtCount(d.added.length) + " added");
  if (d.removed.length) bits.push(fmtCount(d.removed.length) + " removed");
  return `<span class="hint">Since your last copy: ${bits.join(", ")}.</span>`;
}

/* The picker button, worded for what the browser can actually do. Chromium gets the live handle as
   the primary action and the stored copy as the lesser alternative; everywhere else the stored copy
   IS the offer, so it shouldn't be phrased as a consolation prize. */
function connectButtonsHtml() {
  if (dataFolderSupported()) {
    return `<button type="button" id="data-bar-connect">Connect data folder</button>
      <button type="button" id="data-bar-pick" class="data-bar-alt">Store a copy</button>`;
  }
  return `<button type="button" id="data-bar-pick">Choose data folder</button>`;
}

function dataBarHtml() {
  /* Reading a folder means several thousand files off a disk. Anything without a running count here
     looks like a hang, and the user's next move would be to close the tab halfway through. */
  if (DATA_IMPORT) {
    const { done, total } = DATA_IMPORT;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<b>Reading data folder…</b> ${fmtCount(done)} / ${fmtCount(total)} files (${pct}%)`;
  }

  const err = DATA_IMPORT_ERROR
    ? `<div class="data-bar-err">${escapeHtml(DATA_IMPORT_ERROR)}</div>` : "";

  // 1. A live handle. The best case, and the only one that sees disk edits without being asked.
  if (DATA_DIR) {
    return `<span class="data-bar-ok">Data: <b>${escapeHtml(DATA_DIR.name || "your folder")}/</b> (live)</span>
      <button type="button" id="data-bar-reload">Reload</button>
      <button type="button" id="data-bar-forget">Disconnect</button>${err}`;
  }

  // 2. A stored copy that is being kept but NOT used, because this sheet is served next to a real
  //    data/ folder and the server is live where a copy is not (see dataFetch). Saying "game data: a
  //    copy" here would be a lie about where the spells on screen came from.
  if (SNAPSHOT && DATA_SERVED) {
    return `<span class="data-bar-ok">Data: server <code>data/</code>.</span>
      <span class="hint">Stored copy: <b>${escapeHtml(SNAPSHOT.name)}/</b> (not in use).</span>
      <button type="button" id="data-bar-drop">Forget copy</button>${err}`;
  }

  // 3. A stored copy, and it is what the sheet is reading. Everything about it that could be stale is
  //    on screen, because nothing here can check it for you — see the header in src/data-snapshot.js.
  if (SNAPSHOT) {
    const age = snapshotAgeDays();
    const stale = snapshotIsStale()
      ? `<div class="data-bar-stale">Copy is ${Math.round(age / 30)} months old. Re-pick to update.</div>` : "";
    const lapsed = (DATA_DIR_STATE === "needs-permission" || DATA_DIR_STATE === "denied")
      ? ` <button type="button" id="data-bar-connect" class="data-bar-alt">Reconnect live folder</button>` : "";
    return `<span class="data-bar-ok">Stored copy: <b>${escapeHtml(SNAPSHOT.name)}/</b> -
      ${fmtCount(SNAPSHOT.count)} files, ${fmtBytes(SNAPSHOT.bytes)},
      ${fmtWhen(SNAPSHOT.takenAt)}.</span>
      <button type="button" id="data-bar-pick">Re-pick folder</button>
      <button type="button" id="data-bar-drop">Forget copy</button>${lapsed}
      ${diffLine(DATA_LAST_DIFF)}${stale}${err}`;
  }

  // 4. A handle we remember but may no longer read. One click fixes it; no re-picking.
  if (DATA_DIR_STATE === "needs-permission" || DATA_DIR_STATE === "denied") {
    return `<button type="button" id="data-bar-connect">Reconnect data folder</button>${err}`;
  }

  // 5. Nothing yet. Offer the picker supported by this browser.
  return `${connectButtonsHtml()}
    <a href="DOCS.md#connecting-your-data-folder">Setup</a>${err}`;
}

/* One line under the toolbar, and only when it has something to say. The local case — sheet served
   next to its own data/, with nothing connected or stored — renders nothing at all, because telling
   someone their data loaded is not news. */
function renderDataBar() {
  const el = dataBarEl(); if (!el) return;
  if (DATA_SERVED && !DATA_DIR && !SNAPSHOT && !DATA_IMPORT) {
    el.style.display = "none"; el.innerHTML = ""; return;
  }
  el.style.display = "";
  // Red only while there is genuinely nothing to read. A stored copy, a live folder or a server with
  // data/ next to it are all working states and shouldn't be shouting.
  el.classList.toggle("data-bar-warn", !DATA_DIR && !SNAPSHOT && !DATA_SERVED && !DATA_IMPORT);
  el.innerHTML = dataBarHtml();
}

document.addEventListener("DOMContentLoaded", () => {
  const el = dataBarEl(); if (!el) return;
  el.addEventListener("click", e => {
    const id = e.target.id;
    if (id === "data-bar-connect") {
      // A stored handle only needs its permission back; anything else needs the picker.
      (DATA_DIR_STATE === "needs-permission" || DATA_DIR_STATE === "denied")
        ? reconnectDataFolder() : connectDataFolder();
    } else if (id === "data-bar-pick") {
      const input = document.getElementById("data-folder-input");
      // Cleared first so re-picking the SAME folder still fires a change event — which is exactly
      // what someone does after updating their 5e.tools data, i.e. the case this button is for.
      if (input) { input.value = ""; input.click(); }
    }
    else if (id === "data-bar-reload") reloadAllLibraries();
    else if (id === "data-bar-forget") forgetDataFolder();
    else if (id === "data-bar-drop") dropSnapshot();
  });

  const input = document.getElementById("data-folder-input");
  if (input) input.addEventListener("change", e => {
    const files = e.target.files;
    if (files && files.length) importPickedFolder(files);
  });

  // Paint once DATA_READY has settled every question the bar depends on — is a folder connected, is
  // there a stored copy, does the server have data/ — so it never flashes a wrong state on the way
  // to the right one.
  dataReady().then(renderDataBar);
});

/* Started at parse time, not on DOMContentLoaded: the loaders fire on DOMContentLoaded too, and
   dataFetch awaits this, so all three answers have to be in flight before any of them run. */
DATA_READY = Promise.all([
  restoreDataFolder(),
  loadSnapshotMeta(),
  probeServedData().then(v => { DATA_SERVED = v; }),
]);
