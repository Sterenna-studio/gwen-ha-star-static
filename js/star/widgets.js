/**
 * widgets.js — Widgets autonomes réutilisables pour le hub star/
 * VideoDay    : embed YouTube/PeerTube depuis Supabase table daily_content
 * RadioPlayer : lecteur des musiques du Jukebox (records.json) + visualiseur canvas
 * SlotMachine : machine à sous 5×3 avec rouleaux visuels, pixel art PP+véhicules,
 *               boutons stop individuels, popup bienvenue Muten, panel crédits
 */
import { supabase } from '../supabase.js';

// ── SOUND ENGINE (Web Audio API, aucune dépendance) ─────────────────────────────────
const _sfx = {
  _ctx: null,
  _get() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },
  _tone(freq, type, vol, attack, decay, t0) {
    const ctx = this._get(); if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0 ?? ctx.currentTime);
    gain.gain.setValueAtTime(0, t0 ?? ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol,  (t0 ?? ctx.currentTime) + attack);
    gain.gain.linearRampToValueAtTime(0,    (t0 ?? ctx.currentTime) + attack + decay);
    osc.start(t0 ?? ctx.currentTime);
    osc.stop((t0 ?? ctx.currentTime) + attack + decay + 0.01);
  },
  _noise(vol, dur, t0) {
    const ctx = this._get(); if (!ctx) return;
    const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf; src.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(vol, t0 ?? ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, (t0 ?? ctx.currentTime) + dur);
    src.start(t0 ?? ctx.currentTime);
  },

  click()  { this._tone(880,  'sine',     0.08, 0.005, 0.06); },
  hover()  { this._tone(1200, 'sine',     0.04, 0.003, 0.04); },
  nav()    { this._tone(660,  'triangle', 0.07, 0.005, 0.08); },
  tick()   { this._noise(0.06, 0.025); this._tone(1400, 'square', 0.03, 0.002, 0.018); },

  reel_stop(idx) {
    const freqs = [440, 390, 340, 294, 260];
    this._tone(freqs[idx] ?? 440, 'triangle', 0.10, 0.005, 0.15);
    this._noise(0.04, 0.04);
  },

  lever() {
    const ctx = this._get(); if (!ctx) return;
    [200, 180, 160, 140].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.06;
      this._tone(f, 'sawtooth', 0.06, 0.01, 0.05, t);
    });
    this._noise(0.05, 0.3);
  },

  win() {
    const ctx = this._get(); if (!ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.09;
      this._tone(f, 'triangle', 0.10, 0.01, 0.14, t);
    });
  },

  super_win() {
    const ctx = this._get(); if (!ctx) return;
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.07;
      this._tone(f, 'square', 0.08, 0.01, 0.16, t);
    });
  },

  jackpot() {
    const ctx = this._get(); if (!ctx) return;
    const melody = [523, 659, 784, 1047, 784, 1047, 1319, 1047, 1319, 1568];
    melody.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.06;
      this._tone(f, i % 2 === 0 ? 'square' : 'triangle', 0.09, 0.005, 0.10, t);
    });
    this._noise(0.08, 0.6);
  },

  chronicles() {
    const ctx = this._get(); if (!ctx) return;
    const freqs = [880, 740, 622, 523, 415, 349, 294, 247];
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.08;
      this._tone(f, 'sine', 0.09, 0.01, 0.22, t);
      this._tone(f * 2, 'triangle', 0.03, 0.005, 0.15, t + 0.02);
    });
    this._tone(55, 'sawtooth', 0.12, 0.05, 0.8);
    this._noise(0.04, 1.0);
  },

  lose() {
    const ctx = this._get(); if (!ctx) return;
    [330, 280, 220].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.12;
      this._tone(f, 'sawtooth', 0.07, 0.01, 0.18, t);
    });
  },

  boot() {
    [440, 550, 660].forEach((f, i) =>
      setTimeout(() => this._tone(f, 'sine', 0.06, 0.01, 0.10), i * 100));
  },

  coin() {
    const ctx = this._get(); if (!ctx) return;
    this._tone(1200, 'sine', 0.07, 0.003, 0.04);
    this._tone(1600, 'sine', 0.05, 0.003, 0.04, ctx.currentTime + 0.05);
  },

  welcome() {
    const ctx = this._get(); if (!ctx) return;
    // Fanfare courte montante
    [330, 415, 523, 659, 784, 1047].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.07;
      this._tone(f, i % 2 === 0 ? 'triangle' : 'sine', 0.08, 0.005, 0.18, t);
    });
    this._noise(0.03, 0.5);
  },
};
export const SFX = _sfx;

// ── VIDEO DU JOUR ───────────────────────────────────────────────────────────────────
export class VideoDay {
  constructor(containerId) {
    this.el = document.getElementById(containerId);
  }

