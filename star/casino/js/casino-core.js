/**
 * casino-core.js  —  STAR CASINO  v1.1
 * Whack-A-Mole · Roulette · Crash
 * Monnaie : Chronicles (Supabase profiles.chronicles)
 */
import { supabase } from '../../../js/supabase.js';

const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

// ── SOUND ENGINE ─────────────────────────────────────────────────────
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
  win()    { const ctx=this._g(); if(!ctx)return; [523,659,784,1047].forEach((f,i)=>this._t(f,'triangle',.09,.01,.14,ctx.currentTime+i*.09)); },
  lose()   { const ctx=this._g(); if(!ctx)return; [330,280,220].forEach((f,i)=>this._t(f,'sawtooth',.07,.01,.18,ctx.currentTime+i*.12)); },
  push()   { this._t(440,'sine',.07,.01,.2); },
  hover()  { this._t(1100,'sine',.03,.002,.03); },
  crash()  { const ctx=this._g(); if(!ctx)return; [200,160,120].forEach((f,i)=>this._t(f,'sawtooth',.1,.005,.3,ctx.currentTime+i*.08)); this._n(.1,.5); },
  eject()  { const ctx=this._g(); if(!ctx)return; [660,880,1100].forEach((f,i)=>this._t(f,'triangle',.08,.005,.1,ctx.currentTime+i*.05)); },
  tick()   { this._t(1400,'square',.04,.002,.015); },
  // Whack SFX
  whack()  { this._n(.12,.04); this._t(300,'square',.08,.003,.06); },
  bomb()   { const ctx=this._g(); if(!ctx)return; [150,100,80].forEach((f,i)=>this._t(f,'sawtooth',.12,.005,.25,ctx.currentTime+i*.04)); this._n(.1,.3); },
  golden() { const ctx=this._g(); if(!ctx)return; [880,1100,1320,1760].forEach((f,i)=>this._t(f,'sine',.08,.005,.15,ctx.currentTime+i*.05)); },
  miss()   { this._t(220,'sine',.04,.003,.12); },
  countdown(n) { this._t(n===0?880:440,'square',.07,.005,.1); },
  wamEnd() { const ctx=this._g(); if(!ctx)return; [440,554,659,880].forEach((f,i)=>this._t(f,'triangle',.1,.01,.18,ctx.currentTime+i*.1)); },
};

// ── ROULETTE CONFIG ────────────────────────────────────────────────────
const RL_NUMS = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,
  24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];
const RL_RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

