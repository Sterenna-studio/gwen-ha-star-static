/**
 * widgets.js — Widgets autonomes réutilisables pour le hub star/
 * VideoDay    : embed YouTube/PeerTube depuis Supabase table daily_content
 * RadioPlayer : lecteur des musiques du Jukebox (records.json) + visualiseur canvas
 * SlotMachine : machine à sous 3×3 (+ preview haut/bas) — PP pixel art uniquement
 *               stop uniquement sur bouton STOP, monnaie virtuelle chronicles (Supabase)
 */
import { supabase } from '../supabase.js';

// ── SOUND ENGINE ─────────────────────────────────────────────────────────────────────
const _sfx = {
  _ctx: null,
  _unlocked: false,
  // Crée le contexte uniquement après un geste utilisateur
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
    const freqs = [440, 390, 340];
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
  lose() {
    const ctx = this._get(); if (!ctx) return;
    [330, 280, 220].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.12;
      this._tone(f, 'sawtooth', 0.07, 0.01, 0.18, t);
    });
  },
  // boot() supprimé — ne jamais appeler sans geste utilisateur (Chrome AudioContext policy)
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
      // maybeSingle() évite l'erreur 406 / 404 si la table est vide ou absente
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

// ── WEB RADIO ─────────────────────────────────────────────────────────────────────────
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
    const titleEl  = document.getElementById('jk-title');
    const artistEl = document.getElementById('jk-artist');
    const badgeEl  = document.getElementById('jk-badge');
    const coverEl  = document.getElementById('jk-cover');
    const stEl     = document.getElementById('radio-station');
    const selEl    = document.getElementById('radio-playlist');
    if (titleEl)  titleEl.textContent  = t.title  ?? '—';
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

// ── SLOT MACHINE 3×3 + preview ──────────────────────────────────────────────────────
//
//  MODÈLE VISUEL : 5 rangées affichées, la RANGÉE CENTRALE [2] est la ligne active
//
//  ┌─────────────────────────────────┐
//  │  [preview haut]  row 0 — faded  │   ← rangée fantôme haut
//  │  [preview haut]  row 1 — faded  │   ← rangée fantôme haut
//  ├═════════════════════════════════╡
//  │  [ ACTIF ]       row 2 — plein  │   ◄ LIGNE DE GAIN PRINCIPALE
//  ├═════════════════════════════════╡
//  │  [preview bas]   row 3 — faded  │   ← rangée fantôme bas
//  │  [preview bas]   row 4 — faded  │   ← rangée fantôme bas
//  └─────────────────────────────────┘
//
//  3 COLONNES — stop uniquement sur bouton STOP individuel (pas d'auto-stop)
//  Symboles : PP pixel art + véhicules (pool pondéré)
//  Monnaie  : chronicles (Supabase profiles.chronicles)
//  Lignes   : L0 milieu (off 0) ×1.0 | L1 haut (off -1) ×0.5 | L2 bas (off +1) ×0.5
//  SFX      : déclenchés UNIQUEMENT sur action utilisateur (Chrome autoplay policy)

export class SlotMachine {
  static IMG_BASE = '../shared/images';

  static SYMBOLS = [
    { id: 'pp_sniky',  name: 'SNIKY',  img: 'pixel_pp/pixel_pp_sniky.png',  mult: 50, rare: 1, color: '#f87171' },
    { id: 'pp_aligax', name: 'ALIGAX', img: 'pixel_pp/pixel_pp_aligax.png', mult: 50, rare: 1, color: '#34d399' },
    { id: 'pp_cowboy', name: 'COWBOY', img: 'pixel_pp/pixel_pp_cowboy.png', mult: 40, rare: 2, color: '#ffd700' },
    { id: 'pp_abad',   name: 'ABAD',   img: 'pixel_pp/pixel_pp_abad.png',   mult: 40, rare: 2, color: '#a78bfa' },
    { id: 'pp_spirit', name: 'SPIRIT', img: 'pixel_pp/pixel_pp_spirit.png', mult: 30, rare: 3, color: '#60a5fa' },
    { id: 'mash',      name: 'MASH',    img: 'vehicule/mash.png',           mult: 20, rare: 4, color: '#fbbf24' },
    { id: 'barossa',   name: 'BAROSSA', img: 'vehicule/barossa.png',        mult: 12, rare: 6, color: '#f97316' },
    { id: 'citroenax', name: 'AX',      img: 'vehicule/citroenAX.png',      mult:  6, rare: 9, color: '#ef4444' },
  ];

