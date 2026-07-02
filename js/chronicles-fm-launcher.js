const PHRASE = 'Rejoindre le flux pirate';
let started = false;
let loading = false;

function styleLauncher(){
  if(document.getElementById('cfm-launcher-style')) return;
  const style = document.createElement('style');
  style.id = 'cfm-launcher-style';
  style.textContent = `
    #sb-cfm.cfm-launcher{position:relative;cursor:pointer;user-select:none}
    #sb-cfm.cfm-launcher:hover span:last-child{color:#e94560!important}
    #sb-cfm.cfm-launcher::after{content:attr(data-cfm-tip);position:absolute;left:0;top:calc(100% + 8px);z-index:10000;white-space:nowrap;padding:6px 8px;border:1px solid #e94560;border-radius:4px;background:rgba(4,8,15,.96);color:#e94560;font:10px 'Share Tech Mono',monospace;letter-spacing:.12em;opacity:0;pointer-events:none;transform:translateY(-4px);transition:.18s}
    #sb-cfm.cfm-launcher:hover::after{opacity:1;transform:translateY(0)}
    #sb-cfm.cfm-loading span:last-child{color:#f59e0b!important}
    #sb-cfm.cfm-connected span:last-child{color:#00ff9d!important}
  `;
  document.head.appendChild(style);
}

function setLabel(text){
  const label = document.querySelector('#sb-cfm span:last-child');
  if(label) label.textContent = text;
}

function setState(state){
  const el = document.getElementById('sb-cfm');
  if(!el) return;
  el.classList.toggle('cfm-loading', state === 'loading');
  el.classList.toggle('cfm-connected', state === 'connected');
  setLabel(state === 'loading' ? 'SYNCHRO FM' : state === 'connected' ? 'FLUX PIRATE' : '♪ FLUX');
}

function setVolume50(){
  const slider = document.getElementById('cfm-vol-slider');
  if(!slider) return false;
  slider.value = '50';
  slider.dispatchEvent(new Event('input', { bubbles:true }));
  return true;
}

function openAndPlay(){
  setVolume50();
  const bar = document.getElementById('cfm-bar');
  const tab = document.getElementById('cfm-tab');
  if(bar && tab && !bar.classList.contains('cfm-open')) tab.click();
  const play = document.getElementById('cfm-play-btn');
  if(play && play.textContent.trim() === '▶') play.click();
}

function waitForWidget(){
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if(document.getElementById('cfm-play-btn')){
      clearInterval(timer);
      setState('connected');
      openAndPlay();
    }else if(tries > 80){
      clearInterval(timer);
      setState('connected');
    }
  }, 125);
}

async function connectFlux(){
  if(started){ openAndPlay(); return; }
  if(loading) return;
  loading = true;
  setState('loading');
  await import('./chronicles-fm-widget.js?v=pirate-gated');
  started = true;
  loading = false;
  waitForWidget();
}

function mount(){
  styleLauncher();
  const el = document.getElementById('sb-cfm');
  if(!el) return;
  el.classList.add('cfm-launcher');
  el.dataset.cfmTip = PHRASE;
  el.title = PHRASE;
  setState('idle');
  el.addEventListener('click', e => {
    e.preventDefault();
    connectFlux();
  });
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mount) : mount();
