/* ============================================================
   DATA SNAPSHOT — the data/ folder, copied into this browser once.

   src/data-folder.js connects a LIVE folder: the sheet holds a directory
   handle and reads files off the disk as it needs them. That is the better
   mechanism and it is Chromium-only. Firefox has never implemented
   showDirectoryPicker and shows no sign of doing so; its only filesystem API
   is OPFS, which is a private sandbox the browser owns and cannot see a word
   of your data/ folder.

   What Firefox DOES have is <input type="file" webkitdirectory> — one dialog,
   a whole directory tree, every File tagged with webkitRelativePath. That
   solves picking. It does not solve remembering: the FileList dies with the
   page, and there is no handle to store.

   So this file separates the two problems, because they are separate. You
   don't need a live handle; you need the BYTES. Pick the folder once, copy
   the files this sheet actually reads into IndexedDB, and answer data/ paths
   out of that from then on. dataFetch consults it exactly where it would
   otherwise consult a directory handle, so every loader is unchanged and
   Firefox and Chrome differ only in where the bytes came from.

   IT IS A COPY, AND THAT IS THE WHOLE TRADE. A live handle re-reads the disk,
   so editing a JSON file shows up on the next reload. A snapshot doesn't
   know the disk exists any more. We cannot detect that — no handle, no
   filesystem, nothing to poll — so the honest design is to make the staleness
   VISIBLE rather than pretend to catch it: the bar always names the date and
   file count of the copy it is serving, says so out loud once the copy is old,
   and re-picking reports exactly what changed.

   WHY NOT EVERY FILE. 5e.tools' data/ is enormous — adventures, books,
   generated indexes, artwork manifests — and this sheet reads a small corner
   of it. wantedDataPath keeps that corner. The predicate is deliberately a
   little wider than today's loaders (any .json at the top level, not just the
   seven currently named) so adding a loader doesn't silently ship a snapshot
   with a hole in it; tests/hosting.html scans the source for data/ literals
   and fails if one of them wouldn't be stored.

   WHY GZIP. Even that corner is tens of megabytes of JSON, and JSON is mostly
   air — CompressionStream gets it down by roughly 8x for the cost of a few
   milliseconds per file on the way back out. Where CompressionStream is
   missing the text is stored as-is; the reader handles both, so a browser
   without it is slower to fill and bigger on disk, not broken.
   ============================================================ */

const SNAP_DB = "pmcrwf-data-snapshot";
const SNAP_FILES = "files";      // key: "spells/index.json"  ->  { z: Blob } or { t: string }
const SNAP_META = "meta";        // key: "current"            ->  the manifest below
const SNAP_KEY = "current";
const SNAP_SCHEMA = 1;           // bump to invalidate every stored copy
const SNAP_WRITE_BATCH = 64;     // files per transaction — see importFolderFiles
const SNAP_STALE_DAYS = 90;      // after this the bar says the copy is old

/* The manifest for the copy currently stored, or null. Small enough to keep in memory: it carries a
   [size, hash] pair per file, which is what makes a re-pick able to say what actually changed. */
let SNAPSHOT = null;

/* ---------- the database ---------- */
function snapIdb() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(SNAP_DB, 1); }
    catch (e) { return reject(e); }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAP_FILES)) db.createObjectStore(SNAP_FILES);
      if (!db.objectStoreNames.contains(SNAP_META)) db.createObjectStore(SNAP_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function snapTx(store, mode, fn) {
  return snapIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(out && out.result !== undefined ? out.result : out); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("snapshot transaction aborted")); };
  }));
}

/* ---------- which files are worth keeping ---------- */

/* Directories this sheet reads wholesale. Everything else in 5e.tools' data/ — adventure/, book/,
   generated/, the art manifests — is content we never touch and would only be taking up the user's
   disk to ignore. */
const SNAP_DIRS = ["spells/", "bestiary/", "class/"];

