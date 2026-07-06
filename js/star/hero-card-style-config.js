const STORAGE_KEY = 'star-hero-card-style-config';

export const DEFAULT_STAR_HERO_CARD_STYLE_CONFIG = Object.freeze({
  minHeight: 236,
  sceneHeight: 112,
  gap: 14,
  radius: 18,
  frameInset: 9,
  frameRadius: 12,
  gridSize: 20,
  gridOpacity: 0.42,
  accentFill: 12,
  borderStrength: 36,
  hoverBorderStrength: 68,
  glowStrength: 22,
  hoverLift: 4,
  orbSize: 76,
  orbRadius: 22,
  orbFontSize: 34,
  orbGlow: 34,
  sparkSize: 5,
  scanlineOpacity: 0.16,
  contentPadX: 17,
  contentPadY: 16,
  contentGap: 8,
  titleSize: 1.72,
  titleGlow: 28,
  subMinHeight: 30,
});

const RANGES = Object.freeze({
  minHeight: [180, 340],
  sceneHeight: [72, 172],
  gap: [8, 28],
  radius: [4, 28],
  frameInset: [0, 20],
  frameRadius: [2, 22],
  gridSize: [10, 38],
  gridOpacity: [0, 0.85],
  accentFill: [0, 32],
  borderStrength: [0, 80],
  hoverBorderStrength: [0, 92],
  glowStrength: [0, 60],
  hoverLift: [0, 10],
  orbSize: [44, 112],
  orbRadius: [4, 36],
  orbFontSize: [20, 48],
  orbGlow: [0, 60],
  sparkSize: [0, 10],
  scanlineOpacity: [0, 0.36],
  contentPadX: [10, 28],
  contentPadY: [10, 28],
  contentGap: [4, 16],
  titleSize: [1.05, 2.35],
  titleGlow: [0, 64],
  subMinHeight: [18, 56],
});

export function loadHeroCardStyleConfig(storage = getStorage()) {
  if (!storage) return { ...DEFAULT_STAR_HERO_CARD_STYLE_CONFIG };

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    return normalizeHeroCardStyleConfig(parsed);
  } catch {
    return { ...DEFAULT_STAR_HERO_CARD_STYLE_CONFIG };
  }
}

export function saveHeroCardStyleConfig(config, storage = getStorage()) {
  const next = normalizeHeroCardStyleConfig(config);
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function resetHeroCardStyleConfig(storage = getStorage()) {
  if (storage) storage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_STAR_HERO_CARD_STYLE_CONFIG };
}

export function exportHeroCardStyleConfig(config) {
  return {
    schema: 'gwen-ha-star/star-hero-card-style@1',
    exportedAt: new Date().toISOString(),
    config: normalizeHeroCardStyleConfig(config),
  };
}

export function normalizeHeroCardStyleConfig(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const normalized = {};

  Object.entries(DEFAULT_STAR_HERO_CARD_STYLE_CONFIG).forEach(([key, fallback]) => {
    const [min, max] = RANGES[key] ?? [-Infinity, Infinity];
    const value = Number(source[key]);
    normalized[key] = clamp(Number.isFinite(value) ? value : fallback, min, max);
  });

  normalized.sceneHeight = Math.min(normalized.sceneHeight, normalized.minHeight - 78);
  normalized.hoverBorderStrength = Math.max(normalized.hoverBorderStrength, normalized.borderStrength);
  normalized.frameRadius = Math.min(normalized.frameRadius, normalized.radius);
  normalized.orbFontSize = Math.min(normalized.orbFontSize, normalized.orbSize * 0.62);

  return normalized;
}

export function applyHeroCardStyleConfig(root = getRoot(), config = {}) {
  const target = root?.style ? root : getRoot();
  if (!target) return normalizeHeroCardStyleConfig(config);

  const next = normalizeHeroCardStyleConfig(config);
  setPx(target, 'min-height', next.minHeight);
  setPx(target, 'scene-height', next.sceneHeight);
  setPx(target, 'gap', next.gap);
  setPx(target, 'radius', next.radius);
  setPx(target, 'frame-inset', next.frameInset);
  setPx(target, 'frame-radius', next.frameRadius);
  setPx(target, 'grid-size', next.gridSize);
  setNumber(target, 'grid-opacity', next.gridOpacity);
  setPercent(target, 'accent-fill', next.accentFill);
  setPercent(target, 'border-strength', next.borderStrength);
  setPercent(target, 'hover-border-strength', next.hoverBorderStrength);
  setPercent(target, 'glow-strength', next.glowStrength);
  setPx(target, 'hover-lift', next.hoverLift);
  setPx(target, 'orb-size', next.orbSize);
  setPx(target, 'orb-radius', next.orbRadius);
  setPx(target, 'orb-font-size', next.orbFontSize);
  setPercent(target, 'orb-glow', next.orbGlow);
  setPx(target, 'spark-size', next.sparkSize);
  setNumber(target, 'scanline-opacity', next.scanlineOpacity);
  setPx(target, 'content-pad-x', next.contentPadX);
  setPx(target, 'content-pad-y', next.contentPadY);
  setPx(target, 'content-gap', next.contentGap);
  target.style.setProperty('--star-hero-title-size', `${next.titleSize.toFixed(2)}rem`);
  setPercent(target, 'title-glow', next.titleGlow);
  setPx(target, 'sub-min-height', next.subMinHeight);
  return next;
}

function setPx(target, key, value) {
  target.style.setProperty(`--star-hero-${key}`, `${Math.round(value * 100) / 100}px`);
}

function setNumber(target, key, value) {
  target.style.setProperty(`--star-hero-${key}`, String(Math.round(value * 100) / 100));
}

function setPercent(target, key, value) {
  target.style.setProperty(`--star-hero-${key}`, `${Math.round(value * 100) / 100}%`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getRoot() {
  return typeof document === 'undefined' ? null : document.documentElement;
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
