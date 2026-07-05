import { requireAuth } from '../../shared/guards.js';
import { supabase } from '../../shared/supabase-client.js';

const app = document.getElementById('app');
const DEFAULT_SHIPS = [
  { id:'scout', label:'Scout', enabled:true, weight:4, shape:'scout', size:.78, speedMin:170, speedMax:260, stroke:'#00ffe7', accent:'#39ff14', flame:'#ffaa00' },
  { id:'freighter', label:'Freighter', enabled:true, weight:2, shape:'freighter', size:1.05, speedMin:95, speedMax:145, stroke:'#bf5fff', accent:'#00ffe7', flame:'#ff2d55' },
  { id:'needle', label:'Needle', enabled:true, weight:3, shape:'needle', size:.62, speedMin:260, speedMax:390, stroke:'#39ff14', accent:'#b8ff4a', flame:'#00ffe7' },
  { id:'carrier', label:'Carrier', enabled:true, weight:1, shape:'carrier', size:1.25, speedMin:70, speedMax:110, stroke:'#ffaa00', accent:'#ff2d55', flame:'#ffaa00' },
];
const DEFAULTS = { stars:1, ships:1, shipMax:6, speed:1, asteroids:.55, planets:.35, satellites:.25, crashes:.12, nebula:.7, shake:.45, trafficMode:'balanced', shipLibrary:DEFAULT_SHIPS };
const fields = [
  ['stars','Étoiles',0,2.5,.05], ['ships','Trafic vaisseaux',0,3,.05], ['shipMax','Vaisseaux max',0,14,1],
  ['speed','Vitesse générale',.2,3,.05], ['asteroids','Astéroïdes',0,2.5,.05], ['planets','Petites planètes',0,2,.05],
  ['satellites','Satellites',0,2,.05], ['crashes','Crashs / incidents',0,1,.02], ['nebula','Nébuleuse',0,2,.05], ['shake','Tremblements',0,1,.05]
];
let cfg = { ...DEFAULTS }, enabled = true;

boot();

function publishConfig(){
  if(typeof window === 'undefined') return;
  window.starSpaceBackgroundConfig = cfg;
  window.starSpaceBackgroundEnabled = enabled;
}

async function boot(){
  const auth = await requireAuth({ redirectTo:'/login.html' });
  if(!auth) return;
  if(auth.profile?.role !== 'superuser'){
    app.innerHTML = '<section class="bg-card bg-locked"><p class="bg-kicker">// SPACE BACKGROUND</p><h1 class="bg-title">ACCÈS <span>REFUSÉ</span></h1><p class="bg-sub">Console réservée aux profils superuser.</p><p><a class="bg-btn" href="/star/">← COCKPIT</a></p></section>';
    return;
  }
  renderShell();
  await loadConfig();
  renderFields();
  renderShips();
}

function renderShell(){
  app.innerHTML = '<header class="bg-top"><div><p class="bg-kicker">// GWEN HA STAR · SPACE MANAGEMENT</p><h1 class="bg-title">BACKGROUND <span>SPACE</span></h1><p class="bg-sub">Management des vaisseaux de fond : trafic, étoiles, astéroïdes, planètes, satellites, crashs et bibliothèque de modèles.</p></div><nav class="bg-actions"><a class="bg-btn" href="/">← ACCUEIL</a><a class="bg-btn ship-doc" href="/docs/space-background-ships.md">DOC SHIPS</a><a class="bg-btn" href="/star/">COCKPIT</a><a class="bg-btn" href="/star/admin/cockpit-background.html">BG STAR</a><a class="bg-btn" href="/star/admin/hero-cards.html">HERO CARDS</a><button class="bg-btn" id="add-ship">+ VAISSEAU</button><button class="bg-btn primary" id="save">SAUVER</button></nav></header><section class="bg-card bg-note"><label class="bg-label"><span>ACTIVER LE BACKGROUND SPATIAL</span><input type="checkbox" id="enabled"></label><p class="bg-muted">Les valeurs sont appliquées à l’accueil après sauvegarde et rechargement de la page publique.</p><div class="bg-toast" id="toast"></div></section><p class="bg-kicker">// AMBIANCE</p><section class="bg-grid" id="grid"></section><p class="bg-kicker" style="margin-top:18px">// BIBLIOTHÈQUE DE VAISSEAUX</p><section class="bg-grid ship-grid" id="ship-grid"></section>';
  document.getElementById('save').onclick = saveConfig;
  document.getElementById('add-ship').onclick = addShip;
}

