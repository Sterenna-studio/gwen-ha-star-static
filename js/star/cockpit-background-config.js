export const COCKPIT_BACKGROUND_STORAGE_KEY = 'star-cockpit-background-config';

export const DEFAULT_STAR_COCKPIT_BACKGROUND_CONFIG = Object.freeze({
  cyanGlow: 0.12,
  violetGlow: 0.13,
  starOpacity: 0.34,
  starSpeed: 42,
  frameWidth: 980,
  frameOpacity: 0.62,
  panelOpacity: 0.92,
  panelBlur: 10,
  holoOpacity: 0.36,
  portholes: true,
  portholeOpacity: 0.78,
  portholeScale: 1,
  portholeSpeed: 28,
});

const NUMBER_FIELDS = {
  cyanGlow: [0, 0.35],
  violetGlow: [0, 0.35],
  starOpacity: [0, 0.9],
  starSpeed: [8, 120],
  frameWidth: [520, 1420],
  frameOpacity: [0, 1],
  panelOpacity: [0.25, 1],
  panelBlur: [0, 24],
  holoOpacity: [0, 0.9],
  portholeOpacity: [0, 1],
  portholeScale: [0.5, 1.6],
  portholeSpeed: [8, 90],
};

export function normalizeCockpitBackgroundConfig(input = {}) {
  const cfg = { ...DEFAULT_STAR_COCKPIT_BACKGROUND_CONFIG };
  const source = input && typeof input === 'object' ? input : {};

  Object.entries(NUMBER_FIELDS).forEach(([key, [min, max]]) => {
    cfg[key] = clampNumber(source[key], cfg[key], min, max);
  });

  cfg.portholes = source.portholes !== false;
  return cfg;
}

export function loadCockpitBackgroundConfig(storage = getStorage()) {
  if (!storage) return { ...DEFAULT_STAR_COCKPIT_BACKGROUND_CONFIG };

  try {
    const raw = storage.getItem(COCKPIT_BACKGROUND_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STAR_COCKPIT_BACKGROUND_CONFIG };
    const parsed = JSON.parse(raw);
    return normalizeCockpitBackgroundConfig(parsed?.config ?? parsed);
  } catch {
    return { ...DEFAULT_STAR_COCKPIT_BACKGROUND_CONFIG };
  }
}

export function saveCockpitBackgroundConfig(config, storage = getStorage()) {
  const normalized = normalizeCockpitBackgroundConfig(config);
  if (!storage) return normalized;

  try {
    storage.setItem(COCKPIT_BACKGROUND_STORAGE_KEY, JSON.stringify({
      schema: 'gwen-ha-star/star-cockpit-background@1',
      updatedAt: new Date().toISOString(),
      target: '/star/index.html',
      config: normalized,
    }, null, 2));
  } catch {}

  return normalized;
}

export function applyCockpitBackgroundConfig(root = document.body, input = {}) {
  if (!root) return normalizeCockpitBackgroundConfig(input);

  const cfg = normalizeCockpitBackgroundConfig(input);
  const vars = getCockpitBackgroundCssVariables(cfg);
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.classList.toggle('star-bg-portholes-disabled', !cfg.portholes);
  return cfg;
}

export function initCockpitBackgroundConfig(root = document.body) {
  return applyCockpitBackgroundConfig(root, loadCockpitBackgroundConfig());
}

export function exportCockpitBackgroundConfig(config) {
  const normalized = normalizeCockpitBackgroundConfig(config);
  return {
    schema: 'gwen-ha-star/star-cockpit-background@1',
    exportedAt: new Date().toISOString(),
    target: '/star/index.html',
    storageKey: COCKPIT_BACKGROUND_STORAGE_KEY,
    config: normalized,
    cssVariables: getCockpitBackgroundCssVariables(normalized),
  };
}

export function getCockpitBackgroundCssVariables(config) {
  const cfg = normalizeCockpitBackgroundConfig(config);
  return {
    '--star-bg-cyan-glow': String(cfg.cyanGlow),
    '--star-bg-violet-glow': String(cfg.violetGlow),
    '--star-bg-star-opacity': String(cfg.starOpacity),
    '--star-bg-star-speed': `${cfg.starSpeed}s`,
    '--star-bg-frame-width': `min(${cfg.frameWidth}px, 92vw)`,
    '--star-bg-frame-opacity': String(cfg.frameOpacity),
    '--star-bg-panel-opacity': String(cfg.panelOpacity),
    '--star-bg-panel-blur': `${cfg.panelBlur}px`,
    '--star-bg-holo-opacity': String(cfg.holoOpacity),
    '--star-bg-porthole-opacity': String(cfg.portholeOpacity),
    '--star-bg-porthole-scale': String(cfg.portholeScale),
    '--star-bg-porthole-speed': `${cfg.portholeSpeed}s`,
  };
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
