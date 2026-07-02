const CFM_STAR_SKIN_ID = 'cfm-star-skin-styles';
const CFM_STAR_LOGO = '/shared/logos/star_logo/star_logo_color_set/star_logo_cyan_blue.png';

injectStarSkinCSS();
watchChroniclesDrawer();

function injectStarSkinCSS() {
  if (document.getElementById(CFM_STAR_SKIN_ID)) return;
  const style = document.createElement('style');
  style.id = CFM_STAR_SKIN_ID;
  style.textContent = `
    #cfm-bar.cfm-star-skinned {
      --cfm-bg: #06110d !important;
      --cfm-border: #173a35 !important;
      --cfm-blue: #00d4ff !important;
      --cfm-green: #00ff9d !important;
      --cfm-red: #00ff9d !important;
      --cfm-purple: #00d4ff !important;
      --cfm-text: #d8fff0 !important;
      --cfm-dim: #6e9e95 !important;
      border-color: #173a35 !important;
      border-radius: 12px 0 0 12px !important;
      background: rgba(6, 17, 13, .97) !important;
      box-shadow: -8px 0 34px rgba(0,0,0,.72), 0 0 34px rgba(0,255,157,.08) !important;
    }
    #cfm-bar.cfm-star-skinned.cfm-open { width: 340px !important; }
    #cfm-bar.cfm-star-skinned #cfm-tab {
      width: 38px !important;
      background: linear-gradient(180deg, rgba(0,255,157,.10), rgba(0,212,255,.05)) !important;
      border-right-color: #173a35 !important;
    }
    #cfm-bar.cfm-star-skinned .cfm-tab-dot {
      background: #00ff9d !important;
      box-shadow: 0 0 8px #00ff9d, 0 0 18px rgba(0,255,157,.35) !important;
    }
    #cfm-bar.cfm-star-skinned #cfm-tab-label {
      color: #00ff9d !important;
      letter-spacing: .2em !important;
    }
    #cfm-bar.cfm-star-skinned #cfm-inner {
      min-width: 302px !important;
      background:
        radial-gradient(circle at 28% 0, rgba(0,255,157,.12), transparent 38%),
        radial-gradient(circle at 88% 12%, rgba(0,212,255,.08), transparent 42%),
        rgba(6,17,13,.97) !important;
    }
    .cfm-star-visual {
      position: relative;
      display: grid;
      grid-template-columns: 54px 1fr;
      gap: 10px;
      padding: 12px;
      border-bottom: 1px solid #173a35;
      background:
        radial-gradient(circle at 18% 20%, rgba(0,255,157,.16), transparent 46%),
        linear-gradient(135deg, rgba(0,212,255,.10), rgba(0,255,157,.04));
      overflow: hidden;
    }
    .cfm-star-visual::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.18) 2px, rgba(0,0,0,.18) 4px);
      opacity: .4;
    }
    .cfm-star-visual-logo {
      position: relative;
      z-index: 1;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      border: 1px solid rgba(0,255,157,.34);
      background: rgba(0,0,0,.2);
      display: grid;
      place-items: center;
      box-shadow: inset 0 0 22px rgba(0,255,157,.08), 0 0 14px rgba(0,212,255,.12);
    }
    .cfm-star-visual-logo img {
      width: 42px;
      height: 42px;
      object-fit: contain;
      filter: drop-shadow(0 0 6px rgba(0,212,255,.55));
    }
    .cfm-star-visual-meta {
      position: relative;
      z-index: 1;
      min-width: 0;
    }
    .cfm-star-visual-kicker {
      color: #00ff9d;
      font-size: .52rem;
      letter-spacing: .22em;
    }
    .cfm-star-visual-title {
      margin-top: 3px;
      color: #d8fff0;
      font-weight: 700;
      font-size: .86rem;
      letter-spacing: .11em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cfm-star-visual-sub {
      margin-top: 3px;
      color: #00d4ff;
      font-size: .56rem;
      letter-spacing: .1em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cfm-star-live-row {
      position: relative;
      z-index: 1;
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .cfm-star-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 7px;
      border-radius: 999px;
      border: 1px solid rgba(0,255,157,.35);
      color: #00ff9d;
      background: rgba(0,255,157,.08);
      font-size: .52rem;
      letter-spacing: .14em;
    }
    .cfm-star-pill.cyan {
      border-color: rgba(0,212,255,.32);
      color: #00d4ff;
      background: rgba(0,212,255,.08);
    }
    .cfm-star-pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 7px currentColor;
      animation: cfm-star-pulse 1.35s ease-in-out infinite;
    }
    .cfm-star-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 11px;
      border-bottom: 1px solid #173a35;
      background: rgba(0,0,0,.12);
    }
    .cfm-star-links a {
      min-height: 27px;
      padding: .26rem .52rem;
      border: 1px solid #173a35;
      border-radius: 6px;
      background: rgba(255,255,255,.02);
      color: #6e9e95;
      cursor: pointer;
      font-family: var(--cfm-mono, 'Share Tech Mono', monospace);
      font-size: .6rem;
      letter-spacing: .1em;
      text-decoration: none;
    }
    .cfm-star-links a:hover { border-color: #00d4ff; color: #00d4ff; }
    .cfm-star-links a.primary { border-color: rgba(0,212,255,.42); color: #00d4ff; }
    #cfm-bar.cfm-star-skinned .cfm-section { border-bottom-color: #173a35 !important; }
    #cfm-bar.cfm-star-skinned .cfm-section-label { color: #345d57 !important; }
    #cfm-bar.cfm-star-skinned .cfm-act-btn.primary {
      border-color: rgba(0,255,157,.42) !important;
      color: #00ff9d !important;
      background: rgba(0,255,157,.07) !important;
    }
    #cfm-bar.cfm-star-skinned #cfm-ticker-slot {
      border-color: #173a35 !important;
      background: rgba(0,0,0,.24) !important;
      border-radius: 6px !important;
    }
    @keyframes cfm-star-pulse { 50% { opacity: .35; transform: scale(.72); } }
  `;
  document.head.appendChild(style);
}