/* `rel` is relative to the data/ root: "spells/index.json", "races.json". */
function wantedDataPath(rel) {
  if (typeof rel !== "string" || !rel || rel.includes("..")) return false;
  if (!/\.json$/i.test(rel)) return false;              // the loaders only ever read JSON
  if (SNAP_DIRS.some(d => rel.startsWith(d))) return true;
  return !rel.includes("/");                            // any .json sitting directly in data/
}

/* webkitRelativePath is always "<the folder they picked>/…". Strip that first segment, then strip a
   leading "data/" if it's there — people reach for the folder they think of as "the data", and that
   is sometimes data/ itself and sometimes the folder holding it. Both are the right answer to the
   question the dialog asked, so both work (resolveDataRoot in data-folder.js is forgiving the same
   way for the live-handle path). */
function relFromPickedPath(webkitRelativePath) {
  const parts = String(webkitRelativePath || "").split("/").filter(Boolean);
  if (parts.length < 2) return null;                    // a loose file, not something inside a folder
  parts.shift();                                        // the picked folder's own name
  if (parts.length > 1 && parts[0] === "data") parts.shift();
  return parts.length ? parts.join("/") : null;
}

/* ---------- telling files apart ---------- */

/* FNV-1a over the file's text. The obvious cheap signal — size and mtime — turns out to be worthless
   here: copying a folder, syncing it, or re-downloading 5e.tools' zip resets every mtime, so a
   re-pick would report "3,214 files updated" every single time and the one sentence that is supposed
   to tell you something real would become noise you learn to ignore. Content is the only signal that
   answers the question actually being asked. Not a cryptographic hash — nobody is attacking this, and
   a 32-bit collision would under-report one file, not corrupt anything — and the bytes are already in
   hand on the way to being compressed, so it costs one pass over a string we've already read. */
function snapHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

