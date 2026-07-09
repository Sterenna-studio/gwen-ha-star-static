const PANEL_STATE_KEY = 'star-sterenna-panel-state';
const PANEL_FRAME_KEY = 'star-sterenna-panel-frame';
const PANEL_CHANNEL = 'star-sterenna-panel';

const statusEl = document.getElementById('status');
const sourceTypeSelect = document.getElementById('sourceType');
const micControls = document.getElementById('micControls');
const fileControls = document.getElementById('fileControls');
const urlControls = document.getElementById('urlControls');
const startMicBtn = document.getElementById('startMic');
const stopMicBtn = document.getElementById('stopMic');
const fileInput = document.getElementById('audioFile');
const filePlayer = document.getElementById('filePlayer');
const urlInput = document.getElementById('audioUrl');
const loadUrlBtn = document.getElementById('loadUrl');
const urlPlayer = document.getElementById('urlPlayer');
const simulationToggle = document.getElementById('simulationToggle');
const hublotUrlInput = document.getElementById('hublotUrl');
const applyHublotBtn = document.getElementById('applyHublot');
const alertModeCheckbox = document.getElementById('alertMode');
const nightModeCheckbox = document.getElementById('nightMode');
const bzhModeCheckbox = document.getElementById('bzhMode');
const monitorStyleSelect = document.getElementById('monitorStyle');
const bg3dEnabledCheckbox = document.getElementById('bg3dEnabled');
const shipRateRange = document.getElementById('shipRate');
const shipRateValue = document.getElementById('shipRateValue');

const defaultState = {
  simulation: true,
  hublotSrc: '',
  theme: { alert: false, night: false, bzh: true, monitorStyle: 'default' },
  bg3d: { enabled: true, shipRate: 1 },
};

let panelState = readState();
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let monitorNode = null;
let activeStream = null;
let rafId = null;
const FFT_SIZE = 256;
const FREQ_BINS = 32;
const freqData = new Uint8Array(FFT_SIZE / 2);
const timeData = new Uint8Array(FFT_SIZE);
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

function saveState() {
  panelState = mergeState(panelState);
  try {
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(panelState));
  } catch {}
  channel?.postMessage({ type: 'state', state: panelState });
}

function publishFrame(frame) {
  const payload = { at: Date.now(), frame };
  try {
    localStorage.setItem(PANEL_FRAME_KEY, JSON.stringify(payload));
  } catch {}
  channel?.postMessage({ type: 'audioFrame', frame });
}

function setStatus(text) {
  statusEl.textContent = text;
}

function syncControlsFromState() {
  simulationToggle.checked = !!panelState.simulation;
  hublotUrlInput.value = panelState.hublotSrc || '';
  alertModeCheckbox.checked = !!panelState.theme.alert;
  nightModeCheckbox.checked = !!panelState.theme.night;
  bzhModeCheckbox.checked = !!panelState.theme.bzh;
  monitorStyleSelect.value = panelState.theme.monitorStyle || 'default';
  bg3dEnabledCheckbox.checked = !!panelState.bg3d.enabled;
  shipRateRange.value = String(panelState.bg3d.shipRate || 1);
  shipRateValue.textContent = `${Number(shipRateRange.value).toFixed(1)}×`;
}

function ensureAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function hideAllSourceBlocks() {
  [micControls, fileControls, urlControls].forEach((el) => el.classList.add('hidden'));
}

function startFromStream(stream) {
  ensureAudioContext();
  stopAnalysis();
  activeStream = stream;
  sourceNode = audioCtx.createMediaStreamSource(stream);
  setupAnalyser(false);
}

function startFromAudioElement(audioEl) {
  ensureAudioContext();
  stopAnalysis();
  if (!audioEl.src) {
    setStatus('audio non chargé');
    return;
  }
  if (!audioEl._mediaNode) audioEl._mediaNode = audioCtx.createMediaElementSource(audioEl);
  sourceNode = audioEl._mediaNode;
  setupAnalyser(true);
  audioEl.play();
  setStatus('lecture / analyse en cours');
}

function setupAnalyser(monitorAudio) {
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.8;
  sourceNode.connect(analyser);
  if (monitorAudio) {
    monitorNode = audioCtx.createGain();
    monitorNode.gain.value = 0.9;
    analyser.connect(monitorNode);
    monitorNode.connect(audioCtx.destination);
  }
  loop();
}

