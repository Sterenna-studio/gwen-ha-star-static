/**
 * widgets.js — Widgets autonomes réutilisables pour le hub star/
 * VideoDay    : embed YouTube/PeerTube depuis Supabase table daily_content
 * RadioPlayer : lecteur des musiques du Jukebox (records.json) + visualiseur canvas
 * SlotMachine : machine à sous casino (cosmétique, sans enjeux réels)
 */
import { supabase } from '../supabase.js';

// ── SOUND ENGINE (léger, Web Audio API) ───────────────────────────────────────
const _sfx = {
  _ctx: null,
  _get() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },
  _tone(freq, type, vol, attack, decay) {
    const ctx = this._get(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + attack + decay);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + attack + decay + 0.01);
  },
  click()   { this._tone(880,  'sine',     0.08, 0.005, 0.06); },
  hover()   { this._tone(1200, 'sine',     0.04, 0.003, 0.04); },
  nav()     { this._tone(660,  'triangle', 0.07, 0.005, 0.08); },
  spin()    {
    const ctx = this._get(); if (!ctx) return;
    // bruit blanc court
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.12;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf; src.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
    src.start();
  },
  win()     {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._tone(f, 'triangle', 0.1, 0.01, 0.12), i * 80));
  },
  jackpot() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this._tone(f, 'square', 0.08, 0.01, 0.18), i * 60));
  },
  lose()    { this._tone(220, 'sawtooth', 0.07, 0.01, 0.25); },
  boot()    {
    [440, 550, 660].forEach((f, i) =>
      setTimeout(() => this._tone(f, 'sine', 0.06, 0.01, 0.1), i * 100));
  },
};
export const SFX = _sfx;

// ── VIDEO DU JOUR ─────────────────────────────────────────────────────────────
export class VideoDay {
  constructor(containerId) {
    this.el = document.getElementById(containerId);
  }

  async load() {
    if (!this.el) return;
    try {
      const { data, error } = await supabase
        .from('daily_content')
        .select('video_url, title, note')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) { this._renderPlaceholder(); return; }
      this._renderEmbed(data);
    } catch { this._renderPlaceholder(); }
  }

  _youtubeId(url) {
    const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)?([\w-]{11})(?:[?&]|$)/);
    return m ? m[1] : null;
  }

  _renderEmbed({ video_url, title, note }) {
    const ytId = this._youtubeId(video_url);
    const src  = ytId
      ? `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`
      : video_url;
    this.el.innerHTML = `
      <div class="widget-video-inner">
        ${ title ? `<p class="widget-video-title">${title}</p>` : '' }
        <div class="video-embed-wrap">
          <iframe src="${src}" title="${title ?? 'Vidéo du jour'}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen loading="lazy"></iframe>
        </div>
        ${ note ? `<p class="widget-video-note">${note}</p>` : '' }
      </div>
    `;
  }

  _renderPlaceholder() {
    this.el.innerHTML = `
      <div class="widget-empty">
        <span class="widget-empty-icon">▶</span>
        <p>Aucune vidéo programmée</p>
        <span class="widget-empty-sub">DAILY_CONTENT · OFFLINE</span>
      </div>
    `;
  }
}

// ── JUKEBOX RADIO ─────────────────────────────────────────────────────────────
export class RadioPlayer {
  constructor(containerId) {
    this.el       = document.getElementById(containerId);
    this.tracks   = [];
    this.current  = 0;
    this.audio    = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.playing  = false;
    this._ctx     = null;
    this._analyser = null;
    this._animId  = null;
  }

  async render() {
    if (!this.el) return;
    await this._loadTracks();
    this._buildUI();
    this._bind();
  }

  async _loadTracks() {
    try {
      const res  = await fetch('/jukebox/records.json?_=' + Date.now());
      const data = await res.json();
      this.tracks = Array.isArray(data)
        ? data.filter(r => r.display !== false)
        : [];
    } catch {
      this.tracks = [];
    }
  }

