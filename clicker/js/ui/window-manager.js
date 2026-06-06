// Lightweight UI window scheduler for Nitro Clicker.
// Goal: keep panels mounted and refresh only the windows that changed.
// Current app.js still owns most rendering; this manager is a transition layer
// used by newer modules and future panel extraction.

const windows = new Map();
const dirty = new Set();
let scheduled = false;
let mounted = false;

export function registerWindow(name, api) {
  if (!name || !api) return;
  windows.set(name, {
    name,
    mounted: false,
    mount: typeof api.mount === 'function' ? api.mount : null,
    update: typeof api.update === 'function' ? api.update : null,
    destroy: typeof api.destroy === 'function' ? api.destroy : null,
  });
  markWindowDirty(name);
}

export function unregisterWindow(name) {
  const win = windows.get(name);
  if (win?.destroy) {
    try { win.destroy(); } catch (error) { console.warn('[NitroWindowManager] destroy failed', name, error); }
  }
  windows.delete(name);
  dirty.delete(name);
}

export function markWindowDirty(name) {
  if (name) dirty.add(name);
  scheduleFlush();
}

export function markWindowsDirty(names = []) {
  names.forEach(name => dirty.add(name));
  scheduleFlush();
}

export function markAllDirty() {
  for (const name of windows.keys()) dirty.add(name);
  scheduleFlush();
}

export function flushWindows(reason = 'scheduled') {
  scheduled = false;
  const context = getContext(reason);
  const names = dirty.size ? [...dirty] : [...windows.keys()];
  dirty.clear();

  for (const name of names) {
    const win = windows.get(name);
    if (!win) continue;
    try {
      if (!win.mounted && win.mount) {
        win.mount(context);
        win.mounted = true;
      }
      win.update?.(context);
    } catch (error) {
      console.warn('[NitroWindowManager] update failed', name, error);
    }
  }
}

export function emitUiEvent(type, detail = {}) {
  window.dispatchEvent(new CustomEvent(`nitro:${type}`, { detail }));
  if (Array.isArray(detail.windows)) markWindowsDirty(detail.windows);
  else markAllDirty();
}

function scheduleFlush() {
  if (scheduled) return;
  scheduled = true;
  const run = () => flushWindows();
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 250 });
  else requestAnimationFrame(run);
}

function getContext(reason) {
  return {
    reason,
    app: document.getElementById('app'),
    shell: document.querySelector('.clicker-shell'),
    corePanel: document.getElementById('core-panel'),
    upgradeList: document.getElementById('upgrade-list'),
    milestoneList: document.getElementById('milestone-list'),
    metaPanel: document.querySelector('.meta-panel'),
    now: performance.now(),
  };
}

function mountGlobalHooks() {
  if (mounted) return;
  mounted = true;
  window.NitroWindows = {
    register: registerWindow,
    unregister: unregisterWindow,
    dirty: markWindowDirty,
    dirtyMany: markWindowsDirty,
    dirtyAll: markAllDirty,
    flush: flushWindows,
    emit: emitUiEvent,
    list: () => [...windows.keys()],
  };

  window.addEventListener('nitro:energy-changed', () => markWindowsDirty(['stats', 'upgrades', 'core']));
  window.addEventListener('nitro:upgrade-bought', () => markWindowsDirty(['stats', 'upgrades', 'core', 'milestones']));
  window.addEventListener('nitro:prestige-done', () => markAllDirty());
  window.addEventListener('nitro:lore-changed', () => markWindowsDirty(['lemegeton', 'core']));
}

mountGlobalHooks();