  async load() {
    if (!this.el) return;
    try {
      const { data, error } = await supabase
        .from('daily_content')
        .select('title, url, platform, note')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) { this._renderEmpty(); return; }
      this._renderVideo(data);
    } catch { this._renderEmpty(); }
  }

  _embedUrl(platform, url) {
    if (platform === 'youtube') {
      const id = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)(\S{11})/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
    }
    if (platform === 'peertube') return url.replace('/watch/', '/embed/');
    return null;
  }

  _renderVideo({ title, url, platform, note }) {
    const embed = this._embedUrl(platform, url);
    if (!embed) { this._renderEmpty(); return; }
    this.el.innerHTML = `
      <div class="widget-video-inner">
        <div class="widget-video-title">${title ?? ''}</div>
        <div class="video-embed-wrap">
          <iframe src="${embed}" allowfullscreen loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="${title ?? 'Vidéo du jour'}"></iframe>
        </div>
        ${note ? `<div class="widget-video-note">${note}</div>` : ''}
      </div>`;
  }

  _renderEmpty() {
    this.el.innerHTML = `
      <div class="widget-empty">
        <span class="widget-empty-icon">▶</span>
        <p>Aucune vidéo aujourd'hui</p>
        <span class="widget-empty-sub">DAILY_CONTENT · OFFLINE</span>
      </div>`;
  }
}

// ── WEB RADIO ────────────────────────────────────────────────────────────────────────
export class RadioPlayer {
  constructor(containerId) {
    this.el       = document.getElementById(containerId);
    this.tracks   = [];
    this.idx      = 0;
    this.audio    = new Audio();
    this.audio.volume = 0.6;
    this._animId  = null;
    this._ctx     = null;
    this._analyser= null;
    this._src     = null;
  }

  async render() {
    if (!this.el) return;
    this.el.innerHTML = `
      <div class="radio-player">
        <div class="radio-top">
          <div class="radio-status">
            <span class="radio-led" id="radio-led"></span>
            <span class="radio-station" id="radio-station">CHARGEMENT...</span>
          </div>
          <select class="radio-select" id="radio-playlist"></select>
        </div>
        <canvas class="radio-viz" id="radio-viz" width="400" height="36"></canvas>
        <div class="jk-track-row">
          <div class="jk-cover" id="jk-cover"><span class="jk-cover-fallback">♪</span></div>
          <div class="jk-info">
            <span class="jk-artist" id="jk-artist">—</span>
            <span class="jk-title"  id="jk-title">Choisir une piste</span>
            <span class="jk-badge"  id="jk-badge">JUKEBOX</span>
          </div>
        </div>
        <div class="jk-progress-wrap">
          <span class="jk-time" id="jk-cur">0:00</span>
          <input class="jk-seek" id="jk-seek" type="range" min="0" max="100" value="0" step="0.1">
          <span class="jk-time" id="jk-dur">0:00</span>
        </div>
        <div class="radio-controls">
          <button class="radio-btn radio-btn-sm" id="radio-prev" aria-label="Précédent">◀</button>
          <button class="radio-btn" id="radio-play" aria-label="Lecture">▶</button>
          <button class="radio-btn radio-btn-sm" id="radio-next" aria-label="Suivant">▶▶</button>
          <div class="radio-vol-wrap">
            <span class="radio-vol-icon">♪</span>
            <input class="radio-vol" id="radio-vol" type="range" min="0" max="1" step="0.01" value="0.6">
          </div>
        </div>
      </div>`;

    await this._loadTracks();
    this._bindEvents();
    this._vizLoop();
  }

  async _loadTracks() {
    try {
      const res = await fetch('/data/records.json');
      const json = await res.json();
      this.tracks = Array.isArray(json) ? json : (json.tracks ?? []);
    } catch { this.tracks = []; }
    this._buildPlaylist();
    if (this.tracks.length) this._loadTrack(0);
  }

  _buildPlaylist() {
    const sel = document.getElementById('radio-playlist');
    if (!sel) return;
    sel.innerHTML = this.tracks.length
      ? this.tracks.map((t, i) => `<option value="${i}">${t.artist ?? ''} – ${t.title ?? t.file}</option>`).join('')
      : '<option>Aucun titre</option>';
  }

