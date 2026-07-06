import '../../js/star/star-hero-card-style.js';
import { getHeroNitroApps } from '../../shared/nitro-apps.js';
import { publishActivityEvent } from '../../js/star/activity-events.js';
import {
  DEFAULT_STAR_HERO_CARD_STYLE_CONFIG,
  applyHeroCardStyleConfig,
  exportHeroCardStyleConfig,
  loadHeroCardStyleConfig,
  normalizeHeroCardStyleConfig,
  resetHeroCardStyleConfig,
  saveHeroCardStyleConfig,
} from '../../js/star/hero-card-style-config.js';
import { requireStarSuperuser } from './admin-guard.js';

const app = document.getElementById('app');
const heroApps = getHeroNitroApps();
let state = loadHeroCardStyleConfig();
let authContext = null;

const CONTROLS = [
  ['minHeight', 'Hauteur carte', 180, 340, 2, 'px'],
  ['sceneHeight', 'Hauteur scène', 72, 172, 2, 'px'],
  ['gap', 'Espacement', 8, 28, 1, 'px'],
  ['radius', 'Rayon carte', 4, 28, 1, 'px'],
  ['frameInset', 'Cadre interne', 0, 20, 1, 'px'],
  ['gridSize', 'Grille', 10, 38, 1, 'px'],
  ['gridOpacity', 'Opacité grille', 0, 0.85, 0.01, 'ratio'],
  ['accentFill', 'Fond accent', 0, 32, 1, '%'],
  ['borderStrength', 'Bordure', 0, 80, 1, '%'],
  ['glowStrength', 'Glow hover', 0, 60, 1, '%'],
  ['hoverLift', 'Lift hover', 0, 10, 1, 'px'],
  ['orbSize', 'Taille icône', 44, 112, 2, 'px'],
  ['orbRadius', 'Rayon icône', 4, 36, 1, 'px'],
  ['orbFontSize', 'Pictogramme', 20, 48, 1, 'px'],
  ['orbGlow', 'Glow icône', 0, 60, 1, '%'],
  ['sparkSize', 'Sparks', 0, 10, 1, 'px'],
  ['scanlineOpacity', 'Scanlines', 0, 0.36, 0.01, 'ratio'],
  ['contentPadX', 'Padding X', 10, 28, 1, 'px'],
  ['contentPadY', 'Padding Y', 10, 28, 1, 'px'],
  ['contentGap', 'Gap texte', 4, 16, 1, 'px'],
  ['titleSize', 'Titre', 1.05, 2.35, 0.02, 'rem'],
  ['titleGlow', 'Glow titre', 0, 64, 1, '%'],
  ['subMinHeight', 'Sous-texte', 18, 56, 1, 'px'],
];

const PRESETS = {
  default: DEFAULT_STAR_HERO_CARD_STYLE_CONFIG,
  compact: {
    ...DEFAULT_STAR_HERO_CARD_STYLE_CONFIG,
    minHeight: 206,
    sceneHeight: 88,
    gap: 10,
    radius: 10,
    frameInset: 6,
    orbSize: 58,
    orbRadius: 14,
    orbFontSize: 27,
    titleSize: 1.38,
    subMinHeight: 22,
    contentPadX: 14,
    contentPadY: 13,
  },
  arcade: {
    ...DEFAULT_STAR_HERO_CARD_STYLE_CONFIG,
    minHeight: 260,
    sceneHeight: 132,
    accentFill: 24,
    borderStrength: 58,
    hoverBorderStrength: 84,
    glowStrength: 46,
    orbSize: 88,
    orbRadius: 26,
    orbFontSize: 39,
    orbGlow: 54,
    sparkSize: 8,
    scanlineOpacity: 0.24,
    titleSize: 1.94,
  },
  glass: {
    ...DEFAULT_STAR_HERO_CARD_STYLE_CONFIG,
    minHeight: 242,
    sceneHeight: 108,
    radius: 8,
    frameInset: 12,
    frameRadius: 6,
    gridOpacity: 0.18,
    accentFill: 7,
    borderStrength: 28,
    glowStrength: 12,
    orbGlow: 18,
    scanlineOpacity: 0.08,
    titleSize: 1.62,
  },
  signal: {
    ...DEFAULT_STAR_HERO_CARD_STYLE_CONFIG,
    minHeight: 238,
    sceneHeight: 116,
    gridSize: 14,
    gridOpacity: 0.7,
    accentFill: 16,
    borderStrength: 48,
    hoverLift: 2,
    sparkSize: 3,
    scanlineOpacity: 0.3,
    titleSize: 1.58,
  },
};

boot();

async function boot() {
  state = applyHeroCardStyleConfig(document.documentElement, state);
  const auth = await requireStarSuperuser(app, { title: 'HERO CARD STYLE' });
  if (!auth) return;

  authContext = auth;
  render();
}

