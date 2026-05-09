/* ═══════════════════════════════════════════════════════════════
   JUKEBOX v7 — app.js
   Charge records.json + vinyl_styles.json, gère platine,
   vinyle animé, effet lo-fi via Web Audio + Canvas,
   bibliothèque, panel admin super-user.
═══════════════════════════════════════════════════════════════ */

/* ────────────────────────── ÉTAT GLOBAL ────────────────────────── */
let records      = [];
let vinylStyles  = [];
let currentIdx   = -1;
let isPlaying    = false;
let isShuffle    = false;
let isRepeat     = false;
let lofiLevel    = 0;   // 0-100

/* Web Audio */
let audioCtx, sourceNode, gainNode, lofiFilter, lofiConvolver;

/* DOM refs */
const audio       = document.getElementById('audio-el');
const vinylDisc   = document.getElementById('vinyl-disc');
const vinylCanvas = document.getElementById('vinyl-canvas');
const lofiCanvas  = document.getElementById('lofi-canvas');
const tonearm     = document.getElementById('tonearm');
const lTitle      = document.getElementById('label-title');
const lArtist     = document.getElementById('label-artist');
const vinylLabel  = document.getElementById('vinyl-label');
const ctrlTitle   = document.getElementById('ctrl-title');
const ctrlArtist  = document.getElementById('ctrl-artist');
const btnPlay     = document.getElementById('btn-play');
const btnPrev     = document.getElementById('btn-prev');
const btnNext     = document.getElementById('btn-next');
const btnShuffle  = document.getElementById('btn-shuffle');
const btnRepeat   = document.getElementById('btn-repeat');
const seekEl      = document.getElementById('seek');
const curTimeEl   = document.getElementById('curTime');
const durTimeEl   = document.getElementById('durTime');
const volEl       = document.getElementById('vol');
const lofiSlider  = document.getElementById('lofi-slider');
const lofiValue   = document.getElementById('lofi-value');
const shelf       = document.getElementById('shelf');
const libSearch   = document.getElementById('lib-search');
const libCount    = document.getElementById('lib-count');
const adminTab    = document.getElementById('admin-tab');

/* ────────────────────────── INIT ───────────────────────────────── */
async function init() {
  try {
    const [recRes, styRes] = await Promise.all([
      fetch('records.json?v=' + Date.now()),
      fetch('vinyl_styles.json?v=' + Date.now()),
    ]);
    records     = await recRes.json();
    vinylStyles = await styRes.json();
  } catch (e) {
    console.error('Erreur chargement JSON', e);
    records     = [];
    vinylStyles = [];
  }

  // Charger depuis localStorage (admin édits)
  const local = localStorage.getItem('jk_records');
  if (local) {
    try { records = JSON.parse(local); } catch {}
  }

  checkSuperUser();
  renderShelf();
  populateAdminStyleSelect();
  renderAdminTrackList();
  updateJsonExport();
  bindEvents();
  initLofiCanvas();

  // Charger le 1er morceau visible sans jouer
  const first = records.findIndex(r => r.display !== false);
  if (first >= 0) loadTrack(first, false);
}

/* ────────────────────────── SUPER USER ─────────────────────────── */
function checkSuperUser() {
  // Mot de passe super user via URL hash ou localStorage
  const HASH = 'bzhAdmin2025';
  const fromURL   = location.hash === '#' + HASH;
  const fromLocal = localStorage.getItem('jk_superuser') === '1';
  if (fromURL || fromLocal) {
    adminTab.style.display = '';
    localStorage.setItem('jk_superuser', '1');
    if (fromURL) history.replaceState(null, '', location.pathname);
  }
}

/* ────────────────────────── VINYL CANVAS ───────────────────────── */
function drawVinyl(ctx, size, record) {
  const cx = size / 2;
  const r  = size / 2 - 1;
  ctx.clearRect(0, 0, size, size);

  // Base color
  const gc = ctx.createRadialGradient(cx, cx, r * 0.05, cx, cx, r);
  gc.addColorStop(0,   record?.coverColor || '#1a1a2e');
  gc.addColorStop(0.6, colorDarken(record?.coverColor || '#1a1a2e', 0.4));
  gc.addColorStop(1,   '#050508');
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.fillStyle = gc;
  ctx.fill();

  // Grooves (sillons)
  const GROOVES = 28;
  for (let i = 0; i < GROOVES; i++) {
    const rg = r * 0.22 + (r * 0.64) * (i / GROOVES);
    ctx.beginPath();
    ctx.arc(cx, cx, rg, 0, Math.PI * 2);
    const alpha = 0.04 + (i % 3 === 0 ? 0.04 : 0);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // Reflet glossy
  const gr = ctx.createLinearGradient(cx - r * 0.6, cx - r * 0.6, cx + r * 0.2, cx + r * 0.2);
  gr.addColorStop(0,   'rgba(255,255,255,0.08)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0)');
  gr.addColorStop(1,   'rgba(0,0,0,0.15)');
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.fillStyle = gr;
  ctx.fill();

  // Image pochette si disponible — dans le label
  // (le label HTML gère l'affichage du texte)
}

function colorDarken(hex, factor) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.floor(((n >> 16) & 0xff) * (1 - factor)));
  const g = Math.max(0, Math.floor(((n >>  8) & 0xff) * (1 - factor)));
  const b = Math.max(0, Math.floor(((n >>  0) & 0xff) * (1 - factor)));
  return `rgb(${r},${g},${b})`;
}

