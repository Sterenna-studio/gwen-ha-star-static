/**
 * widgets.js — Widgets autonomes réutilisables pour le hub star/
 * VideoDay    : embed YouTube/PeerTube depuis Supabase table daily_content
 * RadioPlayer : lecteur des musiques du Jukebox (records.json) + visualiseur canvas
 * SlotMachine : machine à sous 5×5 (+ preview haut/bas) — PP pixel art uniquement
 *               levier hold-to-spin, 5 lignes de gain (dont 2 diagonales)
 *               monnaie virtuelle chronicles (Supabase)
 *               v3.2 : tile glow coloré par ligne + breakdown crédits par ligne
 */
import { supabase } from '../supabase.js';

// ── SOUND ENGINE ────────────────────────────────────────────────────────────────────
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
    const osc = ctx.createOscillator(), gain = ctx.createGain();
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
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(), gain = ctx.createGain();
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
    const freqs = [440, 420, 390, 360, 340];
    this._tone(freqs[idx] ?? 440, 'triangle', 0.10, 0.005, 0.15);
    this._noise(0.04, 0.04);
  },
  lever_hold(ratio) {
    const ctx = this._get(); if (!ctx) return;
    const baseFreq = 180 + ratio * 300;
    this._tone(baseFreq, 'sawtooth', 0.05 + ratio * 0.04, 0.01, 0.08);
  },
  lever_release() {
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
    [523, 659, 784, 1047, 784, 1047, 1319, 1047, 1319, 1568].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.06;
      this._tone(f, i % 2 === 0 ? 'square' : 'triangle', 0.09, 0.005, 0.10, t);
    });
    this._noise(0.08, 0.6);
  },
  lose() {
    const ctx = this._get(); if (!ctx) return;
    [330, 280, 220].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.12;
      this._tone(f, 'sawtooth', 0.07, 0.01, 0.18, t);
    });
  },
  coin() {
    const ctx = this._get(); if (!ctx) return;
    this._tone(1200, 'sine', 0.07, 0.003, 0.04);
    this._tone(1600, 'sine', 0.05, 0.003, 0.04, ctx.currentTime + 0.05);
  },
  welcome() {
    const ctx = this._get(); if (!ctx) return;
    [330, 415, 523, 659, 784, 1047].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.07;
      this._tone(f, i % 2 === 0 ? 'triangle' : 'sine', 0.08, 0.005, 0.18, t);
    });
    this._noise(0.03, 0.5);
  },
  enter_casino() {
    const ctx = this._get(); if (!ctx) return;
    [220, 277, 330, 440, 554, 659].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.05;
      this._tone(f, 'sawtooth', 0.06, 0.005, 0.12, t);
    });
    this._noise(0.04, 0.4);
  },
};
export const SFX = _sfx;

// ── VIDEO DU JOUR ──────────────────────────────────────────────────────────────────
export class VideoDay {
  constructor(containerId) { this.el = document.getElementById(containerId); }

