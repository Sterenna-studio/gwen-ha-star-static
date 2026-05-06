let RECORDS = [];
const shelf = document.getElementById('shelf');
const titleTicker = document.getElementById('titleTicker');
const extractedSlot = document.getElementById('extractedSlot');
const dropZone = document.getElementById('dropZone');

const player = document.getElementById('player');
const deckVinyl = document.getElementById('deckVinyl');
const deckArt = document.getElementById('deckArt');

const nowPlaying = document.getElementById('nowPlaying');

const playPause = document.getElementById('playPause');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const vol = document.getElementById('vol');

const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');

const toSteam = document.getElementById('toSteam');
const toCyber = document.getElementById('toCyber');
const morph = document.getElementById('themeMorph');

const crank = document.getElementById('crank');
const crankFill = document.getElementById('crankFill');
const crankHint = document.getElementById('crankHint');

let current = -1;
let activeCard = null;
let dragFollow = null;
let crankCount = 0;
const CRANK_MAX = 5;

let tickerTimer = null;   // pour limiter le glitch

async function loadRecords() {
  try {
    const res = await fetch('records.json?_=' + Date.now());
    const data = await res.json();
    RECORDS = Array.isArray(data) ? data.filter(r => r.display !== false) : [];
  } catch (e) {
    RECORDS = [];
  }
}

function applyToDeck(rec) {
  const c1 = rec.coverColor || '#14161a';
  const c2 = rec.labelColor || '#050608';
  deckVinyl.style.setProperty('--disc1', c1);
  deckVinyl.style.setProperty('--disc2', c2);
  deckVinyl.className = 'vinyl on-deck';
  if (rec.vinylStyle) deckVinyl.classList.add(rec.vinylStyle);
  if (rec.coverImage) {
    deckArt.style.backgroundImage = `url('${rec.coverImage}')`;
  } else {
    deckArt.style.backgroundImage = 'none';
  }
}

function buildIsoShelf() {
  shelf.innerHTML = '';
  const baseX = 0;
  const stepX = 46;
  const stepZ = -46;
  RECORDS.forEach((rec, i) => {
    const card = document.createElement('div');
    card.className = 'vinyl-card';
    card.style.transform = `rotateY(-30deg) translateZ(${stepZ * i}px) translateX(${baseX + stepX * i}px)`;
    card.style.zIndex = String(10 + i);
    card.dataset.index = i;

    const img = document.createElement('img');
    img.src = rec.coverImage ? rec.coverImage : 'img/placeholder.png';
    card.appendChild(img);

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      focusCard(i);
      showExtracted(rec);
    });

    shelf.appendChild(card);
  });
}

function focusCard(index) {
  const cards = shelf.querySelectorAll('.vinyl-card');
  cards.forEach(c => c.classList.remove('active'));
  const card = [...cards].find(c => Number(c.dataset.index) === index);
  if (card) {
    card.classList.add('active');
    activeCard = index;
    showTitleTicker(RECORDS[index]);
  }
}

/* GLITCH 2 sec max */
function showTitleTicker(rec) {
  const name = `${rec.artist || 'Unknown'} — ${rec.title || '(sans titre)'}`;
  if (tickerTimer) {
    clearTimeout(tickerTimer);
    tickerTimer = null;
  }
  if (document.body.classList.contains('theme-cyber')) {
    titleTicker.classList.remove('steam');
    // glitch d’abord
    titleTicker.innerHTML = `<span class="glitch">${glitchify(name)}</span>`;
    // puis propre au bout de 2s
    tickerTimer = setTimeout(()=>{
      titleTicker.textContent = name;
      tickerTimer = null;
    }, 3000);
  } else {
    titleTicker.classList.add('steam');
    // petite transition façon "éphéméride"
    titleTicker.textContent = '…';
    tickerTimer = setTimeout(()=>{
      titleTicker.textContent = name;
      tickerTimer = null;
    }, 800);
  }
}