  // Encode correctement les chemins avec espaces / apostrophes
  _srcFor(track) {
    const raw = track.src ?? '';
    // Encode chaque segment séparément pour ne pas encoder les /
    const encoded = raw.split('/').map(seg => encodeURIComponent(seg)).join('/');
    return '/jukebox/' + encoded;
  }

  _label(track) {
    return `${track.artist ?? 'Dr.Spig'} — ${track.title ?? '(sans titre)'}`;
  }

  _buildUI() {
    if (!this.tracks.length) {
      this.el.innerHTML = `
        <div class="widget-empty">
          <span class="widget-empty-icon">♪</span>
          <p>Aucune musique disponible</p>
          <span class="widget-empty-sub">JUKEBOX · OFFLINE</span>
        </div>`;
      return;
    }

    const t = this.tracks[this.current];
    const opts = this.tracks.map((tr, i) =>
      `<option value="${i}" ${i === this.current ? 'selected' : ''}>${tr.artist ?? 'Dr.Spig'} — ${tr.title}</option>`
    ).join('');

    this.el.innerHTML = `
      <div class="radio-player">
        <div class="jk-track-row">
          <div class="jk-cover" id="jk-cover" aria-hidden="true"
               style="--jk-c1:${t.coverColor ?? '#14161a'};--jk-c2:${t.labelColor ?? '#050608'}">
            ${t.coverImage
              ? `<img src="/jukebox/${t.coverImage}" alt="" width="48" height="48" loading="lazy">`
              : `<span class="jk-cover-fallback">♪</span>`
            }
          </div>
          <div class="jk-info">
            <div class="jk-artist" id="jk-artist">${t.artist ?? 'Dr.Spig'}</div>
            <div class="jk-title"  id="jk-title">${t.title}</div>
            <div class="jk-badge">JUKEBOX · BZH</div>
          </div>
          <div class="radio-status" style="margin-left:auto;flex-shrink:0">
            <span class="radio-led" id="radio-led"></span>
            <span class="radio-station" id="radio-station">STOP</span>
          </div>
        </div>

        <select class="radio-select" id="radio-select" aria-label="Choisir une piste">${opts}</select>

        <canvas class="radio-viz" id="radio-viz" width="400" height="36" aria-hidden="true"></canvas>

        <div class="jk-progress-wrap">
          <span class="jk-time" id="jk-cur">0:00</span>
          <input type="range" class="jk-seek" id="jk-seek" min="0" max="100" value="0" step="0.1" aria-label="Position">
          <span class="jk-time" id="jk-dur">-:--</span>
        </div>

        <div class="radio-controls">
          <button class="radio-btn radio-btn-sm" id="radio-prev" aria-label="Précédent">◁◁</button>
          <button class="radio-btn" id="radio-play" aria-label="Lecture / Pause">
            <span id="radio-btn-icon">▶</span>
          </button>
          <button class="radio-btn radio-btn-sm" id="radio-next" aria-label="Suivant">▷▷</button>
          <div class="radio-vol-wrap">
            <span class="radio-vol-icon" aria-hidden="true">◁</span>
            <input type="range" class="radio-vol" id="radio-vol"
              min="0" max="1" step="0.05" value="0.7" aria-label="Volume">
          </div>
        </div>
      </div>
    `;
  }

  _bind() {
    document.getElementById('radio-play')?.addEventListener('click', () => { _sfx.click(); this._togglePlay(); });
    document.getElementById('radio-prev')?.addEventListener('click', () => { _sfx.nav(); this._skip(-1); });
    document.getElementById('radio-next')?.addEventListener('click', () => { _sfx.nav(); this._skip(+1); });
    document.getElementById('radio-vol')?.addEventListener('input', e => {
      this.audio.volume = parseFloat(e.target.value);
    });
    document.getElementById('radio-select')?.addEventListener('change', e => {
      _sfx.nav();
      this._loadTrack(parseInt(e.target.value, 10), this.playing);
    });
    document.getElementById('jk-seek')?.addEventListener('input', e => {
      if (this.audio.duration && !isNaN(this.audio.duration))
        this.audio.currentTime = (parseFloat(e.target.value) / 100) * this.audio.duration;
    });

    this.audio.addEventListener('timeupdate',    () => this._onTimeUpdate());
    this.audio.addEventListener('loadedmetadata',() => this._onMeta());
    this.audio.addEventListener('ended',         () => this._skip(+1));
    this.audio.volume = 0.7;
  }