function renderVinylCanvas(record) {
  const ctx  = vinylCanvas.getContext('2d');
  const size = vinylCanvas.width;
  drawVinyl(ctx, size, record);
}

/* ────────────────────────── LOFI CANVAS ────────────────────────── */
let lofiAnimId = null;
const lofiCtx  = lofiCanvas.getContext('2d');

function initLofiCanvas() {
  lofiCanvas.width  = lofiCanvas.offsetWidth  || 320;
  lofiCanvas.height = lofiCanvas.offsetHeight || 320;
  animateLofi();
}

function animateLofi() {
  lofiAnimId = requestAnimationFrame(animateLofi);
  if (lofiLevel === 0) {
    lofiCtx.clearRect(0, 0, lofiCanvas.width, lofiCanvas.height);
    lofiCanvas.style.opacity = '0';
    return;
  }

  const w = lofiCanvas.width, h = lofiCanvas.height;
  lofiCtx.clearRect(0, 0, w, h);

  const intensity = lofiLevel / 100;
  lofiCanvas.style.opacity = String(intensity * 0.55);

  // GRAIN
  const imageData = lofiCtx.createImageData(w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() > (1 - intensity * 0.6) ? Math.floor(Math.random() * 200) : 0;
    data[i]   = v;
    data[i+1] = v;
    data[i+2] = v;
    data[i+3] = v > 0 ? Math.floor(v * 0.6) : 0;
  }
  lofiCtx.putImageData(imageData, 0, 0);

  // SCRATCHES (lignes verticales aléatoires)
  if (intensity > 0.3 && Math.random() < intensity * 0.15) {
    const x = Math.random() * w;
    const len = 20 + Math.random() * 60;
    const y = Math.random() * h;
    lofiCtx.strokeStyle = `rgba(255,255,220,${Math.random() * 0.4 * intensity})`;
    lofiCtx.lineWidth = Math.random() < 0.5 ? 1 : 0.5;
    lofiCtx.beginPath();
    lofiCtx.moveTo(x, y);
    lofiCtx.lineTo(x + (Math.random() - 0.5) * 4, y + len);
    lofiCtx.stroke();
  }

  // Vignette WARM (amber) sur les bords
  const rad = lofiCtx.createRadialGradient(w/2, h/2, w*0.3, w/2, h/2, w*0.7);
  rad.addColorStop(0,   'transparent');
  rad.addColorStop(1,   `rgba(80, 50, 0, ${intensity * 0.3})`);
  lofiCtx.fillStyle = rad;
  lofiCtx.fillRect(0, 0, w, h);
}

/* ────────────────────────── WEB AUDIO LOFI ─────────────────────── */
function setupAudioCtx() {
  if (audioCtx) return;
  audioCtx     = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode   = audioCtx.createMediaElementSource(audio);
  gainNode     = audioCtx.createGain();
  lofiFilter   = audioCtx.createBiquadFilter();
  lofiFilter.type = 'lowpass';
  lofiFilter.frequency.value = 20000; // starts clean

  // Distortion léger
  const distortion = audioCtx.createWaveShaper();
  distortion.curve = makeDistortionCurve(0);
  distortion.oversample = '2x';

  sourceNode.connect(lofiFilter);
  lofiFilter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Stocker distortion pour update
  audioCtx._distortion = distortion;
  audioCtx._lofiFilter = lofiFilter;
  audioCtx._gainNode   = gainNode;
}

function makeDistortionCurve(amount) {
  const n = 256, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = amount === 0 ? x : ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function applyLofiAudio(level) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const intensity = level / 100;
  // Cutoff : clean 20kHz → lofi 800Hz
  const freq = 20000 - intensity * 19200;
  audioCtx._lofiFilter.frequency.setTargetAtTime(freq, t, 0.1);
  // Legère réduction de gain
  audioCtx._gainNode.gain.setTargetAtTime(1 - intensity * 0.1, t, 0.1);
}