function watchChroniclesDrawer() {
  enhanceChroniclesDrawer();
  const observer = new MutationObserver(enhanceChroniclesDrawer);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function enhanceChroniclesDrawer() {
  const bar = document.getElementById('cfm-bar');
  const inner = document.getElementById('cfm-inner');
  if (!bar || !inner || inner.querySelector('.cfm-star-visual')) return;

  bar.classList.add('cfm-star-skinned');
  const tabLabel = document.getElementById('cfm-tab-label');
  if (tabLabel) tabLabel.textContent = 'STAR FM';

  const header = document.createElement('div');
  header.className = 'cfm-star-visual';
  header.innerHTML = `
    <div class="cfm-star-visual-logo"><img src="${CFM_STAR_LOGO}" alt="Gwen Ha Star"></div>
    <div class="cfm-star-visual-meta">
      <div class="cfm-star-visual-kicker">GWEN HA STAR RADIO</div>
      <div class="cfm-star-visual-title">CHRONICLES FM</div>
      <div class="cfm-star-visual-sub">Antenne pirate · playlists synchronisées</div>
    </div>
    <div class="cfm-star-live-row">
      <span class="cfm-star-pill"><span class="cfm-star-pill-dot"></span>LIVE SYNC</span>
      <span class="cfm-star-pill cyan">YT FREQUENCY</span>
    </div>
  `;
  inner.prepend(header);

  const links = document.createElement('div');
  links.className = 'cfm-star-links';
  links.innerHTML = `
    <a class="primary" href="/star/">⬡ COCKPIT LIVE</a>
    <a href="/jukebox/chronicles-fm.html">DATA AUDIO</a>
    <a href="/chronicles-fm/">PAGE RADIO</a>
  `;
  header.after(links);
}
