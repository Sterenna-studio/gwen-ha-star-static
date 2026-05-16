/**
 * casino-core.js  —  STAR ARCADE  v1.6
 * Whack-A-Mole · Crash · Slot Machine · Neon Racer
 * Monnaie : Chronicles (Supabase profiles.chronicles)
 */
import { supabase }    from '../../../js/supabase.js';
import { SlotMachine } from '../../../js/star/widgets.js';
import { NeonRacer }   from './neon-racer.js';

const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

// ── SOUND ENGINE ──────────────────────────────────────────────────────
const SFX = {
  _ctx: null, _unlocked: false,
  _g() {
    if (!this._ctx) try{this._ctx=new(window.AudioContext||window.webkitAudioContext)();}catch{return null;}
    if (this._ctx.state==='suspended') this._ctx.resume();
    return this._ctx;
  },
  unlock() {
    if (this._unlocked) return; this._unlocked=true;
    const ctx=this._g(); if(ctx&&ctx.state==='suspended') ctx.resume();
  },
  _t(f,type,vol,atk,dec,t0) {
    const ctx=this._g();if(!ctx)return;
    const osc=ctx.createOscillator(),g=ctx.createGain();
    osc.connect(g);g.connect(ctx.destination);
    osc.type=type;osc.frequency.setValueAtTime(f,t0??ctx.currentTime);
    g.gain.setValueAtTime(0,t0??ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol,(t0??ctx.currentTime)+atk);
    g.gain.linearRampToValueAtTime(0,(t0??ctx.currentTime)+atk+dec);
    osc.start(t0??ctx.currentTime);osc.stop((t0??ctx.currentTime)+atk+dec+.01);
  },
  _n(vol,dur,t0) {
    const ctx=this._g();if(!ctx)return;
    const buf=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
    const s=ctx.createBufferSource(),g=ctx.createGain();
    s.buffer=buf;s.connect(g);g.connect(ctx.destination);
    g.gain.setValueAtTime(vol,t0??ctx.currentTime);
    g.gain.linearRampToValueAtTime(0,(t0??ctx.currentTime)+dur);
    s.start(t0??ctx.currentTime);
  },
  click()      { this._t(800,'sine',.06,.004,.05); },
  win()        { const ctx=this._g();if(!ctx)return;[523,659,784,1047].forEach((f,i)=>this._t(f,'triangle',.09,.01,.14,ctx.currentTime+i*.09)); },
  lose()       { const ctx=this._g();if(!ctx)return;[330,280,220].forEach((f,i)=>this._t(f,'sawtooth',.07,.01,.18,ctx.currentTime+i*.12)); },
  hover()      { if(!this._unlocked)return;this._t(1100,'sine',.03,.002,.03); },
  crash()      { const ctx=this._g();if(!ctx)return;[200,160,120].forEach((f,i)=>this._t(f,'sawtooth',.1,.005,.3,ctx.currentTime+i*.08));this._n(.1,.5); },
  eject()      { const ctx=this._g();if(!ctx)return;[660,880,1100].forEach((f,i)=>this._t(f,'triangle',.08,.005,.1,ctx.currentTime+i*.05)); },
  tick()       { this._t(1400,'square',.04,.002,.015); },
  whack()      { this._n(.12,.04);this._t(300,'square',.08,.003,.06); },
  bomb()       { const ctx=this._g();if(!ctx)return;[150,100,80].forEach((f,i)=>this._t(f,'sawtooth',.12,.005,.25,ctx.currentTime+i*.04));this._n(.1,.3); },
  golden()     { const ctx=this._g();if(!ctx)return;[880,1100,1320,1760].forEach((f,i)=>this._t(f,'sine',.08,.005,.15,ctx.currentTime+i*.05)); },
  countdown(n) { this._t(n===0?880:440,'square',.07,.005,.1); },
  wamEnd()     { const ctx=this._g();if(!ctx)return;[440,554,659,880].forEach((f,i)=>this._t(f,'triangle',.1,.01,.18,ctx.currentTime+i*.1)); },
};

// ── WAM CONFIG ────────────────────────────────────────────────────────
const WAM_DURATION   = 30;
const WAM_HOLES      = 12;
const WAM_MOLE_TYPES = [
  { type:'normal', emoji:'🤖', pts: 1,  prob:.55, spd:.9  },
  { type:'fast',   emoji:'⚡', pts: 2,  prob:.25, spd:.45 },
  { type:'bomb',   emoji:'💣', pts:-3,  prob:.12, spd:1.1 },
  { type:'golden', emoji:'⭐', pts: 5,  prob:.08, spd:.6  },
];

export class CasinoCore {
  static async boot({ mount, userId }) {
    const inst = new CasinoCore(mount, userId);
    await inst._loadCredits();
    return inst;
  }