  _loadTrack(i) {
    if (!this.tracks.length) return;
    this.idx = ((i % this.tracks.length) + this.tracks.length) % this.tracks.length;
    const t = this.tracks[this.idx];
    this.audio.src = t.file ?? t.url ?? '';
    this.audio.load();
    const titleEl  = document.getElementById('jk-title');
    const artistEl = document.getElementById('jk-artist');
    const badgeEl  = document.getElementById('jk-badge');
    const coverEl  = document.getElementById('jk-cover');
    const stEl     = document.getElementById('radio-station');
    const selEl    = document.getElementById('radio-playlist');
    if (titleEl)  titleEl.textContent  = t.title  ?? t.file ?? '—';
    if (artistEl) artistEl.textContent = t.artist ?? '—';
    if (badgeEl)  badgeEl.textContent  = t.genre  ?? 'JUKEBOX';
    if (stEl)     stEl.textContent     = `STAR · ${(t.artist ?? 'UNKNOWN').toUpperCase()}`;
    if (selEl)    selEl.value = String(this.idx);
    if (coverEl) {
      coverEl.innerHTML = t.cover
        ? `<img src="${t.cover}" alt="Cover ${t.title ?? ''}" width="48" height="48" loading="lazy">`
        : '<span class="jk-cover-fallback">♪</span>';
      coverEl.style.setProperty('--jk-c1', t.color1 ?? '#14161a');
      coverEl.style.setProperty('--jk-c2', t.color2 ?? '#050608');
    }
    const seekEl = document.getElementById('jk-seek');
    if (seekEl) seekEl.value = 0;
  }

  _bindEvents() {
    const playBtn = document.getElementById('radio-play');
    const prevBtn = document.getElementById('radio-prev');
    const nextBtn = document.getElementById('radio-next');
    const volEl   = document.getElementById('radio-vol');
    const seekEl  = document.getElementById('jk-seek');
    const selEl   = document.getElementById('radio-playlist');
    const ledEl   = document.getElementById('radio-led');

    playBtn?.addEventListener('click', () => {
      _sfx.click();
      if (this.audio.paused) { this._ensureAudioCtx(); this.audio.play(); }
      else this.audio.pause();
    });
    prevBtn?.addEventListener('click', () => { _sfx.nav(); this._loadTrack(this.idx - 1); this.audio.play(); });
    nextBtn?.addEventListener('click', () => { _sfx.nav(); this._loadTrack(this.idx + 1); this.audio.play(); });
    volEl?.addEventListener('input',  () => { this.audio.volume = parseFloat(volEl.value); });
    seekEl?.addEventListener('input', () => {
      if (this.audio.duration) this.audio.currentTime = (parseFloat(seekEl.value) / 100) * this.audio.duration;
    });
    selEl?.addEventListener('change', () => { this._loadTrack(parseInt(selEl.value)); this.audio.play(); });

    this.audio.addEventListener('play',  () => { if (playBtn) playBtn.textContent = '⏸'; if (ledEl) ledEl.classList.add('active'); });
    this.audio.addEventListener('pause', () => { if (playBtn) playBtn.textContent = '▶'; if (ledEl) ledEl.classList.remove('active'); });
    this.audio.addEventListener('ended', () => { this._loadTrack(this.idx + 1); this.audio.play(); });
    this.audio.addEventListener('timeupdate', () => {
      const cur = document.getElementById('jk-cur');
      const dur = document.getElementById('jk-dur');
      const sk  = document.getElementById('jk-seek');
      const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
      if (cur) cur.textContent = fmt(this.audio.currentTime);
      if (dur) dur.textContent = fmt(this.audio.duration || 0);
      if (sk && this.audio.duration) sk.value = (this.audio.currentTime / this.audio.duration) * 100;
    });
  }

  _ensureAudioCtx() {
    if (this._ctx) return;
    try {
      this._ctx     = new (window.AudioContext || window.webkitAudioContext)();
      this._analyser= this._ctx.createAnalyser();
      this._analyser.fftSize = 128;
      this._src     = this._ctx.createMediaElementSource(this.audio);
      this._src.connect(this._analyser);
      this._analyser.connect(this._ctx.destination);
    } catch { this._ctx = null; }
  }

  _vizLoop() {
    const canvas = document.getElementById('radio-viz');
    if (!canvas) return;
    const ctx2 = canvas.getContext('2d');
    const draw = () => {
      this._animId = requestAnimationFrame(draw);
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      if (!this._analyser || this.audio.paused) {
        ctx2.fillStyle = 'rgba(0,255,128,0.06)';
        ctx2.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
        return;
      }
      const buf = new Uint8Array(this._analyser.frequencyBinCount);
      this._analyser.getByteFrequencyData(buf);
      const w = canvas.width / buf.length;
      buf.forEach((v, i) => {
        const h = (v / 255) * canvas.height;
        ctx2.fillStyle = `rgba(0,255,128,${0.2 + (v/255)*0.7})`;
        ctx2.fillRect(i * w, canvas.height - h, w - 1, h);
      });
    };
    draw();
  }
}

