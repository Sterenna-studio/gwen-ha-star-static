// Shared browser-side asset cache.
// Avoid recreating Image() probes and avoid reapplying the same CSS variables.

const CACHE_KEY_PREFIX = 'nitro-clicker.asset.';
const memory = new Map();
const applied = new Map();

export function resolveImage(candidates, key = candidates.join('|')) {
  if (memory.has(key)) return memory.get(key);

  const stored = sessionStorage.getItem(CACHE_KEY_PREFIX + key);
  if (stored) {
    const promise = Promise.resolve(stored);
    memory.set(key, promise);
    return promise;
  }

  const promise = new Promise(resolve => {
    let index = 0;
    const tryNext = () => {
      const src = candidates[index];
      if (!src) return resolve(null);
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.onload = () => {
        sessionStorage.setItem(CACHE_KEY_PREFIX + key, src);
        resolve(src);
      };
      img.onerror = () => {
        index += 1;
        tryNext();
      };
      img.src = src;
    };
    tryNext();
  });

  memory.set(key, promise);
  return promise;
}

export function applyCssImageVar(node, cssVar, src) {
  if (!node || !src || !cssVar) return false;
  const key = `${node.id || node.className || node.tagName}:${cssVar}`;
  const value = `url("${src}")`;
  if (applied.get(key) === value && node.style.getPropertyValue(cssVar) === value) return false;
  node.style.setProperty(cssVar, value);
  applied.set(key, value);
  return true;
}

export function preloadImages(list = []) {
  return Promise.all(list.map((src, index) => resolveImage([src], `preload:${index}:${src}`)));
}

window.NitroAssetCache = {
  resolveImage,
  applyCssImageVar,
  preloadImages,
};