// ── WAM CONFIG ────────────────────────────────────────────────────────
const WAM_DURATION  = 30;   // secondes
const WAM_HOLES     = 12;
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
    this._currentGame = null;
    // Crash state
    this._crashMult      = 1.00;
    this._crashRunning   = false;
    this._crashCashedOut = false;
    this._crashAnimId    = null;
    this._crashBetActive = false;
    // Roulette
    this._rlBetType  = null;
    this._rlBetVal   = null;
    this._rlSpinning = false;
    // Wam
    this._wamTimers  = [];
    this._wamRunning = false;
    this._wamRafId   = null;
  }

  // ── SUPABASE ─────────────────────────────────────────────────────────
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

  // ── RENDER MAIN SHELL ────────────────────────────────────────────────
  showLobby() {
    const root = document.querySelector(this.mountSel);
    if (!root) return;

    root.innerHTML = `
    <div class="scanlines" aria-hidden="true"></div>
    <div class="casino-page" id="casino-page">
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
            <div class="gc-icon">🔨</div>
            <div class="gc-tag">// JEU 01</div>
            <div class="gc-title">WHACK-A-MOLE</div>
            <div class="gc-desc">30 secondes. Frappe les entités cyber avant qu'elles replongent. Évite les bombes. La taupe dorée vaut ×5.</div>
            <div class="gc-meta">
              <span class="gc-badge">RÉFLEXES</span>
              <span class="gc-badge">⭐ ×5 PTS</span>
              <span class="gc-badge">30 SEC</span>
            </div>
            <div class="gc-play-btn">▶ JOUER</div>
          </div>

          <div class="game-card" style="--card-color:var(--c-purple)" id="card-rl">
            <div class="gc-icon">🎡</div>
            <div class="gc-tag">// JEU 02</div>
            <div class="gc-title">ROULETTE</div>
            <div class="gc-desc">Mise sur couleur, numéro ou zéro. Roue européenne 37 cases. Numéro plein = ×36.</div>
            <div class="gc-meta">
              <span class="gc-badge">CHANCE</span>
              <span class="gc-badge">×36 PLEIN</span>
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

        <div class="history-section" style="margin-top:48px;width:100%" id="history-section">
          <div class="history-head">
            <span>JEU</span><span>RÉSULTAT</span><span>MISE</span><span>GAIN</span><span>SOLDE</span>
          </div>
          <div class="history-body" id="history-body"></div>
        </div>
      </section>

      <section class="casino-game" id="game-wam"></section>
      <section class="casino-game" id="game-roulette"></section>
      <section class="casino-game" id="game-crash"></section>
    </div>`;

    document.getElementById('card-wam')?.addEventListener('click',   () => { SFX.click(); this._showGame('wam'); });
    document.getElementById('card-rl')?.addEventListener('click',    () => { SFX.click(); this._showGame('roulette'); });
    document.getElementById('card-crash')?.addEventListener('click', () => { SFX.click(); this._showGame('crash'); });
    ['card-wam','card-rl','card-crash'].forEach(id => {
      document.getElementById(id)?.addEventListener('mouseenter', () => SFX.hover());
    });
    this._renderHistory();
  }

  // ── NAV ───────────────────────────────────────────────────────────────
  _showGame(name) {
    document.getElementById('view-lobby')?.style.setProperty('display','none');
    document.querySelectorAll('.casino-game').forEach(g => g.classList.remove('active'));
    const e = document.getElementById(`game-${name}`);
    if (!e) return;
    e.classList.add('active');
    this._currentGame = name;
    if      (name === 'wam')      this._initWam();
    else if (name === 'roulette') this._initRoulette();
    else if (name === 'crash')    this._initCrash();
  }

  _backToLobby() {
    this._wamStop();
    if (this._crashAnimId) { cancelAnimationFrame(this._crashAnimId); this._crashAnimId = null; }
    document.querySelectorAll('.casino-game').forEach(g => g.classList.remove('active'));
    document.getElementById('view-lobby').style.removeProperty('display');
    this._currentGame = null;
  }

  _updateCreditsDisplay() {
    const e = document.getElementById('sb-credits');
    if (e) e.textContent = this.credits.toLocaleString('fr-FR');
  }

  // ── BET PANEL ─────────────────────────────────────────────────────────
  _betPanelHTML(id) {
    const presets = [1,5,10,25,50,100];
    return `<div class="bet-panel">
      <span class="bet-label">MISE</span>
      <button class="bet-btn" id="${id}-bet-down">−</button>
      <span class="bet-val" id="${id}-bet-val">${this.bet}</span>
      <button class="bet-btn" id="${id}-bet-up">+</button>
      <div class="bet-presets">${presets.map(p=>`<button class="bet-preset${this.bet===p?' active':''}" data-preset="${p}">${p}</button>`).join('')}</div>
    </div>`;
  }

  _bindBetPanel(id) {
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
      b.addEventListener('click', () => { SFX.click(); this.bet = Math.min(this.credits, Number(b.dataset.preset)); upd(); });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // WHACK-A-MOLE
  // ═══════════════════════════════════════════════════════════════════
  _initWam() {
    this._wamStop();
    const g = document.getElementById('game-wam');
    // Grille HTML
    const holes = Array.from({length:WAM_HOLES}, (_,i) =>
      `<div class="wam-hole" id="wh-${i}" data-idx="${i}" data-type="normal">
        <div class="wam-mole" id="wm-${i}">🤖</div>
      </div>`
    ).join('');

    g.innerHTML = `
      <div class="game-header">
        <button class="game-back-btn" id="wam-back">← LOBBY</button>
        <span class="game-title">WHACK-A-<span class="game-title-accent">MOLE</span></span>
      </div>
      ${this._betPanelHTML('wam')}
      <div class="wam-arena" id="wam-arena">
        <div class="wam-hud">
          <div class="wam-hud-block">
            <span class="wam-hud-label">SCORE</span>
            <span class="wam-hud-val" id="wam-score">0</span>
          </div>
          <div class="wam-hud-block">
            <span class="wam-hud-label">TEMPS</span>
            <span class="wam-hud-val wam-timer" id="wam-timer">${WAM_DURATION}</span>
          </div>
          <div class="wam-hud-block">
            <span class="wam-hud-label">COMBO</span>
            <span class="wam-hud-val wam-combo" id="wam-combo">x1</span>
          </div>
          <div class="wam-hud-block">
            <span class="wam-hud-label">FRAPPÉES</span>
            <span class="wam-hud-val" id="wam-hits" style="color:var(--c-green);font-size:1.2rem">0</span>
          </div>
        </div>
        <div class="wam-grid" id="wam-grid">${holes}</div>
        <div class="wam-timebar-wrap"><div class="wam-timebar" id="wam-timebar"></div></div>
      </div>
      <div class="game-msg" id="wam-msg">MISE ET LANCE LA PARTIE</div>
      <div class="action-row">
        <button class="action-btn primary" id="wam-start">▶ DÉMARRER</button>
      </div>`;

    document.getElementById('wam-back')?.addEventListener('click', () => { this._wamStop(); this._backToLobby(); });
    document.getElementById('wam-start')?.addEventListener('click', () => this._wamLaunch());
    this._bindBetPanel('wam');
  }

  async _wamLaunch() {
    if (this._wamRunning) return;
    if (this.credits < this.bet) { this._wamMsg('CRÉDITS INSUFFISANTS','lose'); return; }
    this.credits -= this.bet;
    await this._saveCredits();

    this._wamScore  = 0;
    this._wamHits   = 0;
    this._wamCombo  = 1;
    this._wamMisses = 0;
    document.getElementById('wam-start').disabled = true;
    this._wamMsg('','');

    // Countdown 3-2-1-GO
    await this._wamCountdown();
    this._wamStart();
  }

  async _wamCountdown() {
    const arena = document.getElementById('wam-arena');
    for (const txt of ['3','2','1','GO!']) {
      SFX.countdown(txt === 'GO!' ? 0 : 1);
      const d = document.createElement('div');
      d.className = 'wam-countdown'; d.textContent = txt;
      arena.appendChild(d);
      await this._delay(650);
      d.remove();
    }
  }

  _wamStart() {
    this._wamRunning  = true;
    this._wamTimeLeft = WAM_DURATION;
    this._wamT0       = performance.now();
    this._wamLastTick = this._wamT0;
    this._wamActiveHoles = new Array(WAM_HOLES).fill(null); // null | {type,timer}
    this._wamScheduleAll();
    this._wamRafId = requestAnimationFrame(() => this._wamTick());
  }

  _wamTick() {
    if (!this._wamRunning) return;
    const now = performance.now();
    const elapsed = (now - this._wamT0) / 1000;
    const timeLeft = Math.max(0, WAM_DURATION - elapsed);

    const timerEl = document.getElementById('wam-timer');
    const barEl   = document.getElementById('wam-timebar');
    if (timerEl) {
      timerEl.textContent = Math.ceil(timeLeft);
      timerEl.classList.toggle('urgent', timeLeft <= 8);
    }
    if (barEl) {
      barEl.style.transform = `scaleX(${timeLeft / WAM_DURATION})`;
      barEl.classList.toggle('urgent', timeLeft <= 8);
    }
    if (timeLeft <= 0) { this._wamEnd(); return; }
    this._wamRafId = requestAnimationFrame(() => this._wamTick());
  }

  _wamScheduleAll() {
    // Programmation initiale et continue des apparitions
    const schedule = () => {
      if (!this._wamRunning) return;
      const freeHoles = Array.from({length:WAM_HOLES},(_,i)=>i)
        .filter(i => !this._wamActiveHoles[i]);
      if (freeHoles.length === 0) { this._wamTimers.push(setTimeout(schedule, 300)); return; }
      // Nb de taupes simultanées selon le temps écoulé
      const elapsed = (performance.now() - this._wamT0) / 1000;
      const maxSim = elapsed < 8 ? 2 : elapsed < 18 ? 3 : 4;
      const active = this._wamActiveHoles.filter(Boolean).length;
      if (active < maxSim) {
        const holeIdx = freeHoles[Math.floor(Math.random() * freeHoles.length)];
        this._wamPopMole(holeIdx);
      }
      const nextDelay = 400 + Math.random() * 600;
      this._wamTimers.push(setTimeout(schedule, nextDelay));
    };
    schedule();
  }

  _wamPickType() {
    const r = Math.random();
    let cum = 0;
    for (const t of WAM_MOLE_TYPES) {
      cum += t.prob;
      if (r < cum) return t;
    }
    return WAM_MOLE_TYPES[0];
  }

  _wamPopMole(idx) {
    if (!this._wamRunning) return;
    const type = this._wamPickType();
    const hole = document.getElementById(`wh-${idx}`);
    const mole = document.getElementById(`wm-${idx}`);
    if (!hole || !mole) return;

    hole.dataset.type = type.type;
    mole.textContent  = type.emoji;
    hole.classList.add('active');
    this._wamActiveHoles[idx] = type;

    // Retire après la durée d'apparition
    const timer = setTimeout(() => {
      if (!this._wamRunning) return;
      hole.classList.remove('active');
      this._wamActiveHoles[idx] = null;
      // Pénalité légère si taupe normale ratée (pas bombe)
    }, type.spd * 1000 + 400);
    this._wamTimers.push(timer);

    // Gestionnaire de clic
    const onClick = (e) => {
      e.stopPropagation();
      if (!this._wamRunning || !hole.classList.contains('active')) return;
      hole.removeEventListener('click', onClick);
      clearTimeout(timer);
      hole.classList.remove('active');
      this._wamActiveHoles[idx] = null;
      this._wamHitMole(idx, type, hole);
    };
    hole.addEventListener('click', onClick, { once:true });
  }

  _wamHitMole(idx, type, holeEl) {
    if (type.type === 'bomb') {
      // Bombe : pénalité score + reset combo
      SFX.bomb();
      this._wamScore  = Math.max(0, this._wamScore + type.pts);
      this._wamCombo  = 1;
      holeEl.classList.add('miss');
      this._wamPopScoreEl(holeEl, `${type.pts} 💥`, true);
      setTimeout(() => holeEl.classList.remove('miss'), 300);
    } else {
      const pts = type.pts * this._wamCombo;
      if (type.type === 'golden') SFX.golden();
      else SFX.whack();
      this._wamScore += pts;
      this._wamHits++;
      this._wamCombo = Math.min(8, this._wamCombo + 1);
      holeEl.classList.add('hit');
      this._wamPopScoreEl(holeEl, `+${pts}`, false);
      setTimeout(() => holeEl.classList.remove('hit'), 300);
    }
    this._wamUpdateHUD();
  }

  _wamPopScoreEl(holeEl, txt, neg) {
    const p = el('div', `wam-score-pop${neg?' neg':''}`, txt);
    holeEl.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }

  _wamUpdateHUD() {
    const s = document.getElementById('wam-score');
    const c = document.getElementById('wam-combo');
    const h = document.getElementById('wam-hits');
    if (s) s.textContent = this._wamScore;
    if (c) c.textContent = `x${this._wamCombo}`;
    if (h) h.textContent = this._wamHits;
  }

  _wamStop() {
    this._wamRunning = false;
    this._wamTimers.forEach(t => clearTimeout(t));
    this._wamTimers = [];
    if (this._wamRafId) { cancelAnimationFrame(this._wamRafId); this._wamRafId = null; }
    // Retire toutes les taupes actives visuellement
    document.querySelectorAll('.wam-hole.active').forEach(h => h.classList.remove('active'));
  }

  async _wamEnd() {
    this._wamStop();
    SFX.wamEnd();

    const score = this._wamScore;
    // Gain = mise * score / 10 (arrondi), min 0
    // Ex: mise 10C, score 15 → gain 15C (×1.5)
    const gain   = Math.round(this.bet * score / 10);
    const net    = gain - this.bet;
    const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';

    if (gain > 0) { this.credits += gain; await this._saveCredits(); }
    this._addHistory('WHACK', this.bet, result, net);

    // Affiche l'écran de résultat
    const arena = document.getElementById('wam-arena');
    if (arena) {
      const res = document.createElement('div');
      res.className = 'wam-result-screen';
      const gainTxt = net >= 0 ? `<span class="gain-pos">+${net} C</span>` : `<span class="gain-neg">${net} C</span>`;
      res.innerHTML = `
        <div class="wam-result-title">PARTIE TERMINÉE</div>
        <div class="wam-result-score">${score} PTS</div>
        <div class="wam-result-gain">
          MISE ${this.bet} C → GAIN <strong>${gain} C</strong> ${gainTxt}
        </div>
        <div style="font-size:11px;letter-spacing:.12em;color:var(--c-text-faint)">
          ${this._wamHits} TAUPE${this._wamHits>1?'S':''} FRAPPÉE${this._wamHits>1?'S':''}
        </div>`;
      arena.appendChild(res);
    }

    const msg = net > 0 ? `🔨 +${net} C — BIEN JOUÉ !` : net < 0 ? `Score insuffisant — ${net} C` : 'ÉGALITÉ — REMBOURSÉ';
    this._wamMsg(msg, result);

    const btn = document.getElementById('wam-start');
    if (btn) { btn.disabled = false; btn.textContent = '↺ REJOUER'; }
    // Retire l'écran de résultat au clic sur REJOUER
    document.getElementById('wam-start')?.addEventListener('click', () => {
      document.querySelector('.wam-result-screen')?.remove();
    }, { once:true });
  }

  _wamMsg(txt, type='') {
    const e = document.getElementById('wam-msg');
    if (!e) return; e.textContent = txt; e.className = 'game-msg'+(type?` ${type}`:'');
  }

  // ═══════════════════════════════════════════════════════════════════
  // ROULETTE
  // ═══════════════════════════════════════════════════════════════════
  _initRoulette() {
    this._rlBetType = null; this._rlBetVal = null; this._rlSpinning = false;
    const g = document.getElementById('game-roulette');
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
            ${Array.from({length:36},(_,i)=>i+1).map(n=>
              `<button class="rl-num-btn${RL_RED.has(n)?' red-num':' black-num'}" data-type="number" data-val="${n}">${n}</button>`
            ).join('')}
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
    const N = RL_NUMS.length, cx=110, cy=110, r=108;
    for (let i=0;i<N;i++) {
      const a0=(i/N)*Math.PI*2-Math.PI/2, a1=((i+1)/N)*Math.PI*2-Math.PI/2;
      const num=RL_NUMS[i];
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,a0,a1); ctx.closePath();
      ctx.fillStyle = num===0?'#007a33':RL_RED.has(num)?'#b01c1c':'#151515'; ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=1; ctx.stroke();
      ctx.save(); ctx.translate(cx,cy); ctx.rotate((a0+a1)/2); ctx.translate(r*.72,0); ctx.rotate(Math.PI/2);
      ctx.fillStyle='#fff'; ctx.font='bold 8px Share Tech Mono';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(num,0,0);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx,cy,14,0,Math.PI*2);
    ctx.fillStyle='#0f1117'; ctx.fill();
    ctx.strokeStyle='rgba(176,106,255,.5)'; ctx.lineWidth=2; ctx.stroke();
  }

  async _rlSpin() {
    if (this._rlSpinning) return;
    if (!this._rlBetType) { this._rlMsg("CHOISIS UNE MISE D'ABORD",'lose'); return; }
    if (this.credits < this.bet) { this._rlMsg('CRÉDITS INSUFFISANTS','lose'); return; }
    this._rlSpinning = true;
    this.credits -= this.bet;
    await this._saveCredits();
    document.getElementById('rl-spin').disabled = true;
    const resultIdx = Math.floor(Math.random() * RL_NUMS.length);
    const resultNum = RL_NUMS[resultIdx];
    const totalDeg  = 1440 + 360 - (resultIdx / RL_NUMS.length) * 360;
    const dur = 3.5;
    const wheel = document.getElementById('rl-wheel');
    if (wheel) {
      wheel.style.setProperty('--spin-deg',`${totalDeg}deg`);
      wheel.style.setProperty('--spin-dur',`${dur}s`);
      wheel.classList.add('spinning');
    }
    this._rlMsg('EN COURS…','neutral');
    await this._delay(dur*1000+200);
    if (wheel) wheel.classList.remove('spinning');
    const resEl = document.getElementById('rl-result');
    if (resEl) { resEl.textContent=resultNum; resEl.style.color=resultNum===0?'var(--c-green)':RL_RED.has(resultNum)?'#e74c3c':'var(--c-text)'; }
    let gain=0, result='lose';
    if (this._rlBetType==='color') {
      const winColor=resultNum===0?'green':RL_RED.has(resultNum)?'red':'black';
      if (winColor===this._rlBetVal) { const mult=resultNum===0?18:2; gain=this.bet*mult; result='win'; }
    } else {
      if (Number(this._rlBetVal)===resultNum) { gain=this.bet*36; result='win'; }
    }
    if (gain) { this.credits+=gain; await this._saveCredits(); SFX.win(); } else SFX.lose();
    this._rlMsg(gain>0?`🎡 NUMÉRO ${resultNum} — +${gain} C`:`NUMÉRO ${resultNum} — PERDU`, result);
    this._addHistory('ROULETTE',this.bet,result,gain-this.bet);
    document.getElementById('rl-spin').disabled=false;
    this._rlSpinning=false;
  }

  _rlMsg(txt,type='') {
    const e=document.getElementById('rl-msg');
    if(!e)return; e.textContent=txt; e.className='game-msg'+(type?` ${type}`:'');
  }

  // ═══════════════════════════════════════════════════════════════════
  // CRASH GAME
  // ═══════════════════════════════════════════════════════════════════
  _initCrash() {
    this._crashMult=1.00; this._crashRunning=false;
    this._crashCashedOut=false; this._crashBetActive=false;
    if (this._crashAnimId) { cancelAnimationFrame(this._crashAnimId); this._crashAnimId=null; }
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
    this._crashDrawCanvas(1.00,false);
  }

  _crashCrashPoint() {
    const r=Math.random();
    if(r<0.1)  return 1.00+Math.random()*0.5;
    if(r<0.4)  return 1.5 +Math.random()*1.5;
    if(r<0.7)  return 2.0 +Math.random()*3.0;
    if(r<0.9)  return 4.0 +Math.random()*8.0;
    if(r<0.97) return 10  +Math.random()*20;
    return 25+Math.random()*75;
  }

  async _crashStart() {
    if(this._crashRunning) return;
    if(this.credits<this.bet){ this._crashMsg('CRÉDITS INSUFFISANTS','lose'); return; }
    this.credits-=this.bet; await this._saveCredits();
    this._crashBetActive=true; this._crashRunning=true;
    this._crashCashedOut=false; this._crashMult=1.00;
    this._crashTarget=this._crashCrashPoint();
    this._crashAutoEject=parseFloat(document.getElementById('cr-auto')?.value??'2')||0;
    this._crashPoints=[[0,0]]; this._crashT0=performance.now();
    document.getElementById('cr-start').disabled=true;
    document.getElementById('cr-eject').disabled=false;
    this._crashMsg('EN VOL — ÉJECTE-TOI !','neutral');
    this._crashLoop();
  }

  _crashLoop() {
    const step=()=>{
      if(!this._crashRunning) return;
      const elapsed=(performance.now()-this._crashT0)/1000;
      this._crashMult=Math.round(Math.pow(1.06,elapsed*6)*100)/100;
      const multEl=document.getElementById('cr-mult');
      if(multEl) multEl.textContent=`${this._crashMult.toFixed(2)}×`;
      this._crashPoints.push([elapsed,this._crashMult]);
      this._crashDrawCanvas(this._crashMult,false);
      SFX.tick();
      if(this._crashAutoEject>1&&this._crashMult>=this._crashAutoEject&&!this._crashCashedOut){ this._crashEject(); return; }
      if(this._crashMult>=this._crashTarget){ this._crashDoCrash(); return; }
      this._crashAnimId=requestAnimationFrame(step);
    };
    this._crashAnimId=requestAnimationFrame(step);
  }

  _crashEject() {
    if(!this._crashRunning||this._crashCashedOut||!this._crashBetActive) return;
    SFX.eject(); this._crashCashedOut=true;
    const gain=Math.round(this.bet*this._crashMult);
    this.credits+=gain; this._saveCredits();
    this._crashMsg(`🚀 ÉJECTÉ × ${this._crashMult.toFixed(2)} — +${gain} C`,'win');
    this._addHistory('CRASH',this.bet,'win',gain-this.bet);
    this._addCrashPill(this._crashMult,'safe');
    document.getElementById('cr-eject').disabled=true;
  }

  _crashDoCrash() {
    cancelAnimationFrame(this._crashAnimId); this._crashRunning=false;
    const m=document.getElementById('cr-mult');
    if(m){ m.textContent=`💥 ${this._crashMult.toFixed(2)}×`; m.classList.add('crashed'); }
    SFX.crash(); this._crashDrawCanvas(this._crashMult,true);
    if(!this._crashCashedOut){
      this._crashMsg(`CRASH × ${this._crashMult.toFixed(2)} — PERDU`,'lose');
      this._addHistory('CRASH',this.bet,'lose',-this.bet);
      const cat=this._crashMult<1.5?'danger':this._crashMult<3?'risky':'safe';
      this._addCrashPill(this._crashMult,cat);
    }
    this._crashBetActive=false;
    document.getElementById('cr-start').disabled=false;
    document.getElementById('cr-eject').disabled=true;
    setTimeout(()=>{ const m=document.getElementById('cr-mult'); if(m){ m.classList.remove('crashed'); m.textContent='1.00×'; } },2000);
  }

  _crashAbort() {
    if(this._crashAnimId) cancelAnimationFrame(this._crashAnimId);
    this._crashRunning=false;
  }

  _addCrashPill(mult,cat) {
    const wrap=document.getElementById('cr-history'); if(!wrap) return;
    const p=el('span',`crash-hist-pill ${cat}`,`${mult.toFixed(2)}×`);
    wrap.insertBefore(p,wrap.firstChild);
    if(wrap.children.length>12) wrap.lastChild?.remove();
  }

  _crashMsg(txt,type='') {
    const e=document.getElementById('cr-msg');
    if(!e)return; e.textContent=txt; e.className='game-msg'+(type?` ${type}`:'');
  }

  _crashDrawCanvas(mult,crashed) {
    const canvas=document.getElementById('cr-canvas'); if(!canvas) return;
    const ctx=canvas.getContext('2d'), W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=1;
    for(let x=0;x<W;x+=60){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for(let y=0;y<H;y+=40){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
    if(!this._crashPoints||this._crashPoints.length<2) return;
    const pts=this._crashPoints;
    const maxT=Math.max(pts[pts.length-1][0],1), maxM=Math.max(mult,2);
    const toX=t=>(t/maxT)*(W-20)+10, toY=m=>H-10-((m-1)/(maxM-1))*(H-20);
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,crashed?'rgba(255,71,87,.3)':'rgba(255,110,180,.25)');
    grad.addColorStop(1,crashed?'rgba(255,71,87,.02)':'rgba(255,110,180,.02)');
    ctx.beginPath(); ctx.moveTo(toX(pts[0][0]),H);
    pts.forEach(([t,m])=>ctx.lineTo(toX(t),toY(m)));
    ctx.lineTo(toX(pts[pts.length-1][0]),H); ctx.closePath();
    ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath();
    pts.forEach(([t,m],i)=>{ if(i===0)ctx.moveTo(toX(t),toY(m)); else ctx.lineTo(toX(t),toY(m)); });
    ctx.strokeStyle=crashed?'var(--c-red,#ff4757)':'var(--c-pink,#ff6eb4)';
    ctx.lineWidth=2.5; ctx.stroke();
    const last=pts[pts.length-1];
    ctx.beginPath(); ctx.arc(toX(last[0]),toY(last[1]),5,0,Math.PI*2);
    ctx.fillStyle=crashed?'#ff4757':'#ff6eb4';
    ctx.shadowColor=crashed?'#ff4757':'#ff6eb4'; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0;
  }

  // ── HISTORY ──────────────────────────────────────────────────────────
  _renderHistory() {
    const body=document.getElementById('history-body'); if(!body) return;
    if(!this.history.length){
      body.innerHTML='<div style="padding:16px 20px;font-size:10px;letter-spacing:.1em;color:var(--c-text-faint);text-align:center">AUCUNE PARTIE JOUÉE</div>';
      return;
    }
    body.innerHTML=this.history.map((h,i)=>{
      const balance=this.credits+this.history.slice(0,i).reduce((acc,x)=>acc-x.gain,0);
      const cls=h.result==='win'?'hr-win':h.result==='lose'?'hr-lose':'hr-push';
      const gainTxt=h.gain>0?`+${h.gain}`:h.gain;
      return `<div class="history-row">
        <span class="hr-game">${h.game}</span>
        <span class="${cls}">${h.result.toUpperCase()}</span>
        <span>${h.bet} C</span>
        <span class="${cls}">${gainTxt} C</span>
        <span style="color:var(--c-text-muted)">${balance.toLocaleString('fr-FR')} C</span>
      </div>`;
    }).join('');
  }

  _delay(ms) { return new Promise(r=>setTimeout(r,ms)); }
}
