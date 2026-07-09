// Sterenna Jukebox 3D (front only) – Three.js + DOM library
const $ = (s)=>document.querySelector(s);

const canvas = $('#scene');
const statusEl = $('#status');
const shelfEl = $('#shelf');
const searchEl = $('#search');

const selCover = $('#selCover');
const selDisk = $('#selDisk');
const selArt = $('#selArt');
const selTitle = $('#selTitle');
const selArtist = $('#selArtist');

const dragFollow = $('#dragFollow');
const dragArt = $('#dragArt');
const dropHint = $('#dropHint');

const player = $('#player');
const screenNow = $('#screenNow');
const meterFill = $('#meterFill');
const tCur = $('#tCur');
const tDur = $('#tDur');
const seek = $('#seek');

const btnPrev = $('#btnPrev');
const btnPlay = $('#btnPlay');
const btnNext = $('#btnNext');
const btnShuffle = $('#btnShuffle');
const vol = $('#vol');

const btnCrank = $('#btnCrank');
const crankFill = $('#crankFill');
const crankTxt = $('#crankTxt');

const btnThemeSteam = $('#btnThemeSteam');
const btnThemeCyber = $('#btnThemeCyber');

let RECORDS = [];
let filtered = [];
let currentIndex = -1;
let selectedIndex = -1;

// crank
let crankCount = 0;
const CRANK_MAX = 5;

// 3D
let renderer, scene, camera;
let jukeboxGroup, recordMesh, screenGlow;
let platterWorld = { x:0, y:0, z:0.20, r:0.18 };
let isRecordOnPlatter = false;
let recordSpin = false;

// drag
let dragging = false;
let dragRec = null;

function setStatus(msg){ statusEl.textContent = msg; }

async function loadJson(url, fallback){
  try{
    const r = await fetch(url + '?_=' + Date.now());
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }catch(e){ return fallback; }
}

async function loadRecords(){
  const data = await loadJson('records.json', []);
  RECORDS = Array.isArray(data) ? data.filter(r => r && r.display !== false) : [];
  filtered = [...RECORDS];
}

function coverUrl(rec){ return rec.coverImage || ''; }

function coverPlaceholder(title){
  const a = (hash(title) % 360);
  const b = (a + 60) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="hsl(${a},70%,45%)"/><stop offset="1" stop-color="hsl(${b},70%,30%)"/>
    </linearGradient></defs>
    <rect width="512" height="512" fill="url(#g)"/>
    <circle cx="256" cy="256" r="170" fill="rgba(0,0,0,.18)"/>
    <text x="24" y="470" fill="rgba(255,255,255,.85)" font-family="monospace" font-size="28">${escapeXml(title).slice(0,18)}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
}

function buildShelf(){
  shelfEl.innerHTML = '';
  filtered.forEach((rec, idx)=>{
    const d = document.createElement('div');
    d.className = 'cover';
    d.dataset.index = String(idx);

    const img = document.createElement('img');
    img.src = coverUrl(rec) || coverPlaceholder(rec.title || rec.id || 'VINYL');
    img.alt = rec.title || 'cover';
    d.appendChild(img);

    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = rec.title || '(sans titre)';
    d.appendChild(cap);

    d.addEventListener('click', ()=> selectByFilteredIndex(idx));
    shelfEl.appendChild(d);
  });
  syncShelfActive();
}

function syncShelfActive(){
  [...shelfEl.querySelectorAll('.cover')].forEach(el=>{
    const idx = parseInt(el.dataset.index,10);
    el.classList.toggle('active', idx === selectedIndex);
  });
}

function applyDiskDomStyle(el, rec){
  el.className = 'sel-disk';
  el.style.setProperty('--disc1', rec.coverColor || '#14161a');
  el.style.setProperty('--disc2', rec.labelColor || '#050608');
  if(rec.vinylStyle) el.classList.add(rec.vinylStyle);
}

