import { initAuth } from './auth.js';
import { initTheme } from './theme.js';
import { getSession } from './supabase.js';

initTheme();
initAuth();

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

initChroniclesCard();
initTwitchPlayer();
initJukebox();
initChroniclesRadio();
initChroniclesWidgetShortcut();

function initChroniclesCard() {
  getSession().then(session => {
    const desc = $('#chronicles-desc');
    const tag = $('#chronicles-tag');
    if (!session || !desc || !tag) return;
    desc.textContent = 'Tableau de bord membre — CIG, crew, vidéo du jour, activité réseau.';
    tag.textContent = '⬡ MON ESPACE';
  }).catch(() => {});
}

function initTwitchPlayer() {
  const twitchWrap = $('#twitch-wrap');
  const twitchLoad = $('#twitch-load');
  let twitchMounted = twitchWrap?.dataset.twitchMounted === 'true';

  function mountTwitchPlayer() {
    if (!twitchWrap || twitchMounted || twitchWrap.querySelector('iframe')) return;

    twitchMounted = true;
    twitchWrap.dataset.twitchMounted = 'true';

    const parent = encodeURIComponent(window.location.hostname || 'localhost');
    const iframe = document.createElement('iframe');
    iframe.src = `https://player.twitch.tv/?channel=mutenrock&parent=${parent}&muted=true&autoplay=false`;
    iframe.allow = 'fullscreen; picture-in-picture';
    iframe.loading = 'lazy';
    iframe.title = 'Stream Twitch MutenRock';

    twitchWrap.replaceChildren(iframe);
  }

  // Keep Twitch/IVS quiet by default: only load the external player after a direct user action.
  twitchLoad?.addEventListener('click', mountTwitchPlayer, { once: true });
}

function initJukebox() {
  const BASE = 'https://nitro.sterenna.fr/jukebox/';
  const TRACKS = [
    { title: 'BZH SUMMER - BIG BANGER', artist: 'Dr.Spig', src: 'audio/bzh-summer-big-banger-vers-501a.wav', cover: 'img/bzh_summer-df65d.png' },
    { title: 'Credits Song To BZH Empire Rising', artist: 'Dr.Spig', src: 'audio/Credits Song To BZH Empire Rising.mp3', cover: 'img/credits-song-to-bzh-empire-rising-0b953.png' },
    { title: "Jacques_L'Agent Explorateur", artist: 'Dr.Spig', src: "audio/Jacques_L'Agent Explorateur.mp3", cover: 'img/jacques-l-agent-explorateur-6f0d9.webp' },
    { title: 'Rising GODs - BZH CHRONICLES', artist: 'Dr.Spig', src: 'audio/Rising GODs - BZH CHRONICLES.mp3', cover: 'img/rising-gods-bzh-chronicles-8f982.webp' },
  ];

  const trackList = $('#jk-tracks');
  const playBtn = $('#jk-play');
  const cover = $('#jk-cover');
  const station = $('#jk-station');
  const bar = $('#jk-bar');
  const time = $('#jk-time');
  const duration = $('#jk-dur');
  const barBg = $('#jk-bar-bg');
  const volume = $('#jk-vol');

  if (!trackList || !playBtn || !cover || !station || !bar || !time || !duration || !barBg || !volume) return;

  const audio = new Audio();
  audio.volume = 0.7;
  let playing = false;
  let current = 0;

  function fmt(seconds) {
    if (Number.isNaN(seconds)) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
  }

  function loadTrack(index, autoplay = false) {
    current = index;
    const track = TRACKS[index];
    audio.src = BASE + track.src;
    station.textContent = track.title;
    cover.src = BASE + track.cover;
    bar.style.width = '0%';
    time.textContent = '0:00';
    duration.textContent = '—';
    $$('.jk-track').forEach((el, i) => el.classList.toggle('active', i === index));
    if (autoplay) audio.play().catch(() => {});
  }

  TRACKS.forEach((track, index) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `jk-track${index === 0 ? ' active' : ''}`;
    el.innerHTML = `
      <div class="jk-track-thumb"><img src="${BASE + track.cover}" alt="" loading="lazy"/></div>
      <div class="jk-track-info">
        <div class="jk-track-title">${track.title}</div>
        <div class="jk-track-artist">${track.artist}</div>
      </div>
      <div class="jk-track-num">${index + 1}</div>`;
    el.addEventListener('click', () => {
      loadTrack(index, true);
      playing = true;
      playBtn.textContent = '⏸';
    });
    trackList.appendChild(el);
  });

  cover.src = BASE + TRACKS[0].cover;
  playBtn.addEventListener('click', () => {
    if (!playing) {
      if (!audio.src) loadTrack(0, false);
      audio.play().then(() => {
        playing = true;
        playBtn.textContent = '⏸';
      }).catch(() => {});
    } else {
      audio.pause();
      playing = false;
      playBtn.textContent = '▶';
    }
  });

  volume.addEventListener('input', event => { audio.volume = Number(event.target.value); });
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    time.textContent = fmt(audio.currentTime);
    duration.textContent = fmt(audio.duration);
  });
  barBg.addEventListener('click', event => {
    if (!audio.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    audio.currentTime = ((event.clientX - rect.left) / rect.width) * audio.duration;
  });
  audio.addEventListener('ended', () => { loadTrack((current + 1) % TRACKS.length, true); });
  loadTrack(0, false);
}

