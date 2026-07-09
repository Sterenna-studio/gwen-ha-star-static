const PANEL_STATE_KEY = 'star-sterenna-panel-state';
const PANEL_FRAME_KEY = 'star-sterenna-panel-frame';
const PANEL_CHANNEL = 'star-sterenna-panel';
const DEFAULT_HUBLOT = '../../shared/logos/star_logo/star_logo_color_set/star_logo_cyan_blue.png';

const cpuValueEl = document.getElementById('cpuValue');
const memValueEl = document.getElementById('memValue');
const uptimeValueEl = document.getElementById('uptimeValue');
const gpuTempValueEl = document.getElementById('gpuTempValue');
const gpuInfoValueEl = document.getElementById('gpuInfoValue');
const sterennaStatusValueEl = document.getElementById('sterennaStatusValue');
const youtubeSubsValueEl = document.getElementById('youtubeSubsValue');
const weatherValueEl = document.getElementById('weatherValue');
const remoteLastCheckValueEl = document.getElementById('remoteLastCheckValue');
const lampSterenna = document.getElementById('lampSterenna');
const lampGpu = document.getElementById('lampGpu');
const lampWeather = document.getElementById('lampWeather');
const dashboardRoot = document.getElementById('dashboardRoot');
const hublotImg = document.getElementById('hublotImg');
const visuModeLabel = document.getElementById('visuModeLabel');
const tickerEl = document.getElementById('ticker');
const canvas = document.getElementById('miniVisu');
const ctx = canvas.getContext('2d');

const defaultState = {
  simulation: true,
  hublotSrc: '',
  theme: { alert: false, night: false, bzh: true, monitorStyle: 'default' },
  bg3d: { enabled: true, shipRate: 1 },
};

let panelState = readState();
let latestFrame = readLatestFrame() ?? {
  level: 0,
  freqs: new Array(32).fill(0),
  time: new Array(32).fill(128),
};
let mode = 'pulse';
const startedAt = performance.now();
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(PANEL_CHANNEL) : null;

function mergeState(next = {}) {
  return {
    ...defaultState,
    ...next,
    theme: { ...defaultState.theme, ...(next.theme || {}) },
    bg3d: { ...defaultState.bg3d, ...(next.bg3d || {}) },
  };
}

function readState() {
  try {
    return mergeState(JSON.parse(localStorage.getItem(PANEL_STATE_KEY) || '{}'));
  } catch {
    return mergeState();
  }
}

function readLatestFrame() {
  try {
    const payload = JSON.parse(localStorage.getItem(PANEL_FRAME_KEY) || 'null');
    return payload?.frame ?? null;
  } catch {
    return null;
  }
}

function resize() {
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight - 32;
  canvas.width = Math.max(200, w);
  canvas.height = Math.max(120, h);
}

function formatBytesToGiB(used, total) {
  if (!used || !total) return '-- / -- GiB';
  const giu = used / (1024 * 1024 * 1024);
  const git = total / (1024 * 1024 * 1024);
  return `${giu.toFixed(1)} / ${git.toFixed(1)} GiB`;
}

