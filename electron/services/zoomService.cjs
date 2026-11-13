const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const normalizeZoom = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value * 100) / 100)) : 1;

/** Runs before renderer shortcuts, so chats, terminals and editors share the same controls. */
function zoomAction(input) {
  if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return null;
  if (['+', '=', 'Add'].includes(input.key) || input.code === 'NumpadAdd') return 'in';
  if (['-', 'Subtract'].includes(input.key) || input.code === 'NumpadSubtract' || (input.code === 'Minus' && !input.shift)) return 'out';
  if (input.key === '0' || (!input.shift && ['Digit0', 'Numpad0'].includes(input.code))) return 'reset';
  return null;
}

function createZoomService({ getSavedFactor = () => 1, saveFactor = () => {} } = {}) {
  const windows = new WeakMap();
  function get(contents) { return windows.get(contents)?.factor ?? normalizeZoom(getSavedFactor()); }
  function change(contents, action) {
    const state = windows.get(contents);
    if (!state || !['in', 'out', 'reset'].includes(action)) return get(contents);
    const next = action === 'reset' ? 1 : normalizeZoom(state.factor + (action === 'in' ? 0.1 : -0.1));
    if (next === state.factor) return state.factor;
    state.factor = next;
    state.dirty = true;
    contents.setZoomFactor(next);
    if (!contents.isDestroyed()) contents.send('window:zoomChanged', next);
    clearTimeout(state.timer);
    state.timer = setTimeout(state.flush, 250);
    return next;
  }
  function attach(contents) {
    const state = { factor: normalizeZoom(getSavedFactor()), timer: null, dirty: false };
    const flush = () => {
      clearTimeout(state.timer);
      if (state.dirty) { state.dirty = false; saveFactor(state.factor); }
    };
    state.flush = flush;
    windows.set(contents, state);
    contents.setZoomFactor(state.factor);
    contents.on('did-finish-load', () => {
      contents.setZoomFactor(state.factor);
      contents.send('window:zoomChanged', state.factor);
    });
    contents.on('before-input-event', (event, input) => {
      const action = zoomAction(input);
      if (!action) return;
      event.preventDefault();
      change(contents, action);
    });
    contents.once('destroyed', flush);
  }
  return { attach, change, get };
}

module.exports = { createZoomService, zoomAction, normalizeZoom, MIN_ZOOM, MAX_ZOOM };
