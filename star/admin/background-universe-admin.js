import { supabase } from '../../shared/supabase-client.js';

const PRESETS={
 armorica:{label:'PATROUILLE ARMORICA',desc:'Clair, rond, protecteur. Bon preset public par défaut.',config:{stars:1.05,nebula:.65,planets:.55,asteroids:.25,satellites:.35,crashes:.08,shake:.25,ships:1.1,speed:.9}},
 contrebande:{label:'TRAFIC CONTREBANDE',desc:'Plus dense, néons violets/rouges, trafic nerveux.',config:{stars:1.25,nebula:.9,planets:.25,asteroids:.75,satellites:.15,crashes:.18,shake:.35,ships:1.7,speed:1.25}},
 code:{label:'TEMPÊTE DU CODE',desc:'Dramatique, crashs, activité forte et sensation d’attaque.',config:{stars:1.55,nebula:1.35,planets:.15,asteroids:1.25,satellites:.75,crashes:.5,shake:.85,ships:1.45,speed:1.55}},
 ruines:{label:'RUINES ORBITALES',desc:'Lent, ancien, chargé en planètes et astéroïdes.',config:{stars:.85,nebula:.35,planets:.8,asteroids:1.5,satellites:.55,crashes:.12,shake:.25,ships:.45,speed:.65}},
 default:{label:'SET DÉFAUT',desc:'Valeur stable, lisible, proche config historique.',config:{stars:1,nebula:.7,planets:.35,asteroids:.55,satellites:.25,crashes:.12,shake:.35,ships:1,speed:1,shipMax:6}}
};

wait();
function wait(){
 if(document.getElementById('advanced-bg-tools')) return boot();
 const obs=new MutationObserver(()=>{if(document.getElementById('advanced-bg-tools')){obs.disconnect();boot();}});
 obs.observe(document.body,{childList:true,subtree:true});
}
function boot(){
 if(document.getElementById('universe-preset-tools')) return;
 const target=document.getElementById('advanced-bg-tools');
 const panel=document.createElement('section');
 panel.id='universe-preset-tools';
 panel.innerHTML='<p class="bg-kicker" style="margin-top:18px">// PRESETS D’UNIVERS</p><section class="bg-grid universe-grid">'+Object.entries(PRESETS).map(([id,p])=>card(id,p)).join('')+'</section>';
 target.insertAdjacentElement('afterend',panel);
 panel.querySelectorAll('[data-apply]').forEach(btn=>btn.onclick=()=>applyPreset(btn.dataset.apply));
 panel.querySelectorAll('[data-preview]').forEach(btn=>btn.onclick=()=>previewPreset(btn.dataset.preview));
 panel.querySelectorAll('[data-save]').forEach(btn=>btn.onclick=()=>savePreset(btn.dataset.save));
}
function card(id,p){
 const score=impact(p.config), cls=score.level.toLowerCase();
 return '<article class="bg-card bg-field universe-card"><p class="bg-kicker">// '+p.label+'</p><p class="bg-muted">'+p.desc+'</p><div class="impact impact-'+cls+'">IMPACT '+score.level+' · '+score.value+'/10</div><div class="element-presets"><button class="bg-btn" data-apply="'+id+'">APPLIQUER</button><button class="bg-btn" data-preview="'+id+'">APERÇU</button><button class="bg-btn primary" data-save="'+id+'">SAVE LIVE</button></div></article>';
}
function impact(c){
 const value=Math.min(10,Math.round(((c.stars||0)*.8+(c.nebula||0)*.7+(c.planets||0)*.7+(c.asteroids||0)*1.1+(c.satellites||0)*.7+(c.crashes||0)*3+(c.ships||0)*1.1+(c.speed||1)*.8)*1.2));
 return {value,level:value>=8?'FORT':value>=5?'MOYEN':'FAIBLE'};
}
function applyPreset(id){
 const cfg=PRESETS[id]?.config; if(!cfg)return;
 Object.entries(cfg).forEach(([key,value])=>{
  const slider=document.getElementById('f-'+key) || document.querySelector('[data-element-range="'+key+'"]');
  if(slider){slider.value=value; slider.dispatchEvent(new Event('input',{bubbles:true}));}
 });
 toast('Preset '+PRESETS[id].label+' appliqué aux contrôles visibles.');
}
function collect(){
 const out={};
 document.querySelectorAll('[id^="f-"]').forEach(el=>out[el.id.slice(2)]=Number(el.value));
 document.querySelectorAll('[data-element-range]').forEach(el=>out[el.dataset.elementRange]=Number(el.value));
 return out;
}
function previewPreset(id){
 const cfg={...collect(),...(PRESETS[id]?.config||{})};
 localStorage.setItem('spaceBgPreset','custom');
 localStorage.setItem('spaceBgCustomConfig',JSON.stringify(cfg));
 const frame=document.getElementById('home-preview');
 if(frame) frame.src='/?preview=universe-'+id+'-'+Date.now();
 toast('Aperçu '+PRESETS[id].label+' chargé.');
}
async function savePreset(id){
 const preset=PRESETS[id]; if(!preset)return;
 const current=await supabase.rpc('admin_get_space_background_config');
 if(current.error||current.data?.ok===false){toast('Lecture config impossible.');return;}
 await supabase.rpc('admin_backup_space_background_config',{p_label:'Avant preset '+preset.label});
 const config={...(current.data.config||{}),...preset.config};
 const {data,error}=await supabase.rpc('admin_set_space_background_config',{p_enabled:current.data.enabled!==false,p_config:config});
 if(error||data?.ok===false){toast(data?.error||error?.message||'Sauvegarde preset impossible');return;}
 toast('Preset '+preset.label+' sauvegardé en live avec backup préalable.');
 const frame=document.getElementById('home-preview'); if(frame) frame.src='/?preview=live-'+Date.now();
}
function toast(msg){const el=document.getElementById('toast'); if(el) el.textContent=msg;}
