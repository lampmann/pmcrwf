/* Theme labels and files come from the manifest, shared with the offline cache. */
const THEME_KEY = "charsheet-theme";

function applyTheme(file) {
  const link = $("theme-css");
  if (!file) { link.disabled = true; link.removeAttribute("href"); return; }
  link.href = "css/themes/" + file;
  link.disabled = false;
}

async function initTheme() {
  const sel = $("theme-select");
  sel.replaceChildren(new Option("Default", ""));
  sel.onchange = () => {
    applyTheme(sel.value);
    try { localStorage.setItem(THEME_KEY, sel.value); }
    catch (err) { console.warn("Could not remember theme", err); }
  };
  applyTheme("");
  try {
    const res = await fetch("css/themes/index.json");
    if (!res.ok) throw new Error("Theme manifest: " + res.status);
    const manifest = await res.json();
    Object.entries(manifest).forEach(([name, file]) => {
      if (typeof file === "string" && file) sel.add(new Option(name, file));
    });
    let saved = "";
    try { saved = localStorage.getItem(THEME_KEY) || ""; }
    catch (err) { /* Themes still work when browser storage is unavailable. */ }
    sel.value = saved;
    if (sel.selectedIndex < 0) {
      sel.value = "";
      try { localStorage.removeItem(THEME_KEY); } catch (err) { /* optional preference */ }
    }
    applyTheme(sel.value);
  } catch (err) { console.warn("Theme manifest unavailable; using Default.", err); }
}
document.addEventListener("DOMContentLoaded", initTheme);
