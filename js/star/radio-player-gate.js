import { RadioPlayer } from './widgets.js';

if (!RadioPlayer.prototype.__manualJoinGate) {
  RadioPlayer.prototype.__manualJoinGate = true;
  const baseRender = RadioPlayer.prototype.render;

  RadioPlayer.prototype.render = async function manualJoinRender() {
    if (!this.el) return;
    if (this.__manualJoinReady) return baseRender.call(this);
    installGateStyles();

    const connect = async () => {
      if (this.__manualJoinReady) return;
      this.__manualJoinReady = true;
      setTopState('loading');
      await baseRender.call(this);
      this.audio.volume = 0.5;
      const vol = this.el.querySelector('#radio-vol');
      if (vol) vol.value = '0.5';
      setTopState('connected');
      this._play(true);
    };

    this.el.innerHTML = `<div class="radio-player radio-player-gated"><div class="radio-gated-inner"><span class="radio-gated-kicker">CHRONICLES FM · EN VEILLE</span><button class="radio-gated-btn" id="radio-join-flux" title="Rejoindre le flux pirate"><span>♪</span><b>REJOINDRE LE FLUX PIRATE</b></button><span class="radio-gated-note">Connexion manuelle · volume initial 50%</span></div></div>`;
    this.el.querySelector('#radio-join-flux')?.addEventListener('click', connect);
    mountTopButton(connect);
  };
}

function installGateStyles() {
  if (document.getElementById('radio-manual-gate-style')) return;
  const style = document.createElement('style');
  style.id = 'radio-manual-gate-style';
  style.textContent = `.radio-player-gated{display:grid;place-items:center;min-height:220px;border:1px solid rgba(233,69,96,.28);background:radial-gradient(circle at 50% 0,rgba(233,69,96,.12),transparent 55%),rgba(4,8,15,.65)}.radio-gated-inner{display:grid;gap:10px;justify-items:center;text-align:center;padding:18px}.radio-gated-kicker{font-size:10px;letter-spacing:.2em;color:#e94560;opacity:.75}.radio-gated-btn{display:inline-flex;align-items:center;gap:10px;border:1px solid #e94560;background:rgba(233,69,96,.08);color:#e94560;border-radius:999px;padding:10px 16px;font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:.14em;cursor:pointer}.radio-gated-btn:hover{background:rgba(233,69,96,.16);box-shadow:0 0 24px rgba(233,69,96,.22)}.radio-gated-note{font-size:10px;letter-spacing:.12em;color:var(--c-text-muted)}#sb-cfm.radio-top-join{position:relative;cursor:pointer;user-select:none}#sb-cfm.radio-top-join::after{content:attr(data-flux-tip);position:absolute;left:0;top:calc(100% + 8px);z-index:10000;white-space:nowrap;padding:6px 8px;border:1px solid #e94560;border-radius:4px;background:rgba(4,8,15,.96);color:#e94560;font:10px 'Share Tech Mono',monospace;letter-spacing:.12em;opacity:0;pointer-events:none;transform:translateY(-4px);transition:.18s}#sb-cfm.radio-top-join:hover::after{opacity:1;transform:translateY(0)}#sb-cfm.radio-top-loading span:last-child{color:#f59e0b!important}#sb-cfm.radio-top-connected span:last-child{color:#00ff9d!important}`;
  document.head.appendChild(style);
}

function setTopState(state) {
  const el = document.getElementById('sb-cfm');
  if (!el) return;
  el.classList.toggle('radio-top-loading', state === 'loading');
  el.classList.toggle('radio-top-connected', state === 'connected');
  const label = el.querySelector('span:last-child');
  if (label) label.textContent = state === 'loading' ? 'SYNCHRO FM' : state === 'connected' ? 'FLUX PIRATE' : '♪ FLUX';
}

function mountTopButton(connect) {
  installGateStyles();
  const el = document.getElementById('sb-cfm');
  if (!el || el.__radioTopJoin) return;
  el.__radioTopJoin = true;
  el.classList.add('radio-top-join');
  el.dataset.fluxTip = 'Rejoindre le flux pirate';
  el.title = 'Rejoindre le flux pirate';
  setTopState('idle');
  el.addEventListener('click', event => { event.preventDefault(); connect(); });
}