/* ---------- storing text ---------- */
async function snapPack(text) {
  if (typeof CompressionStream !== "function") return { t: text };
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return { z: await new Response(stream).blob() };
  } catch (e) { return { t: text }; }                   // never fail an import over compression
}
async function snapUnpack(rec) {
  if (!rec) return null;
  if (typeof rec.t === "string") return rec.t;
  if (!rec.z) return null;
  const stream = rec.z.stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

/* ---------- reading ---------- */

/* The one function dataFetch needs. Returns the file's text, or null for "not in the copy" — the
   same shape of answer a missing file gives on the live-handle path, so the loaders can't tell. */
async function snapshotFileText(rel) {
  if (!SNAPSHOT || !SNAPSHOT.paths[rel]) return null;   // manifest lookup first: no IDB hit on a miss
  try {
    const rec = await snapTx(SNAP_FILES, "readonly", s => s.get(rel));
    return await snapUnpack(rec);
  } catch (e) {
    console.warn("Could not read " + rel + " from the stored data copy", e);
    return null;
  }
}

async function loadSnapshotMeta() {
  try {
    const m = await snapTx(SNAP_META, "readonly", s => s.get(SNAP_KEY));
    SNAPSHOT = (m && m.v === SNAP_SCHEMA && m.paths) ? m : null;
    if (m && !SNAPSHOT) await clearSnapshot();          // written by an older schema — start clean
  } catch (e) { SNAPSHOT = null; }
  return SNAPSHOT;
}

function snapshotAgeDays() {
  if (!SNAPSHOT || !SNAPSHOT.takenAt) return null;
  return Math.floor((Date.now() - SNAPSHOT.takenAt) / 86400000);
}
function snapshotIsStale() {
  const d = snapshotAgeDays();
  return d != null && d >= SNAP_STALE_DAYS;
}

/* ---------- writing ---------- */

async function clearSnapshot() {
  try {
    await snapTx(SNAP_FILES, "readwrite", s => s.clear());
    await snapTx(SNAP_META, "readwrite", s => s.delete(SNAP_KEY));
  } catch (e) { console.warn("Could not clear the stored data copy", e); }
  SNAPSHOT = null;
}

/* What changed since the copy we already had. Compares [size, hash], never timestamps — see snapHash
   for why. Pure, so it can be tested without a database and so a re-pick can work out what it is
   about to change before it changes it. */
function diffSnapshotPaths(before, after) {
  const added = [], changed = [], removed = [];
  const b = before || {}, a = after || {};
  for (const rel in a) {
    if (!(rel in b)) added.push(rel);
    else if (b[rel][0] !== a[rel][0] || b[rel][1] !== a[rel][1]) changed.push(rel);
  }
  for (const rel in b) if (!(rel in a)) removed.push(rel);
  return { added, changed, removed,
           total: added.length + changed.length + removed.length };
}

/* Reads a picked folder into the database. `files` is the FileList from a webkitdirectory input.
   onProgress({done, total, phase}) is called as it goes — this reads thousands of files off a disk
   and must never look like a hang.

   Returns { stored, skipped, bytes, diff } — diff against whatever copy was there before, which is
   what makes a re-pick able to say "412 files changed" instead of "done". */
async function importFolderFiles(files, onProgress) {
  const report = onProgress || (() => {});
  const wanted = [];
  for (const f of files) {
    const rel = relFromPickedPath(f.webkitRelativePath);
    if (rel && wantedDataPath(rel)) wanted.push({ rel, file: f });
  }
  const total = wanted.length;
  const skipped = files.length - total;
  if (!total) return { stored: 0, skipped, bytes: 0, diff: null, empty: true };

  const before = SNAPSHOT ? SNAPSHOT.paths : null;
  const paths = {};
  let bytes = 0, done = 0;

  /* A fresh copy replaces the old one wholesale rather than merging: a merge would leave files from
     a previous folder behind, and "some of book A, some of book B" is a library nobody asked for
     and nobody could reason about. */
  await snapTx(SNAP_FILES, "readwrite", s => s.clear());

  for (let i = 0; i < total; i += SNAP_WRITE_BATCH) {
    const slice = wanted.slice(i, i + SNAP_WRITE_BATCH);
    // Read and compress OUTSIDE the transaction: an IndexedDB transaction auto-commits the moment it
    // goes idle, and awaiting a file read inside one is exactly how it goes idle.
    const packed = await Promise.all(slice.map(async w => {
      const text = await w.file.text();
      return { rel: w.rel, rec: await snapPack(text), size: w.file.size, hash: snapHash(text) };
    }));
    await snapTx(SNAP_FILES, "readwrite", store => { packed.forEach(p => store.put(p.rec, p.rel)); });
    packed.forEach(p => { paths[p.rel] = [p.size, p.hash]; bytes += p.size; });
    done += slice.length;
    report({ done, total, phase: "storing" });
  }

  const meta = {
    v: SNAP_SCHEMA, takenAt: Date.now(),
    name: folderNameOf(files) || "data",
    count: total, bytes, paths,
  };
  await snapTx(SNAP_META, "readwrite", s => s.put(meta, SNAP_KEY));
  SNAPSHOT = meta;
  // No diff on a first pick: there is nothing to have changed, and "8 added" reads as though
  // something happened. A diff is only meaningful against a copy that existed.
  return { stored: total, skipped, bytes, empty: false,
           diff: before ? diffSnapshotPaths(before, paths) : null };
}

/* The name of the folder the user actually picked, for the bar to echo back at them. */
function folderNameOf(files) {
  for (const f of files) {
    const first = String(f.webkitRelativePath || "").split("/")[0];
    if (first) return first;
  }
  return "";
}

/* Ask the browser not to evict this. A data copy that vanishes under storage pressure is worse than
   no copy at all — it would fail silently, mid-session, looking like the sheet had lost its library.
   Best-effort by design: Firefox may prompt, Chrome decides on its own, and a "no" is survivable. */
async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) { /* not fatal — the copy still works, it is just evictable */ }
  return false;
}
