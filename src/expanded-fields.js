/* Temporarily enlarge the original control, retaining its normal events and persistence. */
let expandedTextField = null;
function restoreExpandedTextField() {
  const state = expandedTextField; if (!state) return;
  state.element.style.cssText = state.style;
  state.element.classList.remove('editing-expanded');
  state.placeholder.remove();
  expandedTextField = null;
}
function sizeExpandedTextField() {
  const state = expandedTextField; if (!state) return;
  const element = state.element;
  if (!element.isConnected) { restoreExpandedTextField(); return; }
  const computed = getComputedStyle(element), canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  context.font = computed.font;
  const padding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight) + parseFloat(computed.borderLeftWidth) + parseFloat(computed.borderRightWidth) + 12;
  const text = element.value || element.placeholder || '';
  const longest = Math.max(...text.split('\n').map(line => context.measureText(line).width), 0);
  const availableWidth = Math.max(1, window.innerWidth - 16);
  const width = Math.min(availableWidth, Math.max(state.rect.width, longest + padding));
  const left = Math.max(8, Math.min(state.rect.left, window.innerWidth - width - 8));
  element.style.width = width + 'px'; element.style.left = left + 'px';
  let height = state.rect.height;
  if (element.tagName === 'TEXTAREA') {
    element.style.height = 'auto';
    height = Math.max(height, element.scrollHeight + parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth));
  }
  height = Math.min(height, Math.max(1, window.innerHeight - 16));
  element.style.height = height + 'px';
  element.style.top = Math.max(8, Math.min(state.rect.top, window.innerHeight - height - 8)) + 'px';
}
document.addEventListener('focusin', event => {
  const element = event.target;
  if (!element.matches?.('input[type="text"], input[type="search"], input:not([type]), textarea') || element.readOnly || element.disabled) return;
  if (expandedTextField?.element === element) return;
  restoreExpandedTextField();
  const rect = element.getBoundingClientRect(), placeholder = document.createElement('span');
  placeholder.style.cssText = `display:${getComputedStyle(element).display === 'block' ? 'block' : 'inline-block'};width:${rect.width}px;height:${rect.height}px;vertical-align:middle`;
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.dataset.editingPlaceholder = ''; 
  element.before(placeholder);
  expandedTextField = { element, rect, placeholder, style: element.style.cssText };
  element.classList.add('editing-expanded');
  sizeExpandedTextField();
});
document.addEventListener('focusout', event => {
  if (event.target === expandedTextField?.element) restoreExpandedTextField();
});
document.addEventListener('input', event => {
  if (event.target === expandedTextField?.element) sizeExpandedTextField();
});
function repositionExpandedTextField(event) {
  const state = expandedTextField;
  if (!state || event.target === state.element) return;
  if (document.activeElement !== state.element) { restoreExpandedTextField(); return; }
  const anchor = state.placeholder.getBoundingClientRect();
  state.rect = { ...state.rect, left: anchor.left, top: anchor.top, width: state.rect.width, height: state.rect.height };
  sizeExpandedTextField();
}
window.addEventListener('resize', repositionExpandedTextField);
window.addEventListener('scroll', repositionExpandedTextField, true);
