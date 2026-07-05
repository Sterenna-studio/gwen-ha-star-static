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
  constructor(containerId, options = {}) {
    this.el = document.getElementById(containerId);
    this.preferredContent = options.preferredContent ?? null;
    this.fallbackContent = options.fallbackContent ?? null;
  }

  async load() {
    if (!this.el) return;
    if (this.preferredContent) {
      this._renderVideo(this.preferredContent);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('daily_content')
        .select('title, url, platform, note')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) { this._renderFallback(); return; }
      this._renderVideo(data);
    } catch { this._renderFallback(); }
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
    if (!embed) { this._renderFallback(); return; }
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

  _renderFallback() {
    if (this.fallbackContent) {
      const fallbackContent = this.fallbackContent;
      this.fallbackContent = null;
      this._renderVideo(fallbackContent);
      this.fallbackContent = fallbackContent;
      return;
    }
    this._renderEmpty();
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
  constructor(containerId, opts = {}) {
    this.el        = document.getElementById(containerId);
    this.userId    = opts.userId ?? null;
    this.username  = opts.username ?? 'AGENT';
    this.tracks    = [];
    this.idx       = 0;
    this.mode      = 'jukebox';
    this.live      = null;
    this.schedule  = [];
    this.totalDuration = 0;
    this.audio     = new Audio();
    this.audio.volume = 0.6;
    this._animId   = null;
    this._ctx      = null;
    this._analyser = null;
    this._src      = null;
    this._clockTimer = null;
    this._metaTimer  = null;
    this._lastErrorMode = null;
    this._serverClockOffsetMs = 0;
    this._boundaryTimer = null;
    this._wantsPlayback = false;
    this._currentSlotKey = null;
    this._currentDedication = null;
    this._spokenSlotKey = null;
    this._markPlayedTimer = null;
  }

  async render() {
    if (!this.el) return;
    this.el.innerHTML = `
      <div class="radio-player">
        <div class="radio-top">
          <div class="radio-status">
            <span class="radio-led" id="radio-led"></span>
            <span class="radio-station" id="radio-station">CHARGEMENT...</span>
            <span class="radio-live-pill" id="radio-live-pill">SYNC</span>
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
          <button class="radio-btn radio-live-btn" id="radio-live-sync" aria-label="Revenir au direct">LIVE</button>
          <div class="radio-vol-wrap">
            <span class="radio-vol-icon">♪</span>
            <input class="radio-vol" id="radio-vol" type="range" min="0" max="1" step="0.01" value="0.6">
          </div>
        </div>
        <div class="radio-dedication-now" id="radio-dedication-now">
          <span class="radio-dedication-kicker">DEDICACE</span>
          <span class="radio-dedication-text" id="radio-dedication-text">Aucune dédicace en cours</span>
        </div>
        <form class="radio-dedication-form" id="radio-dedication-form">
          <div class="radio-dedication-head">
            <span>DEDICACE ANTENNE</span>
            <strong>200 C</strong>
          </div>
          <div class="radio-dedication-row">
            <input id="radio-dedication-input" maxlength="160" autocomplete="off"
              placeholder="Message court pour la radio">
            <button type="submit" id="radio-dedication-submit">ENVOYER</button>
          </div>
          <div class="radio-dedication-status" id="radio-dedication-status"></div>
        </form>
      </div>`;
    await this._loadLiveConfig();
    await this._loadTracks();
    this._buildSchedule();
    this._bindEvents();
    this._loadDefaultMode();
    this._restoreAutoJoin();
    this._vizLoop();
  }

  _$(id) {
    return this.el?.querySelector(`#${id}`) ?? null;
  }

  async _loadLiveConfig() {
    try {
      const res = await fetch('/radio/live.json?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('radio config unavailable');
      this._syncServerClock(res);
      this.live = await res.json();
    } catch {
      this.live = {};
    }
    this.live = {
      enabled: true,
      stationName: 'Gwen Ha Star Radio',
      streamUrl: '',
      metadataUrl: '',
      scheduleEpoch: '2026-01-01T00:00:00Z',
      dedicationSlotSeconds: 14,
      fallbackToJukebox: true,
      pollSeconds: 20,
      coverImage: '/shared/logos/star_logo/star_logo_color_set/star_logo_cyan_blue.png',
      ...this.live,
    };
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
          durationSeconds: this._durationToSeconds(t.durationSeconds ?? t.duration),
        }));
    } catch { this.tracks = []; }
  }

  _buildSchedule() {
    this.schedule = [];
    this.totalDuration = 0;
    const dedicationSlotSeconds = Math.max(0, Number(this.live?.dedicationSlotSeconds) || 0);
    for (let i = 0; i < this.tracks.length; i++) {
      const duration = this.tracks[i].durationSeconds;
      if (!Number.isFinite(duration) || duration <= 0) continue;
      this.schedule.push({ type: 'track', idx: i, start: this.totalDuration, duration });
      this.totalDuration += duration;
      if (dedicationSlotSeconds > 0) {
        this.schedule.push({
          type: 'dedication',
          afterIdx: i,
          start: this.totalDuration,
          duration: dedicationSlotSeconds,
        });
        this.totalDuration += dedicationSlotSeconds;
      }
    }
  }

  _buildPlaylist() {
    const sel = this._$('radio-playlist');
    if (!sel) return;
    const liveOptions = this._hasLiveMode()
      ? `<option value="live">DIRECT - ${this._html(this.live.stationName)}</option>`
      : '';
    const trackOptions = this.tracks
      .map((t, i) => `<option value="track:${i}">${this._html(t.artist ?? '')} - ${this._html(t.title ?? t.file)}</option>`)
      .join('');
    sel.innerHTML = liveOptions || trackOptions
      ? liveOptions + trackOptions
      : '<option>Aucun titre</option>';
  }

  _loadDefaultMode() {
    this._buildPlaylist();
    if (this._hasExternalStream()) {
      this._loadStreamLive(false);
      return;
    }
    if (this._hasClockLive()) {
      this._loadClockLive(false);
      return;
    }
    if (this.tracks.length) this._loadTrack(0, false);
    else this._setEmpty();
  }

  _hasLiveMode() {
    return this._hasExternalStream() || this._hasClockLive();
  }

  _hasExternalStream() {
    return this.live?.enabled !== false && Boolean(this.live?.streamUrl);
  }

  _hasClockLive() {
    return this.live?.enabled !== false
      && this.live?.fallbackToJukebox !== false
      && this.schedule.length > 0
      && this.totalDuration > 0;
  }

  _loadTrack(i, autoplay = false) {
    if (!this.tracks.length) return;
    this._clearLiveTimers();
    this.mode = 'jukebox';
    this.audio.removeAttribute('crossorigin');
    this.idx = ((i % this.tracks.length) + this.tracks.length) % this.tracks.length;
    const t = this.tracks[this.idx];
    this._setAudioSource(t.file ?? '');
    this._updateTrackUI(t, {
      badge: t.genre ?? 'JUKEBOX',
      station: `STAR - ${(t.artist ?? 'UNKNOWN').toUpperCase()}`,
      pill: 'JUKEBOX',
      live: false,
    });
    this._setSeekMode(false);
    if (autoplay) this._play();
  }

  _loadStreamLive(autoplay = false) {
    this._clearLiveTimers();
    this.mode = 'stream';
    if (this.live.crossOrigin) this.audio.crossOrigin = this.live.crossOrigin;
    else this.audio.removeAttribute('crossorigin');
    this._setAudioSource(this.live.streamUrl);
    this._updateTrackUI({
      title: this.live.title || 'Direct live',
      artist: this.live.artist || this.live.stationName,
      cover: this.live.coverImage,
      color1: this.live.coverColor ?? '#00ff80',
      color2: this.live.labelColor ?? '#07110d',
    }, {
      badge: 'DIRECT',
      station: `STAR - ${String(this.live.stationName ?? 'LIVE').toUpperCase()}`,
      pill: 'LIVE',
      live: true,
    });
    this._setSeekMode(true);
    this._startMetadataPolling();
    if (autoplay) this._play();
  }

  _loadClockLive(autoplay = false) {
    this._clearLiveTimers();
    this.mode = 'clock';
    this._syncClockTrack(autoplay, true);
    this._clockTimer = setInterval(() => this._syncClockTrack(false, false), 5000);
  }

  _syncClockTrack(autoplay = false, force = false) {
    if (!this._hasClockLive()) return;
    const livePos = this._getClockPosition();
    if (livePos.type === 'dedication') {
      this._syncDedicationSlot(livePos, autoplay, force);
      return;
    }
    const t = this.tracks[livePos.idx];
    const changed = force || this.mode !== 'clock' || this.idx !== livePos.idx || !this.audio.currentSrc;
    this.mode = 'clock';
    this.idx = livePos.idx;
    if (changed) this._setAudioSource(t.file ?? '');
    this._updateTrackUI(t, {
      badge: 'DIRECT',
      station: `STAR - ${String(this.live.stationName ?? 'LIVE').toUpperCase()}`,
      pill: 'LIVE',
      live: true,
    });
    this._setSeekMode(true);
    const applyOffset = () => {
      if (!Number.isFinite(this.audio.duration) || !Number.isFinite(livePos.offset)) return;
      const target = Math.min(Math.max(livePos.offset, 0), Math.max(this.audio.duration - 0.25, 0));
      if (changed || Math.abs(this.audio.currentTime - target) > 2.5) {
        try { this.audio.currentTime = target; } catch {}
      }
    };
    if (this.audio.readyState >= 1) applyOffset();
    else this.audio.addEventListener('loadedmetadata', applyOffset, { once: true });
    this._scheduleBoundarySync(livePos);
    if (autoplay || (changed && this._wantsPlayback)) this._play();
  }

  _getClockPosition() {
    const epoch = Date.parse(this.live?.scheduleEpoch || '2026-01-01T00:00:00Z');
    const epochSeconds = Number.isFinite(epoch) ? epoch / 1000 : 0;
    const nowSeconds = (Date.now() + this._serverClockOffsetMs) / 1000 + Number(this.live?.clockOffsetSeconds || 0);
    const elapsedTotal = nowSeconds - epochSeconds;
    const cycle = Math.floor(elapsedTotal / this.totalDuration);
    const elapsed = ((elapsedTotal % this.totalDuration) + this.totalDuration) % this.totalDuration;
    let current = this.schedule[0];
    for (const item of this.schedule) {
      if (elapsed >= item.start && elapsed < item.start + item.duration) {
        current = item;
        break;
      }
    }
    const cycleStart = epochSeconds + cycle * this.totalDuration;
    const slotKey = current.type === 'dedication'
      ? `${this.live?.stationName ?? 'star-radio'}:${cycle}:${current.afterIdx}`
      : null;
    return {
      ...current,
      idx: current.idx,
      offset: elapsed - current.start,
      remaining: Math.max(0, current.duration - (elapsed - current.start)),
      slotKey,
      scheduledAt: new Date((cycleStart + current.start) * 1000).toISOString(),
    };
  }

  _bindEvents() {
    const playBtn = this._$('radio-play');
    const prevBtn = this._$('radio-prev');
    const nextBtn = this._$('radio-next');
    const liveBtn = this._$('radio-live-sync');
    const volEl   = this._$('radio-vol');
    const seekEl  = this._$('jk-seek');
    const selEl   = this._$('radio-playlist');
    const ledEl   = this._$('radio-led');
    playBtn?.addEventListener('click', () => {
      _sfx.click();
      if (this.mode === 'dedication' && this._wantsPlayback) {
        this._wantsPlayback = false;
        this._cancelDedicationSpeech();
        if (playBtn) playBtn.textContent = '▶';
        if (ledEl) ledEl.classList.remove('active');
        return;
      }
      if (this.audio.paused) this._play(true);
      else {
        this._wantsPlayback = false;
        this._cancelDedicationSpeech();
        this.audio.pause();
      }
    });
    prevBtn?.addEventListener('click', () => {
      _sfx.nav();
      if (this._isLiveMode()) this._joinLive(true);
      else this._loadTrack(this.idx - 1, true);
    });
    nextBtn?.addEventListener('click', () => {
      _sfx.nav();
      if (this._isLiveMode()) this._joinLive(true);
      else this._loadTrack(this.idx + 1, true);
    });
    liveBtn?.addEventListener('click', () => {
      _sfx.nav();
      this._joinLive(true);
    });
    volEl?.addEventListener('input',  () => { this.audio.volume = parseFloat(volEl.value); });
    seekEl?.addEventListener('input', () => {
      if (this.mode === 'jukebox' && this.audio.duration) {
        this.audio.currentTime = (parseFloat(seekEl.value) / 100) * this.audio.duration;
      }
    });
    selEl?.addEventListener('change', () => {
      if (selEl.value === 'live') {
        this._joinLive(true);
        return;
      }
      const idx = parseInt(selEl.value.replace('track:', ''), 10);
      this._loadTrack(idx, true);
    });
    this._$('radio-dedication-form')?.addEventListener('submit', e => this._submitDedication(e));
    this.audio.addEventListener('play',  () => {
      this._wantsPlayback = true;
      if (this._isLiveMode()) this._rememberAutoJoin();
      if (playBtn) playBtn.textContent = '⏸';
      if (ledEl) ledEl.classList.add('active');
      this._setLivePill(null, 'active');
    });
    this.audio.addEventListener('pause', () => {
      if (playBtn) playBtn.textContent = this.mode === 'dedication' && this._wantsPlayback ? '⏸' : '▶';
      if (ledEl && !(this.mode === 'dedication' && this._wantsPlayback)) ledEl.classList.remove('active');
    });
    this.audio.addEventListener('ended', () => {
      if (this.mode === 'clock') this._syncClockTrack(this._wantsPlayback, true);
      else if (this.mode === 'stream') this._loadStreamLive(true);
      else this._loadTrack(this.idx + 1, true);
    });
    this.audio.addEventListener('error', () => this._handleAudioError());
    this.audio.addEventListener('timeupdate', () => {
      const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
      const cur = this._$('jk-cur');
      const dur = this._$('jk-dur');
      const sk  = this._$('jk-seek');
      if (this.mode === 'stream') {
        if (cur) cur.textContent = 'LIVE';
        if (dur) dur.textContent = 'ON AIR';
        if (sk) sk.value = 100;
        return;
      }
      if (cur) cur.textContent = fmt(this.audio.currentTime || 0);
      if (dur) dur.textContent = Number.isFinite(this.audio.duration) ? fmt(this.audio.duration) : 'LIVE';
      if (sk && Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        sk.value = (this.audio.currentTime / this.audio.duration) * 100;
      }
    });
  }

  _play(joinLive = false) {
    this._wantsPlayback = true;
    if (joinLive && this._hasLiveMode() && !this._isLiveMode()) this._joinLive(false);
    if (this.mode === 'clock') this._syncClockTrack(false, true);
    if (this.mode === 'dedication') {
      this._speakDedication();
      this._rememberAutoJoin();
      this._setLivePill(null, 'active');
      return Promise.resolve();
    }
    this._ensureAudioCtx();
    return this.audio.play().catch(() => {
      this._setLivePill('BLOQUE', 'offline');
    });
  }

  _handleAudioError() {
    if (this._lastErrorMode === this.mode) return;
    this._lastErrorMode = this.mode;
    this._setLivePill('OFFLINE', 'offline');
    if (this.mode === 'stream' && this._hasClockLive()) this._loadClockLive(false);
  }

  _isLiveMode() {
    return this.mode === 'stream' || this.mode === 'clock' || this.mode === 'dedication';
  }

  _joinLive(autoplay = false) {
    if (this._hasExternalStream()) this._loadStreamLive(autoplay);
    else if (this._hasClockLive()) this._loadClockLive(autoplay);
  }

  async _syncDedicationSlot(livePos, autoplay = false, force = false) {
    const changed = force || this.mode !== 'dedication' || this._currentSlotKey !== livePos.slotKey;
    this.mode = 'dedication';
    this.audio.pause();
    this._setSeekMode(true);
    this._scheduleBoundarySync(livePos);

    if (changed) {
      this._currentSlotKey = livePos.slotKey;
      this._currentDedication = null;
      this._spokenSlotKey = null;
      this._cancelDedicationSpeech();
      this._updateTrackUI({
        title: 'Interlude antenne',
        artist: this.live?.stationName ?? 'Gwen Ha Star Radio',
        cover: this.live?.coverImage,
        color1: this.live?.coverColor ?? '#00ff80',
        color2: this.live?.labelColor ?? '#07110d',
      }, {
        badge: 'DEDICACE',
        station: `STAR - ${String(this.live?.stationName ?? 'LIVE').toUpperCase()}`,
        pill: 'LIVE',
        live: true,
      });
      this._setDedicationText('Recherche d une dedicace antenne...');
      await this._fetchDedicationForSlot(livePos);
    }

    if (autoplay || this._wantsPlayback) this._speakDedication();
  }

  async _fetchDedicationForSlot(livePos) {
    try {
      const { data, error } = await supabase.rpc('get_radio_dedication_for_slot', {
        p_slot_key: livePos.slotKey,
        p_scheduled_at: livePos.scheduledAt,
      });
      if (error) throw error;
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) {
        this._setDedicationText('Interlude radio - aucune dedicace en file');
        return;
      }
      this._currentDedication = item;
      this._updateTrackUI({
        title: item.message,
        artist: `Dedicace de ${item.username ?? 'AGENT'}`,
        cover: this.live?.coverImage,
        color1: this.live?.coverColor ?? '#00ff80',
        color2: this.live?.labelColor ?? '#07110d',
      }, {
        badge: 'DEDICACE',
        station: 'STAR - DEDICACE ANTENNE',
        pill: 'LIVE',
        live: true,
      });
      this._setDedicationText(`${item.username ?? 'AGENT'} - ${item.message}`);
      this._schedulePlayedMark(item.id, livePos.remaining);
    } catch (err) {
      this._setDedicationText('Dedicace indisponible');
      this._setDedicationStatus(err?.message ?? 'Erreur radio dedicace', 'err');
    }
  }

  _speakDedication() {
    if (!this._currentDedication || this._spokenSlotKey === this._currentSlotKey) return;
    this._spokenSlotKey = this._currentSlotKey;
    this._wantsPlayback = true;
    const playBtn = this._$('radio-play');
    const ledEl = this._$('radio-led');
    if (playBtn) playBtn.textContent = '⏸';
    if (ledEl) ledEl.classList.add('active');

    const text = `Dedicace de ${this._currentDedication.username ?? 'agent'}. ${this._currentDedication.message}`;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  _cancelDedicationSpeech() {
    try { window.speechSynthesis?.cancel?.(); } catch {}
  }

  _scheduleBoundarySync(livePos) {
    if (this._boundaryTimer) clearTimeout(this._boundaryTimer);
    const ms = Math.max(250, Math.min(30000, (livePos.remaining ?? 1) * 1000 + 120));
    this._boundaryTimer = setTimeout(() => this._syncClockTrack(this._wantsPlayback, true), ms);
  }

  _schedulePlayedMark(id, remainingSeconds) {
    if (!id) return;
    if (this._markPlayedTimer) clearTimeout(this._markPlayedTimer);
    const ms = Math.max(1000, Math.min(30000, (remainingSeconds ?? 2) * 1000 - 500));
    this._markPlayedTimer = setTimeout(async () => {
      try { await supabase.rpc('mark_radio_dedication_played', { p_id: id }); } catch {}
    }, ms);
  }

  async _submitDedication(event) {
    event?.preventDefault();
    const input = this._$('radio-dedication-input');
    const btn = this._$('radio-dedication-submit');
    const message = input?.value?.trim() ?? '';
    if (message.length < 3) {
      this._setDedicationStatus('Message trop court', 'err');
      return;
    }
    if (message.length > 160) {
      this._setDedicationStatus('Message trop long', 'err');
      return;
    }
    if (btn) btn.disabled = true;
    this._setDedicationStatus('Envoi...', 'pending');
    try {
      const { data, error } = await supabase.rpc('submit_radio_dedication', { p_message: message });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (input) input.value = '';
      if (row?.new_balance != null) {
        const kpiEl = document.getElementById('kpi-chronicles');
        if (kpiEl) kpiEl.textContent = Number(row.new_balance).toLocaleString('fr-FR');
      }
      this._setDedicationStatus('Dedicace ajoutee a la file', 'ok');
    } catch (err) {
      const code = err?.message ?? '';
      const msg = code.includes('INSUFFICIENT_CHRONICLES')
        ? 'Chronicles insuffisants'
        : code.includes('MESSAGE_LENGTH_INVALID')
          ? 'Message invalide'
          : 'Envoi impossible';
      this._setDedicationStatus(msg, 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  _setDedicationText(text) {
    const el = this._$('radio-dedication-text');
    if (el) el.textContent = text;
  }

  _setDedicationStatus(text, type = '') {
    const el = this._$('radio-dedication-status');
    if (!el) return;
    el.textContent = text;
    el.className = `radio-dedication-status${type ? ` radio-dedication-status--${type}` : ''}`;
  }

  _updateTrackUI(t, opts = {}) {
    const s = (id, v) => { const e = this._$(id); if (e) e.textContent = v; };
    s('jk-title',  t.title  ?? '—');
    s('jk-artist', t.artist ?? '—');
    s('jk-badge',  opts.badge ?? t.genre ?? 'JUKEBOX');
    s('radio-station', opts.station ?? `STAR - ${(t.artist ?? 'UNKNOWN').toUpperCase()}`);
    const selEl   = this._$('radio-playlist');
    const coverEl = this._$('jk-cover');
    const seekEl  = this._$('jk-seek');
    if (selEl) selEl.value = opts.live ? 'live' : `track:${this.idx}`;
    if (coverEl) {
      coverEl.innerHTML = t.cover
        ? `<img src="${this._attr(t.cover)}" alt="Cover ${this._attr(t.title ?? '')}" width="48" height="48" loading="lazy">`
        : '<span class="jk-cover-fallback">♪</span>';
      coverEl.style.setProperty('--jk-c1', t.color1 ?? '#14161a');
      coverEl.style.setProperty('--jk-c2', t.color2 ?? '#050608');
    }
    if (seekEl && !opts.live) seekEl.value = 0;
    this._setLivePill(opts.pill ?? null, opts.live ? 'live' : 'idle');
    this.el?.querySelector('.radio-player')?.classList.toggle('radio-player--live', Boolean(opts.live));
  }

  _setAudioSource(src) {
    if (!src) return;
    const absolute = new URL(src, window.location.href).href;
    if (this.audio.src === absolute || this.audio.currentSrc === absolute) return;
    this.audio.src = src;
    this.audio.load();
    this._lastErrorMode = null;
  }

  _setSeekMode(isLive) {
    const seekEl = this._$('jk-seek');
    if (!seekEl) return;
    seekEl.disabled = Boolean(isLive);
    seekEl.setAttribute('aria-disabled', isLive ? 'true' : 'false');
  }

  _setLivePill(text, state = 'idle') {
    const pill = this._$('radio-live-pill');
    if (!pill) return;
    if (text) pill.textContent = text;
    pill.classList.remove('radio-live-pill--active', 'radio-live-pill--offline', 'radio-live-pill--idle');
    const cls = state === 'active' || state === 'live'
      ? 'radio-live-pill--active'
      : state === 'offline'
        ? 'radio-live-pill--offline'
        : 'radio-live-pill--idle';
    pill.classList.add(cls);
  }

  _setEmpty() {
    this._updateTrackUI({ title: 'Aucun flux', artist: 'Radio offline' }, {
      badge: 'OFFLINE',
      station: 'STAR - RADIO OFFLINE',
      pill: 'OFFLINE',
      live: false,
    });
  }

  _startMetadataPolling() {
    if (!this.live?.metadataUrl) return;
    const refresh = async () => {
      try {
        const res = await fetch(this.live.metadataUrl, { cache: 'no-store' });
        if (!res.ok) return;
        const meta = this._parseMetadata(await res.json());
        if (!meta) return;
        this._updateTrackUI({
          title: meta.title || this.live.title || 'Direct live',
          artist: meta.artist || this.live.artist || this.live.stationName,
          cover: meta.cover || this.live.coverImage,
          color1: this.live.coverColor ?? '#00ff80',
          color2: this.live.labelColor ?? '#07110d',
        }, {
          badge: meta.isLive === false ? 'AUTO' : 'DIRECT',
          station: `STAR - ${String(meta.station || this.live.stationName || 'LIVE').toUpperCase()}`,
          pill: meta.isLive === false ? 'AUTO' : 'LIVE',
          live: true,
        });
      } catch {}
    };
    refresh();
    this._metaTimer = setInterval(refresh, Math.max(10, Number(this.live.pollSeconds) || 20) * 1000);
  }

  _parseMetadata(data) {
    if (!data || typeof data !== 'object') return null;
    const song = data.now_playing?.song ?? data.nowPlaying ?? data.song ?? data.current ?? data;
    return {
      title: data.title ?? song.title ?? song.text ?? data.now_playing?.song?.text,
      artist: data.artist ?? song.artist ?? data.live?.streamer_name,
      cover: data.cover ?? data.cover_url ?? song.art ?? song.cover ?? data.now_playing?.song?.art,
      station: data.station?.name ?? data.stationName,
      isLive: data.live?.is_live ?? data.is_live,
    };
  }

  _clearLiveTimers() {
    if (this._clockTimer) clearInterval(this._clockTimer);
    if (this._metaTimer) clearInterval(this._metaTimer);
    if (this._boundaryTimer) clearTimeout(this._boundaryTimer);
    if (this._markPlayedTimer) clearTimeout(this._markPlayedTimer);
    this._clockTimer = null;
    this._metaTimer = null;
    this._boundaryTimer = null;
    this._markPlayedTimer = null;
    this._cancelDedicationSpeech();
  }

  _syncServerClock(res) {
    const header = res?.headers?.get?.('date');
    if (!header) return;
    const serverTime = Date.parse(header);
    if (Number.isFinite(serverTime)) this._serverClockOffsetMs = serverTime - Date.now();
  }

  _rememberAutoJoin() {
    try { localStorage.setItem('starRadioAutoJoin', '1'); } catch {}
  }

  _restoreAutoJoin() {
    if (!this._isLiveMode()) return;
    let shouldJoin = false;
    try { shouldJoin = localStorage.getItem('starRadioAutoJoin') === '1'; } catch {}
    if (shouldJoin) this._play(false);
  }

  _durationToSeconds(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string' || !v.trim()) return 0;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const parts = v.split(':').map(Number);
    if (parts.some(p => !Number.isFinite(p))) return 0;
    return parts.reduce((acc, part) => acc * 60 + part, 0);
  }

  _html(v) {
    return String(v ?? '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  _attr(v) { return this._html(v); }

  _ensureAudioCtx() {
    if (this._ctx) {
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return;
    }
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
    const canvas = this._$('radio-viz');
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
