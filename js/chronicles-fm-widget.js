/**
 * Chronicles FM — Widget barre radio flottante + Lemegeton
 * Ajouter sur n'importe quelle page :
 *   <script type="module" src="/js/chronicles-fm-widget.js"></script>
 */

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CFM_DATA_URL = '/jukebox/chronicles-fm.json';
const CFM_PAGE_URL = '/jukebox/chronicles-fm.html';
const STORAGE_KEY  = 'cfm-freq-idx';

// ─── LEMEGETON — banque de phrases ─────────────────────────────────────────
const LEMEGETON = {
  intro: [
    'Signal capté… Lemegeton aux commandes.',
    'Transmission Chronicles FM — en ligne.',
    'Radio pirate active. Ajuste ta fréquence.',
    'Le Code écoute. Moi aussi.',
    'Bienvenue dans les ruines du signal.',
  ],
  outro: [
    'Signal perdu. Le Code attend.',
    'Transmission suspendue. À bientôt dans les fréquences.',
    'Lemegeton se tait. Pour l\'instant.',
    'La radio dort. Les basses, jamais.',
  ],
  ambient: [
    'Le signal tient.',
    'Transmission stable depuis les ruines.',
    'Archives sonores en cours de diffusion.',
    'Fréquence maintenue.',
    'BZH Chronicles — on émet toujours.',
    'Les murs du Code vibrent.',
    'Lemegeton enregistre.',
    'Signal pur. Continue.',
  ],
  transition: {
    rave:         ['Fréquence rapide détectée — accroche-toi.', 'Tekno, hardtek — le dancefloor s\'allume.', 'Énergie brute en approche.'],
    bass:         ['Basses lourdes en approche.', 'Drop imminent. Monte le volume.', 'DnB, dubstep — les basses arrivent.'],
    rap:          ['Flow en diffusion.', 'Rap FR sur les ondes — écoute les mots.', 'Textes et ego — transmission en cours.'],
    hyperpop:     ['Glitch, sucre, saturation — bienvenue.', 'Hyperpop activé — les oreilles vont souffrir.', 'Digital et surchargé. Parfait.'],
    chill:        ['Ralentis. La nuit est longue.', 'Lo-fi, ambient — flottement en cours.', 'Sons posés pour les esprits agités.'],
    ost:          ['Thème épique en diffusion.', 'OST, anime, jeu vidéo — narratif activé.', 'Musiques pour les héros fatigués.'],
    rock:         ['Guitares et saturation — organique.', 'Rock, metal, punk — tension live.', 'Riffs en approche.'],
    folk:         ['Vibes druidiques détectées.', 'Folk, celtique — les anciens parlent.', 'Instruments traditionnels sur la fréquence.'],
    weird:        ['Signal bizarre capté. Normal.', 'Inclassable. Chaos voulu.', 'Weird activé — tout est permis.'],
    'long format':['Long format — installe-toi.', 'Album, set, mixtape — voyage complet.', 'Format long. Prends le temps.'],
    default:      ['Nouvelle fréquence — à toi de juger.', 'Changement de canal.', 'Transmission en cours sur nouvelle longueur d\'onde.'],
  },
};

