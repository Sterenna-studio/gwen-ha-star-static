import { supabase } from '../../shared/supabase-client.js';

const ELEMENTS = [
  { id:'stars', label:'Champ d’étoiles', key:'stars', max:2.5, step:.05, def:1, icon:'✦', help:'Densité et profondeur du ciel.' },
  { id:'nebula', label:'Nébuleuse', key:'nebula', max:2, step:.05, def:.7, icon:'☁', help:'Halo cyan/vert de fond.' },
  { id:'planets', label:'Petites planètes', key:'planets', max:2, step:.05, def:.35, icon:'◉', help:'Disques et anneaux lents.' },
  { id:'asteroids', label:'Astéroïdes', key:'asteroids', max:2.5, step:.05, def:.55, icon:'◆', help:'Rochers traversants.' },
  { id:'satellites', label:'Satellites', key:'satellites', max:2, step:.05, def:.25, icon:'⌁', help:'Petits satellites orbitaux.' },
  { id:'crashes', label:'Crashs / incidents', key:'crashes', max:1, step:.02, def:.12, icon:'✹', help:'Explosions, particules et accidents.' },
  { id:'shake', label:'Secousses écran', key:'shake', max:1, step:.05, def:.45, icon:'▧', help:'Impact visuel lors des incidents.' },
  { id:'ships', label:'Trafic global', key:'ships', max:3, step:.05, def:1, icon:'➤', help:'Volume général de passages.' },
  { id:'speed', label:'Vitesse globale', key:'speed', max:3, min:.2, step:.05, def:1, icon:'»', help:'Accélère ou ralentit tout le décor.' },
];
const PRESETS = {
  calme:{ stars:.85, nebula:.45, planets:.15, asteroids:.15, satellites:.12, crashes:0, shake:0, ships:.45, speed:.75 },
  vivant:{ stars:1.15, nebula:.8, planets:.4, asteroids:.65, satellites:.35, crashes:.14, shake:.35, ships:1.1, speed:1 },
  tempete:{ stars:1.45, nebula:1.25, planets:.65, asteroids:1.3, satellites:.75, crashes:.45, shake:.8, ships:1.8, speed:1.45 },
  minimal:{ stars:.55, nebula:.18, planets:0, asteroids:0, satellites:0, crashes:0, shake:0, ships:0, speed:.65 },
};
let cfg = null;

waitForAdmin();

function waitForAdmin(){
  if(document.getElementById('ship-grid')) return boot();
  const obs = new MutationObserver(() => {
    if(document.getElementById('ship-grid')){ obs.disconnect(); boot(); }
  });
  obs.observe(document.body, { childList:true, subtree:true });
}

async function boot(){
  if(document.getElementById('element-grid')) return;
  await load();
  render();
}

async function load(){
  const { data, error } = await supabase.rpc('admin_get_space_background_config');
  if(error || data?.ok === false) throw new Error(data?.error || error?.message || 'Lecture impossible');
  cfg = { ...(data.config || {}) };
}

function render(){
  const shipGrid = document.getElementById('ship-grid');
  const wrap = document.createElement('section');
  wrap.className = 'bg-elements-wrap';
  wrap.innerHTML = '<p class="bg-kicker" style="margin-top:18px">// ÉLÉMENTS & TESTS RAPIDES</p><section class="bg-card bg-note element-tools"><div class="element-presets"><button class="bg-btn" data-preset="calme">CALME</button><button class="bg-btn" data-preset="vivant">VIVANT</button><button class="bg-btn" data-preset="tempete">TEMPÊTE</button><button class="bg-btn" data-preset="minimal">MINIMAL</button><button class="bg-btn" id="test-shake">TEST SHAKE</button><button class="bg-btn primary" id="save-elements">SAUVER ÉLÉMENTS</button></div><p class="bg-muted">Ces cartes pilotent les mêmes valeurs que les sliders principaux, mais sous forme de bibliothèque d’éléments activables.</p></section><section class="bg-grid element-grid" id="element-grid"></section>';
  shipGrid.insertAdjacentElement('afterend', wrap);
  renderElements();
  wrap.querySelectorAll('[data-preset]').forEach(btn => btn.onclick = () => applyPreset(btn.dataset.preset));
  wrap.querySelector('#test-shake').onclick = () => { document.body.classList.add('shaking'); setTimeout(()=>document.body.classList.remove('shaking'), 420); };
  wrap.querySelector('#save-elements').onclick = save;
}

function renderElements(){
  const grid = document.getElementById('element-grid');
  grid.innerHTML = ELEMENTS.map(e => {
    const value = Number(cfg[e.key] ?? e.def);
    const min = e.min ?? 0;
    return '<article class="bg-card bg-field element-card"><label class="bg-label"><span><b class="element-icon">'+e.icon+'</b> '+e.label+'</span><input type="checkbox" data-element-on="'+e.key+'" '+(value>0?'checked':'')+'></label><p class="bg-muted">'+e.help+'</p><label class="bg-label"><span>INTENSITÉ</span><strong class="bg-value" id="el-v-'+e.key+'">'+value+'</strong></label><input type="range" min="'+min+'" max="'+e.max+'" step="'+e.step+'" value="'+value+'" data-element-range="'+e.key+'"></article>';
  }).join('');
  grid.querySelectorAll('[data-element-on]').forEach(el => el.onchange = () => {
    const item = ELEMENTS.find(e => e.key === el.dataset.elementOn);
    cfg[item.key] = el.checked ? item.def : 0;
    renderElements();
  });
  grid.querySelectorAll('[data-element-range]').forEach(el => el.oninput = () => {
    cfg[el.dataset.elementRange] = Number(el.value);
    document.getElementById('el-v-'+el.dataset.elementRange).textContent = el.value;
  });
}

function applyPreset(name){
  Object.assign(cfg, PRESETS[name] || PRESETS.vivant);
  renderElements();
}

async function save(){
  const enabled = document.getElementById('enabled')?.checked ?? true;
  const { data, error } = await supabase.rpc('admin_set_space_background_config', { p_enabled: enabled, p_config: cfg });
  const toast = document.getElementById('toast');
  if(error || data?.ok === false){ if(toast) toast.textContent = data?.error || error?.message || 'Sauvegarde impossible'; return; }
  cfg = { ...(data.config || cfg) };
  if(toast) toast.textContent = 'Éléments sauvegardés. Recharge l’accueil pour vérifier.';
}
