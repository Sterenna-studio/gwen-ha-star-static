/**
 * star-arcade-core.js — playable Star Arcade router
 * Reconnects all mini-games from /star/casino/ with shared Nitro auth context.
 */
import { supabase } from '/shared/supabase-client.js';
import { NeonRacer } from './neon-racer.js';

const WAM_DURATION = 30;
const WAM_HOLES = 12;
const SLOT_SYMBOLS = [
  { id:'sniky',  name:'SNIKY',  img:'/shared/images/pixel_pp/pixel_pp_sniky.png',  mult:20, weight:1 },
  { id:'aligax', name:'ALIGAX', img:'/shared/images/pixel_pp/pixel_pp_aligax.png', mult:20, weight:1 },
  { id:'cowboy', name:'COWBOY', img:'/shared/images/pixel_pp/pixel_pp_cowboy.png', mult:15, weight:2 },
  { id:'abad',   name:'ABAD',   img:'/shared/images/pixel_pp/pixel_pp_abad.png',   mult:10, weight:3 },
  { id:'spirit', name:'SPIRIT', img:'/shared/images/pixel_pp/pixel_pp_spirit.png', mult:5,  weight:5 },
  { id:'star',   name:'STAR',   emoji:'⭐', mult:30, weight:1 },
  { id:'coin',   name:'COIN',   emoji:'🪙', mult:3,  weight:8 },
];

const el = (tag, cls, txt) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (txt != null) node.textContent = txt;
  return node;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const SFX = {
  _ctx:null,
  _g(){
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },
  tone(freq=440, type='sine', vol=.06, dur=.1) {
    const ctx = this._g(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + .01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur + .02);
  },
  click(){ this.tone(800, 'sine', .05, .06); },
  win(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.tone(f,'triangle',.08,.12),i*80)); },
  lose(){ [330,260,180].forEach((f,i)=>setTimeout(()=>this.tone(f,'sawtooth',.06,.14),i*90)); },
  tick(){ this.tone(1300, 'square', .025, .025); },
  crash(){ this.tone(100, 'sawtooth', .12, .35); },
};

export class StarArcadeCore {
  static async boot({ mount, user }) {
    const inst = new StarArcadeCore(mount, user);
    await inst.loadCredits();
    return inst;
  }

  constructor(mount, user) {
    this.mountSel = mount;
    this.user = user;
    this.userId = user?.id ?? null;
    this.credits = 0;
    this.bet = 10;
    this.history = [];
    this.currentGame = null;
    this.nr = null;
    this.nrResult = null;
    this.nrBack = null;
    this.wamTimers = [];
    this.wamRunning = false;
    this.wamRaf = null;
    this.crashRunning = false;
    this.crashRaf = null;
  }