function lemegetonLine(type, tags = []) {
  const pool =
    tags.flatMap(t => LEMEGETON.transition[t] ?? []).length
      ? tags.flatMap(t => LEMEGETON.transition[t] ?? [])
      : (LEMEGETON.transition[type] ?? LEMEGETON.ambient);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── TYPEWRITER ─────────────────────────────────────────────────────────────
function typewriter(el, text, speed = 28) {
  el.textContent = '';
  let i = 0;
  const tick = () => {
    if (i < text.length) { el.textContent += text[i++]; setTimeout(tick, speed); }
  };
  tick();
}

// ─── INJECT CSS ─────────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('cfm-widget-css')) return;
  const s = document.createElement('style');
  s.id = 'cfm-widget-css';
  s.textContent = `
  :root {
    --cfm-bg:      #08101a;
    --cfm-border:  #1a2840;
    --cfm-red:     #e94560;
    --cfm-blue:    #00d4ff;
    --cfm-purple:  #8b5cf6;
    --cfm-green:   #00ff9d;
    --cfm-text:    #c8d8e8;
    --cfm-dim:     #4a6a8a;
    --cfm-mono:    'Share Tech Mono', monospace;
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

  /* signal dot */
  .cfm-w-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--cfm-red);
    box-shadow: 0 0 6px var(--cfm-red);
    flex-shrink: 0;
    animation: cfm-pulse 1.4s ease-in-out infinite;
  }
  @keyframes cfm-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  /* label FM */
  .cfm-w-label {
    color: var(--cfm-red);
    font-size: .7rem;
    letter-spacing: .2em;
    flex-shrink: 0;
    text-shadow: 0 0 8px rgba(233,69,96,.5);
  }

  /* freq nav */
  .cfm-w-nav {
    display: flex; align-items: center; gap: .3rem;
    flex-shrink: 0;
  }
  .cfm-w-nav-btn {
    background: none; border: 1px solid var(--cfm-border);
    color: var(--cfm-dim); cursor: pointer;
    width: 22px; height: 22px;
    border-radius: 2px;
    font-size: .65rem;
    display: flex; align-items: center; justify-content: center;
    transition: all .15s;
    font-family: var(--cfm-mono);
  }
  .cfm-w-nav-btn:hover { border-color: var(--cfm-blue); color: var(--cfm-blue); }

  /* freq name */
  .cfm-w-freq {
    flex: 1;
    min-width: 0;
    display: flex; flex-direction: column; gap: .1rem;
    overflow: hidden;
  }
  .cfm-w-freq-name {
    color: var(--cfm-text);
    font-size: .72rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cfm-w-lemegeton {
    color: var(--cfm-purple);
    font-size: .65rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    opacity: .9;
  }

  /* actions */
  .cfm-w-actions { display: flex; gap: .4rem; flex-shrink: 0; }
  .cfm-w-btn {
    padding: .3rem .6rem;
    border: 1px solid var(--cfm-border);
    background: none;
    color: var(--cfm-dim);
    cursor: pointer;
    font-family: var(--cfm-mono);
    font-size: .65rem;
    letter-spacing: .1em;
    border-radius: 2px;
    transition: all .15s;
    text-decoration: none;
    display: inline-flex; align-items: center;
    white-space: nowrap;
  }
  .cfm-w-btn:hover { border-color: var(--cfm-blue); color: var(--cfm-blue); }
  .cfm-w-btn--open { border-color: var(--cfm-purple); color: var(--cfm-purple); }
  .cfm-w-btn--open:hover { box-shadow: 0 0 8px rgba(139,92,246,.3); }
  .cfm-w-btn--close:hover { border-color: var(--cfm-red); color: var(--cfm-red); }

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
    max-height: 70vh;
    overflow-y: auto;
  }
  #cfm-drawer.cfm-drawer-open { transform: translateY(0); }

  .cfm-drawer-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1rem;
  }
  .cfm-drawer-title {
    font-size: .85rem;
    color: var(--cfm-purple);
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
  .cfm-drawer-close:hover { border-color: var(--cfm-red); color: var(--cfm-red); }

  .cfm-drawer-lemegeton {
    font-size: .78rem;
    color: var(--cfm-purple);
    margin-bottom: 1rem;
    min-height: 1.2em;
    font-style: italic;
  }

  .cfm-drawer-embed iframe {
    width: 100%; height: 200px;
    border: none; border-radius: 3px;
    display: block;
  }
  .cfm-drawer-sync {
    background: rgba(255,255,255,.03);
    border: 1px dashed var(--cfm-border);
    border-radius: 3px;
    padding: 1.5rem;
    text-align: center;
    color: var(--cfm-dim);
    font-size: .75rem;
    letter-spacing: .1em;
  }

  .cfm-drawer-meta {
    margin-top: .8rem;
    display: flex; flex-direction: column; gap: .2rem;
  }
  .cfm-drawer-freq-title {
    color: var(--cfm-text);
    font-size: .85rem;
  }
  .cfm-drawer-freq-style {
    color: var(--cfm-blue);
    font-size: .72rem;
    letter-spacing: .1em;
  }
  .cfm-drawer-freq-mood {
    color: var(--cfm-dim);
    font-size: .7rem;
    font-style: italic;
  }
  .cfm-drawer-actions {
    margin-top: .8rem;
    display: flex; gap: .5rem; flex-wrap: wrap;
  }
  .cfm-drawer-btn {
    padding: .35rem .7rem;
    border: 1px solid var(--cfm-border);
    background: none;
    color: var(--cfm-dim);
    cursor: pointer;
    font-family: var(--cfm-mono);
    font-size: .68rem;
    letter-spacing: .1em;
    border-radius: 2px;
    transition: all .15s;
    text-decoration: none;
    display: inline-flex; align-items: center;
  }
  .cfm-drawer-btn:hover { border-color: var(--cfm-blue); color: var(--cfm-blue); }
  .cfm-drawer-btn--yt:hover { border-color: #ff0000; color: #ff0000; }
  .cfm-drawer-btn--page { border-color: var(--cfm-purple); color: var(--cfm-purple); }
  .cfm-drawer-btn--page:hover { box-shadow: 0 0 8px rgba(139,92,246,.3); }

  @media (max-width: 480px) {
    .cfm-w-label { display: none; }
    #cfm-widget { padding: .4rem .7rem; gap: .4rem; }
  }
  `;
  document.head.appendChild(s);
}

