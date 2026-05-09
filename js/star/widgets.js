/**
 * widgets.js — Widgets autonomes réutilisables pour le hub star/
 * VideoDay    : embed YouTube/PeerTube depuis Supabase table daily_content
 * RadioPlayer : lecteur des musiques du Jukebox (records.json) + visualiseur canvas
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
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
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
    // Les src dans records.json sont relatifs au dossier /jukebox/
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

    // Mise à jour UI
    const cover  = document.getElementById('jk-cover');
    const artist = document.getElementById('jk-artist');
    const title  = document.getElementById('jk-title');
    const sel    = document.getElementById('radio-select');
    const station= document.getElementById('radio-station');

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
      // Premier lancement : charger la piste en cours
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
