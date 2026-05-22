/**
 * star-arcade-core.js — Star Arcade playable and balanced core
 * Mini-jeux : Whack-A-Mole · Crash · Slot Machine · Neon Racer
 * Monnaie : Chronicles (profiles.chronicles)
 */
import { supabase } from '/shared/supabase-client.js';
import { NeonRacer } from './neon-racer.js';

const WAM_DURATION = 30;
const WAM_HOLES = 12;
const WAM_TYPES = [
  { emoji:'🤖', pts: 1, cls:'normal', weight:54, ttl:850 },
  { emoji:'⚡', pts: 2, cls:'fast',   weight:23, ttl:520 },
  { emoji:'⭐', pts: 5, cls:'golden', weight:8,  ttl:650 },
  { emoji:'💣', pts:-4, cls:'bomb',   weight:15, ttl:900 },
];

const SLOT_ROWS = 3;
const SLOT_COLS = 5;
const SLOT_LINES = [
  { id:'mid', name:'MILIEU', rows:[1,1,1,1,1], mult:1.0, color:'#00ff80' },
  { id:'top', name:'HAUT', rows:[0,0,0,0,0], mult:.55, color:'#60a5fa' },
  { id:'bot', name:'BAS', rows:[2,2,2,2,2], mult:.55, color:'#f97316' },
  { id:'d1', name:'DIAG ↘', rows:[0,0,1,2,2], mult:.75, color:'#f472b6' },
  { id:'d2', name:'DIAG ↗', rows:[2,2,1,0,0], mult:.75, color:'#c084fc' },
];
const SLOT_SYMBOLS = [
  { id:'coin',   name:'COIN',   emoji:'🪙', weight:34, pay:{3:.35, 4:.9,  5:2.5} },
  { id:'leaf',   name:'LEAF',   emoji:'🍃', weight:26, pay:{3:.45, 4:1.2, 5:4} },
  { id:'spirit', name:'SPIRIT', img:'/shared/images/pixel_pp/pixel_pp_spirit.png', weight:18, pay:{3:.7, 4:2.2, 5:7} },
  { id:'abad',   name:'ABAD',   img:'/shared/images/pixel_pp/pixel_pp_abad.png',   weight:11, pay:{3:1.1, 4:4,   5:14} },
  { id:'cowboy', name:'COWBOY', img:'/shared/images/pixel_pp/pixel_pp_cowboy.png', weight:7,  pay:{3:1.7, 4:7,   5:24} },
  { id:'aligax', name:'ALIGAX', img:'/shared/images/pixel_pp/pixel_pp_aligax.png', weight:3,  pay:{3:3.5, 4:18,  5:70} },
  { id:'sniky',  name:'SNIKY',  img:'/shared/images/pixel_pp/pixel_pp_sniky.png',  weight:3,  pay:{3:3.5, 4:18,  5:70} },
  { id:'star',   name:'STAR',   emoji:'⭐', weight:2, pay:{3:6, 4:35, 5:140} },
];

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
  jackpot(){ [523,659,784,1047,1319,1568].forEach((f,i)=>setTimeout(()=>this.tone(f,i%2?'triangle':'square',.08,.14),i*65)); },
  crash(){ this.tone(100, 'sawtooth', .12, .35); },
};

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
}

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
    this.slotSpinning = false;
    this.slotStats = { spins:0, wagered:0, paid:0 };
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
      await supabase.from('profiles').update({ chronicles: this.credits }).eq('id', this.userId);
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
          <div class="jackpot-banner" style="width:100%;max-width:620px;margin-bottom:32px">
            <span class="jp-icon">⚖️</span>
            <span class="jp-label">MODE ALPHA ÉQUILIBRÉ</span>
            <span class="jp-val" id="jp-val">MISES LIMITÉES</span>
          </div>
          <div class="lobby-grid">
            ${this.card('wam','🔨','// JEU 01','WHACK-A-MOLE','30 secondes. Frappe les entités, évite les bombes, garde ton combo. Jeu plutôt skill.','RTP CIBLE ~95%')}
            ${this.card('crash','🚀','// JEU 02','CRASH','Le multiplicateur monte. Éjecte-toi avant le crash ou utilise l’auto-eject.','RTP CIBLE ~93%')}
            ${this.card('slots','🎰','// JEU 03','SLOT MACHINE','5 rouleaux × 3 lignes. Gains gauche → droite sur 5 lignes. Version réparée.','RTP CIBLE ~90%')}
            ${this.card('nr','🏁','// JEU 04','NEON RACER','Course arcade à axes alternés. Choisis véhicule et cœurs. Jeu skill/risque.','SKILL · COURSE')}
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
    return `<button class="game-card" id="card-${id}" style="--card-color:${this.gameColor(id)}">
      <div class="gc-icon">${icon}</div><div class="gc-tag">${tag}</div>
      <div class="gc-title">${title}</div>
      <div class="gc-desc">${desc}</div>
      <div class="gc-meta"><span class="gc-badge">${meta}</span></div>
      <div class="gc-play-btn">▶ JOUER</div>
    </button>`;
  }

  gameColor(id) {
    return { wam:'var(--c-orange)', crash:'var(--c-pink)', slots:'var(--c-amber)', nr:'var(--c-cyan)' }[id] ?? 'var(--c-primary)';
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
    this.slotSpinning = false;
  }

  header(title, accent='') {
    return `<div class="game-header">
      <button class="game-back-btn" id="game-back">← LOBBY</button>
      <span class="game-title">${title} ${accent ? `<span class="game-title-accent">${accent}</span>` : ''}</span>
    </div>`;
  }

  betPanel(id, presets=[1,5,10,25,50,100]) {
    const maxBet = Math.max(1, Math.min(100, this.credits));
    if (this.bet > maxBet) this.bet = maxBet;
    return `<div class="bet-panel">
      <span class="bet-label">MISE</span>
      <button class="bet-btn" id="${id}-bet-down">−</button>
      <span class="bet-val" id="${id}-bet-val">${this.bet}</span>
      <button class="bet-btn" id="${id}-bet-up">+</button>
      <div class="bet-presets">${presets.map(p=>`<button class="bet-preset${this.bet===p?' active':''}" data-preset="${p}" ${p>this.credits?'disabled':''}>${p}</button>`).join('')}</div>
    </div>`;
  }

  bindBetPanel(id) {
    const update = () => {
      const maxBet = Math.max(1, Math.min(100, this.credits));
      this.bet = Math.max(1, Math.min(maxBet, this.bet));
      const val = document.getElementById(`${id}-bet-val`);
      if (val) val.textContent = this.bet;
      document.querySelectorAll('.bet-preset').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.preset) === this.bet);
        btn.disabled = Number(btn.dataset.preset) > this.credits;
      });
    };
    document.getElementById(`${id}-bet-down`)?.addEventListener('click', () => { SFX.click(); this.bet = Math.max(1, this.bet - (this.bet > 10 ? 5 : 1)); update(); });
    document.getElementById(`${id}-bet-up`)?.addEventListener('click', () => { SFX.click(); this.bet = this.bet + (this.bet >= 10 ? 5 : 1); update(); });
    document.querySelectorAll('.bet-preset').forEach(btn => btn.addEventListener('click', () => { SFX.click(); this.bet = Number(btn.dataset.preset); update(); }));
    update();
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
          <div class="wam-hud-block"><span class="wam-hud-label">RATIO</span><span class="wam-hud-val" id="wam-target" style="color:var(--c-green);font-size:1.15rem">10 pts = mise</span></div>
        </div>
        <div class="wam-grid" id="wam-grid">${Array.from({length: WAM_HOLES}, (_,i)=>`<button class="wam-hole" id="wam-hole-${i}" data-type="normal"><span class="wam-mole">🤖</span></button>`).join('')}</div>
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
    this.wamHits = 0;
    this.wamStart = performance.now();
    document.getElementById('wam-start').disabled = true;
    this.setMsg('wam-msg', 'GO !', 'neutral');
    this.scheduleMoles();
    this.wamRaf = requestAnimationFrame(() => this.tickWam());
  }

  scheduleMoles() {
    if (!this.wamRunning) return;
    const holes = [...document.querySelectorAll('.wam-hole:not(.active)')];
    const elapsed = (performance.now() - this.wamStart) / 1000;
    const maxActive = elapsed < 8 ? 2 : elapsed < 20 ? 3 : 4;
    if (holes.length && document.querySelectorAll('.wam-hole.active').length < maxActive) {
      this.popMole(holes[Math.floor(Math.random() * holes.length)]);
    }
    this.wamTimers.push(setTimeout(() => this.scheduleMoles(), 320 + Math.random() * 500));
  }

  popMole(hole) {
    const type = weightedPick(WAM_TYPES);
    hole.className = `wam-hole active ${type.cls}`;
    hole.dataset.type = type.cls;
    hole.querySelector('.wam-mole').textContent = type.emoji;
    const timeout = setTimeout(() => { hole.className = 'wam-hole'; }, type.ttl);
    hole.onclick = () => {
      clearTimeout(timeout);
      if (!hole.classList.contains('active')) return;
      const pts = type.pts < 0 ? type.pts : type.pts * this.wamCombo;
      this.wamScore = Math.max(0, this.wamScore + pts);
      this.wamHits += type.pts > 0 ? 1 : 0;
      this.wamCombo = type.pts < 0 ? 1 : Math.min(8, this.wamCombo + 1);
      document.getElementById('wam-score').textContent = this.wamScore;
      document.getElementById('wam-combo').textContent = `x${this.wamCombo}`;
      hole.className = `wam-hole ${type.pts < 0 ? 'miss' : 'hit'}`;
      const pop = document.createElement('span');
      pop.className = `wam-score-pop${type.pts < 0 ? ' neg' : ''}`;
      pop.textContent = `${pts > 0 ? '+' : ''}${pts}`;
      hole.appendChild(pop);
      setTimeout(() => { hole.className = 'wam-hole'; pop.remove(); }, 260);
      type.pts < 0 ? SFX.lose() : SFX.tick();
    };
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
    const gain = Math.max(0, Math.round(this.bet * this.wamScore / 12));
    const net = gain - this.bet;
    if (gain > 0) await this.credit(gain);
    const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    this.addHistory('WHACK', this.bet, result, net);
    this.setMsg('wam-msg', `Score ${this.wamScore} · ${this.wamHits} hits · ${net >= 0 ? '+' : ''}${net} C`, result);
    const btn = document.getElementById('wam-start');
    if (btn) { btn.disabled = false; btn.textContent = '↺ REJOUER'; }
    result === 'win' ? SFX.win() : SFX.lose();
  }

  stopWam() {
    this.wamRunning = false;
    this.wamTimers.forEach(clearTimeout); this.wamTimers = [];
    if (this.wamRaf) cancelAnimationFrame(this.wamRaf);
    this.wamRaf = null;
    document.querySelectorAll('.wam-hole.active').forEach(h => h.className = 'wam-hole');
  }

  // CRASH
  initCrash() {
    const game = document.getElementById('game-crash');
    if (!game) return;
    game.innerHTML = `${this.header('CRA', 'SH')}${this.betPanel('cr')}
      <div class="crash-rules">
        <div class="crash-rules-title">⚡ COMMENT JOUER</div>
        <div class="crash-rules-grid">
          <div class="crash-rule-block"><span class="crb-icon">🚀</span><span class="crb-label">DÉCOLLAGE</span><span class="crb-desc">Lance une mise. Le multiplicateur monte automatiquement.</span></div>
          <div class="crash-rule-block"><span class="crb-icon">🛸</span><span class="crb-label">ÉJECTION</span><span class="crb-desc">Encaisse mise × multiplicateur avant le crash.</span></div>
          <div class="crash-rule-block"><span class="crb-icon">🤖</span><span class="crb-label">AUTO-EJECT</span><span class="crb-desc">Seuil conseillé : ×1.6 à ×2.5 pour limiter le risque.</span></div>
        </div>
      </div>
      <div class="crash-layout">
        <div class="crash-canvas-wrap"><canvas class="crash-canvas" id="cr-canvas" width="800" height="220"></canvas><div class="crash-mult" id="cr-mult">1.00×</div></div>
        <div class="crash-history" id="cr-history"></div>
        <div class="crash-controls">
          <button class="action-btn primary" id="cr-start">▶ LANCER</button>
          <button class="action-btn" id="cr-eject" disabled>🚀 ÉJECTER</button>
          <div class="crash-autoeject-row">AUTO ×<input class="crash-autoeject-inp" id="cr-auto" type="number" min="1.1" max="50" step="0.1" value="2.0"></div>
        </div>
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
    this.crashAuto = Number(document.getElementById('cr-auto')?.value ?? 0);
    this.crashT0 = performance.now();
    this.crashPoints = [[0, 1]];
    document.getElementById('cr-start').disabled = true;
    document.getElementById('cr-eject').disabled = false;
    this.setMsg('cr-msg', 'EN VOL — ÉJECTE-TOI AVANT LE CRASH', 'neutral');
    this.loopCrash();
  }

  crashPoint() {
    const houseEdge = .94;
    const r = Math.max(.002, Math.random());
    const point = Math.floor((houseEdge / r) * 100) / 100;
    return Math.max(1.01, Math.min(point, 80));
  }

  loopCrash() {
    if (!this.crashRunning) return;
    const elapsed = (performance.now() - this.crashT0) / 1000;
    this.crashMult = Math.round(Math.pow(1.075, elapsed * 5) * 100) / 100;
    this.crashPoints.push([elapsed, this.crashMult]);
    document.getElementById('cr-mult').textContent = `${this.crashMult.toFixed(2)}×`;
    this.drawCrash(this.crashMult, false);
    if (this.crashAuto > 1 && this.crashMult >= this.crashAuto && !this.crashCashed) return this.ejectCrash(true);
    if (this.crashMult >= this.crashTarget) return this.doCrash();
    this.crashRaf = requestAnimationFrame(() => this.loopCrash());
  }

  async ejectCrash(auto=false) {
    if (!this.crashRunning || this.crashCashed) return;
    this.crashCashed = true;
    const gain = Math.round(this.bet * this.crashMult);
    await this.credit(gain);
    this.addHistory('CRASH', this.bet, 'win', gain - this.bet);
    this.setMsg('cr-msg', `${auto ? 'AUTO ' : ''}ÉJECTÉ ×${this.crashMult.toFixed(2)} · +${gain - this.bet} C`, 'win');
    document.getElementById('cr-eject').disabled = true;
    this.addCrashPill(this.crashMult, 'safe');
    SFX.win();
  }

  doCrash() {
    this.stopCrash(false);
    document.getElementById('cr-mult').textContent = `💥 ${this.crashMult.toFixed(2)}×`;
    document.getElementById('cr-mult').classList.add('crashed');
    this.drawCrash(this.crashMult, true);
    const cat = this.crashMult < 1.5 ? 'danger' : this.crashMult < 3 ? 'risky' : 'safe';
    this.addCrashPill(this.crashMult, cat);
    if (!this.crashCashed) {
      this.addHistory('CRASH', this.bet, 'lose', -this.bet);
      this.setMsg('cr-msg', `CRASH ×${this.crashMult.toFixed(2)} · PERDU`, 'lose');
      SFX.crash();
    }
    document.getElementById('cr-start').disabled = false;
    document.getElementById('cr-eject').disabled = true;
  }

  addCrashPill(mult, cat) {
    const wrap = document.getElementById('cr-history'); if (!wrap) return;
    const pill = document.createElement('span');
    pill.className = `crash-hist-pill ${cat}`;
    pill.textContent = `${mult.toFixed(2)}×`;
    wrap.prepend(pill);
    while (wrap.children.length > 12) wrap.lastElementChild.remove();
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

  // SLOT MACHINE
  initSlots() {
    const game = document.getElementById('game-slots');
    if (!game) return;
    game.innerHTML = `${this.header('SLOT', 'MACHINE')}${this.betPanel('sl')}
      <div class="sl-machine" style="background:var(--c-surface);border:1px solid rgba(255,204,0,.25);border-radius:20px;padding:20px;box-shadow:inset 0 0 50px rgba(0,0,0,.35)">
        <div class="sl-scoreboard" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:14px">
          <div class="sl-score-block"><span class="sl-score-lbl">GAIN</span><span class="sl-score-val sl-score-gain" id="sl-gain">—</span></div>
          <div class="sl-score-block"><span class="sl-score-lbl">LIGNES</span><span class="sl-score-val" style="color:var(--c-cyan)">5</span></div>
          <div class="sl-score-block"><span class="sl-score-lbl">RÈGLE</span><span class="sl-score-val" style="font-size:.9rem;color:var(--c-text-muted)">3+ gauche → droite</span></div>
        </div>
        <div id="slot-grid" style="display:grid;grid-template-columns:repeat(5,minmax(56px,1fr));gap:10px;max-width:620px;margin:0 auto 14px"></div>
        <div id="slot-lines" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px"></div>
        <div id="slot-breakdown" style="min-height:34px;text-align:center;font-size:10px;letter-spacing:.08em;color:var(--c-text-muted);line-height:1.7"></div>
        <div class="sl-msg" id="sl-msg">MISE TOTALE · 5 LIGNES ACTIVES · RTP ALPHA ~90%</div>
        <div class="action-row"><button class="action-btn primary" id="sl-spin">🎰 LANCER</button></div>
      </div>`;
    document.getElementById('game-back')?.addEventListener('click', () => this.backToLobby());
    document.getElementById('sl-spin')?.addEventListener('click', () => this.spinSlots());
    this.bindBetPanel('sl');
    this.renderSlotGrid(this.randomSlotGrid());
    this.renderSlotLineLegend();
  }

  renderSlotLineLegend(activeIds=[]) {
    const wrap = document.getElementById('slot-lines');
    if (!wrap) return;
    wrap.innerHTML = SLOT_LINES.map(line => `<span style="border:1px solid ${line.color};color:${line.color};border-radius:999px;padding:3px 9px;font-size:8px;letter-spacing:.12em;background:${activeIds.includes(line.id) ? 'rgba(255,255,255,.08)' : 'transparent'}">${line.name} ×${line.mult}</span>`).join('');
  }

  renderSlotGrid(grid, wins=[]) {
    const root = document.getElementById('slot-grid');
    if (!root) return;
    const winCells = new Set();
    wins.forEach(win => {
      for (let c=0; c<win.count; c++) winCells.add(`${win.line.rows[c]}-${c}`);
    });
    root.innerHTML = '';
    for (let r=0; r<SLOT_ROWS; r++) {
      for (let c=0; c<SLOT_COLS; c++) {
        const sym = grid[r][c];
        const active = winCells.has(`${r}-${c}`);
        const cell = document.createElement('div');
        cell.style.cssText = `min-height:78px;border-radius:14px;border:1px solid ${active ? '#00ff80' : 'rgba(255,255,255,.08)'};background:${active ? 'rgba(0,255,128,.08)' : 'rgba(255,255,255,.025)'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;box-shadow:${active ? '0 0 18px rgba(0,255,128,.35)' : 'inset 0 0 20px rgba(0,0,0,.35)'};transition:all .18s`;
        cell.innerHTML = this.slotSymbolHTML(sym);
        root.appendChild(cell);
      }
    }
  }

  async spinSlots() {
    if (this.slotSpinning) return;
    if (!(await this.debit(this.bet))) return this.setMsg('sl-msg', 'CRÉDITS INSUFFISANTS', 'lose');
    this.slotSpinning = true;
    const btn = document.getElementById('sl-spin');
    if (btn) btn.disabled = true;
    document.getElementById('slot-breakdown').textContent = '';
    document.getElementById('sl-gain').textContent = '—';
    this.setMsg('sl-msg', 'LES ROULEAUX TOURNENT…', 'neutral');

    let grid = this.randomSlotGrid();
    for (let t=0; t<20; t++) {
      grid = this.randomSlotGrid();
      this.renderSlotGrid(grid);
      SFX.tick();
      await sleep(48 + t * 5);
    }

    grid = this.randomSlotGrid();
    const { wins, gain } = this.evaluateSlots(grid);
    this.renderSlotGrid(grid, wins);
    this.renderSlotLineLegend(wins.map(w => w.line.id));

    if (gain > 0) await this.credit(gain);
    const net = gain - this.bet;
    const status = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    document.getElementById('sl-gain').textContent = gain > 0 ? `+${gain}` : '—';
    document.getElementById('slot-breakdown').innerHTML = wins.length
      ? wins.map(w => `<span style="color:${w.line.color}">${w.line.name}</span> · ${w.count}× ${w.symbol.name} · +${w.gain} C`).join('<br>')
      : 'Aucune ligne gagnante.';
    this.setMsg('sl-msg', wins.length ? `${wins.length} ligne${wins.length>1?'s':''} · ${net >= 0 ? '+' : ''}${net} C` : `PERDU · -${this.bet} C`, status);
    this.addHistory('SLOTS', this.bet, status, net);
    this.slotStats.spins += 1;
    this.slotStats.wagered += this.bet;
    this.slotStats.paid += gain;
    if (wins.some(w => w.symbol.id === 'star' && w.count >= 5)) SFX.jackpot();
    else status === 'win' ? SFX.win() : SFX.lose();
    this.slotSpinning = false;
    if (btn) btn.disabled = false;
  }

  randomSlotGrid() {
    return Array.from({ length:SLOT_ROWS }, () => Array.from({ length:SLOT_COLS }, () => weightedPick(SLOT_SYMBOLS)));
  }

  evaluateSlots(grid) {
    const wins = [];
    for (const line of SLOT_LINES) {
      const first = grid[line.rows[0]][0];
      let count = 1;
      for (let c=1; c<SLOT_COLS; c++) {
        const sym = grid[line.rows[c]][c];
        if (sym.id === first.id) count += 1;
        else break;
      }
      if (count >= 3) {
        const rawMult = first.pay[count] ?? 0;
        const gain = Math.max(1, Math.round(this.bet * rawMult * line.mult));
        wins.push({ line, symbol:first, count, gain });
      }
    }
    const gain = wins.reduce((sum, win) => sum + win.gain, 0);
    return { wins, gain };
  }

  slotSymbolHTML(sym) {
    const label = `<span style="font-size:9px;letter-spacing:.08em;color:var(--c-text-muted)">${sym.name}</span>`;
    if (sym.emoji) return `<span style="font-size:34px;line-height:1">${sym.emoji}</span>${label}`;
    return `<img src="${sym.img}" alt="${sym.name}" width="42" height="42" loading="lazy" onerror="this.style.opacity=.12">${label}`;
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
