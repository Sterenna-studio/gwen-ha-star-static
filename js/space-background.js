import { supabase } from '../shared/supabase-client.js';

const DEFAULTS = {
  stars: 1,
  ships: 1,
  shipMax: 6,
  speed: 1,
  asteroids: 0.55,
  planets: 0.35,
  satellites: 0.25,
  crashes: 0.12,
  nebula: 0.7,
  shake: 0,
  trafficMode: 'balanced',
};

const HUB_VERSIONS = [
  {
    id: 'public-20260703',
    label: 'Public · 03/07',
    href: '/',
    note: 'Version publiée avec background configurable',
  },
  {
    id: 'prod-modular',
    label: 'Prod module · refacto',
    href: '/prod/',
    note: 'Version CSS/JS extraits',
  },
  {
    id: 'background-admin',
    label: 'Config background',
    href: '/star/admin/background.html',
    note: 'Console admin du fond spatial',
  },
];

const home = document.querySelector('.hub-hero');
if (home) {
  installHubVersionSelector();
  fixAvatarFallbacks();
  boot();
}

async function boot() {
  ensureHomeStylesheet();
  disableLegacyShakeClass();

  const old = document.getElementById('ship-canvas');
  if (old) old.style.opacity = '0';

  const canvas = document.createElement('canvas');
  canvas.id = 'space-bg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '1',
    opacity: '.72',
    mixBlendMode: 'screen',
  });
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let cfg = await loadConfig();
  if (!cfg.enabled) return;
  cfg = { ...DEFAULTS, ...(cfg.config || {}), shake: 0 };

  let W = 0, H = 0, DPR = 1, last = performance.now(), nextShip = 0, nextRock = 0, nextSat = 0, nextCrash = 0;
  let stars = [], ships = [], particles = [], rocks = [], satellites = [], planets = [];
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const shipTypes = [
    { name:'scout', w:4, size:.78, speed:[170,260], stroke:'#00ffe7', accent:'#39ff14', flame:'#ffaa00' },
    { name:'freighter', w:2, size:1.05, speed:[95,145], stroke:'#bf5fff', accent:'#00ffe7', flame:'#ff2d55' },
    { name:'needle', w:3, size:.62, speed:[260,390], stroke:'#39ff14', accent:'#b8ff4a', flame:'#00ffe7' },
    { name:'carrier', w:1, size:1.25, speed:[70,110], stroke:'#ffaa00', accent:'#ff2d55', flame:'#ffaa00' },
  ];
  const weighted = shipTypes.flatMap(t => Array(t.w).fill(t));

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
    buildPlanets();
  }

  function buildStars() {
    const count = Math.floor(Math.min(260, Math.max(50, (W * H) / 10500 * cfg.stars)));
    stars = Array.from({ length: count }, () => ({ x:Math.random()*W, y:Math.random()*H, z:rnd(.25,1), r:rnd(.35,1.5), a:rnd(.12,.58), drift:rnd(2,16) }));
  }

  function buildPlanets() {
    const count = Math.floor(cfg.planets * 3);
    planets = Array.from({ length: count }, (_, i) => ({ x:rnd(W*.1,W*.95), y:rnd(H*.02,H*.42), r:rnd(18,58), hue:pick(['#00d4ff','#8b5cf6','#00ff9d','#f59e0b']), ring:Math.random()>.5, drift:rnd(.8,3), phase:i }));
  }

  function spawnShip(forceLarge=false) {
    if (reduce?.matches || ships.length >= cfg.shipMax || cfg.ships <= 0) return;
    const type = forceLarge ? shipTypes[3] : pick(weighted);
    const dir = Math.random() > .5 ? 1 : -1;
    const depth = rnd(.55,1.18);
    const scale = type.size * depth * rnd(.88,1.16);
    const margin = 90 * scale;
    const yBand = Math.random() > .18 ? [H*.12,H*.62] : [H*.62,H*.9];
    ships.push({ type, dir, scale, depth, x:dir===1?-margin:W+margin, y:rnd(yBand[0],yBand[1]), vx:dir*rnd(type.speed[0],type.speed[1])*depth*cfg.speed, vy:rnd(-12,12), life:0, roll:rnd(-.04,.04), wob:rnd(0,7) });
  }

  function spawnRock() {
    if (rocks.length > 18 || cfg.asteroids <= 0) return;
    const dir = Math.random() > .5 ? 1 : -1;
    rocks.push({ x:dir===1?-40:W+40, y:rnd(H*.05,H*.9), vx:dir*rnd(22,82)*cfg.speed, vy:rnd(-12,22), r:rnd(3,18), rot:rnd(0,7), vr:rnd(-1.8,1.8), a:rnd(.18,.55) });
  }

  function spawnSatellite() {
    if (satellites.length > 4 || cfg.satellites <= 0) return;
    const dir = Math.random() > .5 ? 1 : -1;
    satellites.push({ x:dir===1?-60:W+60, y:rnd(H*.08,H*.45), vx:dir*rnd(35,90)*cfg.speed, y0:rnd(H*.08,H*.45), life:0, s:rnd(.7,1.2) });
  }

  function spawnCrash() {
    if (cfg.crashes <= 0) return;
    const x = rnd(W*.1,W*.9), y = rnd(H*.08,H*.45);
    for (let i=0;i<34;i++) particles.push({ x, y, vx:rnd(-130,130), vy:rnd(-90,170), life:rnd(.45,1.4), max:1.4, size:rnd(1,4), color:pick(['#ff2d55','#ffaa00','#00ffe7']) });
  }

  function shake() {
    // Screen shake intentionally disabled site-wide for the public home.
  }

  function drawShip(s) {
    ctx.save();
    ctx.globalAlpha = .48 + s.depth * .42;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.roll + Math.sin(s.life*1.7)*.012);
    ctx.scale(s.dir*s.scale, s.scale);
    ctx.strokeStyle = s.type.stroke; ctx.fillStyle = s.type.stroke + '18'; ctx.lineWidth = 1.25; ctx.shadowBlur = 16; ctx.shadowColor = s.type.stroke;
    ctx.beginPath();
    ctx.moveTo(42,0); ctx.lineTo(8,-14); ctx.lineTo(-36,-10); ctx.lineTo(-48,0); ctx.lineTo(-36,10); ctx.lineTo(8,14); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = s.type.accent;
    ctx.beginPath(); ctx.moveTo(5,-12); ctx.lineTo(-22,-28); ctx.lineTo(-34,-10); ctx.moveTo(5,12); ctx.lineTo(-22,28); ctx.lineTo(-34,10); ctx.stroke();
    ctx.strokeStyle = s.type.flame; ctx.shadowColor = s.type.flame; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.moveTo(-44,-4); ctx.lineTo(-70-rnd(0,18),0); ctx.lineTo(-44,4); ctx.stroke();
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(.05, (now-last)/1000); last = now;
    ctx.clearRect(0,0,W,H);

    drawSpace(dt);
    if (!reduce?.matches) {
      if (now > nextShip) { spawnShip(Math.random()<.12); nextShip = now + rnd(2600,7200)/Math.max(.15,cfg.ships); }
      if (now > nextRock) { spawnRock(); nextRock = now + rnd(1000,3600)/Math.max(.1,cfg.asteroids); }
      if (now > nextSat) { spawnSatellite(); nextSat = now + rnd(8000,19000)/Math.max(.1,cfg.satellites); }
      if (now > nextCrash) { if (Math.random() < cfg.crashes) spawnCrash(); nextCrash = now + rnd(9000,22000); }
    }

    ships.forEach(s => { s.life += dt; s.x += s.vx*dt; s.y += (s.vy + Math.sin(s.life*2.2+s.wob)*6)*dt; for(let i=0;i<(s.type.name==='needle'?1:2);i++) particles.push({ x:s.x-s.dir*34*s.scale+rnd(-4,4), y:s.y+rnd(-5,5)*s.scale, vx:-s.dir*rnd(90,190)*s.depth, vy:rnd(-28,28), life:rnd(.32,.72), max:.72, size:rnd(1.2,3.8)*s.depth, color:Math.random()>.35?s.type.flame:s.type.accent }); });
    rocks.forEach(r => { r.x += r.vx*dt; r.y += r.vy*dt; r.rot += r.vr*dt; });
    satellites.forEach(s => { s.life += dt; s.x += s.vx*dt; s.y = s.y0 + Math.sin(s.life)*12; });
    particles.forEach(p => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 18*dt; p.life -= dt; });

    ships = ships.filter(s => s.dir===1 ? s.x<W+160 : s.x>-160);
    rocks = rocks.filter(r => r.x>-80 && r.x<W+80 && r.y>-80 && r.y<H+80);
    satellites = satellites.filter(s => s.x>-100 && s.x<W+100);
    particles = particles.filter(p => p.life>0).slice(-700);

    drawRocks(); drawSatellites(); drawParticles(); ships.sort((a,b)=>a.depth-b.depth).forEach(drawShip);
    requestAnimationFrame(frame);
  }

  function drawSpace(dt) {
    ctx.save();
    stars.forEach(st => { st.x -= st.drift*st.z*dt; if(st.x < -8){ st.x = W+8; st.y = Math.random()*H; } ctx.globalAlpha=st.a; ctx.fillStyle=st.z>.75?'#b8ffc0':'#00ffe7'; ctx.fillRect(st.x,st.y,st.r,st.r); });
    planets.forEach(p => { p.x -= p.drift*dt; if(p.x < -p.r*2) p.x = W+p.r*2; ctx.globalAlpha=.1+.16*cfg.planets; ctx.fillStyle=p.hue; ctx.shadowBlur=28; ctx.shadowColor=p.hue; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); if(p.ring){ ctx.strokeStyle=p.hue; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r*1.6,p.r*.35,.25,0,Math.PI*2); ctx.stroke(); } });
    const g=ctx.createRadialGradient(W*.72,H*.18,0,W*.72,H*.18,Math.max(W,H)*.55); g.addColorStop(0,`rgba(0,255,231,${.055*cfg.nebula})`); g.addColorStop(.45,`rgba(57,255,20,${.025*cfg.nebula})`); g.addColorStop(1,'transparent'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.restore();
  }
  function drawRocks(){ rocks.forEach(r=>{ ctx.save(); ctx.translate(r.x,r.y); ctx.rotate(r.rot); ctx.globalAlpha=r.a; ctx.strokeStyle='#8b5cf6'; ctx.fillStyle='rgba(139,92,246,.12)'; ctx.beginPath(); for(let i=0;i<7;i++){ const a=i/7*Math.PI*2, rr=r.r*rnd(.65,1.2); i?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }); }
  function drawSatellites(){ satellites.forEach(s=>{ ctx.save(); ctx.translate(s.x,s.y); ctx.scale(s.s,s.s); ctx.globalAlpha=.6; ctx.strokeStyle='#00d4ff'; ctx.fillStyle='rgba(0,212,255,.12)'; ctx.strokeRect(-10,-5,20,10); ctx.strokeRect(-32,-3,18,6); ctx.strokeRect(14,-3,18,6); ctx.beginPath(); ctx.moveTo(0,5); ctx.lineTo(0,20); ctx.stroke(); ctx.restore(); }); }
  function drawParticles(){ particles.forEach(p=>{ const a=Math.max(0,p.life/p.max); ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=p.color; ctx.shadowBlur=14; ctx.shadowColor=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(.45+a),0,Math.PI*2); ctx.fill(); ctx.restore(); }); }

  resize(); addEventListener('resize', resize);
  spawnShip(false); setTimeout(()=>spawnShip(true), 1400);
  requestAnimationFrame(frame);
}

