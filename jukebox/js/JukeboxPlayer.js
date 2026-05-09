/* ═══════════════════════════════════════════════════════════════════
   JukeboxPlayer.js — Module ES exportable
   Usage depuis n'importe quelle page :

     import { JukeboxPlayer } from '/jukebox/js/JukeboxPlayer.js';

     const jk = new JukeboxPlayer({
       container : document.getElementById('jukebox-widget'),
       basePath  : '/jukebox/',   // chemin vers le dossier jukebox
       mode      : 'widget',      // 'full' | 'widget' | 'mini'
       superKey  : 'bzhAdmin2025' // optionnel — active le panel admin
     });
     jk.mount();

   Modes :
     full    → platine complète (par défaut dans /jukebox/index.html)
     widget  → carte compacte lecteur + contrôles (pour star, index…)
     mini    → mini-barre sticky (juste titre + play/prev/next)
═══════════════════════════════════════════════════════════════════ */

export class JukeboxPlayer {
  /* ─── CONFIG ─────────────────────────────────────────────────── */
  constructor(opts = {}) {
    this.container  = opts.container  || document.body;
    this.basePath   = (opts.basePath  || '/jukebox/').replace(/\/$/, '') + '/';
    this.mode       = opts.mode       || 'full';
    this.superKey   = opts.superKey   || 'bzhAdmin2025';
    this.autoPlay   = opts.autoPlay   || false;
    this.onTrackChange = opts.onTrackChange || null; // callback(record)

    /* ── état ── */
    this.records     = [];
    this.vinylStyles = [];
    this.currentIdx  = -1;
    this.isPlaying   = false;
    this.isShuffle   = false;
    this.isRepeat    = false;
    this.lofiLevel   = 0;
    this.isSuperUser = false;

    /* ── audio ── */
    this._audio      = null;
    this._audioCtx   = null;
    this._srcNode    = null;
    this._gainNode   = null;
    this._lofiFilter = null;

    /* ── animation ── */
    this._lofiRaf    = null;
    this._vinylRaf   = null;
    this._vinylAngle = 0;
    this._lastTime   = null;
  }

  /* ─── MOUNT ──────────────────────────────────────────────────── */
  async mount() {
    await this._loadData();
    this._checkSuperUser();
    this._render();
    this._bindEvents();
    this._startLofiLoop();
    if (this.records.length > 0) {
      this._loadTrack(0, this.autoPlay);
    }
  }

  /* ─── DATA ───────────────────────────────────────────────────── */
  async _loadData() {
    const bust = Date.now();
    try {
      const [rRes, sRes] = await Promise.all([
        fetch(this.basePath + 'records.json?v=' + bust),
        fetch(this.basePath + 'vinyl_styles.json?v=' + bust),
      ]);
      this.records     = await rRes.json();
      this.vinylStyles = await sRes.json();
    } catch (e) {
      console.warn('[JukeboxPlayer] Erreur chargement JSON', e);
      this.records     = [];
      this.vinylStyles = [];
    }
    // Override localStorage si admin a édité
    const local = localStorage.getItem('jk_records');
    if (local) { try { this.records = JSON.parse(local); } catch {} }
  }

  /* ─── SUPER USER ─────────────────────────────────────────────── */
  _checkSuperUser() {
    const fromURL   = location.hash === '#' + this.superKey;
    const fromLocal = localStorage.getItem('jk_superuser') === '1';
    if (fromURL || fromLocal) {
      this.isSuperUser = true;
      localStorage.setItem('jk_superuser', '1');
      if (fromURL) history.replaceState(null, '', location.pathname);
    }
  }

  /* ─── RENDER ─────────────────────────────────────────────────── */
  _render() {
    const el = this.container;
    el.classList.add('jkp', `jkp--${this.mode}`);
    el.innerHTML = this.mode === 'mini'
      ? this._tmplMini()
      : this.mode === 'widget'
        ? this._tmplWidget()
        : this._tmplFull();
    this._injectCSS();
    this._$ = (sel) => el.querySelector(sel);
    this._$$ = (sel) => el.querySelectorAll(sel);
    this._refs();
  }

  /* ─── REFS ───────────────────────────────────────────────────── */
  _refs() {
    const $ = this._$;
    this._audio       = $('audio.jkp-audio') || this._createAudio();
    this._elTitle     = $('.jkp-title');
    this._elArtist    = $('.jkp-artist');
    this._elBtnPlay   = $('.jkp-btn-play');
    this._elBtnPrev   = $('.jkp-btn-prev');
    this._elBtnNext   = $('.jkp-btn-next');
    this._elBtnShuf   = $('.jkp-btn-shuffle');
    this._elBtnRep    = $('.jkp-btn-repeat');
    this._elSeek      = $('.jkp-seek');
    this._elVol       = $('.jkp-vol');
    this._elLofi      = $('.jkp-lofi-slider');
    this._elLofiVal   = $('.jkp-lofi-value');
    this._elCurTime   = $('.jkp-cur-time');
    this._elDurTime   = $('.jkp-dur-time');
    this._elShelf     = $('.jkp-shelf');
    this._elSearch    = $('.jkp-search');
    this._elVinyl     = $('.jkp-vinyl-canvas');
    this._elLofiCvs   = $('.jkp-lofi-canvas');
    this._elAdminPanel= $('.jkp-admin');
    this._elAdminBtn  = $('.jkp-admin-toggle');
    if (this._elAdminPanel && !this.isSuperUser) {
      this._elAdminPanel.style.display = 'none';
    }
  }

  _createAudio() {
    const a = document.createElement('audio');
    a.className = 'jkp-audio';
    a.style.display = 'none';
    this.container.appendChild(a);
    return a;
  }

  /* ─── TEMPLATES ──────────────────────────────────────────────── */

  _tmplMini() {
    return `
<audio class="jkp-audio" preload="metadata"></audio>
<div class="jkp-mini-bar">
  <button class="jkp-btn-prev" aria-label="Précédent">⏮</button>
  <button class="jkp-btn-play" aria-label="Lecture">▶</button>
  <button class="jkp-btn-next" aria-label="Suivant">⏭</button>
  <span class="jkp-title">—</span>
  <span class="jkp-sep">·</span>
  <span class="jkp-artist"></span>
</div>`;
  }