function glitchify(str) {
  const chars = '▌█▓▒░01ØΞ';
  return str.split('').map(ch => (Math.random() < 0.2 ? chars[Math.floor(Math.random()*chars.length)] : ch)).join('');
}

// taille du plateau → pour caler la pochette et le vinyle extrait
function getPlatterSize() {
  const rect = dropZone.getBoundingClientRect();
  return Math.floor(rect.width); // carré
}

// zone extraite
function showExtracted(rec) {
  extractedSlot.innerHTML = '';

  const size = getPlatterSize();

  const cover = document.createElement('div');
  cover.className = 'extracted-cover';
  cover.style.width = size + 'px';
  cover.style.height = size + 'px';
  cover.style.backgroundImage = rec.coverImage ? `url('${rec.coverImage}')` : 'none';

  const vinyl = document.createElement('div');
  vinyl.className = 'extracted-vinyl';
  vinyl.style.width = (size * 0.95) + 'px';
  vinyl.style.height = (size * 0.95) + 'px';
  vinyl.style.left = (size * 0.5) + 'px'; // derrière de moitié
  vinyl.style.setProperty('--disc1', rec.coverColor || '#14161a');
  vinyl.style.setProperty('--disc2', rec.labelColor || '#050608');
  if (rec.vinylStyle) vinyl.classList.add(rec.vinylStyle);

  const art = document.createElement('div');
  art.className = 'ex-art';
  art.style.backgroundImage = rec.coverImage ? `url('${rec.coverImage}')` : 'none';
  vinyl.appendChild(art);

  extractedSlot.appendChild(cover);
  extractedSlot.appendChild(vinyl);

  vinyl.addEventListener('mousedown', (e)=>{
    startRealDrag(e, rec, size);
  });
}

