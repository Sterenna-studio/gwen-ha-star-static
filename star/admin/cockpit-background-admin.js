import {
  DEFAULT_STAR_COCKPIT_BACKGROUND_CONFIG,
  applyCockpitBackgroundConfig,
  exportCockpitBackgroundConfig,
  loadCockpitBackgroundConfig,
  normalizeCockpitBackgroundConfig,
  saveCockpitBackgroundConfig,
} from '../../js/star/cockpit-background-config.js';
import { publishActivityEvent } from '../../js/star/activity-events.js';
import { requireStarSuperuser } from './admin-guard.js';

const app = document.getElementById('app');
const exitPreview = document.getElementById('exit-preview');
let state = loadCockpitBackgroundConfig();
let authContext = null;

const CONTROLS = [
  ['cyanGlow', 'Halo cyan', 0, 0.35, 0.01],
  ['violetGlow', 'Halo violet', 0, 0.35, 0.01],
  ['starOpacity', 'Opacité étoiles', 0, 0.9, 0.01],
  ['starSpeed', 'Vitesse étoiles', 8, 120, 1],
  ['frameWidth', 'Largeur verrière', 520, 1420, 10],
  ['frameOpacity', 'Opacité verrière', 0, 1, 0.01],
  ['panelOpacity', 'Opacité hologramme', 0.25, 1, 0.01],
  ['panelBlur', 'Blur hologramme', 0, 24, 1],
  ['holoOpacity', 'Scan holographique', 0, 0.9, 0.01],
  ['portholeOpacity', 'Opacité hublots', 0, 1, 0.01],
  ['portholeScale', 'Taille hublots', 0.5, 1.6, 0.01],
  ['portholeSpeed', 'Vitesse hublots', 8, 90, 1],
];

const PRESETS = {
  default: DEFAULT_STAR_COCKPIT_BACKGROUND_CONFIG,
  calm: {
    cyanGlow: 0.08,
    violetGlow: 0.06,
    starOpacity: 0.24,
    starSpeed: 64,
    frameWidth: 920,
    frameOpacity: 0.48,
    panelOpacity: 0.86,
    panelBlur: 8,
    holoOpacity: 0.24,
    portholes: true,
    portholeOpacity: 0.5,
    portholeScale: 0.88,
    portholeSpeed: 44,
  },
  neon: {
    cyanGlow: 0.18,
    violetGlow: 0.18,
    starOpacity: 0.46,
    starSpeed: 34,
    frameWidth: 1040,
    frameOpacity: 0.7,
    panelOpacity: 0.96,
    panelBlur: 12,
    holoOpacity: 0.5,
    portholes: true,
    portholeOpacity: 0.86,
    portholeScale: 1.08,
    portholeSpeed: 24,
  },
  storm: {
    cyanGlow: 0.24,
    violetGlow: 0.28,
    starOpacity: 0.58,
    starSpeed: 18,
    frameWidth: 1180,
    frameOpacity: 0.82,
    panelOpacity: 1,
    panelBlur: 16,
    holoOpacity: 0.68,
    portholes: true,
    portholeOpacity: 1,
    portholeScale: 1.22,
    portholeSpeed: 14,
  },
  minimal: {
    cyanGlow: 0.03,
    violetGlow: 0.02,
    starOpacity: 0.14,
    starSpeed: 90,
    frameWidth: 760,
    frameOpacity: 0.24,
    panelOpacity: 0.72,
    panelBlur: 4,
    holoOpacity: 0.08,
    portholes: false,
    portholeOpacity: 0,
    portholeScale: 0.75,
    portholeSpeed: 60,
  },
};

boot();

async function boot() {
  applyCockpitBackgroundConfig(document.body, state);
  const auth = await requireStarSuperuser(app, { title: 'COCKPIT BACKGROUND' });
  if (!auth) return;

  authContext = auth;
  render();
  bindPreviewOnly();
}

function render() {
  app.replaceChildren(renderPanel(), renderStage());
  bindControls();
  bindActions();
  syncOutputs();
  applyState();
}

function renderPanel() {
  const panel = document.createElement('section');
  panel.className = 'star-bg-admin-panel';
  panel.innerHTML = `
    <header class="star-admin-card">
      <p class="star-admin-kicker">// GWEN HA STAR · ADMIN</p>
      <h1 class="star-admin-title">COCKPIT <span>BG</span></h1>
      <p class="star-admin-sub">Prévisualisation du fond seul de /star/index.html, avec sauvegarde locale et export JSON de configuration.</p>
      <nav class="star-admin-actions" aria-label="Navigation admin">
        <a class="star-admin-btn" href="/star/">COCKPIT</a>
        <a class="star-admin-btn" href="/star/admin/hero-cards.html">HERO CARDS</a>
        <a class="star-admin-btn" href="/star/admin/hero-card-style.html">HERO STYLE</a>
        <a class="star-admin-btn" href="/star/admin/background.html">BG PUBLIC</a>
      </nav>
    </header>

    <section class="star-admin-card">
      <p class="star-admin-kicker">// PRESETS</p>
      <div class="star-admin-presets">
        <button class="star-admin-btn" type="button" data-preset="default">DÉFAUT</button>
        <button class="star-admin-btn" type="button" data-preset="calm">CALME</button>
        <button class="star-admin-btn" type="button" data-preset="neon">NÉON</button>
        <button class="star-admin-btn" type="button" data-preset="storm">TEMPÊTE</button>
        <button class="star-admin-btn" type="button" data-preset="minimal">MINIMAL</button>
      </div>
    </section>

    <section class="star-admin-card star-bg-controls" id="controls"></section>

    <section class="star-admin-card">
      <p class="star-admin-kicker">// SAVE · EXPORT</p>
      <div class="star-admin-actions">
        <button class="star-admin-btn primary" type="button" id="save-local">SAUVER LOCAL</button>
        <button class="star-admin-btn" type="button" id="export-json">EXPORT JSON</button>
        <button class="star-admin-btn" type="button" id="import-json">IMPORT JSON</button>
        <button class="star-admin-btn" type="button" id="preview-only">APERÇU SEUL</button>
        <button class="star-admin-btn danger" type="button" id="reset-local">RESET</button>
      </div>
      <input class="star-bg-import" type="file" id="import-file" accept="application/json,.json" />
      <p class="star-admin-muted">La sauvegarde locale est lue par ce navigateur sur /star/index.html. L’export JSON sert de backup ou de base pour figer une config dans le code.</p>
      <div class="star-bg-toast" id="toast"></div>
    </section>
  `;

  return panel;
}