function selectByFilteredIndex(fIdx){
  selectedIndex = fIdx;
  const rec = filtered[selectedIndex];
  if(!rec) return;

  const imgSrc = coverUrl(rec) || coverPlaceholder(rec.title || rec.id || 'VINYL');
  selCover.style.backgroundImage = `url('${imgSrc}')`;

  applyDiskDomStyle(selDisk, rec);
  selArt.style.backgroundImage = `url('${imgSrc}')`;

  selTitle.textContent = rec.title || '(sans titre)';
  selArtist.textContent = rec.artist || 'Unknown';
  selDisk.classList.add('revealed');

  dragRec = rec;
  syncShelfActive();
  cueScreen(rec, { justSelected:true });
}

searchEl.addEventListener('input', ()=>{
  const q = (searchEl.value||'').trim().toLowerCase();
  filtered = RECORDS.filter(r=> `${r.title||''} ${r.artist||''}`.toLowerCase().includes(q));
  selectedIndex = -1;
  dragRec = null;
  buildShelf();
  resetSelectedPanel();
});

function resetSelectedPanel(){
  selCover.style.backgroundImage = '';
  selDisk.className = 'sel-disk';
  selDisk.style.setProperty('--disc1', '#14161a');
  selDisk.style.setProperty('--disc2', '#050608');
  selArt.style.backgroundImage = '';
  selTitle.textContent = 'Sélectionne une pochette';
  selArtist.textContent = '—';
}

selDisk.addEventListener('mousedown', (ev)=>{
  if(!dragRec) return;
  dragging = true;

  dragFollow.classList.remove('hidden');
  dragFollow.style.setProperty('--disc1', dragRec.coverColor || '#14161a');
  dragFollow.style.setProperty('--disc2', dragRec.labelColor || '#050608');
  dragFollow.className = 'drag-follow';
  if(dragRec.vinylStyle) dragFollow.classList.add(dragRec.vinylStyle);

  const imgSrc = coverUrl(dragRec) || coverPlaceholder(dragRec.title || dragRec.id || 'VINYL');
  dragArt.style.backgroundImage = `url('${imgSrc}')`;

  dropHint.classList.remove('hidden');
  moveDrag(ev);

  window.addEventListener('mousemove', moveDrag, { passive:false });
  window.addEventListener('mouseup', endDrag, { passive:false });
});

function moveDrag(ev){
  if(!dragging) return;
  ev.preventDefault();
  dragFollow.style.left = ev.clientX+'px';
  dragFollow.style.top = ev.clientY+'px';
}
function endDrag(ev){
  if(!dragging) return;
  dragging = false;

  window.removeEventListener('mousemove', moveDrag);
  window.removeEventListener('mouseup', endDrag);

  dragFollow.classList.add('hidden');
  dropHint.classList.add('hidden');

  if(isOverPlatter(ev.clientX, ev.clientY) && dragRec){
    placeRecordOnPlatter(dragRec);
  }
}

function isOverPlatter(cx, cy){
  const p = projectWorldPoint(platterWorld.x, platterWorld.y, platterWorld.z);
  const r = getPlatterScreenRadius();
  if(!p) return false;
  const dx = cx - p.x, dy = cy - p.y;
  return (dx*dx + dy*dy) <= (r*r);
}
function getPlatterScreenRadius(){
  const rect = canvas.getBoundingClientRect();
  return Math.min(rect.width, rect.height) * 0.11;
}
function projectWorldPoint(x,y,z){
  if(!camera) return null;
  const v = new THREE.Vector3(x,y,z).project(camera);
  const rect = canvas.getBoundingClientRect();
  const sx = (v.x * 0.5 + 0.5) * rect.width + rect.left;
  const sy = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
  return { x:sx, y:sy };
}

/* ---------- Audio + screen ---------- */
function cueScreen(rec){
  const name = `${rec.artist || 'Unknown'} — ${rec.title || '(sans titre)'}`;
  if(document.body.classList.contains('theme-cyber')){
    screenNow.innerHTML = `<span class="glitch">${glitchify(name)}</span>`;
    setTimeout(()=>{ screenNow.textContent = name; }, 2000);
  }else{
    screenNow.textContent = '…';
    setTimeout(()=>{ screenNow.textContent = name; }, 700);
  }
}