  _skip(dir) {
    if (!this.tracks.length) return;
    const next = (this.current + dir + this.tracks.length) % this.tracks.length;
    this._loadTrack(next, this.playing);
  }

  _loadTrack(idx, autoplay = false) {
    this.current = idx;
    const t = this.tracks[idx];
    this.audio.src = this._srcFor(t);

    const cover   = document.getElementById('jk-cover');
    const artist  = document.getElementById('jk-artist');
    const title   = document.getElementById('jk-title');
    const sel     = document.getElementById('radio-select');
    const station = document.getElementById('radio-station');

    if (artist) artist.textContent = t.artist ?? 'Dr.Spig';
    if (title)  title.textContent  = t.title;
    if (cover) {
      cover.style.setProperty('--jk-c1', t.coverColor ?? '#14161a');
      cover.style.setProperty('--jk-c2', t.labelColor ?? '#050608');
      cover.innerHTML = t.coverImage
        ? `<img src="/jukebox/${t.coverImage}" alt="" width="48" height="48" loading="lazy">`
        : `<span class="jk-cover-fallback">♪</span>`;
    }
    if (sel) sel.value = idx;
    if (station) station.textContent = this.playing ? '▶ EN COURS' : 'CHARGÉ';

    document.getElementById('jk-cur').textContent = '0:00';
    document.getElementById('jk-dur').textContent = '-:--';
    document.getElementById('jk-seek').value = 0;

    if (autoplay) {
      this.audio.play().catch(() => {});
      document.getElementById('radio-btn-icon').textContent = '■';
      document.getElementById('radio-led').classList.add('active');
      if (station) station.textContent = '▶ EN COURS';
    }
  }

  _togglePlay() {
    if (!this.tracks.length) return;
    if (this.playing) {
      this.audio.pause();
      this.playing = false;
      document.getElementById('radio-btn-icon').textContent = '▶';
      document.getElementById('radio-led').classList.remove('active');
      document.getElementById('radio-station').textContent = 'PAUSE';
      if (this._animId) cancelAnimationFrame(this._animId);
    } else {
      if (!this.audio.src || this.audio.src === window.location.href) {
        this.audio.src = this._srcFor(this.tracks[this.current]);
      }
      this.audio.play().then(() => {
        this.playing = true;
        document.getElementById('radio-btn-icon').textContent = '■';
        document.getElementById('radio-led').classList.add('active');
        document.getElementById('radio-station').textContent = '▶ EN COURS';
        this._initViz();
      }).catch(() => {
        document.getElementById('radio-station').textContent = 'ERREUR LECTURE';
      });
    }
  }

  _onTimeUpdate() {
    const cur = this.audio.currentTime;
    const dur = this.audio.duration;
    if (isNaN(dur)) return;
    const seek  = document.getElementById('jk-seek');
    const curEl = document.getElementById('jk-cur');
    if (seek)  seek.value = (cur / dur) * 100;
    if (curEl) curEl.textContent = this._fmt(cur);
  }

  _onMeta() {
    const el = document.getElementById('jk-dur');
    if (el) el.textContent = this._fmt(this.audio.duration || 0);
  }

