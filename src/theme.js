/* ---------- Theme picker ---------- */
const THEME_KEY = "charsheet-theme";

function applyTheme(file) { $("theme-css").href = file ? "css/themes/" + file : ""; }

function initTheme() {
  fetch("css/themes/index.json")
    .then(res => res.json())
    .then(manifest => {
      const sel = $("theme-select");
      Object.keys(manifest).forEach(name => {
        const opt = document.createElement("option");
        opt.value = manifest[name]; opt.textContent = name;
        sel.appendChild(opt);
      });
      const saved = localStorage.getItem(THEME_KEY) || "";
      sel.value = saved;
      if (sel.value !== saved) sel.value = ""; // saved theme no longer in manifest
      applyTheme(sel.value);
      sel.addEventListener("change", () => {
        localStorage.setItem(THEME_KEY, sel.value);
        applyTheme(sel.value);
      });
    })
    .catch(err => console.warn("Theme manifest failed to load; theme picker disabled.", err));
}
document.addEventListener("DOMContentLoaded", initTheme);
