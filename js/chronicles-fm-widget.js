/** Chronicles FM Widget v5.6 — playlist player without YouTube Data API calls. */
(function () {
  'use strict';

  const DATA_URL = '/jukebox/chronicles-fm.json';
  const PLAYER_ID = 'cfm-yt-player';
  const VOL_DEFAULT = 80;
  const VOL_STEP = 10;
  const AMBIENT_INTERVAL = 50000;
  const SCROLL_SEP = '  ⬡  ';
  const SCROLL_SPEED = 55;
  const AUDIO_BASE = '/audio/leme/';

  // Declare real files here only if they exist in /audio/leme/.
  // Empty set = no request to missing leme-*.mp3 files, so no 404 spam.
  const AVAILABLE_LEME_AUDIO = new Set([]);

  const FREQ_PHRASES = [
    'Frequence 01 verrouillee. Subsoniques en route. Tiens-toi bien.',
    'Protocole 02 active. La machine danse. Resiste.',
    'Archive 03 ouverte. Les mots arrivent. Ecoute les cicatrices.',
    'Frequence 04 instable. Surcharge sensorielle imminente.',
    'Secteur 05 atteint. Zone de basse tension. Respire.',
    'Coffre 06 deverrouille. Les bandes originales s\'ouvrent. Bon voyage.',
    'Circuit 07 en ligne. Distorsion maximale. Les cables brulent.',
    'Transmission 08 recue. Le triskel resonne dans les circuits.',
    'Signal 09 non classifie. Dimension parallele en ecoute.',
    'Format long engage. Pas de pause. Pas d\'interruption. Tiens.'
  ];
  const AMBIENT_PHRASES = [
    'Synchronisation des ondes en cours. Patience, agent.',
    'Le signal traverse les dimensions. BZH Chronicles on air.',
    'Archives consultees. Frequence verrouillee.',
    'Lemegeton calibre les emissions. Restez connectes.',
    'Interferences detectees. Filtrage en cours.',
    'BZH Chronicles Radio. Toujours en orbite.'
  ];
  const NIGHT_PHRASES = [
    'Les signaux se fondent dans l\'obscurite des frequences mortes.',
    'L\'ether murmure des elegies a minuit passe.',
    'Transmissions chiffrees depuis les catacombes numeriques.',
    'Frequences noires. Signal de l\'abime. BZH Chronicles ne dort pas.'
  ];
  const INTRO_PHRASES = [
    'Bienvenue sur Chronicles FM. Le signal est etabli.',
    'Connexion etablie. Lemegeton prend le relais.',
    'Chronicles FM operationnel. Choisissez votre frequence.',
    'Systeme audio initialise. Bon voyage, agent.'
  ];

  let frequencies = [];
  let currentFreqIdx = 0;
  let ytPlayer = null;
  let ytApiReady = false;
  let isPlaying = false;
  let pendingPlay = false;
  let drawerOpen = false;
  let sidebarOpen = false;
  let nightMode = new Date().getHours() < 6;
  let masterVolume = VOL_DEFAULT;
  let isMuted = false;
  let volBeforeMute = VOL_DEFAULT;
  let currentAudio = null;
  let ambientTimer = null;
  let panelTimer = null;
  let tickerRAF = null;
  let tickerTrack = null;
  let tickerX = 0;
  let tickerW = 0;
  let tickerLast = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pad2 = n => (n < 10 ? '0' : '') + n;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const currentFreq = () => frequencies[currentFreqIdx] || null;
  const currentPlaylistId = () => (currentFreq() && currentFreq().youtubePlaylistId) || '';

  function phraseFor(type) {
    const arr = nightMode ? NIGHT_PHRASES : (type === 'intro' ? INTRO_PHRASES : AMBIENT_PHRASES);
    const i = Math.floor(Math.random() * arr.length);
    return { text: arr[i], index: i + 1 };
  }

  function freqPhrase(i) {
    if (FREQ_PHRASES[i]) return FREQ_PHRASES[i];
    const f = frequencies[i];
    return (f?.subtitle || 'Frequence ' + (i + 1)) + ' verrouillee. Signal Chronicles FM synchronise.';
  }

  function setVolume() {
    const vol = isMuted ? 0 : masterVolume;
    if (ytPlayer && ytApiReady && typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(vol);
    if (currentAudio) currentAudio.volume = vol / 100;
    const slider = document.getElementById('cfm-vol-slider');
    const label = document.getElementById('cfm-vol-label');
    const icon = isMuted || masterVolume === 0 ? '🔇' : masterVolume <= 40 ? '🔉' : '🔊';
    if (slider) slider.value = masterVolume;
    if (label) label.textContent = isMuted ? 'MUT' : masterVolume + '%';
    ['cfm-voice-btn', 'cfm-lp-voice-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = icon;
    });
  }

  function toggleMute() {
    if (isMuted) {
      isMuted = false;
      masterVolume = volBeforeMute || VOL_DEFAULT;
    } else {
      volBeforeMute = masterVolume;
      isMuted = true;
    }
    setVolume();
  }

  function playLemeAudio(type, index) {
    const filename = 'leme-' + type + '-' + pad2(index) + '.mp3';
    if (!AVAILABLE_LEME_AUDIO.has(filename) || isMuted) return;
    if (currentAudio) currentAudio.pause();
    currentAudio = new Audio(AUDIO_BASE + filename);
    currentAudio.volume = (isMuted ? 0 : masterVolume) / 100;
    currentAudio.onerror = () => { currentAudio = null; };
    const p = currentAudio.play();
    if (p && p.catch) p.catch(() => { currentAudio = null; });
  }

  function typewriter(el, text) {
    if (!el) return;
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cfm-lp-cursor';
    cursor.textContent = '\u258c';
    let i = 0;
    (function tick() {
      if (i < text.length) {
        el.textContent = text.slice(0, ++i);
        el.appendChild(cursor);
        setTimeout(tick, 28);
      }
    })();
  }

  function showPanel(text, foot, audioType, audioIdx) {
    const panel = document.getElementById('cfm-leme-panel');
    const body = document.getElementById('cfm-lp-text');
    const footer = document.getElementById('cfm-lp-footer');
    if (!panel || !body) return;
    if (footer) footer.textContent = foot || (currentFreq() && currentFreq().title) || '—';
    panel.classList.add('visible');
    typewriter(body, text);
    if (audioType && audioIdx !== undefined) playLemeAudio(audioType, audioIdx);
    clearTimeout(panelTimer);
    panelTimer = setTimeout(() => panel.classList.remove('visible'), text.length * 28 + 4000);
  }

  function animateTicker() {
    const now = performance.now();
    const dt = (now - tickerLast) / 1000;
    tickerLast = now;
    if (tickerTrack && tickerW > 0) {
      tickerX -= SCROLL_SPEED * dt;
      if (tickerX <= -tickerW) tickerX += tickerW;
      tickerTrack.style.transform = 'translateX(' + tickerX + 'px)';
    }
    tickerRAF = requestAnimationFrame(animateTicker);
  }

  function setTicker(segs) {
    const wrap = document.getElementById('cfm-ticker-wrap');
    if (!wrap) return;
    if (tickerRAF) cancelAnimationFrame(tickerRAF);
    wrap.innerHTML = '';
    tickerX = 0;
    const track = document.createElement('div');
    track.className = 'cfm-ticker-scroll';
    for (let pass = 0; pass < 2; pass++) {
      segs.forEach(seg => {
        const sep = document.createElement('span');
        sep.className = 'cfm-ticker-sep';
        sep.textContent = SCROLL_SEP;
        const item = document.createElement('span');
        item.className = 'cfm-ticker-item';
        item.dataset.type = seg.type;
        item.textContent = seg.text;
        track.append(sep, item);
      });
    }
    wrap.appendChild(track);
    tickerTrack = track;
    tickerLast = performance.now();
    requestAnimationFrame(() => { tickerW = track.scrollWidth / 2; animateTicker(); });
  }

  function setTickerText(type, text) {
    if (!tickerTrack) return;
    tickerTrack.querySelectorAll('.cfm-ticker-item[data-type="' + type + '"]').forEach(el => { el.textContent = text; });
  }

  function buildTicker(freqData, lemePhrase) {
    const segs = [{ type:'freq', text:freqData.title }];
    if (freqData.style) segs.push({ type:'style', text:freqData.style.toUpperCase() });
    if (freqData.mood) segs.push({ type:'mood', text:freqData.mood });
    if (nightMode) segs.push({ type:'night', text:pick(NIGHT_PHRASES) });
    segs.push({ type:'leme', text:lemePhrase });
    segs.push({ type:'signal', text:'BZH CHRONICLES RADIO · ON AIR' });
    if (freqData.tags?.length) segs.push({ type:'signal', text:freqData.tags.map(t => String(t).toUpperCase()).join(' · ') });
    return segs;
  }

  function cuePlaylist() {
    const id = currentPlaylistId();
    if (!id || !ytPlayer || !ytApiReady || !ytPlayer.cuePlaylist) return;
    ytPlayer.cuePlaylist({ listType:'playlist', list:id, index:0 });
    setVolume();
  }

  function loadPlaylist(randomStart) {
    const id = currentPlaylistId();
    if (!id) return;
    if (!ytPlayer || !ytApiReady || !ytPlayer.loadPlaylist) {
      pendingPlay = true;
      return;
    }
    ytPlayer.loadPlaylist({ listType:'playlist', list:id, index:randomStart ? Math.floor(Math.random() * 25) : 0 });
    setVolume();
  }

  function initYTPlayer() {
    if (ytPlayer || !window.YT?.Player) return;
    ytPlayer = new window.YT.Player(PLAYER_ID, {
      width:'260',
      height:'146',
      playerVars:{ autoplay:0, controls:1, rel:0, modestbranding:1, enablejsapi:1, origin:window.location.origin },
      events:{
        onReady: () => {
          ytApiReady = true;
          setVolume();
          if (pendingPlay || isPlaying) loadPlaylist(false);
          else cuePlaylist();
          pendingPlay = false;
        },
        onStateChange: e => { if (e.data === 0 && ytPlayer?.nextVideo) ytPlayer.nextVideo(); },
        onError: () => { if (isPlaying && ytPlayer?.nextVideo) setTimeout(() => ytPlayer.nextVideo(), 1200); }
      }
    });
  }

  function loadYTApi() {
    if (window.YT?.Player) { initYTPlayer(); return; }
    const oldReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof oldReady === 'function') oldReady();
      initYTPlayer();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }

  async function switchFreq(idx) {
    if (!frequencies.length) return;
    currentFreqIdx = ((idx % frequencies.length) + frequencies.length) % frequencies.length;
    const f = currentFreq();
    const phrase = freqPhrase(currentFreqIdx);
    document.getElementById('cfm-freq-num').textContent = f.subtitle || ('Frequence ' + (currentFreqIdx + 1));
    document.getElementById('cfm-w-style').textContent = f.style || '';
    document.querySelectorAll('.cfm-freq-item').forEach((el, i) => el.classList.toggle('active', i === currentFreqIdx));
    setTicker(buildTicker(f, phrase));
    showPanel(phrase, f.title, 'freq', currentFreqIdx + 1);
    isPlaying ? loadPlaylist(true) : cuePlaylist();
    clearInterval(ambientTimer);
    ambientTimer = setInterval(() => {
      const p = phraseFor(nightMode ? 'night' : 'ambient');
      showPanel(p.text, f.title);
      setTickerText('leme', p.text);
    }, AMBIENT_INTERVAL);
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    document.getElementById('cfm-play-btn').textContent = isPlaying ? '⏸' : '▶';
    if (isPlaying) loadPlaylist(false);
    else {
      pendingPlay = false;
      if (ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
    }
  }

  function skip() { if (isPlaying && ytPlayer?.nextVideo) ytPlayer.nextVideo(); }
  function previous() { if (ytPlayer?.previousVideo) ytPlayer.previousVideo(); else switchFreq(currentFreqIdx - 1); }

  function openSidebar() {
    const bar = document.getElementById('cfm-bar');
    if (!bar) return;
    sidebarOpen = true;
    bar.classList.add('cfm-open');
    bar.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  function injectCSS() {
    if (document.getElementById('cfm-styles')) return;
    const style = document.createElement('style');
    style.id = 'cfm-styles';
    style.textContent = `
      :root{--cfm-bg:#08101a;--cfm-border:#1a2840;--cfm-red:#e94560;--cfm-blue:#00d4ff;--cfm-purple:#8b5cf6;--cfm-green:#00ff9d;--cfm-amber:#f59e0b;--cfm-text:#c8d8e8;--cfm-dim:#4a6a8a;--cfm-mono:'Share Tech Mono',monospace;--cfm-tab-w:34px}
      body.cfm-night{--cfm-bg:#04080f;--cfm-border:#150d25;--cfm-blue:#5512a8;--cfm-purple:#6d28d9;--cfm-text:#8899aa;--cfm-dim:#2a3a4a}
      #cfm-bar{position:fixed;top:50%;right:0;z-index:9000;transform:translateY(-50%);width:var(--cfm-tab-w);display:flex;overflow:hidden;background:rgba(6,12,22,.97);border:1px solid var(--cfm-border);border-right:0;border-radius:4px 0 0 4px;box-shadow:-4px 0 32px rgba(0,0,0,.75);font-family:var(--cfm-mono);font-size:.68rem;letter-spacing:.08em;transition:width .28s cubic-bezier(.4,0,.2,1)}
      #cfm-bar.cfm-open{width:318px}#cfm-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;width:var(--cfm-tab-w);padding:14px 0;cursor:pointer;border-right:1px solid var(--cfm-border);flex-shrink:0}.cfm-tab-dot{width:7px;height:7px;border-radius:50%;background:var(--cfm-red);box-shadow:0 0 6px var(--cfm-red);animation:cfm-pulse 1.4s infinite}@keyframes cfm-pulse{50%{opacity:.3}}#cfm-tab-label{writing-mode:vertical-rl;transform:rotate(180deg);font-size:.52rem;letter-spacing:.22em;color:var(--cfm-red)}
      #cfm-inner{display:flex;flex-direction:column;gap:0;min-width:284px;max-height:calc(100vh - 40px);overflow:auto;opacity:0;pointer-events:none;transition:opacity .18s .06s}#cfm-bar.cfm-open #cfm-inner{opacity:1;pointer-events:auto}.cfm-section{display:flex;flex-direction:column;gap:5px;padding:8px 10px;border-bottom:1px solid var(--cfm-border)}.cfm-section-label{font-size:.5rem;letter-spacing:.22em;color:var(--cfm-purple);opacity:.6}#cfm-freq-num{color:var(--cfm-text);font-size:.68rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cfm-w-style{color:var(--cfm-blue);font-size:.58rem;letter-spacing:.12em;opacity:.8}.cfm-transport-row,.cfm-vol-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.cfm-act-btn{height:24px;padding:.2rem .5rem;border:1px solid var(--cfm-border);background:none;color:var(--cfm-dim);cursor:pointer;font-family:var(--cfm-mono);font-size:.6rem;letter-spacing:.1em;border-radius:2px}.cfm-act-btn:hover{border-color:var(--cfm-blue);color:var(--cfm-blue)}.cfm-act-btn.primary{width:100%;justify-content:center;border-color:var(--cfm-purple);color:var(--cfm-purple)}
      #cfm-player-wrap{width:260px;max-width:100%;aspect-ratio:16/9;background:#000;border:1px solid var(--cfm-border);overflow:hidden}#cfm-yt-player{width:100%;height:100%}#cfm-ticker-slot{height:20px;overflow:hidden;background:rgba(0,0,0,.25);border:1px solid var(--cfm-border);border-radius:2px}.cfm-ticker-scroll{display:inline-flex;align-items:center;height:100%;white-space:nowrap;will-change:transform}.cfm-ticker-item{padding:0 .2rem;line-height:20px;font-size:.6rem}.cfm-ticker-item[data-type=freq]{color:var(--cfm-text)}.cfm-ticker-item[data-type=style]{color:var(--cfm-blue)}.cfm-ticker-item[data-type=mood]{color:var(--cfm-amber);font-style:italic}.cfm-ticker-item[data-type=leme]{color:var(--cfm-purple);font-style:italic}.cfm-ticker-item[data-type=signal]{color:var(--cfm-dim)}.cfm-ticker-item[data-type=night]{color:#6d28d9}.cfm-ticker-sep{color:var(--cfm-dim);opacity:.35;padding:0 .2rem}
      #cfm-voice-btn,#cfm-lp-voice-btn{background:none;border:0;cursor:pointer;font-size:.85rem;padding:0;color:var(--cfm-dim)}#cfm-vol-slider{flex:1;min-width:120px;height:3px;cursor:pointer}#cfm-vol-label{font-size:.54rem;color:var(--cfm-dim);min-width:28px;text-align:right}#cfm-drawer{max-height:0;overflow:hidden;transition:max-height .3s}#cfm-drawer.open{max-height:220px;overflow:auto}.cfm-freq-item{padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--cfm-border)}.cfm-freq-item:hover,.cfm-freq-item.active{background:rgba(139,92,246,.07)}.cfm-freq-item.active .cfm-freq-title{color:var(--cfm-blue)}.cfm-freq-title{display:block;font-size:.72rem;font-weight:bold;color:var(--cfm-text)}.cfm-freq-sub{display:block;font-size:.62rem;color:var(--cfm-blue);opacity:.7}.cfm-freq-mood{display:block;font-size:.58rem;color:var(--cfm-dim);font-style:italic}
      #cfm-leme-panel{position:fixed;right:44px;top:50%;z-index:8998;width:260px;transform:translateY(-50%) translateY(8px);background:rgba(4,8,15,.97);border:1px solid var(--cfm-purple);border-radius:4px;overflow:hidden;box-shadow:0 0 24px rgba(139,92,246,.25);pointer-events:none;opacity:0;transition:opacity .4s,transform .4s}#cfm-leme-panel.visible{opacity:1;transform:translateY(-50%);pointer-events:auto}#cfm-bar.cfm-open~#cfm-leme-panel{right:328px}.cfm-lp-header{display:flex;align-items:center;gap:.4rem;padding:.35rem .6rem;background:rgba(139,92,246,.12);border-bottom:1px solid rgba(139,92,246,.25)}.cfm-lp-name{font-size:.55rem;letter-spacing:.22em;color:var(--cfm-purple);flex:1}.cfm-lp-signal{width:6px;height:6px;border-radius:50%;background:var(--cfm-green);box-shadow:0 0 5px var(--cfm-green)}.cfm-lp-body{padding:.55rem .65rem;min-height:3.4rem}.cfm-lp-text{font-size:.72rem;color:var(--cfm-text);line-height:1.55;font-style:italic}.cfm-lp-cursor{color:var(--cfm-purple);animation:cfm-blink .7s step-end infinite}@keyframes cfm-blink{50%{opacity:0}}.cfm-lp-footer{padding:.2rem .6rem;border-top:1px solid rgba(139,92,246,.12);font-size:.52rem;letter-spacing:.14em;color:var(--cfm-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @media(max-width:480px){#cfm-bar.cfm-open{width:260px}#cfm-inner{min-width:226px}#cfm-leme-panel{width:210px}#cfm-bar.cfm-open~#cfm-leme-panel{right:270px}}
    `;
    document.head.appendChild(style);
  }

  function buildWidget() {
    if (document.getElementById('cfm-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'cfm-bar';
    bar.innerHTML = `
      <div id="cfm-tab" title="Chronicles FM — déployer"><span class="cfm-tab-dot"></span><span id="cfm-tab-label">CFM</span></div>
      <div id="cfm-inner">
        <div class="cfm-section"><span class="cfm-section-label">CHRONICLES FM</span><span id="cfm-freq-num">—</span><span id="cfm-w-style"></span></div>
        <div class="cfm-section"><span class="cfm-section-label">PLAYER</span><div id="cfm-player-wrap"><div id="${PLAYER_ID}"></div></div></div>
        <div class="cfm-section"><span class="cfm-section-label">TRANSPORT</span><div class="cfm-transport-row"><button class="cfm-act-btn" id="cfm-play-btn">▶</button><button class="cfm-act-btn" id="cfm-skip-btn">⏭</button><button class="cfm-act-btn" id="cfm-prev-btn">◀</button><button class="cfm-act-btn" id="cfm-next-btn">▶</button><button class="cfm-act-btn" id="cfm-night-btn">🌙</button></div></div>
        <div class="cfm-section"><span class="cfm-section-label">LEMEGETON · LIVE</span><div id="cfm-ticker-slot"><div id="cfm-ticker-wrap"></div></div></div>
        <div class="cfm-section"><span class="cfm-section-label">VOLUME</span><div class="cfm-vol-row"><button id="cfm-voice-btn">🔊</button><input id="cfm-vol-slider" type="range" min="0" max="100" step="1" value="${VOL_DEFAULT}"><span id="cfm-vol-label">${VOL_DEFAULT}%</span></div></div>
        <div class="cfm-section"><span class="cfm-section-label">FRÉQUENCES</span><button class="cfm-act-btn primary" id="cfm-freq-btn">▶ FRÉQUENCES</button><div id="cfm-drawer"><div id="cfm-freq-list"></div></div></div>
      </div>`;
    document.body.appendChild(bar);

    const panel = document.createElement('div');
    panel.id = 'cfm-leme-panel';
    panel.innerHTML = '<div class="cfm-lp-header"><span>👾</span><span class="cfm-lp-name">LEMEGETON · CHRONICŒUR</span><span class="cfm-lp-signal"></span><button id="cfm-lp-voice-btn">🔊</button></div><div class="cfm-lp-body"><div class="cfm-lp-text" id="cfm-lp-text"></div></div><div class="cfm-lp-footer" id="cfm-lp-footer">—</div>';
    document.body.appendChild(panel);

    document.getElementById('cfm-tab').addEventListener('click', () => { sidebarOpen = !sidebarOpen; bar.classList.toggle('cfm-open', sidebarOpen); });
    document.getElementById('cfm-play-btn').addEventListener('click', togglePlay);
    document.getElementById('cfm-skip-btn').addEventListener('click', skip);
    document.getElementById('cfm-prev-btn').addEventListener('click', previous);
    document.getElementById('cfm-next-btn').addEventListener('click', () => switchFreq(currentFreqIdx + 1));
    document.getElementById('cfm-freq-btn').addEventListener('click', () => {
      drawerOpen = !drawerOpen;
      document.getElementById('cfm-drawer').classList.toggle('open', drawerOpen);
      document.getElementById('cfm-freq-btn').textContent = drawerOpen ? '▼ REPLIER' : '▶ FRÉQUENCES';
    });
    document.getElementById('cfm-night-btn').addEventListener('click', () => {
      nightMode = !nightMode;
      document.body.classList.toggle('cfm-night', nightMode);
      document.getElementById('cfm-night-btn').textContent = nightMode ? '☀' : '🌙';
      if (currentFreq()) setTicker(buildTicker(currentFreq(), freqPhrase(currentFreqIdx)));
    });
    document.getElementById('cfm-vol-slider').addEventListener('input', function () {
      masterVolume = parseInt(this.value, 10);
      if (isMuted && masterVolume > 0) isMuted = false;
      setVolume();
    });
    document.getElementById('cfm-voice-btn').addEventListener('click', toggleMute);
    document.getElementById('cfm-lp-voice-btn').addEventListener('click', e => { e.stopPropagation(); toggleMute(); });

    const hubOpen = document.getElementById('cfm-hub-open-widget');
    if (hubOpen) hubOpen.addEventListener('click', openSidebar);

    document.addEventListener('keydown', e => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); switchFreq(currentFreqIdx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); switchFreq(currentFreqIdx + 1); }
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (isMuted) isMuted = false; masterVolume = clamp(masterVolume + VOL_STEP, 0, 100); setVolume(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); masterVolume = clamp(masterVolume - VOL_STEP, 0, 100); if (masterVolume === 0) isMuted = true; setVolume(); }
    });
  }

  function buildDrawer() {
    const list = document.getElementById('cfm-freq-list');
    list.innerHTML = '';
    frequencies.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'cfm-freq-item' + (i === currentFreqIdx ? ' active' : '');
      item.innerHTML = `<span class="cfm-freq-title">${esc(f.title)}</span><span class="cfm-freq-sub">${esc(f.style || '')}</span><span class="cfm-freq-mood">${esc(f.mood || '')}</span>`;
      item.addEventListener('click', () => {
        switchFreq(i);
        if (drawerOpen) document.getElementById('cfm-freq-btn').click();
      });
      list.appendChild(item);
    });
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache:'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      frequencies = await res.json();
    } catch (e) {
      console.warn('[CFM] data load error:', e);
      return;
    }
    if (!Array.isArray(frequencies) || !frequencies.length) return;
    injectCSS();
    buildWidget();
    if (nightMode) document.body.classList.add('cfm-night');
    buildDrawer();
    setVolume();
    loadYTApi();
    await switchFreq(0);
    setTimeout(() => {
      const p = phraseFor('intro');
      showPanel(p.text, frequencies[0].title, 'intro', p.index);
      setTickerText('leme', p.text);
    }, 2000);
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();