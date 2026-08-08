/* ============================================================
   TYPEAHEAD — generic search-as-you-type dropdown for a text input.
   Used by the Race/Subrace/Class/Subclass fields (and the ASI feat
   picker) to suggest names from a lookup library as the user types.
   Matching is substring (not just prefix), so "wi" finds "Wizard".
   The dropdown is position:fixed and only attached to <body> while
   open (removed on close) so it can escape a scrollable ancestor
   (e.g. the Features panel) without leaking DOM nodes as rows/panels
   get rebuilt.
   ============================================================ */
/* `banInfo` is optional and, when given, is a function returning { kind, prefix } for house-rule ban
   marking (src/house-rules.js). A function rather than a static value because a subclass picker's
   prefix depends on whatever class is currently typed in the same row, which changes under it. */
function attachTypeahead(input, getOptions, banInfo) {
  const list = document.createElement("div");
  list.className = "typeahead-list";
  let items = [], activeIdx = -1, isOpen = false;

  function position() {
    const r = input.getBoundingClientRect();
    list.style.left = r.left + "px";
    list.style.top = r.bottom + "px";
    list.style.minWidth = r.width + "px";
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    list.remove(); list.innerHTML = ""; items = []; activeIdx = -1;
  }
  function highlight(idx) {
    [...list.children].forEach((c, i) => c.classList.toggle("active", i === idx));
    activeIdx = idx;
    if (idx >= 0) list.children[idx].scrollIntoView({ block: "nearest" });
  }
  function open(matches) {
    items = matches; activeIdx = -1;
    if (!matches.length) { close(); return; }
    // Banned options stay listed and stay pickable, coloured red — see house-rules.js for why
    // marking beats removing.
    const ban = banInfo ? banInfo() : null;
    list.innerHTML = matches.map((m, i) => {
      const bad = ban && typeof isBannedOption === "function" && isBannedOption(ban.kind, m, ban.prefix);
      return `<div class="typeahead-item${bad ? " banned-opt" : ""}" data-idx="${i}"${bad ? ` title="banned by house rule"` : ""}>` +
        `${escapeHtml(m)}${bad ? ` <span class="banned-flag">banned</span>` : ""}</div>`;
    }).join("");
    document.body.appendChild(list);
    position();
    isOpen = true;
  }
  function select(val) {
    input.value = val;
    close();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function refresh() {
    const q = input.value.trim().toLowerCase();
    const all = getOptions() || [];
    if (!q) { open(all.slice().sort((a, b) => a.localeCompare(b)).slice(0, 20)); return; }
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
    if (!isOpen) return;
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
