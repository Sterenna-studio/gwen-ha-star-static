/**
 * Chronicles FM — Widget barre radio PERMANENTE
 * Ticker : freq / style / mood / titres YouTube / Lemegeton
 * <script type="module" src="/js/chronicles-fm-widget.js"></script>
 */
import { LemegetonVoice, pickPhrase, PHRASES } from './lemegeton-voice.js';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CFM_DATA_URL     = '/jukebox/chronicles-fm.json';
const CFM_PAGE_URL     = '/jukebox/chronicles-fm.html';
const STORAGE_KEY      = 'cfm-freq-idx';
const TICKER_INTERVAL  = 5500;
const AMBIENT_INTERVAL = 50000;
const YT_API_KEY       = 'AIzaSyAEruwkr9u1CN0OECR6onqY1Z3vW-LsvCE';
const YT_CACHE_KEY     = 'cfm-yt-cache';
const YT_CACHE_TTL     = 1000 * 60 * 60 * 6;

// ─── TYPEWRITER ───────────────────────────────────────────────────────────────
function typewriter(el, text, speed = 26) {
  if (!el) return;
  el.textContent = '';
  let i = 0;
  const tick = () => { if (i < text.length) { el.textContent += text[i++]; setTimeout(tick, speed); } };
  tick();
}

