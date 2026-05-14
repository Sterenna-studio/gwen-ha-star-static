/**
 * casino-core.js  —  STAR CASINO  v1.0
 * Lobby + Blackjack + Roulette + Crash Game
 * Monnaie : Chronicles (Supabase profiles.chronicles)
 */
import { supabase } from '../../../js/supabase.js';

// ── UTILS ─────────────────────────────────────────────────────────────
const $ = s => document.querySelector(s);
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

// ── SOUND ENGINE ──────────────────────────────────────────────────────
const SFX = {
  _ctx: null,
  _g() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },
  _t(f, type, vol, atk, dec, t0) {
    const ctx = this._g(); if (!ctx) return;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.setValueAtTime(f, t0 ?? ctx.currentTime);
    g.gain.setValueAtTime(0, t0 ?? ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, (t0 ?? ctx.currentTime) + atk);
    g.gain.linearRampToValueAtTime(0,   (t0 ?? ctx.currentTime) + atk + dec);
    osc.start(t0 ?? ctx.currentTime);
    osc.stop((t0 ?? ctx.currentTime) + atk + dec + .01);
  },
  _n(vol, dur, t0) {
    const ctx = this._g(); if (!ctx) return;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf; s.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol, t0??ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, (t0??ctx.currentTime)+dur);
    s.start(t0??ctx.currentTime);
  },
  click()  { this._t(800,'sine',.06,.004,.05); },
  card()   { this._n(.05,.03); this._t(600,'triangle',.05,.003,.04); },
  win()    { const ctx=this._g(); if(!ctx) return; [523,659,784,1047].forEach((f,i)=>this._t(f,'triangle',.09,.01,.14,ctx.currentTime+i*.09)); },
  bj()     { const ctx=this._g(); if(!ctx) return; [523,659,784,1047,1319].forEach((f,i)=>this._t(f,'square',.07,.01,.12,ctx.currentTime+i*.07)); this._n(.05,.5); },
  lose()   { const ctx=this._g(); if(!ctx) return; [330,280,220].forEach((f,i)=>this._t(f,'sawtooth',.07,.01,.18,ctx.currentTime+i*.12)); },
  push()   { this._t(440,'sine',.07,.01,.2); },
  coin()   { this._t(1200,'sine',.06,.003,.04); this._t(1600,'sine',.04,.003,.04,this._g().currentTime+.05); },
  hover()  { this._t(1100,'sine',.03,.002,.03); },
  crash()  { const ctx=this._g(); if(!ctx) return; [200,160,120].forEach((f,i)=>this._t(f,'sawtooth',.1,.005,.3,ctx.currentTime+i*.08)); this._n(.1,.5); },
  eject()  { const ctx=this._g(); if(!ctx) return; [660,880,1100].forEach((f,i)=>this._t(f,'triangle',.08,.005,.1,ctx.currentTime+i*.05)); },
  tick()   { this._t(1400,'square',.04,.002,.015); },
};

// ── ROULETTE CONFIG ────────────────────────────────────────────────────
const RL_NUMS = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,
  24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];
const RL_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const RL_PAYOUTS = {
  straight: 35,
  red: 1, black: 1,
  green: 17,
};

