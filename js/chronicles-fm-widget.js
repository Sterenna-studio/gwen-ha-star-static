/**
 * Chronicles FM Widget — YouTube IFrame API
 * Sterenna / gwen-ha-star-static
 * Chaque fréquence = une playlist YouTube lue en shuffle (Fisher-Yates).
 * Player YT caché (iframe 1×1px). Premier play déclenché par clic user.
 */

(function () {
  'use strict';

  /* ─── CONFIG ─────────────────────────────────────────────────────────── */
  const YT_API_KEY   = 'AIzaSyAEruwkr9u1CN0OECR6onqY1Z3vW-LsvCE';
  const DATA_URL     = '/chronicles-fm/data.json';
  const PLAYER_ID    = 'cfm-yt-player';

  /* ─── STATE ───────────────────────────────────────────────────────────── */
  let frequencies    = [];
  let currentFreqIdx = 0;
  let ytPlayer       = null;
  let shuffledQueue  = [];
  let queuePos       = 0;
  let isPlaying      = false;
  let ytApiReady     = false;
  let nightMode      = false;
  let drawerOpen     = false;
  let tickerInterval = null;

  /* ─── FISHER-YATES SHUFFLE ───────────────────────────────────────────── */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ─── FETCH PLAYLIST ITEMS ───────────────────────────────────────────── */
  async function fetchPlaylistVideoIds(playlistId) {
    let videoIds = [];
    let pageToken = '';
    try {
      do {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlistId}&key=${YT_API_KEY}${pageToken ? '&pageToken=' + pageToken : ''}`;
        const res  = await fetch(url);
        const data = await res.json();
        if (data.items) {
          data.items.forEach(item => {
            const id = item.contentDetails && item.contentDetails.videoId;
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

  /* ─── BUILD SHUFFLE QUEUE FOR CURRENT FREQ ──────────────────────────── */
  async function buildQueue(freqIdx) {
    const freq = frequencies[freqIdx];
    if (!freq || !freq.youtubePlaylistId) return;
    const ids = await fetchPlaylistVideoIds(freq.youtubePlaylistId);
    shuffledQueue = ids.length ? shuffle(ids) : [];
    queuePos = 0;
  }

  /* ─── PLAY NEXT TRACK ────────────────────────────────────────────────── */
  function playNext() {
    if (!shuffledQueue.length) return;
    if (queuePos >= shuffledQueue.length) {
      shuffledQueue = shuffle(shuffledQueue);
      queuePos = 0;
    }
    const videoId = shuffledQueue[queuePos++];
    if (ytPlayer && ytApiReady) {
      ytPlayer.loadVideoById(videoId);
    }
    updateTickerTrack(videoId);
  }

  /* ─── UPDATE TICKER ──────────────────────────────────────────────────── */
  function updateTickerFreq() {
    const freq = frequencies[currentFreqIdx];
    if (!freq) return;
    const ticker = document.getElementById('cfm-ticker');
    if (ticker) {
      ticker.textContent = `◈ ${freq.title} — ${freq.style} — ${freq.mood}`;
    }
  }

  function updateTickerTrack(videoId) {
    const ticker = document.getElementById('cfm-ticker');
    const freq   = frequencies[currentFreqIdx];
    if (!ticker || !freq) return;
    // Fetch video title async
    fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`)
      .then(r => r.json())
      .then(data => {
        const title = data.items && data.items[0] && data.items[0].snippet && data.items[0].snippet.title;
        if (title) {
          ticker.textContent = `▶ ${title} — ${freq.title}`;
        }
      })
      .catch(() => {});
  }

  /* ─── SWITCH FREQUENCY ───────────────────────────────────────────────── */
  async function switchFreq(idx) {
    currentFreqIdx = idx;
    updateTickerFreq();
    updateDrawerActive();
    if (isPlaying) {
      if (ytPlayer && ytApiReady) ytPlayer.stopVideo();
      await buildQueue(idx);
      playNext();
    } else {
      await buildQueue(idx);
    }
    updateFreqDisplay();
  }

  /* ─── TOGGLE PLAY/PAUSE ──────────────────────────────────────────────── */
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

  /* ─── SKIP ────────────────────────────────────────────────────────────── */
  async function skip() {
    if (!isPlaying) return;
    if (!shuffledQueue.length) await buildQueue(currentFreqIdx);
    playNext();
  }

  /* ─── YT PLAYER STATE CHANGE ─────────────────────────────────────────── */
  function onPlayerStateChange(event) {
    // YT.PlayerState.ENDED = 0
    if (event.data === 0) {
      playNext();
    }
  }

  /* ─── INIT YT PLAYER ─────────────────────────────────────────────────── */
  function initYTPlayer() {
    // Conteneur caché 1x1px (pas display:none → autoplay policy OK)
    let container = document.getElementById(PLAYER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = PLAYER_ID;
      container.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;';
      document.body.appendChild(container);
    }
    ytPlayer = new window.YT.Player(PLAYER_ID, {
      width: '1',
      height: '1',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: function () {
          ytApiReady = true;
        },
        onStateChange: onPlayerStateChange,
        onError: function (e) {
          console.warn('[CFM] YT player error:', e.data);
          // Skip to next on error
          setTimeout(playNext, 1500);
        }
      }
    });
  }

  /* ─── LOAD YT API SCRIPT ─────────────────────────────────────────────── */
  function loadYTApi() {
    if (window.YT && window.YT.Player) {
      initYTPlayer();
      return;
    }
    window.onYouTubeIframeAPIReady = function () {
      initYTPlayer();
    };
    const tag = document.createElement('script');
    tag.src   = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  /* ─── UI HELPERS ──────────────────────────────────────────────────────── */
  function updatePlayBtn() {
    const btn = document.getElementById('cfm-play-btn');
    if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
  }

  function updateFreqDisplay() {
    const freq = frequencies[currentFreqIdx];
    if (!freq) return;
    const num = document.getElementById('cfm-freq-num');
    if (num) num.textContent = freq.subtitle || ('Fréquence ' + (currentFreqIdx + 1));
  }

  function updateDrawerActive() {
    document.querySelectorAll('.cfm-freq-item').forEach((el, i) => {
      el.classList.toggle('active', i === currentFreqIdx);
    });
  }

  function toggleDrawer() {
    drawerOpen = !drawerOpen;
    const drawer = document.getElementById('cfm-drawer');
    if (drawer) drawer.classList.toggle('open', drawerOpen);
  }

  function toggleNight() {
    nightMode = !nightMode;
    document.body.classList.toggle('cfm-night', nightMode);
    const btn = document.getElementById('cfm-night-btn');
    if (btn) btn.textContent = nightMode ? '☀' : '🌙';
  }

  /* ─── BUILD DRAWER ITEMS ──────────────────────────────────────────────── */
  function buildDrawer() {
    const list = document.getElementById('cfm-freq-list');
    if (!list) return;
    list.innerHTML = '';
    frequencies.forEach((freq, i) => {
      const item = document.createElement('div');
      item.className = 'cfm-freq-item' + (i === currentFreqIdx ? ' active' : '');
      item.innerHTML = `
        <span class="cfm-freq-title">${freq.title}</span>
        <span class="cfm-freq-sub">${freq.style}</span>
        <span class="cfm-freq-mood">${freq.mood}</span>
      `;
      item.addEventListener('click', () => {
        switchFreq(i);
        toggleDrawer();
      });
      list.appendChild(item);
    });
  }

  /* ─── BUILD HTML WIDGET ──────────────────────────────────────────────── */
  function buildWidget() {
    // Injecter les styles
    if (!document.getElementById('cfm-styles')) {
      const style = document.createElement('style');
      style.id = 'cfm-styles';
      style.textContent = `
        #cfm-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 48px;
          background: #0e0e12;
          border-top: 1px solid #2a2a3a;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          z-index: 9999;
          font-family: 'Courier New', monospace;
          color: #c8c8e0;
          box-sizing: border-box;
        }
        #cfm-bar button {
          background: none;
          border: 1px solid #3a3a5a;
          color: #c8c8e0;
          cursor: pointer;
          border-radius: 4px;
          padding: 4px 10px;
          font-size: 16px;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        #cfm-bar button:hover { background: #1e1e2e; }
        #cfm-freq-num {
          font-size: 11px;
          color: #7070a0;
          white-space: nowrap;
          flex-shrink: 0;
        }
        #cfm-ticker-wrap {
          flex: 1;
          overflow: hidden;
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
        }
        #cfm-ticker {
          white-space: nowrap;
          font-size: 13px;
          animation: cfm-scroll 28s linear infinite;
          padding-left: 100%;
        }
        #cfm-ticker:hover { animation-play-state: paused; }
        @keyframes cfm-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        #cfm-drawer {
          position: fixed;
          bottom: 48px; left: 0; right: 0;
          background: #0a0a10;
          border-top: 1px solid #2a2a3a;
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
          z-index: 9998;
        }
        #cfm-drawer.open { max-height: 320px; overflow-y: auto; }
        .cfm-freq-item {
          padding: 10px 16px;
          cursor: pointer;
          border-bottom: 1px solid #1a1a2a;
          transition: background 0.12s;
        }
        .cfm-freq-item:hover, .cfm-freq-item.active { background: #1a1a2e; }
        .cfm-freq-item.active .cfm-freq-title { color: #a0a0ff; }
        .cfm-freq-title { display: block; font-size: 13px; font-weight: bold; color: #e0e0f0; }
        .cfm-freq-sub   { display: block; font-size: 11px; color: #7070a0; }
        .cfm-freq-mood  { display: block; font-size: 10px; color: #505070; font-style: italic; }
        body.cfm-night  { filter: brightness(0.6) sepia(0.2); }
        @media (max-width: 480px) {
          #cfm-freq-num { display: none; }
        }
      `;
      document.head.appendChild(style);
    }

    // Barre fixe du bas
    if (!document.getElementById('cfm-bar')) {
      const bar = document.createElement('div');
      bar.id = 'cfm-bar';
      bar.innerHTML = `
        <button id="cfm-play-btn" title="Play / Pause">▶</button>
        <button id="cfm-skip-btn" title="Skip">⏭</button>
        <span id="cfm-freq-num">Fréquence 1</span>
        <div id="cfm-ticker-wrap">
          <span id="cfm-ticker">◈ Chronicles FM — Chargement...</span>
        </div>
        <button id="cfm-freq-btn" title="Fréquences">📡</button>
        <button id="cfm-night-btn" title="Mode nuit">🌙</button>
      `;
      document.body.appendChild(bar);

      // Drawer
      const drawer = document.createElement('div');
      drawer.id = 'cfm-drawer';
      drawer.innerHTML = `<div id="cfm-freq-list"></div>`;
      document.body.appendChild(drawer);

      // Events
      document.getElementById('cfm-play-btn').addEventListener('click', togglePlay);
      document.getElementById('cfm-skip-btn').addEventListener('click', skip);
      document.getElementById('cfm-freq-btn').addEventListener('click', toggleDrawer);
      document.getElementById('cfm-night-btn').addEventListener('click', toggleNight);
    }
  }

  /* ─── INIT ────────────────────────────────────────────────────────────── */
  async function init() {
    try {
      const res  = await fetch(DATA_URL);
      frequencies = await res.json();
    } catch (e) {
      console.warn('[CFM] data.json load error:', e);
      frequencies = [];
      return;
    }

    buildWidget();
    buildDrawer();
    updateTickerFreq();
    updateFreqDisplay();
    loadYTApi();

    // Pré-charger la queue de la fréquence par défaut
    await buildQueue(0);
  }

  // Lance l'init une fois le DOM prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
