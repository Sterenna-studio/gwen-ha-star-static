/**
 * Chronicles FM — Widget barre radio flottante + Lemegeton A+B+D
 * Ajouter sur n'importe quelle page :
 *   <script type="module" src="/js/chronicles-fm-widget.js"></script>
 */
import { LemegetonVoice, pickPhrase, PHRASES } from './lemegeton-voice.js';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CFM_DATA_URL = '/jukebox/chronicles-fm.json';
const CFM_PAGE_URL = '/jukebox/chronicles-fm.html';
const STORAGE_KEY  = 'cfm-freq-idx';

// ─── TYPEWRITER ───────────────────────────────────────────────────────────────
function typewriter(el, text, speed = 28) {
  if (!el) return;
  el.textContent = '';
  let i = 0;
  const tick = () => {
    if (i < text.length) { el.textContent += text[i++]; setTimeout(tick, speed); }
  };
  tick();
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
    --cfm-text:   #c8d8e8;
    --cfm-dim:    #4a6a8a;
    --cfm-mono:   'Share Tech Mono', monospace;
  }

  /* ── BARRE ── */
  #cfm-widget {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 8000;
    background: rgba(8,16,26,.97);
    border-top: 1px solid var(--cfm-border);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    gap: .6rem;
    padding: .45rem 1rem;
    font-family: var(--cfm-mono);
    font-size: .72rem;
    letter-spacing: .08em;
    transform: translateY(100%);
    transition: transform .35s cubic-bezier(.4,0,.2,1);
    box-shadow: 0 -4px 24px rgba(0,0,0,.6);
  }
  #cfm-widget.cfm-visible { transform: translateY(0); }

  .cfm-w-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--cfm-red);
    box-shadow: 0 0 6px var(--cfm-red);
    flex-shrink: 0;
    animation: cfm-pulse 1.4s ease-in-out infinite;
  }
  @keyframes cfm-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .cfm-w-label {
    color: var(--cfm-red); font-size: .7rem;
    letter-spacing: .2em; flex-shrink: 0;
    text-shadow: 0 0 8px rgba(233,69,96,.5);
  }

  .cfm-w-nav { display:flex; align-items:center; gap:.3rem; flex-shrink:0; }
  .cfm-w-nav-btn {
    background: none; border: 1px solid var(--cfm-border);
    color: var(--cfm-dim); cursor: pointer;
    width: 22px; height: 22px; border-radius: 2px;
    font-size: .65rem;
    display: flex; align-items:center; justify-content:center;
    transition: all .15s; font-family: var(--cfm-mono);
  }
  .cfm-w-nav-btn:hover { border-color:var(--cfm-blue); color:var(--cfm-blue); }

  .cfm-w-freq {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: .1rem;
    overflow: hidden;
  }
  .cfm-w-freq-name {
    color: var(--cfm-text); font-size: .72rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cfm-w-lemegeton {
    color: var(--cfm-purple); font-size: .65rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    opacity: .9;
  }
  .cfm-w-lemegeton::before { content: '◈ '; opacity: .6; }

  .cfm-w-actions { display:flex; gap:.4rem; flex-shrink:0; }
  .cfm-w-btn {
    padding: .3rem .6rem;
    border: 1px solid var(--cfm-border);
    background: none; color: var(--cfm-dim); cursor: pointer;
    font-family: var(--cfm-mono); font-size: .65rem; letter-spacing: .1em;
    border-radius: 2px; transition: all .15s;
    text-decoration: none;
    display: inline-flex; align-items: center; white-space: nowrap;
  }
  .cfm-w-btn:hover                { border-color:var(--cfm-blue); color:var(--cfm-blue); }
  .cfm-w-btn--open                { border-color:var(--cfm-purple); color:var(--cfm-purple); }
  .cfm-w-btn--open:hover          { box-shadow:0 0 8px rgba(139,92,246,.3); }
  .cfm-w-btn--mute                { font-size:.6rem; }
  .cfm-w-btn--mute.active         { border-color:var(--cfm-red); color:var(--cfm-red); }
  .cfm-w-btn--close:hover         { border-color:var(--cfm-red); color:var(--cfm-red); }

  /* ── DRAWER ── */
  #cfm-drawer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 7999;
    background: rgba(8,13,22,.98);
    border-top: 1px solid var(--cfm-purple);
    box-shadow: 0 -8px 40px rgba(139,92,246,.15);
    transform: translateY(100%);
    transition: transform .35s cubic-bezier(.4,0,.2,1);
    padding: 1.2rem 1rem 4.5rem;
    max-height: 70vh; overflow-y: auto;
  }
  #cfm-drawer.cfm-drawer-open { transform: translateY(0); }

  .cfm-drawer-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: .8rem;
  }
  .cfm-drawer-title {
    font-size: .85rem; color: var(--cfm-purple);
    letter-spacing: .2em;
    text-shadow: 0 0 8px rgba(139,92,246,.4);
  }
  .cfm-drawer-close {
    background: none; border: 1px solid var(--cfm-border);
    color: var(--cfm-dim); cursor: pointer;
    padding: .25rem .6rem;
    font-family: var(--cfm-mono); font-size: .65rem;
    border-radius: 2px; transition: all .15s;
  }
  .cfm-drawer-close:hover { border-color:var(--cfm-red); color:var(--cfm-red); }

  /* Lemegeton speech bubble */
  .cfm-lemegeton-bubble {
    display: flex; align-items: flex-start; gap: .6rem;
    background: rgba(139,92,246,.07);
    border: 1px solid rgba(139,92,246,.2);
    border-left: 3px solid var(--cfm-purple);
    border-radius: 0 4px 4px 0;
    padding: .6rem .8rem;
    margin-bottom: 1rem;
  }
  .cfm-leme-avatar {
    font-size: 1.1rem; flex-shrink: 0; line-height: 1;
    filter: drop-shadow(0 0 4px rgba(139,92,246,.6));
  }
  .cfm-leme-body { flex: 1; min-width: 0; }
  .cfm-leme-name {
    font-size: .62rem; letter-spacing: .2em;
    color: var(--cfm-purple); margin-bottom: .25rem;
  }
  .cfm-leme-text {
    font-size: .78rem; color: var(--cfm-text);
    line-height: 1.5; font-style: italic; min-height: 1.2em;
  }
  .cfm-leme-voice-badge {
    font-size: .55rem; letter-spacing: .12em;
    color: var(--cfm-dim); margin-top: .2rem;
  }
  .cfm-leme-voice-badge.speaking {
    color: var(--cfm-green);
    animation: cfm-pulse 1s ease-in-out infinite;
  }

  .cfm-drawer-embed iframe {
    width: 100%; height: 200px; border: none;
    border-radius: 3px; display: block;
  }
  .cfm-drawer-sync {
    background: rgba(255,255,255,.03);
    border: 1px dashed var(--cfm-border);
    border-radius: 3px; padding: 1.5rem;
    text-align: center; color: var(--cfm-dim);
    font-size: .75rem; letter-spacing: .1em;
  }

  .cfm-drawer-meta {
    margin-top: .8rem;
    display: flex; flex-direction: column; gap: .2rem;
  }
  .cfm-drawer-freq-title { color: var(--cfm-text); font-size: .85rem; }
  .cfm-drawer-freq-style { color: var(--cfm-blue); font-size: .72rem; letter-spacing: .1em; }
  .cfm-drawer-freq-mood  { color: var(--cfm-dim);  font-size: .7rem;  font-style: italic; }

  .cfm-drawer-actions {
    margin-top: .8rem; display: flex; gap: .5rem; flex-wrap: wrap;
  }
  .cfm-drawer-btn {
    padding: .35rem .7rem;
    border: 1px solid var(--cfm-border);
    background: none; color: var(--cfm-dim); cursor: pointer;
    font-family: var(--cfm-mono); font-size: .68rem; letter-spacing: .1em;
    border-radius: 2px; transition: all .15s;
    text-decoration: none; display: inline-flex; align-items: center;
  }
  .cfm-drawer-btn:hover         { border-color:var(--cfm-blue); color:var(--cfm-blue); }
  .cfm-drawer-btn--yt:hover     { border-color:#ff0000; color:#ff0000; }
  .cfm-drawer-btn--page         { border-color:var(--cfm-purple); color:var(--cfm-purple); }
  .cfm-drawer-btn--page:hover   { box-shadow:0 0 8px rgba(139,92,246,.3); }
  .cfm-drawer-btn--mute         { margin-left:auto; }
  .cfm-drawer-btn--mute.active  { border-color:var(--cfm-red); color:var(--cfm-red); }

  @media(max-width:480px) {
    .cfm-w-label { display:none; }
    #cfm-widget  { padding:.4rem .7rem; gap:.4rem; }
  }
  `;
  document.head.appendChild(s);
}

// ─── BUILD DOM ────────────────────────────────────────────────────────────────
function buildDOM() {
  const bar = document.createElement('div');
  bar.id = 'cfm-widget';
  bar.innerHTML = `
    <span class="cfm-w-dot"></span>
    <span class="cfm-w-label">CHRONICLES FM</span>
    <div class="cfm-w-nav">
      <button class="cfm-w-nav-btn" id="cfm-prev" aria-label="Fréquence précédente">◀</button>
      <button class="cfm-w-nav-btn" id="cfm-next" aria-label="Fréquence suivante">▶</button>
    </div>
    <div class="cfm-w-freq">
      <div class="cfm-w-freq-name"   id="cfm-w-name">—</div>
      <div class="cfm-w-lemegeton"   id="cfm-w-leme">…</div>
    </div>
    <div class="cfm-w-actions">
      <button class="cfm-w-btn cfm-w-btn--open"  id="cfm-w-toggle">▶ ÉCOUTER</button>
      <button class="cfm-w-btn cfm-w-btn--mute"  id="cfm-w-mute"  title="Muet voix Lemegeton">🔊</button>
      <button class="cfm-w-btn cfm-w-btn--close" id="cfm-w-close" aria-label="Fermer Chronicles FM">✕</button>
    </div>
  `;

  const drawer = document.createElement('div');
  drawer.id = 'cfm-drawer';
  drawer.innerHTML = `
    <div class="cfm-drawer-header">
      <span class="cfm-drawer-title">📡 CHRONICLES FM</span>
      <button class="cfm-drawer-close" id="cfm-drawer-close">✕ FERMER</button>
    </div>

    <div class="cfm-lemegeton-bubble">
      <span class="cfm-leme-avatar">👾</span>
      <div class="cfm-leme-body">
        <div class="cfm-leme-name">LEMEGETON · CHRONICŒUR</div>
        <div class="cfm-leme-text"  id="cfm-drawer-leme"></div>
        <div class="cfm-leme-voice-badge" id="cfm-voice-badge">WEB SPEECH · FR</div>
      </div>
    </div>

    <div id="cfm-drawer-embed" class="cfm-drawer-embed"></div>
    <div class="cfm-drawer-meta">
      <div class="cfm-drawer-freq-title" id="cfm-d-title"></div>
      <div class="cfm-drawer-freq-style" id="cfm-d-style"></div>
      <div class="cfm-drawer-freq-mood"  id="cfm-d-mood"></div>
    </div>
    <div class="cfm-drawer-actions">
      <a   class="cfm-drawer-btn cfm-drawer-btn--yt"   id="cfm-d-yt" href="#" target="_blank" rel="noopener">▶ YOUTUBE</a>
      <a   class="cfm-drawer-btn cfm-drawer-btn--page" href="${CFM_PAGE_URL}">⬡ TOUTES LES FRÉQUENCES</a>
      <button class="cfm-drawer-btn cfm-drawer-btn--mute" id="cfm-drawer-mute">🔊 VOIX</button>
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

  // Init Lemegeton Voice (A+B+D)
  const lv = new LemegetonVoice({ speechEnabled: true, volume: 0.75 });
  await lv.init();

  const { bar, drawer } = buildDOM();

  let idx = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? '0', 10);
  if (idx >= playlists.length) idx = 0;

  let drawerOpen   = false;
  let ambientTimer = null;

  // éléments
  const wName      = document.getElementById('cfm-w-name');
  const wLeme      = document.getElementById('cfm-w-leme');
  const dLeme      = document.getElementById('cfm-drawer-leme');
  const dEmbed     = document.getElementById('cfm-drawer-embed');
  const dTitle     = document.getElementById('cfm-d-title');
  const dStyle     = document.getElementById('cfm-d-style');
  const dMood      = document.getElementById('cfm-d-mood');
  const dYt        = document.getElementById('cfm-d-yt');
  const voiceBadge = document.getElementById('cfm-voice-badge');

  // badge voix
  function updateVoiceBadge() {
    if (lv.muted) {
      voiceBadge.textContent = 'VOIX · MUET';
      voiceBadge.classList.remove('speaking');
    } else if (lv._mp3map.size) {
      voiceBadge.textContent = 'MP3 BANK · ACTIF';
    } else if (lv._voice) {
      voiceBadge.textContent = `WEB SPEECH · ${lv._voice.name}`;
    } else {
      voiceBadge.textContent = 'TEXTE SEUL';
    }
  }

  function sayAndWrite(el, phrase) {
    typewriter(el, phrase);
    if (!lv.muted) {
      voiceBadge.classList.add('speaking');
      lv.speak('ambient', { text: phrase });
      setTimeout(() => voiceBadge.classList.remove('speaking'), phrase.length * 60 + 800);
    }
  }

  function renderFreq(newIdx, isTransition = false) {
    idx = newIdx;
    sessionStorage.setItem(STORAGE_KEY, idx);
    const p = playlists[idx];

    wName.textContent = p.subtitle ?? p.title;

    const phrase = isTransition
      ? pickPhrase('transition', p.tags)
      : PHRASES.ambient[Math.floor(Math.random() * PHRASES.ambient.length)];
    sayAndWrite(wLeme, phrase);

    dTitle.textContent = p.title;
    dStyle.textContent = p.style;
    dMood.textContent  = p.mood;

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

    // ambient timer — phrase toutes les 50s
    clearInterval(ambientTimer);
    ambientTimer = setInterval(() => {
      const l = pickPhrase('ambient', p.tags);
      sayAndWrite(wLeme, l);
      if (drawerOpen) sayAndWrite(dLeme, l);
    }, 50000);
  }

  function openDrawer() {
    drawerOpen = true;
    drawer.classList.add('cfm-drawer-open');
    document.getElementById('cfm-w-toggle').textContent = '▼ REPLIER';
    const phrase = pickPhrase('ambient', playlists[idx].tags);
    sayAndWrite(dLeme, phrase);
  }

  function closeDrawer() {
    drawerOpen = false;
    drawer.classList.remove('cfm-drawer-open');
    document.getElementById('cfm-w-toggle').textContent = '▶ ÉCOUTER';
  }

  function toggleMute() {
    lv.setMuted(!lv.muted);
    const wBtn  = document.getElementById('cfm-w-mute');
    const dBtn  = document.getElementById('cfm-drawer-mute');
    const icon  = lv.muted ? '🔇' : '🔊';
    const label = lv.muted ? '🔇 VOIX' : '🔊 VOIX';
    if (wBtn) { wBtn.textContent = icon; wBtn.classList.toggle('active', lv.muted); }
    if (dBtn) { dBtn.textContent = label; dBtn.classList.toggle('active', lv.muted); }
    updateVoiceBadge();
  }

  // events
  document.getElementById('cfm-prev').addEventListener('click', () => {
    renderFreq((idx - 1 + playlists.length) % playlists.length, true);
    if (drawerOpen) openDrawer();
  });
  document.getElementById('cfm-next').addEventListener('click', () => {
    renderFreq((idx + 1) % playlists.length, true);
    if (drawerOpen) openDrawer();
  });
  document.getElementById('cfm-w-toggle').addEventListener('click',  () => drawerOpen ? closeDrawer() : openDrawer());
  document.getElementById('cfm-w-mute').addEventListener('click',    toggleMute);
  document.getElementById('cfm-drawer-mute').addEventListener('click', toggleMute);
  document.getElementById('cfm-w-close').addEventListener('click', () => {
    closeDrawer();
    const phrase = pickPhrase('outro');
    sayAndWrite(wLeme, phrase);
    setTimeout(() => { bar.classList.remove('cfm-visible'); }, 1400);
  });
  document.getElementById('cfm-drawer-close').addEventListener('click', closeDrawer);

  // init
  updateVoiceBadge();
  renderFreq(idx, false);

  // intro
  setTimeout(() => {
    bar.classList.add('cfm-visible');
    const intro = pickPhrase('intro');
    setTimeout(() => {
      sayAndWrite(wLeme, intro);
    }, 400);
  }, 1800);
}

initChroniclesFM();