  async load() {
    if (!this.el) return;
    try {
      const { data, error } = await supabase
        .from('daily_content')
        .select('title, url, platform, note')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
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

// ── WEB RADIO ──────────────────────────────────────────────────────────────────────
export class RadioPlayer {
  constructor(containerId) {
    this.el        = document.getElementById(containerId);
    this.tracks    = [];
    this.idx       = 0;
    this.audio     = new Audio();
    this.audio.volume = 0.6;
    this._animId   = null;
    this._ctx      = null;
    this._analyser = null;
    this._src      = null;
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
      const res  = await fetch('/jukebox/records.json');
      const json = await res.json();
      const raw  = Array.isArray(json) ? json : (json.tracks ?? []);
      this.tracks = raw
        .filter(t => t.display !== false)
        .map(t => ({
          ...t,
          file: t.src ? `/jukebox/${t.src}` : (t.file ?? t.url ?? ''),
          cover: t.coverImage ? `/jukebox/${t.coverImage}` : null,
          color1: t.coverColor ?? '#14161a',
          color2: t.labelColor ?? '#050608',
        }));
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
    this.audio.src = t.file ?? '';
    this.audio.load();
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('jk-title',  t.title  ?? '—');
    s('jk-artist', t.artist ?? '—');
    s('jk-badge',  t.genre  ?? 'JUKEBOX');
    s('radio-station', `STAR · ${(t.artist ?? 'UNKNOWN').toUpperCase()}`);
    const selEl   = document.getElementById('radio-playlist');
    const coverEl = document.getElementById('jk-cover');
    const seekEl  = document.getElementById('jk-seek');
    if (selEl)    selEl.value = String(this.idx);
    if (coverEl) {
      coverEl.innerHTML = t.cover
        ? `<img src="${t.cover}" alt="Cover ${t.title ?? ''}" width="48" height="48" loading="lazy">`
        : '<span class="jk-cover-fallback">♪</span>';
      coverEl.style.setProperty('--jk-c1', t.color1 ?? '#14161a');
      coverEl.style.setProperty('--jk-c2', t.color2 ?? '#050608');
    }
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
      const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
      const cur = document.getElementById('jk-cur');
      const dur = document.getElementById('jk-dur');
      const sk  = document.getElementById('jk-seek');
      if (cur) cur.textContent = fmt(this.audio.currentTime);
      if (dur) dur.textContent = fmt(this.audio.duration || 0);
      if (sk && this.audio.duration) sk.value = (this.audio.currentTime / this.audio.duration) * 100;
    });
  }

  _ensureAudioCtx() {
    if (this._ctx) return;
    try {
      this._ctx      = new (window.AudioContext || window.webkitAudioContext)();
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 128;
      this._src      = this._ctx.createMediaElementSource(this.audio);
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

// ══════════════════════════════════════════════════════════════════════════════════════
// ── SLOT MACHINE v3.2 — PP-ONLY · TILE GLOW · BREAKDOWN CRÉDITS
// ══════════════════════════════════════════════════════════════════════════════════════
export class SlotMachine {
  static IMG_BASE    = '../shared/images';
  static CASINO_COST = 50;

  static SYMBOLS = [
    { id: 'pp_sniky',  name: 'SNIKY',  img: 'pixel_pp/pixel_pp_sniky.png',  mult: 50, rare: 1, color: '#f87171' },
    { id: 'pp_aligax', name: 'ALIGAX', img: 'pixel_pp/pixel_pp_aligax.png', mult: 50, rare: 1, color: '#34d399' },
    { id: 'pp_cowboy', name: 'COWBOY', img: 'pixel_pp/pixel_pp_cowboy.png', mult: 40, rare: 2, color: '#ffd700' },
    { id: 'pp_abad',   name: 'ABAD',   img: 'pixel_pp/pixel_pp_abad.png',   mult: 30, rare: 3, color: '#a78bfa' },
    { id: 'pp_spirit', name: 'SPIRIT', img: 'pixel_pp/pixel_pp_spirit.png', mult: 10, rare: 8, color: '#60a5fa' },
  ];

  static WIN_LINES = [
    { id: 'L0', name: 'MILIEU',  type: 'h', rowOff:  0,                color: '#00ff80', mult: 1.0 },
    { id: 'L1', name: 'HAUT',    type: 'h', rowOff: -1,                color: '#60a5fa', mult: 0.5 },
    { id: 'L2', name: 'BAS',     type: 'h', rowOff: +1,                color: '#f97316', mult: 0.5 },
    { id: 'L3', name: 'DIAG ↘', type: 'd', rowOffs: [-2,-1,0,+1,+2],  color: '#f472b6', mult: 0.7 },
    { id: 'L4', name: 'DIAG ↗', type: 'd', rowOffs: [+2,+1,0,-1,-2],  color: '#c084fc', mult: 0.7 },
  ];

  static COLS            = 5;
  static VISIBLE_ROWS    = 5;
  static ACTIVE_ROW      = 2;
  static REEL_LEN        = 24;
  static WELCOME_CREDITS = 1000;
  static LEVER_BASE_DELAY = 500;
  static LEVER_COL_STEP   = 300;
  static LEVER_MAX_BONUS  = 2000;

  constructor(containerId, opts = {}) {
    this.el          = document.getElementById(containerId);
    this.bet         = opts.bet ?? 5;
    this.userId      = opts.userId ?? null;
    this.credits     = 0;
    this.spinning    = false;
    this._isNew      = false;
    this._pool       = this._buildPool();
    this._reels      = Array.from({ length: SlotMachine.COLS }, () => this._buildReel());
    this._reelPos    = Array(SlotMachine.COLS).fill(0);
    this._reelSpeed  = Array(SlotMachine.COLS).fill(0);
    this._colStopped = Array(SlotMachine.COLS).fill(true);
    this._animId     = null;
    this._leverStart = null;
    this._leverHoldInterval = null;
  }

  // ── INIT ─────────────────────────────────────────────────────────────────────────
  async init(userId) {
    if (userId) this.userId = userId;
    await this._loadCredits();
    this._render();
    this._startRenderLoop();
    if (this._isNew) setTimeout(() => this._showWelcomePopup(), 800);
  }

  // ── SUPABASE ──────────────────────────────────────────────────────────────────
  async _loadCredits() {
    if (!this.userId) { this.credits = 100; return; }
    try {
      const { data, error } = await supabase
        .from('profiles').select('chronicles').eq('id', this.userId).single();
      if (!error && data != null) {
        const stored = data.chronicles;
        if (stored === null || stored === undefined || stored === 0) {
          this.credits = SlotMachine.WELCOME_CREDITS;
          this._isNew  = true;
          await this._saveCredits();
        } else {
          this.credits = stored;
        }
      } else { this.credits = 100; }
    } catch { this.credits = 100; }
  }

  async _saveCredits() {
    if (!this.userId) return;
    try {
      await supabase.from('profiles').update({ chronicles: this.credits }).eq('id', this.userId);
      const kpiEl = document.getElementById('kpi-chronicles');
      if (kpiEl) kpiEl.textContent = this.credits.toLocaleString('fr-FR');
    } catch {}
  }

  // ── POOL & BANDE ──────────────────────────────────────────────────────────────
  _buildPool() {
    const pool = [];
    for (const sym of SlotMachine.SYMBOLS)
      for (let i = 0; i < sym.rare; i++) pool.push(sym);
    return pool;
  }
  _roll()      { return this._pool[Math.floor(Math.random() * this._pool.length)]; }
  _buildReel() { return Array.from({ length: SlotMachine.REEL_LEN }, () => this._roll()); }
  _getSymAt(col, rowOffset) {
    const pos = this._reelPos[col], len = SlotMachine.REEL_LEN;
    const idx = ((Math.floor(pos) + SlotMachine.ACTIVE_ROW + rowOffset) % len + len) % len;
    return this._reels[col][idx];
  }

  // ── RENDER HTML ───────────────────────────────────────────────────────────────
  _render() {
    if (!this.el) return;
    const COLS     = SlotMachine.COLS;
    const canEnter = this.credits >= SlotMachine.CASINO_COST;

    const reelsHTML = Array.from({ length: COLS }, (_, col) => `
      <div class="sl-reel" id="sl-reel-${col}">
        <div class="sl-reel-inner" id="sl-reel-inner-${col}">${this._buildReelCells(col)}</div>
        <div class="sl-reel-shine" aria-hidden="true"></div>
      </div>`).join('');

    const paytableRows = [...SlotMachine.SYMBOLS]
      .sort((a, b) => b.mult - a.mult)
      .map(s => `<div class="sl-pay-row">
        <img src="${SlotMachine.IMG_BASE}/${s.img}" alt="${s.name}" width="22" height="22" loading="lazy">
        <span class="sl-pay-name" style="color:${s.color}">${s.name}</span>
        <span class="sl-pay-mult">×${s.mult}</span>
      </div>`).join('');

    this.el.innerHTML = `
    <div class="sl-machine">

      <div class="sl-header" aria-label="CASINO · CHRONICLES">
        <div class="sl-header-dot" aria-hidden="true"></div>
        <span class="sl-header-label">CASINO <span class="sl-header-accent">·</span> SLOT</span>
        <div class="sl-header-dot" aria-hidden="true"></div>
      </div>

      <div class="sl-scoreboard">
        <div class="sl-score-block">
          <span class="sl-score-lbl">CRÉDITS</span>
          <span class="sl-score-val sl-score-credits" id="sl-credits">${this.credits.toLocaleString('fr-FR')}</span>
        </div>
        <div class="sl-score-block">
          <span class="sl-score-lbl">MISE</span>
          <div class="sl-bet-row">
            <button class="sl-bet-btn" id="sl-bet-down" aria-label="Réduire mise">−</button>
            <span class="sl-score-val" id="sl-bet">${this.bet}</span>
            <button class="sl-bet-btn" id="sl-bet-up" aria-label="Augmenter mise">+</button>
          </div>
        </div>
        <div class="sl-score-block">
          <span class="sl-score-lbl">GAIN</span>
          <span class="sl-score-val sl-score-gain" id="sl-gain">—</span>
        </div>
      </div>

      <!-- Breakdown crédits par ligne validée — v3.2 -->
      <div class="sl-breakdown" id="sl-breakdown" aria-live="polite"></div>

      <div class="sl-cabinet">
        <div class="sl-line-legend" aria-hidden="true">
          <span class="sl-line-badge" style="--lc:#60a5fa">▸ HAUT ×0.5</span>
          <span class="sl-line-badge sl-line-badge--main" style="--lc:#00ff80">▶ MILIEU ×1</span>
          <span class="sl-line-badge" style="--lc:#f97316">▸ BAS ×0.5</span>
          <span class="sl-line-badge" style="--lc:#f472b6">╲ DIAG ↘ ×0.7</span>
          <span class="sl-line-badge" style="--lc:#c084fc">╱ DIAG ↗ ×0.7</span>
        </div>

        <div class="sl-reels-wrap" id="sl-reels-wrap">
          ${reelsHTML}
          <div class="sl-overlay sl-overlay--top" style="--lc:#60a5fa" aria-hidden="true"></div>
          <div class="sl-overlay sl-overlay--mid" style="--lc:#00ff80" aria-hidden="true"></div>
          <div class="sl-overlay sl-overlay--bot" style="--lc:#f97316" aria-hidden="true"></div>
          <div class="sl-active-frame" aria-hidden="true"></div>
        </div>
      </div>

      <div class="sl-msg" id="sl-msg">MAINTENIR LE LEVIER POUR JOUER</div>

      <div class="sl-lever" id="sl-lever" role="button"
           aria-label="Levier — maintenir pour charger, relâcher pour lancer" tabindex="0">
        <div class="sl-lever-track" aria-hidden="true"></div>
        <div class="sl-lever-arm" id="sl-lever-arm" aria-hidden="true">
          <div class="sl-lever-knob" id="sl-lever-knob"></div>
        </div>
        <span class="sl-lever-label">LEVER</span>
      </div>

      <button class="sl-casino-btn ${canEnter ? '' : 'sl-casino-btn--locked'}" id="sl-casino-btn"
              aria-label="Accéder au casino complet — coûte ${SlotMachine.CASINO_COST} chronicles">
        <span class="sl-casino-icon" aria-hidden="true">${canEnter ? '🎰' : '🔒'}</span>
        <span class="sl-casino-text">
          <span class="sl-casino-title">CASINO COMPLET</span>
          <span class="sl-casino-sub">${canEnter ? `−${SlotMachine.CASINO_COST} C · ENTRER` : `CRÉDITS INSUFFISANTS (min. ${SlotMachine.CASINO_COST})`}</span>
        </span>
        <span class="sl-casino-arrow" aria-hidden="true">→</span>
      </button>

      <details class="sl-paytable">
        <summary class="sl-paytable-toggle">▾ TABLE DES GAINS</summary>
        <div class="sl-paytable-body">
          <p class="sl-pay-hint">5 IDENTIQUES SUR UNE LIGNE = GAIN · MILIEU ×1 · HAUT/BAS ×0.5 · DIAGONALES ×0.7</p>
          <div class="sl-pay-grid">${paytableRows}</div>
        </div>
      </details>
    </div>`;

    document.getElementById('sl-bet-up')?.addEventListener('click',     () => this._changeBet(1));
    document.getElementById('sl-bet-down')?.addEventListener('click',   () => this._changeBet(-1));
    document.getElementById('sl-casino-btn')?.addEventListener('click', () => this._enterCasino());
    this._bindLever();
  }

  // ── LEVIER ─────────────────────────────────────────────────────────────────────
  _bindLever() {
    const lever = document.getElementById('sl-lever');
    if (!lever) return;

    const onStart = (e) => {
      e.preventDefault();
      if (this.spinning) return;
      if (this.credits < this.bet) { this._setMsg('CRÉDITS INSUFFISANTS', 'lose'); _sfx.lose(); return; }
      this._leverStart = Date.now();
      lever.classList.add('sl-lever--hold');
      document.getElementById('sl-lever-arm')?.classList.add('sl-lever-arm--pull');
      document.getElementById('sl-lever-knob')?.classList.add('sl-lever-knob--glow');
      this._setMsg('CHARGEMENT… RELÂCHER POUR LANCER', '');
      this._leverHoldInterval = setInterval(() => {
        if (this._leverStart === null) { clearInterval(this._leverHoldInterval); return; }
        const ratio = Math.min(1, (Date.now() - this._leverStart) / 1000);
        _sfx.lever_hold(ratio);
      }, 120);
    };

    const onEnd = (e) => {
      e.preventDefault();
      if (this._leverStart === null) return;
      clearInterval(this._leverHoldInterval);
      const chargeRatio = Math.min(1, (Date.now() - this._leverStart) / 1000);
      this._leverStart = null;
      lever.classList.remove('sl-lever--hold');
      document.getElementById('sl-lever-arm')?.classList.remove('sl-lever-arm--pull');
      document.getElementById('sl-lever-arm')?.classList.add('sl-lever-arm--release');
      document.getElementById('sl-lever-knob')?.classList.remove('sl-lever-knob--glow');
      setTimeout(() => document.getElementById('sl-lever-arm')?.classList.remove('sl-lever-arm--release'), 400);
      _sfx.lever_release();
      this._spinWithLever(chargeRatio);
    };

    lever.addEventListener('mousedown',  onStart);
    lever.addEventListener('touchstart', onStart, { passive: false });
    lever.addEventListener('mouseup',    onEnd);
    lever.addEventListener('touchend',   onEnd,   { passive: false });
    document.addEventListener('mouseup', (e) => {
      if (this._leverStart !== null && e.target !== lever && !lever.contains(e.target)) onEnd(e);
    });
    lever.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onStart(e); } });
    lever.addEventListener('keyup',   (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onEnd(e); } });
  }