function formatUptime(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function applyPanelState(nextState = panelState) {
  panelState = mergeState(nextState);
  dashboardRoot.classList.toggle('theme-alert', !!panelState.theme.alert);
  dashboardRoot.classList.toggle('theme-night', !!panelState.theme.night);
  dashboardRoot.classList.toggle('theme-bzh', !!panelState.theme.bzh);
  dashboardRoot.classList.remove('monitor-style-default', 'monitor-style-scanlines', 'monitor-style-wireframe');
  dashboardRoot.classList.add(`monitor-style-${panelState.theme.monitorStyle || 'default'}`);

  const src = String(panelState.hublotSrc || '').trim();
  hublotImg.src = src || DEFAULT_HUBLOT;
  hublotImg.classList.toggle('has-src', true);

  if (window.SterennaBG3D) {
    window.SterennaBG3D.setTheme(panelState.theme);
    window.SterennaBG3D.setConfig(panelState.bg3d);
  }

  visuModeLabel.textContent = panelState.simulation ? 'SIM' : 'LIVE';
  tickerEl.textContent = panelState.simulation
    ? '[SIMULATION] BZH_PW TRAINING LOOP // VISUALIZER FEED: LOCAL'
    : '[LIVE] BZH_PW // ADMIN AUDIO LINK // STERENNA CORE ONLINE...';
}

function updateMetrics() {
  const elapsed = (performance.now() - startedAt) / 1000;
  const cpu = 31 + Math.sin(elapsed / 2.1) * 11 + Math.random() * 3;
  const memTotal = 16 * 1024 * 1024 * 1024;
  const memUsed = (6.2 + Math.sin(elapsed / 4.8) * 0.7) * 1024 * 1024 * 1024;

  cpuValueEl.textContent = `${cpu.toFixed(0)} %`;
  memValueEl.textContent = formatBytesToGiB(memUsed, memTotal);
  uptimeValueEl.textContent = formatUptime(elapsed);
  gpuTempValueEl.textContent = panelState.bg3d.enabled ? '42 °C' : '-- °C';
  gpuInfoValueEl.textContent = panelState.bg3d.enabled ? 'WEBGL CORE · MODE STATIC' : 'Fond 3D désactivé';
  sterennaStatusValueEl.textContent = 'STATIC OK';
  youtubeSubsValueEl.textContent = 'N/A · mode statique';
  weatherValueEl.textContent = 'Limoges // veille locale';
  remoteLastCheckValueEl.textContent = new Date().toLocaleString('fr-FR', { hour12: false });

  lampSterenna.classList.add('on');
  lampWeather.classList.add('on');
  lampGpu.classList.toggle('on', !!panelState.bg3d.enabled);
}

function makeSyntheticFrame(now) {
  const level = 0.18 + Math.abs(Math.sin(now / 520)) * 0.72;
  const freqs = Array.from({ length: 32 }, (_, i) => {
    const wave = Math.sin(now / 180 + i * 0.52) * 0.5 + 0.5;
    return Math.round(30 + wave * 210 * (0.35 + level * 0.65));
  });
  const time = Array.from({ length: 32 }, (_, i) => {
    return Math.round(128 + Math.sin(now / 120 + i * 0.45) * 82 * level);
  });
  return { level, freqs, time };
}

function drawPulse() {
  const { level } = latestFrame;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) * 0.45;
  const radius = maxR * (0.3 + level * 0.7);
  const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(0,255,200,1)');
  gradient.addColorStop(0.5, 'rgba(0,120,255,0.8)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBars() {
  const { freqs } = latestFrame;
  const barWidth = canvas.width / freqs.length;
  freqs.forEach((value, i) => {
    const v = value / 255;
    const barHeight = v * canvas.height;
    const hue = 180 + (i * 140) / freqs.length;
    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
    ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth * 0.9, barHeight);
  });
}

function drawWave() {
  const { time } = latestFrame;
  const midY = canvas.height / 2;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#00ffcc';
  ctx.beginPath();
  time.forEach((value, i) => {
    const t = (value - 128) / 128;
    const x = (i / (time.length - 1)) * canvas.width;
    const y = midY + t * (canvas.height * 0.4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function render(now = performance.now()) {
  if (panelState.simulation) latestFrame = makeSyntheticFrame(now);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (mode === 'bars') drawBars();
  else if (mode === 'wave') drawWave();
  else drawPulse();
  requestAnimationFrame(render);
}

channel?.addEventListener('message', (event) => {
  if (event.data?.type === 'state') {
    applyPanelState(event.data.state);
    updateMetrics();
  }
  if (event.data?.type === 'audioFrame' && !panelState.simulation) {
    latestFrame = event.data.frame;
  }
  if (event.data?.type === 'mode') mode = event.data.mode || 'pulse';
});

window.addEventListener('storage', (event) => {
  if (event.key === PANEL_STATE_KEY) {
    applyPanelState(readState());
    updateMetrics();
  }
  if (event.key === PANEL_FRAME_KEY && !panelState.simulation) {
    latestFrame = readLatestFrame() ?? latestFrame;
  }
});

window.addEventListener('resize', resize);
resize();
applyPanelState();
updateMetrics();
setInterval(updateMetrics, 1000);
requestAnimationFrame(render);
