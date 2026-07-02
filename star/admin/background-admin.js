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
  app.innerHTML = '<header class="bg-top"><div><p class="bg-kicker">// GWEN HA STAR · SPACE MANAGEMENT</p><h1 class="bg-title">BACKGROUND <span>SPACE</span></h1><p class="bg-sub">Management des vaisseaux de fond : trafic, étoiles, astéroïdes, planètes, satellites, crashs et bibliothèque de modèles.</p></div><nav class="bg-actions"><a class="bg-btn" href="/">← ACCUEIL</a><a class="bg-btn" href="/star/">COCKPIT</a><button class="bg-btn" id="add-ship">+ VAISSEAU</button><button class="bg-btn primary" id="save">SAUVER</button></nav></header><section class="bg-card bg-note"><label class="bg-label"><span>ACTIVER LE BACKGROUND SPATIAL</span><input type="checkbox" id="enabled"></label><p class="bg-muted">Les valeurs sont appliquées à l’accueil après sauvegarde et rechargement de la page publique.</p><div class="bg-toast" id="toast"></div></section><p class="bg-kicker">// AMBIANCE</p><section class="bg-grid" id="grid"></section><p class="bg-kicker" style="margin-top:18px">// BIBLIOTHÈQUE DE VAISSEAUX</p><section class="bg-grid" id="ship-grid"></section>';
  document.getElementById('save').onclick = saveConfig;
  document.getElementById('add-ship').onclick = addShip;
}

async function loadConfig(){
  const { data, error } = await supabase.rpc('admin_get_space_background_config');
  if(error || data?.ok === false){ toast(data?.error || error?.message || 'Lecture impossible', true); return; }
  enabled = data.enabled !== false;
  cfg = { ...DEFAULTS, ...(data.config || {}) };
  cfg.shipLibrary = normalizeShips(cfg.shipLibrary);
}

function normalizeShips(list){
  const src = Array.isArray(list) ? list : [];
  const byId = new Map(src.map(s => [s.id, s]));
  const merged = DEFAULT_SHIPS.map(s => ({ ...s, ...(byId.get(s.id) || {}) }));
  src.filter(s => s.custom && !DEFAULT_SHIPS.some(d => d.id === s.id)).forEach(s => merged.push({ ...s }));
  return merged;
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
  grid.innerHTML = cfg.shipLibrary.map((s, i) => '<article class="bg-card bg-field"><label class="bg-label"><span>'+s.label+'</span><input type="checkbox" data-ship-enabled="'+i+'" '+(s.enabled!==false?'checked':'')+'></label><p class="bg-muted">'+s.shape+' · '+s.stroke+' / '+s.accent+'</p><label class="bg-label"><span>POIDS / FRÉQUENCE</span><strong class="bg-value" id="ship-w-'+i+'">'+(s.weight ?? 1)+'</strong></label><input type="range" min="0" max="8" step="1" value="'+(s.weight ?? 1)+'" data-ship-weight="'+i+'"><label class="bg-label"><span>TAILLE</span><strong class="bg-value" id="ship-s-'+i+'">'+(s.size ?? 1)+'</strong></label><input type="range" min="0.4" max="1.8" step="0.05" value="'+(s.size ?? 1)+'" data-ship-size="'+i+'">'+(s.custom?'<button class="bg-btn" data-ship-remove="'+i+'">SUPPRIMER</button>':'')+'</article>').join('');
  grid.querySelectorAll('[data-ship-enabled]').forEach(el => el.onchange = () => cfg.shipLibrary[+el.dataset.shipEnabled].enabled = el.checked);
  grid.querySelectorAll('[data-ship-weight]').forEach(el => el.oninput = () => { const i=+el.dataset.shipWeight; cfg.shipLibrary[i].weight=Number(el.value); document.getElementById('ship-w-'+i).textContent=el.value; });
  grid.querySelectorAll('[data-ship-size]').forEach(el => el.oninput = () => { const i=+el.dataset.shipSize; cfg.shipLibrary[i].size=Number(el.value); document.getElementById('ship-s-'+i).textContent=el.value; });
  grid.querySelectorAll('[data-ship-remove]').forEach(el => el.onclick = () => { cfg.shipLibrary.splice(+el.dataset.shipRemove,1); renderShips(); });
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