  // ── BUILD CELLS ───────────────────────────────────────────────────────────────
  _buildReelCells(col) {
    return [-2,-1,0,1,2].map((off, i) => {
      const sym      = this._getSymAt(col, off);
      const isActive = (i === SlotMachine.ACTIVE_ROW);
      return `<div class="sl-cell${isActive ? ' sl-cell--active' : ''}" data-off="${off}">${this._symHTML(sym, isActive)}</div>`;
    }).join('');
  }

  _symHTML(sym, active = false) {
    if (!sym) return '<div class="sl-sym-empty"></div>';
    const sz = active ? 52 : 36;
    return `<div class="sl-sym" data-id="${sym.id}" style="--sym-color:${sym.color}">
      <img src="${SlotMachine.IMG_BASE}/${sym.img}" alt="${sym.name}" width="${sz}" height="${sz}" loading="lazy" onerror="this.style.opacity='0.1'">
      <span class="sl-sym-name">${sym.name}</span>
    </div>`;
  }

  // ── RENDER LOOP ────────────────────────────────────────────────────────────────
  _startRenderLoop() {
    const loop = () => {
      this._animId = requestAnimationFrame(loop);
      let any = false;
      for (let col = 0; col < SlotMachine.COLS; col++) {
        if (!this._colStopped[col]) {
          any = true;
          this._reelPos[col] = (this._reelPos[col] + this._reelSpeed[col]) % SlotMachine.REEL_LEN;
          this._updateReelDOM(col);
        }
      }
      if (any && Math.random() < 0.04) _sfx.tick();
    };
    loop();
  }