function render() {
  app.replaceChildren(
    renderTop(),
    renderPresetPanel(),
    renderMain(),
    renderSavePanel(),
  );
  bindControls();
  bindActions();
  renderPreview();
  syncOutputs();
  applyState();
}

function renderTop() {
  const header = document.createElement('header');
  header.className = 'star-admin-top';
  header.innerHTML = `
    <div>
      <p class="star-admin-kicker">// GWEN HA STAR · ADMIN</p>
      <h1 class="star-admin-title">HERO <span>STYLE</span></h1>
      <p class="star-admin-sub">Contrôle visuel des cartes principales du cockpit Star.</p>
    </div>
    <nav class="star-admin-actions" aria-label="Navigation admin">
      <a class="star-admin-btn" href="/star/">COCKPIT</a>
      <a class="star-admin-btn" href="/star/admin/hero-cards.html">HERO CARDS</a>
      <a class="star-admin-btn" href="/star/admin/cockpit-background.html">BACKGROUND STAR</a>
      <a class="star-admin-btn" href="/star/admin/background.html">BACKGROUND PUBLIC</a>
    </nav>
  `;
  return header;
}

function renderPresetPanel() {
  const section = document.createElement('section');
  section.className = 'star-admin-card hero-style-presets';
  section.innerHTML = `
    <p class="star-admin-kicker">// PRESETS</p>
    <div class="star-admin-presets">
      <button class="star-admin-btn" type="button" data-preset="default">DÉFAUT</button>
      <button class="star-admin-btn" type="button" data-preset="compact">COMPACT</button>
      <button class="star-admin-btn" type="button" data-preset="arcade">ARCADE</button>
      <button class="star-admin-btn" type="button" data-preset="glass">GLASS</button>
      <button class="star-admin-btn" type="button" data-preset="signal">SIGNAL</button>
    </div>
  `;
  return section;
}

function renderMain() {
  const layout = document.createElement('section');
  layout.className = 'hero-style-layout';
  layout.append(renderControlsPanel(), renderPreviewPanel());
  return layout;
}

function renderControlsPanel() {
  const section = document.createElement('section');
  section.className = 'star-admin-card hero-style-controls';
  section.id = 'style-controls';
  section.innerHTML = `<p class="star-admin-kicker">// STYLE</p>`;
  CONTROLS.forEach(control => section.append(renderRange(control)));
  return section;
}

function renderPreviewPanel() {
  const section = document.createElement('section');
  section.className = 'hero-style-preview-panel';
  section.innerHTML = `
    <p class="star-admin-kicker">// PREVIEW</p>
    <div class="hero-style-preview-stage">
      <div class="bento-hero-row" id="hero-style-preview"></div>
    </div>
  `;
  return section;
}

function renderSavePanel() {
  const section = document.createElement('section');
  section.className = 'star-admin-card hero-style-save';
  section.innerHTML = `
    <p class="star-admin-kicker">// SAVE · EXPORT</p>
    <div class="star-admin-actions">
      <button class="star-admin-btn primary" type="button" id="save-local">SAUVER LOCAL</button>
      <button class="star-admin-btn" type="button" id="export-json">EXPORT JSON</button>
      <button class="star-admin-btn" type="button" id="import-json">IMPORT JSON</button>
      <button class="star-admin-btn danger" type="button" id="reset-local">RESET</button>
    </div>
    <input class="hero-style-import" type="file" id="import-file" accept="application/json,.json" />
    <div class="hero-style-toast" id="toast"></div>
  `;
  return section;
}

function renderRange([key, label, min, max, step]) {
  const wrap = document.createElement('div');
  wrap.className = 'star-bg-control hero-style-control';
  wrap.innerHTML = `
    <label for="ctrl-${key}">
      <span>${label}</span>
      <output id="out-${key}"></output>
    </label>
    <input id="ctrl-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}" data-control="${key}">
  `;
  return wrap;
}

function bindControls() {
  document.querySelectorAll('input[data-control]').forEach(input => {
    input.addEventListener('input', () => {
      state[input.dataset.control] = Number(input.value);
      applyState();
      syncOutputs();
    });
  });
}