  _tmplWidget() {
    return `
<audio class="jkp-audio" preload="metadata"></audio>
<div class="jkp-widget-inner">
  <div class="jkp-vinyl-wrap">
    <canvas class="jkp-vinyl-canvas" width="120" height="120"></canvas>
  </div>
  <div class="jkp-widget-info">
    <div class="jkp-track-meta">
      <span class="jkp-title">—</span>
      <span class="jkp-artist"></span>
    </div>
    <div class="jkp-progress-row">
      <span class="jkp-cur-time">0:00</span>
      <input type="range" class="jkp-seek" min="0" max="100" value="0" step="0.1">
      <span class="jkp-dur-time">0:00</span>
    </div>
    <div class="jkp-controls">
      <button class="jkp-btn-prev" aria-label="Précédent">⏮</button>
      <button class="jkp-btn-play" aria-label="Lecture">▶</button>
      <button class="jkp-btn-next" aria-label="Suivant">⏭</button>
      <button class="jkp-btn-shuffle" aria-label="Aléatoire">⇄</button>
      <button class="jkp-btn-repeat" aria-label="Répéter">↺</button>
    </div>
    <div class="jkp-lofi-row">
      <span class="jkp-lofi-label">LOFI</span>
      <input type="range" class="jkp-lofi-slider" min="0" max="100" value="0">
      <span class="jkp-lofi-value">0%</span>
    </div>
  </div>
</div>
<canvas class="jkp-lofi-canvas"></canvas>`;
  }

  _tmplFull() {
    const presets = [
      { label: 'DIGITAL', val: 0 },
      { label: 'TAPE',    val: 33 },
      { label: 'VINYL',   val: 66 },
      { label: 'CASSETTE', val: 100 },
    ];
    return `
<audio class="jkp-audio" preload="metadata"></audio>
<div class="jkp-tabs">
  <button class="jkp-tab active" data-tab="player">PLATINE</button>
  <button class="jkp-tab" data-tab="library">DISCOTHÈQUE</button>
  ${this.isSuperUser ? '<button class="jkp-tab" data-tab="admin">ADMIN ✦</button>' : ''}
</div>

<!-- PLATINE -->
<div class="jkp-panel active" id="jkp-tab-player">
  <div class="jkp-deck">
    <div class="jkp-vinyl-wrap">
      <canvas class="jkp-vinyl-canvas" width="280" height="280"></canvas>
      <canvas class="jkp-lofi-canvas"></canvas>
      <div class="jkp-tonearm"></div>
    </div>
    <div class="jkp-deck-info">
      <div class="jkp-title">—</div>
      <div class="jkp-artist"></div>
      <div class="jkp-progress-row">
        <span class="jkp-cur-time">0:00</span>
        <input type="range" class="jkp-seek" min="0" max="100" value="0" step="0.1">
        <span class="jkp-dur-time">0:00</span>
      </div>
      <div class="jkp-controls">
        <button class="jkp-btn-shuffle" aria-label="Aléatoire">⇄</button>
        <button class="jkp-btn-prev" aria-label="Précédent">⏮</button>
        <button class="jkp-btn-play" aria-label="Lecture">▶</button>
        <button class="jkp-btn-next" aria-label="Suivant">⏭</button>
        <button class="jkp-btn-repeat" aria-label="Répéter">↺</button>
      </div>
      <div class="jkp-vol-row">
        <span>VOL</span>
        <input type="range" class="jkp-vol" min="0" max="1" step="0.01" value="1">
      </div>
      <div class="jkp-lofi-row">
        <div class="jkp-presets">
          ${presets.map(p => `<button class="jkp-preset" data-val="${p.val}">${p.label}</button>`).join('')}
        </div>
        <div class="jkp-lofi-ctrl">
          <span class="jkp-lofi-label">LOFI</span>
          <input type="range" class="jkp-lofi-slider" min="0" max="100" value="0">
          <span class="jkp-lofi-value">0%</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- DISCOTHÈQUE -->
<div class="jkp-panel" id="jkp-tab-library">
  <div class="jkp-library-header">
    <input type="search" class="jkp-search" placeholder="Rechercher…">
    <span class="jkp-lib-count"></span>
  </div>
  <div class="jkp-shelf" role="list"></div>
</div>

<!-- ADMIN -->
${this.isSuperUser ? `
<div class="jkp-panel jkp-admin" id="jkp-tab-admin">
  <form class="jkp-admin-form" id="jkp-add-form">
    <h3>AJOUTER UN MORCEAU</h3>
    <div class="jkp-field"><label>Titre *<input id="jkp-f-title" required placeholder="Nom du morceau"></label></div>
    <div class="jkp-field"><label>Artiste *<input id="jkp-f-artist" required placeholder="Dr.Spig"></label></div>
    <div class="jkp-field"><label>Fichier audio * (URL ou chemin)<input id="jkp-f-src" required placeholder="audio/mon-morceau.mp3"></label></div>
    <div class="jkp-field"><label>Image pochette (URL ou chemin)<input id="jkp-f-cover" placeholder="img/pochette.webp"></label></div>
    <div class="jkp-field jkp-field-colors">
      <label>Couleur vinyle<input type="color" id="jkp-f-cover-color" value="#1a1a2e"></label>
      <label>Couleur label<input type="color" id="jkp-f-label-color" value="#e94560"></label>
      <canvas id="jkp-preview-canvas" width="80" height="80"></canvas>
    </div>
    <div class="jkp-field">
      <label>Style vinyle
        <select id="jkp-f-vinyl-style"></select>
      </label>
    </div>
    <div class="jkp-field"><label>Tags (séparés par virgule)<input id="jkp-f-tags" placeholder="ost, bzh, lofi"></label></div>
    <div class="jkp-field"><label>BPM<input type="number" id="jkp-f-bpm" value="0" min="0"></label></div>
    <div id="jkp-form-feedback" class="jkp-feedback"></div>
    <button type="submit" class="jkp-btn-submit">✦ AJOUTER</button>
  </form>
  <div class="jkp-admin-list">
    <h3>BIBLIOTHÈQUE <span id="jkp-track-count"></span></h3>
    <div id="jkp-track-list"></div>
  </div>
  <div class="jkp-export">
    <h3>EXPORT JSON</h3>
    <textarea id="jkp-json-export" rows="8" readonly></textarea>
    <button id="jkp-btn-copy">⎘ COPIER</button>
  </div>
</div>` : ''}`;
  }

