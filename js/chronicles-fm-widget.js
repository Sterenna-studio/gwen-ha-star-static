/**
 * Chronicles FM Widget v5.4 — SIDEBAR DÉPLOYABLE
 * YT IFrame API · Fisher-Yates shuffle · skip
 * + LemePanel flottant (typewriter + scanlines)
 * + Ticker enrichi (freq/style/mood/yt/leme/night)
 * + Audio voix Lemegeton (/audio/leme/) avec fallback silencieux
 * + Volume master : slider barre, ArrowUp/Down, mute sur icône (M)
 * + CFM bar refactorisée : tab latéral droit 34px → panneau 280px déployable
 */
(function () {
  'use strict';

  /* ─── CONFIG ──────────────────────────────────────────────────────────── */
  const YT_API_KEY       = 'AIzaSyAEruwkr9u1CN0OECR6onqY1Z3vW-LsvCE';
  const DATA_URL         = '/chronicles-fm/data.json';
  const PLAYER_ID        = 'cfm-yt-player';
  const AUDIO_BASE       = '/audio/leme/';
  const SCROLL_SPEED_PX  = 55;
  const SCROLL_SEP       = '  ⬡  ';
  const AMBIENT_INTERVAL = 50000;
  const NIGHT_START      = 0;
  const NIGHT_END        = 6;
  const VOL_STEP         = 10;
  const VOL_DEFAULT      = 80;

  /* ─── STATE ───────────────────────────────────────────────────────────── */
  let frequencies    = [];
  let currentFreqIdx = 0;
  let ytPlayer       = null;
  let shuffledQueue  = [];
  let queuePos       = 0;
  let isPlaying      = false;
  let ytApiReady     = false;
  let drawerOpen     = false;
  let sidebarOpen    = false;
  let nightMode      = false;
  let voiceEnabled   = true;
  let masterVolume   = VOL_DEFAULT;
  let isMuted        = false;
  let volBeforeMute  = VOL_DEFAULT;
  let ambientTimer   = null;
  let lemePanelTimer = null;
  let scrollerRAF    = null;
  let scrollerX      = 0;
  let scrollerW      = 0;
  let scrollerLast   = 0;
  let scrollerPaused = false;
  let scrollerTrack  = null;
  let currentAudio   = null;

  /* ─── FREQ PHRASES ───────────────────────────────────────────────────── */
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
    'Format long engage. Pas de pause. Pas d\'interruption. Tiens.',
  ];

  const NIGHT_PHRASES = [
    'Les signaux se fondent dans l\'obscurite des frequences mortes.',
    'L\'ether murmure des elegies a minuit passe.',
    'Seuls les demons veillent encore sur les ondes.',
    'Transmissions chiffrees depuis les catacombes numeriques.',
    'L\'obscurite amplifie. Les vivants dorment. Les machines ecoutent.',
    'Frequences noires. Signal de l\'abime. BZH Chronicles ne dort pas.',
    'Les archives s\'ouvrent sous la nuit. Systeme 03:00 ACTIF.',
    'Heure maudite. Lemegeton transmet depuis les limbes.',
  ];

  const AMBIENT_PHRASES = [
    'Synchronisation des ondes en cours. Patience, agent.',
    'Le signal traverse les dimensions. BZH Chronicles on air.',
    'Archives consultees. Frequence verrouillee.',
    'Lemegeton calibre les emissions. Restez connectes.',
    'Protocole audio actif. La machine ecoute avec vous.',
    'Interferences detectees. Filtrage en cours.',
    'Transmission depuis les serveurs de l\'Ordre. Statut : ACTIF.',
    'BZH Chronicles Radio. Toujours en orbite.',
  ];

  const INTRO_PHRASES = [
    'Bienvenue sur Chronicles FM. Le signal est etabli.',
    'Connexion etablie. Lemegeton prend le relais.',
    'Chronicles FM operationnel. Choisissez votre frequence.',
    'Systeme audio initialise. Bon voyage, agent.',
  ];

  /* ─── HELPERS ─────────────────────────────────────────────────────────── */
  function detectNight() { return new Date().getHours() >= NIGHT_START && new Date().getHours() < NIGHT_END; }
  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function pickPhraseAndIndex(type) {
    var arr = nightMode ? NIGHT_PHRASES : (type === 'intro' ? INTRO_PHRASES : AMBIENT_PHRASES);
    var idx = Math.floor(Math.random() * arr.length);
    return { text: arr[idx], index: idx + 1 };
  }

  function freqPhrase(freqIdx) { return FREQ_PHRASES[freqIdx] || FREQ_PHRASES[0]; }

  /* ─── VOLUME ──────────────────────────────────────────────────────────── */
  function applyVolume() {
    var eff = isMuted ? 0 : masterVolume;
    if (ytPlayer && ytApiReady && typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(eff);
    if (currentAudio) currentAudio.volume = eff / 100;
    var slider = document.getElementById('cfm-vol-slider');
    if (slider) slider.value = masterVolume;
    var label = document.getElementById('cfm-vol-label');
    if (label) label.textContent = isMuted ? 'MUT' : masterVolume + '%';
    syncVolIcon();
  }

  function syncVolIcon() {
    var icon;
    if (isMuted || masterVolume === 0) icon = '🔇';
    else if (masterVolume <= 40)       icon = '🔉';
    else                               icon = '🔊';
    var btnBar   = document.getElementById('cfm-voice-btn');
    var btnPanel = document.getElementById('cfm-lp-voice-btn');
    if (btnBar)   btnBar.textContent   = icon;
    if (btnPanel) btnPanel.textContent = icon;
  }

  function toggleMute() {
    if (isMuted) {
      isMuted = false;
      masterVolume = volBeforeMute || VOL_DEFAULT;
    } else {
      volBeforeMute = masterVolume;
      isMuted = true;
    }
    applyVolume();
  }

  function toggleVoice() { toggleMute(); }

  /* ─── AUDIO VOICE ─────────────────────────────────────────────────────── */
  function playLemeAudio(type, index) {
    if (!voiceEnabled || isMuted) return;
    var src = AUDIO_BASE + 'leme-' + type + '-' + pad2(index) + '.mp3';
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    var audio = new Audio(src);
    audio.volume = masterVolume / 100;
    currentAudio = audio;
    audio.onerror = function () { currentAudio = null; };
    var p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(function () { currentAudio = null; });
  }

  function playLemePhrase(type) {
    var result = pickPhraseAndIndex(type);
    playLemeAudio(nightMode ? 'night' : type, result.index);
    return result;
  }

  /* ─── TYPEWRITER ──────────────────────────────────────────────────────── */
  function typewriter(el, text, speed, onDone) {
    if (!el) return;
    speed = speed || 28;
    el.innerHTML = '';
    var cursor = document.createElement('span');
    cursor.className = 'cfm-lp-cursor';
    cursor.textContent = '\u258c';
    var i = 0;
    function tick() {
      if (i < text.length) {
        el.textContent = text.slice(0, ++i);
        el.appendChild(cursor);
        setTimeout(tick, speed);
      } else { if (onDone) onDone(); }
    }
    tick();
  }

  /* ─── LEME PANEL ──────────────────────────────────────────────────────── */
  function showLemePanel(phrase, freqLabel, audioType, audioIdx) {
    var panel  = document.getElementById('cfm-leme-panel');
    var lpText = document.getElementById('cfm-lp-text');
    var lpFoot = document.getElementById('cfm-lp-footer');
    if (!panel || !lpText) return;
    if (lpFoot) lpFoot.textContent = freqLabel || (frequencies[currentFreqIdx] && frequencies[currentFreqIdx].title) || '—';
    panel.classList.add('visible');
    typewriter(lpText, phrase, 28);
    if (audioType && audioIdx !== undefined) playLemeAudio(audioType, audioIdx);
    clearTimeout(lemePanelTimer);
    lemePanelTimer = setTimeout(function () { panel.classList.remove('visible'); }, phrase.length * 28 + 4000);
  }

  /* ─── SCROLLER ────────────────────────────────────────────────────────── */
  function scrollerAnimate() {
    var now = performance.now(), dt = (now - scrollerLast) / 1000;
    scrollerLast = now;
    if (!scrollerPaused && scrollerW > 0 && scrollerTrack) {
      scrollerX -= SCROLL_SPEED_PX * dt;
      if (scrollerX <= -scrollerW) scrollerX += scrollerW;
      scrollerTrack.style.transform = 'translateX(' + scrollerX + 'px)';
    }
    scrollerRAF = requestAnimationFrame(scrollerAnimate);
  }

  function setTickerSegments(segs) {
    var wrap = document.getElementById('cfm-ticker-wrap');
    if (!wrap) return;
    scrollerX = 0;
    if (scrollerRAF) { cancelAnimationFrame(scrollerRAF); scrollerRAF = null; }
    wrap.innerHTML = '';
    var track = document.createElement('div');
    track.className = 'cfm-ticker-scroll';
    for (var pass = 0; pass < 2; pass++) {
      segs.forEach(function (seg) {
        var sep = document.createElement('span');
        sep.className = 'cfm-ticker-sep'; sep.textContent = SCROLL_SEP;
        track.appendChild(sep);
        var el = document.createElement('span');
        el.className = 'cfm-ticker-item'; el.dataset.type = seg.type; el.textContent = seg.text;
        if (seg.type === 'yt' && seg.videoId) {
          (function (vid) { el.addEventListener('click', function () { window.open('https://www.youtube.com/watch?v=' + vid, '_blank', 'noopener'); }); })(seg.videoId);
        }
        track.appendChild(el);
      });
    }
    wrap.appendChild(track);
    scrollerTrack = track;
    scrollerLast  = performance.now();
    requestAnimationFrame(function () { scrollerW = track.scrollWidth / 2; scrollerAnimate(); });
  }

  function updateTickerSegment(type, text) {
    if (!scrollerTrack) return;
    scrollerTrack.querySelectorAll('.cfm-ticker-item[data-type="' + type + '"]').forEach(function (el) { el.textContent = text; });
  }

  function buildSegments(freq, lemePhrase, ytItems) {
    var segs = [];
    segs.push({ type: 'freq', text: freq.title });
    if (freq.style) segs.push({ type: 'style', text: freq.style.toUpperCase() });
    if (freq.mood)  segs.push({ type: 'mood',  text: freq.mood });
    if (nightMode)  segs.push({ type: 'night', text: pickRandom(NIGHT_PHRASES) });
    segs.push({ type: 'leme',   text: lemePhrase });
    segs.push({ type: 'signal', text: 'BZH CHRONICLES RADIO · ON AIR' });
    if (freq.tags && freq.tags.length) segs.push({ type: 'signal', text: freq.tags.map(function (t) { return t.toUpperCase(); }).join(' · ') });
    if (ytItems && ytItems.length) {
      ytItems.slice().sort(function () { return Math.random() - .5; }).slice(0, 8).forEach(function (item) {
        segs.push({ type: 'yt', text: item.title, videoId: item.videoId });
      });
    }
    return segs;
  }

  /* ─── SHUFFLE ─────────────────────────────────────────────────────────── */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    return a;
  }

  /* ─── YT FETCH ────────────────────────────────────────────────────────── */
  async function fetchPlaylistVideoIds(playlistId) {
    var videoIds = [], pageToken = '';
    try {
      do {
        var res  = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=' + playlistId + '&key=' + YT_API_KEY + (pageToken ? '&pageToken=' + pageToken : ''));
        var data = await res.json();
        if (data.items) data.items.forEach(function (item) { var id = item.contentDetails && item.contentDetails.videoId; if (id) videoIds.push(id); });
        pageToken = data.nextPageToken || '';
      } while (pageToken);
    } catch (e) { console.warn('[CFM] fetchPlaylist error:', e); }
    return videoIds;
  }

  async function fetchPlaylistItems(playlistId) {
    var items = [], pageToken = '';
    try {
      do {
        var res  = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=' + playlistId + '&key=' + YT_API_KEY + (pageToken ? '&pageToken=' + pageToken : ''));
        var data = await res.json();
        if (data.items) data.items.forEach(function (item) {
          var title = item.snippet && item.snippet.title;
          var vid   = item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId;
          if (title && vid) items.push({ title: title, videoId: vid });
        });
        pageToken = data.nextPageToken || '';
      } while (pageToken);
    } catch (e) { /**/ }
    return items;
  }

  /* ─── QUEUE ───────────────────────────────────────────────────────────── */
  async function buildQueue(freqIdx) {
    var freq = frequencies[freqIdx];
    if (!freq || !freq.youtubePlaylistId) return;
    var ids = await fetchPlaylistVideoIds(freq.youtubePlaylistId);
    shuffledQueue = ids.length ? shuffle(ids) : [];
    queuePos = 0;
  }

  /* ─── YT PLAYER ───────────────────────────────────────────────────────── */
  function playNext() {
    if (!shuffledQueue.length) return;
    if (queuePos >= shuffledQueue.length) { shuffledQueue = shuffle(shuffledQueue); queuePos = 0; }
    var videoId = shuffledQueue[queuePos++];
    if (ytPlayer && ytApiReady) ytPlayer.loadVideoById(videoId);
  }

  function onPlayerStateChange(event) { if (event.data === 0) playNext(); }

  function initYTPlayer() {
    var container = document.getElementById(PLAYER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = PLAYER_ID;
      container.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;';
      document.body.appendChild(container);
    }
    ytPlayer = new window.YT.Player(PLAYER_ID, {
      width: '1', height: '1',
      playerVars: { autoplay:0, controls:0, disablekb:1, fs:0, rel:0, modestbranding:1, enablejsapi:1, origin: window.location.origin },
      events: {
        onReady: function () {
          ytApiReady = true;
          ytPlayer.setVolume(isMuted ? 0 : masterVolume);
        },
        onStateChange: onPlayerStateChange,
        onError: function () { setTimeout(playNext, 1500); }
      }
    });
  }

  function loadYTApi() {
    if (window.YT && window.YT.Player) { initYTPlayer(); return; }
    window.onYouTubeIframeAPIReady = initYTPlayer;
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  /* ─── SWITCH FREQ ─────────────────────────────────────────────────────── */
  async function switchFreq(idx) {
    currentFreqIdx = idx;
    updateFreqDisplay();
    updateDrawerActive();
    var freq = frequencies[idx], phrase = freqPhrase(idx);
    setTickerSegments(buildSegments(freq, phrase, []));
    showLemePanel(phrase, freq.title, 'freq', idx + 1);
    if (freq.youtubePlaylistId) {
      fetchPlaylistItems(freq.youtubePlaylistId).then(function (items) {
        setTickerSegments(buildSegments(freq, phrase, items));
      });
    }
    if (isPlaying) {
      if (ytPlayer && ytApiReady) ytPlayer.stopVideo();
      await buildQueue(idx); playNext();
    } else {
      await buildQueue(idx);
    }
    clearInterval(ambientTimer);
    ambientTimer = setInterval(function () {
      var result = playLemePhrase(nightMode ? 'night' : 'ambient');
      showLemePanel(result.text, freq.title);
      updateTickerSegment('leme', result.text);
    }, AMBIENT_INTERVAL);
  }

  /* ─── PLAY / SKIP ─────────────────────────────────────────────────────── */
  async function togglePlay() {
    if (!isPlaying) {
      if (!shuffledQueue.length) await buildQueue(currentFreqIdx);
      isPlaying = true; updatePlayBtn(); playNext();
    } else {
      isPlaying = false; updatePlayBtn();
      if (ytPlayer && ytApiReady) ytPlayer.pauseVideo();
    }
  }

  async function skip() {
    if (!isPlaying) return;
    if (!shuffledQueue.length) await buildQueue(currentFreqIdx);
    playNext();
  }

  /* ─── UI HELPERS ──────────────────────────────────────────────────────── */
  function updatePlayBtn() {
    var btn = document.getElementById('cfm-play-btn');
    if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
  }

  function updateFreqDisplay() {
    var freq = frequencies[currentFreqIdx]; if (!freq) return;
    var num = document.getElementById('cfm-freq-num'); if (num) num.textContent = freq.subtitle || ('Frequence ' + (currentFreqIdx + 1));
    var ws  = document.getElementById('cfm-w-style');  if (ws)  ws.textContent  = freq.style || '';
  }

  function updateDrawerActive() {
    document.querySelectorAll('.cfm-freq-item').forEach(function (el, i) { el.classList.toggle('active', i === currentFreqIdx); });
  }

  function toggleDrawer() {
    drawerOpen = !drawerOpen;
    var drawer = document.getElementById('cfm-drawer');
    if (drawer) drawer.classList.toggle('open', drawerOpen);
    var btn = document.getElementById('cfm-freq-btn');
    if (btn) btn.textContent = drawerOpen ? '▼ REPLIER' : '▶ FRÉQUENCES';
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    var bar = document.getElementById('cfm-bar');
    if (bar) bar.classList.toggle('cfm-open', sidebarOpen);
  }

  /* ─── BUILD DRAWER ────────────────────────────────────────────────────── */
  function buildDrawer() {
    var list = document.getElementById('cfm-freq-list'); if (!list) return;
    list.innerHTML = '';
    frequencies.forEach(function (freq, i) {
      var item = document.createElement('div');
      item.className = 'cfm-freq-item' + (i === currentFreqIdx ? ' active' : '');
      item.innerHTML = '<span class="cfm-freq-title">' + freq.title + '</span><span class="cfm-freq-sub">' + (freq.style || '') + '</span><span class="cfm-freq-mood">' + (freq.mood || '') + '</span>';
      item.addEventListener('click', function () { switchFreq(i); if (drawerOpen) toggleDrawer(); });
      list.appendChild(item);
    });
  }

  /* ─── CSS ─────────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('cfm-styles')) return;
    var style = document.createElement('style');
    style.id = 'cfm-styles';
    style.textContent = [
      ':root{--cfm-bg:#08101a;--cfm-border:#1a2840;--cfm-red:#e94560;--cfm-blue:#00d4ff;',
      '--cfm-purple:#8b5cf6;--cfm-green:#00ff9d;--cfm-amber:#f59e0b;',
      '--cfm-yellow:#fde68a;--cfm-text:#c8d8e8;--cfm-dim:#4a6a8a;',
      '--cfm-mono:\'Share Tech Mono\',monospace;--cfm-tab-w:34px;}',
      'body.cfm-night{--cfm-bg:#04080f;--cfm-border:#150d25;--cfm-red:#7a1530;--cfm-blue:#5512a8;',
      '--cfm-purple:#6d28d9;--cfm-green:#00cc5a;--cfm-text:#8899aa;--cfm-dim:#2a3a4a;}',

      /* ── SIDEBAR ── */
      '#cfm-bar{position:fixed;top:50%;right:0;z-index:9000;transform:translateY(-50%);',
      'background:rgba(6,12,22,.97);border:1px solid var(--cfm-border);border-right:none;',
      'display:flex;flex-direction:row;align-items:stretch;',
      'font-family:var(--cfm-mono);font-size:.68rem;letter-spacing:.08em;',
      'box-shadow:-4px 0 32px rgba(0,0,0,.75);',
      'width:var(--cfm-tab-w);border-radius:4px 0 0 4px;',
      'transition:width .28s cubic-bezier(.4,0,.2,1);overflow:hidden;}',
      '#cfm-bar.cfm-open{width:290px;}',

      /* Tab (toujours visible) */
      '#cfm-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'gap:7px;padding:14px 0;cursor:pointer;flex-shrink:0;width:var(--cfm-tab-w);',
      'border-right:1px solid var(--cfm-border);transition:background .15s;}',
      '#cfm-tab:hover{background:rgba(139,92,246,.08);}',
      '.cfm-tab-dot{width:7px;height:7px;border-radius:50%;background:var(--cfm-red);',
      'box-shadow:0 0 6px var(--cfm-red);animation:cfm-pulse 1.4s ease-in-out infinite;}',
      '@keyframes cfm-pulse{0%,100%{opacity:1}50%{opacity:.3}}',
      '#cfm-tab-label{writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);',
      'font-size:.52rem;letter-spacing:.22em;color:var(--cfm-red);white-space:nowrap;',
      'text-shadow:0 0 8px rgba(233,69,96,.4);}',

      /* Inner (contenu déployé) */
      '#cfm-inner{display:flex;flex-direction:column;gap:0;min-width:256px;',
      'opacity:0;pointer-events:none;transition:opacity .18s .06s;overflow-y:auto;',
      'max-height:calc(100vh - 40px);}',
      '#cfm-bar.cfm-open #cfm-inner{opacity:1;pointer-events:auto;}',

      /* Sections */
      '.cfm-section{display:flex;flex-direction:column;gap:5px;',
      'padding:8px 10px;border-bottom:1px solid var(--cfm-border);}',
      '.cfm-section:last-child{border-bottom:none;}',
      '.cfm-section-label{font-size:.5rem;letter-spacing:.22em;color:var(--cfm-purple);',
      'opacity:.55;margin-bottom:1px;}',

      /* Freq info */
      '#cfm-freq-num{color:var(--cfm-text);font-size:.68rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#cfm-w-style{color:var(--cfm-blue);font-size:.58rem;letter-spacing:.12em;opacity:.8;}',

      /* Transport row */
      '.cfm-transport-row{display:flex;gap:4px;align-items:center;flex-wrap:wrap;}',

      /* Boutons */
      '.cfm-dot{width:7px;height:7px;border-radius:50%;background:var(--cfm-red);box-shadow:0 0 6px var(--cfm-red);flex-shrink:0;animation:cfm-pulse 1.4s ease-in-out infinite;}',
      '.cfm-act-btn{padding:.2rem .5rem;border:1px solid var(--cfm-border);background:none;',
      'color:var(--cfm-dim);cursor:pointer;font-family:var(--cfm-mono);font-size:.6rem;',
      'letter-spacing:.1em;border-radius:2px;transition:all .15s;display:inline-flex;',
      'align-items:center;white-space:nowrap;height:24px;}',
      '.cfm-act-btn:hover{border-color:var(--cfm-blue);color:var(--cfm-blue);}',
      '.cfm-act-btn.primary{border-color:var(--cfm-purple);color:var(--cfm-purple);width:100%;justify-content:center;}',
      '.cfm-act-btn.primary:hover{box-shadow:0 0 8px rgba(139,92,246,.3);}',

      /* Ticker compact */
      '#cfm-ticker-slot{overflow:hidden;height:20px;position:relative;',
      'background:rgba(0,0,0,.25);border-radius:2px;border:1px solid var(--cfm-border);}',
      '#cfm-ticker-wrap{width:100%;height:100%;overflow:hidden;position:relative;}',
      '#cfm-ticker-wrap::before{content:\'\';position:absolute;top:0;bottom:0;left:0;width:16px;z-index:2;background:linear-gradient(to right,rgba(6,12,22,1),transparent);pointer-events:none;}',
      '#cfm-ticker-wrap::after{content:\'\';position:absolute;top:0;bottom:0;right:0;width:16px;z-index:2;background:linear-gradient(to left,rgba(6,12,22,1),transparent);pointer-events:none;}',
      '.cfm-ticker-scroll{display:inline-flex;align-items:center;white-space:nowrap;height:100%;will-change:transform;}',
      '.cfm-ticker-item{padding:0 .2rem;line-height:20px;cursor:default;font-size:.6rem;}',
      '.cfm-ticker-item[data-type=freq]{color:var(--cfm-text);}',
      '.cfm-ticker-item[data-type=style]{color:var(--cfm-blue);letter-spacing:.12em;}',
      '.cfm-ticker-item[data-type=mood]{color:var(--cfm-amber);font-style:italic;}',
      '.cfm-ticker-item[data-type=leme]{color:var(--cfm-purple);font-style:italic;}',
      '.cfm-ticker-item[data-type=signal]{color:var(--cfm-dim);font-size:.56rem;letter-spacing:.1em;}',
      '.cfm-ticker-item[data-type=yt]{color:var(--cfm-yellow);cursor:pointer;}',
      '.cfm-ticker-item[data-type=yt]:hover{text-decoration:underline;text-underline-offset:3px;}',
      '.cfm-ticker-item[data-type=night]{color:#6d28d9;font-style:italic;text-shadow:0 0 6px rgba(109,40,217,.6);}',
      '.cfm-ticker-sep{color:var(--cfm-dim);opacity:.35;padding:0 .2rem;font-size:.6rem;}',
      '.cfm-ticker-item[data-type=leme]::before{content:\'◈ \';opacity:.6;}',
      '.cfm-ticker-item[data-type=signal]::before{content:\'⬡ \';opacity:.5;}',
      '.cfm-ticker-item[data-type=yt]::before{content:\'▶ \';color:var(--cfm-red);font-size:.56rem;opacity:.8;}',
      '.cfm-ticker-item[data-type=night]::before{content:\'🌙 \';}',

      /* Volume row */
      '.cfm-vol-row{display:flex;align-items:center;gap:6px;}',
      '#cfm-voice-btn{background:none;border:none;cursor:pointer;font-size:.85rem;padding:0;',
      'color:var(--cfm-dim);transition:color .15s;line-height:1;flex-shrink:0;}',
      '#cfm-voice-btn:hover{color:var(--cfm-text);}',
      '#cfm-vol-slider{-webkit-appearance:none;appearance:none;flex:1;height:3px;',
      'border-radius:2px;background:var(--cfm-border);outline:none;cursor:pointer;}',
      '#cfm-vol-slider::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;',
      'border-radius:50%;background:var(--cfm-purple);cursor:pointer;',
      'box-shadow:0 0 4px rgba(139,92,246,.6);}',
      '#cfm-vol-slider::-moz-range-thumb{width:10px;height:10px;border:none;border-radius:50%;',
      'background:var(--cfm-purple);cursor:pointer;}',
      '#cfm-vol-label{font-size:.54rem;color:var(--cfm-dim);letter-spacing:.06em;min-width:28px;text-align:right;flex-shrink:0;}',

      /* Drawer fréquences — dans le panneau */
      '#cfm-drawer{max-height:0;overflow:hidden;',
      'transition:max-height .3s cubic-bezier(.4,0,.2,1);}',
      '#cfm-drawer.open{max-height:220px;overflow-y:auto;}',
      '.cfm-freq-item{padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--cfm-border);transition:background .12s;}',
      '.cfm-freq-item:hover,.cfm-freq-item.active{background:rgba(139,92,246,.07);}',
      '.cfm-freq-item.active .cfm-freq-title{color:var(--cfm-blue);}',
      '.cfm-freq-title{display:block;font-size:.72rem;font-weight:bold;color:var(--cfm-text);}',
      '.cfm-freq-sub{display:block;font-size:.62rem;color:var(--cfm-blue);opacity:.7;}',
      '.cfm-freq-mood{display:block;font-size:.58rem;color:var(--cfm-dim);font-style:italic;}',

      /* LemePanel — à gauche du tab, centré verticalement */
      '#cfm-leme-panel{position:fixed;right:calc(var(--cfm-tab-w) + 10px);top:50%;',
      'transform:translateY(-50%) translateY(8px);z-index:8998;',
      'width:260px;background:rgba(4,8,15,.97);border:1px solid var(--cfm-purple);border-radius:4px;overflow:hidden;',
      'box-shadow:0 0 24px rgba(139,92,246,.25),inset 0 0 40px rgba(0,0,0,.4);',
      'pointer-events:none;opacity:0;transition:opacity .4s ease,transform .4s ease;}',
      '#cfm-leme-panel.visible{opacity:1;transform:translateY(-50%) translateY(0);pointer-events:auto;}',
      '#cfm-bar.cfm-open ~ #cfm-leme-panel{right:calc(290px + 10px);}',
      '#cfm-leme-panel::before{content:\'\';position:absolute;inset:0;pointer-events:none;z-index:2;',
      'background:repeating-linear-gradient(to bottom,transparent 0px,transparent 3px,rgba(0,0,0,.18) 3px,rgba(0,0,0,.18) 4px);',
      'animation:cfm-scanline 8s linear infinite;}',
      '@keyframes cfm-scanline{0%{background-position:0 0}100%{background-position:0 80px}}',
      '.cfm-lp-header{display:flex;align-items:center;gap:.4rem;padding:.35rem .6rem;',
      'background:rgba(139,92,246,.12);border-bottom:1px solid rgba(139,92,246,.25);position:relative;z-index:3;}',
      '.cfm-lp-avatar{font-size:.9rem;filter:drop-shadow(0 0 4px rgba(139,92,246,.7));}',
      '.cfm-lp-name{font-size:.55rem;letter-spacing:.22em;color:var(--cfm-purple);text-shadow:0 0 6px rgba(139,92,246,.5);flex:1;}',
      '.cfm-lp-signal{width:6px;height:6px;border-radius:50%;background:var(--cfm-green);box-shadow:0 0 5px var(--cfm-green);animation:cfm-pulse 1.2s ease-in-out infinite;flex-shrink:0;}',
      '#cfm-lp-voice-btn{background:none;border:none;cursor:pointer;font-size:.85rem;padding:0 .2rem;line-height:1;pointer-events:auto;flex-shrink:0;opacity:.7;transition:opacity .15s;}',
      '#cfm-lp-voice-btn:hover{opacity:1;}',
      '.cfm-lp-body{padding:.55rem .65rem .6rem;min-height:3.4rem;position:relative;z-index:3;}',
      '.cfm-lp-text{font-size:.72rem;color:var(--cfm-text);line-height:1.55;font-style:italic;letter-spacing:.03em;word-break:break-word;}',
      '.cfm-lp-cursor{display:inline-block;color:var(--cfm-purple);font-style:normal;animation:cfm-blink .7s step-end infinite;text-shadow:0 0 6px rgba(139,92,246,.8);margin-left:1px;font-size:.8rem;vertical-align:text-bottom;}',
      '@keyframes cfm-blink{0%,100%{opacity:1}50%{opacity:0}}',
      '.cfm-lp-footer{padding:.2rem .6rem;border-top:1px solid rgba(139,92,246,.12);font-size:.52rem;letter-spacing:.14em;color:var(--cfm-dim);position:relative;z-index:3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.cfm-lp-footer::before{content:\'⬡ \';opacity:.5;}',

      /* Responsive */
      '@media(max-width:480px){#cfm-leme-panel{width:200px;}',
      '#cfm-bar.cfm-open{width:240px;}',
      '#cfm-bar.cfm-open ~ #cfm-leme-panel{right:calc(240px + 8px);}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ─── BUILD WIDGET DOM ────────────────────────────────────────────────── */
  function buildWidget() {
    if (document.getElementById('cfm-bar')) return;

    var bar = document.createElement('div');
    bar.id  = 'cfm-bar';
    bar.innerHTML =
      // Tab cliquable (toujours visible, 34px)
      '<div id="cfm-tab" title="Chronicles FM — déployer">'+
        '<span class="cfm-tab-dot"></span>'+
        '<span id="cfm-tab-label">CFM</span>'+
      '</div>'+
      // Inner — contenu déployé
      '<div id="cfm-inner">'+
        // Brand + freq info
        '<div class="cfm-section">'+
          '<span class="cfm-section-label">CHRONICLES FM</span>'+
          '<span id="cfm-freq-num">—</span>'+
          '<span id="cfm-w-style"></span>'+
        '</div>'+
        // Transport
        '<div class="cfm-section">'+
          '<span class="cfm-section-label">TRANSPORT</span>'+
          '<div class="cfm-transport-row">'+
            '<button class="cfm-act-btn" id="cfm-play-btn" title="Play/Pause (Space)">▶</button>'+
            '<button class="cfm-act-btn" id="cfm-skip-btn" title="Skip">⏭</button>'+
            '<button class="cfm-act-btn" id="cfm-prev-btn" title="Freq − (←)">◀</button>'+
            '<button class="cfm-act-btn" id="cfm-next-btn" title="Freq + (→)">▶</button>'+
            '<button class="cfm-act-btn" id="cfm-night-btn" title="Mode nuit">🌙</button>'+
          '</div>'+
        '</div>'+
        // Ticker
        '<div class="cfm-section">'+
          '<span class="cfm-section-label">LEMEGETON · LIVE</span>'+
          '<div id="cfm-ticker-slot"><div id="cfm-ticker-wrap"></div></div>'+
        '</div>'+
        // Volume
        '<div class="cfm-section">'+
          '<span class="cfm-section-label">VOLUME</span>'+
          '<div class="cfm-vol-row">'+
            '<button id="cfm-voice-btn" title="Mute/Unmute (M)">🔊</button>'+
            '<input id="cfm-vol-slider" type="range" min="0" max="100" step="1" value="' + VOL_DEFAULT + '" title="Volume (↑↓)">'+
            '<span id="cfm-vol-label">' + VOL_DEFAULT + '%</span>'+
          '</div>'+
        '</div>'+
        // Fréquences + drawer intégré
        '<div class="cfm-section">'+
          '<span class="cfm-section-label">FRÉQUENCES</span>'+
          '<button class="cfm-act-btn primary" id="cfm-freq-btn">▶ FRÉQUENCES</button>'+
          '<div id="cfm-drawer"><div id="cfm-freq-list"></div></div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(bar);

    // LemePanel
    var panel = document.createElement('div');
    panel.id  = 'cfm-leme-panel';
    panel.innerHTML =
      '<div class="cfm-lp-header">'+
        '<span class="cfm-lp-avatar">👾</span>'+
        '<span class="cfm-lp-name">LEMEGETON · CHRONICŒUR</span>'+
        '<span class="cfm-lp-signal"></span>'+
        '<button id="cfm-lp-voice-btn" title="Mute/Unmute (M)">🔊</button>'+
      '</div>'+
      '<div class="cfm-lp-body"><div class="cfm-lp-text" id="cfm-lp-text"></div></div>'+
      '<div class="cfm-lp-footer" id="cfm-lp-footer">—</div>';
    document.body.appendChild(panel);

    /* Events */
    document.getElementById('cfm-tab').addEventListener('click', toggleSidebar);
    document.getElementById('cfm-play-btn').addEventListener('click', togglePlay);
    document.getElementById('cfm-skip-btn').addEventListener('click', skip);
    document.getElementById('cfm-prev-btn').addEventListener('click', function () { switchFreq((currentFreqIdx - 1 + frequencies.length) % frequencies.length); });
    document.getElementById('cfm-next-btn').addEventListener('click', function () { switchFreq((currentFreqIdx + 1) % frequencies.length); });
    document.getElementById('cfm-freq-btn').addEventListener('click', toggleDrawer);
    document.getElementById('cfm-night-btn').addEventListener('click', function () {
      nightMode = !nightMode;
      document.body.classList.toggle('cfm-night', nightMode);
      document.getElementById('cfm-night-btn').textContent = nightMode ? '☀' : '🌙';
    });

    var slider = document.getElementById('cfm-vol-slider');
    slider.addEventListener('input', function () {
      masterVolume = parseInt(this.value, 10);
      if (isMuted && masterVolume > 0) isMuted = false;
      applyVolume();
    });

    document.getElementById('cfm-voice-btn').addEventListener('click', toggleMute);
    document.getElementById('cfm-lp-voice-btn').addEventListener('click', function (e) {
      e.stopPropagation(); toggleMute();
    });

    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft')               { e.preventDefault(); switchFreq((currentFreqIdx - 1 + frequencies.length) % frequencies.length); }
      if (e.key === 'ArrowRight')              { e.preventDefault(); switchFreq((currentFreqIdx + 1) % frequencies.length); }
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.key === 'm' || e.key === 'M')      { e.preventDefault(); toggleMute(); }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isMuted) isMuted = false;
        masterVolume = clamp(masterVolume + VOL_STEP, 0, 100);
        applyVolume();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        masterVolume = clamp(masterVolume - VOL_STEP, 0, 100);
        if (masterVolume === 0) isMuted = true;
        applyVolume();
      }
    });
  }

  /* ─── INIT ────────────────────────────────────────────────────────────── */
  async function init() {
    try {
      var res = await fetch(DATA_URL);
      frequencies = await res.json();
    } catch (e) { console.warn('[CFM] data.json load error:', e); return; }
    if (!frequencies.length) return;

    nightMode = detectNight();
    injectCSS();
    buildWidget();
    if (nightMode) document.body.classList.add('cfm-night');
    buildDrawer();
    applyVolume();
    loadYTApi();

    await switchFreq(0);

    setTimeout(function () {
      var result = pickPhraseAndIndex('intro');
      showLemePanel(result.text, frequencies[0].title, 'intro', result.index);
      updateTickerSegment('leme', result.text);
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