function bindActions() {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      state = normalizeHeroCardStyleConfig(PRESETS[btn.dataset.preset]);
      applyState();
      syncOutputs();
      toast(`Preset ${btn.textContent} appliqué.`);
    });
  });

  document.getElementById('save-local')?.addEventListener('click', () => {
    state = saveHeroCardStyleConfig(state);
    applyState();
    toast('Style sauvegardé localement.');
    trackHeroStyleActivity('save-local', 'Style hero card sauvegardé depuis la console admin');
  });

  document.getElementById('export-json')?.addEventListener('click', () => {
    downloadJson('star-hero-card-style-config.json', exportHeroCardStyleConfig(state));
    toast('Export JSON généré.');
    trackHeroStyleActivity('export', 'Style hero card exporté en JSON');
  });

  document.getElementById('import-json')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });

  document.getElementById('import-file')?.addEventListener('change', importJson);

  document.getElementById('reset-local')?.addEventListener('click', () => {
    state = resetHeroCardStyleConfig();
    applyState();
    syncOutputs();
    toast('Style réinitialisé.');
    trackHeroStyleActivity('reset', 'Style hero card réinitialisé');
  });
}

function renderPreview() {
  const preview = document.getElementById('hero-style-preview');
  if (!preview) return;
  preview.innerHTML = buildHeroCardsMarkup(heroApps);
  preview.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', event => event.preventDefault());
  });
}

function applyState() {
  state = applyHeroCardStyleConfig(document.documentElement, state);
}

function syncOutputs() {
  CONTROLS.forEach(([key, _label, _min, _max, _step, unit]) => {
    const input = document.getElementById(`ctrl-${key}`);
    const output = document.getElementById(`out-${key}`);
    if (input) input.value = state[key];
    if (output) output.textContent = formatValue(state[key], unit);
  });
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeHeroCardStyleConfig(parsed.config ?? parsed);
    applyState();
    syncOutputs();
    toast('Config importée en preview.');
    trackHeroStyleActivity('import', 'Style hero card importé en preview');
  } catch (error) {
    toast(`Import impossible : ${error.message}`, true);
  } finally {
    event.target.value = '';
  }
}

function trackHeroStyleActivity(action, message) {
  void publishActivityEvent(authContext, 'admin_hero_cards', message, {
    channel: 'crew',
    source: 'star-admin.hero-card-style',
    action,
    target: '/star/index.html',
    config: {
      minHeight: state.minHeight,
      sceneHeight: state.sceneHeight,
      radius: state.radius,
      borderStrength: state.borderStrength,
      orbSize: state.orbSize,
      titleSize: state.titleSize,
    },
  });
}

function buildHeroCardsMarkup(apps) {
  return apps.map(appConfig => {
    const kind = String(appConfig.id).replace(/[^a-z0-9-]/gi, '-');
    const ext = String(appConfig.url).startsWith('http');
    const title = formatHeroTitle(appConfig.heroTitle ?? appConfig.name);
    const eyebrow = escapeHtml(appConfig.heroEyebrow ?? '// NITRO · APP');
    const sub = escapeHtml(appConfig.heroSub ?? appConfig.description);
    const badge = escapeHtml(appConfig.heroBadge ?? String(appConfig.status).toUpperCase());

    return `
      <div class="bc bc-hero bc-nitro-hero" data-app="${escapeAttr(appConfig.id)}" data-nitro-rendered="true">
        <a href="${escapeAttr(appConfig.url)}" class="hero-card hero-card--nitro hero-card--${kind}" aria-label="Accéder à ${escapeAttr(appConfig.name)}" ${ext ? 'target="_blank" rel="noopener noreferrer"' : ''}>
          <div class="hero-scene hero-scene--nitro hero-scene--${kind}" aria-hidden="true">
            <div class="hsc-grid"></div>
            <div class="nitro-hero-orb">${escapeHtml(appConfig.icon)}</div>
            <div class="nitro-hero-spark nitro-hero-spark-1"></div>
            <div class="nitro-hero-spark nitro-hero-spark-2"></div>
            <div class="nitro-hero-spark nitro-hero-spark-3"></div>
          </div>
          <div class="hero-content">
            <div class="hero-eyebrow">${eyebrow}</div>
            <div class="hero-title hero-title--nitro">${title}</div>
            <div class="hero-sub">${sub}</div>
            <div class="hero-footer">
              <span class="hero-badge hero-badge--nitro">${badge}</span>
              <span class="hero-cta">OUVRIR →</span>
            </div>
          </div>
          <div class="hero-scanlines" aria-hidden="true"></div>
        </a>
      </div>
    `;
  }).join('');
}

function formatHeroTitle(title) {
  const parts = String(title).split(' ');
  if (parts.length <= 1) return escapeHtml(title);
  const first = escapeHtml(parts.shift());
  return `${first}<br><span class="hero-title-accent">${escapeHtml(parts.join(' '))}</span>`;
}

function formatValue(value, unit) {
  if (unit === 'ratio') return Number(value).toFixed(2);
  if (unit === 'rem') return `${Number(value).toFixed(2)}rem`;
  return `${Math.round(Number(value))}${unit}`;
}

function toast(text, error = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? 'var(--c-red)' : 'var(--c-primary)';
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
