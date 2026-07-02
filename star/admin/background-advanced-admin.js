import './background-universe-admin.js';
import { supabase } from '../../shared/supabase-client.js';

const SAFE={stars:1.1,nebula:.75,planets:.35,asteroids:.55,satellites:.25,crashes:.12,shake:.35,ships:1,speed:1,shipMax:6,trafficMode:'balanced'};
let state={enabled:true,config:{}};

wait();
function wait(){
 if(document.getElementById('element-grid')) return boot();
 const obs=new MutationObserver(()=>{if(document.getElementById('element-grid')){obs.disconnect();boot();}});
 obs.observe(document.body,{childList:true,subtree:true});
}
async function boot(){
 if(document.getElementById('advanced-bg-tools')) return;
 await load();
 render();
 await refreshBackups();
}
async function load(){
 const {data,error}=await supabase.rpc('admin_get_space_background_config');
 if(error||data?.ok===false) throw new Error(data?.error||error?.message||'Lecture impossible');
 state={enabled:data.enabled!==false,config:{...(data.config||{})}};
}
function render(){
 const target=document.querySelector('.bg-elements-wrap')||document.getElementById('ship-grid');
 const panel=document.createElement('section');
 panel.id='advanced-bg-tools';
 panel.innerHTML='<p class="bg-kicker" style="margin-top:18px">// APERÇU · BACKUP · RESET</p><section class="bg-card bg-note advanced-tools"><div class="element-presets"><button class="bg-btn" id="preview-live">APERÇU LIVE</button><button class="bg-btn" id="preview-unsaved">APERÇU NON SAUVÉ</button><button class="bg-btn" id="backup-now">BACKUP MAINTENANT</button><button class="bg-btn" id="restore-last">RESTORE DERNIER</button><button class="bg-btn primary" id="reset-safe">RESET SAFE</button></div><p class="bg-muted">Le reset safe crée d’abord un backup persistant Supabase, puis applique une configuration stable. L’aperçu non sauvegardé utilise un preset local temporaire dans l’iframe.</p><div class="advanced-preview"><iframe id="home-preview" src="/" loading="lazy" title="Aperçu accueil"></iframe></div><div class="backup-list" id="backup-list"></div></section>';
 target.insertAdjacentElement('beforebegin',panel);
 panel.querySelector('#preview-live').onclick=previewLive;
 panel.querySelector('#preview-unsaved').onclick=previewUnsaved;
 panel.querySelector('#backup-now').onclick=backupNow;
 panel.querySelector('#restore-last').onclick=restoreLast;
 panel.querySelector('#reset-safe').onclick=resetSafe;
}
function gatherVisibleConfig(){
 const cfg={...state.config};
 document.querySelectorAll('[id^="f-"]').forEach(el=>{cfg[el.id.slice(2)]=Number(el.value)});
 document.querySelectorAll('[data-element-range]').forEach(el=>{cfg[el.dataset.elementRange]=Number(el.value)});
 cfg.shipLibrary=state.config.shipLibrary||cfg.shipLibrary;
 return cfg;
}
function setToast(msg){const el=document.getElementById('toast'); if(el) el.textContent=msg;}
function previewLive(){
 localStorage.setItem('spaceBgPreset','live');
 document.getElementById('home-preview').src='/?preview='+Date.now();
 setToast('Aperçu live rechargé.');
}
function previewUnsaved(){
 localStorage.setItem('spaceBgPreset','custom');
 localStorage.setItem('spaceBgCustomConfig',JSON.stringify(gatherVisibleConfig()));
 document.getElementById('home-preview').src='/?preview=custom-'+Date.now();
 setToast('Aperçu temporaire chargé dans l’iframe.');
}
async function backupNow(label='Backup manuel'){
 const {data,error}=await supabase.rpc('admin_backup_space_background_config',{p_label:label});
 if(error||data?.ok===false){setToast(data?.error||error?.message||'Backup impossible');return null;}
 setToast('Backup créé.');
 await refreshBackups();
 return data.id;
}
async function resetSafe(){
 await load();
 await backupNow('Avant reset safe');
 const next={...state.config,...SAFE,shipLibrary:state.config.shipLibrary};
 const {data,error}=await supabase.rpc('admin_set_space_background_config',{p_enabled:true,p_config:next});
 if(error||data?.ok===false){setToast(data?.error||error?.message||'Reset impossible');return;}
 state={enabled:true,config:data.config||next};
 setToast('Reset safe appliqué. Recharge la page admin pour synchroniser les sliders.');
 previewLive();
}
async function refreshBackups(){
 const box=document.getElementById('backup-list'); if(!box) return;
 const {data,error}=await supabase.rpc('admin_list_space_background_backups',{p_limit:8});
 if(error||data?.ok===false){box.innerHTML='<p class="bg-muted">Backups indisponibles.</p>';return;}
 const backups=data.backups||[];
 box.innerHTML='<p class="bg-kicker">// DERNIERS BACKUPS</p>'+backups.map(b=>'<div class="backup-row"><span>'+new Date(b.created_at).toLocaleString('fr-FR')+' · '+(b.label||'Backup')+'</span><button class="bg-btn" data-restore="'+b.id+'">RESTORE</button></div>').join('');
 box.querySelectorAll('[data-restore]').forEach(btn=>btn.onclick=()=>restore(btn.dataset.restore));
}
async function restoreLast(){
 const {data,error}=await supabase.rpc('admin_list_space_background_backups',{p_limit:1});
 if(error||data?.ok===false||!data.backups?.[0]){setToast('Aucun backup à restaurer.');return;}
 restore(data.backups[0].id);
}
async function restore(id){
 const {data,error}=await supabase.rpc('admin_restore_space_background_backup',{p_backup_id:id});
 if(error||data?.ok===false){setToast(data?.error||error?.message||'Restauration impossible');return;}
 state={enabled:data.enabled!==false,config:data.config||{}};
 setToast('Backup restauré. Recharge la page admin pour synchroniser les sliders.');
 previewLive();
}
