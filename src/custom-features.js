/* Character-owned notes for homebrew abilities and other custom features. */
let customFeatureEditing = null;
function renderCustomFeatures() {
  const list = $("custom-feature-list");
  if (!list) return;
  const open = new Set([...list.querySelectorAll("details[open]")].map(el => Number(el.dataset.index)));
  list.innerHTML = CUSTOM_FEATURES.map((feature, index) => `<details data-index="${index}"${open.has(index) ? " open" : ""}>
    <summary>${escapeHtml(feature.name)}</summary>
    <div class="custom-feature-text">${escapeHtml(normalizeDisplayPunctuation(feature.description))}</div>
    <button type="button" data-custom-edit="${index}">Edit</button>
    <button type="button" data-custom-remove="${index}">Remove</button>
  </details>`).join("");
}
function closeCustomFeatureEditor() {
  customFeatureEditing = null;
  const editor = $("custom-feature-editor");
  if (editor) { editor.hidden = true; editor.reset(); }
}
function openCustomFeatureEditor(index = null) {
  customFeatureEditing = index;
  const feature = index === null ? null : CUSTOM_FEATURES[index];
  $("custom-feature-name").value = feature?.name || "";
  $("custom-feature-description").value = feature?.description || "";
  $("custom-feature-editor").hidden = false;
  $("custom-feature-name").focus();
}
document.addEventListener("DOMContentLoaded", () => {
  $("custom-feature-add").addEventListener("click", () => openCustomFeatureEditor());
  $("custom-feature-cancel").addEventListener("click", closeCustomFeatureEditor);
  $("custom-feature-list").addEventListener("click", event => {
    const edit = event.target.closest("[data-custom-edit]");
    if (edit) { openCustomFeatureEditor(Number(edit.dataset.customEdit)); return; }
    const remove = event.target.closest("[data-custom-remove]");
    if (remove) {
      CUSTOM_FEATURES.splice(Number(remove.dataset.customRemove), 1);
      closeCustomFeatureEditor(); renderCustomFeatures(); scheduleSave();
    }
  });
  $("custom-feature-editor").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("custom-feature-name").value.trim();
    if (!name) { $("custom-feature-name").focus(); return; }
    const feature = { name, description: $("custom-feature-description").value };
    const index = customFeatureEditing === null ? CUSTOM_FEATURES.length : customFeatureEditing;
    CUSTOM_FEATURES[index] = feature;
    closeCustomFeatureEditor(); renderCustomFeatures(); scheduleSave();
    const details = $("custom-feature-list").children[index];
    if (details) details.open = true;
  });
});