function setPlayerSource(rec){
  player.src = rec.src;
  player.load();
  btnPlay.textContent = '▶';
  meterFill.style.width = '0%';
  tCur.textContent = '0:00';
  tDur.textContent = '0:00';
  seek.value = '0';

  crankCount = 0;
  crankFill.style.width = '0%';
  crankTxt.textContent = '0/5';
  stopRecordSpin();
}

function formatTime(sec){
  sec = Math.floor(sec || 0);
  const m = Math.floor(sec/60);
  const s = sec%60;
  return m + ':' + (s<10 ? '0'+s : s);
}

player.addEventListener('loadedmetadata', ()=>{ tDur.textContent = formatTime(player.duration); });
player.addEventListener('timeupdate', ()=>{
  const d = player.duration || 0;
  const c = player.currentTime || 0;
  tCur.textContent = formatTime(c);
  if(d > 0){
    const pct = (c/d)*100;
    meterFill.style.width = pct+'%';
    seek.value = String(pct);
  }
});
player.addEventListener('ended', ()=>{ stopRecordSpin(); nextTrack(); });

seek.addEventListener('input', ()=>{
  const d = player.duration || 0;
  if(d <= 0) return;
  player.currentTime = (parseFloat(seek.value)/100) * d;
});
vol.addEventListener('input', ()=> player.volume = parseFloat(vol.value));

btnPlay.addEventListener('click', ()=>{
  if(currentIndex < 0) return;
  if(player.paused){
    if(crankCount < CRANK_MAX) return;
    player.play().catch(()=>{});
    btnPlay.textContent = '⏸';
    startRecordSpin();
  }else{
    player.pause();
    btnPlay.textContent = '▶';
    stopRecordSpin();
  }
});

btnPrev.addEventListener('click', ()=> prevTrack());
btnNext.addEventListener('click', ()=> nextTrack());
btnShuffle.addEventListener('click', ()=> shuffleTrack());

btnCrank.addEventListener('click', ()=>{
  if(currentIndex < 0) return;
  if(crankCount >= CRANK_MAX) return;
  crankCount++;
  crankTxt.textContent = `${crankCount}/${CRANK_MAX}`;
  crankFill.style.width = `${(crankCount/CRANK_MAX)*100}%`;
  if(crankCount >= CRANK_MAX){
    player.play().catch(()=>{});
    btnPlay.textContent = '⏸';
    startRecordSpin();
  }
});

function prevTrack(){
  if(RECORDS.length === 0) return;
  const idx = (currentIndex - 1 + RECORDS.length) % RECORDS.length;
  placeRecordOnPlatter(RECORDS[idx]);
}
function nextTrack(){
  if(RECORDS.length === 0) return;
  const idx = (currentIndex + 1) % RECORDS.length;
  placeRecordOnPlatter(RECORDS[idx]);
}
function shuffleTrack(){
  if(RECORDS.length === 0) return;
  const idx = Math.floor(Math.random()*RECORDS.length);
  placeRecordOnPlatter(RECORDS[idx]);
}