  _updateReelDOM(col) {
    const inner = document.getElementById(`sl-reel-inner-${col}`);
    if (!inner) return;
    const cells = inner.querySelectorAll('.sl-cell');
    [-2,-1,0,1,2].forEach((off, i) => {
      const sym      = this._getSymAt(col, off);
      const isActive = (i === SlotMachine.ACTIVE_ROW);
      const cell     = cells[i];
      if (cell) cell.innerHTML = this._symHTML(sym, isActive);
    });
  }

  // ── SPIN ──────────────────────────────────────────────────────────────────────
  async _spinWithLever(chargeRatio) {
    if (this.spinning) return;
    if (this.credits < this.bet) { this._setMsg('CRÉDITS INSUFFISANTS', 'lose'); _sfx.lose(); return; }

    this.spinning = true;
    this.credits -= this.bet;
    this._updateCreditsDisplay();
    this._updateCasinoBtn();
    this._setMsg('EN JEU…', '');
    this._clearWin();
    this._clearBreakdown();

    for (let col = 0; col < SlotMachine.COLS; col++) this._reels[col] = this._buildReel();
    this._reelSpeed  = Array.from({ length: SlotMachine.COLS }, (_, c) => 0.17 + c * 0.01);
    this._colStopped = Array(SlotMachine.COLS).fill(false);

    const { LEVER_BASE_DELAY, LEVER_COL_STEP, LEVER_MAX_BONUS } = SlotMachine;
    for (let col = 0; col < SlotMachine.COLS; col++) {
      const delay = LEVER_BASE_DELAY + col * LEVER_COL_STEP + chargeRatio * LEVER_MAX_BONUS;
      setTimeout(() => this._stopCol(col), delay);
    }

    await this._waitAllStopped();
    await new Promise(r => setTimeout(r, 220));

    const wins      = this._evaluateLines();
    let   totalGain = 0;
    for (const w of wins) totalGain += w.gain;

    if (totalGain > 0) {
      this.credits += totalGain;
      this._updateCreditsDisplay(true);
      this._updateCasinoBtn();
      this._highlightWinCells(wins);
      this._showBreakdown(wins);

      if (wins.some(w => w.line.mult === 1.0 && ['pp_sniky','pp_aligax'].includes(w.sym.id))) {
        _sfx.jackpot();
        this._setMsg(`🎰 JACKPOT ${wins[0].sym.name} ! +${totalGain} C`, 'jackpot');
        this._flashReels('gold');
      } else if (totalGain >= this.bet * 15) {
        _sfx.super_win();
        this._setMsg(`⚡ SUPER WIN ×${Math.round(totalGain / this.bet)} — +${totalGain} C`, 'jackpot');
        this._flashReels('gold');
      } else {
        _sfx.win();
        this._setMsg(`✦ +${totalGain} C — ${wins.map(w => w.line.name).join(', ')}`, 'win');
      }
    } else {
      _sfx.lose();
      this._setMsg('— RIEN CETTE FOIS', 'lose');
    }

    const gainEl = document.getElementById('sl-gain');
    if (gainEl) gainEl.textContent = totalGain > 0 ? `+${totalGain}` : '—';

    await this._saveCredits();
    this.spinning = false;
    this._setMsg(
      totalGain > 0 ? 'MAINTENIR LE LEVIER POUR REJOUER' : 'MAINTENIR LE LEVIER POUR JOUER',
      totalGain > 0 ? 'win' : ''
    );
  }