// ── SLOT MACHINE 5×3 ────────────────────────────────────────────────────────────────
// Grille  : 3 LIGNES visibles × 5 COLONNES (rouleaux verticaux)
// Symboles: PP pixel art (crew) + véhicules — aucun emoji
// Lignes de gain :
//   L0 : milieu     [row 1] — toutes colonnes
//   L1 : haut       [row 0] — toutes colonnes
//   L2 : bas        [row 2] — toutes colonnes
//   L3 : diag ↘     rows: [0,1,1,1,2]
//   L4 : diag ↗     rows: [2,1,1,1,0]
// Commandes : SPIN global + 5 boutons STOP individuels par colonne
// Bienvenue : popup Muten offre 1000 crédits au premier login

export class SlotMachine {
  // Chemin de base des assets (relatif à la page star/index.html)
  static IMG_BASE = '../shared/images';

  // Symboles 100% images — PP pixel et véhicules
  static SYMBOLS = [
    // ── PP Crew — jackpots absolus (×50) ──
    { id: 'pp_sniky',   name: 'SNIKY',      img: 'pixel_pp/pixel_pp_sniky.png',   mult: 50, rare: 1, type: 'pp',      color: '#f87171' },
    { id: 'pp_aligax',  name: 'ALIGAX',     img: 'pixel_pp/pixel_pp_aligax.png',  mult: 50, rare: 1, type: 'pp',      color: '#34d399' },
    { id: 'pp_cowboy',  name: 'COWBOY',     img: 'pixel_pp/pixel_pp_cowboy.png',  mult: 40, rare: 1, type: 'pp',      color: '#ffd700' },
    { id: 'pp_abad',    name: 'ABAD',       img: 'pixel_pp/pixel_pp_abad.png',    mult: 40, rare: 1, type: 'pp',      color: '#a78bfa' },
    { id: 'pp_spirit',  name: 'SPIRIT',     img: 'pixel_pp/pixel_pp_spirit.png',  mult: 30, rare: 2, type: 'pp',      color: '#60a5fa' },
    // ── Véhicules — gains classiques ──
    { id: 'mash',       name: 'MASH',       img: 'vehicule/mash.png',             mult: 20, rare: 3, type: 'vehicule', color: '#fbbf24' },
    { id: 'barossa',    name: 'BAROSSA',    img: 'vehicule/barossa.png',          mult: 12, rare: 5, type: 'vehicule', color: '#f97316' },
    { id: 'citroenax',  name: 'CITROEN AX', img: 'vehicule/citroenAX.png',        mult: 6,  rare: 9, type: 'vehicule', color: '#ef4444' },
  ];

  static WIN_LINES = [
    { id: 'L0', name: 'MILIEU',  rows: [1,1,1,1,1], color: '#00ff80' },
    { id: 'L1', name: 'HAUT',    rows: [0,0,0,0,0], color: '#60a5fa' },
    { id: 'L2', name: 'BAS',     rows: [2,2,2,2,2], color: '#f97316' },
    { id: 'L3', name: 'DIAG ↘', rows: [0,1,1,1,2], color: '#a78bfa' },
    { id: 'L4', name: 'DIAG ↗', rows: [2,1,1,1,0], color: '#f472b6' },
  ];

  static COLS = 5;
  static ROWS = 3;
  static REEL_SIZE = 20; // symboles par rouleau (bande virtuelle)
  static WELCOME_CREDITS = 1000;
  static WELCOME_KEY = 'slot_muten_welcomed'; // localStorage key (pour info UI seulement, état réel = Supabase)

  constructor(containerId, opts = {}) {
    this.el        = document.getElementById(containerId);
    this.bet       = opts.bet ?? 5;
    this.userId    = opts.userId ?? null;
    this.credits   = 0; // sera remplacé par Supabase
    this.spinning  = false;
    this._isNew    = false; // premier login → popup
    // Grille résultat [col][row]
    this._grid     = Array.from({ length: SlotMachine.COLS }, () => Array(SlotMachine.ROWS).fill(null));
    // État rouleau [col] → stopped?
    this._colStopped = Array(SlotMachine.COLS).fill(false);
    // Intervalle animation [col]
    this._reelAnim = Array(SlotMachine.COLS).fill(null);
    // Offset visuel de chaque rouleau (px translateY)
    this._reelOffset = Array(SlotMachine.COLS).fill(0);
    // Pool pondéré pré-calculé
    this._pool = this._buildPool();
  }

  // ── Init ──────────────────────────────────────────────────────────────
  async init(userId) {
    if (userId) this.userId = userId;
    await this._loadCredits();
    this._render();
    _sfx.boot();
    // Afficher la popup de bienvenue si c'est un nouveau compte
    if (this._isNew) {
      setTimeout(() => this._showWelcomePopup(), 800);
    }
  }

