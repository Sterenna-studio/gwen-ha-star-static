/**
 * widgets.js — Widgets autonomes réutilisables pour le hub star/
 * VideoDay  : embed YouTube/PeerTube depuis Supabase table daily_content
 * RadioPlayer : lecteur audio stream avec visualiseur canvas
 */
import { supabase } from '../supabase.js';

// ── VIDEO DU JOUR ─────────────────────────────────────────────────────────────
export class VideoDay {
  constructor(containerId) {
    this.el = document.getElementById(containerId);
  }

  async load() {
    if (!this.el) return;
    // Essaie de charger depuis Supabase table `daily_content`
    // Si la table n'existe pas encore, affiche un placeholder
    try {
      const { data, error } = await supabase
        .from('daily_content')
        .select('video_url, title, note')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        this._renderPlaceholder();
        return;
      }
      this._renderEmbed(data);
    } catch {
      this._renderPlaceholder();
    }
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
          <iframe
            src="${src}"
            title="${title ?? 'Vidéo du jour'}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen loading="lazy"
          ></iframe>
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

// ── WEB RADIO ─────────────────────────────────────────────────────────────────
export class RadioPlayer {
  constructor(containerId, options = {}) {
    this.el      = document.getElementById(containerId);
    this.streams = options.streams ?? [
      { label: 'SOMA · Groove Salad', url: 'https://ice6.somafm.com/groovesalad-128-mp3' },
      { label: 'SOMA · Drone Zone',   url: 'https://ice6.somafm.com/dronezone-128-mp3'  },
      { label: 'SOMA · Space Station',url: 'https://ice6.somafm.com/spacestation-128-mp3' },
    ];
    this.current = 0;
    this.audio   = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.playing = false;
    this._ctx    = null;
    this._analyser = null;
    this._animId = null;
  }

  render() {
    if (!this.el) return;
    this.el.innerHTML = `
      <div class="radio-player">
        <div class="radio-top">
          <div class="radio-status">
            <span class="radio-led" id="radio-led"></span>
            <span class="radio-station" id="radio-station">${this.streams[this.current].label}</span>
          </div>
          <select class="radio-select" id="radio-select" aria-label="Choisir la station">
            ${this.streams.map((s, i) =>
              `<option value="${i}" ${i === this.current ? 'selected' : ''}>${s.label}</option>`
            ).join('')}
          </select>
        </div>
        <canvas class="radio-viz" id="radio-viz" width="280" height="36" aria-hidden="true"></canvas>
        <div class="radio-controls">
          <button class="radio-btn" id="radio-play" aria-label="Lecture / Pause">
            <span id="radio-btn-icon">▶</span>
          </button>
          <div class="radio-vol-wrap">
            <span class="radio-vol-icon" aria-hidden="true">◁</span>
            <input type="range" class="radio-vol" id="radio-vol"
              min="0" max="1" step="0.05" value="0.7" aria-label="Volume">
          </div>
        </div>
      </div>
    `;
    this._bind();
  }

  _bind() {
    document.getElementById('radio-play').addEventListener('click', () => this._togglePlay());
    document.getElementById('radio-vol').addEventListener('input', e => {
      this.audio.volume = parseFloat(e.target.value);
    });
    document.getElementById('radio-select').addEventListener('change', e => {
      this.current = parseInt(e.target.value);
      document.getElementById('radio-station').textContent = this.streams[this.current].label;
      if (this.playing) { this.audio.src = this.streams[this.current].url; this.audio.play(); }
    });
    this.audio.volume = 0.7;
  }

  _togglePlay() {
    if (this.playing) {
      this.audio.pause();
      this.playing = false;
      document.getElementById('radio-btn-icon').textContent = '▶';
      document.getElementById('radio-led').classList.remove('active');
      if (this._animId) cancelAnimationFrame(this._animId);
    } else {
      this.audio.src = this.streams[this.current].url;
      this.audio.play().then(() => {
        this.playing = true;
        document.getElementById('radio-btn-icon').textContent = '■';
        document.getElementById('radio-led').classList.add('active');
        this._initViz();
      }).catch(() => {
        document.getElementById('radio-station').textContent = 'ERREUR STREAM';
      });
    }
  }

  _initViz() {
    if (!this._ctx) {
      try {
        const actx  = new (window.AudioContext || window.webkitAudioContext)();
        const src   = actx.createMediaElementSource(this.audio);
        this._analyser = actx.createAnalyser();
        this._analyser.fftSize = 64;
        src.connect(this._analyser);
        this._analyser.connect(actx.destination);
      } catch { return; }
    }
    const canvas = document.getElementById('radio-viz');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const buf = new Uint8Array(this._analyser.frequencyBinCount);
    const draw = () => {
      if (!this.playing) return;
      this._animId = requestAnimationFrame(draw);
      this._analyser.getByteFrequencyData(buf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barW = (canvas.width / buf.length) * 1.8;
      let x = 0;
      const color = getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim();
      ctx.fillStyle = color || '#39ff14';
      buf.forEach(v => {
        const h = (v / 255) * canvas.height;
        ctx.fillRect(x, canvas.height - h, barW - 1, h);
        x += barW;
      });
    };
    draw();
  }
}