/* ---------- 3D scene ---------- */
function init3D(){
  if(!window.THREE){
    setStatus('Three.js indisponible');
    canvas.replaceWith(Object.assign(document.createElement('div'), {
      className: 'three-missing',
      textContent: 'WebGL 3D indisponible : connexion CDN Three.js requise.'
    }));
    return;
  }

  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(42, 1, 0.01, 20);
  camera.position.set(1.25, 0.95, 1.55);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(2.2, 2.8, 1.2);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8,8),
    new THREE.MeshStandardMaterial({ color:0x06090c, roughness:1.0, metalness:0.0 })
  );
  floor.rotation.x = -Math.PI/2;
  scene.add(floor);

  jukeboxGroup = new THREE.Group();
  scene.add(jukeboxGroup);

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.15, 0.55),
    new THREE.MeshStandardMaterial({ color:0x111821, roughness:0.65, metalness:0.15 })
  );
  cabinet.position.set(0,0.58,0);
  jukeboxGroup.add(cabinet);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.62,0.95,0.04),
    new THREE.MeshStandardMaterial({ color:0x0a0f16, roughness:0.35, metalness:0.45 })
  );
  frame.position.set(0,0.62,0.295);
  jukeboxGroup.add(frame);

  const scrMat = new THREE.MeshStandardMaterial({ color:0x0b1722, emissive:0x00ffaa, emissiveIntensity:0.16, roughness:0.9 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.48,0.22), scrMat);
  scr.position.set(0,0.78,0.316);
  jukeboxGroup.add(scr);
  screenGlow = scrMat;

  const platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18,0.18,0.02,64),
    new THREE.MeshStandardMaterial({ color:0x0a0c10, roughness:0.65, metalness:0.25 })
  );
  platter.position.set(0.0, 0.33, 0.20);
  jukeboxGroup.add(platter);
  platterWorld = { x:platter.position.x, y:platter.position.y, z:platter.position.z, r:0.18 };

  recordMesh = createRecordMesh();
  recordMesh.visible = false;
  recordMesh.position.set(0.0, 0.345, 0.20);
  jukeboxGroup.add(recordMesh);

  jukeboxGroup.position.set(-0.15, 0.0, 0.0);
  jukeboxGroup.rotation.y = -0.32;

  onResize();
  animate();
}

function createRecordMesh(){
  const group = new THREE.Group();
  const r = 0.17, h = 0.006;

  group.add(new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 64, 1, true),
    new THREE.MeshStandardMaterial({ color:0x050608, roughness:0.45, metalness:0.2 })
  ));

  const topGeo = new THREE.CircleGeometry(r, 64);
  const tex = new THREE.CanvasTexture(makeRecordTexture({}));
  tex.anisotropy = 8;
  const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness:0.55, metalness:0.10 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.rotation.x = -Math.PI/2;
  top.position.y = h/2 + 0.0005;
  group.add(top);

  group.userData.topTexture = tex;
  return group;
}

function placeRecordOnPlatter(rec){
  const idx = RECORDS.findIndex(r=>r.id === rec.id);
  if(idx >= 0) currentIndex = idx;

  setPlayerSource(rec);
  cueScreen(rec);

  updateRecordTexture(rec).then(()=>{
    recordMesh.visible = true;
    isRecordOnPlatter = true;
  }).catch(()=>{ recordMesh.visible = true; isRecordOnPlatter = true; });
}

function startRecordSpin(){ if(isRecordOnPlatter) recordSpin = true; }
function stopRecordSpin(){ recordSpin = false; }

/* ---------- Record texture (procedural) ---------- */
function makeRecordTexture({ coverImg=null, disc1='#14161a', disc2='#050608', style='effect-none' }){
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');

  const g = ctx.createRadialGradient(512,512,0,512,512,512);
  g.addColorStop(0.0, disc1); g.addColorStop(0.36, disc1); g.addColorStop(0.70, disc2); g.addColorStop(1.0, '#000');
  ctx.fillStyle = g; ctx.fillRect(0,0,1024,1024);

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for(let r=240;r<500;r+=3){ ctx.beginPath(); ctx.arc(512,512,r,0,Math.PI*2); ctx.stroke(); }
  ctx.globalAlpha = 1;

  if(style === 'effect-grid'){
    ctx.globalAlpha = 0.18; ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    for(let x=0;x<1024;x+=28){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,1024); ctx.stroke(); }
    for(let y=0;y<1024;y+=28){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1024,y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }else if(style === 'effect-calc'){
    ctx.globalAlpha = 0.25; ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for(let i=0;i<120;i++){
      const a = Math.random()*Math.PI*2;
      const rr = 280 + Math.random()*210;
      ctx.fillRect(512+Math.cos(a)*rr, 512+Math.sin(a)*rr, 2, 2);
    }
    ctx.globalAlpha = 1;
  }else if(style === 'effect-neon'){
    ctx.globalAlpha = 0.35;
    const con = ctx.createConicGradient(0, 512,512);
    con.addColorStop(0.0,'rgba(0,255,161,0.0)');
    con.addColorStop(0.25,'rgba(0,255,161,0.35)');
    con.addColorStop(0.5,'rgba(0,187,255,0.28)');
    con.addColorStop(0.75,'rgba(0,0,0,0.0)');
    con.addColorStop(1.0,'rgba(0,255,161,0.20)');
    ctx.fillStyle = con; ctx.fillRect(0,0,1024,1024);
    ctx.globalAlpha = 1;
  }

  // label clip
  ctx.save(); ctx.beginPath(); ctx.arc(512,512,165,0,Math.PI*2); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0,0,1024,1024);
  if(coverImg){
    const s = 360;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(coverImg, 512-s/2, 512-s/2, s, s);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath(); ctx.arc(512,512,18,0,Math.PI*2); ctx.fill();

  return c;
}