/* ────────────────────────── LOAD TRACK ─────────────────────────── */
function loadTrack(idx, autoPlay = true) {
  if (idx < 0 || idx >= records.length) return;
  currentIdx = idx;
  const rec = records[idx];

  // Audio source
  audio.src = rec.src;
  audio.load();

  // Vinyl canvas
  renderVinylCanvas(rec);

  // Label
  lTitle.textContent        = rec.title  || '';
  lArtist.textContent       = rec.artist || '';
  vinylLabel.style.setProperty('--label-bg', rec.labelColor || '#1a0a2e');

  // Controls
  ctrlTitle.textContent  = rec.title  || '—';
  ctrlArtist.textContent = rec.artist || '—';

  // Shelf highlight
  document.querySelectorAll('.vinyl-card').forEach((c, i) => {
    c.classList.toggle('active', i === idx);
  });

  // Tonearm
  tonearm.classList.add('on-record');

  if (autoPlay) playTrack();
  else pauseTrack();

  // RPM speed based on genre/style (cosmetic)
  vinylDisc.style.setProperty('--rpm-duration', '1.8s');
}

function playTrack() {
  setupAudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audio.play().catch(() => {});
  isPlaying = true;
  vinylDisc.classList.add('spinning');
  vinylDisc.classList.remove('slowing');
  btnPlay.innerHTML = '⏸';
  btnPlay.classList.add('playing');
  tonearm.classList.add('on-record');
}

function pauseTrack() {
  audio.pause();
  isPlaying = false;
  vinylDisc.classList.remove('spinning');
  vinylDisc.classList.add('slowing');
  btnPlay.innerHTML = '▶';
  btnPlay.classList.remove('playing');
  setTimeout(() => vinylDisc.classList.remove('slowing'), 1200);
}

function nextTrack() {
  if (records.length === 0) return;
  let next;
  if (isShuffle) {
    do { next = Math.floor(Math.random() * records.length); } while (next === currentIdx && records.length > 1);
  } else {
    next = (currentIdx + 1) % records.length;
  }
  loadTrack(next, true);
}

function prevTrack() {
  if (records.length === 0) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const prev = (currentIdx - 1 + records.length) % records.length;
  loadTrack(prev, true);
}

/* ────────────────────────── TIMEBAR ────────────────────────────── */
function formatTime(s) {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  seekEl.value = (audio.currentTime / audio.duration) * 100;
  curTimeEl.textContent = formatTime(audio.currentTime);
  durTimeEl.textContent = formatTime(audio.duration);
});

audio.addEventListener('loadedmetadata', () => {
  durTimeEl.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', () => {
  if (isRepeat) { audio.currentTime = 0; audio.play(); }
  else nextTrack();
});

/* ────────────────────────── SHELF ──────────────────────────────── */
function renderShelf(filter = '') {
  const visible = records.filter(r =>
    r.display !== false &&
    (!filter || r.title.toLowerCase().includes(filter) || r.artist.toLowerCase().includes(filter))
  );
  libCount.textContent = `(${visible.length})`;

  shelf.innerHTML = '';
  visible.forEach(rec => {
    const realIdx = records.indexOf(rec);
    const card = document.createElement('div');
    card.className = 'vinyl-card' + (realIdx === currentIdx ? ' active' : '');
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${rec.title} – ${rec.artist}`);
    card.innerHTML = `
      <div class="card-cover">
        ${rec.coverImage
          ? `<img src="${rec.coverImage}" alt="${rec.title}" width="200" height="200" loading="lazy">`
          : `<canvas class="card-cover-canvas" width="200" height="200"></canvas>`
        }
        <canvas class="card-mini-vinyl" width="80" height="80"></canvas>
        <span class="card-playing">▶ EN COURS</span>
      </div>
      <div class="card-info">
        <div class="card-title">${rec.title}</div>
        <div class="card-artist">${rec.artist}</div>
      </div>
    `;
    // Draw cover fallback
    if (!rec.coverImage) {
      const cvs = card.querySelector('.card-cover-canvas');
      if (cvs) drawVinyl(cvs.getContext('2d'), 200, rec);
    }
    // Draw mini vinyl
    const mv = card.querySelector('.card-mini-vinyl');
    if (mv) drawVinyl(mv.getContext('2d'), 80, rec);

    card.addEventListener('click', () => {
      loadTrack(realIdx, true);
      // Switch to player tab
      switchTab('player');
    });
    shelf.appendChild(card);
  });
}

/* ────────────────────────── ADMIN ──────────────────────────────── */
function populateAdminStyleSelect() {
  const sel = document.getElementById('f-vinyl-style');
  sel.innerHTML = vinylStyles.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
}

function renderAdminTrackList() {
  const list = document.getElementById('admin-track-list');
  const cnt  = document.getElementById('admin-track-count');
  cnt.textContent = `(${records.length})`;
  list.innerHTML = records.map((r, i) => `
    <div class="admin-track-item">
      <span class="atr-color" style="background:${r.coverColor || '#888'}"></span>
      <span class="atr-title">${r.title}</span>
      <span class="atr-artist">${r.artist}</span>
      <button class="atr-del" data-idx="${i}" aria-label="Supprimer ${r.title}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.atr-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      records.splice(idx, 1);
      saveRecords();
      renderAdminTrackList();
      renderShelf();
      updateJsonExport();
    });
  });
}

