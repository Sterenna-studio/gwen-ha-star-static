// Tiny DOM write cache.
// Prevents repeated text/class/style writes during high-frequency refreshes.

const textCache = new WeakMap();
const htmlCache = new WeakMap();
const styleCache = new WeakMap();

const INNER_HTML_GUARDED_IDS = new Set([
  'scale-card',
  'milestone-list',
  'upgrade-list',
  'module-orbit',
  'factory-field',
  'tendril-layer',
]);

let guardsInstalled = false;

export function setText(nodeOrId, value) {
  const node = resolveNode(nodeOrId);
  if (!node) return false;
  const next = String(value ?? '');
  if (textCache.get(node) === next && node.textContent === next) return false;
  node.textContent = next;
  textCache.set(node, next);
  return true;
}

export function setHtml(nodeOrId, value) {
  const node = resolveNode(nodeOrId);
  if (!node) return false;
  const next = String(value ?? '');
  if (htmlCache.get(node) === next && node.innerHTML === next) return false;
  node.innerHTML = next;
  htmlCache.set(node, next);
  return true;
}

export function setStyle(nodeOrId, prop, value) {
  const node = resolveNode(nodeOrId);
  if (!node || !prop) return false;
  let map = styleCache.get(node);
  if (!map) {
    map = new Map();
    styleCache.set(node, map);
  }
  const next = String(value ?? '');
  if (map.get(prop) === next && node.style.getPropertyValue(prop) === next) return false;
  node.style.setProperty(prop, next);
  map.set(prop, next);
  return true;
}

export function setTransformScaleX(nodeOrId, ratio) {
  const safe = Math.max(0, Math.min(1, Number(ratio) || 0));
  return setStyle(nodeOrId, 'transform', `scaleX(${safe})`);
}

export function setClassToggle(nodeOrId, className, enabled) {
  const node = resolveNode(nodeOrId);
  if (!node || !className) return false;
  const before = node.classList.contains(className);
  if (before === !!enabled) return false;
  node.classList.toggle(className, !!enabled);
  return true;
}

export function installDomWriteGuards() {
  if (guardsInstalled) return;
  guardsInstalled = true;
  installInnerHtmlGuard();
  installStyleSetPropertyGuard();
}

function installInnerHtmlGuard() {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!descriptor?.set || !descriptor?.get || !descriptor.configurable) return;
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() {
      return descriptor.get.call(this);
    },
    set(value) {
      const next = String(value ?? '');
      if (this.id && INNER_HTML_GUARDED_IDS.has(this.id)) {
        const prev = htmlCache.get(this);
        if (prev === next && descriptor.get.call(this) === next) return;
        htmlCache.set(this, next);
      }
      descriptor.set.call(this, next);
    },
  });
}

function installStyleSetPropertyGuard() {
  const original = CSSStyleDeclaration.prototype.setProperty;
  if (!original || original.__nitroGuarded) return;
  function guardedSetProperty(propertyName, value = '', priority = '') {
    const next = String(value ?? '');
    const current = this.getPropertyValue(propertyName);
    const currentPriority = this.getPropertyPriority(propertyName);
    if (current === next && currentPriority === String(priority ?? '')) return undefined;
    return original.call(this, propertyName, next, priority);
  }
  guardedSetProperty.__nitroGuarded = true;
  CSSStyleDeclaration.prototype.setProperty = guardedSetProperty;
}

function resolveNode(nodeOrId) {
  if (!nodeOrId) return null;
  if (typeof nodeOrId === 'string') return document.getElementById(nodeOrId);
  return nodeOrId;
}

installDomWriteGuards();

window.NitroRenderCache = {
  setText,
  setHtml,
  setStyle,
  setTransformScaleX,
  setClassToggle,
  installDomWriteGuards,
};
