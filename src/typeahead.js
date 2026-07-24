/* ============================================================
   TYPEAHEAD — generic search-as-you-type dropdown for a text input.
   Used by the Race/Subrace/Class/Subclass fields to suggest names
   from CLASS_LIB/RACE_LIB (see class-library.js) as the user types.
   Matching is substring (not just prefix), so "wi" finds "Wizard".
   ============================================================ */
function attachTypeahead(input, getOptions) {
  const wrap = document.createElement("span");
  wrap.className = "typeahead-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const list = document.createElement("div");
  list.className = "typeahead-list";
  wrap.appendChild(list);

  let items = [], activeIdx = -1;

  function close() { list.style.display = "none"; list.innerHTML = ""; items = []; activeIdx = -1; }
  function highlight(idx) {
    [...list.children].forEach((c, i) => c.classList.toggle("active", i === idx));
    activeIdx = idx;
    if (idx >= 0) list.children[idx].scrollIntoView({ block: "nearest" });
  }
  function open(matches) {
    items = matches; activeIdx = -1;
    if (!matches.length) { close(); return; }
    list.innerHTML = matches.map((m, i) => `<div class="typeahead-item" data-idx="${i}">${escapeHtml(m)}</div>`).join("");
    list.style.display = "block";
  }
  function select(val) {
    input.value = val;
    close();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function refresh() {
    const q = input.value.trim().toLowerCase();
    if (!q) { close(); return; }
    const all = getOptions() || [];
    const matches = all.filter(o => o.toLowerCase().includes(q))
      .sort((a, b) => {
        const aP = a.toLowerCase().startsWith(q) ? 0 : 1, bP = b.toLowerCase().startsWith(q) ? 0 : 1;
        return aP - bP || a.localeCompare(b);
      })
      .slice(0, 20);
    open(matches);
  }
  input.addEventListener("input", refresh);
  input.addEventListener("focus", refresh);
  input.addEventListener("keydown", e => {
    if (list.style.display !== "block") return;
    if (e.key === "ArrowDown") { e.preventDefault(); highlight(Math.min(activeIdx + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); highlight(Math.max(activeIdx - 1, 0)); }
    else if (e.key === "Enter") { if (activeIdx >= 0) { e.preventDefault(); select(items[activeIdx]); } else close(); }
    else if (e.key === "Escape") { close(); }
  });
  list.addEventListener("mousedown", e => {
    const it = e.target.closest(".typeahead-item");
    if (it) { e.preventDefault(); select(items[Number(it.dataset.idx)]); }
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}