function installHubVersionSelector() {
  if (document.getElementById('hub-version-switcher')) return;

  const currentPath = normalizePath(window.location.pathname);
  const wrapper = document.createElement('aside');
  wrapper.id = 'hub-version-switcher';
  wrapper.setAttribute('aria-label', 'Sélecteur de version du hub');
  wrapper.innerHTML = `
    <div class="hvs-kicker">HUB VERSION</div>
    <label class="hvs-label" for="hvs-select">Retrouver une version</label>
    <select id="hvs-select">
      ${HUB_VERSIONS.map(version => `
        <option value="${escapeAttr(version.href)}" ${normalizePath(version.href) === currentPath ? 'selected' : ''}>
          ${escapeHtml(version.label)}
        </option>`).join('')}
    </select>
    <div class="hvs-note" id="hvs-note"></div>`;

  const style = document.createElement('style');
  style.id = 'hub-version-switcher-style';
  style.textContent = `
    #hub-version-switcher{
      position:fixed;
      right:14px;
      bottom:14px;
      z-index:80;
      width:min(260px,calc(100vw - 28px));
      padding:10px;
      border:1px solid rgba(0,255,231,.32);
      border-radius:14px;
      background:rgba(4,8,16,.84);
      box-shadow:0 10px 32px rgba(0,0,0,.42),0 0 22px rgba(0,255,231,.08);
      backdrop-filter:blur(10px);
      color:var(--c-text,#f2f6ff);
      font-family:var(--font-mono,monospace);
    }
    #hub-version-switcher .hvs-kicker{font-size:8px;letter-spacing:.22em;color:var(--c-primary,#00ffe7);opacity:.72;margin-bottom:4px}
    #hub-version-switcher .hvs-label{display:block;font-size:9px;letter-spacing:.08em;color:var(--c-text-muted,#94a3b8);margin-bottom:7px}
    #hub-version-switcher select{
      width:100%;
      min-height:34px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.06);
      color:inherit;
      font:inherit;
      font-size:10px;
      padding:0 9px;
      cursor:pointer;
    }
    #hub-version-switcher option{background:#050a12;color:#f2f6ff}
    #hub-version-switcher .hvs-note{min-height:1.2em;margin-top:7px;font-size:8px;line-height:1.45;color:var(--c-text-faint,#64748b)}
    @media(max-width:720px){#hub-version-switcher{left:10px;right:10px;bottom:10px;width:auto}}
  `;

  document.head.appendChild(style);
  document.body.appendChild(wrapper);

  const select = wrapper.querySelector('#hvs-select');
  const note = wrapper.querySelector('#hvs-note');
  const updateNote = () => {
    const selected = HUB_VERSIONS.find(version => version.href === select.value);
    if (note) note.textContent = selected?.note || '';
  };

  select.addEventListener('change', () => {
    const target = select.value;
    if (target && normalizePath(target) !== currentPath) window.location.href = target;
    else updateNote();
  });
  updateNote();
}