function initChroniclesRadio() {
  const radioYtSelect = $('#radio-yt-select');
  const radioYtPlay = $('#radio-yt-play');
  const radioYtOpen = $('#radio-yt-open');
  const radioYtFrame = $('#radio-yt-frame');
  const radioYtPlaceholder = $('#radio-yt-placeholder');
  const radioYtSub = $('#radio-yt-sub');
  let radioYtPlaylists = [];

  function escAttr(value) {
    return String(value ?? '').replace(/[&<>"']/g, char =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function ytPlaylistUrl(playlistId, autoplay = false) {
    const url = new URL('https://www.youtube.com/embed/videoseries');
    url.searchParams.set('list', playlistId);
    url.searchParams.set('autoplay', autoplay ? '1' : '0');
    url.searchParams.set('rel', '0');
    url.searchParams.set('modestbranding', '1');
    return url.toString();
  }

  function renderRadioYt(index = 0, autoplay = false) {
    const playlist = radioYtPlaylists[index];
    if (!playlist?.youtubePlaylistId || !radioYtFrame) return;
    if (radioYtSub) radioYtSub.textContent = playlist.subtitle ?? playlist.style ?? 'PLAYLIST YOUTUBE';
    if (radioYtOpen) {
      radioYtOpen.href = `https://youtube.com/playlist?list=${encodeURIComponent(playlist.youtubePlaylistId)}`;
      radioYtOpen.target = '_blank';
      radioYtOpen.rel = 'noopener noreferrer';
    }

    const iframe = document.createElement('iframe');
    iframe.src = ytPlaylistUrl(playlist.youtubePlaylistId, autoplay);
    iframe.title = playlist.title ?? 'Playlist YouTube';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share';
    iframe.loading = 'lazy';
    radioYtFrame.replaceChildren(iframe);
  }

  function initRadioYt(playlists) {
    radioYtPlaylists = playlists.filter(playlist => playlist.youtubePlaylistId);
    if (!radioYtSelect || !radioYtPlaylists.length) {
      if (radioYtSub) radioYtSub.textContent = 'AUCUNE PLAYLIST YOUTUBE';
      return;
    }
    const featuredIdx = Math.max(0, radioYtPlaylists.findIndex(playlist => playlist.featured));
    radioYtSelect.innerHTML = radioYtPlaylists.map((playlist, index) =>
      `<option value="${index}">${escAttr(playlist.subtitle ?? playlist.title)}</option>`).join('');
    radioYtSelect.value = String(featuredIdx);
    renderRadioYt(featuredIdx, false);

    radioYtSelect.addEventListener('change', () => {
      renderRadioYt(parseInt(radioYtSelect.value, 10) || 0, false);
    });
    radioYtPlay?.addEventListener('click', () => {
      renderRadioYt(parseInt(radioYtSelect.value, 10) || 0, true);
    });
    radioYtPlaceholder?.addEventListener('click', () => {
      renderRadioYt(parseInt(radioYtSelect.value, 10) || 0, true);
    });
  }

  function renderCfmPills(playlists) {
    const container = $('#cfm-hub-freq-pills');
    if (!container) return;
    container.innerHTML = '';
    playlists.slice(0, 6).forEach(playlist => {
      const pill = document.createElement('span');
      pill.className = 'cfm-hub-freq-pill';
      pill.textContent = playlist.subtitle ?? playlist.style;
      container.appendChild(pill);
    });
    if (playlists.length > 6) {
      const more = document.createElement('span');
      more.className = 'cfm-hub-freq-pill';
      more.textContent = `+${playlists.length - 6} fréquences`;
      container.appendChild(more);
    }
  }

  fetch('/jukebox/chronicles-fm.json')
    .then(response => response.json())
    .then(playlists => {
      initRadioYt(playlists);
      renderCfmPills(playlists);
    })
    .catch(() => {
      if (radioYtSub) radioYtSub.textContent = 'PLAYLISTS INDISPONIBLES';
    });
}

function initChroniclesWidgetShortcut() {
  $('#cfm-hub-open-widget')?.addEventListener('click', () => {
    const bar = $('#cfm-widget');
    if (bar) {
      bar.classList.add('cfm-visible');
      bar.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  });
}