function renderStage() {
  const stage = document.createElement('section');
  stage.className = 'star-bg-stage';
  stage.setAttribute('aria-label', 'Aperçu du background cockpit Star');
  return stage;
}

function bindControls() {
  const controls = document.getElementById('controls');
  controls.replaceChildren(renderPortholeToggle(), ...CONTROLS.map(renderRange));

  controls.querySelectorAll('input[data-control]').forEach(input => {
    input.addEventListener('input', () => {
      const key = input.dataset.control;
      state[key] = Number(input.value);
      syncOutputs();
      applyState();
    });
  });

  controls.querySelector('[data-toggle="portholes"]')?.addEventListener('change', event => {
    state.portholes = event.target.checked;
    applyState();
  });
}

function renderPortholeToggle() {
  const wrap = document.createElement('div');
  wrap.className = 'star-bg-control';
  wrap.innerHTML = `
    <label>
      <span>Hublots cockpit</span>
      <input type="checkbox" data-toggle="portholes" ${state.portholes ? 'checked' : ''}>
    </label>
  `;
  return wrap;
}

function renderRange([key, label, min, max, step]) {
  const wrap = document.createElement('div');
  wrap.className = 'star-bg-control';
  wrap.innerHTML = `
    <label for="ctrl-${key}">
      <span>${label}</span>
      <output id="out-${key}"></output>
    </label>
    <input id="ctrl-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}" data-control="${key}">
  `;
  return wrap;
}

function bindActions() {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      state = normalizeCockpitBackgroundConfig(PRESETS[btn.dataset.preset]);
      render();
      toast(`Preset ${btn.textContent} appliqué en preview.`);
    });
  });

  document.getElementById('save-local')?.addEventListener('click', () => {
    state = saveCockpitBackgroundConfig(state);
    applyState();
    toast('Configuration sauvegardée localement pour /star/index.html.');
    trackBackgroundActivity('save-local', 'Configuration background cockpit sauvegardée pour Star');
  });

  document.getElementById('export-json')?.addEventListener('click', () => {
    downloadJson('star-cockpit-background-config.json', exportCockpitBackgroundConfig(state));
    toast('Export JSON généré.');
    trackBackgroundActivity('export', 'Configuration background cockpit exportée en JSON');
  });

  document.getElementById('import-json')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });

  document.getElementById('import-file')?.addEventListener('change', importJson);

  document.getElementById('preview-only')?.addEventListener('click', () => {
    document.body.classList.add('star-bg-preview-only');
  });

  document.getElementById('reset-local')?.addEventListener('click', () => {
    state = normalizeCockpitBackgroundConfig(DEFAULT_STAR_COCKPIT_BACKGROUND_CONFIG);
    saveCockpitBackgroundConfig(state);
    render();
    toast('Configuration locale réinitialisée.');
    trackBackgroundActivity('reset', 'Configuration background cockpit réinitialisée');
  });
}

function bindPreviewOnly() {
  exitPreview?.addEventListener('click', () => {
    document.body.classList.remove('star-bg-preview-only');
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.body.classList.remove('star-bg-preview-only');
  });
}

function syncOutputs() {
  CONTROLS.forEach(([key]) => {
    const input = document.getElementById(`ctrl-${key}`);
    const output = document.getElementById(`out-${key}`);
    if (input) input.value = state[key];
    if (output) output.textContent = formatValue(key, state[key]);
  });

  const toggle = document.querySelector('[data-toggle="portholes"]');
  if (toggle) toggle.checked = state.portholes;
}

function applyState() {
  state = applyCockpitBackgroundConfig(document.body, state);
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeCockpitBackgroundConfig(parsed.config ?? parsed);
    render();
    toast('Config importée en preview. Clique sur SAUVER LOCAL pour l’appliquer à ce navigateur.');
    trackBackgroundActivity('import', 'Configuration background cockpit importée en preview');
  } catch (error) {
    toast(`Import impossible : ${error.message}`, true);
  } finally {
    event.target.value = '';
  }
}

function trackBackgroundActivity(action, message) {
  void publishActivityEvent(authContext, 'admin_background', message, {
    channel: 'crew',
    source: 'star-admin.cockpit-background',
    action,
    target: '/star/index.html',
    config: {
      starOpacity: state.starOpacity,
      starSpeed: state.starSpeed,
      frameWidth: state.frameWidth,
      portholes: state.portholes,
      portholeOpacity: state.portholeOpacity,
    },
  });
}

function formatValue(key, value) {
  if (key.includes('Opacity') || key.includes('Glow')) return Number(value).toFixed(2);
  if (key.includes('Speed')) return `${value}s`;
  if (key === 'frameWidth') return `${value}px`;
  if (key === 'panelBlur') return `${value}px`;
  if (key === 'portholeScale') return `${Number(value).toFixed(2)}x`;
  return String(value);
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