async function loadConfig(){
  const { data, error } = await supabase.rpc('admin_get_space_background_config');
  if(error || data?.ok === false){ toast(data?.error || error?.message || 'Lecture impossible', true); return; }
  enabled = data.enabled !== false;
  cfg = { ...DEFAULTS, ...(data.config || {}) };
  cfg.shipLibrary = normalizeShips(cfg.shipLibrary);
  publishConfig();
}

function normalizeShips(list){
  const src = Array.isArray(list) ? list : [];
  const byId = new Map(src.map(s => [s.id, s]));
  const merged = DEFAULT_SHIPS.map(s => ({ ...s, ...(byId.get(s.id) || {}) }));
  src.filter(s => s.custom && !DEFAULT_SHIPS.some(d => d.id === s.id)).forEach(s => merged.push({ ...s }));
  return merged.map(s => ({ ...s, shape:s.shape || 'scout', enabled:s.enabled !== false, weight:Number(s.weight ?? 1), size:Number(s.size ?? 1) }));
}

function renderFields(){
  document.getElementById('enabled').checked = enabled;
  const grid = document.getElementById('grid');
  grid.innerHTML = fields.map(([key,label,min,max,step]) => '<article class="bg-card bg-field"><label class="bg-label"><span>'+label+'</span><strong class="bg-value" id="v-'+key+'">'+cfg[key]+'</strong></label><input type="range" id="f-'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+cfg[key]+'"></article>').join('');
  fields.forEach(([key]) => {
    const input = document.getElementById('f-'+key);
    const value = document.getElementById('v-'+key);
    input.oninput = () => { cfg[key] = Number(input.value); value.textContent = input.value; };
  });
}

function renderShips(){
  const grid = document.getElementById('ship-grid');
  grid.innerHTML = cfg.shipLibrary.map((s, i) => '<article class="bg-card bg-field ship-card"><label class="bg-label"><span>'+s.label+'</span><input type="checkbox" data-ship-enabled="'+i+'" '+(s.enabled!==false?'checked':'')+'></label><canvas class="ship-preview" width="260" height="110" data-ship-preview="'+i+'"></canvas><p class="bg-muted ship-meta">'+s.shape+' · '+s.stroke+' / '+s.accent+'</p><label class="bg-label"><span>POIDS / FRÉQUENCE</span><strong class="bg-value" id="ship-w-'+i+'">'+(s.weight ?? 1)+'</strong></label><input type="range" min="0" max="8" step="1" value="'+(s.weight ?? 1)+'" data-ship-weight="'+i+'"><label class="bg-label"><span>TAILLE</span><strong class="bg-value" id="ship-s-'+i+'">'+(s.size ?? 1)+'</strong></label><input type="range" min="0.4" max="1.8" step="0.05" value="'+(s.size ?? 1)+'" data-ship-size="'+i+'">'+(s.custom?'<button class="bg-btn" data-ship-remove="'+i+'">SUPPRIMER</button>':'')+'</article>').join('');
  grid.querySelectorAll('[data-ship-preview]').forEach(canvas => drawShipPreview(canvas, cfg.shipLibrary[+canvas.dataset.shipPreview]));
  grid.querySelectorAll('[data-ship-enabled]').forEach(el => el.onchange = () => cfg.shipLibrary[+el.dataset.shipEnabled].enabled = el.checked);
  grid.querySelectorAll('[data-ship-weight]').forEach(el => el.oninput = () => { const i=+el.dataset.shipWeight; cfg.shipLibrary[i].weight=Number(el.value); document.getElementById('ship-w-'+i).textContent=el.value; });
  grid.querySelectorAll('[data-ship-size]').forEach(el => el.oninput = () => { const i=+el.dataset.shipSize; cfg.shipLibrary[i].size=Number(el.value); document.getElementById('ship-s-'+i).textContent=el.value; drawShipPreview(document.querySelector('[data-ship-preview="'+i+'"]'), cfg.shipLibrary[i]); });
  grid.querySelectorAll('[data-ship-remove]').forEach(el => el.onclick = () => { cfg.shipLibrary.splice(+el.dataset.shipRemove,1); renderShips(); });
}