  /* ─── CSS INJECTION ──────────────────────────────────────────── */
  _injectCSS() {
    if (document.getElementById('jkp-styles')) return;
    const style = document.createElement('style');
    style.id = 'jkp-styles';
    style.textContent = `
/* ═══════════════════════════════════════════════════════════════
   JUKEBOX v7 — Gwen Ha Star
   Palette : dark vintage, green neon accent, warm amber
═══════════════════════════════════════════════════════════════ */

:root {
  --c-bg:          #0d0d0f;
  --c-surface:     #141418;
  --c-surface-2:   #1c1c22;
  --c-border:      #2a2a35;
  --c-text:        #e2e0d8;
  --c-text-muted:  #7a7870;
  --c-text-faint:  #45443f;
  --c-primary:     #4ade80;   /* green neon */
  --c-amber:       #f59e0b;
  --c-red:         #ef4444;
  --c-cyan:        #22d3ee;
  --font-mono:     'Share Tech Mono', monospace;
  --font-display:  'VT323', monospace;
  --font-retro:    'Special Elite', cursive;
  --radius-sm:     4px;
  --radius-md:     8px;
  --radius-lg:     14px;
  --space-1: .25rem; --space-2: .5rem; --space-3: .75rem;
  --space-4: 1rem;   --space-5: 1.25rem; --space-6: 1.5rem;
  --space-8: 2rem;   --space-10: 2.5rem; --space-12: 3rem;
}

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
html { scroll-behavior:smooth; -webkit-font-smoothing:antialiased; }
body {
  background: var(--c-bg);
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: 13px;
  min-height: 100dvh;
  overflow-x: hidden;
}
img,canvas,svg { display:block; max-width:100%; }
button { cursor:pointer; background:none; border:none; font:inherit; color:inherit; }
input,select,textarea { font:inherit; color:inherit; }

/* SCANLINES */
.scanlines {
  pointer-events:none; position:fixed; inset:0; z-index:9999;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(0,0,0,.08) 2px,
    rgba(0,0,0,.08) 4px
  );
  mix-blend-mode: overlay;
}
.vignette {
  pointer-events:none; position:fixed; inset:0; z-index:9998;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.7) 100%);
}

/* ── HEADER ────────────────────────────────────────────────────── */
.jk-header {
  display:flex; align-items:center; gap: var(--space-6);
  padding: var(--space-3) var(--space-6);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  position:sticky; top:0; z-index:100;
  backdrop-filter:blur(10px);
}
.jk-logo {
  display:flex; align-items:center; gap: var(--space-2);
  font-family: var(--font-display); font-size:22px; letter-spacing:.12em;
  color: var(--c-primary);
  text-shadow: 0 0 18px var(--c-primary);
  flex-shrink:0;
}
.jk-logo em { color:var(--c-amber); font-style:normal; }
.jk-nav { display:flex; gap: var(--space-2); flex:1; }
.jk-tab {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size:11px; letter-spacing:.18em;
  color: var(--c-text-muted);
  transition: color .18s, border-color .18s, background .18s;
}
.jk-tab:hover  { color:var(--c-text); border-color:var(--c-text-muted); }
.jk-tab.active {
  color: var(--c-primary); border-color: var(--c-primary);
  background: color-mix(in oklch, var(--c-primary) 8%, transparent);
  text-shadow: 0 0 12px var(--c-primary);
}
.jk-tab--admin { color:var(--c-amber); border-color:color-mix(in oklch,var(--c-amber) 40%,var(--c-border)); }
.jk-tab--admin.active {
  color:var(--c-amber); border-color:var(--c-amber);
  background:color-mix(in oklch,var(--c-amber) 8%,transparent);
  text-shadow:0 0 12px var(--c-amber);
}
.jk-back {
  font-family:var(--font-mono); font-size:11px; letter-spacing:.14em;
  color:var(--c-text-muted); text-decoration:none; flex-shrink:0;
  transition:color .18s;
}
.jk-back:hover { color:var(--c-text); }

/* ── TAB PANELS ────────────────────────────────────────────────── */
.tab-panel { display:none; }
.tab-panel.active { display:block; }

/* ── PLAYER ────────────────────────────────────────────────────── */
.player-wrap {
  display:flex; align-items:center; justify-content:center;
  gap: clamp(var(--space-8), 5vw, 80px);
  padding: var(--space-10) var(--space-6);
  min-height: calc(100dvh - 52px);
  flex-wrap: wrap;
}

/* VINYL STAGE */
.vinyl-stage {
  position:relative;
  width: clamp(260px, 36vw, 360px);
  height: clamp(260px, 36vw, 360px);
  flex-shrink:0;
}
.platter-shadow {
  position:absolute; inset:-8px;
  border-radius:50%;
  background: radial-gradient(ellipse at 40% 40%, rgba(80,80,80,.06), transparent 70%);
  box-shadow:
    0 30px 80px rgba(0,0,0,.7),
    0 0 0 1px rgba(255,255,255,.04);
}
.platter {
  position:absolute; inset:0;
  border-radius:50%;
  background: radial-gradient(circle at 38% 35%,#2a2a30,#0d0d0f 75%);
  border: 2px solid rgba(255,255,255,.07);
  overflow:hidden;
  display:flex; align-items:center; justify-content:center;
}
/* VINYL DISC */
.vinyl {
  width:88%; height:88%;
  border-radius:50%;
  position:relative;
  will-change: transform;
  transition: filter .8s ease;
}
.vinyl.spinning {
  animation: spin-vinyl var(--rpm-duration, 1.8s) linear infinite;
}
.vinyl.slowing {
  animation: spin-vinyl var(--rpm-duration, 1.8s) linear infinite;
  animation-play-state: running;
  filter: blur(.5px);
}
@keyframes spin-vinyl {
  from { transform:rotate(0deg); }
  to   { transform:rotate(360deg); }
}
.vinyl-canvas { position:absolute; inset:0; border-radius:50%; width:100%; height:100%; }

/* LABEL AU CENTRE DU VINYLE */
.vinyl-label {
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  pointer-events:none;
}
.label-inner {
  width:35%; height:35%;
  border-radius:50%;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  background:var(--label-bg, #1a0a2e);
  border: 1px solid rgba(255,255,255,.1);
  position:relative; overflow:hidden;
  padding:4px;
}
.label-title  { font-family:var(--font-display); font-size:8px; text-align:center; line-height:1.1; color:#fff; letter-spacing:.06em; word-break:break-all; }
.label-artist { font-family:var(--font-mono); font-size:6px; color:rgba(255,255,255,.6); text-align:center; letter-spacing:.04em; }
.label-hole   { width:10px; height:10px; border-radius:50%; background:#0d0d0f; border:1px solid rgba(255,255,255,.15); margin-top:3px; }

/* TONEARM */
.arm-wrapper {
  position:absolute; top:-18px; right:-18px; width:90px; height:90px;
  z-index:10; pointer-events:none;
}
.tonearm {
  width:4px; height:70px;
  background: linear-gradient(180deg, #888 0%, #555 60%, #444 100%);
  border-radius:2px;
  position:absolute; top:0; right:20px;
  transform-origin: top center;
  transform: rotate(-28deg);
  transition: transform 1.2s cubic-bezier(.4,0,.2,1);
  box-shadow:0 2px 8px rgba(0,0,0,.6);
}
.tonearm::after {
  content:'';
  position:absolute; bottom:-6px; left:-3px;
  width:10px; height:10px;
  background:#777;
  border-radius:2px;
  transform:rotate(30deg);
}
.tonearm.on-record { transform: rotate(-14deg); }

/* LOFI OVERLAY */
.lofi-overlay {
  position:absolute; inset:0; border-radius:50%;
  pointer-events:none; z-index:5;
  opacity:0;
  mix-blend-mode: screen;
  transition:opacity .4s;
  width:100%; height:100%;
}

/* ── CONTROLS PANEL ────────────────────────────────────────────── */
.controls-panel {
  display:flex; flex-direction:column; gap:var(--space-5);
  width: clamp(280px, 38vw, 400px);
}

/* TRACK INFO */
.track-info { display:flex; flex-direction:column; gap:4px; }
.track-tag   { font-family:var(--font-mono); font-size:9px; letter-spacing:.22em; color:var(--c-primary); opacity:.7; }
.track-title { font-family:var(--font-display); font-size:28px; line-height:1.1; color:var(--c-text); letter-spacing:.04em; }
.track-artist{ font-family:var(--font-mono); font-size:11px; letter-spacing:.14em; color:var(--c-text-muted); }

/* TIMEBAR */
.timebar { display:flex; align-items:center; gap:var(--space-2); }
.time-cur,.time-dur {
  font-family:var(--font-mono); font-size:11px;
  color:var(--c-text-muted); min-width:32px; font-variant-numeric:tabular-nums;
}
.time-dur { text-align:right; }
input[type=range] {
  -webkit-appearance:none; appearance:none;
  width:100%; height:3px;
  background: var(--c-border);
  border-radius:2px; outline:none; cursor:pointer;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance:none;
  width:14px; height:14px;
  border-radius:50%;
  background: var(--c-primary);
  box-shadow: 0 0 8px var(--c-primary);
  transition:transform .15s;
}
input[type=range]::-webkit-slider-thumb:hover { transform:scale(1.3); }
input[type=range]#vol::-webkit-slider-thumb { background:var(--c-amber); box-shadow:0 0 8px var(--c-amber); }
input[type=range]#lofi-slider::-webkit-slider-thumb { background:var(--c-cyan); box-shadow:0 0 8px var(--c-cyan); }

/* TRANSPORT */
.transport { display:flex; align-items:center; gap:var(--space-3); }
.btn-transport {
  width:44px; height:44px; border-radius:50%;
  background:var(--c-surface-2); border:1px solid var(--c-border);
  font-size:1rem; display:flex; align-items:center; justify-content:center;
  transition:background .15s, border-color .15s, box-shadow .15s, transform .1s;
  color:var(--c-text-muted);
}
.btn-transport:hover { background:var(--c-surface); color:var(--c-text); border-color:var(--c-text-muted); }
.btn-transport:active { transform:scale(.93); }
.btn-play {
  width:56px; height:56px; font-size:1.3rem;
  background: color-mix(in oklch, var(--c-primary) 15%, var(--c-surface-2));
  border-color:var(--c-primary); color:var(--c-primary);
  box-shadow:0 0 18px color-mix(in oklch, var(--c-primary) 25%, transparent);
}
.btn-play:hover { box-shadow:0 0 32px color-mix(in oklch, var(--c-primary) 40%, transparent); }
.btn-play.playing { color:var(--c-amber); border-color:var(--c-amber); }
.btn-shuffle.active,.btn-repeat.active { color:var(--c-cyan); border-color:var(--c-cyan); }

/* SLIDER ROW */
.slider-row {
  display:flex; align-items:center; gap:var(--space-3);
}
.sl-icon { font-size:.9rem; }
.sl-label { font-family:var(--font-mono); font-size:9px; letter-spacing:.14em; color:var(--c-text-faint); white-space:nowrap; }

/* EFFECT PANEL */
.effect-panel {
  background:var(--c-surface);
  border:1px solid var(--c-border);
  border-radius:var(--radius-lg);
  padding:var(--space-4) var(--space-5);
  display:flex; flex-direction:column; gap:var(--space-3);
}
.effect-label {
  display:flex; align-items:center; gap:var(--space-2);
  font-family:var(--font-mono); font-size:10px; letter-spacing:.18em;
  color:var(--c-cyan);
}
.effect-value {
  margin-left:auto;
  font-family:var(--font-display); font-size:14px;
  color:var(--c-cyan); text-shadow:0 0 10px var(--c-cyan);
}
.effect-presets { display:flex; gap:var(--space-2); flex-wrap:wrap; }
.preset-btn {
  padding:var(--space-1) var(--space-3);
  border:1px solid var(--c-border); border-radius:var(--radius-sm);
  font-family:var(--font-mono); font-size:9px; letter-spacing:.14em;
  color:var(--c-text-muted);
  transition:all .15s;
}
.preset-btn:hover { color:var(--c-cyan); border-color:var(--c-cyan); }
.preset-btn.active { color:var(--c-cyan); border-color:var(--c-cyan); background:color-mix(in oklch,var(--c-cyan) 10%,transparent); }

/* ── LIBRARY ────────────────────────────────────────────────────── */
.library-wrap {
  max-width:1200px; margin:0 auto; padding:var(--space-8) var(--space-6);
}
.library-header {
  display:flex; align-items:center; justify-content:space-between;
  gap:var(--space-4); margin-bottom:var(--space-6); flex-wrap:wrap;
}
.library-header h2 {
  font-family:var(--font-display); font-size:26px; letter-spacing:.1em;
  color:var(--c-primary); text-shadow:0 0 14px var(--c-primary);
}
#lib-search {
  background:var(--c-surface); border:1px solid var(--c-border);
  border-radius:var(--radius-sm); padding:var(--space-2) var(--space-4);
  font-family:var(--font-mono); font-size:12px; letter-spacing:.1em;
  width:240px; outline:none;
  transition:border-color .18s;
}
#lib-search:focus { border-color:var(--c-primary); }

/* SHELF */
.shelf {
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));
  gap:var(--space-5);
}
.vinyl-card {
  display:flex; flex-direction:column;
  background:var(--c-surface); border:1px solid var(--c-border);
  border-radius:var(--radius-lg);
  overflow:hidden; cursor:pointer;
  transition:border-color .18s, box-shadow .18s, transform .15s;
  position:relative;
}
.vinyl-card:hover {
  border-color:var(--c-primary);
  box-shadow:0 0 24px color-mix(in oklch, var(--c-primary) 20%, transparent);
  transform:translateY(-3px);
}
.vinyl-card.active {
  border-color:var(--c-amber);
  box-shadow:0 0 24px color-mix(in oklch, var(--c-amber) 25%, transparent);
}
.card-cover {
  width:100%; aspect-ratio:1;
  position:relative; overflow:hidden;
  background:var(--c-surface-2);
}
.card-cover img {
  width:100%; height:100%; object-fit:cover;
  transition:transform .3s;
}
.vinyl-card:hover .card-cover img { transform:scale(1.04); }
.card-cover-canvas {
  position:absolute; inset:0; width:100%; height:100%;
}
/* Mini vinyl over cover */
.card-mini-vinyl {
  position:absolute; bottom:-20px; right:-20px;
  width:80px; height:80px;
  border-radius:50%;
  transition:transform .35s cubic-bezier(.34,1.56,.64,1), opacity .25s;
  opacity:.7; transform:scale(.85);
  pointer-events:none;
}
.vinyl-card:hover .card-mini-vinyl {
  opacity:1; transform:scale(1) rotate(15deg);
}
.card-info { padding:var(--space-3) var(--space-4); }
.card-title  { font-family:var(--font-display); font-size:18px; line-height:1.1; color:var(--c-text); }
.card-artist { font-family:var(--font-mono); font-size:10px; letter-spacing:.12em; color:var(--c-text-muted); margin-top:2px; }
.card-playing {
  position:absolute; top:var(--space-3); left:var(--space-3);
  background:var(--c-amber); color:#000;
  font-family:var(--font-mono); font-size:8px; letter-spacing:.18em;
  padding:2px 6px; border-radius:2px; font-weight:700;
  display:none;
}
.vinyl-card.active .card-playing { display:block; }

/* ── ADMIN ──────────────────────────────────────────────────────── */
.admin-wrap {
  max-width:900px; margin:0 auto; padding:var(--space-8) var(--space-6);
  display:flex; flex-direction:column; gap:var(--space-6);
}
.admin-wrap h2 {
  font-family:var(--font-display); font-size:28px; letter-spacing:.1em;
  color:var(--c-amber); text-shadow:0 0 14px var(--c-amber);
  display:flex; align-items:center; gap:var(--space-3);
}
.admin-badge {
  font-family:var(--font-mono); font-size:10px; letter-spacing:.18em;
  background:var(--c-amber); color:#000; padding:3px 8px; border-radius:2px; font-weight:700;
}
.admin-card {
  background:var(--c-surface); border:1px solid var(--c-border);
  border-radius:var(--radius-lg); padding:var(--space-6);
}
.admin-card h3 {
  font-family:var(--font-display); font-size:20px; letter-spacing:.08em;
  color:var(--c-primary); margin-bottom:var(--space-4);
}
.admin-form .form-grid {
  display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4);
  margin-bottom:var(--space-4);
}
@media(max-width:600px) { .admin-form .form-grid { grid-template-columns:1fr; } }
.form-group { display:flex; flex-direction:column; gap:6px; }
.form-group label {
  font-family:var(--font-mono); font-size:9px; letter-spacing:.18em;
  color:var(--c-text-muted);
}
.form-group input,
.form-group select {
  background:var(--c-surface-2); border:1px solid var(--c-border);
  border-radius:var(--radius-sm); padding:var(--space-2) var(--space-3);
  font-family:var(--font-mono); font-size:12px; letter-spacing:.06em;
  outline:none; transition:border-color .18s;
}
.form-group input:focus,
.form-group select:focus { border-color:var(--c-primary); }
.form-group input[type=color] {
  padding:2px 4px; height:36px; cursor:pointer;
}
.cover-preview {
  background:var(--c-surface-2); border:1px solid var(--c-border);
  border-radius:var(--radius-md); overflow:hidden;
  display:flex; align-items:center; justify-content:center;
  width:120px; height:120px;
}
.form-actions { display:flex; gap:var(--space-3); flex-wrap:wrap; }
.btn-admin-submit {
  padding:var(--space-3) var(--space-6);
  background:color-mix(in oklch,var(--c-primary) 15%,var(--c-surface));
  border:1px solid var(--c-primary); border-radius:var(--radius-sm);
  font-family:var(--font-mono); font-size:11px; letter-spacing:.18em;
  color:var(--c-primary); cursor:pointer;
  transition:all .18s;
}
.btn-admin-submit:hover {
  background:color-mix(in oklch,var(--c-primary) 25%,var(--c-surface));
  box-shadow:0 0 18px color-mix(in oklch,var(--c-primary) 30%,transparent);
}
.btn-admin-reset {
  padding:var(--space-3) var(--space-5);
  border:1px solid var(--c-border); border-radius:var(--radius-sm);
  font-family:var(--font-mono); font-size:11px; letter-spacing:.18em;
  color:var(--c-text-muted); cursor:pointer; transition:all .18s;
}
.btn-admin-reset:hover { color:var(--c-red); border-color:var(--c-red); }
.form-feedback {
  margin-top:var(--space-3);
  font-family:var(--font-mono); font-size:11px; letter-spacing:.1em;
  min-height:20px;
}
.form-feedback.ok  { color:var(--c-primary); }
.form-feedback.err { color:var(--c-red); }

/* Admin track list */
.admin-track-list { display:flex; flex-direction:column; gap:var(--space-2); }
.admin-track-item {
  display:flex; align-items:center; gap:var(--space-3);
  background:var(--c-surface-2); border:1px solid var(--c-border);
  border-radius:var(--radius-sm); padding:var(--space-2) var(--space-4);
}
.atr-color { width:12px; height:12px; border-radius:50%; flex-shrink:0; }
.atr-title { flex:1; font-family:var(--font-display); font-size:16px; color:var(--c-text); }
.atr-artist { font-family:var(--font-mono); font-size:10px; color:var(--c-text-muted); }
.atr-del {
  width:28px; height:28px; border-radius:50%;
  background:transparent; border:1px solid var(--c-border);
  color:var(--c-text-faint); font-size:.75rem;
  display:flex; align-items:center; justify-content:center;
  transition:all .15s; flex-shrink:0;
}
.atr-del:hover { color:var(--c-red); border-color:var(--c-red); background:color-mix(in oklch,var(--c-red) 10%,transparent); }

/* JSON Export */
.json-export {
  width:100%; background:var(--c-bg); border:1px solid var(--c-border);
  border-radius:var(--radius-sm); padding:var(--space-3);
  font-family:var(--font-mono); font-size:10px; letter-spacing:.04em;
  color:var(--c-text-muted); resize:vertical; outline:none;
  margin-bottom:var(--space-3);
}
.btn-admin-copy {
  padding:var(--space-2) var(--space-5);
  background:var(--c-surface-2); border:1px solid var(--c-border);
  border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:11px;
  letter-spacing:.14em; color:var(--c-text-muted); transition:all .18s;
}
.btn-admin-copy:hover { color:var(--c-cyan); border-color:var(--c-cyan); }
.admin-hint {
  font-family:var(--font-mono); font-size:10px; letter-spacing:.08em;
  color:var(--c-text-faint); margin-bottom:var(--space-3);
}
.admin-hint code {
  background:var(--c-surface-2); border:1px solid var(--c-border);
  border-radius:2px; padding:0 4px; font-family:var(--font-mono);
}

/* ── RESPONSIVE ─────────────────────────────────────────────────── */
@media(max-width:760px) {
  .jk-header { padding:var(--space-2) var(--space-4); gap:var(--space-3); }
  .jk-logo   { font-size:18px; }
  .player-wrap { padding:var(--space-6) var(--space-4); gap:var(--space-6); }
  .controls-panel { width:100%; }
  .form-group--preview { grid-column:span 2; }
}
`;
    document.head.appendChild(style);
  }

