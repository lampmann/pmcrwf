"use strict";

/* ---------- Visible error surface (so runtime errors are never silent) ---------- */
function showErrBar(text) {
  let b = document.getElementById("errbar");
  if (!b) { b = document.createElement("div"); b.id = "errbar"; b.style.cssText = "background:#c00;color:#fff;padding:.5rem;font-family:monospace;white-space:pre-wrap;font-size:.8rem"; document.body.insertBefore(b, document.body.firstChild); }
  b.textContent = text;
}
window.addEventListener("error", e => {
  showErrBar("JS ERROR (please send this to Claude): " + (e.message || e.error) + "  @ line " + (e.lineno || "?"));
});
/* A rejected promise never fires "error", so without this every failure inside the data/ auto-loaders
   and the theme manifest fetch — all of which are promise chains — was invisible on the page. */
window.addEventListener("unhandledrejection", e => {
  const r = e.reason;
  showErrBar("JS ERROR (unhandled promise, please send this to Claude): " + ((r && (r.stack || r.message)) || r));
});
