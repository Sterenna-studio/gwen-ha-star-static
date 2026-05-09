/**
 * widgets.js — Widgets autonomes réutilisables pour le hub star/
 * VideoDay    : embed YouTube/PeerTube depuis Supabase table daily_content
 * RadioPlayer : lecteur des musiques du Jukebox (records.json) + visualiseur canvas
 * SlotMachine : machine à sous casino (cosmétique, sans enjeux réels)
 */
import { supabase } from '../supabase.js';

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
// Charge les tracks depuis /jukebox/records.json et les joue dans le widget radio
export class RadioPlayer {
  constructor(containerId) {
    this.el       = document.getElementById(containerId);
    this.tracks   = [];   // rempli depuis records.json
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

  // ── Charge le records.json du Jukebox ──────────────────────────────────────
  async _loadTracks() {
    try {
      const res = await fetch('/jukebox/records.json?_=' + Date.now());
      const data = await res.json();
      this.tracks = Array.isArray(data)
        ? data.filter(r => r.display !== false)
        : [];
    } catch {
      this.tracks = [];
    }
  }

  _srcFor(track) {
    return '/jukebox/' + track.src;
  }

  _label(track) {
    return `${track.artist ?? 'Dr.Spig'} — ${track.title ?? '(sans titre)'}`;
  }

  // ── Construction HTML ──────────────────────────────────────────────────────
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

        <!-- Cover + infos piste -->
        <div class="jk-track-row">
          <div class="jk-cover" id="jk-cover" aria-hidden="true"
               style="--jk-c1:${t.coverColor ?? '#14161a'};--jk-c2:${t.labelColor ?? '#050608'}"
               ${t.coverImage ? `style="background-image:url('/jukebox/${t.coverImage}');--jk-c1:${t.coverColor ?? '#14161a'};--jk-c2:${t.labelColor ?? '#050608'}"` : ''}>
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

        <!-- Sélecteur de piste -->
        <select class="radio-select" id="radio-select" aria-label="Choisir une piste">${opts}</select>

        <!-- Visualiseur canvas -->
        <canvas class="radio-viz" id="radio-viz" width="400" height="36" aria-hidden="true"></canvas>

        <!-- Barre de progression -->
        <div class="jk-progress-wrap">
          <span class="jk-time" id="jk-cur">0:00</span>
          <input type="range" class="jk-seek" id="jk-seek" min="0" max="100" value="0" step="0.1" aria-label="Position">
          <span class="jk-time" id="jk-dur">-:--</span>
        </div>

        <!-- Contrôles -->
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

  // ── Binding événements ─────────────────────────────────────────────────────
  _bind() {
    document.getElementById('radio-play')?.addEventListener('click', () => this._togglePlay());
    document.getElementById('radio-prev')?.addEventListener('click', () => this._skip(-1));
    document.getElementById('radio-next')?.addEventListener('click', () => this._skip(+1));
    document.getElementById('radio-vol')?.addEventListener('input', e => {
      this.audio.volume = parseFloat(e.target.value);
    });
    document.getElementById('radio-select')?.addEventListener('change', e => {
      this._loadTrack(parseInt(e.target.value, 10), this.playing);
    });
    document.getElementById('jk-seek')?.addEventListener('input', e => {
      if (this.audio.duration && !isNaN(this.audio.duration))
        this.audio.currentTime = (parseFloat(e.target.value) / 100) * this.audio.duration;
    });

    this.audio.addEventListener('timeupdate', () => this._onTimeUpdate());
    this.audio.addEventListener('loadedmetadata', () => this._onMeta());
    this.audio.addEventListener('ended', () => this._skip(+1));
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
    const seek = document.getElementById('jk-seek');
    const curEl = document.getElementById('jk-cur');
    if (seek) seek.value = (cur / dur) * 100;
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
      const actx     = new (window.AudioContext || window.webkitAudioContext)();
      const src      = actx.createMediaElementSource(this.audio);
      this._analyser = actx.createAnalyser();
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
      const barW = (canvas.width / buf.length) * 1.8;
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
// Widget cosmétique (pas d'enjeux réels).
// Crédits stockés en mémoire (remis à 100 à chaque session).
export class SlotMachine {
  constructor(containerId) {
    this.el      = document.getElementById(containerId);
    this.credits = 100;
    this.bet     = 5;
    this.spinning = false;

    // Symboles avec poids de tirage et multiplicateurs
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

    // Pré-calculer la pool de tirage
    this._pool = [];
    for (const s of this.SYMBOLS)
      for (let i = 0; i < s.weight; i++) this._pool.push(s);
  }

  render() {
    if (!this.el) return;
    this.el.innerHTML = `
      <div class="slot-machine" id="slot-root">

        <!-- Bandeau crédits -->
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

        <!-- Rouleaux -->
        <div class="slot-reels" aria-live="polite" aria-atomic="true">
          <div class="slot-reel-wrap">
            <div class="slot-reel" id="slot-reel-0"><span class="slot-sym">?</span></div>
          </div>
          <div class="slot-reel-wrap">
            <div class="slot-reel" id="slot-reel-1"><span class="slot-sym">?</span></div>
          </div>
          <div class="slot-reel-wrap">
            <div class="slot-reel" id="slot-reel-2"><span class="slot-sym">?</span></div>
          </div>
        </div>

        <!-- Message résultat -->
        <div class="slot-msg" id="slot-msg" aria-live="polite"></div>

        <!-- Bouton SPIN -->
        <button class="slot-spin-btn" id="slot-spin" aria-label="Lancer les rouleaux">
          <span id="slot-spin-label">SPIN ⚡</span>
        </button>

        <!-- Table des gains -->
        <details class="slot-paytable">
          <summary class="slot-paytable-toggle">TABLE DES GAINS ▾</summary>
          <div class="slot-paytable-body">
            ${this.SYMBOLS.filter(s => s.mult > 0).map(s =>
              `<div class="slot-pay-row">
                <span class="slot-pay-sym" style="color:${s.color}">${s.glyph}</span>
                <span class="slot-pay-sym" style="color:${s.color}">${s.glyph}</span>
                <span class="slot-pay-sym" style="color:${s.color}">${s.glyph}</span>
                <span class="slot-pay-mult">× ${s.mult}</span>
              </div>`
            ).join('')}
            <div class="slot-pay-row">
              <span class="slot-pay-sym">🍒</span>
              <span class="slot-pay-sym">🍒</span>
              <span class="slot-pay-sym" style="opacity:.3">—</span>
              <span class="slot-pay-mult">× 0.5</span>
            </div>
          </div>
        </details>

      </div>
    `;
    this._bind();
    this._initReels();
  }

  _rand() {
    return this._pool[Math.floor(Math.random() * this._pool.length)];
  }

  _initReels() {
    const syms = [this._rand(), this._rand(), this._rand()];
    for (let i = 0; i < 3; i++) this._setReel(i, syms[i], false);
  }

  _setReel(idx, sym, animate = true) {
    const el = document.getElementById(`slot-reel-${idx}`);
    if (!el) return;
    el.innerHTML = `<span class="slot-sym" style="color:${sym.color}" aria-label="${sym.label}">${sym.glyph}</span>`;
    if (animate) el.classList.add('slot-reel--land');
    el.addEventListener('animationend', () => el.classList.remove('slot-reel--land'), { once: true });
  }

  _bind() {
    document.getElementById('slot-spin')?.addEventListener('click', () => this._spin());
    document.getElementById('slot-bet-down')?.addEventListener('click', () => this._changeBet(-5));
    document.getElementById('slot-bet-up')?.addEventListener('click',   () => this._changeBet(+5));
  }

  _changeBet(delta) {
    this.bet = Math.max(1, Math.min(this.credits, this.bet + delta));
    const el = document.getElementById('slot-bet');
    if (el) el.textContent = this.bet;
  }

  _updateCredits(v) {
    this.credits = v;
    const el = document.getElementById('slot-credits');
    if (el) el.textContent = v;
    // Empêche la mise > crédits
    this.bet = Math.min(this.bet, this.credits);
    const betEl = document.getElementById('slot-bet');
    if (betEl) betEl.textContent = this.bet;
  }

  async _spin() {
    if (this.spinning) return;
    if (this.credits < 1) {
      this._showMsg('PLUS DE CRÉDITS · RELOAD LA PAGE', 'red');
      return;
    }
    if (this.bet < 1) this.bet = 1;

    this.spinning = true;
    const spinBtn = document.getElementById('slot-spin');
    const spinLbl = document.getElementById('slot-spin-label');
    if (spinBtn) spinBtn.disabled = true;
    if (spinLbl) spinLbl.textContent = '···';

    this._updateCredits(this.credits - this.bet);
    this._showMsg('', '');
    document.getElementById('slot-gain').textContent = '·';

    // Animer les 3 rouleaux avec un léger décalage
    const results = [this._rand(), this._rand(), this._rand()];

    for (let i = 0; i < 3; i++) {
      await this._spinReel(i, results[i], 400 + i * 250);
    }

    // Calcul du gain
    const gain = this._evalGain(results);
    const gainEl = document.getElementById('slot-gain');

    if (gain > 0) {
      const winAmount = Math.round(this.bet * gain);
      this._updateCredits(this.credits + winAmount);
      if (gainEl) { gainEl.textContent = `+${winAmount}`; gainEl.style.color = 'var(--c-primary)'; }
      if (gain >= 10)
        this._showMsg(`🎰 JACKPOT × ${gain} ! +${winAmount} CRÉDITS`, 'jackpot');
      else if (gain >= 5)
        this._showMsg(`★ SUPER WIN × ${gain} ! +${winAmount} CRÉDITS`, 'win');
      else
        this._showMsg(`✦ WIN × ${gain} — +${winAmount} CRÉDITS`, 'win');
    } else {
      if (gainEl) { gainEl.textContent = '0'; gainEl.style.color = 'var(--c-text-faint)'; }
      this._showMsg('PERDU · BONNE CHANCE', 'lose');
    }

    if (this.credits <= 0) {
      this._showMsg('GAME OVER · RELOAD POUR REJOUER', 'red');
    }

    this.spinning = false;
    if (spinBtn) spinBtn.disabled = false;
    if (spinLbl) spinLbl.textContent = 'SPIN ⚡';
  }

  _spinReel(idx, finalSym, duration) {
    return new Promise(resolve => {
      const el = document.getElementById(`slot-reel-${idx}`);
      if (!el) { resolve(); return; }
      el.classList.add('slot-reel--spin');
      let ticks = 0;
      const total = Math.floor(duration / 60);
      const iv = setInterval(() => {
        const s = ticks < total ? this._rand() : finalSym;
        el.innerHTML = `<span class="slot-sym" style="color:${s.color}">${s.glyph}</span>`;
        ticks++;
        if (ticks > total) {
          clearInterval(iv);
          el.classList.remove('slot-reel--spin');
          el.classList.add('slot-reel--land');
          el.addEventListener('animationend', () => el.classList.remove('slot-reel--land'), { once: true });
          resolve();
        }
      }, 60);
    });
  }

  _evalGain(results) {
    const [a, b, c] = results;
    // 3 identiques → multiplicateur du symbole
    if (a.glyph === b.glyph && b.glyph === c.glyph) return a.mult;
    // 2 cerises → 0.5×
    const cherries = results.filter(s => s.glyph === '🍒').length;
    if (cherries >= 2) return 0.5;
    return 0;
  }

  _showMsg(text, type) {
    const el = document.getElementById('slot-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'slot-msg';
    if (type) el.classList.add(`slot-msg--${type}`);
  }
}
