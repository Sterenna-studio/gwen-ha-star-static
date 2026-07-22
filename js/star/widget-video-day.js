/** widget-video-day.js — embed vidéo du jour depuis Supabase (extrait de widgets.js). */
import { supabase } from '../supabase.js';

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