function compressArray(src, bins) {
  const out = [];
  const step = Math.max(1, Math.floor(src.length / bins));
  for (let i = 0; i < src.length && out.length < bins; i += step) out.push(src[i]);
  return out;
}

function loop() {
  if (!analyser) return;
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);
  let sum = 0;
  for (let i = 0; i < freqData.length; i++) sum += freqData[i];
  publishFrame({
    level: sum / (freqData.length * 255),
    freqs: compressArray(freqData, FREQ_BINS),
    time: compressArray(timeData, FREQ_BINS),
  });
  rafId = requestAnimationFrame(loop);
}

function stopAnalysis() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  [sourceNode, analyser, monitorNode].forEach((node) => {
    try { node?.disconnect(); } catch {}
  });
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
  }
  sourceNode = null;
  analyser = null;
  monitorNode = null;
  activeStream = null;
}

async function startMic() {
  try {
    if (panelState.simulation) {
      setStatus('mode simulation actif');
      return;
    }
    ensureAudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startFromStream(stream);
    setStatus("micro / entrée en cours d'analyse");
  } catch (err) {
    console.error('Erreur getUserMedia', err);
    setStatus(`erreur micro : ${err.message}`);
  }
}

sourceTypeSelect.addEventListener('change', () => {
  hideAllSourceBlocks();
  stopAnalysis();
  if (sourceTypeSelect.value === 'mic') {
    micControls.classList.remove('hidden');
    setStatus('prêt à démarrer le micro / entrée');
  } else if (sourceTypeSelect.value === 'file') {
    fileControls.classList.remove('hidden');
    setStatus('choisir un fichier audio');
  } else if (sourceTypeSelect.value === 'url') {
    urlControls.classList.remove('hidden');
    setStatus('entrer une URL audio');
  } else {
    setStatus('aucune source');
  }
});

startMicBtn.addEventListener('click', startMic);
stopMicBtn.addEventListener('click', () => {
  stopAnalysis();
  setStatus('analyse arrêtée');
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  filePlayer.src = URL.createObjectURL(file);
  filePlayer.oncanplay = () => {
    if (panelState.simulation) setStatus('mode simulation actif');
    else startFromAudioElement(filePlayer);
  };
});

loadUrlBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) return;
  urlPlayer.crossOrigin = 'anonymous';
  urlPlayer.src = url;
  urlPlayer.oncanplay = () => {
    if (panelState.simulation) setStatus('mode simulation actif');
    else startFromAudioElement(urlPlayer);
  };
});

simulationToggle.addEventListener('change', () => {
  panelState.simulation = simulationToggle.checked;
  saveState();
  if (panelState.simulation) {
    stopAnalysis();
    setStatus('mode simulation activé');
  } else {
    setStatus('mode simulation désactivé');
  }
});

applyHublotBtn.addEventListener('click', () => {
  panelState.hublotSrc = hublotUrlInput.value.trim();
  saveState();
});

function saveTheme() {
  panelState.theme = {
    alert: alertModeCheckbox.checked,
    night: nightModeCheckbox.checked,
    bzh: bzhModeCheckbox.checked,
    monitorStyle: monitorStyleSelect.value,
  };
  saveState();
}

function saveBg3d() {
  panelState.bg3d = {
    enabled: bg3dEnabledCheckbox.checked,
    shipRate: Number(shipRateRange.value || 1),
  };
  shipRateValue.textContent = `${panelState.bg3d.shipRate.toFixed(1)}×`;
  saveState();
}

alertModeCheckbox.addEventListener('change', saveTheme);
nightModeCheckbox.addEventListener('change', saveTheme);
bzhModeCheckbox.addEventListener('change', saveTheme);
monitorStyleSelect.addEventListener('change', saveTheme);
bg3dEnabledCheckbox.addEventListener('change', saveBg3d);
shipRateRange.addEventListener('input', () => {
  shipRateValue.textContent = `${Number(shipRateRange.value || 1).toFixed(1)}×`;
});
shipRateRange.addEventListener('change', saveBg3d);

channel?.addEventListener('message', (event) => {
  if (event.data?.type !== 'state') return;
  panelState = mergeState(event.data.state);
  syncControlsFromState();
});

window.addEventListener('storage', (event) => {
  if (event.key !== PANEL_STATE_KEY) return;
  panelState = readState();
  syncControlsFromState();
});

hideAllSourceBlocks();
syncControlsFromState();
saveState();
setStatus('aucune source');