  /* ─── VINYL DRAW ─────────────────────────────────────────────── */
  _drawVinyl(canvas, record, angle = 0) {
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const size = canvas.width;
    const cx   = size / 2;
    const r    = size / 2 - 1;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(angle);
    ctx.translate(-cx, -cx);

    // Base color
    const gc = ctx.createRadialGradient(cx, cx, r * 0.05, cx, cx, r);
    gc.addColorStop(0,   record?.coverColor || '#1a1a2e');
    gc.addColorStop(0.6, this._darken(record?.coverColor || '#1a1a2e', 0.4));
    gc.addColorStop(1,   '#050508');
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fillStyle = gc;
    ctx.fill();

    // Sillons
    for (let i = 0; i < 28; i++) {
      const rg = r * 0.22 + (r * 0.64) * (i / 28);
      ctx.beginPath();
      ctx.arc(cx, cx, rg, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.04 + (i % 3 === 0 ? 0.04 : 0)})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // Reflet
    const gr = ctx.createLinearGradient(cx - r * 0.6, cx - r * 0.6, cx + r * 0.2, cx + r * 0.2);
    gr.addColorStop(0,   'rgba(255,255,255,0.08)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    gr.addColorStop(1,   'rgba(0,0,0,0.15)');
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fillStyle = gr;
    ctx.fill();

    ctx.restore();

    // Label central (fixe, pas de rotation)
    const labelR = r * 0.18;
    ctx.beginPath();
    ctx.arc(cx, cx, labelR, 0, Math.PI * 2);
    ctx.fillStyle = record?.labelColor || '#e94560';
    ctx.fill();
    // Trou central
    ctx.beginPath();
    ctx.arc(cx, cx, r * 0.025, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
  }

  _darken(hex, f) {
    const n = parseInt((hex || '#111').replace('#', '').padStart(6, '0'), 16);
    const r = Math.max(0, Math.floor(((n >> 16) & 0xff) * (1 - f)));
    const g = Math.max(0, Math.floor(((n >>  8) & 0xff) * (1 - f)));
    const b = Math.max(0, Math.floor(((n >>  0) & 0xff) * (1 - f)));
    return `rgb(${r},${g},${b})`;
  }

  /* ─── VINYL ROTATION LOOP ────────────────────────────────────── */
  _startVinylLoop() {
    if (this._vinylRaf) return;
    const rpm = 33.33;
    const degPerMs = (rpm * 360) / 60000;
    const tick = (ts) => {
      if (!this.isPlaying) { this._vinylRaf = null; return; }
      if (this._lastTime) this._vinylAngle += degPerMs * (ts - this._lastTime);
      this._lastTime = ts;
      const rec = this.records[this.currentIdx];
      this._drawVinyl(this._elVinyl, rec, this._vinylAngle * Math.PI / 180);
      this._vinylRaf = requestAnimationFrame(tick);
    };
    this._lastTime = null;
    this._vinylRaf = requestAnimationFrame(tick);
  }

  _stopVinylLoop() {
    if (this._vinylRaf) { cancelAnimationFrame(this._vinylRaf); this._vinylRaf = null; }
    this._lastTime = null;
  }

  /* ─── LOFI CANVAS LOOP ───────────────────────────────────────── */
  _startLofiLoop() {
    if (!this._elLofiCvs) return;
    const cvs = this._elLofiCvs;
    cvs.width  = cvs.offsetWidth  || (this.mode === 'full' ? 280 : 120);
    cvs.height = cvs.offsetHeight || (this.mode === 'full' ? 280 : 120);
    const tick = () => {
      this._lofiRaf = requestAnimationFrame(tick);
      const intensity = this.lofiLevel / 100;
      cvs.style.opacity = String(intensity * 0.55);
      if (intensity === 0) { cvs.getContext('2d').clearRect(0, 0, cvs.width, cvs.height); return; }
      const ctx = cvs.getContext('2d');
      const w = cvs.width, h = cvs.height;
      ctx.clearRect(0, 0, w, h);
      // Grain
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() > (1 - intensity * 0.6) ? Math.floor(Math.random() * 200) : 0;
        img.data[i] = img.data[i+1] = img.data[i+2] = v;
        img.data[i+3] = v > 0 ? Math.floor(v * 0.6) : 0;
      }
      ctx.putImageData(img, 0, 0);
      // Scratches
      if (intensity > 0.3 && Math.random() < intensity * 0.15) {
        ctx.strokeStyle = `rgba(255,255,220,${Math.random() * 0.4 * intensity})`;
        ctx.lineWidth = Math.random() < 0.5 ? 1 : 0.5;
        ctx.beginPath();
        const x = Math.random() * w, y = Math.random() * h, len = 20 + Math.random() * 60;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 4, y + len);
        ctx.stroke();
      }
      // Vignette
      const rad = ctx.createRadialGradient(w/2, h/2, w*0.3, w/2, h/2, w*0.7);
      rad.addColorStop(0, 'transparent');
      rad.addColorStop(1, `rgba(80,50,0,${intensity * 0.3})`);
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, w, h);
    };
    tick();
  }

  /* ─── AUDIO CTX ──────────────────────────────────────────────── */
  _setupAudioCtx() {
    if (this._audioCtx) return;
    this._audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    this._srcNode    = this._audioCtx.createMediaElementSource(this._audio);
    this._gainNode   = this._audioCtx.createGain();
    this._lofiFilter = this._audioCtx.createBiquadFilter();
    this._lofiFilter.type = 'lowpass';
    this._lofiFilter.frequency.value = 20000;
    this._srcNode.connect(this._lofiFilter);
    this._lofiFilter.connect(this._gainNode);
    this._gainNode.connect(this._audioCtx.destination);
  }

  _applyLofi(level) {
    if (!this._audioCtx) return;
    const t = this._audioCtx.currentTime;
    const i = level / 100;
    this._lofiFilter.frequency.setTargetAtTime(20000 - i * 19200, t, 0.1);
    this._gainNode.gain.setTargetAtTime(1 - i * 0.1, t, 0.1);
  }

  /* ─── LOAD / PLAY / PAUSE ────────────────────────────────────── */
  _loadTrack(idx, autoPlay = true) {
    if (idx < 0 || idx >= this.records.length) return;
    this.currentIdx = idx;
    const rec = this.records[idx];

    // Résolution du src : relatif → absolu via basePath
    let src = rec.src;
    if (!src.startsWith('http') && !src.startsWith('/')) {
      src = this.basePath + src;
    }
    this._audio.src = src;
    this._audio.load();

    this._setMeta(rec);
    this._drawVinyl(this._elVinyl, rec, this._vinylAngle * Math.PI / 180);
    this._renderShelf();

    if (this.onTrackChange) this.onTrackChange(rec);
    if (autoPlay) this._play();
    else this._pause(false);
  }

  _play() {
    this._setupAudioCtx();
    if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
    this._audio.play().catch(() => {});
    this.isPlaying = true;
    this._startVinylLoop();
    if (this._elBtnPlay) this._elBtnPlay.textContent = '⏸';
    this.container.classList.add('jkp--playing');
  }

  _pause(stopLoop = true) {
    this._audio.pause();
    this.isPlaying = false;
    if (stopLoop) this._stopVinylLoop();
    if (this._elBtnPlay) this._elBtnPlay.textContent = '▶';
    this.container.classList.remove('jkp--playing');
  }

  _next() {
    if (!this.records.length) return;
    let n = this.isShuffle
      ? Math.floor(Math.random() * this.records.length)
      : (this.currentIdx + 1) % this.records.length;
    this._loadTrack(n, true);
  }

  _prev() {
    if (!this.records.length) return;
    if (this._audio.currentTime > 3) { this._audio.currentTime = 0; return; }
    const p = (this.currentIdx - 1 + this.records.length) % this.records.length;
    this._loadTrack(p, true);
  }

  /* ─── META / SHELF ───────────────────────────────────────────── */
  _setMeta(rec) {
    if (this._elTitle)  this._elTitle.textContent  = rec.title  || '—';
    if (this._elArtist) this._elArtist.textContent = rec.artist || '';
  }

  _renderShelf(filter = '') {
    if (!this._elShelf) return;
    const vis = this.records.filter(r =>
      r.display !== false &&
      (!filter || r.title.toLowerCase().includes(filter) || r.artist.toLowerCase().includes(filter))
    );
    const cnt = this.$('.jkp-lib-count');
    if (cnt) cnt.textContent = `(${vis.length})`;
    this._elShelf.innerHTML = '';
    vis.forEach(rec => {
      const ri = this.records.indexOf(rec);
      const card = document.createElement('div');
      card.className = 'jkp-card' + (ri === this.currentIdx ? ' active' : '');
      card.setAttribute('role', 'listitem');
      const cover = rec.coverImage
        ? `<img src="${this.basePath + rec.coverImage}" alt="${rec.title}" width="160" height="160" loading="lazy">`
        : `<canvas class="jkp-card-cvs" width="160" height="160"></canvas>`;
      card.innerHTML = `
        <div class="jkp-card-cover">${cover}</div>
        <div class="jkp-card-info">
          <div class="jkp-card-title">${rec.title}</div>
          <div class="jkp-card-artist">${rec.artist}</div>
        </div>`;
      if (!rec.coverImage) {
        const cv = card.querySelector('.jkp-card-cvs');
        if (cv) this._drawVinyl(cv, rec);
      }
      card.addEventListener('click', () => {
        this._loadTrack(ri, true);
        this._switchTab('player');
      });
      this._elShelf.appendChild(card);
    });
  }

  /* ─── TABS ───────────────────────────────────────────────────── */
  _switchTab(name) {
    this.$$('.jkp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    this.$$('.jkp-panel').forEach(p => p.classList.toggle('active', p.id === `jkp-tab-${name}`));
  }

  /* ─── ADMIN ──────────────────────────────────────────────────── */
  _renderAdminList() {
    const list = this.$('#jkp-track-list');
    const cnt  = this.$('#jkp-track-count');
    if (!list) return;
    if (cnt) cnt.textContent = `(${this.records.length})`;
    list.innerHTML = this.records.map((r, i) => `
      <div class="jkp-atr">
        <span class="jkp-atr-dot" style="background:${r.coverColor || '#888'}"></span>
        <span>${r.title}</span>
        <span class="jkp-atr-sub">${r.artist}</span>
        <button class="jkp-atr-del" data-idx="${i}" aria-label="Supprimer">✕</button>
      </div>`).join('');
    list.querySelectorAll('.jkp-atr-del').forEach(btn => {
      btn.addEventListener('click', () => {
        this.records.splice(parseInt(btn.dataset.idx), 1);
        this._saveRecords();
        this._renderAdminList();
        this._renderShelf();
        this._updateExport();
      });
    });
  }

  _saveRecords() {
    localStorage.setItem('jk_records', JSON.stringify(this.records));
  }

  _updateExport() {
    const el = this.$('#jkp-json-export');
    if (el) el.value = JSON.stringify(this.records, null, 2);
  }

  _updatePreview() {
    const cvs   = this.$('#jkp-preview-canvas');
    const cover = this.$('#jkp-f-cover-color')?.value;
    const label = this.$('#jkp-f-label-color')?.value;
    if (cvs) this._drawVinyl(cvs, { coverColor: cover, labelColor: label });
  }

  /* ─── BIND EVENTS ────────────────────────────────────────────── */
  _bindEvents() {
    const $  = this._$;
    const $$ = this._$$;

    // Tabs
    $$('.jkp-tab').forEach(t => t.addEventListener('click', () => this._switchTab(t.dataset.tab)));

    // Transport
    this._elBtnPlay?.addEventListener('click', () => {
      if (this.currentIdx < 0) { this._loadTrack(0, true); return; }
      this.isPlaying ? this._pause() : this._play();
    });
    this._elBtnPrev?.addEventListener('click', () => this._prev());
    this._elBtnNext?.addEventListener('click', () => this._next());
    this._elBtnShuf?.addEventListener('click', () => {
      this.isShuffle = !this.isShuffle;
      this._elBtnShuf.classList.toggle('active', this.isShuffle);
    });
    this._elBtnRep?.addEventListener('click', () => {
      this.isRepeat = !this.isRepeat;
      this._elBtnRep.classList.toggle('active', this.isRepeat);
    });

    // Seek
    this._elSeek?.addEventListener('input', () => {
      if (this._audio.duration)
        this._audio.currentTime = (this._elSeek.value / 100) * this._audio.duration;
    });

    // Vol
    this._elVol?.addEventListener('input', () => { this._audio.volume = this._elVol.value; });

    // Lofi
    this._elLofi?.addEventListener('input', () => {
      this.lofiLevel = parseInt(this._elLofi.value);
      if (this._elLofiVal) this._elLofiVal.textContent = this.lofiLevel + '%';
      this._applyLofi(this.lofiLevel);
      $$('.jkp-preset').forEach(b => b.classList.toggle('active', parseInt(b.dataset.val) === this.lofiLevel));
    });
    $$('.jkp-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        this.lofiLevel = parseInt(btn.dataset.val);
        if (this._elLofi) this._elLofi.value = this.lofiLevel;
        if (this._elLofiVal) this._elLofiVal.textContent = this.lofiLevel + '%';
        this._applyLofi(this.lofiLevel);
        $$('.jkp-preset').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    // Search
    this._elSearch?.addEventListener('input', () =>
      this._renderShelf(this._elSearch.value.trim().toLowerCase())
    );

    // Audio events
    this._audio.addEventListener('timeupdate', () => {
      if (!this._audio.duration) return;
      const pct = (this._audio.currentTime / this._audio.duration) * 100;
      if (this._elSeek) this._elSeek.value = pct;
      if (this._elCurTime) this._elCurTime.textContent = this._fmt(this._audio.currentTime);
      if (this._elDurTime) this._elDurTime.textContent = this._fmt(this._audio.duration);
    });
    this._audio.addEventListener('loadedmetadata', () => {
      if (this._elDurTime) this._elDurTime.textContent = this._fmt(this._audio.duration);
    });
    this._audio.addEventListener('ended', () => {
      if (this.isRepeat) { this._audio.currentTime = 0; this._audio.play(); }
      else this._next();
    });

    // Shelf
    this._renderShelf();

    // Admin
    if (this.isSuperUser) {
      this._renderAdminList();
      this._updateExport();
      // Populate vinyl styles select
      const sel = $('#jkp-f-vinyl-style');
      if (sel) sel.innerHTML = this.vinylStyles.map(s =>
        `<option value="${s.id}">${s.label}</option>`).join('');

      $('#jkp-add-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const title  = $('#jkp-f-title').value.trim();
        const artist = $('#jkp-f-artist').value.trim();
        const src    = $('#jkp-f-src').value.trim();
        if (!title || !artist || !src) {
          this._feedback('Titre, artiste et fichier audio sont requis.', 'err');
          return;
        }
        this.records.push({
          id:         title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title, artist, src,
          coverImage: $('#jkp-f-cover').value.trim() || null,
          coverColor: $('#jkp-f-cover-color').value,
          labelColor: $('#jkp-f-label-color').value,
          vinylStyle: $('#jkp-f-vinyl-style').value,
          tags:       $('#jkp-f-tags').value.split(',').map(t => t.trim()).filter(Boolean),
          bpm:        parseInt($('#jkp-f-bpm').value) || 0,
          display:    true,
        });
        this._saveRecords();
        this._renderShelf();
        this._renderAdminList();
        this._updateExport();
        this._feedback(`✦ "${title}" ajouté !`, 'ok');
        e.target.reset();
        this._updatePreview();
      });
      $('#jkp-f-cover-color')?.addEventListener('input', () => this._updatePreview());
      $('#jkp-f-label-color')?.addEventListener('input', () => this._updatePreview());
      this._updatePreview();
      $('#jkp-btn-copy')?.addEventListener('click', () => {
        const ta = $('#jkp-json-export');
        ta?.select();
        document.execCommand('copy');
        const btn = $('#jkp-btn-copy');
        btn.textContent = '✓ COPIÉ';
        setTimeout(() => btn.textContent = '⎘ COPIER', 2000);
      });
    }
  }

  /* ─── HELPERS ────────────────────────────────────────────────── */
  _fmt(s) {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  _feedback(msg, type) {
    const el = this.$('#jkp-form-feedback');
    if (!el) return;
    el.textContent = msg;
    el.className = 'jkp-feedback ' + type;
    setTimeout(() => { el.textContent = ''; el.className = 'jkp-feedback'; }, 4000);
  }

  /* ─── PUBLIC API ─────────────────────────────────────────────── */
  /** Joue/pause le morceau courant */
  toggle()  { this.isPlaying ? this._pause() : this._play(); }
  /** Charge et joue un morceau par index */
  play(idx) { this._loadTrack(idx ?? this.currentIdx, true); }
  /** Pause */
  pause()   { this._pause(); }
  /** Track suivante */
  next()    { this._next(); }
  /** Track précédente */
  prev()    { this._prev(); }
  /** Définit le niveau lofi (0-100) */
  setLofi(v) {
    this.lofiLevel = Math.min(100, Math.max(0, v));
    if (this._elLofi)    this._elLofi.value = this.lofiLevel;
    if (this._elLofiVal) this._elLofiVal.textContent = this.lofiLevel + '%';
    this._applyLofi(this.lofiLevel);
  }
  /** Retourne le record courant ou null */
  get currentTrack() { return this.records[this.currentIdx] || null; }

  // Alias pratiques utilisés en interne
  $(sel)  { return this.container.querySelector(sel); }
  $$(sel) { return this.container.querySelectorAll(sel); }
}