  static WIN_LINES = [
    { id: 'L0', name: 'MILIEU', rowOff:  0, color: '#00ff80', mult: 1.0 },
    { id: 'L1', name: 'HAUT',   rowOff: -1, color: '#60a5fa', mult: 0.5 },
    { id: 'L2', name: 'BAS',    rowOff: +1, color: '#f97316', mult: 0.5 },
  ];

  static COLS         = 3;
  static VISIBLE_ROWS = 5;
  static ACTIVE_ROW   = 2;
  static REEL_LEN     = 24;
  static WELCOME_CREDITS = 1000;

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
  }

  // ── INIT ──────────────────────────────────────────────────────────────────────────
  async init(userId) {
    if (userId) this.userId = userId;
    await this._loadCredits();
    this._render();
    this._startRenderLoop();
    // ✅ Pas de _sfx.boot() ici — AudioContext interdit avant geste utilisateur
    if (this._isNew) setTimeout(() => this._showWelcomePopup(), 800);
  }

  // ── SUPABASE ──────────────────────────────────────────────────────────────────────
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
          this.credits = SlotMachine.WELCOME_CREDITS;
          this._isNew  = true;
          await this._saveCredits();
        } else {
          this.credits = stored;
        }
      } else {
        this.credits = 100;
      }
    } catch { this.credits = 100; }
  }

  async _saveCredits() {
    if (!this.userId) return;
    try {
      await supabase
        .from('profiles')
        .update({ chronicles: this.credits })
        .eq('id', this.userId);
      const kpiEl = document.getElementById('kpi-chronicles');
      if (kpiEl) kpiEl.textContent = this.credits.toLocaleString('fr-FR');
    } catch { /* silencieux */ }
  }

  // ── POOL & BANDE ──────────────────────────────────────────────────────────────────
  _buildPool() {
    const pool = [];
    for (const sym of SlotMachine.SYMBOLS)
      for (let i = 0; i < sym.rare; i++) pool.push(sym);
    return pool;
  }

  _roll() {
    return this._pool[Math.floor(Math.random() * this._pool.length)];
  }

  _buildReel() {
    return Array.from({ length: SlotMachine.REEL_LEN }, () => this._roll());
  }

  _getSymAt(col, rowOffset) {
    const pos = this._reelPos[col];
    const len = SlotMachine.REEL_LEN;
    const idx = ((Math.floor(pos) + rowOffset) % len + len) % len;
    return this._reels[col][idx];
  }

  // ── RENDER HTML ───────────────────────────────────────────────────────────────────
  _render() {
    if (!this.el) return;
    const COLS = SlotMachine.COLS;

    const reelsHTML = Array.from({ length: COLS }, (_, col) => `
      <div class="slot-reel3" id="slot-reel3-${col}">
        <div class="slot-reel3-inner" id="slot-reel3-inner-${col}">
          ${this._buildReelCells(col)}
        </div>
        <div class="slot-reel3-frame"></div>
        <div class="slot-reel3-scanline"></div>
      </div>`).join('');

    const stopBtnsHTML = Array.from({ length: COLS }, (_, col) =>
      `<button class="slot-stop-btn3" id="slot-stop3-${col}" disabled aria-label="Stopper rouleau ${col+1}">STOP ${col+1}</button>`
    ).join('');

    const paytableRows = [...SlotMachine.SYMBOLS]
      .sort((a,b) => b.mult - a.mult)
      .map(s => `<div class="slot-pay-row">
        <img src="${SlotMachine.IMG_BASE}/${s.img}" alt="${s.name}" width="24" height="24" loading="lazy">
        <span class="slot-pay-name" style="color:${s.color}">${s.name}</span>
        <span class="slot-pay-mult">x${s.mult}</span>
      </div>`).join('');

    this.el.innerHTML = `
      <div class="slot-machine3">

        <!-- Crédits -->
        <div class="slot3-credits-panel">
          <div class="slot3-credit-block">
            <span class="slot3-lbl">CREDITS</span>
            <span class="slot3-num" id="slot3-credits">${this.credits.toLocaleString('fr-FR')}</span>
          </div>
          <div class="slot3-credit-block">
            <span class="slot3-lbl">MISE</span>
            <div class="slot3-bet-row">
              <button class="slot3-bet-btn" id="slot3-bet-down">−</button>
              <span class="slot3-num" id="slot3-bet">${this.bet}</span>
              <button class="slot3-bet-btn" id="slot3-bet-up">+</button>
            </div>
          </div>
          <div class="slot3-credit-block">
            <span class="slot3-lbl">GAIN</span>
            <span class="slot3-num slot3-gain" id="slot3-gain">—</span>
          </div>
        </div>

        <!-- Machine -->
        <div class="slot3-cabinet">
          <!-- Légende lignes -->
          <div class="slot3-line-labels">
            <span class="slot3-line-tag" style="--lc:#60a5fa">HAUT ×0.5</span>
            <span class="slot3-line-tag slot3-line-tag--main" style="--lc:#00ff80">MILIEU ×1</span>
            <span class="slot3-line-tag" style="--lc:#f97316">BAS ×0.5</span>
          </div>

          <!-- Rouleaux -->
          <div class="slot3-reels-wrap" id="slot3-reels-wrap">
            ${reelsHTML}
            <!-- Lignes overlay -->
            <div class="slot3-line-overlay slot3-line-overlay--top"  style="--lc:#60a5fa"></div>
            <div class="slot3-line-overlay slot3-line-overlay--mid"  style="--lc:#00ff80"></div>
            <div class="slot3-line-overlay slot3-line-overlay--bot"  style="--lc:#f97316"></div>
          </div>

          <!-- Boutons STOP -->
          <div class="slot3-stop-row">
            ${stopBtnsHTML}
          </div>
        </div>

        <!-- Message -->
        <div class="slot3-msg" id="slot3-msg">APPUYER SUR SPIN</div>

        <!-- SPIN -->
        <button class="slot3-spin-btn" id="slot3-spin">SPIN</button>

        <!-- Paytable -->
        <details class="slot3-paytable">
          <summary>TABLE DES GAINS</summary>
          <div class="slot3-paytable-body">
            <p class="slot3-pay-hint">3 IDENTIQUES SUR UNE LIGNE = GAIN<br>MILIEU ×1 · HAUT/BAS ×0.5</p>
            ${paytableRows}
          </div>
        </details>
      </div>`;

    document.getElementById('slot3-spin')?.addEventListener('click',    () => this.spin());
    document.getElementById('slot3-bet-up')?.addEventListener('click',  () => this._changeBet(1));
    document.getElementById('slot3-bet-down')?.addEventListener('click',() => this._changeBet(-1));
    for (let col = 0; col < COLS; col++) {
      document.getElementById(`slot-stop3-${col}`)?.addEventListener('click', () => {
        _sfx.click();
        this._stopCol(col);
      });
    }
  }

  // ── BUILD CELLS HTML ──────────────────────────────────────────────────────────────
  _buildReelCells(col) {
    const offsets = [-2, -1, 0, 1, 2];
    return offsets.map((off, i) => {
      const sym = this._getSymAt(col, off);
      const isActive = (i === SlotMachine.ACTIVE_ROW);
      return `<div class="slot3-cell${isActive ? ' slot3-cell--active' : ''}" data-off="${off}">
        ${this._symHTML(sym, isActive)}
      </div>`;
    }).join('');
  }

  _symHTML(sym, active = false) {
    if (!sym) return '<div class="slot3-sym-empty"></div>';
    return `<div class="slot3-sym" data-id="${sym.id}" style="--sym-color:${sym.color}">
      <img src="${SlotMachine.IMG_BASE}/${sym.img}" alt="${sym.name}" width="${active ? 56 : 40}" height="${active ? 56 : 40}" loading="lazy" onerror="this.style.opacity='0.15'">
      <span class="slot3-sym-name">${sym.name}</span>
    </div>`;
  }

  // ── RENDER LOOP (rAF) ─────────────────────────────────────────────────────────────
  _startRenderLoop() {
    const loop = () => {
      this._animId = requestAnimationFrame(loop);
      let anySpinning = false;
      for (let col = 0; col < SlotMachine.COLS; col++) {
        if (!this._colStopped[col]) {
          anySpinning = true;
          this._reelPos[col] = (this._reelPos[col] + this._reelSpeed[col]) % SlotMachine.REEL_LEN;
          this._updateReelDOM(col);
        }
      }
      // tick SFX seulement si rouleaux actifs (déjà dans un contexte de geste utilisateur)
      if (anySpinning && Math.random() < 0.04) _sfx.tick();
    };
    loop();
  }

  _updateReelDOM(col) {
    const inner = document.getElementById(`slot-reel3-inner-${col}`);
    if (!inner) return;
    const cells  = inner.querySelectorAll('.slot3-cell');
    const offsets = [-2, -1, 0, 1, 2];
    offsets.forEach((off, i) => {
      const sym = this._getSymAt(col, off);
      const isActive = (i === SlotMachine.ACTIVE_ROW);
      const cell = cells[i];
      if (!cell) return;
      cell.innerHTML = this._symHTML(sym, isActive);
    });
  }

  // ── SPIN ──────────────────────────────────────────────────────────────────────────
  async spin() {
    if (this.spinning) return;
    if (this.credits < this.bet) { this._setMsg('CREDITS INSUFFISANTS', 'red'); return; }

    this.spinning = true;
    this.credits -= this.bet;
    this._updateCreditsDisplay();
    _sfx.lever(); // ✅ ici = après clic utilisateur → AudioContext autorisé
    this._setMsg('LANCÉ — STOPPE LES ROULEAUX !', '');
    this._clearGainHighlight();

    for (let col = 0; col < SlotMachine.COLS; col++) {
      this._reels[col] = this._buildReel();
    }

    this._reelSpeed  = [0.18, 0.20, 0.22];
    this._colStopped = Array(SlotMachine.COLS).fill(false);

    const spinBtn = document.getElementById('slot3-spin');
    if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = 'EN COURS...'; }
    for (let col = 0; col < SlotMachine.COLS; col++) {
      const btn = document.getElementById(`slot-stop3-${col}`);
      if (btn) { btn.disabled = false; btn.classList.add('slot-stop-btn3--active'); }
    }

    await this._waitAllStopped();
    await new Promise(r => setTimeout(r, 220));

    const wins = this._evaluateLines();
    let totalGain = 0;
    for (const w of wins) totalGain += Math.round(this.bet * w.sym.mult * w.line.mult);

    if (totalGain > 0) {
      this.credits += totalGain;
      this._updateCreditsDisplay(true);
      this._highlightWinCells(wins);
      if (wins.some(w => w.line.mult === 1.0 && ['pp_sniky','pp_aligax'].includes(w.sym.id))) {
        _sfx.jackpot();
        this._setMsg(`JACKPOT ${wins[0].sym.name} ! +${totalGain} C`, 'jackpot');
        this._flashWrap('gold');
      } else if (totalGain >= this.bet * 15) {
        _sfx.super_win();
        this._setMsg(`SUPER WIN ×${Math.round(totalGain/this.bet)} — +${totalGain} C`, 'jackpot');
        this._flashWrap('gold');
      } else {
        _sfx.win();
        this._setMsg(`+${totalGain} C — ${wins.map(w => w.line.name).join(', ')}`, 'win');
      }
    } else {
      _sfx.lose();
      this._setMsg('— RIEN CETTE FOIS', 'lose');
    }

    const gainEl = document.getElementById('slot3-gain');
    if (gainEl) gainEl.textContent = totalGain > 0 ? `+${totalGain}` : '—';

    if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = 'SPIN'; }
    for (let col = 0; col < SlotMachine.COLS; col++) {
      const btn = document.getElementById(`slot-stop3-${col}`);
      if (btn) { btn.disabled = true; btn.classList.remove('slot-stop-btn3--active'); }
    }

    await this._saveCredits();
    this.spinning = false;
  }

  // ── STOP UNE COLONNE ──────────────────────────────────────────────────────────────
  _stopCol(col) {
    if (this._colStopped[col] || !this.spinning) return;
    this._reelPos[col] = Math.round(this._reelPos[col]) % SlotMachine.REEL_LEN;
    this._reelSpeed[col] = 0;
    this._colStopped[col] = true;
    this._updateReelDOM(col);
    _sfx.reel_stop(col);

    const reel = document.getElementById(`slot-reel3-${col}`);
    if (reel) {
      reel.classList.add('slot-reel3--land');
      setTimeout(() => reel.classList.remove('slot-reel3--land'), 300);
    }

    const btn = document.getElementById(`slot-stop3-${col}`);
    if (btn) { btn.disabled = true; btn.classList.remove('slot-stop-btn3--active'); }
  }

  // ── WAIT ALL STOPPED ──────────────────────────────────────────────────────────────
  _waitAllStopped() {
    return new Promise(resolve => {
      const check = () => {
        if (this._colStopped.every(Boolean)) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  // ── ÉVALUATION ────────────────────────────────────────────────────────────────────
  _evaluateLines() {
    const wins = [];
    for (const line of SlotMachine.WIN_LINES) {
      const syms = Array.from({ length: SlotMachine.COLS }, (_, col) =>
        this._getSymAt(col, line.rowOff));
      if (syms.every(s => s && s.id === syms[0].id)) {
        wins.push({ line, sym: syms[0] });
      }
    }
    return wins;
  }

  // ── HIGHLIGHT WINS ────────────────────────────────────────────────────────────────
  _highlightWinCells(wins) {
    for (const w of wins) {
      const viewIdx = SlotMachine.ACTIVE_ROW + w.line.rowOff;
      for (let col = 0; col < SlotMachine.COLS; col++) {
        const inner = document.getElementById(`slot-reel3-inner-${col}`);
        if (!inner) continue;
        const cells = inner.querySelectorAll('.slot3-cell');
        const cell  = cells[viewIdx];
        if (cell) {
          cell.classList.add('slot3-cell--win');
          setTimeout(() => cell.classList.remove('slot3-cell--win'), 1800);
        }
      }
    }
  }

  _clearGainHighlight() {
    document.querySelectorAll('.slot3-cell--win').forEach(c => c.classList.remove('slot3-cell--win'));
  }

  // ── UI ────────────────────────────────────────────────────────────────────────────
  _updateCreditsDisplay(flash = false) {
    const el = document.getElementById('slot3-credits');
    if (!el) return;
    el.textContent = this.credits.toLocaleString('fr-FR');
    if (flash) {
      el.classList.add('slot3-num--flash');
      setTimeout(() => el.classList.remove('slot3-num--flash'), 700);
    }
  }

  _setMsg(txt, type) {
    const el = document.getElementById('slot3-msg');
    if (!el) return;
    el.textContent = txt;
    el.className = 'slot3-msg' + (type ? ` slot3-msg--${type}` : '');
  }

  _changeBet(delta) {
    const bets = [1, 2, 5, 10, 20, 50];
    const idx  = bets.indexOf(this.bet);
    this.bet   = bets[Math.max(0, Math.min(bets.length - 1, idx + delta))];
    const el   = document.getElementById('slot3-bet');
    if (el) el.textContent = this.bet;
    _sfx.click();
  }

  _flashWrap(type) {
    const el = document.getElementById('slot3-reels-wrap');
    if (!el) return;
    el.classList.add(`slot3-flash-${type}`);
    setTimeout(() => el.classList.remove(`slot3-flash-${type}`), 1400);
  }

  // ── POPUP BIENVENUE ───────────────────────────────────────────────────────────────
  _showWelcomePopup() {
    // _sfx.welcome() déplacé dans le handler du bouton close (geste utilisateur requis)
    const overlay = document.createElement('div');
    overlay.id = 'muten-welcome-overlay';
    overlay.innerHTML = `
      <div class="muten-popup" role="dialog" aria-modal="true" aria-label="Message de bienvenue du Commandant Muten">
        <div class="muten-popup-glow" aria-hidden="true"></div>
        <div class="muten-popup-header">
          <img class="muten-avatar"
               src="../shared/images/pixel_pp/pixel_pp_cowboy.png"
               alt="Commandant Muten" width="72" height="72">
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
    requestAnimationFrame(() => overlay.classList.add('muten-welcome-overlay--in'));

    const close = () => {
      _sfx.welcome(); // ✅ son déclenché sur clic utilisateur → AudioContext autorisé
      _sfx.coin();
      overlay.classList.remove('muten-welcome-overlay--in');
      overlay.classList.add('muten-welcome-overlay--out');
      setTimeout(() => overlay.remove(), 500);
    };
    document.getElementById('muten-popup-close')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }
}