  constructor(mountSel, userId) {
    this.mountSel  = mountSel;
    this.userId    = userId;
    this.credits   = 0;
    this.bet       = 10;
    this.history   = [];
    this._jackpot  = 500;
    this._currentGame   = null;
    this._nrInstance    = null;
    this._boundNRResult = null;
    this._boundNRBack   = null;
    this._sfxUnlockBound = null;
    // Crash
    this._crashMult=1.00; this._crashRunning=false;
    this._crashCashedOut=false; this._crashAnimId=null; this._crashBetActive=false;
    // WAM
    this._wamTimers=[]; this._wamRunning=false; this._wamRafId=null; this._wamEnding=false;
  }

  async _loadCredits() {
    if (!this.userId) { this.credits=500; return; }
    try {
      const {data}=await supabase.from('profiles').select('chronicles').eq('id',this.userId).single();
      this.credits=data?.chronicles??500;
    } catch { this.credits=500; }
  }

  async _saveCredits() {
    if (!this.userId) return;
    try { await supabase.from('profiles').update({chronicles:this.credits}).eq('id',this.userId); } catch {}
    this._updateCreditsDisplay();
  }

  _addHistory(game, bet, result, gain) {
    this.history.unshift({game,bet,result,gain,ts:Date.now()});
    if (this.history.length>30) this.history.pop();
    this._renderHistory();
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────
  showLobby() {
    const root = document.querySelector(this.mountSel);
    if (!root) return;
    root.innerHTML = `
    <div class="scanlines" aria-hidden="true"></div>
    <div class="casino-page" id="casino-page">
      <nav class="casino-statusbar">
        <div class="sb-left">
          <span class="sb-logo">STAR · ARCADE</span>
          <a href="/star/" class="sb-back">← RETOUR HUB</a>
        </div>
        <div class="sb-right">
          <span class="sb-credits-label">CHRONICLES</span>
          <span class="sb-credits-val" id="sb-credits">${this.credits.toLocaleString('fr-FR')}</span>
          <span class="sb-dot"></span>
        </div>
      </nav>

      <section class="casino-lobby" id="view-lobby">
        <div class="lobby-hero">
          <h1 class="lobby-hero-title">ARCADE</h1>
          <p class="lobby-hero-sub">STAR · CHRONICLES · JEUX · NÉON</p>
          <span class="lobby-hero-line"></span>
        </div>
        <div class="jackpot-banner" style="width:100%;max-width:500px;margin-bottom:40px">
          <span class="jp-icon">🏆</span>
          <span class="jp-label">JACKPOT PROGRESSIF</span>
          <span class="jp-val" id="jp-val">${this._jackpot.toLocaleString('fr-FR')} C</span>
        </div>
        <div class="lobby-grid">
          <div class="game-card" style="--card-color:var(--c-orange)" id="card-wam">
            <div class="gc-icon">🔨</div><div class="gc-tag">// JEU 01</div>
            <div class="gc-title">WHACK-A-MOLE</div>
            <div class="gc-desc">30 secondes. Frappe les entités cyber avant qu'elles replongent. Évite les bombes. La taupe dorée vaut ×5.</div>
            <div class="gc-meta"><span class="gc-badge">RÉFLEXES</span><span class="gc-badge">⭐ ×5 PTS</span><span class="gc-badge">30 SEC</span></div>
            <div class="gc-play-btn">▶ JOUER</div>
          </div>
          <div class="game-card" style="--card-color:var(--c-pink)" id="card-crash">
            <div class="gc-icon">🚀</div><div class="gc-tag">// JEU 02</div>
            <div class="gc-title">CRASH</div>
            <div class="gc-desc">Le multiplicateur monte. Éjecte-toi avant le crash. Plus tu attends, plus tu gagnes — mais le crash peut arriver à tout moment.</div>
            <div class="gc-meta"><span class="gc-badge">TENSION</span><span class="gc-badge">AUTO-EJECT</span><span class="gc-badge">∞×</span></div>
            <div class="gc-play-btn">▶ JOUER</div>
          </div>
          <div class="game-card" style="--card-color:var(--c-amber)" id="card-slots">
            <div class="gc-icon">🎰</div><div class="gc-tag">// JEU 03</div>
            <div class="gc-title">SLOT MACHINE</div>
            <div class="gc-desc">Tire les rouleaux. Aligne les symboles pour gagner des Chronicles. Jackpot progressif si trois étoiles s'alignent.</div>
            <div class="gc-meta"><span class="gc-badge">CHANCE</span><span class="gc-badge">JACKPOT</span><span class="gc-badge">★★★</span></div>
            <div class="gc-play-btn">▶ JOUER</div>
          </div>
          <div class="game-card" style="--card-color:var(--c-cyan)" id="card-nr">
            <div class="gc-icon">🏁</div><div class="gc-tag">// JEU 04</div>
            <div class="gc-title">NEON RACER</div>
            <div class="gc-desc">Horizontal puis vertical : l'axe bascule tous les 500m. Choisis tes cœurs (1❤ 50C · 2❤ 100C · 3❤ 200C) — chaque crash coûte une vie.</div>
            <div class="gc-meta"><span class="gc-badge">2 AXES</span><span class="gc-badge">❤️ VIES</span><span class="gc-badge">3 VÉHICULES</span></div>
            <div class="gc-play-btn">▶ JOUER</div>
          </div>
        </div>
        <div class="history-section" style="margin-top:48px;width:100%" id="history-section">
          <div class="history-head"><span>JEU</span><span>RÉSULTAT</span><span>MISE</span><span>GAIN</span><span>SOLDE</span></div>
          <div class="history-body" id="history-body"></div>
        </div>
      </section>

      <section class="casino-game" id="game-wam"></section>
      <section class="casino-game" id="game-crash"></section>
      <section class="casino-game" id="game-slots"></section>
      <section class="casino-game" id="game-nr"></section>
    </div>`;

    if (!this._sfxUnlockBound) {
      this._sfxUnlockBound=()=>{
        SFX.unlock();
        document.removeEventListener('click',this._sfxUnlockBound);
        document.removeEventListener('touchstart',this._sfxUnlockBound);
        this._sfxUnlockBound=null;
      };
      document.addEventListener('click',this._sfxUnlockBound,{once:true});
      document.addEventListener('touchstart',this._sfxUnlockBound,{once:true,passive:true});
    }
    document.getElementById('card-wam')?.addEventListener('click',   ()=>{SFX.click();this._showGame('wam');});
    document.getElementById('card-crash')?.addEventListener('click', ()=>{SFX.click();this._showGame('crash');});
    document.getElementById('card-slots')?.addEventListener('click', ()=>{SFX.click();this._showGame('slots');});
    document.getElementById('card-nr')?.addEventListener('click',    ()=>{SFX.click();this._showGame('nr');});
    ['card-wam','card-crash','card-slots','card-nr'].forEach(id=>
      document.getElementById(id)?.addEventListener('mouseenter',()=>SFX.hover())
    );
    this._renderHistory();
  }

  // ── NAV ───────────────────────────────────────────────────────────────
  _showGame(name) {
    document.getElementById('view-lobby')?.style.setProperty('display','none');
    document.querySelectorAll('.casino-game').forEach(g=>g.classList.remove('active'));
    const e=document.getElementById(`game-${name}`);
    if(!e)return;
    e.classList.add('active');
    this._currentGame=name;
    if      (name==='wam')   this._initWam();
    else if (name==='crash') this._initCrash();
    else if (name==='slots') this._initSlots();
    else if (name==='nr')    this._initNR();
  }

  _backToLobby() {
    this._wamStop();
    if(this._crashAnimId){cancelAnimationFrame(this._crashAnimId);this._crashAnimId=null;}
    this._cleanupNR();
    document.querySelectorAll('.casino-game').forEach(g=>g.classList.remove('active'));
    document.getElementById('view-lobby').style.removeProperty('display');
    this._updateCreditsDisplay();
    this._renderHistory();
    this._currentGame=null;
    this._loadCredits().then(()=>this._updateCreditsDisplay());
  }

  _cleanupNR() {
    if(this._nrInstance){this._nrInstance._stop();this._nrInstance=null;}
    if(this._boundNRResult){document.removeEventListener('neon-racer:result',this._boundNRResult);this._boundNRResult=null;}
    if(this._boundNRBack)  {document.removeEventListener('neon-racer:back',  this._boundNRBack);  this._boundNRBack=null;}
  }

  _updateCreditsDisplay() {
    const e=document.getElementById('sb-credits');
    if(e) e.textContent=this.credits.toLocaleString('fr-FR');
  }

  // ── BET PANEL ─────────────────────────────────────────────────────────
  _betPanelHTML(id) {
    const presets=[1,5,10,25,50,100];
    return `<div class="bet-panel">
      <span class="bet-label">MISE</span>
      <button class="bet-btn" id="${id}-bet-down">−</button>
      <span class="bet-val" id="${id}-bet-val">${this.bet}</span>
      <button class="bet-btn" id="${id}-bet-up">+</button>
      <div class="bet-presets">${presets.map(p=>`<button class="bet-preset${this.bet===p?' active':''}" data-preset="${p}">${p}</button>`).join('')}</div>
    </div>`;
  }

  _bindBetPanel(id) {
    const upd=()=>{
      const v=document.getElementById(`${id}-bet-val`);
      if(v) v.textContent=this.bet;
      document.querySelectorAll('.bet-preset').forEach(b=>b.classList.toggle('active',Number(b.dataset.preset)===this.bet));
    };
    document.getElementById(`${id}-bet-down`)?.addEventListener('click',()=>{SFX.click();this.bet=Math.max(1,this.bet-(this.bet>10?5:1));upd();});
    document.getElementById(`${id}-bet-up`)?.addEventListener('click',  ()=>{SFX.click();this.bet=Math.min(this.credits,this.bet+(this.bet>=10?5:1));upd();});
    document.querySelectorAll('.bet-preset').forEach(b=>
      b.addEventListener('click',()=>{SFX.click();this.bet=Math.min(this.credits,Number(b.dataset.preset));upd();})
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // NEON RACER — JEU 04
  // ══════════════════════════════════════════════════════════════════════
  _initNR() {
    this._cleanupNR();
    const g=document.getElementById('game-nr');
    g.innerHTML=`<div id="nr-mount"></div>`;
    this._boundNRResult=(e)=>{
      const{bet,result,net}=e.detail||{};
      this._addHistory('NEON RCR',bet??50,result??'push',net??0);
      this._updateCreditsDisplay();
    };
    this._boundNRBack=()=>{ this._cleanupNR();this._backToLobby(); };
    document.addEventListener('neon-racer:result',this._boundNRResult);
    document.addEventListener('neon-racer:back',  this._boundNRBack);
    this._nrInstance=new NeonRacer('nr-mount',this.userId,this.credits,(nc)=>{
      this.credits=nc;this._updateCreditsDisplay();
    });
    this._nrInstance.mount();
  }

  // ══════════════════════════════════════════════════════════════════════
  // WHACK-A-MOLE
  // ══════════════════════════════════════════════════════════════════════
  _initWam() {
    this._wamStop();this._wamEnding=false;
    const g=document.getElementById('game-wam');
    const holes=Array.from({length:WAM_HOLES},(_,i)=>
      `<div class="wam-hole" id="wh-${i}" data-idx="${i}" data-type="normal"><div class="wam-mole" id="wm-${i}">🤖</div></div>`
    ).join('');
    g.innerHTML=`
      <div class="game-header">
        <button class="game-back-btn" id="wam-back">← LOBBY</button>
        <span class="game-title">WHACK-A-<span class="game-title-accent">MOLE</span></span>
      </div>
      ${this._betPanelHTML('wam')}
      <div class="wam-arena" id="wam-arena">
        <div class="wam-hud">
          <div class="wam-hud-block"><span class="wam-hud-label">SCORE</span><span class="wam-hud-val" id="wam-score">0</span></div>
          <div class="wam-hud-block"><span class="wam-hud-label">TEMPS</span><span class="wam-hud-val wam-timer" id="wam-timer">${WAM_DURATION}</span></div>
          <div class="wam-hud-block"><span class="wam-hud-label">COMBO</span><span class="wam-hud-val wam-combo" id="wam-combo">x1</span></div>
          <div class="wam-hud-block"><span class="wam-hud-label">FRAPPÉES</span><span class="wam-hud-val" id="wam-hits" style="color:var(--c-green);font-size:1.2rem">0</span></div>
        </div>
        <div class="wam-grid" id="wam-grid">${holes}</div>
        <div class="wam-timebar-wrap"><div class="wam-timebar" id="wam-timebar"></div></div>
      </div>
      <div class="game-msg" id="wam-msg">MISE ET LANCE LA PARTIE</div>
      <div class="action-row"><button class="action-btn primary" id="wam-start">▶ DÉMARRER</button></div>`;
    document.getElementById('wam-back')?.addEventListener('click',()=>{this._wamStop();this._wamEnding=false;this._backToLobby();});
    this._wamBindStart();this._bindBetPanel('wam');
  }

  _wamBindStart() {
    const btn=document.getElementById('wam-start');
    if(btn) btn.onclick=()=>this._wamLaunch();
  }

  async _wamLaunch() {
    if(this._wamRunning)return;
    this._wamEnding=false;
    document.querySelector('.wam-result-screen')?.remove();
    if(this.credits<this.bet){this._wamMsg('CRÉDITS INSUFFISANTS','lose');return;}
    this.credits-=this.bet;await this._saveCredits();
    this._wamScore=0;this._wamHits=0;this._wamCombo=1;
    const btn=document.getElementById('wam-start');if(btn)btn.disabled=true;
    this._wamMsg('','');
    await this._wamCountdown();
    if(!document.getElementById('wam-start'))return;
    this._wamStart();
  }

  async _wamCountdown() {
    const arena=document.getElementById('wam-arena');if(!arena)return;
    for(const txt of ['3','2','1','GO!']){
      SFX.countdown(txt==='GO!'?0:1);
      const d=document.createElement('div');d.className='wam-countdown';d.textContent=txt;
      arena.appendChild(d);await this._delay(650);d.remove();
    }
  }

  _wamStart() {
    this._wamRunning=true;this._wamEnding=false;
    this._wamT0=performance.now();
    this._wamActiveHoles=new Array(WAM_HOLES).fill(null);
    this._wamHoleAborts=new Array(WAM_HOLES).fill(null);
    this._wamScheduleAll();
    this._wamRafId=requestAnimationFrame(()=>this._wamTick());
  }

  _wamTick() {
    if(!this._wamRunning)return;
    const elapsed=(performance.now()-this._wamT0)/1000;
    const timeLeft=Math.max(0,WAM_DURATION-elapsed);
    const timerEl=document.getElementById('wam-timer');
    const barEl=document.getElementById('wam-timebar');
    if(timerEl){timerEl.textContent=Math.ceil(timeLeft);timerEl.classList.toggle('urgent',timeLeft<=8);}
    if(barEl){barEl.style.transform=`scaleX(${timeLeft/WAM_DURATION})`;barEl.classList.toggle('urgent',timeLeft<=8);}
    if(timeLeft<=0){this._wamEnd();return;}
    this._wamRafId=requestAnimationFrame(()=>this._wamTick());
  }

  _wamScheduleAll() {
    const schedule=()=>{
      if(!this._wamRunning)return;
      const free=Array.from({length:WAM_HOLES},(_,i)=>i).filter(i=>!this._wamActiveHoles[i]);
      if(free.length===0){this._wamTimers.push(setTimeout(schedule,300));return;}
      const elapsed=(performance.now()-this._wamT0)/1000;
      const maxSim=elapsed<8?2:elapsed<18?3:4;
      if(this._wamActiveHoles.filter(Boolean).length<maxSim)
        this._wamPopMole(free[Math.floor(Math.random()*free.length)]);
      this._wamTimers.push(setTimeout(schedule,400+Math.random()*600));
    };
    schedule();
  }

  _wamPickType() {
    const r=Math.random();let cum=0;
    for(const t of WAM_MOLE_TYPES){cum+=t.prob;if(r<cum)return t;}
    return WAM_MOLE_TYPES[0];
  }

  _wamPopMole(idx) {
    if(!this._wamRunning)return;
    if(this._wamHoleAborts[idx]){this._wamHoleAborts[idx].abort();}
    const ac=new AbortController();
    this._wamHoleAborts[idx]=ac;
    const type=this._wamPickType();
    const hole=document.getElementById(`wh-${idx}`);
    const mole=document.getElementById(`wm-${idx}`);
    if(!hole||!mole)return;
    hole.dataset.type=type.type;mole.textContent=type.emoji;
    hole.classList.add('active');
    this._wamActiveHoles[idx]=type;
    const timer=setTimeout(()=>{
      if(!this._wamRunning)return;
      hole.classList.remove('active');this._wamActiveHoles[idx]=null;
    },type.spd*1000+400);
    this._wamTimers.push(timer);
    hole.addEventListener('click',(e)=>{
      e.stopPropagation();
      if(!this._wamRunning||!hole.classList.contains('active'))return;
      clearTimeout(timer);
      hole.classList.remove('active');this._wamActiveHoles[idx]=null;
      this._wamHitMole(idx,type,hole);
    },{once:true,signal:ac.signal});
  }

  _wamHitMole(idx,type,holeEl) {
    if(type.type==='bomb'){
      SFX.bomb();this._wamScore=Math.max(0,this._wamScore+type.pts);this._wamCombo=1;
      holeEl.classList.add('miss');
      this._wamPopScoreEl(holeEl,`${type.pts} 💥`,true);
      setTimeout(()=>holeEl.classList.remove('miss'),300);
    } else {
      const pts=type.pts*this._wamCombo;
      if(type.type==='golden')SFX.golden();else SFX.whack();
      this._wamScore+=pts;this._wamHits++;this._wamCombo=Math.min(8,this._wamCombo+1);
      holeEl.classList.add('hit');
      this._wamPopScoreEl(holeEl,`+${pts}`,false);
      setTimeout(()=>holeEl.classList.remove('hit'),300);
    }
    this._wamUpdateHUD();
  }

  _wamPopScoreEl(holeEl,txt,neg) {
    const p=el('div',`wam-score-pop${neg?' neg':''}`,txt);
    holeEl.appendChild(p);setTimeout(()=>p.remove(),900);
  }

  _wamUpdateHUD() {
    const s=document.getElementById('wam-score'),c=document.getElementById('wam-combo'),h=document.getElementById('wam-hits');
    if(s)s.textContent=this._wamScore;
    if(c)c.textContent=`x${this._wamCombo}`;
    if(h)h.textContent=this._wamHits;
  }

  _wamStop() {
    this._wamRunning=false;
    this._wamTimers.forEach(t=>clearTimeout(t));this._wamTimers=[];
    if(this._wamRafId){cancelAnimationFrame(this._wamRafId);this._wamRafId=null;}
    document.querySelectorAll('.wam-hole.active').forEach(h=>h.classList.remove('active'));
  }

  async _wamEnd() {
    if(this._wamEnding)return;
    this._wamEnding=true;this._wamStop();SFX.wamEnd();
    const score=this._wamScore??0;
    const gain=Math.round(this.bet*score/10);
    const net=gain-this.bet;
    const result=net>0?'win':net<0?'lose':'push';
    if(gain>0){this.credits+=gain;await this._saveCredits();}
    this._addHistory('WHACK',this.bet,result,net);
    document.querySelector('.wam-result-screen')?.remove();
    const arena=document.getElementById('wam-arena');
    if(arena){
      const res=document.createElement('div');res.className='wam-result-screen';
      const gainTxt=net>=0?`<span class="gain-pos">+${net} C</span>`:`<span class="gain-neg">${net} C</span>`;
      res.innerHTML=`
        <div class="wam-result-title">PARTIE TERMINÉE</div>
        <div class="wam-result-score">${score} PTS</div>
        <div class="wam-result-gain">MISE ${this.bet} C → GAIN <strong>${gain} C</strong> ${gainTxt}</div>
        <div style="font-size:11px;letter-spacing:.12em;color:var(--c-text-faint)">${this._wamHits} TAUPE${this._wamHits>1?'S':''} FRAPPÉE${this._wamHits>1?'S':''}</div>`;
      arena.appendChild(res);
    }
    this._wamMsg(net>0?`🔨 +${net} C — BIEN JOUÉ !`:net<0?`Score insuffisant — ${net} C`:'ÉGALITÉ — REMBOURSÉ',result);
    const btn=document.getElementById('wam-start');
    if(btn){btn.disabled=false;btn.textContent='↺ REJOUER';this._wamBindStart();}
  }

  _wamMsg(txt,type=''){
    const e=document.getElementById('wam-msg');
    if(!e)return;e.textContent=txt;e.className='game-msg'+(type?` ${type}`:'');
  }

  // ══════════════════════════════════════════════════════════════════════
  // CRASH GAME
  // ══════════════════════════════════════════════════════════════════════
  _initCrash() {
    this._crashMult=1.00;this._crashRunning=false;
    this._crashCashedOut=false;this._crashBetActive=false;
    if(this._crashAnimId){cancelAnimationFrame(this._crashAnimId);this._crashAnimId=null;}
    const g=document.getElementById('game-crash');
    g.innerHTML=`
      <div class="game-header">
        <button class="game-back-btn" id="cr-back">← LOBBY</button>
        <span class="game-title">CRA<span class="game-title-accent">SH</span></span>
      </div>
      ${this._betPanelHTML('cr')}
      <div class="crash-rules">
        <div class="crash-rules-title">⚡ COMMENT JOUER</div>
        <div class="crash-rules-grid">
          <div class="crash-rule-block"><span class="crb-icon">🚀</span><span class="crb-label">DÉCOLLAGE</span><span class="crb-desc">Mise ta mise puis lance. Le multiplicateur part de ×1.00 et monte à l'infini.</span></div>
          <div class="crash-rule-block"><span class="crb-icon">💥</span><span class="crb-label">LE CRASH</span><span class="crb-desc">À tout moment le serveur peut crasher. Si tu n'as pas éjecté, tu perds tout.</span></div>
          <div class="crash-rule-block"><span class="crb-icon">🛸</span><span class="crb-label">ÉJECTER</span><span class="crb-desc">Clique ÉJECTER avant le crash pour encaisser : mise × multiplicateur actuel.</span></div>
          <div class="crash-rule-block"><span class="crb-icon">🤖</span><span class="crb-label">AUTO-EJECT</span><span class="crb-desc">Configure un seuil auto. Ex : ×2 = éjection automatique dès que le mult atteint 2.</span></div>
        </div>
        <div class="crash-odds">
          <div class="crash-odds-title">📊 PROBABILITÉS DE CRASH</div>
          <div class="crash-odds-row">
            <div class="cod" style="--cod-c:var(--c-red)"><span class="cod-pct">10%</span><span class="cod-label">crash avant ×1.5</span></div>
            <div class="cod" style="--cod-c:var(--c-orange)"><span class="cod-pct">30%</span><span class="cod-label">crash entre ×1.5 et ×3</span></div>
            <div class="cod" style="--cod-c:var(--c-amber)"><span class="cod-pct">30%</span><span class="cod-label">crash entre ×3 et ×7</span></div>
            <div class="cod" style="--cod-c:var(--c-green)"><span class="cod-pct">20%</span><span class="cod-label">crash entre ×7 et ×30</span></div>
            <div class="cod" style="--cod-c:var(--c-cyan)"><span class="cod-pct">7%</span><span class="cod-label">crash entre ×30 et ×100+</span></div>
          </div>
          <div class="crash-odds-note">Chaque partie est indépendante. Le passé n'influence pas le futur.</div>
        </div>
      </div>
      <div class="crash-layout">
        <div class="crash-canvas-wrap">
          <canvas class="crash-canvas" id="cr-canvas" width="800" height="220"></canvas>
          <div class="crash-mult" id="cr-mult">1.00×</div>
        </div>
        <div class="crash-history" id="cr-history"></div>
        <div class="crash-controls">
          <button class="action-btn primary" id="cr-start">▶ LANCER</button>
          <button class="action-btn" id="cr-eject" disabled style="--game-accent:var(--c-pink)">🚀 ÉJECTER</button>
          <div class="crash-autoeject-row">AUTO-EJECT ×<input class="crash-autoeject-inp" id="cr-auto" type="number" min="1.1" max="100" step="0.1" value="2.0"></div>
        </div>
        <div class="game-msg" id="cr-msg">MISE ET LANCE LE CRASH</div>
      </div>`;
    document.getElementById('cr-back')?.addEventListener('click',()=>{this._crashAbort();this._backToLobby();});
    document.getElementById('cr-start')?.addEventListener('click',()=>this._crashStart());
    document.getElementById('cr-eject')?.addEventListener('click',()=>this._crashEject());
    this._bindBetPanel('cr');
    this._crashDrawCanvas(1.00,false);
  }

  _crashCrashPoint() {
    const r=Math.random();
    if(r<0.10)return 1.00+Math.random()*0.5;
    if(r<0.40)return 1.5+Math.random()*1.5;
    if(r<0.70)return 3.0+Math.random()*4.0;
    if(r<0.90)return 7.0+Math.random()*23.0;
    if(r<0.97)return 30+Math.random()*70;
    return 100+Math.random()*900;
  }

  async _crashStart() {
    if(this._crashRunning)return;
    if(this.credits<this.bet){this._crashMsg('CRÉDITS INSUFFISANTS','lose');return;}
    this.credits-=this.bet;await this._saveCredits();
    this._crashBetActive=true;this._crashRunning=true;
    this._crashCashedOut=false;this._crashMult=1.00;
    this._crashTarget=this._crashCrashPoint();
    this._crashAutoEject=parseFloat(document.getElementById('cr-auto')?.value??'2')||0;
    this._crashPoints=[[0,0]];this._crashT0=performance.now();
    document.getElementById('cr-start').disabled=true;
    document.getElementById('cr-eject').disabled=false;
    this._crashMsg('EN VOL — ÉJECTE-TOI !','neutral');
    this._crashLoop();
  }

  _crashLoop() {
    const step=()=>{
      if(!this._crashRunning)return;
      const elapsed=(performance.now()-this._crashT0)/1000;
      this._crashMult=Math.round(Math.pow(1.06,elapsed*6)*100)/100;
      const multEl=document.getElementById('cr-mult');
      if(multEl)multEl.textContent=`${this._crashMult.toFixed(2)}×`;
      this._crashPoints.push([elapsed,this._crashMult]);
      this._crashDrawCanvas(this._crashMult,false);
      SFX.tick();
      if(this._crashAutoEject>1&&this._crashMult>=this._crashAutoEject&&!this._crashCashedOut){this._crashEject();return;}
      if(this._crashMult>=this._crashTarget){this._crashDoCrash();return;}
      this._crashAnimId=requestAnimationFrame(step);
    };
    this._crashAnimId=requestAnimationFrame(step);
  }

  _crashEject() {
    if(!this._crashRunning||this._crashCashedOut||!this._crashBetActive)return;
    SFX.eject();this._crashCashedOut=true;
    const gain=Math.round(this.bet*this._crashMult);
    this.credits+=gain;this._saveCredits();
    this._crashMsg(`🚀 ÉJECTÉ × ${this._crashMult.toFixed(2)} — +${gain} C`,'win');
    this._addHistory('CRASH',this.bet,'win',gain-this.bet);
    this._addCrashPill(this._crashMult,'safe');
    document.getElementById('cr-eject').disabled=true;
  }

  _crashDoCrash() {
    cancelAnimationFrame(this._crashAnimId);this._crashRunning=false;
    const m=document.getElementById('cr-mult');
    if(m){m.textContent=`💥 ${this._crashMult.toFixed(2)}×`;m.classList.add('crashed');}
    SFX.crash();this._crashDrawCanvas(this._crashMult,true);
    if(!this._crashCashedOut){
      this._crashMsg(`CRASH × ${this._crashMult.toFixed(2)} — PERDU`,'lose');
      this._addHistory('CRASH',this.bet,'lose',-this.bet);
      const cat=this._crashMult<1.5?'danger':this._crashMult<3?'risky':'safe';
      this._addCrashPill(this._crashMult,cat);
    }
    this._crashBetActive=false;
    document.getElementById('cr-start').disabled=false;
    document.getElementById('cr-eject').disabled=true;
    setTimeout(()=>{const m=document.getElementById('cr-mult');if(m){m.classList.remove('crashed');m.textContent='1.00×';}},2000);
  }

  _crashAbort() {
    if(this._crashAnimId)cancelAnimationFrame(this._crashAnimId);
    this._crashRunning=false;
  }

  _addCrashPill(mult,cat) {
    const wrap=document.getElementById('cr-history');if(!wrap)return;
    const p=el('span',`crash-hist-pill ${cat}`,`${mult.toFixed(2)}×`);
    wrap.insertBefore(p,wrap.firstChild);
    if(wrap.children.length>12)wrap.lastChild?.remove();
  }

  _crashDrawCanvas(mult,crashed) {
    const canvas=document.getElementById('cr-canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#07080c';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
    for(let i=1;i<5;i++){
      ctx.beginPath();ctx.moveTo(0,H*i/5);ctx.lineTo(W,H*i/5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(W*i/5,0);ctx.lineTo(W*i/5,H);ctx.stroke();
    }
    if(!this._crashPoints||this._crashPoints.length<2)return;
    const maxT=Math.max(this._crashPoints[this._crashPoints.length-1][0],5);
    const maxM=Math.max(mult*1.2,2);
    const toX=t=>(t/maxT)*W;
    const toY=m=>H-(m/maxM)*H;
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,crashed?'rgba(255,71,87,.18)':'rgba(0,229,255,.15)');
    grad.addColorStop(1,'transparent');
    ctx.beginPath();
    ctx.moveTo(toX(this._crashPoints[0][0]),H);
    this._crashPoints.forEach(([t,m])=>ctx.lineTo(toX(t),toY(m)));
    ctx.lineTo(toX(this._crashPoints[this._crashPoints.length-1][0]),H);
    ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle=crashed?'#ff4757':'#00e5ff';
    ctx.lineWidth=2.5;ctx.shadowColor=crashed?'#ff4757':'#00e5ff';ctx.shadowBlur=8;
    this._crashPoints.forEach(([t,m],i)=>{
      if(i===0)ctx.moveTo(toX(t),toY(m));
      else ctx.lineTo(toX(t),toY(m));
    });
    ctx.stroke();ctx.shadowBlur=0;
    const last=this._crashPoints[this._crashPoints.length-1];
    ctx.beginPath();
    ctx.arc(toX(last[0]),toY(last[1]),5,0,Math.PI*2);
    ctx.fillStyle=crashed?'#ff4757':'#00e5ff';
    ctx.shadowColor=crashed?'#ff4757':'#00e5ff';ctx.shadowBlur=12;
    ctx.fill();ctx.shadowBlur=0;
  }

  _crashMsg(txt,type='neutral'){
    const e=document.getElementById('cr-msg');
    if(!e)return;e.textContent=txt;
    e.className='game-msg'+(type?` ${type}`:'');
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLOT MACHINE
  // ══════════════════════════════════════════════════════════════════════
  _initSlots() {
    const g=document.getElementById('game-slots');
    g.innerHTML=`
      <div class="game-header">
        <button class="game-back-btn" id="sl-back">← LOBBY</button>
        <span class="game-title">SLOT <span class="game-title-accent" style="--game-accent:var(--c-amber)">MACHINE</span></span>
      </div>
      <div id="sl-mount"></div>`;
    document.getElementById('sl-back')?.addEventListener('click',()=>this._backToLobby());
    const sm=new SlotMachine('sl-mount',{userId:this.userId});
    sm.init();
  }

  // ══════════════════════════════════════════════════════════════════════
  // HISTORY
  // ══════════════════════════════════════════════════════════════════════
  _renderHistory() {
    const body=document.getElementById('history-body');if(!body)return;
    if(!this.history.length){body.innerHTML='<div class="history-empty">Aucune partie jouée</div>';return;}
    let running=this.credits;
    const withBal=this.history.map(h=>{
      const bal=running;
      running-=h.gain;
      return{...h,bal};
    });
    body.innerHTML=withBal.map(h=>{
      const resClass=h.result==='win'?'win':h.result==='lose'?'lose':'push';
      const gainTxt=h.gain>0?`+${h.gain}`:h.gain;
      return `<div class="history-row ${resClass}">
        <span>${h.game}</span>
        <span class="history-result">${h.result.toUpperCase()}</span>
        <span>${h.bet} C</span>
        <span class="history-gain">${gainTxt} C</span>
        <span>${h.bal.toLocaleString('fr-FR')} C</span>
      </div>`;
    }).join('');
  }

  // ── UTILS ──────────────────────────────────────────────────────────────
  _delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
}
