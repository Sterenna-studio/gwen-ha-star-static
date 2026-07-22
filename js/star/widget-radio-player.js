/** widget-radio-player.js — lecteur radio + probe de site (extrait de widgets.js). */
import { supabase } from '../supabase.js';
import { SFX as _sfx } from './widget-sfx.js';

// ── WEB RADIO ──────────────────────────────────────────────────────────────────────

/**
 * Teste si le site radio externe répond (fetch no-cors : résout si le serveur
 * est joignable, rejette si down/injoignable). Résultat mémorisé par URL pour
 * éviter de re-pinger à chaque render.
 */
const _radioSiteProbeCache = new Map();
export function probeRadioSite(url) {
  if (!_radioSiteProbeCache.has(url)) {
    _radioSiteProbeCache.set(url, (async () => {
      try {
        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        });
        return true;
      } catch {
        return false;
      }
    })());
  }
  return _radioSiteProbeCache.get(url);
}

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
            <a class="radio-site-link" id="radio-site-link" data-state="checking" hidden
               target="_blank" rel="noopener noreferrer">
              <span class="radio-site-led" aria-hidden="true"></span>KORIGAN
            </a>
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
    this._mountSiteLink();
  }

  /**
   * Lien vers le site radio externe (live.json → siteUrl).
   * Cliquable uniquement si le site répond ; sinon affiché éteint.
   */
  async _mountSiteLink() {
    const link = this.el?.querySelector('#radio-site-link');
    if (!link) return;
    const url = this.live?.siteUrl ?? '';
    if (!url) { link.hidden = true; return; }
    link.hidden = false;
    link.dataset.state = 'checking';
    link.title = 'Vérification de la radio…';
    const online = await probeRadioSite(url);
    if (online) {
      link.href = url;
      link.dataset.state = 'online';
      link.title = 'Ouvrir la radio Korigan ↗';
      link.removeAttribute('aria-disabled');
    } else {
      link.removeAttribute('href');
      link.dataset.state = 'offline';
      link.title = 'Radio hors ligne';
      link.setAttribute('aria-disabled', 'true');
    }
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
      siteUrl: '',
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
