"use strict";

/* ---------- Visible error surface (so runtime errors are never silent) ---------- */
window.addEventListener("error", e => {
  let b = document.getElementById("errbar");
  if (!b) { b = document.createElement("div"); b.id = "errbar"; b.style.cssText = "background:#c00;color:#fff;padding:.5rem;font-family:monospace;white-space:pre-wrap;font-size:.8rem"; document.body.insertBefore(b, document.body.firstChild); }
  b.textContent = "JS ERROR (please send this to Claude): " + (e.message || e.error) + "  @ line " + (e.lineno || "?");
});
