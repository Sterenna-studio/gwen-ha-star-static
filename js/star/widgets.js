/**
 * widgets.js — Widgets autonomes réutilisables pour le hub star/
 * VideoDay    : embed YouTube/PeerTube depuis Supabase table daily_content
 * RadioPlayer : lecteur des musiques du Jukebox (records.json) + visualiseur canvas
 * SlotMachine : machine à sous 3×5 avec 5 lignes de gain (dont diagonales), pixel art crew, Web Audio
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

  // FX spécial Chronicles (arpège violet mystique)
  chronicles() {
    const ctx = this._get(); if (!ctx) return;
    // Arpège descendant mystique + reverb simulé
    const freqs = [880, 740, 622, 523, 415, 349, 294, 247];
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.08;
      this._tone(f, 'sine', 0.09, 0.01, 0.22, t);
      this._tone(f * 2, 'triangle', 0.03, 0.005, 0.15, t + 0.02);
    });
    // Grondement basse
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
      const id = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1];
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

// ── SLOT MACHINE 3×5 ────────────────────────────────────────────────────────────────
// Grille : 3 LIGNES × 5 COLONNES
// Lignes de gain :
//   L0 : milieu     [row 1] — toutes colonnes
//   L1 : haut       [row 0] — toutes colonnes
//   L2 : bas        [row 2] — toutes colonnes
//   L3 : diag ↘     [0,0],[1,1],[2,1],[3,1],[4,2] (adapté 3 lignes)
//   L4 : diag ↗     [0,2],[1,1],[2,1],[3,1],[4,0]
//
// Symboles (du plus rare au plus commun) :
//   PP (MutenRock, SoRn, Aligax, Sniky) = jackpots absolus
//   🎰 BAR        = super win
//   7️⃣  SEVEN      = win très fort
//   🍒 CHERRY     = win moyen
//   🔔 BELL       = win léger
//   ⭐ STAR       = petit gain
//   🍋 LEMON      = consolation

export class SlotMachine {
  // Symboles — les PP sont les 4 meilleurs lots (jackpot ×50)
  static SYMBOLS = [
    // PP crew — jackpot absolu
    { id: 'pp_mutenrock', label: '👑', name: 'MUTENROCK', mult: 50,  rare: 1,  type: 'pp',  color: '#ffd700' },
    { id: 'pp_sorn',      label: '⚔', name: 'SORN',      mult: 50,  rare: 1,  type: 'pp',  color: '#a78bfa' },
    { id: 'pp_aligax',    label: '🛡', name: 'ALIGAX',    mult: 50,  rare: 1,  type: 'pp',  color: '#34d399' },
    { id: 'pp_sniky',     label: '🗡', name: 'SNIKY',     mult: 50,  rare: 1,  type: 'pp',  color: '#f87171' },
    // Symboles classiques
    { id: 'bar',          label: '🎰', name: 'BAR',       mult: 25,  rare: 2,  type: 'classic', color: '#fbbf24' },
    { id: 'seven',        label: '7️⃣', name: 'SEVEN',    mult: 15,  rare: 3,  type: 'classic', color: '#f97316' },
    { id: 'cherry',       label: '🍒', name: 'CHERRY',    mult: 8,   rare: 5,  type: 'classic', color: '#ef4444' },
    { id: 'bell',         label: '🔔', name: 'BELL',      mult: 4,   rare: 8,  type: 'classic', color: '#eab308' },
    { id: 'star',         label: '⭐', name: 'STAR',      mult: 2,   rare: 12, type: 'classic', color: '#60a5fa' },
    { id: 'lemon',        label: '🍋', name: 'LEMON',     mult: 1,   rare: 18, type: 'classic', color: '#a3e635' },
    // Chronicles — symbole spécial
    { id: 'chronicles',   label: '📖', name: 'CHRONICLES',mult: 5,   rare: 4,  type: 'chronicles', color: '#c084fc' },
  ];

  // 5 lignes de gain : tableau [col] → row
  static WIN_LINES = [
    { id: 'L0', name: 'MILIEU',   rows: [1,1,1,1,1], color: '#00ff80' },
    { id: 'L1', name: 'HAUT',     rows: [0,0,0,0,0], color: '#60a5fa' },
    { id: 'L2', name: 'BAS',      rows: [2,2,2,2,2], color: '#f97316' },
    { id: 'L3', name: 'DIAG ↘',  rows: [0,1,1,1,2], color: '#a78bfa' },
    { id: 'L4', name: 'DIAG ↗',  rows: [2,1,1,1,0], color: '#f472b6' },
  ];

  static COLS = 5;
  static ROWS = 3;

  constructor(containerId, opts = {}) {
    this.el        = document.getElementById(containerId);
    this.bet       = opts.bet       ?? 5;
    this.userId    = opts.userId    ?? null;
    this.credits   = 100; // sera remplacé par Supabase
    this.spinning  = false;
    this._grid     = Array.from({ length: this.constructor.COLS }, () => Array(this.constructor.ROWS).fill(null));
    this._spinTimer= null;
  }

  // ── Init ──────────────────────────────────────────────────────────────
  async init(userId) {
    if (userId) this.userId = userId;
    await this._loadCredits();
    this._render();
    _sfx.boot();
  }

  // ── Supabase : charger les crédits ────────────────────────────────────
  async _loadCredits() {
    if (!this.userId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('chronicles')
        .eq('id', this.userId)
        .single();
      if (!error && data != null) this.credits = data.chronicles ?? 100;
    } catch { /* fallback 100 */ }
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

  // ── Tirage ─────────────────────────────────────────────────────────────
  _roll() {
    // Pool pondéré par rarité (rare = poids faible)
    const pool = [];
    for (const sym of this.constructor.SYMBOLS) {
      for (let i = 0; i < sym.rare; i++) pool.push(sym);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Évaluation des lignes ──────────────────────────────────────────────
  _evaluate() {
    const results = [];
    for (const line of this.constructor.WIN_LINES) {
      const syms = line.rows.map((row, col) => this._grid[col][row]);
      // 5 identiques
      if (syms.every(s => s.id === syms[0].id)) {
        results.push({ line, syms, count: 5, mult: syms[0].mult * 3 });
        continue;
      }
      // 4 identiques (les 4 premiers ou 4 derniers)
      const checkN = (arr, n) => arr.slice(0, n).every(s => s.id === arr[0].id);
      if (checkN(syms, 4)) { results.push({ line, syms: syms.slice(0,4), count: 4, mult: syms[0].mult * 2 }); continue; }
      const last4 = syms.slice(1);
      if (last4.every(s => s.id === last4[0].id)) { results.push({ line, syms: last4, count: 4, mult: last4[0].mult * 2 }); continue; }
      // 3 identiques
      for (let i = 0; i <= 2; i++) {
        const sub = syms.slice(i, i+3);
        if (sub.every(s => s.id === sub[0].id)) {
          results.push({ line, syms: sub, count: 3, mult: sub[0].mult }); break;
        }
      }
    }
    return results;
  }

  // ── Spin ───────────────────────────────────────────────────────────────
  async spin() {
    if (this.spinning) return;
    if (this.credits < this.bet) {
      this._setMsg('CRÉDITS INSUFFISANTS', 'red'); return;
    }
    this.spinning = true;
    this.credits -= this.bet;
    this._updateCredits();
    _sfx.lever();
    this._setMsg('', '');
    this._clearLines();

    // Spin visuel par colonne avec délai décalé
    const SPIN_DUR  = 900;
    const STOP_GAP  = 180;
    const allCells  = [];

    for (let col = 0; col < this.constructor.COLS; col++) {
      for (let row = 0; row < this.constructor.ROWS; row++) {
        const cell = this._getCell(col, row);
        if (cell) { cell.classList.add('slot-cell--spin'); allCells.push({ cell, col, row }); }
      }
    }

    // Arrêt colonne par colonne
    for (let col = 0; col < this.constructor.COLS; col++) {
      await new Promise(r => setTimeout(r, SPIN_DUR + col * STOP_GAP));
      for (let row = 0; row < this.constructor.ROWS; row++) {
        const sym  = this._roll();
        this._grid[col][row] = sym;
        const cell = this._getCell(col, row);
        if (!cell) continue;
        cell.classList.remove('slot-cell--spin');
        cell.classList.add('slot-cell--land');
        cell.innerHTML = this._symHTML(sym);
        setTimeout(() => cell.classList.remove('slot-cell--land'), 400);
      }
      _sfx.reel_stop(col);
    }

    // Évaluation
    await new Promise(r => setTimeout(r, 200));
    const wins = this._evaluate();
    let totalGain = 0;
    let hasChronicles = false;
    let hasPP = false;

    for (const w of wins) {
      totalGain += this.bet * w.mult;
      if (w.syms[0].type === 'chronicles') hasChronicles = true;
      if (w.syms[0].type === 'pp')          hasPP = true;
      this._drawLine(w.line, w.syms, w.count);
    }

    if (totalGain > 0) {
      this.credits += totalGain;
      this._updateCredits(true);

      // FX selon type
      if (hasPP && wins.some(w => w.count === 5)) {
        _sfx.jackpot();
        this._setMsg(`⚡ JACKPOT PP ×${wins.find(w=>w.syms[0].type==='pp').mult*3} — +${totalGain} ₵`, 'jackpot');
        this._flashGrid('gold');
      } else if (hasChronicles) {
        _sfx.chronicles();
        this._setMsg(`📖 CHRONICLES ×${wins.find(w=>w.syms[0].type==='chronicles').mult} — +${totalGain} ₵`, 'chronicles');
        this._flashGrid('chronicles');
      } else if (totalGain >= this.bet * 20) {
        _sfx.super_win();
        this._setMsg(`★★ SUPER WIN — +${totalGain} ₵`, 'jackpot');
      } else {
        _sfx.win();
        this._setMsg(`+${totalGain} ₵ — ${wins.map(w=>w.line.name).join(', ')}`, 'win');
      }

      // Pulse win sur cellules gagnantes
      for (const w of wins) {
        w.line.rows.forEach((row, col) => {
          if (w.count < 5 && col >= w.count) return;
          this._getCell(col, row)?.classList.add('slot-cell--win');
          setTimeout(() => this._getCell(col, row)?.classList.remove('slot-cell--win'), 1800);
        });
      }
    } else {
      _sfx.lose();
      this._setMsg('—', 'lose');
    }

    await this._saveCredits();
    this.spinning = false;
    this._updateGain(totalGain);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  _render() {
    if (!this.el) return;
    const COLS = this.constructor.COLS;
    const ROWS = this.constructor.ROWS;

    // Préremplir la grille avec des symboles aléatoires
    for (let col = 0; col < COLS; col++)
      for (let row = 0; row < ROWS; row++)
        this._grid[col][row] = this._roll();

    const lineColors = this.constructor.WIN_LINES
      .map(l => `<span class="slot-line-tag" style="--line-color:${l.color}">${l.name}</span>`)
      .join('');

    const gridHTML = Array.from({ length: COLS }, (_, col) =>
      `<div class="slot-col">${
        Array.from({ length: ROWS }, (__, row) =>
          `<div class="slot-cell" data-col="${col}" data-row="${row}">${this._symHTML(this._grid[col][row])}</div>`
        ).join('')
      }</div>`
    ).join('');

    const paytableRows = this.constructor.SYMBOLS
      .sort((a,b) => b.mult - a.mult)
      .map(s => `<div class="slot-pay-row">
        <span class="slot-pay-sym">${s.label}</span>
        <span class="slot-pay-sym" style="font-size:11px;color:var(--c-text-faint)">${s.name}</span>
        <span class="slot-pay-mult">×${s.mult} (×${s.mult*2} ×${s.mult*3})</span>
      </div>`).join('');

    this.el.innerHTML = `
      <div class="slot-machine">
        <div class="slot-header">
          <div class="slot-credit-box">
            <span class="slot-lbl">CRÉDITS</span>
            <span class="slot-credit-val" id="slot-credits">${this.credits}</span>
          </div>
          <div class="slot-credit-box">
            <span class="slot-lbl">MISE</span>
            <div class="slot-bet-row">
              <button class="slot-bet-btn" id="slot-bet-down">−</button>
              <span class="slot-credit-val" id="slot-bet">${this.bet}</span>
              <button class="slot-bet-btn" id="slot-bet-up">+</button>
            </div>
          </div>
          <div class="slot-credit-box">
            <span class="slot-lbl">GAIN</span>
            <span class="slot-credit-val slot-gain" id="slot-gain">—</span>
          </div>
        </div>

        <div class="slot-lines-legend">${lineColors}</div>

        <div class="slot-grid" id="slot-grid">
          ${gridHTML}
          <svg class="slot-lines-svg" id="slot-lines-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
        </div>

        <div class="slot-msg" id="slot-msg">APPUYER SUR SPIN</div>

        <button class="slot-spin-btn" id="slot-spin">▶ SPIN</button>

        <details class="slot-paytable">
          <summary class="slot-paytable-toggle">▸ TABLE DES GAINS</summary>
          <div class="slot-paytable-body">
            <div class="slot-pay-lines">
              <span class="slot-pay-hint">5 LIGNES ACTIVES — MILIEU · HAUT · BAS · DIAG↘ · DIAG↗</span>
              <span class="slot-pay-hint">3 EN LIGNE = ×mult | 4 = ×mult×2 | 5 = ×mult×3</span>
            </div>
            ${paytableRows}
          </div>
        </details>
      </div>`;

    // Events
    document.getElementById('slot-spin')?.addEventListener('click', () => this.spin());
    document.getElementById('slot-bet-up')?.addEventListener('click',   () => this._changeBet(1));
    document.getElementById('slot-bet-down')?.addEventListener('click', () => this._changeBet(-1));
  }

  _symHTML(sym) {
    if (!sym) return '';
    return `<span class="slot-sym" title="${sym.name}" style="color:${sym.color}" data-type="${sym.type}">${sym.label}</span>`;
  }

  _getCell(col, row) {
    return this.el?.querySelector(`.slot-cell[data-col="${col}"][data-row="${row}"]`);
  }

  _updateCredits(flash = false) {
    const el = document.getElementById('slot-credits');
    if (!el) return;
    el.textContent = this.credits;
    if (flash) { el.classList.add('slot-credits--flash'); setTimeout(() => el.classList.remove('slot-credits--flash'), 600); }
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
    const next = bets[Math.max(0, Math.min(bets.length - 1, idx + delta))];
    this.bet = next;
    const el = document.getElementById('slot-bet');
    if (el) el.textContent = this.bet;
    _sfx.click();
  }

  // ── SVG lignes de gain ─────────────────────────────────────────────────
  _clearLines() {
    const svg = document.getElementById('slot-lines-svg');
    if (svg) svg.innerHTML = '';
  }

  _drawLine(line, syms, count) {
    const svg  = document.getElementById('slot-lines-svg');
    if (!svg) return;
    const COLS = this.constructor.COLS;
    const ROWS = this.constructor.ROWS;
    // Centre de chaque cellule en coordonnées % (viewBox 0 0 100 100)
    const cellW = 100 / COLS;
    const cellH = 100 / ROWS;
    const pts = line.rows.map((row, col) => [
      cellW * col + cellW / 2,
      cellH * row + cellH / 2,
    ]);
    // Ne dessiner que les n premières (count)
    const draw = count < 5 ? pts.slice(0, count + (pts.length - count >= 0 ? 0 : 0)) : pts;
    const d = draw.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', line.color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('opacity', '0.85');
    path.style.filter = `drop-shadow(0 0 3px ${line.color})`;
    svg.appendChild(path);
  }

  // ── Flash grille ───────────────────────────────────────────────────────
  _flashGrid(type) {
    const grid = document.getElementById('slot-grid');
    if (!grid) return;
    grid.classList.add(`slot-grid--flash-${type}`);
    setTimeout(() => grid.classList.remove(`slot-grid--flash-${type}`), 1200);
  }
}