  _fmt(sec) {
    sec = Math.floor(sec);
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  _initViz() {
    if (this._ctx) { this._drawLoop(); return; }
    try {
      const actx      = new (window.AudioContext || window.webkitAudioContext)();
      const src       = actx.createMediaElementSource(this.audio);
      this._analyser  = actx.createAnalyser();
      this._analyser.fftSize = 64;
      src.connect(this._analyser);
      this._analyser.connect(actx.destination);
      this._ctx = actx;
    } catch { return; }
    this._drawLoop();
  }

  _drawLoop() {
    const canvas = document.getElementById('radio-viz');
    if (!canvas || !this._analyser) return;
    const ctx = canvas.getContext('2d');
    const buf = new Uint8Array(this._analyser.frequencyBinCount);
    const draw = () => {
      if (!this.playing) return;
      this._animId = requestAnimationFrame(draw);
      this._analyser.getByteFrequencyData(buf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barW  = (canvas.width / buf.length) * 1.8;
      let x = 0;
      const color = getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() || '#39ff14';
      ctx.fillStyle = color;
      buf.forEach(v => {
        const h = (v / 255) * canvas.height;
        ctx.fillRect(x, canvas.height - h, barW - 1, h);
        x += barW;
      });
    };
    draw();
  }
}

// ── MACHINE À SOUS CASINO ─────────────────────────────────────────────────────
export class SlotMachine {
  constructor(containerId) {
    this.el      = document.getElementById(containerId);
    this.credits = 100;
    this.bet     = 5;
    this.spinning = false;

    this.SYMBOLS = [
      { glyph: '7',  label: 'SEPT',    weight: 2,  mult: 20,  color: '#ff4444' },
      { glyph: '★',  label: 'ÉTOILE',  weight: 4,  mult: 8,   color: '#ffd700' },
      { glyph: '♦',  label: 'DIAMANT', weight: 6,  mult: 5,   color: '#00cfff' },
      { glyph: '♣',  label: 'TRÈFLE',  weight: 8,  mult: 3,   color: '#39ff14' },
      { glyph: '♥',  label: 'CŒUR',    weight: 10, mult: 2,   color: '#ff69b4' },
      { glyph: '🍋', label: 'CITRON',  weight: 14, mult: 1.5, color: '#ffe066' },
      { glyph: '🍒', label: 'CERISE',  weight: 16, mult: 1,   color: '#ff6666' },
      { glyph: '🔔', label: 'CLOCHE',  weight: 18, mult: 1,   color: '#ffd700' },
      { glyph: '🍀', label: 'TRÈFLE',  weight: 22, mult: 0,   color: '#39ff14' },
    ];

    this._pool = [];
    for (const s of this.SYMBOLS)
      for (let i = 0; i < s.weight; i++) this._pool.push(s);
  }

  render() {
    if (!this.el) return;
    this.el.innerHTML = `
      <div class="slot-machine" id="slot-root">
        <div class="slot-header">
          <div class="slot-credit-box">
            <span class="slot-lbl">CRÉDITS</span>
            <span class="slot-credit-val" id="slot-credits">${this.credits}</span>
          </div>
          <div class="slot-credit-box">
            <span class="slot-lbl">MISE</span>
            <div class="slot-bet-row">
              <button class="slot-bet-btn" id="slot-bet-down" aria-label="Réduire la mise">−</button>
              <span class="slot-credit-val" id="slot-bet">${this.bet}</span>
              <button class="slot-bet-btn" id="slot-bet-up" aria-label="Augmenter la mise">+</button>
            </div>
          </div>
          <div class="slot-credit-box" style="text-align:right">
            <span class="slot-lbl">GAIN</span>
            <span class="slot-credit-val slot-gain" id="slot-gain">·</span>
          </div>
        </div>

        <div class="slot-reels" aria-live="polite" aria-atomic="true">
          <div class="slot-reel-wrap"><div class="slot-reel" id="slot-reel-0"><span class="slot-sym">?</span></div></div>
          <div class="slot-reel-wrap"><div class="slot-reel" id="slot-reel-1"><span class="slot-sym">?</span></div></div>
          <div class="slot-reel-wrap"><div class="slot-reel" id="slot-reel-2"><span class="slot-sym">?</span></div></div>
        </div>

        <div class="slot-msg" id="slot-msg" aria-live="polite"></div>

        <button class="slot-spin-btn" id="slot-spin" aria-label="Lancer les rouleaux">
          <span id="slot-spin-label">SPIN ⚡</span>
        </button>

        <details class="slot-paytable">
          <summary class="slot-paytable-toggle">TABLE DES GAINS ▾</summary>
          <div class="slot-paytable-body">
            ${this.SYMBOLS.filter(s => s.mult > 0).map(s =>
              `<div class="slot-pay-row">
                <span class="slot-pay-sym" style="colo