// ─── YOUTUBE ──────────────────────────────────────────────────────────────────
// items : [{ title, videoId }]
async function fetchPlaylistItems(playlistId) {
  if (!YT_API_KEY || !playlistId) return [];

  try {
    const raw = sessionStorage.getItem(YT_CACHE_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store[playlistId] && Date.now() - store[playlistId].ts < YT_CACHE_TTL) {
        return store[playlistId].items;
      }
    }
  } catch { /**/ }

  try {
    let items = [];
    let pageToken = '';
    for (let page = 0; page < 2; page++) {
      const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('playlistId', playlistId);
      url.searchParams.set('maxResults', '50');
      url.searchParams.set('key', YT_API_KEY);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const r = await fetch(url);
      if (!r.ok) break;
      const data = await r.json();
      items = items.concat(
        (data.items ?? []).map(i => ({
          title:   i.snippet?.title ?? '',
          videoId: i.snippet?.resourceId?.videoId ?? ''
        })).filter(i => i.title && i.videoId)
      );
      pageToken = data.nextPageToken ?? '';
      if (!pageToken) break;
    }
    try {
      const raw = sessionStorage.getItem(YT_CACHE_KEY);
      const store = raw ? JSON.parse(raw) : {};
      store[playlistId] = { items, ts: Date.now() };
      sessionStorage.setItem(YT_CACHE_KEY, JSON.stringify(store));
    } catch { /**/ }
    return items;
  } catch {
    return [];
  }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('cfm-widget-css')) return;
  const s = document.createElement('style');
  s.id = 'cfm-widget-css';
  s.textContent = `
  :root {
    --cfm-bg:     #08101a;
    --cfm-border: #1a2840;
    --cfm-red:    #e94560;
    --cfm-blue:   #00d4ff;
    --cfm-purple: #8b5cf6;
    --cfm-green:  #00ff9d;
    --cfm-amber:  #f59e0b;
    --cfm-yellow: #fde68a;
    --cfm-text:   #c8d8e8;
    --cfm-dim:    #4a6a8a;
    --cfm-mono:   'Share Tech Mono', monospace;
    --cfm-h:      34px;
  }

  #cfm-widget {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 8000;
    height: var(--cfm-h);
    background: rgba(6,12,22,.98);
    border-top: 1px solid var(--cfm-border);
    backdrop-filter: blur(16px);
    display: flex;
    align-items: stretch;
    font-family: var(--cfm-mono);
    font-size: .68rem;
    letter-spacing: .08em;
    box-shadow: 0 -4px 32px rgba(0,0,0,.7);
  }
  body { padding-bottom: var(--cfm-h) !important; }

  .cfm-slot-brand {
    display:flex; align-items:center; gap:.4rem;
    padding: 0 .8rem;
    border-right: 1px solid var(--cfm-border);
    flex-shrink: 0; white-space: nowrap;
    cursor: pointer; transition: background .15s;
  }
  .cfm-slot-brand:hover { background: rgba(233,69,96,.07); }
  .cfm-w-dot {
    width:7px; height:7px; border-radius:50%;
    background:var(--cfm-red); box-shadow:0 0 6px var(--cfm-red);
    flex-shrink:0; animation:cfm-pulse 1.4s ease-in-out infinite;
  }
  @keyframes cfm-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .cfm-brand-label {
    color:var(--cfm-red); font-size:.66rem;
    letter-spacing:.22em; text-shadow:0 0 8px rgba(233,69,96,.5);
  }

  .cfm-slot-nav { display:flex; align-items:center; border-right:1px solid var(--cfm-border); flex-shrink:0; }
  .cfm-nav-btn {
    background:none; border:none; color:var(--cfm-dim); cursor:pointer;
    width:26px; height:100%; font-size:.6rem; font-family:var(--cfm-mono);
    transition:all .15s; display:flex; align-items:center; justify-content:center;
  }
  .cfm-nav-btn:hover { background:rgba(0,212,255,.07); color:var(--cfm-blue); }

  .cfm-slot-freq {
    display:flex; align-items:center; gap:.45rem;
    padding:0 .7rem; border-right:1px solid var(--cfm-border);
    flex-shrink:0; min-width:0; max-width:210px;
  }
  .cfm-freq-name  { color:var(--cfm-text);  font-size:.68rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cfm-freq-style { color:var(--cfm-blue);  font-size:.58rem; letter-spacing:.12em; white-space:nowrap; opacity:.8; }

  .cfm-slot-ticker {
    flex:1; min-width:0; overflow:hidden;
    display:flex; align-items:center;
    position:relative; border-right:1px solid var(--cfm-border);
  }
  .cfm-ticker-label {
    flex-shrink:0; padding:0 .5rem;
    color:var(--cfm-purple); font-size:.56rem; letter-spacing:.18em; opacity:.7;
    border-right:1px solid var(--cfm-border);
    height:100%; display:flex; align-items:center;
  }
  .cfm-ticker-track {
    flex:1; min-width:0; overflow:hidden;
    height:100%; position:relative;
  }
  .cfm-ticker-seg {
    position:absolute; top:0; left:0; right:0; bottom:0;
    display:flex; align-items:center;
    padding:0 .8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    opacity:0; transform:translateY(8px);
    transition:opacity .4s ease,transform .4s ease;
    pointer-events:none;
  }
  .cfm-ticker-seg.visible { opacity:1; transform:translateY(0); pointer-events:auto; }
  .cfm-ticker-seg.exit    { opacity:0; transform:translateY(-8px); }

  .cfm-ticker-seg[data-type="leme"]   { color:var(--cfm-purple); font-style:italic; }
  .cfm-ticker-seg[data-type="freq"]   { color:var(--cfm-text); }
  .cfm-ticker-seg[data-type="style"]  { color:var(--cfm-blue); letter-spacing:.12em; }
  .cfm-ticker-seg[data-type="mood"]   { color:var(--cfm-amber); font-style:italic; font-size:.64rem; }
  .cfm-ticker-seg[data-type="signal"] { color:var(--cfm-dim); font-size:.62rem; letter-spacing:.1em; }
  .cfm-ticker-seg[data-type="yt"]     { color:var(--cfm-yellow); font-size:.66rem; cursor:pointer; }
  .cfm-ticker-seg[data-type="yt"]:hover { text-decoration:underline; text-underline-offset:3px; }

  .cfm-ticker-seg[data-type="leme"]::before   { content:'◈ ';    opacity:.6; margin-right:.15rem; flex-shrink:0; }
  .cfm-ticker-seg[data-type="signal"]::before { content:'⬡ ';    opacity:.5; margin-right:.15rem; flex-shrink:0; }
  .cfm-ticker-seg[data-type="yt"]::before     { content:'▶ NOW '; opacity:.7; margin-right:.15rem; flex-shrink:0;
                                                color:var(--cfm-red); font-size:.6rem; }

  .cfm-slot-actions { display:flex; align-items:center; padding:0 .5rem; gap:.3rem; flex-shrink:0; }
  .cfm-act-btn {
    padding:.2rem .5rem; border:1px solid var(--cfm-border);
    background:none; color:var(--cfm-dim); cursor:pointer;
    font-family:var(--cfm-mono); font-size:.6rem; letter-spacing:.1em;
    border-radius:2px; transition:all .15s;
    display:inline-flex; align-items:center; white-space:nowrap;
    text-decoration:none; height:22px;
  }
  .cfm-act-btn:hover               { border-color:var(--cfm-blue); color:var(--cfm-blue); }
  .cfm-act-btn--open               { border-color:var(--cfm-purple); color:var(--cfm-purple); }
  .cfm-act-btn--open:hover         { box-shadow:0 0 8px rgba(139,92,246,.3); }
  .cfm-act-btn--mute.muted         { border-color:var(--cfm-red); color:var(--cfm-red); }

  #cfm-drawer {
    position:fixed; bottom:var(--cfm-h); left:0; right:0;
    z-index:7999;
    background:rgba(8,13,22,.98);
    border-top:1px solid var(--cfm-purple);
    box-shadow:0 -8px 40px rgba(139,92,246,.15);
    transform:translateY(100%);
    transition:transform .35s cubic-bezier(.4,0,.2,1);
    padding:1.2rem 1rem 1.2rem;
    max-height:65vh; overflow-y:auto;
  }
  #cfm-drawer.open { transform:translateY(0); }

  .cfm-drawer-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:.8rem; }
  .cfm-drawer-title  { font-size:.82rem; color:var(--cfm-purple); letter-spacing:.2em; text-shadow:0 0 8px rgba(139,92,246,.4); }
  .cfm-drawer-close  {
    background:none; border:1px solid var(--cfm-border);
    color:var(--cfm-dim); cursor:pointer;
    padding:.2rem .5rem; font-family:var(--cfm-mono); font-size:.6rem;
    border-radius:2px; transition:all .15s;
  }
  .cfm-drawer-close:hover { border-color:var(--cfm-red); color:var(--cfm-red); }

  .cfm-bubble {
    display:flex; align-items:flex-start; gap:.6rem;
    background:rgba(139,92,246,.07); border:1px solid rgba(139,92,246,.2);
    border-left:3px solid var(--cfm-purple); border-radius:0 4px 4px 0;
    padding:.6rem .8rem; margin-bottom:1rem;
  }
  .cfm-bubble-avatar { font-size:1.1rem; flex-shrink:0; line-height:1; filter:drop-shadow(0 0 4px rgba(139,92,246,.6)); }
  .cfm-bubble-body   { flex:1; min-width:0; }
  .cfm-bubble-name   { font-size:.6rem; letter-spacing:.2em; color:var(--cfm-purple); margin-bottom:.25rem; }
  .cfm-bubble-text   { font-size:.78rem; color:var(--cfm-text); line-height:1.5; font-style:italic; min-height:1.2em; }
  .cfm-bubble-badge  { font-size:.55rem; letter-spacing:.12em; color:var(--cfm-dim); margin-top:.2rem; }
  .cfm-bubble-badge.speaking { color:var(--cfm-green); animation:cfm-pulse 1s ease-in-out infinite; }

  .cfm-yt-titles {
    margin: .8rem 0;
    display: flex;
    flex-direction: column;
    gap: .25rem;
    max-height: 140px;
    overflow-y: auto;
    padding-right: .3rem;
  }
  .cfm-yt-titles::-webkit-scrollbar { width: 3px; }
  .cfm-yt-titles::-webkit-scrollbar-thumb { background: var(--cfm-border); border-radius: 2px; }
  .cfm-yt-title-item {
    font-size: .68rem; color: var(--cfm-dim);
    padding: .2rem .4rem;
    border-left: 2px solid transparent;
    transition: all .15s; cursor: pointer;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cfm-yt-title-item:hover  { color: var(--cfm-yellow); border-left-color: var(--cfm-yellow); }
  .cfm-yt-title-item::before { content: '▶ '; color: var(--cfm-red); font-size: .55rem; opacity: .7; }
  .cfm-yt-section-label {
    font-size: .6rem; letter-spacing: .15em; color: var(--cfm-dim);
    margin-bottom: .2rem; opacity: .7;
  }

  /* hint raccourcis clavier */
  .cfm-kbd-hint {
    font-size: .55rem; color: var(--cfm-dim); letter-spacing: .1em;
    margin-top: .5rem; opacity: .6;
  }
  .cfm-kbd-hint kbd {
    display:inline-block; padding:.05rem .3rem;
    border:1px solid var(--cfm-border); border-radius:2px;
    font-family:var(--cfm-mono); font-size:.55rem;
    color:var(--cfm-dim); margin:0 .15rem;
  }

  .cfm-drawer-embed iframe { width:100%; height:200px; border:none; border-radius:3px; display:block; }
  .cfm-drawer-sync {
    background:rgba(255,255,255,.03); border:1px dashed var(--cfm-border);
    border-radius:3px; padding:1.5rem; text-align:center;
    color:var(--cfm-dim); font-size:.75rem; letter-spacing:.1em;
  }
  .cfm-drawer-meta { margin-top:.8rem; display:flex; flex-direction:column; gap:.2rem; }
  .cfm-d-title { color:var(--cfm-text); font-size:.85rem; }
  .cfm-d-style { color:var(--cfm-blue); font-size:.72rem; letter-spacing:.1em; }
  .cfm-d-mood  { color:var(--cfm-dim);  font-size:.7rem;  font-style:italic; }

  .cfm-drawer-actions { margin-top:.8rem; display:flex; gap:.5rem; flex-wrap:wrap; }
  .cfm-drawer-btn {
    padding:.35rem .7rem; border:1px solid var(--cfm-border);
    background:none; color:var(--cfm-dim); cursor:pointer;
    font-family:var(--cfm-mono); font-size:.68rem; letter-spacing:.1em;
    border-radius:2px; transition:all .15s;
    text-decoration:none; display:inline-flex; align-items:center;
  }
  .cfm-drawer-btn:hover       { border-color:var(--cfm-blue); color:var(--cfm-blue); }
  .cfm-drawer-btn--yt:hover   { border-color:#ff0000; color:#ff0000; }
  .cfm-drawer-btn--page       { border-color:var(--cfm-purple); color:var(--cfm-purple); }
  .cfm-drawer-btn--page:hover { box-shadow:0 0 8px rgba(139,92,246,.3); }
  .cfm-drawer-btn--mute.muted { border-color:var(--cfm-red); color:var(--cfm-red); }

  @media(max-width:480px){
    .cfm-brand-label { display:none; }
    .cfm-slot-freq   { max-width:110px; }
    #cfm-widget      { font-size:.62rem; }
    .cfm-kbd-hint    { display:none; }
  }
  `;
  document.head.appendChild(s);
}

