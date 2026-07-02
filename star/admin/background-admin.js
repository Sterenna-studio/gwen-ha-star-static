import { requireAuth } from '../../shared/guards.js';
import { supabase } from '../../shared/supabase-client.js';

const app = document.getElementById('app');
const DEFAULTS = { stars:1, ships:1, shipMax:6, speed:1, asteroids:.55, planets:.35, satellites:.25, crashes:.12, nebula:.7, shake:.45, trafficMode:'balanced' };
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
}

function renderShell(){
  app.innerHTML = '<header class="bg-top"><div><p class="bg-kicker">// GWEN HA STAR · SPACE MANAGEMENT</p><h1 class="bg-title">BACKGROUND <span>SPACE</span></h1><p class="bg-sub">Management des vaisseaux de fond : trafic, étoiles, astéroïdes, planètes, satellites et crashs.</p></div><nav class="bg-actions"><a class="bg-btn" href="/">← ACCUEIL</a><a class="bg-btn" href="/star/">COCKPIT</a><button class="bg-btn primary" id="save">SAUVER</button></nav></header><section class="bg-card bg-note"><label class="bg-label"><span>ACTIVER LE BACKGROUND SPATIAL</span><input type="checkbox" id="enabled"></label><p class="bg-muted">Les valeurs sont appliquées à l’accueil après sauvegarde et rechargement de la page publique.</p><div class="bg-toast" id="toast"></div></section><section class="bg-grid" id="grid"></section>';
  document.getElementById('save').onclick = saveConfig;
}

async function loadConfig(){
  const { data, error } = await supabase.rpc('admin_get_space_background_config');
  if(error || data?.ok === false){ toast(data?.error || error?.message || 'Lecture impossible', true); return; }
  enabled = data.enabled !== false;
  cfg = { ...DEFAULTS, ...(data.config || {}) };
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

async function saveConfig(){
  enabled = document.getElementById('enabled').checked;
  const { data, error } = await supabase.rpc('admin_set_space_background_config', { p_enabled: enabled, p_config: cfg });
  if(error || data?.ok === false){ toast(data?.error || error?.message || 'Sauvegarde impossible', true); return; }
  cfg = { ...DEFAULTS, ...(data.config || cfg) };
  toast('Configuration sauvegardée. Recharge l’accueil pour voir le résultat.');
  renderFields();
}

function toast(text, err=false){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = text;
  el.classList.toggle('bg-error', err);
}