function drawShipPreview(canvas, ship){
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.globalAlpha=.28; ctx.fillStyle='#00ffe7'; for(let i=0;i<26;i++) ctx.fillRect((i*47)%W,(i*29)%H,1.2,1.2); ctx.restore();
  ctx.save(); ctx.translate(W/2, H/2); ctx.scale(1.4 * Number(ship.size || 1), 1.4 * Number(ship.size || 1)); drawShipShape(ctx, ship); ctx.restore();
}

function drawShipShape(ctx, s){
  const kind = s.shape || 'scout'; const st = s.stroke || '#00ffe7'; const ac = s.accent || '#39ff14';
  const path = pts => { ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); };
  const hull = (pts, stroke, fill) => { path(pts); ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=1.35; ctx.shadowColor=stroke; ctx.shadowBlur=16; ctx.fill(); ctx.stroke(); };
  if(kind === 'freighter'){
    hull([[34,-9],[14,-18],[-34,-16],[-46,0],[-34,16],[14,18],[34,9]], st, 'rgba(191,95,255,.10)'); hull([[4,-20],[-22,-31],[-34,-16]], ac, 'rgba(0,255,231,.06)'); hull([[4,20],[-22,31],[-34,16]], ac, 'rgba(0,255,231,.06)'); ctx.strokeStyle=ac; for(let x=-20;x<=18;x+=14) ctx.strokeRect(x,-6,7,12);
  } else if(kind === 'needle'){
    hull([[48,0],[-18,-5],[-38,0],[-18,5]], st, 'rgba(57,255,20,.09)'); ctx.strokeStyle=ac; ctx.beginPath(); ctx.moveTo(3,-10); ctx.lineTo(-14,-5); ctx.lineTo(3,0); ctx.lineTo(-14,5); ctx.lineTo(3,10); ctx.stroke();
  } else if(kind === 'carrier'){
    hull([[44,0],[22,-18],[-40,-20],[-58,-8],[-58,8],[-40,20],[22,18]], st, 'rgba(255,170,0,.09)'); hull([[10,-18],[-24,-38],[-42,-20]], ac, 'rgba(255,45,85,.07)'); hull([[10,18],[-24,38],[-42,20]], ac, 'rgba(255,45,85,.07)'); ctx.strokeStyle=st; ctx.beginPath(); ctx.moveTo(-30,-12); ctx.lineTo(26,-10); ctx.moveTo(-30,12); ctx.lineTo(26,10); ctx.stroke();
  } else {
    hull([[38,0],[4,-12],[-30,-8],[-38,0],[-30,8],[4,12]], st, 'rgba(0,255,231,.09)'); hull([[0,-8],[-16,-27],[-28,-8]], ac, 'rgba(57,255,20,.06)'); hull([[0,8],[-16,27],[-28,8]], ac, 'rgba(57,255,20,.06)'); ctx.strokeStyle=st; ctx.beginPath(); ctx.moveTo(14,-7); ctx.lineTo(26,0); ctx.lineTo(14,7); ctx.stroke();
  }
  const engine = kind === 'carrier' ? 58 : kind === 'freighter' ? 46 : 38;
  ctx.strokeStyle=s.flame||ac; ctx.shadowColor=ctx.strokeStyle; ctx.shadowBlur=22; ctx.beginPath(); ctx.moveTo(-engine,-4); ctx.lineTo(-engine-26,0); ctx.lineTo(-engine,4); ctx.stroke();
}

function addShip(){
  const name = prompt('Nom du nouveau vaisseau ?');
  if(!name) return;
  const shape = prompt('Forme de base : scout, freighter, needle ou carrier ?', 'scout') || 'scout';
  const base = DEFAULT_SHIPS.find(s => s.shape === shape) || DEFAULT_SHIPS[0];
  cfg.shipLibrary.push({ ...base, id:'custom-'+Date.now(), label:name, custom:true, weight:1, enabled:true });
  renderShips();
}

async function saveConfig(){
  enabled = document.getElementById('enabled').checked;
  const { data, error } = await supabase.rpc('admin_set_space_background_config', { p_enabled: enabled, p_config: cfg });
  if(error || data?.ok === false){ toast(data?.error || error?.message || 'Sauvegarde impossible', true); return; }
  cfg = { ...DEFAULTS, ...(data.config || cfg) };
  cfg.shipLibrary = normalizeShips(cfg.shipLibrary);
  publishConfig();
  toast('Configuration sauvegardée. Recharge l’accueil pour voir le résultat.');
  renderFields();
  renderShips();
}

function toast(text, err=false){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = text;
  el.classList.toggle('bg-error', err);
}