  // ── STOP COLONNE ──────────────────────────────────────────────────────────────
  _stopCol(col) {
    if (this._colStopped[col]) return;
    this._reelPos[col]    = Math.round(this._reelPos[col]) % SlotMachine.REEL_LEN;
    this._reelSpeed[col]  = 0;
    this._colStopped[col] = true;
    this._updateReelDOM(col);
    _sfx.reel_stop(col);
    const reel = document.getElementById(`sl-reel-${col}`);
    if (reel) { reel.classList.add('sl-reel--land'); setTimeout(() => reel.classList.remove('sl-reel--land'), 300); }
  }

  _waitAllStopped() {
    return new Promise(resolve => {
      const check = () => { if (this._colStopped.every(Boolean)) resolve(); else setTimeout(check, 50); };
      check();
    });
  }

  // ── ÉVALUATION LIGNES ──────────────────────────────────────────────────────────
  _evaluateLines() {
    const wins = [];
    for (const line of SlotMachine.WIN_LINES) {
      const syms = line.type === 'h'
        ? Array.from({ length: SlotMachine.COLS }, (_, col) => this._getSymAt(col, line.rowOff))
        : Array.from({ length: SlotMachine.COLS }, (_, col) => this._getSymAt(col, line.rowOffs[col]));
      if (syms.every(s => s && s.id === syms[0].id)) {
        const gain = Math.round(this.bet * syms[0].mult * line.mult);
        wins.push({ line, sym: syms[0], gain });
      }
    }
    return wins;
  }

