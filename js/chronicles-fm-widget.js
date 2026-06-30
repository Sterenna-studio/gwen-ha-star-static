/**
 * Chronicles FM — Widget barre radio PERMANENTE
 * v4 : speechEnabled:false · LemePanel flottant · sans bouton mute
 * <script type="module" src="/js/chronicles-fm-widget.js"></script>
 */
import { LemegetonVoice, pickPhrase, PHRASES } from './lemegeton-voice.js';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CFM_DATA_URL      = '/chronicles-fm/data.json';
const CFM_PAGE_URL      = '/chronicles-fm/';
const STORAGE_KEY       = 'cfm-freq-idx';
const AMBIENT_INTERVAL  = 50000;
const YT_API_KEY        = 'AIzaSyAEruwkr9u1CN0OECR6onqY1Z3vW-LsvCE';
const YT_CACHE_KEY      = 'cfm-yt-cache';
const YT_CACHE_TTL      = 1000 * 60 * 60 * 6;
const SCROLL_SPEED_PX   = 55;   // px/s télescripteur
const SCROLL_SEP        = '  ⬡  ';

const NIGHT_HOUR_START  = 0;
const NIGHT_HOUR_END    = 6;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function typewriter(el, text, speed = 26, onDone) {
  if (!el) return;
  el.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'cfm-lp-cursor';
  cursor.textContent = '▌';
  let i = 0;
  const tick = () => {
    if (i < text.length) {
      el.textContent = text.slice(0, ++i);
      el.appendChild(cursor);
      setTimeout(tick, speed);
    } else {
      if (onDone) onDone();
    }
  };
  tick();
}

function isNightMode() {
  const h = new Date().getHours();
  return h >= NIGHT_HOUR_START && h < NIGHT_HOUR_END;
}

// FIX: apostrophes typographiques remplacées par des apostrophes droites standard
const NIGHT_PHRASES = [
  "Les signaux se fondent dans l'obscurite des frequences mortes.",
  "L'ether murmure des elegies a minuit passe.",
  'Seuls les demons veillent encore sur les ondes.',
  'Transmissions chiffrees depuis les catacombes numeriques.',
  "L'obscurite amplifie. Les vivants dorment. Les machines ecoutent.",
  'Frequences noires. Signal de l\'abime. BZH Chronicles ne dort pas.',
  'Les archives s\'ouvrent sous la nuit. Systeme 03:00 · ACTIF.',
  'Heure maudite. Lemegeton transmet depuis les limbes.',
];

function pickNightOrAmbient(type, tags) {
  if (isNightMode()) {
    return NIGHT_PHRASES[Math.floor(Math.random() * NIGHT_PHRASES.length)];
  }
  return pickPhrase(type, tags);
}

// ─── YOUTUBE ─────────────────────────────────────────────────────────────────
async function fetchPlaylistItems(playlistId) {
  if (!YT_API_KEY || !playlistId) return [];
  try {
    const raw = sessionStorage.getItem(YT_CACHE_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store[playlistId] && Date.now() - store[playlistId].ts < YT_CACHE_TTL)
        return store[playlistId].items;
    }
  } catch { /**/ }
  try {
    let items = [];
    let pageToken = '';
    for (let page = 0; page < 5; page++) {
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
          videoId: i.snippet?.resourceId?.videoId ?? '',
          thumb:   i.snippet?.thumbnails?.default?.url ?? ''
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
  } catch { return []; }
}

