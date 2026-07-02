import { supabase } from '../supabase.js';
import { RadioPlayer } from './widgets.js';

/**
 * Patch runtime non destructif pour RadioPlayer.
 * Objectif : garder le mode LIVE clock/dedicaces, mais eviter la recursion
 * _syncClockTrack() -> _play() -> _syncClockTrack() quand la radio se resynchronise.
 */
if (!RadioPlayer.prototype.__starRadioStabilized) {
  RadioPlayer.prototype.__starRadioStabilized = true;

  const baseSyncClockTrack = RadioPlayer.prototype._syncClockTrack;

  RadioPlayer.prototype._syncClockTrack = function stabilizedSyncClockTrack(autoplay = false, force = false) {
    if (this._syncingClockTrack) return;
    this._syncingClockTrack = true;
    try {
      return baseSyncClockTrack.call(this, autoplay, force);
    } finally {
      this._syncingClockTrack = false;
    }
  };

  RadioPlayer.prototype._play = function stabilizedPlay(joinLive = false) {
    this._wantsPlayback = true;

    if (joinLive && this._hasLiveMode() && !this._isLiveMode()) {
      this._joinLive(false);
    }

    // En mode clock, _syncClockTrack peut appeler _play apres avoir change de piste.
    // On ne force donc une resync que si on ne vient pas deja d'une resync clock.
    if (this.mode === 'clock' && !this._syncingClockTrack) {
      this._syncClockTrack(false, true);
    }

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
  };

  RadioPlayer.prototype._fetchDedicationForSlot = async function stabilizedFetchDedicationForSlot(livePos) {
    if (this._dedicationsUnavailable) {
      this._setDedicationText('Interlude radio - dedicaces hors antenne');
      return;
    }

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
      const msg = String(err?.message ?? err ?? '');
      const permissionDenied = msg.includes('403')
        || msg.toLowerCase().includes('permission')
        || msg.toLowerCase().includes('forbidden')
        || msg.toLowerCase().includes('not authorized');

      if (permissionDenied) {
        this._dedicationsUnavailable = true;
        this._setDedicationText('Interlude radio - dedicaces indisponibles');
        this._setDedicationStatus('Dedicaces indisponibles', 'err');
        return;
      }

      this._setDedicationText('Dedicace indisponible');
      this._setDedicationStatus('Erreur radio dedicace', 'err');
    }
  };
}

function openChroniclesSidebar() {
  const bar = document.getElementById('cfm-bar');
  if (!bar) return;
  bar.classList.add('cfm-open');
  bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('sb-cfm');
  if (status && !status.__cfmSidebarStableBound) {
    status.__cfmSidebarStableBound = true;
    status.addEventListener('click', openChroniclesSidebar);
  }
});