  // ── HIGHLIGHT TILES — glow coloré par ligne (v3.2) ───────────────────────────
  _highlightWinCells(wins) {
    for (const w of wins) {
      for (let col = 0; col < SlotMachine.COLS; col++) {
        const inner = document.getElementById(`sl-reel-inner-${col}`);
        if (!inner) continue;
        const rowOff  = w.line.type === 'h' ? w.line.rowOff : w.line.rowOffs[col];
        const viewIdx = SlotMachine.ACTIVE_ROW + rowOff;
        const cell    = inner.querySelectorAll('.sl-cell')[viewIdx];
        if (cell) {
          cell.style.setProperty('--line-color', w.line.color);
          cell.classList.add('sl-cell--win');
          setTimeout(() => {
            cell.classList.remove('sl-cell--win');
            cell.style.removeProperty('--line-color');
          }, 2200);
        }
      }
    }
  }

  _clearWin() {
    document.querySelectorAll('.sl-cell--win').forEach(c => {
      c.classList.remove('sl-cell--win');
      c.style.removeProperty('--line-color');
    });
  }

  // ── BREAKDOWN CRÉDITS PAR LIGNE (v3.2) ───────────────────────────────────────
  _showBreakdown(wins) {
    const el = document.getElementById('sl-breakdown');
    if (!el || !wins.length) return;
    el.innerHTML = wins.map(w => `
      <div class="sl-bd-row" style="--bd-color:${w.line.color}">
        <span class="sl-bd-dot"></span>
        <span class="sl-bd-line">${w.line.name}</span>
        <span class="sl-bd-sym" style="color:${w.sym.color}">${w.sym.name}</span>
        <span class="sl-bd-mult">×${w.sym.mult} × ${w.line.mult}</span>
        <span class="sl-bd-gain">+${w.gain} C</span>
      </div>`).join('');
    el.classList.add('sl-breakdown--visible');
  }