async function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function updateRecordTexture(rec){
  const disc1 = rec.coverColor || '#14161a';
  const disc2 = rec.labelColor || '#050608';
  const style = rec.vinylStyle || 'effect-none';
  const src = coverUrl(rec) || coverPlaceholder(rec.title || rec.id || 'VINYL');

  let coverImg = null;
  try{ coverImg = await loadImage(src); }catch(e){ coverImg = null; }

  const newCanvas = makeRecordTexture({ coverImg, disc1, disc2, style });
  const tex = recordMesh.userData.topTexture;
  tex.image = newCanvas;
  tex.needsUpdate = true;

  if(screenGlow){
    const isSteam = document.body.classList.contains('theme-steam');
    screenGlow.emissive.setHex(isSteam ? 0xffb35a : 0x00ffaa);
    screenGlow.emissiveIntensity = isSteam ? 0.12 : 0.16;
  }
}

/* ---------- Theme ---------- */
btnThemeSteam.addEventListener('click', ()=>{
  document.body.classList.add('theme-steam');
  document.body.classList.remove('theme-cyber');
  btnThemeSteam.classList.add('primary'); btnThemeCyber.classList.remove('primary');
  if(screenGlow){ screenGlow.emissive.setHex(0xffb35a); screenGlow.emissiveIntensity = 0.12; }
  if(currentIndex >= 0) cueScreen(RECORDS[currentIndex]);
});
btnThemeCyber.addEventListener('click', ()=>{
  document.body.classList.add('theme-cyber');
  document.body.classList.remove('theme-steam');
  btnThemeCyber.classList.add('primary'); btnThemeSteam.classList.remove('primary');
  if(screenGlow){ screenGlow.emissive.setHex(0x00ffaa); screenGlow.emissiveIntensity = 0.16; }
  if(currentIndex >= 0) cueScreen(RECORDS[currentIndex]);
});

/* ---------- Helpers ---------- */
function glitchify(str){
  const chars = '▌█▓▒░01ØΞ';
  return str.split('').map(ch => (Math.random() < 0.18 ? chars[(Math.random()*chars.length)|0] : ch)).join('');
}
function hash(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h>>>0);
}
function escapeXml(s){ return (s||'').replace(/[<>&"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c])); }

function onResize(){
  if(!renderer || !camera) return;
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width/rect.height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

function animate(){
  requestAnimationFrame(animate);
  const t = performance.now()*0.001;
  camera.position.x = 1.25 + Math.sin(t*0.25)*0.02;
  camera.position.y = 0.95 + Math.sin(t*0.33)*0.015;
  camera.lookAt(0.0, 0.55, 0.0);
  if(recordMesh && recordSpin) recordMesh.rotation.y += 0.12;
  renderer.render(scene, camera);
}

/* ---------- Boot ---------- */
(async function init(){
  setStatus('Chargement des pistes…');
  await loadRecords();
  filtered = [...RECORDS];
  buildShelf();
  resetSelectedPanel();
  init3D();
  setStatus(`${RECORDS.length} vinyle(s)`);
  if(filtered[0]) selectByFilteredIndex(0);
  player.volume = parseFloat(vol.value);
})();