// ─── TICKER ───────────────────────────────────────────────────────────────────
class Ticker {
  constructor(track, interval = TICKER_INTERVAL) {
    this._track    = track;
    this._interval = interval;
    this._segments = [];
    this._cur      = null;
    this._timer    = null;
    this._idx      = 0;
    this._onYtClick = null; // callback(videoId)
  }

  setSegments(segs) { this._segments = segs; this._idx = 0; }
  onYtClick(fn) { this._onYtClick = fn; }

  addYtSegments(items) {
    this._segments = this._segments.filter(s => s.type !== 'yt');
    const sample = [...items].sort(() => Math.random() - .5).slice(0, 8);
    sample.forEach(item => this._segments.push({ type: 'yt', text: item.title, videoId: item.videoId }));
  }

  start() { this._show(); this._timer = setInterval(() => this._advance(), this._interval); }
  stop()  { clearInterval(this._timer); }

  _advance() {
    if (!this._segments.length) return;
    this._idx = (this._idx + 1) % this._segments.length;
    this._show();
  }

  _show() {
    if (!this._segments.length) return;
    const seg = this._segments[this._idx];
    if (this._cur) {
      this._cur.classList.add('exit');
      const old = this._cur;
      setTimeout(() => old.remove(), 450);
    }
    const el = document.createElement('div');
    el.className = 'cfm-ticker-seg';
    el.dataset.type = seg.type;
    el.textContent  = seg.text;
    if (seg.type === 'yt' && seg.videoId) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        if (this._onYtClick) this._onYtClick(seg.videoId);
      });
    }
    this._track.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
    this._cur = el;
  }

  updateSegment(type, text) {
    const i = this._segments.findIndex(s => s.type === type);
    if (i !== -1) this._segments[i].text = text;
    if (this._cur?.dataset.type === type) this._cur.textContent = text;
  }
}