  _clearBreakdown() {
    const el = document.getElementById('sl-breakdown');
    if (!el) return;
    el.innerHTML = '';
    el.classList.remove('sl-breakdown--visible');
  }

  // ── ENTRÉE CASINO ─────────────────────────────────────────────────────────────
  async _enterCasino() {
    const cost = SlotMachine.CASINO_COST;
    if (this.credits < cost) { this._setMsg(`CRÉDITS INSUFFISANTS — il faut ${cost} C minimum`, 'lose'); _sfx.lose(); return; }
    _sfx.enter_casino();
    _sfx.coin();
    this.credits -= cost;
    await this._saveCredits();
    this._updateCreditsDisplay(true);
    const btn = document.getElementById('sl-casino-btn');
    if (btn) {
      btn.disabled = true;
      btn.querySelector('.sl-casino-title').textContent = 'ACCÈS ACCORDÉ';
      btn.querySelector('.sl-casino-sub').textContent   = `−${cost} C · CHARGEMENT...`;
      btn.querySelector('.sl-casino-icon').textContent  = '✓';
      btn.classList.add('sl-casino-btn--enter');
    }
    this._setMsg(`✦ −${cost} CHRONICLES · BIENVENUE AU CASINO`, 'win');
    setTimeout(() => { window.location.href = '/arena/arcade-casino/'; }, 900);
  }

