/* ============================================================
   SERVICE WORKER — makes the hosted copy work with the network off.

   pmcrwf has always been an offline tool; it just happened to need a local
   server to be one. Hosting it takes that away and hands back a URL, and a
   URL is no good at a table with bad wifi. So the hosted copy precaches its
   own shell and serves itself from disk afterwards.

   WHAT IS CACHED. The app: the HTML, every script and stylesheet it names,
   the themes, the icons. That's it — about a megabyte.

   WHAT IS NOT. Anything under data/. The user's game data is thousands of
   files and can be hundreds of megabytes; it comes from their own disk via
   the folder connection (src/data-folder.js), which reads files directly and
   never goes through the network, so there is nothing here to cache in the
   first place. The one case where a data/ request DOES hit the network is a
   local server that has a real data/ next to it — and that machine already
   has the files. Either way, caching them would be storing a copy of
   somebody's sourcebook data, which is the one thing this project doesn't do.

   WHY THE CACHE IS ALL-OR-NOTHING. This sheet is forty-odd plain scripts
   sharing globals in a fixed load order (DOCS.md, "Why plain scripts"). Half
   of one version and half of another is not a slightly-stale app, it's an
   app where a function is defined twice with different arguments. So each
   build gets its own whole cache, populated completely before it is used and
   swapped in as a unit. A version either exists entirely or not at all.

   WHICH MEANS UPDATES WAIT. A new build installs into a new cache while the
   running page keeps serving from the old one — swapping under a page that
   has already loaded half its scripts is exactly the mixed state above. The
   page is told, shows a "reload" line, and the swap happens when you take
   it (src/offline.js).

   The precache list is READ OUT OF THE HTML rather than written down here.
   A hand-maintained list would go stale the first time someone added a
   script and forgot, and the failure — one missing file, offline only — is
   about as quiet as failures get. tests/hosting.html asserts the extraction
   finds every tag in the real page.
   ============================================================ */

/* Stamped by .github/workflows/pages.yml with the commit being deployed. Left as the literal
   placeholder in the repo, which is correct for local use: a version that never changes is a
   service worker that never updates, and locally you want the server, not the cache — which is why
   src/offline.js doesn't register this at all on localhost. */
const SW_BUILD = "__BUILD__";
const CACHE = "pmcrwf-" + SW_BUILD;

const SHELL_HTML = "character-sheet.html";
/* Files no tag in the HTML mentions: the entry redirect, the manifest, the icons, and the docs the
   data bar links to. Short enough to keep by hand, and none of it is load-order-sensitive. */
const EXTRA = ["./", "index.html", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
  "DOCS.md", "README.md"];

/* Pulls every src="…"/href="…" out of the page. Deliberately a regex and not DOMParser: a service
   worker has no DOM. The page is ours and its tags are plain, so this is a fair trade — and the
   test harness runs this exact function against the real file so a hand-written tag that breaks it
   fails a test rather than an offline load six months later. */
function shellUrlsFromHtml(html) {
  const out = [];
  const re = /(?:src|href)\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1].trim();
    if (!u) continue;                              // <link id="theme-css" href=""> — filled in at runtime
    if (/^[a-z]+:/i.test(u) || u.startsWith("//")) continue;   // off-origin, data:, mailto:
    if (u.startsWith("#")) continue;
    if (u.startsWith("data/")) continue;           // never the user's game data
    out.push(u.replace(/^\.\//, ""));
  }
  return [...new Set(out)];
}

/* The theme files are chosen at runtime from a manifest, so no tag names them. Offline with only
   the theme you happened to be using would be a poor showing — they're a few KB each. */
async function themeUrls() {
  try {
    const res = await fetch("css/themes/index.json", { cache: "reload" });
    if (!res.ok) return [];
    return Object.values(await res.json()).filter(Boolean).map(f => "css/themes/" + f);
  } catch (e) { return []; }
}

async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch(SHELL_HTML, { cache: "reload" });
  if (!res.ok) throw new Error("could not read " + SHELL_HTML + " (" + res.status + ")");
  const html = await res.text();
  const urls = [...new Set([SHELL_HTML, ...shellUrlsFromHtml(html), ...(await themeUrls()), ...EXTRA])];
  await cache.put(SHELL_HTML, new Response(html, { headers: res.headers }));
  /* addAll is all-or-nothing, which is what "a version exists entirely or not at all" asks for.
     A single 404 here fails the install and leaves the previous version serving — the right
     outcome, and a visible one in DevTools rather than a silent hole in the cache. */
  await cache.addAll(urls.filter(u => u !== SHELL_HTML));
  return urls.length;
}

self.addEventListener("install", e => {
  // No skipWaiting: see the header. The page decides when to swap.
  e.waitUntil(precache());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith("pmcrwf-") && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Sent by src/offline.js when the user takes the update. This is the only path to skipWaiting, so
   the swap can only ever happen because somebody clicked it. */
self.addEventListener("message", e => {
  if (e.data && e.data.type === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nothing off-origin is ours to serve

  if (/(^|\/)data\//.test(url.pathname)) return;     // the user's game data is never cached — see header

  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(req); }
    catch (err) {
      /* Offline and not in the cache. For a navigation that means a deep link or a stale bookmark;
         hand back the shell, which is the whole app anyway. For anything else, be honest. */
      if (req.mode === "navigate") {
        const shell = await caches.match(SHELL_HTML);
        if (shell) return shell;
      }
      return new Response("offline and not cached: " + url.pathname, { status: 504, statusText: "Offline" });
    }
  })());
});