function startRealDrag(e, rec, size) {
  e.preventDefault();
  if (!dragFollow) {
    dragFollow = document.createElement('div');
    dragFollow.className = 'drag-follow';
    document.body.appendChild(dragFollow);
  }
  dragFollow.className = 'drag-follow vinyl on-deck';
  dragFollow.style.width = size + 'px';
  dragFollow.style.height = size + 'px';
  dragFollow.style.setProperty('--disc1', rec.coverColor || '#14161a');
  dragFollow.style.setProperty('--disc2', rec.labelColor || '#050608');
  if (rec.vinylStyle) dragFollow.classList.add(rec.vinylStyle);

  // artwork au centre
  let art = dragFollow.querySelector('.ex-art');
  if (!art) {
    art = document.createElement('div');
    art.className = 'ex-art';
    dragFollow.appendChild(art);
  }
  art.style.backgroundImage = rec.coverImage ? `url('${rec.coverImage}')` : 'none';

  const move = (ev)=>{
    dragFollow.style.top = ev.clientY + 'px';
    dragFollow.style.left = ev.clientX + 'px';
  };
  const up = (ev)=>{
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    dragFollow.style.top = '-9999px';
    const rect = dropZone.getBoundingClientRect();
    if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
      cueVinyl(rec);
    }
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

// drop natif
['dragenter','dragover'].forEach(evt=>{
  dropZone.addEventListener(evt, (e)=>{
    e.preventDefault();
    dropZone.classList.add('dragging');
  });
});
['dragleave','drop'].forEach(evt=>{
  dropZone.addEventListener(evt, (e)=>{
    if(evt !== 'drop') dropZone.classList.remove('dragging');
  });
});
dropZone.addEventListener('drop', (e)=>{
  e.preventDefault();
  dropZone.classList.remove('dragging');
  const idx = parseInt(e.dataTransfer.getData('text/plain'),10);
  if(!Number.isNaN(idx) && RECORDS[idx]) cueVinyl(RECORDS[idx]);
});

function cueVinyl(rec) {
  applyToDeck(rec);
  playPause.disabled = false;
  nowPlaying.textContent = `${rec.artist || 'Unknown'} — ${rec.title || '(sans titre)'}`;
  player.src = rec.src;
  player.pause();
  deckVinyl.classList.remove('spin');

  // reset manivelle
  crankCount = 0;
  crankFill.style.width = '0%';
  crankHint.textContent = '0/5';

  const idx = RECORDS.findIndex(r => r.id === rec.id);
  if (idx >= 0) {
    current = idx;
    focusCard(idx);
    showExtracted(rec);
    showTitleTicker(rec);
  }
}

// MANIVELLE
crank.addEventListener('click', ()=>{
  if (!player.src) return;
  if (crankCount < CRANK_MAX) {
    crankCount++;
    const pct = (crankCount / CRANK_MAX) * 100;
    crankFill.style.width = pct + '%';
    crankHint.textContent = crankCount + '/' + CRANK_MAX;
    if (crankCount >= CRANK_MAX) {
      startPlayback();
    }
  }
});

function startPlayback() {
  if (!player.src) return;
  player.play().catch(()=>{});
  deckVinyl.classList.add('spin');
  nowPlaying.textContent = nowPlaying.textContent.replace('Disque chargé : ','▶ ');
  playPause.textContent = '⏸️ Pause';
}
function stopPlayback() {
  player.pause();
  deckVinyl.classList.remove('spin');
  playPause.textContent = '▶️ Lire';
}

playPause.addEventListener('click', ()=>{
  if (!player.src) return;
  if (player.paused) {
    if (crankCount < CRANK_MAX) return;
    startPlayback();
  } else {
    stopPlayback();
  }
});
prevBtn.addEventListener('click', ()=>{
  if (!RECORDS.length) return;
  const idx = (current - 1 + RECORDS.length) % RECORDS.length;
  cueVinyl(RECORDS[idx]);
});
nextBtn.addEventListener('click', ()=>{
  if (!RECORDS.length) return;
  const idx = (current + 1) % RECORDS.length;
  cueVinyl(RECORDS[idx]);
});
shuffleBtn.addEventListener('click', ()=>{
  if (!RECORDS.length) return;
  const idx = Math.floor(Math.random()*RECORDS.length);
  cueVinyl(RECORDS[idx]);
});

vol.addEventListener('input', ()=> player.volume = +vol.value);

// temps
player.addEventListener('timeupdate', ()=>{
  if (!player.duration || isNaN(player.duration)) return;
  const cur = player.currentTime;
  const dur = player.duration;
  seek.value = (cur / dur) * 100;
  curTime.textContent = formatTime(cur);
  durTime.textContent = formatTime(dur);
});
player.addEventListener('loadedmetadata', ()=>{
  durTime.textContent = formatTime(player.duration || 0);
});
seek.addEventListener('input', ()=>{
  if (!player.duration || isNaN(player.duration)) return;
  const pct = +seek.value / 100;
  player.currentTime = pct * player.duration;
});

function formatTime(sec){
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + (s < 10 ? '0'+s : s);
}

player.addEventListener('ended', ()=>{
  deckVinyl.classList.remove('spin');
  if (RECORDS.length) {
    const idx = (current + 1) % RECORDS.length;
    cueVinyl(RECORDS[idx]);
  }
});

/* THEME SWITCH */
function runMorph(){
  morph.classList.remove('hidden');
  morph.classList.add('run');
  setTimeout(()=>{morph.classList.add('hidden');morph.classList.remove('run');},1400);
}
toSteam.addEventListener('click', ()=>{
  if (!document.body.classList.contains('theme-steam')) runMorph();
  document.body.classList.add('theme-steam');
  document.body.classList.remove('theme-cyber');
  if (current >= 0) showTitleTicker(RECORDS[current]);
});
toCyber.addEventListener('click', ()=>{
  if (!document.body.classList.contains('theme-cyber')) runMorph();
  document.body.classList.add('theme-cyber');
  document.body.classList.remove('theme-steam');
  if (current >= 0) showTitleTicker(RECORDS[current]);
});

(async function init(){
  await loadRecords();
  buildIsoShelf();
  player.volume = +vol.value;
})();