async function fetchPlaylistThumb(playlistId) {
  if (!YT_API_KEY || !playlistId) return null;
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlists');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('id', playlistId);
    url.searchParams.set('key', YT_API_KEY);
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const t = data.items?.[0]?.snippet?.thumbnails;
    return t?.medium?.url ?? t?.default?.url ?? null;
  } catch { return null; }
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
  .cfm-night {
    --cfm-bg:     #04080f;
    --cfm-border: #150d25;
    --cfm-red:    #7a1530;
    --cfm-blue:   #5512a8;
    --cfm-purple: #6d28d9;
    --cfm-green:  #00cc5a;
    --cfm-text:   #8899aa;
    --cfm-dim:    #2a3a4a;
  }

  /* ── BARRE ── */
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
    transition: background .8s;
  }
  body { padding-bottom: var(--cfm-h) !important; }

  .cfm-slot-brand {
    display:flex; align-items:center; gap:.4rem;
    padding: 0 .8rem;
    border-right: 1px solid var(--cfm-border);
    flex-shrink: 0; white-space: nowrap;
    cursor: pointer; transition: background .15s;
    position:relative;
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
  .cfm-count-badge {
    font-size:.55rem; letter-spacing:.1em;
    color:var(--cfm-dim); border:1px solid var(--cfm-border);
    padding:.05rem .3rem; border-radius:2px;
    background:rgba(0,212,255,.04);
    transition:color .3s; flex-shrink:0;
  }
  .cfm-count-badge.loaded { color:var(--cfm-blue); border-color:rgba(0,212,255,.3); }

  .cfm-hover-tooltip {
    position:absolute;
    bottom:calc(100% + 6px); left:50%;
    transform:translateX(-50%) translateY(4px);
    background:rgba(4,8,15,.97);
    border:1px solid var(--cfm-purple);
    border-radius:3px;
    padding:.35rem .6rem;
    font-size:.62rem; color:var(--cfm-yellow);
    white-space:nowrap; max-width:320px;
    overflow:hidden; text-overflow:ellipsis;
    pointer-events:none;
    opacity:0; transition:opacity .2s,transform .2s;
    box-shadow:0 0 12px rgba(139,92,246,.3);
    z-index:8010;
  }
  .cfm-hover-tooltip.visible { opacity:1; transform:translateX(-50%) translateY(0); }
  .cfm-hover-tooltip::before { content:'▶ '; color:var(--cfm-red); font-size:.55rem; }

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
    flex-shrink:0; min-width:0; max-width:200px;
  }
  .cfm-freq-name  { color:var(--cfm-text); font-size:.68rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cfm-freq-style { color:var(--cfm-blue); font-size:.58rem; letter-spacing:.12em; white-space:nowrap; opacity:.8; }

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
  .cfm-ticker-wrap {
    flex:1; min-width:0; overflow:hidden;
    height:100%; position:relative;
  }
  .cfm-ticker-wrap::before,
  .cfm-ticker-wrap::after {
    content:''; position:absolute; top:0; bottom:0; width:24px;
    z-index:2; pointer-events:none;
  }
  .cfm-ticker-wrap::before { left:0;  background:linear-gradient(to right, rgba(6,12,22,1), transparent); }
  .cfm-ticker-wrap::after  { right:0; background:linear-gradient(to left,  rgba(6,12,22,1), transparent); }
  .cfm-ticker-scroll {
    display:inline-flex; align-items:center;
    white-space:nowrap; height:100%;
    will-change:transform;
  }
  .cfm-ticker-item {
    padding:0 .2rem; line-height:var(--cfm-h); cursor:default;
  }
  .cfm-ticker-item[data-type="leme"]   { color:var(--cfm-purple); font-style:italic; }
  .cfm-ticker-item[data-type="freq"]   { color:var(--cfm-text); }
  .cfm-ticker-item[data-type="style"]  { color:var(--cfm-blue); letter-spacing:.12em; }
  .cfm-ticker-item[data-type="mood"]   { color:var(--cfm-amber); font-style:italic; }
  .cfm-ticker-item[data-type="signal"] { color:var(--cfm-dim); font-size:.62rem; letter-spacing:.1em; }
  .cfm-ticker-item[data-type="yt"]     { color:var(--cfm-yellow); cursor:pointer; }
  .cfm-ticker-item[data-type="yt"]:hover { text-decoration:underline; text-underline-offset:3px; }
  .cfm-ticker-item[data-type="count"]  { color:var(--cfm-blue); font-size:.62rem; opacity:.8; }
  .cfm-ticker-item[data-type="night"]  { color:#6d28d9; font-style:italic; text-shadow:0 0 6px rgba(109,40,217,.6); }
  .cfm-ticker-sep { color:var(--cfm-dim); opacity:.35; padding:0 .2rem; }
  .cfm-ticker-item[data-type="leme"]::before   { content:'◈ '; opacity:.6; }
  .cfm-ticker-item[data-type="signal"]::before { content:'⬡ '; opacity:.5; }
  .cfm-ticker-item[data-type="yt"]::before     { content:'▶ NOW · '; color:var(--cfm-red); font-size:.6rem; opacity:.8; }
  .cfm-ticker-item[data-type="night"]::before  { content:'🌙 '; }

  .cfm-slot-actions { display:flex; align-items:center; padding:0 .5rem; gap:.3rem; flex-shrink:0; }
  .cfm-act-btn {
    padding:.2rem .5rem; border:1px solid var(--cfm-border);
    background:none; color:var(--cfm-dim); cursor:pointer;
    font-family:var(--cfm-mono); font-size:.6rem; letter-spacing:.1em;
    border-radius:2px; transition:all .15s;
    display:inline-flex; align-items:center; white-space:nowrap;
    text-decoration:none; height:22px;
  }
  .cfm-act-btn:hover        { border-color:var(--cfm-blue); color:var(--cfm-blue); }
  .cfm-act-btn--open        { border-color:var(--cfm-purple); color:var(--cfm-purple); }
  .cfm-act-btn--open:hover  { box-shadow:0 0 8px rgba(139,92,246,.3); }

  /* ── DRAWER ── */
  #cfm-drawer {
    position:fixed; bottom:var(--cfm-h); left:0; right:0;
    z-index:7999;
    background:rgba(8,13,22,.98);
    border-top:1px solid var(--cfm-purple);
    box-shadow:0 -8px 40px rgba(139,92,246,.15);
    transform:translateY(100%);
    transition:transform .35s cubic-bezier(.4,0,.2,1);
    padding:1.2rem 1rem 1rem;
    max-height:70vh; overflow-y:auto;
  }
  #cfm-drawer.open { transform:translateY(0); }

  .cfm-drawer-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:.8rem; }
  .cfm-drawer-title  { font-size:.82rem; color:var(--cfm-purple); letter-spacing:.2em; text-shadow:0 0 8px rgba(139,92,246,.4); }
  .cfm-night-badge   { font-size:.58rem; color:#6d28d9; letter-spacing:.15em; margin-left:.6rem;
                        text-shadow:0 0 6px rgba(109,40,217,.7); }
  .cfm-drawer-close  {
    background:none; border:1px solid var(--cfm-border);
    color:var(--cfm-dim); cursor:pointer;
    padding:.2rem .5rem; font-family:var(--cfm-mono); font-size:.6rem;
    border-radius:2px; transition:all .15s;
  }
  .cfm-drawer-close:hover { border-color:var(--cfm-red); color:var(--cfm-red); }

  .cfm-drawer-thumb-row {
    display:flex; gap:.8rem; align-items:flex-start;
    margin-bottom:.8rem;
  }
  .cfm-drawer-thumb {
    width:120px; height:68px; object-fit:cover;
    border-radius:3px; border:1px solid var(--cfm-border);
    flex-shrink:0; display:block;
    box-shadow:0 0 12px rgba(0,0,0,.5);
  }
  .cfm-drawer-thumb-placeholder {
    width:120px; height:68px;
    border:1px dashed var(--cfm-border); border-radius:3px;
    display:flex; align-items:center; justify-content:center;
    color:var(--cfm-dim); font-size:.6rem; flex-shrink:0;
    background:rgba(0,0,0,.2);
  }
  .cfm-drawer-thumb-meta { flex:1; min-width:0; display:flex; flex-direction:column; gap:.2rem; }

  .cfm-drawer-embed iframe {
    width:100%; height:200px; border:none; border-radius:3px; display:block;
    margin-bottom:.6rem;
  }
  .cfm-drawer-sync {
    background:rgba(255,255,255,.03); border:1px dashed var(--cfm-border);
    border-radius:3px; padding:1.5rem; text-align:center;
    color:var(--cfm-dim); font-size:.75rem; letter-spacing:.1em;
    margin-bottom:.6rem;
  }

  .cfm-search-wrap {
    display:flex; gap:.4rem; align-items:center; margin-bottom:.4rem;
  }
  .cfm-search-input {
    flex:1; background:rgba(0,212,255,.04);
    border:1px solid var(--cfm-border); border-radius:2px;
    color:var(--cfm-text); font-family:var(--cfm-mono); font-size:.68rem;
    padding:.3rem .5rem; outline:none; transition:border-color .15s;
  }
  .cfm-search-input:focus { border-color:var(--cfm-blue); }
  .cfm-search-input::placeholder { color:var(--cfm-dim); opacity:.6; }
  .cfm-search-count { font-size:.58rem; color:var(--cfm-dim); white-space:nowrap; letter-spacing:.08em; }

  .cfm-yt-titles {
    display:flex; flex-direction:column; gap:.2rem;
    max-height:160px; overflow-y:auto; padding-right:.3rem;
    margin-bottom:.6rem;
  }
  .cfm-yt-titles::-webkit-scrollbar { width:3px; }
  .cfm-yt-titles::-webkit-scrollbar-thumb { background:var(--cfm-border); border-radius:2px; }
  .cfm-yt-title-item {
    font-size:.67rem; color:var(--cfm-dim);
    padding:.22rem .4rem;
    border-left:2px solid transparent;
    transition:all .15s; cursor:pointer;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    border-radius:0 2px 2px 0;
  }
  .cfm-yt-title-item:hover { color:var(--cfm-yellow); border-left-color:var(--cfm-yellow); background:rgba(253,230,138,.04); }
  .cfm-yt-title-item::before { content:'▶ '; color:var(--cfm-red); font-size:.55rem; opacity:.7; }
  .cfm-yt-title-item.hidden { display:none; }
  .cfm-yt-section-label { font-size:.6rem; letter-spacing:.15em; color:var(--cfm-dim); margin-bottom:.3rem; opacity:.7; }

  .cfm-drawer-meta { display:flex; flex-direction:column; gap:.2rem; margin-bottom:.6rem; }
  .cfm-d-title { color:var(--cfm-text); font-size:.85rem; }
  .cfm-d-style { color:var(--cfm-blue); font-size:.72rem; letter-spacing:.1em; }
  .cfm-d-mood  { color:var(--cfm-dim);  font-size:.7rem;  font-style:italic; }

  .cfm-drawer-actions { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:.5rem; }
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

  .cfm-kbd-hint {
    font-size:.55rem; color:var(--cfm-dim); letter-spacing:.1em; opacity:.55;
  }
  .cfm-kbd-hint kbd {
    display:inline-block; padding:.05rem .3rem;
    border:1px solid var(--cfm-border); border-radius:2px;
    font-family:var(--cfm-mono); font-size:.55rem;
    color:var(--cfm-dim); margin:0 .15rem;
  }

  /* ── LEMEGETON PANEL FLOTTANT ── */
  #cfm-leme-panel {
    position: fixed;
    bottom: calc(var(--cfm-h) + 12px);
    right: 16px;
    z-index: 7998;
    width: 280px;
    background: rgba(4,8,15,.97);
    border: 1px solid var(--cfm-purple);
    border-radius: 4px;
    padding: 0;
    overflow: hidden;
    box-shadow: 0 0 24px rgba(139,92,246,.25), inset 0 0 40px rgba(0,0,0,.4);
    pointer-events: none;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity .4s ease, transform .4s ease;
  }
  #cfm-leme-panel.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  #cfm-leme-panel::before {
    content: '';
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 3px,
      rgba(0,0,0,.18) 3px,
      rgba(0,0,0,.18) 4px
    );
    pointer-events: none;
    z-index: 2;
    animation: cfm-scanline 8s linear infinite;
  }
  @keyframes cfm-scanline {
    0%   { background-position: 0 0; }
    100% { background-position: 0 80px; }
  }
  .cfm-lp-header {
    display: flex;
    align-items: center;
    gap: .4rem;
    padding: .35rem .6rem;
    background: rgba(139,92,246,.12);
    border-bottom: 1px solid rgba(139,92,246,.25);
    position: relative; z-index: 3;
  }
  .cfm-lp-avatar { font-size: .9rem; filter: drop-shadow(0 0 4px rgba(139,92,246,.7)); }
  .cfm-lp-name   {
    font-size: .55rem; letter-spacing: .22em;
    color: var(--cfm-purple);
    text-shadow: 0 0 6px rgba(139,92,246,.5);
    flex: 1;
  }
  .cfm-lp-signal {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--cfm-green);
    box-shadow: 0 0 5px var(--cfm-green);
    animation: cfm-pulse 1.2s ease-in-out infinite;
    flex-shrink: 0;
  }
  .cfm-lp-body {
    padding: .55rem .65rem .6rem;
    min-height: 3.4rem;
    position: relative; z-index: 3;
  }
  .cfm-lp-text {
    font-size: .72rem;
    color: var(--cfm-text);
    line-height: 1.55;
    font-style: italic;
    letter-spacing: .03em;
    word-break: break-word;
  }
  .cfm-lp-cursor {
    display: inline-block;
    color: var(--cfm-purple);
    font-style: normal;
    animation: cfm-blink .7s step-end infinite;
    text-shadow: 0 0 6px rgba(139,92,246,.8);
    margin-left: 1px;
    font-size: .8rem;
    vertical-align: text-bottom;
  }
  @keyframes cfm-blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .cfm-lp-footer {
    padding: .2rem .6rem;
    border-top: 1px solid rgba(139,92,246,.12);
    font-size: .52rem; letter-spacing: .14em;
    color: var(--cfm-dim);
    position: relative; z-index: 3;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cfm-lp-footer::before { content: '⬡ '; opacity: .5; }

  @media(max-width:480px){
    .cfm-brand-label,.cfm-kbd-hint { display:none; }
    .cfm-slot-freq { max-width:100px; }
    #cfm-widget    { font-size:.62rem; }
    #cfm-leme-panel { width:220px; right:8px; }
  }
  `;
  document.head.appendChild(s);
}

// ─── TÉLESCRIPTEUR ────────────────────────────────────────────────────────────
class Scroller {
  constructor(wrap, speedPx = SCROLL_SPEED_PX) {
    this._wrap = wrap; this._speed = speedPx;
    this._raf = null; this._x = 0; this._w = 0;
    this._paused = false; this._onYtClick = null;
    this._scroll = null; this._last = 0;
  }
  onYtClick(fn) { this._onYtClick = fn; }
  setSegments(segs) {
    this._x = 0;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._wrap.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'cfm-ticker-scroll';
    for (let pass = 0; pass < 2; pass++) {
      segs.forEach(seg => {
        const sep = document.createElement('span');
        sep.className = 'cfm-ticker-sep'; sep.textContent = SCROLL_SEP;
        track.appendChild(sep);
        const el = document.createElement('span');
        el.className = 'cfm-ticker-item'; el.dataset.type = seg.type; el.textContent = seg.text;
        if (seg.type === 'yt' && seg.videoId)
          el.addEventListener('click', () => this._onYtClick?.(seg.videoId));
        track.appendChild(el);
      });
    }
    this._wrap.appendChild(track);
    this._scroll = track; this._last = performance.now();
    requestAnimationFrame(() => { this._w = track.scrollWidth / 2; this._animate(); });
  }
  updateSegment(type, text) {
    if (!this._scroll) return;
    this._scroll.querySelectorAll(`.cfm-ticker-item[data-type="${type}"]`)
      .forEach(el => el.textContent = text);
  }
  _animate() {
    const now = performance.now();
    const dt  = (now - this._last) / 1000; this._last = now;
    if (!this._paused && this._w > 0) {
      this._x -= this._speed * dt;
      if (this._x <= -this._w) this._x += this._w;
      if (this._scroll) this._scroll.style.transform = `translateX(${this._x}px)`;
    }
    this._raf = requestAnimationFrame(() => this._animate());
  }
  pause()  { this._paused = true; }
  resume() { this._paused = false; }
  stop()   { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
}

// ─── BUILD DOM ────────────────────────────────────────────────────────────────
function buildDOM() {
  const bar = document.createElement('div');
  bar.id = 'cfm-widget';
  bar.innerHTML = `
    <div class="cfm-slot-brand" id="cfm-brand" title="Chronicles FM — ouvrir">
      <span class="cfm-w-dot"></span>
      <span class="cfm-brand-label">CHRONICLES FM</span>
      <span class="cfm-count-badge" id="cfm-count">?</span>
      <div class="cfm-hover-tooltip" id="cfm-hover-tip"></div>
    </div>
    <div class="cfm-slot-nav">
      <button class="cfm-nav-btn" id="cfm-prev" aria-label="Frequence precedente">◀</button>
      <button class="cfm-nav-btn" id="cfm-next" aria-label="Frequence suivante">▶</button>
    </div>
    <div class="cfm-slot-freq">
      <span class="cfm-freq-name"  id="cfm-w-name">—</span>
      <span class="cfm-freq-style" id="cfm-w-style"></span>
    </div>
    <div class="cfm-slot-ticker">
      <span class="cfm-ticker-label">LEMEGETON</span>
      <div class="cfm-ticker-wrap" id="cfm-ticker-wrap"></div>
    </div>
    <div class="cfm-slot-actions">
      <button class="cfm-act-btn cfm-act-btn--open" id="cfm-w-toggle">▶ OUVRIR</button>
    </div>
  `;

  const drawer = document.createElement('div');
  drawer.id = 'cfm-drawer';
  drawer.innerHTML = `
    <div class="cfm-drawer-header">
      <span class="cfm-drawer-title">📡 CHRONICLES FM<span class="cfm-night-badge" id="cfm-night-badge" style="display:none">🌙 MODE NUIT</span></span>
      <button class="cfm-drawer-close" id="cfm-drawer-close">✕ FERMER</button>
    </div>
    <div class="cfm-drawer-thumb-row" id="cfm-thumb-row">
      <div class="cfm-drawer-thumb-placeholder" id="cfm-thumb-ph">📡</div>
      <div class="cfm-drawer-thumb-meta">
        <div class="cfm-d-title" id="cfm-d-title"></div>
        <div class="cfm-d-style" id="cfm-d-style"></div>
        <div class="cfm-d-mood"  id="cfm-d-mood"></div>
      </div>
    </div>
    <div id="cfm-drawer-embed" class="cfm-drawer-embed"></div>
    <div id="cfm-yt-section" style="display:none">
      <div class="cfm-yt-section-label" id="cfm-yt-label">▶ PLAYLIST</div>
      <div class="cfm-search-wrap">
        <input class="cfm-search-input" id="cfm-search" type="text" placeholder="Rechercher un titre..." autocomplete="off" spellcheck="false">
        <span class="cfm-search-count" id="cfm-search-count"></span>
      </div>
      <div class="cfm-yt-titles" id="cfm-yt-titles"></div>
    </div>
    <div class="cfm-drawer-actions">
      <a class="cfm-drawer-btn cfm-drawer-btn--yt"   id="cfm-d-yt" href="#" target="_blank" rel="noopener">▶ YOUTUBE</a>
      <a class="cfm-drawer-btn cfm-drawer-btn--page" href="/chronicles-fm/">⬡ TOUTES LES FREQUENCES</a>
    </div>
    <div class="cfm-kbd-hint">
      <kbd>←</kbd><kbd>→</kbd> frequence &nbsp;·&nbsp; <kbd>Espace</kbd> ouvrir/fermer
    </div>
  `;

  const lemePanel = document.createElement('div');
  lemePanel.id = 'cfm-leme-panel';
  lemePanel.innerHTML = `
    <div class="cfm-lp-header">
      <span class="cfm-lp-avatar">👾</span>
      <span class="cfm-lp-name">LEMEGETON · CHRONICOEUR</span>
      <span class="cfm-lp-signal"></span>
    </div>
    <div class="cfm-lp-body">
      <div class="cfm-lp-text" id="cfm-lp-text"></div>
    </div>
    <div class="cfm-lp-footer" id="cfm-lp-footer">—</div>
  `;

  document.body.appendChild(lemePanel);
  document.body.appendChild(drawer);
  document.body.appendChild(bar);
  return { bar, drawer, lemePanel };
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

  const lv = new LemegetonVoice({ speechEnabled: false, volume: 0.75 });
  await lv.init();

  const { bar, drawer, lemePanel } = buildDOM();

  const nightMode = isNightMode();
  if (nightMode) bar.classList.add('cfm-night');
  const nightBadge = drawer.querySelector('#cfm-night-badge');
  if (nightBadge) nightBadge.style.display = nightMode ? '' : 'none';

  let idx = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? '0', 10);
  if (idx >= playlists.length) idx = 0;

  let drawerOpen   = false;
  let ambientTimer = null;
  let currentItems = [];
  let lemePanelTimer = null;

  // FIX: guard anti-récursion infinie pour renderFreq
  let _renderFreqLock = false;

  const wName        = bar.querySelector('#cfm-w-name');
  const wStyle       = bar.querySelector('#cfm-w-style');
  const countBadge   = bar.querySelector('#cfm-count');
  const hoverTip     = bar.querySelector('#cfm-hover-tip');
  const tickerWrap   = bar.querySelector('#cfm-ticker-wrap');
  const dEmbed       = drawer.querySelector('#cfm-drawer-embed');
  const dTitle       = drawer.querySelector('#cfm-d-title');
  const dStyle       = drawer.querySelector('#cfm-d-style');
  const dMood        = drawer.querySelector('#cfm-d-mood');
  const dYt          = drawer.querySelector('#cfm-d-yt');
  const ytSection    = drawer.querySelector('#cfm-yt-section');
  const ytTitlesList = drawer.querySelector('#cfm-yt-titles');
  const ytLabel      = drawer.querySelector('#cfm-yt-label');
  const searchInput  = drawer.querySelector('#cfm-search');
  const searchCount  = drawer.querySelector('#cfm-search-count');
  const thumbPh      = drawer.querySelector('#cfm-thumb-ph');
  const lpText       = lemePanel.querySelector('#cfm-lp-text');
  const lpFooter     = lemePanel.querySelector('#cfm-lp-footer');

  const scroller = new Scroller(tickerWrap, SCROLL_SPEED_PX);

  function openVideo(videoId) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
  }
  scroller.onYtClick(openVideo);

  let hoverTimer = null;
  bar.querySelector('#cfm-brand').addEventListener('mouseenter', () => {
    if (!currentItems.length) return;
    const t = currentItems[Math.floor(Math.random() * currentItems.length)]?.title;
    if (!t) return;
    hoverTip.textContent = t;
    hoverTip.classList.add('visible');
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => hoverTip.classList.remove('visible'), 3200);
  });
  bar.querySelector('#cfm-brand').addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    hoverTip.classList.remove('visible');
  });

  function showLemePanel(phrase, freqLabel) {
    if (lpFooter) lpFooter.textContent = freqLabel ?? playlists[idx]?.title ?? '—';
    lemePanel.classList.add('visible');
    typewriter(lpText, phrase, 28);
    clearTimeout(lemePanelTimer);
    const delay = phrase.length * 28 + 4000;
    lemePanelTimer = setTimeout(() => {
      lemePanel.classList.remove('visible');
    }, delay);
  }

  function buildSegments(p, lemePhrase) {
    const segs = [];
    segs.push({ type:'freq',   text: p.title });
    if (p.style)   segs.push({ type:'style',  text: p.style.toUpperCase() });
    if (p.mood)    segs.push({ type:'mood',   text: p.mood });
    if (nightMode) segs.push({ type:'night',  text: NIGHT_PHRASES[Math.floor(Math.random()*NIGHT_PHRASES.length)] });
    segs.push({ type:'leme',   text: lemePhrase });
    segs.push({ type:'signal', text: 'BZH CHRONICLES RADIO · ON AIR' });
    if (p.tags?.length) segs.push({ type:'signal', text: p.tags.map(t=>t.toUpperCase()).join(' · ') });
    return segs;
  }

  function filterTitles(q) {
    const query = q.trim().toLowerCase();
    const items = ytTitlesList.querySelectorAll('.cfm-yt-title-item');
    let count = 0;
    items.forEach(el => {
      const match = !query || el.dataset.title.includes(query);
      el.classList.toggle('hidden', !match);
      if (match) count++;
    });
    searchCount.textContent = query ? `${count} res.` : '';
  }
  searchInput?.addEventListener('input', e => filterTitles(e.target.value));
  searchInput?.addEventListener('keydown', e => e.stopPropagation());

  async function loadYtItems(p) {
    thumbPh.textContent = '📡'; thumbPh.style.display = 'flex';
    const existingImg = thumbPh.parentElement?.querySelector('.cfm-drawer-thumb');
    if (existingImg) existingImg.remove();

    if (p.youtubePlaylistId) {
      fetchPlaylistThumb(p.youtubePlaylistId).then(url => {
        if (!url) return;
        const img = document.createElement('img');
        img.className = 'cfm-drawer-thumb'; img.src = url; img.alt = p.title; img.loading = 'lazy';
        thumbPh.style.display = 'none';
        thumbPh.parentElement.insertBefore(img, thumbPh);
      });
    }

    if (!p.youtubePlaylistId) {
      ytSection.style.display = 'none'; currentItems = [];
      countBadge.textContent = '?'; countBadge.classList.remove('loaded');
      return;
    }

    const items = await fetchPlaylistItems(p.youtubePlaylistId);
    currentItems = items;
    countBadge.textContent = items.length ? `${items.length} ▶` : '?';
    countBadge.classList.toggle('loaded', items.length > 0);

    if (!items.length) { ytSection.style.display = 'none'; return; }

    const ytSegs = [...items].sort(()=>Math.random()-.5).slice(0,10)
      .map(i => ({ type:'yt', text:i.title, videoId:i.videoId }));
    const phrase = pickNightOrAmbient('ambient', p.tags);
    scroller.setSegments([...buildSegments(p, phrase), ...ytSegs]);

    ytLabel.textContent = `▶ PLAYLIST · ${items.length} TITRES`;
    if (searchInput) searchInput.value = '';
    searchCount.textContent = '';
    ytTitlesList.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'cfm-yt-title-item'; el.textContent = item.title;
      el.title = item.title; el.dataset.title = item.title.toLowerCase();
      if (item.videoId) el.addEventListener('click', () => openVideo(item.videoId));
      ytTitlesList.appendChild(el);
    });
    ytSection.style.display = 'block';
  }

  function renderFreq(newIdx, isTransition = false) {
    // FIX: guard contre la récursion infinie
    if (_renderFreqLock) return;
    _renderFreqLock = true;

    idx = newIdx;
    sessionStorage.setItem(STORAGE_KEY, idx);
    const p = playlists[idx];

    wName.textContent  = p.subtitle ?? p.title;
    wStyle.textContent = p.style ?? '';

    const phrase = isTransition
      ? pickNightOrAmbient('transition', p.tags)
      : pickNightOrAmbient('ambient', p.tags);

    scroller.setSegments(buildSegments(p, phrase));
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
      dEmbed.innerHTML = `<div class="cfm-drawer-sync">📡 Frequence en cours de synchronisation</div>`;
      dYt.href = CFM_PAGE_URL;
      dYt.style.opacity = '.4'; dYt.style.pointerEvents = 'none';
    }

    showLemePanel(phrase, p.title);
    scroller.updateSegment('leme', phrase);

    clearInterval(ambientTimer);
    ambientTimer = setInterval(() => {
      const l = pickNightOrAmbient('ambient', p.tags);
      showLemePanel(l, p.title);
      scroller.updateSegment('leme', l);
    }, AMBIENT_INTERVAL);

    _renderFreqLock = false;
  }

  function openDrawer() {
    drawerOpen = true;
    drawer.classList.add('open');
    bar.querySelector('#cfm-w-toggle').textContent = '▼ REPLIER';
    const phrase = pickNightOrAmbient('ambient', playlists[idx].tags);
    showLemePanel(phrase, playlists[idx].title);
  }
  function closeDrawer() {
    drawerOpen = false;
    drawer.classList.remove('open');
    bar.querySelector('#cfm-w-toggle').textContent = '▶ OUVRIR';
  }

  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    if (e.key === 'ArrowLeft')       { e.preventDefault(); renderFreq((idx-1+playlists.length)%playlists.length, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); renderFreq((idx+1)%playlists.length, true); }
    else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); drawerOpen ? closeDrawer() : openDrawer(); }
  });

  let touchStartX = 0, touchStartY = 0;
  bar.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  }, { passive:true });
  bar.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > 80) return;
    if (dx < 0) renderFreq((idx+1)%playlists.length, true);
    else        renderFreq((idx-1+playlists.length)%playlists.length, true);
  }, { passive:true });

  bar.querySelector('#cfm-brand').addEventListener('click',    () => drawerOpen ? closeDrawer() : openDrawer());
  bar.querySelector('#cfm-prev').addEventListener('click',     () => renderFreq((idx-1+playlists.length)%playlists.length, true));
  bar.querySelector('#cfm-next').addEventListener('click',     () => renderFreq((idx+1)%playlists.length, true));
  bar.querySelector('#cfm-w-toggle').addEventListener('click', () => drawerOpen ? closeDrawer() : openDrawer());
  drawer.querySelector('#cfm-drawer-close').addEventListener('click', closeDrawer);

  renderFreq(idx, false);

  setTimeout(() => {
    const intro = pickNightOrAmbient('intro', []);
    showLemePanel(intro, playlists[idx]?.title);
    scroller.updateSegment('leme', intro);
  }, 2000);
}

initChroniclesFM();
