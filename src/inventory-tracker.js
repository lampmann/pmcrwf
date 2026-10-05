/* A character-owned transaction ledger, independent of equipment and coin fields. */
function trackerAmount(amount) {
  return (amount > 0 ? "+" : "") + amount.toLocaleString(undefined, { maximumFractionDigits: 10 });
}
function paintTrackerBalance() {
  const balance = $("tracker-balance");
  const total = INVENTORY_TRANSACTIONS.reduce((sum, entry) => sum + entry.amount, 0);
  if (balance) balance.textContent = trackerAmount(total);
  const gold = $("coin-gp");
  if (gold) gold.value = String(total);
  if (typeof recomputeInventory === "function") recomputeInventory();
}
function renderInventoryTracker() {
  const rows = $("tracker-rows"); if (!rows) return;
  rows.innerHTML = INVENTORY_TRANSACTIONS.map((entry, index) => `<tr data-index="${index}">
    <td><input type="text" inputmode="decimal" class="tracker-amount${entry.amount < 0 ? " spent" : ""}" data-field="amount" aria-label="Gained or spent, entry ${index + 1}" value="${trackerAmount(entry.amount)}"></td>
    <td><input type="text" data-field="source" aria-label="Source or item, entry ${index + 1}" value="${escapeHtml(entry.source)}"></td>
    <td><input type="text" data-field="date" aria-label="Date, entry ${index + 1}" placeholder="Date or label" value="${escapeHtml(entry.date)}"></td>
    <td><button type="button" data-tracker-remove="${index}" aria-label="Remove entry ${index + 1}">×</button></td>
  </tr>`).join("");
  paintTrackerBalance();
}
document.addEventListener("DOMContentLoaded", () => {
  $("tracker-add").addEventListener("click", () => {
    INVENTORY_TRANSACTIONS.push({ amount: 0, source: "", date: "" });
    renderInventoryTracker(); scheduleSave();
    const input = $("tracker-rows").lastElementChild.querySelector("input");
    input.focus(); input.select();
  });
  $("tracker-rows").addEventListener("input", event => {
    const input = event.target.closest("[data-field]"); if (!input) return;
    const entry = INVENTORY_TRANSACTIONS[Number(input.closest("tr").dataset.index)];
    if (input.dataset.field === "amount") {
      const text = input.value.replace(/,/g, "").trim();
      const amount = Number(text);
      if (!text || !Number.isFinite(amount)) { input.setCustomValidity("Enter a signed amount, such as +180,000 or -2,000."); input.setAttribute("aria-invalid", "true"); return; }
      input.setCustomValidity(""); input.removeAttribute("aria-invalid");
      entry.amount = amount;
      input.classList.toggle("spent", amount < 0);
      paintTrackerBalance();
    } else entry[input.dataset.field] = input.value;
    scheduleSave();
  });
  $("tracker-rows").addEventListener("focusout", event => {
    const input = event.target.closest('[data-field="amount"]');
    if (input && input.checkValidity()) input.value = trackerAmount(INVENTORY_TRANSACTIONS[Number(input.closest("tr").dataset.index)].amount);
  });
  $("tracker-rows").addEventListener("click", event => {
    const remove = event.target.closest("[data-tracker-remove]"); if (!remove) return;
    INVENTORY_TRANSACTIONS.splice(Number(remove.dataset.trackerRemove), 1);
    renderInventoryTracker(); scheduleSave();
  });
  renderInventoryTracker();
});

function recordItemPurchase(name, quantity, unitPrice) {
  if (unitPrice === "" || unitPrice == null || !Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0) return false;
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  INVENTORY_TRANSACTIONS.push({ amount: -Math.round(quantity * Number(unitPrice) * 100) / 100,
    source: "Purchase: " + (quantity === 1 ? "" : quantity + " × ") + name, date });
  renderInventoryTracker(); scheduleSave();
  return true;
}