// ─── BUILD DOM ────────────────────────────────────────────────────────────────
function buildDOM() {
  const bar = document.createElement('div');
  bar.id = 'cfm-widget';
  bar.innerHTML = `
    <div class="cfm-slot-brand" id="cfm-brand" title="Chronicles FM — ouvrir le drawer">
      <span class="cfm-w-dot"></span>
      <span class="cfm-brand-label">CHRONICLES FM</span>
    </div>
    <div class="cfm-slot-nav">
      <button class="cfm-nav-btn" id="cfm-prev" aria-label="Fréquence précédente">◀</button>
      <button class="cfm-nav-btn" id="cfm-next" aria-label="Fréquence suivante">▶</button>
    </div>
    <div class="cfm-slot-freq">
      <span class="cfm-freq-name"  id="cfm-w-name">—</span>
      <span class="cfm-freq-style" id="cfm-w-style"></span>
    </div>
    <div class="cfm-slot-ticker">
      <span class="cfm-ticker-label">LEMEGETON</span>
      <div class="cfm-ticker-track" id="cfm-ticker-track"></div>
    </div>
    <div class="cfm-slot-actions">
      <button class="cfm-act-btn cfm-act-btn--open" id="cfm-w-toggle">▶ OUVRIR</button>
      <button class="cfm-act-btn cfm-act-btn--mute" id="cfm-w-mute" title="Muet voix">🔊</button>
    </div>
  `;

  const drawer = document.createElement('div');
  drawer.id = 'cfm-drawer';
  drawer.innerHTML = `
    <div class="cfm-drawer-header">
      <span class="cfm-drawer-title">📡 CHRONICLES FM</span>
      <button class="cfm-drawer-close" id="cfm-drawer-close">✕ FERMER</button>
    </div>
    <div class="cfm-bubble">
      <span class="cfm-bubble-avatar">👾</span>
      <div class="cfm-bubble-body">
        <div class="cfm-bubble-name">LEMEGETON · CHRONICŒUR</div>
        <div class="cfm-bubble-text" id="cfm-drawer-leme"></div>
        <div class="cfm-bubble-badge" id="cfm-voice-badge">—</div>
      </div>
    </div>
    <div id="cfm-drawer-embed" class="cfm-drawer-embed"></div>
    <div id="cfm-yt-section" style="display:none">
      <div class="cfm-yt-section-label">▶ TITRES DE LA PLAYLIST</div>
      <div class="cfm-yt-titles" id="cfm-yt-titles"></div>
    </div>
    <div class="cfm-drawer-meta">
      <div class="cfm-d-title" id="cfm-d-title"></div>
      <div class="cfm-d-style" id="cfm-d-style"></div>
      <div class="cfm-d-mood"  id="cfm-d-mood"></div>
    </div>
    <div class="cfm-drawer-actions">
      <a   class="cfm-drawer-btn cfm-drawer-btn--yt"   id="cfm-d-yt" href="#" target="_blank" rel="noopener">▶ YOUTUBE</a>
      <a   class="cfm-drawer-btn cfm-drawer-btn--page" href="${CFM_PAGE_URL}">⬡ TOUTES LES FRÉQUENCES</a>
      <button class="cfm-drawer-btn cfm-drawer-btn--mute" id="cfm-drawer-mute">🔊 VOIX</button>
    </div>
    <div class="cfm-kbd-hint">
      <kbd>←</kbd><kbd>→</kbd> changer de fréquence &nbsp;·&nbsp; <kbd>Espace</kbd> ouvrir/fermer
    </div>
  `;

  document.body.appendChild(drawer);
  document.body.appendChild(bar);
  return { bar, drawer };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function initChroniclesFM() {
  injectCSS();

  let playlists = [];
  try {
    const r = await fetch(CFM_DATA_URL);
    playlists = await r.json();
  } catch { return; }
  if (!playlists.length) return;

  const lv = new LemegetonVoice({ speechEnabled: true, volume: 0.75 });
  await lv.init();

  const { bar, drawer } = buildDOM();

  let idx = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? '0', 10);
  if (idx >= playlists.length) idx = 0;

  let drawerOpen   = false;
  let ambientTimer = null;

  const wName        = bar.querySelector('#cfm-w-name');
  const wStyle       = bar.querySelector('#cfm-w-style');
  const tickerTrack  = bar.querySelector('#cfm-ticker-track');
  const dLeme        = drawer.querySelector('#cfm-drawer-leme');
  const dEmbed       = drawer.querySelector('#cfm-drawer-embed');
  const dTitle       = drawer.querySelector('#cfm-d-title');
  const dStyle       = drawer.querySelector('#cfm-d-style');
  const dMood        = drawer.querySelector('#cfm-d-mood');
  const dYt          = drawer.querySelector('#cfm-d-yt');
  const ytSection    = drawer.querySelector('#cfm-yt-section');
  const ytTitlesList = drawer.querySelector('#cfm-yt-titles');
  const voiceBadge   = drawer.querySelector('#cfm-voice-badge');

  const ticker = new Ticker(tickerTrack, TICKER_INTERVAL);

  // Ouvrir une vidéo YouTube dans un nouvel onglet
  function openVideo(videoId) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
  }

  ticker.onYtClick(openVideo);

  function buildBaseSegments(p, lemePhrase) {
    const segs = [];
    segs.push({ type: 'freq',   text: p.title });
    if (p.style) segs.push({ type: 'style',  text: p.style.toUpperCase() });
    if (p.mood)  segs.push({ type: 'mood',   text: p.mood });
    segs.push({ type: 'leme',   text: lemePhrase });
    segs.push({ type: 'signal', text: 'BZH CHRONICLES RADIO · ON AIR' });
    if (p.tags?.length) segs.push({ type: 'signal', text: p.tags.map(t => t.toUpperCase()).join(' · ') });
    return segs;
  }

  function updateVoiceBadge() {
    if (!voiceBadge) return;
    if (lv.muted)             voiceBadge.textContent = 'VOIX · MUET';
    else if (lv._mp3map.size) voiceBadge.textContent = 'MP3 BANK · ACTIF';
    else if (lv._voice)       voiceBadge.textContent = `WEB SPEECH · ${lv._voice.name}`;
    else                      voiceBadge.textContent = 'TEXTE SEUL';
  }

  function sayAndWrite(el, phrase) {
    if (el) typewriter(el, phrase);
    if (!lv.muted) {
      voiceBadge?.classList.add('speaking');
      lv.speak('ambient', { text: phrase });
      setTimeout(() => voiceBadge?.classList.remove('speaking'), phrase.length * 60 + 800);
    }
    ticker.updateSegment('leme', phrase);
  }

  async function loadYtItems(p) {
    if (!p.youtubePlaylistId) { ytSection.style.display = 'none'; return; }
    const items = await fetchPlaylistItems(p.youtubePlaylistId);
    if (!items.length) { ytSection.style.display = 'none'; return; }

    ticker.addYtSegments(items);

    ytTitlesList.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className   = 'cfm-yt-title-item';
      el.textContent = item.title;
      el.title       = item.title;
      if (item.videoId) {
        el.addEventListener('click', () => openVideo(item.videoId));
      }
      ytTitlesList.appendChild(el);
    });
    ytSection.style.display = 'block';
  }

  function renderFreq(newIdx, isTransition = false) {
    idx = newIdx;
    sessionStorage.setItem(STORAGE_KEY, idx);
    const p = playlists[idx];

    wName.textContent  = p.subtitle ?? p.title;
    wStyle.textContent = p.style ?? '';

    const phrase = isTransition
      ? pickPhrase('transition', p.tags)
      : pickPhrase('ambient', p.tags);

    ticker.stop();
    ticker.setSegments(buildBaseSegments(p, phrase));
    ticker.start();

    loadYtItems(p);

    dTitle.textContent = p.title;
    dStyle.textContent = p.style ?? '';
    dMood.textContent  = p.mood  ?? '';

    if (p.youtubePlaylistId) {
      dEmbed.innerHTML = `<iframe
        src="https://www.youtube.com/embed/videoseries?list=${p.youtubePlaylistId}&autoplay=0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy" title="${p.title}"></iframe>`;
      dYt.href = `https://www.youtube.com/playlist?list=${p.youtubePlaylistId}`;
      dYt.style.opacity = '1'; dYt.style.pointerEvents = '';
    } else {
      dEmbed.innerHTML = `<div class="cfm-drawer-sync">📡 Fréquence en cours de synchronisation</div>`;
      dYt.href = CFM_PAGE_URL;
      dYt.style.opacity = '.4'; dYt.style.pointerEvents = 'none';
    }

    if (drawerOpen) sayAndWrite(dLeme, phrase);
    else if (dLeme) typewriter(dLeme, phrase);

    clearInterval(ambientTimer);
    ambientTimer = setInterval(() => {
      const l = pickPhrase('ambient', p.tags);
      sayAndWrite(dLeme, l);
    }, AMBIENT_INTERVAL);
  }

  function openDrawer() {
    drawerOpen = true;
    drawer.classList.add('open');
    bar.querySelector('#cfm-w-toggle').textContent = '▼ REPLIER';
    sayAndWrite(dLeme, pickPhrase('ambient', playlists[idx].tags));
  }

  function closeDrawer() {
    drawerOpen = false;
    drawer.classList.remove('open');
    bar.querySelector('#cfm-w-toggle').textContent = '▶ OUVRIR';
  }

  function toggleMute() {
    lv.setMuted(!lv.muted);
    const m = lv.muted;
    const wBtn = bar.querySelector('#cfm-w-mute');
    const dBtn = drawer.querySelector('#cfm-drawer-mute');
    if (wBtn) { wBtn.textContent = m ? '🔇' : '🔊'; wBtn.classList.toggle('muted', m); }
    if (dBtn) { dBtn.textContent = m ? '🔇 VOIX' : '🔊 VOIX'; dBtn.classList.toggle('muted', m); }
    updateVoiceBadge();
  }

  // ─── RACCOURCIS CLAVIER ──────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    // Ignorer si focus dans un input/textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      renderFreq((idx - 1 + playlists.length) % playlists.length, true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      renderFreq((idx + 1) % playlists.length, true);
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      drawerOpen ? closeDrawer() : openDrawer();
    }
  });

  // ─── SWIPE MOBILE ────────────────────────────────────────────────────────
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 50;
  const SWIPE_MAX_Y     = 80; // tolérance verticale

  bar.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  }, { passive: true });

  bar.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_MAX_Y) return;
    if (dx < 0) renderFreq((idx + 1) % playlists.length, true);         // swipe gauche → suivant
    else        renderFreq((idx - 1 + playlists.length) % playlists.length, true); // swipe droite → précédent
  }, { passive: true });

  // ─── EVENTS ──────────────────────────────────────────────────────────────
  bar.querySelector('#cfm-brand').addEventListener('click',    () => drawerOpen ? closeDrawer() : openDrawer());
  bar.querySelector('#cfm-prev').addEventListener('click',     () => renderFreq((idx - 1 + playlists.length) % playlists.length, true));
  bar.querySelector('#cfm-next').addEventListener('click',     () => renderFreq((idx + 1) % playlists.length, true));
  bar.querySelector('#cfm-w-toggle').addEventListener('click', () => drawerOpen ? closeDrawer() : openDrawer());
  bar.querySelector('#cfm-w-mute').addEventListener('click',   toggleMute);
  drawer.querySelector('#cfm-drawer-close').addEventListener('click', closeDrawer);
  drawer.querySelector('#cfm-drawer-mute').addEventListener('click',  toggleMute);

  updateVoiceBadge();
  renderFreq(idx, false);

  setTimeout(() => {
    const intro = pickPhrase('intro');
    sayAndWrite(dLeme, intro);
  }, 2000);
}

initChroniclesFM();
