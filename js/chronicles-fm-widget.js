/**
 * Chronicles FM Widget v5.1
 * YT IFrame API · Fisher-Yates shuffle · skip
 * + LemePanel flottant bas-droite (typewriter + scanlines)
 * + Ticker enrichi (freq / style / mood / yt / leme / night)
 */
(function () {
  'use strict';

  /* ─── CONFIG ─────────────────────────────────────────────────────── */
  const YT_API_KEY        = 'AIzaSyAEruwkr9u1CN0OECR6onqY1Z3vW-LsvCE';
  const DATA_URL          = '/chronicles-fm/data.json';
  const PLAYER_ID         = 'cfm-yt-player';
  const SCROLL_SPEED_PX   = 55;
  const SCROLL_SEP        = '  ⬡  ';
  const AMBIENT_INTERVAL  = 50000;
  const NIGHT_START       = 0;
  const NIGHT_END         = 6;

  /* ─── STATE ──────────────────────────────────────────────────────── */
  let frequencies    = [];
  let currentFreqIdx = 0;
  let ytPlayer       = null;
  let shuffledQueue  = [];
  let queuePos       = 0;
  let isPlaying      = false;
  let ytApiReady     = false;
  let drawerOpen     = false;
  let nightMode      = false;
  let ambientTimer   = null;
  let lemePanelTimer = null;
  let scrollerRAF    = null;
  let scrollerX      = 0;
  let scrollerW      = 0;
  let scrollerLast   = 0;
  let scrollerPaused = false;
  let scrollerTrack  = null;

  /* ─── NIGHT MODE ─────────────────────────────────────────────────── */
  function detectNight() {
    const h = new Date().getHours();
    return h >= NIGHT_START && h < NIGHT_END;
  }

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

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function pickPhrase(type) {
    if (nightMode) return pickRandom(NIGHT_PHRASES);
    if (type === 'intro') return pickRandom(INTRO_PHRASES);
    return pickRandom(AMBIENT_PHRASES);
  }

  /* ─── TYPEWRITER ─────────────────────────────────────────────────── */
  function typewriter(el, text, speed, onDone) {
    if (!el) return;
    speed = speed || 28;
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cfm-lp-cursor';
    cursor.textContent = '\u258c';
    let i = 0;
    function tick() {
      if (i < text.length) {
        el.textContent = text.slice(0, ++i);
        el.appendChild(cursor);
        setTimeout(tick, speed);
      } else {
        if (onDone) onDone();
      }
    }
    tick();
  }

  /* ─── LEME PANEL ─────────────────────────────────────────────────── */
  function showLemePanel(phrase, freqLabel) {
    const panel  = document.getElementById('cfm-leme-panel');
    const lpText = document.getElementById('cfm-lp-text');
    const lpFoot = document.getElementById('cfm-lp-footer');
    if (!panel || !lpText) return;
    if (lpFoot) lpFoot.textContent = freqLabel || (frequencies[currentFreqIdx] && frequencies[currentFreqIdx].title) || '\u2014';
    panel.classList.add('visible');
    typewriter(lpText, phrase, 28);
    clearTimeout(lemePanelTimer);
    lemePanelTimer = setTimeout(function () {
      panel.classList.remove('visible');
    }, phrase.length * 28 + 4000);
  }

  /* ─── SCROLLER ───────────────────────────────────────────────────── */
  function scrollerAnimate() {
    var now = performance.now();
    var dt  = (now - scrollerLast) / 1000;
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
        sep.className = 'cfm-ticker-sep';
        sep.textContent = SCROLL_SEP;
        track.appendChild(sep);
        var el = document.createElement('span');
        el.className = 'cfm-ticker-item';
        el.dataset.type = seg.type;
        el.textContent = seg.text;
        if (seg.type === 'yt' && seg.videoId) {
          (function (vid) {
            el.addEventListener('click', function () {
              window.open('https://www.youtube.com/watch?v=' + vid, '_blank', 'noopener');
            });
          })(seg.videoId);
        }
        track.appendChild(el);
      });
    }
    wrap.appendChild(track);
    scrollerTrack = track;
    scrollerLast  = performance.now();
    requestAnimationFrame(function () {
      scrollerW = track.scrollWidth / 2;
      scrollerAnimate();
    });
  }

  function updateTickerSegment(type, text) {
    if (!scrollerTrack) return;
    scrollerTrack.querySelectorAll('.cfm-ticker-item[data-type="' + type + '"]').forEach(function (el) {
      el.textContent = text;
    });
  }

  function buildSegments(freq, lemePhrase, ytItems) {
    var segs = [];
    segs.push({ type: 'freq',   text: freq.title });
    if (freq.style) segs.push({ type: 'style', text: freq.style.toUpperCase() });
    if (freq.mood)  segs.push({ type: 'mood',  text: freq.mood });
    if (nightMode)  segs.push({ type: 'night', text: pickRandom(NIGHT_PHRASES) });
    segs.push({ type: 'leme',   text: lemePhrase });
    segs.push({ type: 'signal', text: 'BZH CHRONICLES RADIO · ON AIR' });
    if (freq.tags && freq.tags.length) {
      segs.push({ type: 'signal', text: freq.tags.map(function (t) { return t.toUpperCase(); }).join(' · ') });
    }
    if (ytItems && ytItems.length) {
      var sample = ytItems.slice().sort(function () { return Math.random() - .5; }).slice(0, 8);
      sample.forEach(function (item) {
        segs.push({ type: 'yt', text: item.title, videoId: item.videoId });
      });
    }
    return segs;
  }

  /* ─── FISHER-YATES SHUFFLE ───────────────────────────────────────── */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ─── YT PLAYLIST IDS ────────────────────────────────────────────── */
  async function fetchPlaylistVideoIds(playlistId) {
    var videoIds = [];
    var pageToken = '';
    try {
      do {
        var url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=' + playlistId + '&key=' + YT_API_KEY + (pageToken ? '&pageToken=' + pageToken : '');
        var res  = await fetch(url);
        var data = await res.json();
        if (data.items) {
          data.items.forEach(function (item) {
            var id = item.contentDetails && item.contentDetails.videoId;
            if (id) videoIds.push(id);
          });
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);
    } catch (e) {
      console.warn('[CFM] fetchPlaylist error:', e);
    }
    return videoIds;
  }

  /* Fetch titres + ids pour le ticker yt */
  async function fetchPlaylistItems(playlistId) {
    var items = [];
    var pageToken = '';
    try {
      do {
        var url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=' + playlistId + '&key=' + YT_API_KEY + (pageToken ? '&pageToken=' + pageToken : '');
        var res  = await fetch(url);
        var data = await res.json();
        if (data.items) {
          data.items.forEach(function (item) {
            var title   = item.snippet && item.snippet.title;
            var videoId = item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId;
            if (title && videoId) items.push({ title: title, videoId: videoId });
          });
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);
    } catch (e) { /**/ }
    return items;
  }

  /* ─── BUILD QUEUE ────────────────────────────────────────────────── */
  async function buildQueue(freqIdx) {
    var freq = frequencies[freqIdx];
    if (!freq || !freq.youtubePlaylistId) return;
    var ids = await fetchPlaylistVideoIds(freq.youtubePlaylistId);
    shuffledQueue = ids.length ? shuffle(ids) : [];
    queuePos = 0;
  }

  /* ─── PLAY ───────────────────────────────────────────────────────── */
  function playNext() {
    if (!shuffledQueue.length) return;
    if (queuePos >= shuffledQueue.length) {
      shuffledQueue = shuffle(shuffledQueue);
      queuePos = 0;
    }
    var videoId = shuffledQueue[queuePos++];
    if (ytPlayer && ytApiReady) ytPlayer.loadVideoById(videoId);
  }

  function onPlayerStateChange(event) {
    if (event.data === 0) playNext(); // ENDED
  }

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
        onReady: function () { ytApiReady = true; },
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

  /* ─── SWITCH FREQ ────────────────────────────────────────────────── */
  async function switchFreq(idx) {
    currentFreqIdx = idx;
    updateFreqDisplay();
    updateDrawerActive();
    var freq   = frequencies[idx];
    var phrase = pickPhrase('ambient');
    // Ticker de base immédiat
    setTickerSegments(buildSegments(freq, phrase, []));
    showLemePanel(phrase, freq.title);
    // Puis enrichit avec les titres YT
    if (freq.youtubePlaylistId) {
      var items = await fetchPlaylistItems(freq.youtubePlaylistId);
      setTickerSegments(buildSegments(freq, phrase, items));
    }
    if (isPlaying) {
      if (ytPlayer && ytApiReady) ytPlayer.stopVideo();
      await buildQueue(idx);
      playNext();
    } else {
      await buildQueue(idx);
    }
    // Ambient timer
    clearInterval(ambientTimer);
    ambientTimer = setInterval(function () {
      var l = pickPhrase('ambient');
      showLemePanel(l, freq.title);
      updateTickerSegment('leme', l);
    }, AMBIENT_INTERVAL);
  }

  /* ─── PLAY / SKIP ────────────────────────────────────────────────── */
  async function togglePlay() {
    if (!isPlaying) {
      if (!shuffledQueue.length) await buildQueue(currentFreqIdx);
      isPlaying = true;
      updatePlayBtn();
      playNext();
    } else {
      isPlaying = false;
      updatePlayBtn();
      if (ytPlayer && ytApiReady) ytPlayer.pauseVideo();
    }
  }

  async function skip() {
    if (!isPlaying) return;
    if (!shuffledQueue.length) await buildQueue(currentFreqIdx);
    playNext();
  }

  /* ─── UI HELPERS ─────────────────────────────────────────────────── */
  function updatePlayBtn() {
    var btn = document.getElementById('cfm-play-btn');
    if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
  }

  function updateFreqDisplay() {
    var freq = frequencies[currentFreqIdx];
    if (!freq) return;
    var num = document.getElementById('cfm-freq-num');
    if (num) num.textContent = freq.subtitle || ('Frequence ' + (currentFreqIdx + 1));
    var wStyle = document.getElementById('cfm-w-style');
    if (wStyle) wStyle.textContent = freq.style || '';
  }

  function updateDrawerActive() {
    document.querySelectorAll('.cfm-freq-item').forEach(function (el, i) {
      el.classList.toggle('active', i === currentFreqIdx);
    });
  }

  function toggleDrawer() {
    drawerOpen = !drawerOpen;
    var drawer = document.getElementById('cfm-drawer');
    if (drawer) drawer.classList.toggle('open', drawerOpen);
    var btn = document.getElementById('cfm-freq-btn');
    if (btn) btn.textContent = drawerOpen ? '▼ REPLIER' : '▶ OUVRIR';
  }

  /* ─── BUILD DRAWER ───────────────────────────────────────────────── */
  function buildDrawer() {
    var list = document.getElementById('cfm-freq-list');
    if (!list) return;
    list.innerHTML = '';
    frequencies.forEach(function (freq, i) {
      var item = document.createElement('div');
      item.className = 'cfm-freq-item' + (i === currentFreqIdx ? ' active' : '');
      item.innerHTML =
        '<span class="cfm-freq-title">' + freq.title + '</span>' +
        '<span class="cfm-freq-sub">'   + (freq.style || '') + '</span>' +
        '<span class="cfm-freq-mood">'  + (freq.mood  || '') + '</span>';
      item.addEventListener('click', function () { switchFreq(i); if (drawerOpen) toggleDrawer(); });
      list.appendChild(item);
    });
  }

  /* ─── CSS ────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('cfm-styles')) return;
    var style = document.createElement('style');
    style.id = 'cfm-styles';
    style.textContent = [
      ':root{',
      '  --cfm-bg:#08101a;--cfm-border:#1a2840;--cfm-red:#e94560;--cfm-blue:#00d4ff;',
      '  --cfm-purple:#8b5cf6;--cfm-green:#00ff9d;--cfm-amber:#f59e0b;',
      '  --cfm-yellow:#fde68a;--cfm-text:#c8d8e8;--cfm-dim:#4a6a8a;',
      '  --cfm-mono:\'Share Tech Mono\',monospace;--cfm-h:40px;',
      '}',
      'body.cfm-night{',
      '  --cfm-bg:#04080f;--cfm-border:#150d25;--cfm-red:#7a1530;--cfm-blue:#5512a8;',
      '  --cfm-purple:#6d28d9;--cfm-green:#00cc5a;--cfm-text:#8899aa;--cfm-dim:#2a3a4a;',
      '}',
      /* ── BAR ── */
      '#cfm-bar{position:fixed;bottom:0;left:0;right:0;z-index:9000;height:var(--cfm-h);',
      'background:rgba(6,12,22,.98);border-top:1px solid var(--cfm-border);',
      'display:flex;align-items:stretch;font-family:var(--cfm-mono);font-size:.68rem;',
      'letter-spacing:.08em;box-shadow:0 -4px 32px rgba(0,0,0,.7);}',
      'body{padding-bottom:var(--cfm-h)!important;}',
      /* dot */
      '.cfm-dot{width:7px;height:7px;border-radius:50%;background:var(--cfm-red);',
      'box-shadow:0 0 6px var(--cfm-red);flex-shrink:0;animation:cfm-pulse 1.4s ease-in-out infinite;}',
      '@keyframes cfm-pulse{0%,100%{opacity:1}50%{opacity:.3}}',
      /* slots */
      '.cfm-slot{display:flex;align-items:center;padding:0 .7rem;gap:.5rem;',
      'border-right:1px solid var(--cfm-border);flex-shrink:0;}',
      '.cfm-brand-label{color:var(--cfm-red);font-size:.66rem;letter-spacing:.22em;',
      'text-shadow:0 0 8px rgba(233,69,96,.5);}',
      '#cfm-freq-num{color:var(--cfm-text);font-size:.68rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;}',
      '#cfm-w-style{color:var(--cfm-blue);font-size:.58rem;letter-spacing:.12em;white-space:nowrap;opacity:.8;}',
      /* ticker */
      '#cfm-ticker-slot{flex:1;min-width:0;overflow:hidden;display:flex;align-items:center;',
      'position:relative;border-right:1px solid var(--cfm-border);}',
      '.cfm-ticker-label{flex-shrink:0;padding:0 .5rem;color:var(--cfm-purple);font-size:.56rem;',
      'letter-spacing:.18em;opacity:.7;border-right:1px solid var(--cfm-border);height:100%;display:flex;align-items:center;}',
      '#cfm-ticker-wrap{flex:1;min-width:0;overflow:hidden;height:100%;position:relative;}',
      '#cfm-ticker-wrap::before{content:\'\';position:absolute;top:0;bottom:0;left:0;width:24px;z-index:2;',
      'background:linear-gradient(to right,rgba(6,12,22,1),transparent);pointer-events:none;}',
      '#cfm-ticker-wrap::after{content:\'\';position:absolute;top:0;bottom:0;right:0;width:24px;z-index:2;',
      'background:linear-gradient(to left,rgba(6,12,22,1),transparent);pointer-events:none;}',
      '.cfm-ticker-scroll{display:inline-flex;align-items:center;white-space:nowrap;height:100%;will-change:transform;}',
      '.cfm-ticker-item{padding:0 .2rem;line-height:var(--cfm-h);cursor:default;}',
      '.cfm-ticker-item[data-type=freq]  {color:var(--cfm-text);}',
      '.cfm-ticker-item[data-type=style] {color:var(--cfm-blue);letter-spacing:.12em;}',
      '.cfm-ticker-item[data-type=mood]  {color:var(--cfm-amber);font-style:italic;}',
      '.cfm-ticker-item[data-type=leme]  {color:var(--cfm-purple);font-style:italic;}',
      '.cfm-ticker-item[data-type=signal]{color:var(--cfm-dim);font-size:.62rem;letter-spacing:.1em;}',
      '.cfm-ticker-item[data-type=yt]    {color:var(--cfm-yellow);cursor:pointer;}',
      '.cfm-ticker-item[data-type=yt]:hover{text-decoration:underline;text-underline-offset:3px;}',
      '.cfm-ticker-item[data-type=night] {color:#6d28d9;font-style:italic;text-shadow:0 0 6px rgba(109,40,217,.6);}',
      '.cfm-ticker-sep{color:var(--cfm-dim);opacity:.35;padding:0 .2rem;}',
      '.cfm-ticker-item[data-type=leme]::before  {content:\'\u25c8 \';opacity:.6;}',
      '.cfm-ticker-item[data-type=signal]::before{content:\'\u2b21 \';opacity:.5;}',
      '.cfm-ticker-item[data-type=yt]::before    {content:\'\u25b6 NOW \u00b7 \';color:var(--cfm-red);font-size:.6rem;opacity:.8;}',
      '.cfm-ticker-item[data-type=night]::before {content:\'\ud83c\udf19 \';}',
      /* actions */
      '.cfm-slot-actions{display:flex;align-items:center;padding:0 .5rem;gap:.4rem;flex-shrink:0;}',
      '.cfm-act-btn{padding:.2rem .5rem;border:1px solid var(--cfm-border);background:none;',
      'color:var(--cfm-dim);cursor:pointer;font-family:var(--cfm-mono);font-size:.6rem;',
      'letter-spacing:.1em;border-radius:2px;transition:all .15s;display:inline-flex;',
      'align-items:center;white-space:nowrap;height:24px;}',
      '.cfm-act-btn:hover{border-color:var(--cfm-blue);color:var(--cfm-blue);}',
      '.cfm-act-btn.primary{border-color:var(--cfm-purple);color:var(--cfm-purple);}',
      '.cfm-act-btn.primary:hover{box-shadow:0 0 8px rgba(139,92,246,.3);}',
      /* drawer */
      '#cfm-drawer{position:fixed;bottom:var(--cfm-h);left:0;right:0;z-index:8999;',
      'background:rgba(8,13,22,.98);border-top:1px solid var(--cfm-purple);',
      'box-shadow:0 -8px 40px rgba(139,92,246,.15);max-height:0;overflow:hidden;',
      'transition:max-height .35s cubic-bezier(.4,0,.2,1);}',
      '#cfm-drawer.open{max-height:320px;overflow-y:auto;}',
      '.cfm-freq-item{padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--cfm-border);transition:background .12s;}',
      '.cfm-freq-item:hover,.cfm-freq-item.active{background:rgba(139,92,246,.07);}',
      '.cfm-freq-item.active .cfm-freq-title{color:var(--cfm-blue);}',
      '.cfm-freq-title{display:block;font-size:.76rem;font-weight:bold;color:var(--cfm-text);}',
      '.cfm-freq-sub  {display:block;font-size:.64rem;color:var(--cfm-blue);opacity:.7;}',
      '.cfm-freq-mood {display:block;font-size:.6rem;color:var(--cfm-dim);font-style:italic;}',
      /* leme panel */
      '#cfm-leme-panel{position:fixed;bottom:calc(var(--cfm-h) + 12px);right:16px;z-index:8998;',
      'width:280px;background:rgba(4,8,15,.97);border:1px solid var(--cfm-purple);',
      'border-radius:4px;overflow:hidden;',
      'box-shadow:0 0 24px rgba(139,92,246,.25),inset 0 0 40px rgba(0,0,0,.4);',
      'pointer-events:none;opacity:0;transform:translateY(8px);',
      'transition:opacity .4s ease,transform .4s ease;}',
      '#cfm-leme-panel.visible{opacity:1;transform:translateY(0);pointer-events:auto;}',
      '#cfm-leme-panel::before{content:\'\';position:absolute;inset:0;pointer-events:none;z-index:2;',
      'background:repeating-linear-gradient(to bottom,transparent 0px,transparent 3px,rgba(0,0,0,.18) 3px,rgba(0,0,0,.18) 4px);',
      'animation:cfm-scanline 8s linear infinite;}',
      '@keyframes cfm-scanline{0%{background-position:0 0}100%{background-position:0 80px}}',
      '.cfm-lp-header{display:flex;align-items:center;gap:.4rem;padding:.35rem .6rem;',
      'background:rgba(139,92,246,.12);border-bottom:1px solid rgba(139,92,246,.25);position:relative;z-index:3;}',
      '.cfm-lp-avatar{font-size:.9rem;filter:drop-shadow(0 0 4px rgba(139,92,246,.7));}',
      '.cfm-lp-name{font-size:.55rem;letter-spacing:.22em;color:var(--cfm-purple);',
      'text-shadow:0 0 6px rgba(139,92,246,.5);flex:1;}',
      '.cfm-lp-signal{width:6px;height:6px;border-radius:50%;background:var(--cfm-green);',
      'box-shadow:0 0 5px var(--cfm-green);animation:cfm-pulse 1.2s ease-in-out infinite;flex-shrink:0;}',
      '.cfm-lp-body{padding:.55rem .65rem .6rem;min-height:3.4rem;position:relative;z-index:3;}',
      '.cfm-lp-text{font-size:.72rem;color:var(--cfm-text);line-height:1.55;font-style:italic;',
      'letter-spacing:.03em;word-break:break-word;}',
      '.cfm-lp-cursor{display:inline-block;color:var(--cfm-purple);font-style:normal;',
      'animation:cfm-blink .7s step-end infinite;text-shadow:0 0 6px rgba(139,92,246,.8);',
      'margin-left:1px;font-size:.8rem;vertical-align:text-bottom;}',
      '@keyframes cfm-blink{0%,100%{opacity:1}50%{opacity:0}}',
      '.cfm-lp-footer{padding:.2rem .6rem;border-top:1px solid rgba(139,92,246,.12);',
      'font-size:.52rem;letter-spacing:.14em;color:var(--cfm-dim);position:relative;z-index:3;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.cfm-lp-footer::before{content:\'\u2b21 \';opacity:.5;}',
      /* responsive */
      '@media(max-width:480px){#cfm-freq-num,#cfm-w-style,.cfm-brand-label{display:none;}',
      '#cfm-leme-panel{width:220px;right:8px;}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ─── BUILD WIDGET DOM ───────────────────────────────────────────── */
  function buildWidget() {
    if (document.getElementById('cfm-bar')) return;

    // Barre
    var bar = document.createElement('div');
    bar.id = 'cfm-bar';
    bar.innerHTML =
      '<div class="cfm-slot" style="cursor:pointer" id="cfm-brand">'+
        '<span class="cfm-dot"></span>'+
        '<span class="cfm-brand-label">CHRONICLES FM</span>'+
      '</div>'+
      '<div class="cfm-slot-actions" style="border-right:1px solid var(--cfm-border)">'+
        '<button class="cfm-act-btn" id="cfm-play-btn" title="Play/Pause">\u25b6</button>'+
        '<button class="cfm-act-btn" id="cfm-skip-btn" title="Skip">\u23ed</button>'+
        '<button class="cfm-act-btn" id="cfm-prev-btn" title="Freq -">\u25c0</button>'+
        '<button class="cfm-act-btn" id="cfm-next-btn" title="Freq +">\u25b6</button>'+
      '</div>'+
      '<div class="cfm-slot" style="flex-direction:column;align-items:flex-start;min-width:0;max-width:170px;">'+
        '<span id="cfm-freq-num">—</span>'+
        '<span id="cfm-w-style"></span>'+
      '</div>'+
      '<div id="cfm-ticker-slot">'+
        '<span class="cfm-ticker-label">LEMEGETON</span>'+
        '<div id="cfm-ticker-wrap"></div>'+
      '</div>'+
      '<div class="cfm-slot-actions">'+
        '<button class="cfm-act-btn primary" id="cfm-freq-btn">\u25b6 OUVRIR</button>'+
        '<button class="cfm-act-btn" id="cfm-night-btn" title="Mode nuit">\ud83c\udf19</button>'+
      '</div>';
    document.body.appendChild(bar);

    // Drawer
    var drawer = document.createElement('div');
    drawer.id = 'cfm-drawer';
    drawer.innerHTML = '<div id="cfm-freq-list"></div>';
    document.body.appendChild(drawer);

    // LemePanel
    var panel = document.createElement('div');
    panel.id = 'cfm-leme-panel';
    panel.innerHTML =
      '<div class="cfm-lp-header">'+
        '<span class="cfm-lp-avatar">\ud83d\udc7e</span>'+
        '<span class="cfm-lp-name">LEMEGETON \u00b7 CHRONIC\u0152UR</span>'+
        '<span class="cfm-lp-signal"></span>'+
      '</div>'+
      '<div class="cfm-lp-body"><div class="cfm-lp-text" id="cfm-lp-text"></div></div>'+
      '<div class="cfm-lp-footer" id="cfm-lp-footer">\u2014</div>';
    document.body.appendChild(panel);

    // Events
    document.getElementById('cfm-play-btn').addEventListener('click', togglePlay);
    document.getElementById('cfm-skip-btn').addEventListener('click', skip);
    document.getElementById('cfm-prev-btn').addEventListener('click', function () {
      switchFreq((currentFreqIdx - 1 + frequencies.length) % frequencies.length);
    });
    document.getElementById('cfm-next-btn').addEventListener('click', function () {
      switchFreq((currentFreqIdx + 1) % frequencies.length);
    });
    document.getElementById('cfm-freq-btn').addEventListener('click', toggleDrawer);
    document.getElementById('cfm-brand').addEventListener('click', toggleDrawer);
    document.getElementById('cfm-night-btn').addEventListener('click', function () {
      nightMode = !nightMode;
      document.body.classList.toggle('cfm-night', nightMode);
      document.getElementById('cfm-night-btn').textContent = nightMode ? '\u2600' : '\ud83c\udf19';
    });

    // Keyboard
    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); switchFreq((currentFreqIdx - 1 + frequencies.length) % frequencies.length); }
      if (e.key === 'ArrowRight') { e.preventDefault(); switchFreq((currentFreqIdx + 1) % frequencies.length); }
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay(); }
    });
  }

  /* ─── INIT ───────────────────────────────────────────────────────── */
  async function init() {
    try {
      var res = await fetch(DATA_URL);
      frequencies = await res.json();
    } catch (e) {
      console.warn('[CFM] data.json load error:', e);
      return;
    }
    if (!frequencies.length) return;

    nightMode = detectNight();
    injectCSS();
    buildWidget();
    if (nightMode) document.body.classList.add('cfm-night');
    buildDrawer();
    loadYTApi();

    // Charge la première fréquence
    await switchFreq(0);

    // Phrase d'intro Lemegeton
    setTimeout(function () {
      var freq = frequencies[0];
      var intro = pickPhrase('intro');
      showLemePanel(intro, freq.title);
      updateTickerSegment('leme', intro);
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
