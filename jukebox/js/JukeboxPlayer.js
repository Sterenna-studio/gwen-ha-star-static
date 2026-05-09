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
    const link = document.createElement('link');
    link.id   = 'jkp-styles';
    link.rel  = 'stylesheet';
    link.href = this.basePath + 'css/style.css';
    document.head.appendChild(link);
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
    const $$ = this.$$;

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
      const sel = $( '#jkp-f-vinyl-style');
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