// ── CASINO CORE ───────────────────────────────────────────────────────
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
    this._currentGame = null;
    // Crash state
    this._crashMult    = 1.00;
    this._crashRunning = false;
    this._crashCashedOut = false;
    this._crashAnimId  = null;
    this._crashBetActive = false;
    // Roulette
    this._rlBetType   = null;
    this._rlBetVal    = null;
    this._rlSpinning  = false;
  }

  // ── SUPABASE ────────────────────────────────────────────────────────
  async _loadCredits() {
    if (!this.userId) { this.credits = 500; return; }
    try {
      const { data } = await supabase
        .from('profiles').select('chronicles').eq('id', this.userId).single();
      this.credits = data?.chronicles ?? 500;
    } catch { this.credits = 500; }
  }

  async _saveCredits() {
    if (!this.userId) return;
    try {
      await supabase.from('profiles').update({ chronicles: this.credits }).eq('id', this.userId);
    } catch {}
    this._updateCreditsDisplay();
  }

  _addHistory(game, bet, result, gain) {
    this.history.unshift({ game, bet, result, gain, ts: Date.now() });
    if (this.history.length > 30) this.history.pop();
    this._renderHistory();
  }

  // ── RENDER MAIN SHELL ───────────────────────────────────────────────
  showLobby() {
    const root = document.querySelector(this.mountSel);
    if (!root) return;

    root.innerHTML = `
    <div class="scanlines" aria-hidden="true"></div>
    <div class="casino-page" id="casino-page">

      <!-- STATUS BAR -->
      <nav class="casino-statusbar">
        <div class="sb-left">
          <span class="sb-logo">STAR · CASINO</span>
          <a href="/star/" class="sb-back">← RETOUR HUB</a>
        </div>
        <div class="sb-right">
          <span class="sb-credits-label">CHRONICLES</span>
          <span class="sb-credits-val" id="sb-credits">${this.credits.toLocaleString('fr-FR')}</span>
          <span class="sb-dot"></span>
        </div>
      </nav>

      <!-- LOBBY -->
      <section class="casino-lobby" id="view-lobby">
        <div class="lobby-hero">
          <h1 class="lobby-hero-title">CASINO</h1>
          <p class="lobby-hero-sub">STAR · CHRONICLES · ARCADE · NÉON</p>
          <span class="lobby-hero-line"></span>
        </div>

        <!-- Jackpot banner -->
        <div class="jackpot-banner" style="width:100%;max-width:500px;margin-bottom:40px">
          <span class="jp-icon">🏆</span>
          <span class="jp-label">JACKPOT PROGRESSIF</span>
          <span class="jp-val" id="jp-val">${this._jackpot.toLocaleString('fr-FR')} C</span>
        </div>

        <div class="lobby-grid">
          <div class="game-card" style="--card-color:var(--c-green)" id="card-bj">
            <div class="gc-icon">🃏</div>
            <div class="gc-tag">// JEU 01</div>
            <div class="gc-title">BLACKJACK</div>
            <div class="gc-desc">Bats le dealer sans dépasser 21. Blackjack naturel = ×2.5. Stratégie, mémoire, nerfs.</div>
            <div class="gc-meta">
              <span class="gc-badge">SKILL</span>
              <span class="gc-badge">×2.5 BJ</span>
              <span class="gc-badge">MISE MIN 1C</span>
            </div>
            <div class="gc-play-btn">▶ JOUER</div>
          </div>

          <div class="game-card" style="--card-color:var(--c-purple)" id="card-rl">
            <div class="gc-icon">🎡</div>
            <div class="gc-tag">// JEU 02</div>
            <div class="gc-title">ROULETTE</div>
            <div class="gc-desc">Mise sur couleur, numéro ou zero. Roue européenne 37 cases. Numéro plein = ×35.</div>
            <div class="gc-meta">
              <span class="gc-badge">CHANCE</span>
              <span class="gc-badge">×35 PLEIN</span>
              <span class="gc-badge">1 ZERO</span>
            </div>
            <div class="gc-play-btn">▶ JOUER</div>
          </div>

          <div class="game-card" style="--card-color:var(--c-pink)" id="card-crash">
            <div class="gc-icon">🚀</div>
            <div class="gc-tag">// JEU 03</div>
            <div class="gc-title">CRASH</div>
            <div class="gc-desc">Le multiplicateur monte. Éjecte-toi avant le crash. Plus tu attends, plus tu gagnes — ou tout perds.</div>
            <div class="gc-meta">
              <span class="gc-badge">TENSION</span>
              <span class="gc-badge">AUTO-EJECT</span>
              <span class="gc-badge">∞×</span>
            </div>
            <div class="gc-play-btn">▶ JOUER</div>
          </div>
        </div>

        <!-- Historique -->
        <div class="history-section" style="margin-top:48px;width:100%" id="history-section">
          <div class="history-head">
            <span>JEU</span><span>RÉSULTAT</span><span>MISE</span><span>GAIN</span><span>SOLDE</span>
          </div>
          <div class="history-body" id="history-body"></div>
        </div>
      </section>

      <!-- BLACKJACK -->
      <section class="casino-game" id="game-blackjack"></section>

      <!-- ROULETTE -->
      <section class="casino-game" id="game-roulette"></section>

      <!-- CRASH -->
      <section class="casino-game" id="game-crash"></section>
    </div>`;

    document.getElementById('card-bj')?.addEventListener('click',    () => { SFX.click(); this._showGame('blackjack'); });
    document.getElementById('card-rl')?.addEventListener('click',    () => { SFX.click(); this._showGame('roulette'); });
    document.getElementById('card-crash')?.addEventListener('click', () => { SFX.click(); this._showGame('crash'); });

    // Hover SFX
    ['card-bj','card-rl','card-crash'].forEach(id => {
      document.getElementById(id)?.addEventListener('mouseenter', () => SFX.hover());
    });

    this._renderHistory();
  }

  // ── NAV ──────────────────────────────────────────────────────────────
  _showGame(name) {
    document.getElementById('view-lobby')?.style.setProperty('display','none');
    document.querySelectorAll('.casino-game').forEach(g => g.classList.remove('active'));
    const el = document.getElementById(`game-${name}`);
    if (!el) return;
    el.classList.add('active');
    this._currentGame = name;
    if      (name === 'blackjack') this._initBlackjack();
    else if (name === 'roulette')  this._initRoulette();
    else if (name === 'crash')     this._initCrash();
  }

  _backToLobby() {
    document.querySelectorAll('.casino-game').forEach(g => g.classList.remove('active'));
    document.getElementById('view-lobby').style.removeProperty('display');
    this._currentGame = null;
    if (this._crashAnimId) { cancelAnimationFrame(this._crashAnimId); this._crashAnimId = null; }
  }

  _updateCreditsDisplay() {
    const el = document.getElementById('sb-credits');
    if (el) el.textContent = this.credits.toLocaleString('fr-FR');
  }

  // ── BET PANEL HTML ───────────────────────────────────────────────────
  _betPanelHTML(id) {
    const presets = [1,5,10,25,50,100];
    return `
    <div class="bet-panel">
      <span class="bet-label">MISE</span>
      <button class="bet-btn" id="${id}-bet-down">−</button>
      <span class="bet-val" id="${id}-bet-val">${this.bet}</span>
      <button class="bet-btn" id="${id}-bet-up">+</button>
      <div class="bet-presets">${presets.map(p=>`<button class="bet-preset${this.bet===p?' active':''}" data-preset="${p}">${p}</button>`).join('')}</div>
    </div>`;
  }

  _bindBetPanel(id) {
    const presets = [1,5,10,25,50,100];
    const upd = () => {
      const v = document.getElementById(`${id}-bet-val`);
      if (v) v.textContent = this.bet;
      document.querySelectorAll('.bet-preset').forEach(b => b.classList.toggle('active', Number(b.dataset.preset) === this.bet));
    };
    document.getElementById(`${id}-bet-down`)?.addEventListener('click', () => {
      SFX.click(); this.bet = Math.max(1, this.bet - (this.bet > 10 ? 5 : 1)); upd();
    });
    document.getElementById(`${id}-bet-up`)?.addEventListener('click', () => {
      SFX.click(); this.bet = Math.min(this.credits, this.bet + (this.bet >= 10 ? 5 : 1)); upd();
    });
    document.querySelectorAll('.bet-preset').forEach(b => {
      b.addEventListener('click', () => {
        SFX.click(); this.bet = Math.min(this.credits, Number(b.dataset.preset)); upd();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // BLACKJACK
  // ═══════════════════════════════════════════════════════════════════
  _initBlackjack() {
    this._bjDeck     = [];
    this._bjPlayer   = [];
    this._bjDealer   = [];
    this._bjPhase    = 'bet'; // bet | play | done
    const g = document.getElementById('game-blackjack');
    g.innerHTML = `
      <div class="game-header">
        <button class="game-back-btn" id="bj-back">← LOBBY</button>
        <span class="game-title">BLACK<span class="game-title-accent">JACK</span></span>
      </div>
      ${this._betPanelHTML('bj')}
      <div class="bj-table" id="bj-table">
        <div class="bj-zone">
          <div class="bj-zone-label">DEALER</div>
          <div class="bj-score" id="bj-dealer-score">—</div>
          <div class="bj-cards" id="bj-dealer-cards"></div>
        </div>
        <div class="bj-divider"></div>
        <div class="bj-zone">
          <div class="bj-zone-label">VOUS</div>
          <div class="bj-score" id="bj-player-score">—</div>
          <div class="bj-cards" id="bj-player-cards"></div>
        </div>
      </div>
      <div class="game-msg" id="bj-msg">APPUYER SUR DEAL POUR COMMENCER</div>
      <div class="action-row">
        <button class="action-btn primary" id="bj-deal">▶ DEAL</button>
        <button class="action-btn" id="bj-hit"  disabled>HIT</button>
        <button class="action-btn" id="bj-stand" disabled>STAND</button>
        <button class="action-btn danger" id="bj-double" disabled>DOUBLE</button>
      </div>`;

    document.getElementById('bj-back')?.addEventListener('click',   () => this._backToLobby());
    document.getElementById('bj-deal')?.addEventListener('click',   () => this._bjDeal());
    document.getElementById('bj-hit')?.addEventListener('click',    () => this._bjHit());
    document.getElementById('bj-stand')?.addEventListener('click',  () => this._bjStand());
    document.getElementById('bj-double')?.addEventListener('click', () => this._bjDouble());
    this._bindBetPanel('bj');
  }

  _bjNewDeck() {
    const suits = ['♠','♥','♦','♣'];
    const vals  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    this._bjDeck = suits.flatMap(s => vals.map(v => ({ s, v })));
    // Shuffle (Fisher-Yates)
    for (let i = this._bjDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._bjDeck[i], this._bjDeck[j]] = [this._bjDeck[j], this._bjDeck[i]];
    }
  }

  _bjDraw() { return this._bjDeck.pop(); }

  _bjVal(hand) {
    let total = 0, aces = 0;
    for (const c of hand) {
      if (!c.hidden) {
        if (c.v === 'A') { total += 11; aces++; }
        else if (['J','Q','K'].includes(c.v)) total += 10;
        else total += parseInt(c.v);
      }
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  _bjCardHTML(c) {
    if (c.hidden) return '<div class="bj-card hidden"></div>';
    const red = ['♥','♦'].includes(c.s);
    return `<div class="bj-card${red?' red':''}"
      style="animation-duration:${.15+Math.random()*.15}s">
      <div class="bj-card-corner">${c.v}<br>${c.s}</div>
      <div class="bj-card-center">${c.s}</div>
      <div class="bj-card-corner" style="transform:rotate(180deg)">${c.v}<br>${c.s}</div>
    </div>`;
  }

  _bjRenderHands() {
    const pc = document.getElementById('bj-player-cards');
    const dc = document.getElementById('bj-dealer-cards');
    const ps = document.getElementById('bj-player-score');
    const ds = document.getElementById('bj-dealer-score');
    if (pc) pc.innerHTML = this._bjPlayer.map(c => this._bjCardHTML(c)).join('');
    if (dc) dc.innerHTML = this._bjDealer.map(c => this._bjCardHTML(c)).join('');
    const pv = this._bjVal(this._bjPlayer);
    const dv = this._bjVal(this._bjDealer.filter(c => !c.hidden));
    if (ps) { ps.textContent = pv || '—'; ps.className = 'bj-score' + (pv>21?' bust': pv===21&&this._bjPlayer.length===2?' bj':''); }
    if (ds) { ds.textContent = dv || '—'; ds.className = 'bj-score' + (dv>21?' bust':''); }
  }

  async _bjDeal() {
    if (this.credits < this.bet) { this._bjMsg('CRÉDITS INSUFFISANTS','lose'); return; }
    this._bjNewDeck();
    this.credits -= this.bet;
    await this._saveCredits();
    this._bjPlayer = [this._bjDraw(), this._bjDraw()];
    this._bjDealer = [this._bjDraw(), { ...this._bjDraw(), hidden: true }];
    this._bjPhase  = 'play';
    SFX.card(); SFX.card();
    this._bjRenderHands();
    this._bjSetButtons(true);
    document.getElementById('bj-deal').disabled = true;
    const pv = this._bjVal(this._bjPlayer);
    if (pv === 21) { await this._delay(400); this._bjStand(); return; }
    this._bjMsg('HIT ou STAND ?','neutral');
  }

  async _bjHit() {
    SFX.card();
    this._bjPlayer.push(this._bjDraw());
    this._bjRenderHands();
    const v = this._bjVal(this._bjPlayer);
    if (v > 21) { await this._delay(200); this._bjEnd(); }
    else if (v === 21) { await this._delay(300); this._bjStand(); }
    else this._bjMsg(`${v} — HIT ou STAND ?`,'neutral');
  }

  async _bjStand() {
    this._bjSetButtons(false);
    // Révéle carte cachée
    this._bjDealer = this._bjDealer.map(c => ({ ...c, hidden: false }));
    this._bjRenderHands();
    await this._delay(300);
    // Dealer tire jusqu'à 17
    while (this._bjVal(this._bjDealer) < 17) {
      SFX.card();
      await this._delay(400);
      this._bjDealer.push(this._bjDraw());
      this._bjRenderHands();
    }
    await this._delay(300);
    this._bjEnd();
  }

  async _bjDouble() {
    if (this.credits < this.bet) { this._bjMsg('CRÉDITS INSUFFISANTS','lose'); return; }
    this.credits -= this.bet;
    this.bet     *= 2;
    await this._saveCredits();
    this._bjSetButtons(false);
    SFX.card();
    this._bjPlayer.push(this._bjDraw());
    this._bjRenderHands();
    await this._delay(300);
    this._bjStand();
  }

  _bjEnd() {
    const pv = this._bjVal(this._bjPlayer);
    const dv = this._bjVal(this._bjDealer);
    const isBJ = pv === 21 && this._bjPlayer.length === 2;
    let gain = 0, result = 'lose', msg = '';
    if (pv > 21) {
      msg = 'BUST — PERDU'; result = 'lose'; SFX.lose();
    } else if (dv > 21 || pv > dv) {
      if (isBJ) {
        gain = Math.round(this.bet * 2.5); msg = '🃏 BLACKJACK ! ×2.5'; result = 'win'; SFX.bj();
      } else {
        gain = this.bet * 2; msg = `GAGNÉ ! +${gain} C`; result = 'win'; SFX.win();
      }
    } else if (pv === dv) {
      gain = this.bet; msg = 'ÉGALITÉ — REMBOURSÉ'; result = 'push'; SFX.push();
    } else {
      msg = 'DEALER GAGNE — PERDU'; result = 'lose'; SFX.lose();
    }
    if (gain) { this.credits += gain; this._saveCredits(); }
    this._bjMsg(msg, result);
    this._bjRenderHands();
    this._bjSetButtons(false);
    document.getElementById('bj-deal').disabled = false;
    this._addHistory('BLACKJACK', this.bet, result, gain - this.bet);
    this._bjPhase = 'done';
  }

  _bjMsg(txt, type='') {
    const el = document.getElementById('bj-msg');
    if (!el) return;
    el.textContent = txt;
    el.className = 'game-msg' + (type ? ` ${type}` : '');
  }

  _bjSetButtons(active) {
    ['bj-hit','bj-stand','bj-double'].forEach(id => {
      const b = document.getElementById(id); if (b) b.disabled = !active;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // ROULETTE
  // ═══════════════════════════════════════════════════════════════════
  _initRoulette() {
    this._rlBetType = null; this._rlBetVal = null; this._rlSpinning = false;
    const g = document.getElementById('game-roulette');
    const numRows = [];
    for (let i = 0; i < RL_NUMS.length; i += 6)
      numRows.push(RL_NUMS.slice(i, i+6));

    g.innerHTML = `
      <div class="game-header">
        <button class="game-back-btn" id="rl-back">← LOBBY</button>
        <span class="game-title">ROULE<span class="game-title-accent">TTE</span></span>
      </div>
      ${this._betPanelHTML('rl')}
      <div class="rl-layout">
        <div class="rl-wheel-wrap">
          <div class="rl-wheel" id="rl-wheel">
            <canvas class="rl-canvas" id="rl-canvas" width="220" height="220"></canvas>
            <div class="rl-pointer"></div>
          </div>
          <div class="rl-result-num" id="rl-result">—</div>
          <div class="game-msg" id="rl-msg">CHOISIS UNE MISE</div>
        </div>
        <div class="rl-bets-panel">
          <p class="rl-section-label">COULEUR (×2)</p>
          <div class="rl-colors">
            <button class="rl-color-btn red"   data-type="color" data-val="red">ROUGE</button>
            <button class="rl-color-btn black" data-type="color" data-val="black">NOIR</button>
            <button class="rl-color-btn green" data-type="color" data-val="green">ZÉRO ×18</button>
          </div>
          <p class="rl-section-label" style="margin-top:12px">NUMÉRO PLEIN (×36)</p>
          <div class="rl-numbers-grid" id="rl-numbers">
            <button class="rl-num-btn zero" data-type="number" data-val="0">0</button>
            ${Array.from({length:36},(_,i)=>i+1).map(n=>`
              <button class="rl-num-btn${RL_RED.has(n)?' red-num':' black-num'}" data-type="number" data-val="${n}">${n}</button>
            `).join('')}
          </div>
          <div class="rl-selected-display" id="rl-sel-display">—</div>
          <div class="action-row" style="margin-top:8px">
            <button class="action-btn primary" id="rl-spin">▶ LANCER</button>
          </div>
        </div>
      </div>`;

    this._rlDrawWheel();
    document.getElementById('rl-back')?.addEventListener('click', () => this._backToLobby());
    document.getElementById('rl-spin')?.addEventListener('click', () => this._rlSpin());
    this._bindBetPanel('rl');

    // Bet selection
    g.querySelectorAll('[data-type]').forEach(b => {
      b.addEventListener('click', () => {
        SFX.click();
        g.querySelectorAll('[data-type]').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        this._rlBetType = b.dataset.type;
        this._rlBetVal  = b.dataset.val;
        const disp = document.getElementById('rl-sel-display');
        if (disp) {
          if (this._rlBetType === 'color') {
            const labels = { red:'ROUGE ×2', black:'NOIR ×2', green:'ZÉRO ×18' };
            disp.textContent = labels[this._rlBetVal] ?? this._rlBetVal;
          } else {
            disp.textContent = `NUMÉRO ${this._rlBetVal} ×36`;
          }
        }
      });
    });
  }

  _rlDrawWheel() {
    const canvas = document.getElementById('rl-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const N   = RL_NUMS.length;
    const cx  = 110, cy = 110, r = 108;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i+1) / N) * Math.PI * 2 - Math.PI / 2;
      const num = RL_NUMS[i];
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = num === 0 ? '#007a33' : RL_RED.has(num) ? '#b01c1c' : '#151515';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
      // Number label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((a0 + a1) / 2);
      ctx.translate(r * .72, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Share Tech Mono';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(num, 0, 0);
      ctx.restore();
    }
    // Center circle
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI*2);
    ctx.fillStyle = '#0f1117'; ctx.fill();
    ctx.strokeStyle = 'rgba(176,106,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
  }

  async _rlSpin() {
    if (this._rlSpinning) return;
    if (!this._rlBetType) { this._rlMsg('CHOISIS UNE MISE D\'ABORD','lose'); return; }
    if (this.credits < this.bet) { this._rlMsg('CRÉDITS INSUFFISANTS','lose'); return; }

    this._rlSpinning = true;
    this.credits -= this.bet;
    await this._saveCredits();
    document.getElementById('rl-spin').disabled = true;

    // Random result
    const resultIdx = Math.floor(Math.random() * RL_NUMS.length);
    const resultNum = RL_NUMS[resultIdx];
    const totalDeg  = 1440 + 360 - (resultIdx / RL_NUMS.length) * 360;
    const dur       = 3.5;

    const wheel = document.getElementById('rl-wheel');
    if (wheel) {
      wheel.style.setProperty('--spin-deg', `${totalDeg}deg`);
      wheel.style.setProperty('--spin-dur', `${dur}s`);
      wheel.classList.add('spinning');
    }
    this._rlMsg('EN COURS…','neutral');

    await this._delay(dur * 1000 + 200);
    if (wheel) wheel.classList.remove('spinning');

    const resEl = document.getElementById('rl-result');
    if (resEl) { resEl.textContent = resultNum; resEl.style.color = resultNum === 0 ? 'var(--c-green)' : RL_RED.has(resultNum) ? '#e74c3c' : 'var(--c-text)'; }

    // Evaluate
    let gain = 0, result = 'lose';
    if (this._rlBetType === 'color') {
      const winColor = resultNum === 0 ? 'green' : RL_RED.has(resultNum) ? 'red' : 'black';
      if (winColor === this._rlBetVal) {
        const mult = resultNum === 0 ? 18 : 2;
        gain = this.bet * mult; result = 'win';
      }
    } else {
      if (Number(this._rlBetVal) === resultNum) { gain = this.bet * 36; result = 'win'; }
    }

    if (gain) { this.credits += gain; await this._saveCredits(); SFX.win(); }
    else SFX.lose();

    const msg = gain > 0 ? `🎡 NUMÉRO ${resultNum} — +${gain} C` : `NUMÉRO ${resultNum} — PERDU`;
    this._rlMsg(msg, result);
    this._addHistory('ROULETTE', this.bet, result, gain - this.bet);

    document.getElementById('rl-spin').disabled = false;
    this._rlSpinning = false;
  }

  _rlMsg(txt, type='') {
    const el = document.getElementById('rl-msg');
    if (!el) return;
    el.textContent = txt;
    el.className = 'game-msg' + (type ? ` ${type}` : '');
  }

  // ═══════════════════════════════════════════════════════════════════
  // CRASH GAME
  // ═══════════════════════════════════════════════════════════════════
  _initCrash() {
    this._crashMult       = 1.00;
    this._crashRunning    = false;
    this._crashCashedOut  = false;
    this._crashBetActive  = false;
    this._crashHistory    = [];
    if (this._crashAnimId) { cancelAnimationFrame(this._crashAnimId); this._crashAnimId = null; }

    const g = document.getElementById('game-crash');
    g.innerHTML = `
      <div class="game-header">
        <button class="game-back-btn" id="cr-back">← LOBBY</button>
        <span class="game-title">CRA<span class="game-title-accent">SH</span></span>
      </div>
      ${this._betPanelHTML('cr')}
      <div class="crash-layout">
        <div class="crash-canvas-wrap">
          <canvas class="crash-canvas" id="cr-canvas" width="800" height="200"></canvas>
          <div class="crash-mult" id="cr-mult">1.00×</div>
        </div>
        <div class="crash-history" id="cr-history"></div>
        <div class="crash-controls">
          <button class="action-btn primary" id="cr-start">▶ LANCER</button>
          <button class="action-btn" id="cr-eject" disabled style="--game-accent:var(--c-pink)">🚀 ÉJECTER</button>
          <div class="crash-autoeject-row">
            AUTO-EJECT ×
            <input class="crash-autoeject-inp" id="cr-auto" type="number" min="1.1" max="100" step="0.1" value="2.0">
          </div>
        </div>
        <div class="game-msg" id="cr-msg">MISE ET LANCE LE CRASH</div>
      </div>`;

    document.getElementById('cr-back')?.addEventListener('click',  () => { this._crashAbort(); this._backToLobby(); });
    document.getElementById('cr-start')?.addEventListener('click', () => this._crashStart());
    document.getElementById('cr-eject')?.addEventListener('click', () => this._crashEject());
    this._bindBetPanel('cr');
    this._crashDrawCanvas(1.00, false);
  }

  _crashCrashPoint() {
    // Distribution : ~10% sous 1.5×, longue queue jusqu'à ~100×
    const r = Math.random();
    if (r < 0.1)  return 1.00 + Math.random() * 0.5;
    if (r < 0.4)  return 1.5  + Math.random() * 1.5;
    if (r < 0.7)  return 2.0  + Math.random() * 3.0;
    if (r < 0.9)  return 4.0  + Math.random() * 8.0;
    if (r < 0.97) return 10   + Math.random() * 20;
    return 25 + Math.random() * 75;
  }

  async _crashStart() {
    if (this._crashRunning) return;
    if (this.credits < this.bet) { this._crashMsg('CRÉDITS INSUFFISANTS','lose'); return; }
    this.credits -= this.bet;
    await this._saveCredits();
    this._crashBetActive  = true;
    this._crashRunning    = true;
    this._crashCashedOut  = false;
    this._crashMult       = 1.00;
    this._crashTarget     = this._crashCrashPoint();
    this._crashAutoEject  = parseFloat(document.getElementById('cr-auto')?.value ?? '2') || 0;
    this._crashPoints     = [[0, 0]];
    this._crashT0         = performance.now();

    document.getElementById('cr-start').disabled = true;
    document.getElementById('cr-eject').disabled = false;
    this._crashMsg('EN VOL — ÉJECTE-TOI !','neutral');
    this._crashLoop();
  }

  _crashLoop() {
    const step = () => {
      if (!this._crashRunning) return;
      const elapsed = (performance.now() - this._crashT0) / 1000;
      // Croissance exponentielle douce
      this._crashMult = Math.pow(1.06, elapsed * 6);
      this._crashMult = Math.round(this._crashMult * 100) / 100;

      const multEl = document.getElementById('cr-mult');
      if (multEl) multEl.textContent = `${this._crashMult.toFixed(2)}×`;

      this._crashPoints.push([elapsed, this._crashMult]);
      this._crashDrawCanvas(this._crashMult, false);
      SFX.tick();

      // Auto-éject
      if (this._crashAutoEject > 1 && this._crashMult >= this._crashAutoEject && !this._crashCashedOut) {
        this._crashEject(); return;
      }

      if (this._crashMult >= this._crashTarget) {
        this._crashDoCrash(); return;
      }

      this._crashAnimId = requestAnimationFrame(step);
    };
    this._crashAnimId = requestAnimationFrame(step);
  }

  _crashEject() {
    if (!this._crashRunning || this._crashCashedOut || !this._crashBetActive) return;
    SFX.eject();
    this._crashCashedOut = true;
    const gain = Math.round(this.bet * this._crashMult);
    this.credits += gain;
    this._saveCredits();
    this._crashMsg(`🚀 ÉJECTÉ × ${this._crashMult.toFixed(2)} — +${gain} C`, 'win');
    this._addHistory('CRASH', this.bet, 'win', gain - this.bet);
    this._addCrashPill(this._crashMult, 'safe');
    document.getElementById('cr-eject').disabled = true;
  }

  _crashDoCrash() {
    cancelAnimationFrame(this._crashAnimId);
    this._crashRunning = false;
    const multEl = document.getElementById('cr-mult');
    if (multEl) { multEl.textContent = `💥 ${this._crashMult.toFixed(2)}×`; multEl.classList.add('crashed'); }
    SFX.crash();
    this._crashDrawCanvas(this._crashMult, true);
    if (!this._crashCashedOut) {
      this._crashMsg(`CRASH × ${this._crashMult.toFixed(2)} — PERDU`, 'lose');
      this._addHistory('CRASH', this.bet, 'lose', -this.bet);
      const cat = this._crashMult < 1.5 ? 'danger' : this._crashMult < 3 ? 'risky' : 'safe';
      this._addCrashPill(this._crashMult, cat);
    }
    this._crashBetActive = false;
    document.getElementById('cr-start').disabled = false;
    document.getElementById('cr-eject').disabled = true;
    setTimeout(() => {
      const m = document.getElementById('cr-mult');
      if (m) { m.classList.remove('crashed'); m.textContent = '1.00×'; }
    }, 2000);
  }

  _crashAbort() {
    if (this._crashAnimId) cancelAnimationFrame(this._crashAnimId);
    this._crashRunning = false;
  }

  _addCrashPill(mult, cat) {
    const wrap = document.getElementById('cr-history');
    if (!wrap) return;
    const p = el('span', `crash-hist-pill ${cat}`, `${mult.toFixed(2)}×`);
    wrap.insertBefore(p, wrap.firstChild);
    if (wrap.children.length > 12) wrap.lastChild?.remove();
  }

  _crashMsg(txt, type='') {
    const e = document.getElementById('cr-msg');
    if (!e) return; e.textContent = txt; e.className = 'game-msg'+(type?` ${type}`:'');
  }

  _crashDrawCanvas(mult, crashed) {
    const canvas = document.getElementById('cr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    for (let x=0;x<W;x+=60){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for (let y=0;y<H;y+=40){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }

    if (!this._crashPoints || this._crashPoints.length < 2) return;

    const pts   = this._crashPoints;
    const maxT  = Math.max(pts[pts.length-1][0], 1);
    const maxM  = Math.max(mult, 2);
    const toX   = t => (t / maxT) * (W - 20) + 10;
    const toY   = m => H - 10 - ((m - 1) / (maxM - 1)) * (H - 20);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, crashed ? 'rgba(255,71,87,.3)'  : 'rgba(255,110,180,.25)');
    grad.addColorStop(1, crashed ? 'rgba(255,71,87,.02)' : 'rgba(255,110,180,.02)');
    ctx.beginPath();
    ctx.moveTo(toX(pts[0][0]), H);
    pts.forEach(([t, m]) => ctx.lineTo(toX(t), toY(m)));
    ctx.lineTo(toX(pts[pts.length-1][0]), H);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach(([t, m], i) => {
      if (i === 0) ctx.moveTo(toX(t), toY(m));
      else ctx.lineTo(toX(t), toY(m));
    });
    ctx.strokeStyle = crashed ? 'var(--c-red, #ff4757)' : 'var(--c-pink, #ff6eb4)';
    ctx.lineWidth = 2.5; ctx.stroke();

    // Dot courant
    const last = pts[pts.length-1];
    ctx.beginPath();
    ctx.arc(toX(last[0]), toY(last[1]), 5, 0, Math.PI*2);
    ctx.fillStyle = crashed ? '#ff4757' : '#ff6eb4';
    ctx.shadowColor = crashed ? '#ff4757' : '#ff6eb4';
    ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
  }

  // ── HISTORY ──────────────────────────────────────────────────────────
  _renderHistory() {
    const body = document.getElementById('history-body');
    if (!body) return;
    if (!this.history.length) {
      body.innerHTML = '<div style="padding:16px 20px;font-size:10px;letter-spacing:.1em;color:var(--c-text-faint);text-align:center">AUCUNE PARTIE JOUÉE</div>';
      return;
    }
    let running = this.credits;
    body.innerHTML = this.history.map((h, i) => {
      const balance = this.credits + this.history.slice(0, i).reduce((acc, x) => acc - x.gain, 0);
      const cls = h.result === 'win' ? 'hr-win' : h.result === 'lose' ? 'hr-lose' : 'hr-push';
      const gainTxt = h.gain > 0 ? `+${h.gain}` : h.gain;
      return `<div class="history-row">
        <span class="hr-game">${h.game}</span>
        <span class="${cls}">${h.result.toUpperCase()}</span>
        <span>${h.bet} C</span>
        <span class="${cls}">${gainTxt} C</span>
        <span style="color:var(--c-text-muted)">${balance.toLocaleString('fr-FR')} C</span>
      </div>`;
    }).join('');
  }

  // ── HELPERS ───────────────────────────────────────────────────────────
  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}