function saveRecords() {
  localStorage.setItem('jk_records', JSON.stringify(records));
}

function updateJsonExport() {
  const el = document.getElementById('json-export');
  if (el) el.value = JSON.stringify(records, null, 2);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ────────────────────────── PREVIEW VINYL (admin) ─────────────────*/
function updatePreview() {
  const cvs   = document.getElementById('preview-canvas');
  if (!cvs) return;
  const color = document.getElementById('f-cover-color').value;
  const label = document.getElementById('f-label-color').value;
  drawVinyl(cvs.getContext('2d'), 120, { coverColor: color, labelColor: label });
}

/* ────────────────────────── TABS ───────────────────────────────── */
function switchTab(name) {
  document.querySelectorAll('.jk-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}

/* ────────────────────────── BIND EVENTS ────────────────────────── */
function bindEvents() {
  // Tabs
  document.querySelectorAll('.jk-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Transport
  btnPlay.addEventListener('click', () => {
    if (currentIdx < 0 && records.length > 0) { loadTrack(0, true); return; }
    isPlaying ? pauseTrack() : playTrack();
  });
  btnPrev.addEventListener('click', prevTrack);
  btnNext.addEventListener('click', nextTrack);
  btnShuffle.addEventListener('click', () => {
    isShuffle = !isShuffle;
    btnShuffle.classList.toggle('active', isShuffle);
  });
  btnRepeat.addEventListener('click', () => {
    isRepeat = !isRepeat;
    btnRepeat.classList.toggle('active', isRepeat);
  });

  // Seek
  seekEl.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (seekEl.value / 100) * audio.duration;
  });

  // Volume
  volEl.addEventListener('input', () => {
    audio.volume = volEl.value;
  });

  // LOFI SLIDER
  lofiSlider.addEventListener('input', () => {
    lofiLevel = parseInt(lofiSlider.value);
    lofiValue.textContent = lofiLevel + '%';
    applyLofiAudio(lofiLevel);
    // Enlever preset actif
    document.querySelectorAll('.preset-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.val) === lofiLevel);
    });
  });

  // PRESETS
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.val);
      lofiLevel = val;
      lofiSlider.value = val;
      lofiValue.textContent = val + '%';
      applyLofiAudio(val);
      document.querySelectorAll('.preset-btn').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
    });
  });

  // Library search
  libSearch.addEventListener('input', () => {
    renderShelf(libSearch.value.trim().toLowerCase());
  });

  // Admin — ADD FORM
  const form = document.getElementById('add-track-form');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const title  = document.getElementById('f-title').value.trim();
    const artist = document.getElementById('f-artist').value.trim();
    const src    = document.getElementById('f-src').value.trim();
    if (!title || !artist || !src) {
      showFeedback('Titre, artiste et fichier audio sont requis.', 'err');
      return;
    }
    const rec = {
      id:          slugify(title),
      title,
      artist,
      src,
      coverImage:  document.getElementById('f-cover').value.trim() || null,
      coverColor:  document.getElementById('f-cover-color').value,
      labelColor:  document.getElementById('f-label-color').value,
      vinylStyle:  document.getElementById('f-vinyl-style').value,
      tags:        document.getElementById('f-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      bpm:         parseInt(document.getElementById('f-bpm').value) || 0,
      display:     true,
    };
    records.push(rec);
    saveRecords();
    renderShelf();
    renderAdminTrackList();
    updateJsonExport();
    showFeedback(`✦ "${title}" ajouté avec succès !`, 'ok');
    form.reset();
    updatePreview();
  });

  // Preview colors
  document.getElementById('f-cover-color')?.addEventListener('input', updatePreview);
  document.getElementById('f-label-color')?.addEventListener('input', updatePreview);
  updatePreview();

  // Copy JSON
  document.getElementById('btn-copy-json')?.addEventListener('click', () => {
    const el = document.getElementById('json-export');
    el.select();
    document.execCommand('copy');
    const btn = document.getElementById('btn-copy-json');
    btn.textContent = '✓ COPIÉ';
    setTimeout(() => btn.textContent = '⎘ COPIER', 2000);
  });
}

function showFeedback(msg, type) {
  const el = document.getElementById('form-feedback');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'form-feedback ' + type;
  setTimeout(() => { el.textContent = ''; el.className = 'form-feedback'; }, 4000);
}

/* ────────────────────────── BOOT ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