  async loadCredits() {
    if (!this.userId) { this.credits = 500; return; }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('chronicles')
        .eq('id', this.userId)
        .maybeSingle();
      if (error) throw error;
      this.credits = data?.chronicles ?? 500;
      if (data?.chronicles == null) await this.saveCredits();
    } catch (error) {
      console.warn('[Star Arcade] credits fallback:', error?.message ?? error);
      this.credits = 500;
    }
  }

  async saveCredits() {
    if (!this.userId) return;
    try {
      await supabase
        .from('profiles')
        .update({ chronicles: this.credits })
        .eq('id', this.userId);
    } catch (error) {
      console.warn('[Star Arcade] credits save failed:', error?.message ?? error);
    }
    this.updateCreditsDisplay();
  }

  showLobby() {
    this.cleanupActiveGame();
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
            <span class="sb-credits-val" id="sb-credits">${this.format(this.credits)}</span>
            <span class="sb-dot"></span>
          </div>
        </nav>

        <section class="casino-lobby" id="view-lobby">
          <div class="lobby-hero">
            <h1 class="lobby-hero-title">ARCADE</h1>
            <p class="lobby-hero-sub">4 MINI-JEUX · CHRONICLES · STAR</p>
            <span class="lobby-hero-line"></span>
          </div>

          <div class="lobby-grid">
            ${this.card('wam','🔨','// JEU 01','WHACK-A-MOLE','30 secondes. Frappe les entités, évite les bombes, maximise ton combo.','RÉFLEXES · COMBO')}
            ${this.card('crash','🚀','// JEU 02','CRASH','Le multiplicateur monte. Éjecte-toi avant le crash pour encaisser.','RISQUE · AUTO-EJECT')}
            ${this.card('slots','🎰','// JEU 03','SLOT MACHINE','Aligne les symboles du crew pour gagner des Chronicles.','CHANCE · JACKPOT')}
            ${this.card('nr','🏁','// JEU 04','NEON RACER','Course arcade à axes alternés. Choisis ton véhicule et tes cœurs.','COURSE · SKILL')}
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

    ['wam','crash','slots','nr'].forEach(id => {
      document.getElementById(`card-${id}`)?.addEventListener('click', () => {
        SFX.click();
        this.showGame(id);
      });
    });
    this.renderHistory();
  }

  card(id, icon, tag, title, desc, meta) {
    return `<button class="game-card" id="card-${id}" style="--card-color:var(--c-primary)">
      <div class="gc-icon">${icon}</div><div class="gc-tag">${tag}</div>
      <div class="gc-title">${title}</div>
      <div class="gc-desc">${desc}</div>
      <div class="gc-meta"><span class="gc-badge">${meta}</span></div>
      <div class="gc-play-btn">▶ JOUER</div>
    </button>`;
  }

  showGame(name) {
    this.cleanupActiveGame();
    document.getElementById('view-lobby')?.style.setProperty('display','none');
    document.querySelectorAll('.casino-game').forEach(g => g.classList.remove('active'));
    document.getElementById(`game-${name}`)?.classList.add('active');
    this.currentGame = name;
    if (name === 'wam') this.initWam();
    if (name === 'crash') this.initCrash();
    if (name === 'slots') this.initSlots();
    if (name === 'nr') this.initNeonRacer();
  }

  backToLobby() {
    this.cleanupActiveGame();
    document.querySelectorAll('.casino-game').forEach(g => g.classList.remove('active'));
    document.getElementById('view-lobby')?.style.removeProperty('display');
    this.currentGame = null;
    this.updateCreditsDisplay();
    this.renderHistory();
  }

  cleanupActiveGame() {
    this.stopWam();
    this.stopCrash();
    this.cleanupNeonRacer();
  }

  header(title, accent='') {
    return `<div class="game-header">
      <button class="game-back-btn" id="game-back">← LOBBY</button>
      <span class="game-title">${title} ${accent ? `<span class="game-title-accent">${accent}</span>` : ''}</span>
    </div>`;
  }

  betPanel(id, presets=[1,5,10,25,50,100]) {
    return `<div class="bet-panel">
      <span class="bet-label">MISE</span>
      <button class="bet-btn" id="${id}-bet-down">−</button>
      <span class="bet-val" id="${id}-bet-val">${this.bet}</span>
      <button class="bet-btn" id="${id}-bet-up">+</button>
      <div class="bet-presets">${presets.map(p=>`<button class="bet-preset${this.bet===p?' active':''}" data-preset="${p}">${p}</button>`).join('')}</div>
    </div>`;
  }

  bindBetPanel(id) {
    const update = () => {
      const val = document.getElementById(`${id}-bet-val`);
      if (val) val.textContent = this.bet;
      document.querySelectorAll('.bet-preset').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.preset) === this.bet));
    };
    document.getElementById(`${id}-bet-down`)?.addEventListener('click', () => { this.bet = Math.max(1, this.bet - (this.bet > 10 ? 5 : 1)); update(); });
    document.getElementById(`${id}-bet-up`)?.addEventListener('click', () => { this.bet = Math.min(Math.max(1, this.credits), this.bet + (this.bet >= 10 ? 5 : 1)); update(); });
    document.querySelectorAll('.bet-preset').forEach(btn => btn.addEventListener('click', () => { this.bet = Math.min(this.credits, Number(btn.dataset.preset)); update(); }));
  }

  async debit(amount) {
    if (this.credits < amount) return false;
    this.credits -= amount;
    await this.saveCredits();
    return true;
  }

  async credit(amount) {
    this.credits += amount;
    await this.saveCredits();
  }

  addHistory(game, bet, result, gain) {
    this.history.unshift({ game, bet, result, gain, balance: this.credits, ts: Date.now() });
    if (this.history.length > 30) this.history.pop();
    this.renderHistory();
  }

  renderHistory() {
    const body = document.getElementById('history-body');
    if (!body) return;
    if (!this.history.length) {
      body.innerHTML = '<div class="history-empty">Aucune partie jouée</div>';
      return;
    }
    body.innerHTML = this.history.map(h => {
      const cls = h.result === 'win' ? 'win' : h.result === 'lose' ? 'lose' : 'push';
      const gain = h.gain > 0 ? `+${h.gain}` : `${h.gain}`;
      return `<div class="history-row ${cls}">
        <span>${h.game}</span><span class="history-result">${h.result.toUpperCase()}</span>
        <span>${h.bet} C</span><span class="history-gain">${gain} C</span><span>${this.format(h.balance)} C</span>
      </div>`;
    }).join('');
  }

  updateCreditsDisplay() {
    const el = document.getElementById('sb-credits');
    if (el) el.textContent = this.format(this.credits);
  }

  // WHACK-A-MOLE
  initWam() {
    const game = document.getElementById('game-wam');
    if (!game) return;
    game.innerHTML = `${this.header('WHACK-A-', 'MOLE')}${this.betPanel('wam')}
      <div class="wam-arena" id="wam-arena">
        <div class="wam-hud">
          <div class="wam-hud-block"><span class="wam-hud-label">SCORE</span><span class="wam-hud-val" id="wam-score">0</span></div>
          <div class="wam-hud-block"><span class="wam-hud-label">TEMPS</span><span class="wam-hud-val wam-timer" id="wam-timer">${WAM_DURATION}</span></div>
          <div class="wam-hud-block"><span class="wam-hud-label">COMBO</span><span class="wam-hud-val wam-combo" id="wam-combo">x1</span></div>
        </div>
        <div class="wam-grid" id="wam-grid">${Array.from({length: WAM_HOLES}, (_,i)=>`<button class="wam-hole" id="wam-hole-${i}"><span class="wam-mole">🤖</span></button>`).join('')}</div>
        <div class="wam-timebar-wrap"><div class="wam-timebar" id="wam-timebar"></div></div>
      </div>
      <div class="game-msg" id="wam-msg">MISE ET LANCE LA PARTIE</div>
      <div class="action-row"><button class="action-btn primary" id="wam-start">▶ DÉMARRER</button></div>`;
    document.getElementById('game-back')?.addEventListener('click', () => this.backToLobby());
    document.getElementById('wam-start')?.addEventListener('click', () => this.launchWam());
    this.bindBetPanel('wam');
  }

  async launchWam() {
    if (this.wamRunning) return;
    if (!(await this.debit(this.bet))) return this.setMsg('wam-msg', 'CRÉDITS INSUFFISANTS', 'lose');
    this.wamRunning = true;
    this.wamScore = 0;
    this.wamCombo = 1;
    this.wamStart = performance.now();
    document.getElementById('wam-start').disabled = true;
    this.setMsg('wam-msg', 'GO !', 'win');
    this.scheduleMoles();
    this.wamRaf = requestAnimationFrame(() => this.tickWam());
  }

  scheduleMoles() {
    if (!this.wamRunning) return;
    const holes = [...document.querySelectorAll('.wam-hole:not(.active)')];
    if (holes.length) this.popMole(holes[Math.floor(Math.random() * holes.length)]);
    this.wamTimers.push(setTimeout(() => this.scheduleMoles(), 350 + Math.random() * 500));
  }

  popMole(hole) {
    const types = [
      { emoji:'🤖', pts:1, cls:'normal' },
      { emoji:'⚡', pts:2, cls:'fast' },
      { emoji:'⭐', pts:5, cls:'golden' },
      { emoji:'💣', pts:-3, cls:'bomb' },
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    hole.className = `wam-hole active ${type.cls}`;
    hole.querySelector('.wam-mole').textContent = type.emoji;
    const timeout = setTimeout(() => hole.className = 'wam-hole', 750);
    const hit = () => {
      clearTimeout(timeout);
      if (!hole.classList.contains('active')) return;
      hole.className = 'wam-hole hit';
      const pts = type.pts < 0 ? type.pts : type.pts * this.wamCombo;
      this.wamScore = Math.max(0, this.wamScore + pts);
      this.wamCombo = type.pts < 0 ? 1 : Math.min(8, this.wamCombo + 1);
      document.getElementById('wam-score').textContent = this.wamScore;
      document.getElementById('wam-combo').textContent = `x${this.wamCombo}`;
      setTimeout(() => hole.className = 'wam-hole', 200);
      type.pts < 0 ? SFX.lose() : SFX.tick();
    };
    hole.onclick = hit;
  }

  tickWam() {
    if (!this.wamRunning) return;
    const elapsed = (performance.now() - this.wamStart) / 1000;
    const left = Math.max(0, WAM_DURATION - elapsed);
    document.getElementById('wam-timer').textContent = Math.ceil(left);
    document.getElementById('wam-timebar').style.transform = `scaleX(${left / WAM_DURATION})`;
    if (left <= 0) return this.endWam();
    this.wamRaf = requestAnimationFrame(() => this.tickWam());
  }

  async endWam() {
    this.stopWam();
    const gain = Math.round(this.bet * this.wamScore / 10);
    const net = gain - this.bet;
    if (gain > 0) await this.credit(gain);
    const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    this.addHistory('WHACK', this.bet, result, net);
    this.setMsg('wam-msg', `Score ${this.wamScore} · ${net >= 0 ? '+' : ''}${net} C`, result);
    const btn = document.getElementById('wam-start');
    if (btn) { btn.disabled = false; btn.textContent = '↺ REJOUER'; }
    result === 'win' ? SFX.win() : SFX.lose();
  }

  stopWam() {
    this.wamRunning = false;
    this.wamTimers.forEach(clearTimeout); this.wamTimers = [];
    if (this.wamRaf) cancelAnimationFrame(this.wamRaf);
    this.wamRaf = null;
  }

  // CRASH
  initCrash() {
    const game = document.getElementById('game-crash');
    if (!game) return;
    game.innerHTML = `${this.header('CRA', 'SH')}${this.betPanel('cr')}
      <div class="crash-layout">
        <div class="crash-canvas-wrap"><canvas class="crash-canvas" id="cr-canvas" width="800" height="220"></canvas><div class="crash-mult" id="cr-mult">1.00×</div></div>
        <div class="crash-controls"><button class="action-btn primary" id="cr-start">▶ LANCER</button><button class="action-btn" id="cr-eject" disabled>🚀 ÉJECTER</button></div>
        <div class="game-msg" id="cr-msg">MISE ET LANCE LE CRASH</div>
      </div>`;
    document.getElementById('game-back')?.addEventListener('click', () => this.backToLobby());
    document.getElementById('cr-start')?.addEventListener('click', () => this.startCrash());
    document.getElementById('cr-eject')?.addEventListener('click', () => this.ejectCrash());
    this.bindBetPanel('cr');
    this.drawCrash(1, false);
  }

  async startCrash() {
    if (this.crashRunning) return;
    if (!(await this.debit(this.bet))) return this.setMsg('cr-msg', 'CRÉDITS INSUFFISANTS', 'lose');
    this.crashRunning = true;
    this.crashCashed = false;
    this.crashTarget = this.crashPoint();
    this.crashT0 = performance.now();
    this.crashPoints = [[0, 1]];
    document.getElementById('cr-start').disabled = true;
    document.getElementById('cr-eject').disabled = false;
    this.loopCrash();
  }

  crashPoint() {
    const r = Math.random();
    if (r < .15) return 1.1 + Math.random() * .5;
    if (r < .55) return 1.6 + Math.random() * 2.4;
    if (r < .90) return 4 + Math.random() * 10;
    return 14 + Math.random() * 60;
  }

  loopCrash() {
    if (!this.crashRunning) return;
    const elapsed = (performance.now() - this.crashT0) / 1000;
    this.crashMult = Math.round(Math.pow(1.08, elapsed * 5) * 100) / 100;
    this.crashPoints.push([elapsed, this.crashMult]);
    document.getElementById('cr-mult').textContent = `${this.crashMult.toFixed(2)}×`;
    this.drawCrash(this.crashMult, false);
    if (this.crashMult >= this.crashTarget) return this.doCrash();
    this.crashRaf = requestAnimationFrame(() => this.loopCrash());
  }

  async ejectCrash() {
    if (!this.crashRunning || this.crashCashed) return;
    this.crashCashed = true;
    const gain = Math.round(this.bet * this.crashMult);
    await this.credit(gain);
    this.addHistory('CRASH', this.bet, 'win', gain - this.bet);
    this.setMsg('cr-msg', `ÉJECTÉ ×${this.crashMult.toFixed(2)} · +${gain - this.bet} C`, 'win');
    document.getElementById('cr-eject').disabled = true;
    SFX.win();
  }

  doCrash() {
    this.stopCrash(false);
    document.getElementById('cr-mult').textContent = `💥 ${this.crashMult.toFixed(2)}×`;
    this.drawCrash(this.crashMult, true);
    if (!this.crashCashed) {
      this.addHistory('CRASH', this.bet, 'lose', -this.bet);
      this.setMsg('cr-msg', `CRASH ×${this.crashMult.toFixed(2)} · PERDU`, 'lose');
      SFX.crash();
    }
    document.getElementById('cr-start').disabled = false;
    document.getElementById('cr-eject').disabled = true;
  }

  stopCrash(reset=true) {
    if (this.crashRaf) cancelAnimationFrame(this.crashRaf);
    this.crashRaf = null;
    this.crashRunning = false;
    if (reset) this.crashCashed = false;
  }

  drawCrash(mult, crashed) {
    const canvas = document.getElementById('cr-canvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#07080c'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    for (let i=1;i<5;i++) { ctx.beginPath(); ctx.moveTo(0,H*i/5); ctx.lineTo(W,H*i/5); ctx.stroke(); }
    if (!this.crashPoints?.length) return;
    const maxT = Math.max(this.crashPoints.at(-1)[0], 5);
    const maxM = Math.max(mult * 1.2, 2);
    const toX = t => (t / maxT) * W;
    const toY = m => H - (m / maxM) * H;
    ctx.beginPath(); ctx.strokeStyle = crashed ? '#ff4757' : '#00e5ff'; ctx.lineWidth = 3;
    this.crashPoints.forEach(([t,m], i) => i ? ctx.lineTo(toX(t), toY(m)) : ctx.moveTo(toX(t), toY(m)));
    ctx.stroke();
  }

  // SLOTS
  initSlots() {
    const game = document.getElementById('game-slots');
    if (!game) return;
    game.innerHTML = `${this.header('SLOT', 'MACHINE')}${this.betPanel('sl')}
      <div class="sl-machine">
        <div class="sl-scoreboard"><div class="sl-score-block"><span class="sl-score-lbl">GAIN</span><span class="sl-score-val sl-score-gain" id="sl-gain">—</span></div></div>
        <div class="sl-cabinet"><div class="sl-reels-wrap" id="slot-reels">${[0,1,2,3,4].map(i=>`<div class="sl-reel"><div class="sl-cell sl-cell--active" id="slot-cell-${i}">?</div></div>`).join('')}</div></div>
        <div class="sl-msg" id="sl-msg">MISE ET LANCE LES ROULEAUX</div>
        <div class="action-row"><button class="action-btn primary" id="sl-spin">🎰 LANCER</button></div>
      </div>`;
    document.getElementById('game-back')?.addEventListener('click', () => this.backToLobby());
    document.getElementById('sl-spin')?.addEventListener('click', () => this.spinSlots());
    this.bindBetPanel('sl');
  }

  async spinSlots() {
    if (!(await this.debit(this.bet))) return this.setMsg('sl-msg', 'CRÉDITS INSUFFISANTS', 'lose');
    const btn = document.getElementById('sl-spin');
    btn.disabled = true;
    const cells = [0,1,2,3,4].map(i => document.getElementById(`slot-cell-${i}`));
    for (let t=0;t<18;t++) {
      cells.forEach(c => c.innerHTML = this.slotHTML(this.rollSlot()));
      SFX.tick();
      await sleep(55 + t * 4);
    }
    const result = cells.map(() => this.rollSlot());
    result.forEach((sym, i) => cells[i].innerHTML = this.slotHTML(sym));
    const counts = result.reduce((acc, s) => (acc[s.id] = (acc[s.id] ?? 0) + 1, acc), {});
    const bestId = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    const best = result.find(s => s.id === bestId);
    const n = counts[bestId];
    let gain = 0;
    if (n >= 5) gain = Math.round(this.bet * best.mult);
    else if (n === 4) gain = Math.round(this.bet * best.mult * .35);
    else if (n === 3) gain = Math.round(this.bet * best.mult * .12);
    if (gain > 0) await this.credit(gain);
    const net = gain - this.bet;
    const status = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    document.getElementById('sl-gain').textContent = gain > 0 ? `+${gain}` : '—';
    this.setMsg('sl-msg', n >= 3 ? `${n}× ${best.name} · ${net >= 0 ? '+' : ''}${net} C` : '— RIEN CETTE FOIS', status);
    this.addHistory('SLOTS', this.bet, status, net);
    status === 'win' ? SFX.win() : SFX.lose();
    btn.disabled = false;
  }

  rollSlot() {
    const pool = [];
    SLOT_SYMBOLS.forEach(s => { for (let i=0;i<s.weight;i++) pool.push(s); });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  slotHTML(sym) {
    if (sym.emoji) return `<div class="sl-sym"><span style="font-size:42px">${sym.emoji}</span><span class="sl-sym-name">${sym.name}</span></div>`;
    return `<div class="sl-sym"><img src="${sym.img}" alt="${sym.name}" width="52" height="52" loading="lazy"><span class="sl-sym-name">${sym.name}</span></div>`;
  }

  // NEON RACER
  initNeonRacer() {
    const game = document.getElementById('game-nr');
    if (!game) return;
    game.innerHTML = '<div id="nr-mount"></div>';
    this.nrResult = (event) => {
      const { bet=50, result='push', net=0 } = event.detail ?? {};
      this.addHistory('NEON', bet, result, net);
      this.updateCreditsDisplay();
    };
    this.nrBack = () => this.backToLobby();
    document.addEventListener('neon-racer:result', this.nrResult);
    document.addEventListener('neon-racer:back', this.nrBack);
    this.nr = new NeonRacer('nr-mount', this.userId, this.credits, async (newCredits) => {
      this.credits = newCredits;
      this.updateCreditsDisplay();
      await this.saveCredits();
    });
    this.nr.mount();
  }

  cleanupNeonRacer() {
    if (this.nr) { this.nr._stop?.(); this.nr = null; }
    if (this.nrResult) { document.removeEventListener('neon-racer:result', this.nrResult); this.nrResult = null; }
    if (this.nrBack) { document.removeEventListener('neon-racer:back', this.nrBack); this.nrBack = null; }
  }

  setMsg(id, text, type='') {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = text;
    node.className = node.className.split(' ')[0] + (type ? ` ${type}` : '');
  }

  format(n) { return Number(n ?? 0).toLocaleString('fr-FR'); }
}