// ─── BUILD DOM ───────────────────────────────────────────────────────────────
function buildWidget() {
  // barre
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
      <div class="cfm-w-freq-name" id="cfm-w-name">—</div>
      <div class="cfm-w-lemegeton" id="cfm-w-leme">…</div>
    </div>
    <div class="cfm-w-actions">
      <button class="cfm-w-btn cfm-w-btn--open" id="cfm-w-toggle">▶ ÉCOUTER</button>
      <button class="cfm-w-btn cfm-w-btn--close" id="cfm-w-close" aria-label="Fermer Chronicles FM">✕</button>
    </div>
  `;

  // drawer
  const drawer = document.createElement('div');
  drawer.id = 'cfm-drawer';
  drawer.innerHTML = `
    <div class="cfm-drawer-header">
      <span class="cfm-drawer-title">📡 CHRONICLES FM</span>
      <button class="cfm-drawer-close" id="cfm-drawer-close">✕ FERMER</button>
    </div>
    <div class="cfm-drawer-lemegeton" id="cfm-drawer-leme"></div>
    <div id="cfm-drawer-embed" class="cfm-drawer-embed"></div>
    <div class="cfm-drawer-meta">
      <div class="cfm-drawer-freq-title"  id="cfm-d-title"></div>
      <div class="cfm-drawer-freq-style"  id="cfm-d-style"></div>
      <div class="cfm-drawer-freq-mood"   id="cfm-d-mood"></div>
    </div>
    <div class="cfm-drawer-actions">
      <a  class="cfm-drawer-btn cfm-drawer-btn--yt"  id="cfm-d-yt"   href="#" target="_blank" rel="noopener">▶ YOUTUBE</a>
      <a  class="cfm-drawer-btn cfm-drawer-btn--page" href="${CFM_PAGE_URL}">⬡ TOUTES LES FRÉQUENCES</a>
    </div>
  `;

  document.body.appendChild(drawer);
  document.body.appendChild(bar);
  return { bar, drawer };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function initChroniclesFM() {
  injectCSS();

  let playlists = [];
  try {
    const r = await fetch(CFM_DATA_URL);
    playlists = await r.json();
  } catch { return; } // silencieux si fetch échoue

  if (!playlists.length) return;

  const { bar, drawer } = buildWidget();

  let idx = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? '0', 10);
  if (idx >= playlists.length) idx = 0;

  let drawerOpen = false;
  let ambientTimer = null;

  // éléments
  const wName   = document.getElementById('cfm-w-name');
  const wLeme   = document.getElementById('cfm-w-leme');
  const dLeme   = document.getElementById('cfm-drawer-leme');
  const dEmbed  = document.getElementById('cfm-drawer-embed');
  const dTitle  = document.getElementById('cfm-d-title');
  const dStyle  = document.getElementById('cfm-d-style');
  const dMood   = document.getElementById('cfm-d-mood');
  const dYt     = document.getElementById('cfm-d-yt');

  function renderFreq(newIdx, isTransition = false) {
    idx = newIdx;
    sessionStorage.setItem(STORAGE_KEY, idx);
    const p = playlists[idx];

    // barre
    wName.textContent = p.subtitle ?? p.title;

    // phrase Lemegeton
    const line = isTransition
      ? lemegetonLine('transition', p.tags)
      : LEMEGETON.ambient[Math.floor(Math.random() * LEMEGETON.ambient.length)];
    typewriter(wLeme, line);

    // drawer meta
    dTitle.textContent = p.title;
    dStyle.textContent = p.style;
    dMood.textContent  = p.mood;

    // embed
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

    // phrases d'ambiance toutes les 45s
    clearInterval(ambientTimer);
    ambientTimer = setInterval(() => {
      const l = LEMEGETON.ambient[Math.floor(Math.random() * LEMEGETON.ambient.length)];
      typewriter(wLeme, l);
      if (drawerOpen) typewriter(dLeme, l);
    }, 45000);
  }

  function openDrawer() {
    drawerOpen = true;
    drawer.classList.add('cfm-drawer-open');
    document.getElementById('cfm-w-toggle').textContent = '▼ REPLIER';
    const p = playlists[idx];
    typewriter(dLeme, lemegetonLine('ambient', p.tags));
  }

  function closeDrawer() {
    drawerOpen = false;
    drawer.classList.remove('cfm-drawer-open');
    document.getElementById('cfm-w-toggle').textContent = '▶ ÉCOUTER';
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
  document.getElementById('cfm-w-toggle').addEventListener('click', () => {
    drawerOpen ? closeDrawer() : openDrawer();
  });
  document.getElementById('cfm-w-close').addEventListener('click', () => {
    closeDrawer();
    typewriter(wLeme, LEMEGETON.outro[Math.floor(Math.random() * LEMEGETON.outro.length)]);
    setTimeout(() => { bar.classList.remove('cfm-visible'); }, 1200);
  });
  document.getElementById('cfm-drawer-close').addEventListener('click', closeDrawer);

  // init
  renderFreq(idx, false);

  // intro Lemegeton + apparition barre
  setTimeout(() => {
    bar.classList.add('cfm-visible');
    const intro = LEMEGETON.intro[Math.floor(Math.random() * LEMEGETON.intro.length)];
    setTimeout(() => typewriter(wLeme, intro), 400);
  }, 1800);
}

initChroniclesFM();