  // ── UI HELPERS ─────────────────────────────────────────────────────────────────
  _updateCreditsDisplay(flash = false) {
    const el = document.getElementById('sl-credits');
    if (!el) return;
    el.textContent = this.credits.toLocaleString('fr-FR');
    if (flash) { el.classList.add('sl-num--flash'); setTimeout(() => el.classList.remove('sl-num--flash'), 700); }
  }

  _updateCasinoBtn() {
    const btn = document.getElementById('sl-casino-btn');
    if (!btn) return;
    const canEnter = this.credits >= SlotMachine.CASINO_COST;
    btn.querySelector('.sl-casino-icon').textContent  = canEnter ? '🎰' : '🔒';
    btn.querySelector('.sl-casino-title').textContent = 'CASINO COMPLET';
    btn.querySelector('.sl-casino-sub').textContent   = canEnter
      ? `−${SlotMachine.CASINO_COST} C · ENTRER`
      : `CRÉDITS INSUFFISANTS (min. ${SlotMachine.CASINO_COST})`;
    btn.classList.toggle('sl-casino-btn--locked', !canEnter);
  }

  _setMsg(txt, type) {
    const el = document.getElementById('sl-msg');
    if (!el) return;
    el.textContent = txt;
    el.className   = 'sl-msg' + (type ? ` sl-msg--${type}` : '');
  }

  _changeBet(delta) {
    const bets = [1, 2, 5, 10, 20, 50];
    const idx  = bets.indexOf(this.bet);
    this.bet   = bets[Math.max(0, Math.min(bets.length - 1, idx + delta))];
    const el   = document.getElementById('sl-bet');
    if (el) el.textContent = this.bet;
    _sfx.click();
  }

  _flashReels(type) {
    const el = document.getElementById('sl-reels-wrap');
    if (!el) return;
    el.classList.add(`sl-flash-${type}`);
    setTimeout(() => el.classList.remove(`sl-flash-${type}`), 1400);
  }

  // ── POPUP BIENVENUE ────────────────────────────────────────────────────────────
  _showWelcomePopup() {
    const overlay = document.createElement('div');
    overlay.id    = 'muten-welcome-overlay';
    overlay.innerHTML = `
      <div class="muten-popup" role="dialog" aria-modal="true" aria-label="Message de bienvenue du Commandant Muten">
        <div class="muten-popup-glow" aria-hidden="true"></div>
        <div class="muten-popup-header">
          <img class="muten-avatar" src="../shared/images/pixel_pp/pixel_pp_cowboy.png" alt="Commandant Muten" width="72" height="72">
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
          ${Array.from({length: 10}, () =>
            `<div class="muten-coin" style="--delay:${(Math.random()*0.8).toFixed(2)}s;--x:${Math.floor(Math.random()*90)}%"></div>`
          ).join('')}
        </div>
        <button class="muten-popup-close" id="muten-popup-close">PRENDRE LES CRÉDITS</button>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('muten-welcome-overlay--in'));
    const close = () => {
      _sfx.welcome();
      _sfx.coin();
      overlay.classList.remove('muten-welcome-overlay--in');
      overlay.classList.add('muten-welcome-overlay--out');
      setTimeout(() => overlay.remove(), 500);
    };
    document.getElementById('muten-popup-close')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }
}