  // ── Supabase : charger les crédits ────────────────────────────────────
  async _loadCredits() {
    if (!this.userId) { this.credits = 100; return; }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('chronicles')
        .eq('id', this.userId)
        .single();
      if (!error && data != null) {
        const stored = data.chronicles;
        if (stored === null || stored === undefined || stored === 0) {
          // Nouveau joueur : offrir les 1000 crédits de Muten
          this.credits = SlotMachine.WELCOME_CREDITS;
          this._isNew = true;
          await this._saveCredits();
        } else {
          this.credits = stored;
        }
      } else {
        this.credits = 100;
      }
    } catch { this.credits = 100; }
  }

  // ── Supabase : sauvegarder les crédits ────────────────────────────────
  async _saveCredits() {
    if (!this.userId) return;
    try {
      await supabase
        .from('profiles')
        .update({ chronicles: this.credits })
        .eq('id', this.userId);
    } catch { /* silencieux */ }
  }

  // ── Pool pondéré ──────────────────────────────────────────────────────
  _buildPool() {
    const pool = [];
    for (const sym of SlotMachine.SYMBOLS)
      for (let i = 0; i < sym.rare; i++) pool.push(sym);
    return pool;
  }

  _roll() {
    return this._pool[Math.floor(Math.random() * this._pool.length)];
  }

  // ── Évaluation des lignes ──────────────────────────────────────────────
  _evaluate() {
    const results = [];
    for (const line of SlotMachine.WIN_LINES) {
      const syms = line.rows.map((row, col) => this._grid[col][row]);
      if (!syms[0]) continue;
      if (syms.every(s => s?.id === syms[0].id)) {
        results.push({ line, syms, count: 5, mult: syms[0].mult * 3 }); continue;
      }
      if (syms.slice(0,4).every(s => s?.id === syms[0].id)) {
        results.push({ line, syms: syms.slice(0,4), count: 4, mult: syms[0].mult * 2 }); continue;
      }
      const last4 = syms.slice(1);
      if (last4[0] && last4.every(s => s?.id === last4[0].id)) {
        results.push({ line, syms: last4, count: 4, mult: last4[0].mult * 2 }); continue;
      }
      for (let i = 0; i <= 2; i++) {
        const sub = syms.slice(i, i+3);
        if (sub[0] && sub.every(s => s?.id === sub[0].id)) {
          results.push({ line, syms: sub, count: 3, mult: sub[0].mult }); break;
        }
      }
    }
    return results;
  }

  // ── Spin principal ─────────────────────────────────────────────────────
  async spin() {
    if (this.spinning) return;
    if (this.credits < this.bet) { this._setMsg('CREDITS INSUFFISANTS', 'red'); return; }

    this.spinning = true;
    this.credits -= this.bet;
    this._updateCredits();
    _sfx.lever();
    this._setMsg('...', '');
    this._clearLines();

    // Réinitialiser l'état des colonnes
    this._colStopped = Array(SlotMachine.COLS).fill(false);

    // Activer les boutons stop + désactiver spin
    const spinBtn = document.getElementById('slot-spin');
    if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = 'SPINNING...'; }
    for (let col = 0; col < SlotMachine.COLS; col++) {
      const stopBtn = document.getElementById(`slot-stop-${col}`);
      if (stopBtn) { stopBtn.disabled = false; stopBtn.classList.add('slot-stop-btn--active'); }
    }

    // Lancer le défilement visuel de chaque rouleau
    for (let col = 0; col < SlotMachine.COLS; col++) {
      this._startReelAnim(col);
    }

    // Auto-stop progressif si le joueur ne stoppe pas manuellement
    for (let col = 0; col < SlotMachine.COLS; col++) {
      // Délai auto par colonne (1.2s + 0.6s par colonne)
      setTimeout(() => {
        if (!this._colStopped[col]) this._stopCol(col);
      }, 1200 + col * 600);
    }

    // Attendre que toutes les colonnes soient stoppées
    await this._waitAllStopped();
    await new Promise(r => setTimeout(r, 200));

    // Évaluation
    const wins = this._evaluate();
    let totalGain = 0;
    let hasPP = false;

    for (const w of wins) {
      totalGain += this.bet * w.mult;
      if (w.syms[0]?.type === 'pp') hasPP = true;
      this._drawLine(w.line, w.syms, w.count);
    }

    if (totalGain > 0) {
      this.credits += totalGain;
      this._updateCredits(true);
      if (hasPP && wins.some(w => w.count === 5)) {
        _sfx.jackpot();
        const sym = wins.find(w => w.syms[0]?.type === 'pp')?.syms[0];
        this._setMsg(`JACKPOT PP ${sym?.name ?? ''} x${(sym?.mult ?? 0)*3} — +${totalGain} C`, 'jackpot');
        this._flashGrid('gold');
      } else if (totalGain >= this.bet * 20) {
        _sfx.super_win();
        this._setMsg(`SUPER WIN x${Math.round(totalGain/this.bet)} — +${totalGain} C`, 'jackpot');
        this._flashGrid('gold');
      } else {
        _sfx.win();
        this._setMsg(`+${totalGain} C — ${wins.map(w => w.line.name).join(', ')}`, 'win');
      }
      for (const w of wins) {
        w.line.rows.forEach((row, col) => {
          if (w.count < 5 && col >= w.count) return;
          const cell = this._getCell(col, row);
          cell?.classList.add('slot-cell--win');
          setTimeout(() => cell?.classList.remove('slot-cell--win'), 1800);
        });
      }
    } else {
      _sfx.lose();
      this._setMsg('—', 'lose');
    }

    // Reset boutons
    if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = 'SPIN'; }
    for (let col = 0; col < SlotMachine.COLS; col++) {
      const stopBtn = document.getElementById(`slot-stop-${col}`);
      if (stopBtn) { stopBtn.disabled = true; stopBtn.classList.remove('slot-stop-btn--active'); }
    }

    this._updateGain(totalGain);
    await this._saveCredits();
    this.spinning = false;
  }

  // ── Animation rouleau (défilement vertical) ───────────────────────────
  _startReelAnim(col) {
    const CELL_H = this._getCellHeight();
    let offset = 0;
    const reel = document.getElementById(`slot-reel-inner-${col}`);
    if (!reel) return;

    // Vitesse variable : plus rapide pour les dernières colonnes
    const speed = 8 + col * 1.5;

    const frame = () => {
      if (this._colStopped[col]) return;
      offset = (offset + speed) % (CELL_H * SlotMachine.REEL_SIZE);
      reel.style.transform = `translateY(${-offset}px)`;
      this._reelOffset[col] = offset;
      this._reelAnim[col] = requestAnimationFrame(frame);
    };
    this._reelAnim[col] = requestAnimationFrame(frame);
  }

  _getCellHeight() {
    const reel = document.getElementById('slot-reel-inner-0');
    if (!reel) return 60;
    const cell = reel.querySelector('.slot-reel-item');
    return cell ? cell.offsetHeight : 60;
  }

  // ── Stop d'une colonne ────────────────────────────────────────────────
  _stopCol(col) {
    if (this._colStopped[col]) return;
    this._colStopped[col] = true;
    cancelAnimationFrame(this._reelAnim[col]);

    // Tirer les 3 symboles finaux
    for (let row = 0; row < SlotMachine.ROWS; row++) {
      this._grid[col][row] = this._roll();
    }

    // Mettre à jour l'affichage du rouleau avec les résultats
    this._renderReelFinal(col);
    _sfx.reel_stop(col);

    const stopBtn = document.getElementById(`slot-stop-${col}`);
    if (stopBtn) { stopBtn.disabled = true; stopBtn.classList.remove('slot-stop-btn--active'); }

    // Effet de choc à l'atterrissage
    const reelWrap = document.getElementById(`slot-reel-${col}`);
    if (reelWrap) {
      reelWrap.classList.add('slot-reel--land');
      setTimeout(() => reelWrap.classList.remove('slot-reel--land'), 350);
    }
  }

  _renderReelFinal(col) {
    const inner = document.getElementById(`slot-reel-inner-${col}`);
    if (!inner) return;

    // Construire une bande de rouleau avec les 3 symboles résultat bien centrés
    const syms = [];
    for (let i = 0; i < SlotMachine.REEL_SIZE; i++) {
      const row = i % SlotMachine.ROWS;
      syms.push(this._grid[col][row] ?? this._roll());
    }

    inner.innerHTML = syms.map((sym, i) =>
      `<div class="slot-reel-item" data-row="${i % SlotMachine.ROWS}">${this._symHTML(sym)}</div>`
    ).join('');

    // Aligner pour montrer les 3 premières
    inner.style.transform = 'translateY(0px)';
    inner.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
    setTimeout(() => { inner.style.transition = ''; }, 300);
  }

  // ── Attendre que toutes les colonnes soient stoppées ──────────────────
  _waitAllStopped() {
    return new Promise(resolve => {
      const check = () => {
        if (this._colStopped.every(Boolean)) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  // ── Render principal ───────────────────────────────────────────────────
  _render() {
    if (!this.el) return;
    const COLS = SlotMachine.COLS;
    const ROWS = SlotMachine.ROWS;

    // Préremplir la grille
    for (let col = 0; col < COLS; col++)
      for (let row = 0; row < ROWS; row++)
        this._grid[col][row] = this._roll();

    const lineColors = SlotMachine.WIN_LINES
      .map(l => `<span class="slot-line-tag" style="--line-color:${l.color}">${l.name}</span>`)
      .join('');

    // Rouleaux verticaux — chaque rouleau a une bande interne qui défile
    const reelsHTML = Array.from({ length: COLS }, (_, col) => {
      const items = Array.from({ length: SlotMachine.REEL_SIZE }, (__, i) => {
        const sym = this._grid[col][i % ROWS] ?? this._roll();
        return `<div class="slot-reel-item" data-row="${i % ROWS}">${this._symHTML(sym)}</div>`;
      }).join('');
      return `
        <div class="slot-reel" id="slot-reel-${col}">
          <div class="slot-reel-inner" id="slot-reel-inner-${col}">${items}</div>
          <div class="slot-reel-mask slot-reel-mask--top"></div>
          <div class="slot-reel-mask slot-reel-mask--bot"></div>
          <div class="slot-reel-center-line"></div>
        </div>`;
    }).join('');

    // Boutons stop individuels
    const stopBtnsHTML = Array.from({ length: COLS }, (_, col) =>
      `<button class="slot-stop-btn" id="slot-stop-${col}" disabled aria-label="Stopper rouleau ${col+1}">STOP</button>`
    ).join('');

    // Paytable images
    const paytableRows = [...SlotMachine.SYMBOLS]
      .sort((a,b) => b.mult - a.mult)
      .map(s => `<div class="slot-pay-row">
        <span class="slot-pay-sym slot-pay-sym--img">
          <img src="${SlotMachine.IMG_BASE}/${s.img}" alt="${s.name}" width="24" height="24" loading="lazy">
        </span>
        <span class="slot-pay-name" style="color:${s.color}">${s.name}</span>
        <span class="slot-pay-mult">x${s.mult} (x${s.mult*2} / x${s.mult*3})</span>
      </div>`).join('');

    this.el.innerHTML = `
      <div class="slot-machine">

        <!-- Panel crédits principal -->
        <div class="slot-credits-panel">
          <div class="slot-credits-main">
            <span class="slot-credits-lbl">CREDITS</span>
            <span class="slot-credits-num" id="slot-credits">${this.credits}</span>
            <span class="slot-credits-unit">C</span>
          </div>
          <div class="slot-credits-sub">
            <div class="slot-stat">
              <span class="slot-stat-lbl">MISE</span>
              <div class="slot-bet-row">
                <button class="slot-bet-btn" id="slot-bet-down" aria-label="Diminuer mise">-</button>
                <span class="slot-stat-val" id="slot-bet">${this.bet}</span>
                <button class="slot-bet-btn" id="slot-bet-up" aria-label="Augmenter mise">+</button>
              </div>
            </div>
            <div class="slot-stat">
              <span class="slot-stat-lbl">GAIN</span>
              <span class="slot-stat-val" id="slot-gain">—</span>
            </div>
          </div>
        </div>

        <div class="slot-lines-legend">${lineColors}</div>

        <!-- Machine 5x3 -->
        <div class="slot-cabinet">
          <div class="slot-reels-wrap" id="slot-reels-wrap">
            ${reelsHTML}
            <svg class="slot-lines-svg" id="slot-lines-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
          </div>
        </div>

        <!-- Boutons STOP individuels -->
        <div class="slot-stop-row">
          ${stopBtnsHTML}
        </div>

        <!-- Message -->
        <div class="slot-msg" id="slot-msg">APPUYER SUR SPIN</div>

        <!-- Spin -->
        <button class="slot-spin-btn" id="slot-spin">SPIN</button>

        <!-- Paytable -->
        <details class="slot-paytable">
          <summary class="slot-paytable-toggle">TABLE DES GAINS</summary>
          <div class="slot-paytable-body">
            <div class="slot-pay-lines">
              <span class="slot-pay-hint">5 LIGNES — MILIEU · HAUT · BAS · DIAG-D · DIAG-U</span>
              <span class="slot-pay-hint">3 EN LIGNE = x1 | 4 = x2 | 5 = x3 de la mise</span>
            </div>
            ${paytableRows}
          </div>
        </details>
      </div>`;

    // Events
    document.getElementById('slot-spin')?.addEventListener('click', () => this.spin());
    document.getElementById('slot-bet-up')?.addEventListener('click',   () => this._changeBet(1));
    document.getElementById('slot-bet-down')?.addEventListener('click', () => this._changeBet(-1));
    for (let col = 0; col < COLS; col++) {
      document.getElementById(`slot-stop-${col}`)?.addEventListener('click', () => {
        _sfx.click();
        this._stopCol(col);
      });
    }
  }

  // ── Symbole HTML — image pixel art ────────────────────────────────────
  _symHTML(sym) {
    if (!sym) return '<div class="slot-sym-empty"></div>';
    return `<div class="slot-sym-img" title="${sym.name}" data-type="${sym.type}" style="--sym-color:${sym.color}">
      <img src="${SlotMachine.IMG_BASE}/${sym.img}" alt="${sym.name}" width="48" height="48" loading="lazy"
           onerror="this.style.opacity='0.2'">
      <span class="slot-sym-name">${sym.name}</span>
    </div>`;
  }

  _getCell(col, row) {
    // Avec les rouleaux, on accède via les items visibles
    const inner = document.getElementById(`slot-reel-inner-${col}`);
    if (!inner) return null;
    const items = inner.querySelectorAll('.slot-reel-item');
    return items[row] ?? null;
  }

  _updateCredits(flash = false) {
    const el = document.getElementById('slot-credits');
    if (!el) return;
    el.textContent = this.credits.toLocaleString('fr-FR');
    if (flash) {
      el.classList.add('slot-credits--flash');
      setTimeout(() => el.classList.remove('slot-credits--flash'), 700);
    }
  }

  _updateGain(g) {
    const el = document.getElementById('slot-gain');
    if (el) el.textContent = g > 0 ? `+${g}` : '—';
  }

  _setMsg(txt, type) {
    const el = document.getElementById('slot-msg');
    if (!el) return;
    el.textContent = txt;
    el.className = 'slot-msg' + (type ? ` slot-msg--${type}` : '');
  }

  _changeBet(delta) {
    const bets = [1, 2, 5, 10, 20, 50];
    const idx  = bets.indexOf(this.bet);
    this.bet   = bets[Math.max(0, Math.min(bets.length - 1, idx + delta))];
    const el   = document.getElementById('slot-bet');
    if (el) el.textContent = this.bet;
    _sfx.click();
  }

  // ── SVG lignes de gain ─────────────────────────────────────────────────
  _clearLines() {
    const svg = document.getElementById('slot-lines-svg');
    if (svg) svg.innerHTML = '';
  }

  _drawLine(line, syms, count) {
    const svg = document.getElementById('slot-lines-svg');
    if (!svg) return;
    const COLS = SlotMachine.COLS;
    const ROWS = SlotMachine.ROWS;
    const cellW = 100 / COLS;
    const cellH = 100 / ROWS;
    const pts = line.rows.map((row, col) => [
      cellW * col + cellW / 2,
      cellH * row + cellH / 2,
    ]);
    const draw = count < 5 ? pts.slice(0, count) : pts;
    const d = draw.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', line.color);
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', '0.9');
    path.style.filter = `drop-shadow(0 0 4px ${line.color})`;
    // Animation de tracé
    const len = draw.length * 25;
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.style.animation = `slot-draw-line 0.5s ease forwards`;
    svg.appendChild(path);
  }

  _flashGrid(type) {
    const wrap = document.getElementById('slot-reels-wrap');
    if (!wrap) return;
    wrap.classList.add(`slot-grid--flash-${type}`);
    setTimeout(() => wrap.classList.remove(`slot-grid--flash-${type}`), 1400);
  }

  // ── Popup bienvenue Muten ─────────────────────────────────────────────
  _showWelcomePopup() {
    _sfx.welcome();

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'muten-welcome-overlay';
    overlay.innerHTML = `
      <div class="muten-popup" role="dialog" aria-modal="true" aria-label="Message de bienvenue du Commandant Muten">
        <div class="muten-popup-glow" aria-hidden="true"></div>
        <div class="muten-popup-header">
          <img class="muten-avatar"
               src="../shared/images/pixel_pp/pixel_pp_cowboy.png"
               alt="Commandant Muten"
               width="72" height="72">
          <div class="muten-popup-title">
            <span class="muten-tag">// COMMANDANT DE BORD</span>
            <span class="muten-name">MUTEN</span>
          </div>
        </div>
        <div class="muten-popup-body">
          <p class="muten-msg">
            Bienvenue à bord du <strong>STAR</strong>, agent.<br>
            Je suis le commandant <strong>MUTEN</strong>.<br>
            Pour débuter, je t'offre
            <span class="muten-credits">${SlotMachine.WELCOME_CREDITS.toLocaleString('fr-FR')} CRÉDITS</span>
            de bienvenue.<br>
            Bonne chance au casino — ne dépense pas tout d'un coup.
          </p>
        </div>
        <div class="muten-popup-coins" aria-hidden="true">
          ${Array.from({length: 10}, () => `<div class="muten-coin" style="--delay:${(Math.random()*0.8).toFixed(2)}s;--x:${Math.floor(Math.random()*90)}%"></div>`).join('')}
        </div>
        <button class="muten-popup-close" id="muten-popup-close">PRENDRE LES CREDITS</button>
      </div>`;

    document.body.appendChild(overlay);

    // Animation entrée
    requestAnimationFrame(() => overlay.classList.add('muten-welcome-overlay--in'));

    const close = () => {
      overlay.classList.remove('muten-welcome-overlay--in');
      overlay.classList.add('muten-welcome-overlay--out');
      setTimeout(() => overlay.remove(), 400);
      _sfx.coin();
      _sfx.coin();
    };
    document.getElementById('muten-popup-close')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }
}