function fixAvatarFallbacks() {
  const fallbackSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 176">
      <rect width="176" height="176" rx="88" fill="#101827"/>
      <circle cx="88" cy="70" r="30" fill="#00ffe7" opacity="0.72"/>
      <path d="M36 148c9-31 28-48 52-48s43 17 52 48" fill="#00ffe7" opacity="0.45"/>
    </svg>`);
  const fallback = `data:image/svg+xml;charset=utf-8,${fallbackSvg}`;

  document.querySelectorAll('img').forEach(img => {
    const attr = img.getAttribute('onerror') || '';
    if (attr.includes('googleusercontent.com/default-user') || attr.includes('default-user/176x176.jpg')) {
      img.removeAttribute('onerror');
      img.addEventListener('error', () => {
        if (img.src !== fallback) img.src = fallback;
      }, { once: true });
    }
  });
}

function normalizePath(path) {
  if (!path) return '/';
  if (/^https?:\/\//.test(path)) {
    try { return normalizePath(new URL(path).pathname); } catch { return path; }
  }
  return path.endsWith('/') ? path : `${path}/`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function ensureHomeStylesheet() {
  if (document.getElementById('home-css')) return;
  const link = document.createElement('link');
  link.id = 'home-css';
  link.rel = 'stylesheet';
  link.href = '/css/home.css?v=20260703-extract-2';
  document.head.appendChild(link);
}

function disableLegacyShakeClass() {
  document.body.classList.remove('shaking');
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('shaking')) {
      document.body.classList.remove('shaking');
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

async function loadConfig() {
  try {
    const { data, error } = await supabase.from('space_background_config').select('enabled,config').eq('id','home').single();
    if (error) throw error;
    return data || { enabled:true, config:DEFAULTS };
  } catch (err) {
    console.warn('[space-bg] config fallback', err);
    return { enabled:true, config:DEFAULTS };
  }
}
