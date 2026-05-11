/**
 * slots.js — Machine à sous pour le module Casino STAR
 * Export : mount(container, casinoCore) → instance
 *
 * Mécaniques :
 *  - 3 rouleaux × 5 symboles (arrêt séquentiel)
 *  - Mise 1 – 50 CR ajustable
 *  - Paiements : 3× jackpot (×50), 3× étoile (×20), 3× lune (×10),
 *                3× identiques (×5), 2× jackpot (×3), aucune (×0)
 *  - Bouton SPIN + auto-stop par clic sur rouleau en cours
 */

import { SFX } from '../casino-core.js';

// ── Symboles ─────────────────────────────────────────────────────────────────
const SYMBOLS = [
  { id: 'jackpot', glyph: '★', label: 'JACKPOT', weight: 1  },
  { id: 'star',    glyph: '✦', label: 'STAR',    weight: 3  },
  { id: 'moon',    glyph: '☽', label: 'MOON',    weight: 5  },
  { id: 'gem',     glyph: '◈', label: 'GEM',     weight: 8  },
  { id: 'bar',     glyph: '▰', label: 'BAR',     weight: 10 },
  { id: 'coin',    glyph: '◉', label: 'COIN',    weight: 14 },
  { id: 'seven',   glyph: '7', label: 'SEVEN',   weight: 6  },
  { id: 'bell',    glyph: '♪', label: 'BELL',    weight: 7  },
];

// Pool pondéré
const POOL = [];
for (const s of SYMBOLS) for (let i = 0; i < s.weight; i++) POOL.push(s);

// Table de paiement (multiplicateur × mise)
const PAYOUTS = [
  { match: 3, id: 'jackpot', mult: 50,  label: '★★★ JACKPOT ★★★' },
  { match: 3, id: 'seven',   mult: 25,  label: '7 7 7 — BIG WIN'  },
  { match: 3, id: 'star',    mult: 20,  label: '✦✦✦ STAR WIN'    },
  { match: 3, id: 'moon',    mult: 10,  label: '☽☽☽ MOON WIN'    },
  { match: 3, id: '*',       mult: 5,   label: 'TRIPLE — WIN ×5'  },
  { match: 2, id: 'jackpot', mult: 3,   label: '★★ JACKPOT PAIR'  },
  { match: 2, id: 'seven',   mult: 2,   label: '7 7 — PAIR'       },
];

const BETS = [1, 2, 5, 10, 20, 50];

function weightedRandom() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

function evaluate(row) {
  // 3 identiques spécifiques
  for (const p of PAYOUTS) {
    if (p.match === 3 && p.id !== '*' && row.every(s => s.id === p.id)) return p;
  }
  // 3 identiques quelconques
  if (row[0].id === row[1].id && row[1].id === row[2].id) {
    return PAYOUTS.find(p => p.match === 3 && p.id === '*');
  }
  // Paires jackpot / seven
  for (const p of PAYOUTS.filter(p => p.match === 2)) {
    if (row.filter(s => s.id === p.id).length >= 2) return p;
  }
  return null;
}

// ── Export principal ──────────────────────────────────────────────────────────
export async function mount(container, core) {
  const game = new SlotsGame(container, core);
  game.render();
  return game;
}

// ── Classe principale ─────────────────────────────────────────────────────────
class SlotsGame {
  constructor(container, core) {
    this.el   = container;
    this.core = core;
    this.bet  = 5;
    this.spinning = false;
    this.reels    = [null, null, null];  // symboles résultats
    this._stopFlags = [false, false, false];
    this._spinTimers = [];
    this._reelEls    = [];
  }

  render() {
    this.el.innerHTML = `
      <div class="game-wrap slots-wrap">

        <!-- Paytable -->
        <details class="slots-paytable">
          <summary>PAYTABLE ▾</summary>
          <div class="slots-paytable__grid">
            <span>★★★ JACKPOT</span><span>×50</span>
            <span>7 7 7</span><span>×25</span>
            <span>✦✦✦ STAR</span><span>×20</span>
            <span>☽☽☽ MOON</span><span>×10</span>
            <span>3× identiques</span><span>×5</span>
            <span>★★ paire</span><span>×3</span>
            <span>7 7 paire</span><span>×2</span>
          </div>
        </details>

        <!-- Machine -->
        <div class="slots-machine">
          <div class="slots-window">
            <div class="slots-reel-wrap">
              <div class="slots-reel" id="sl-reel-0" data-reel="0"><span class="slots-symbol">?</span></div>
              <div class="slots-reel" id="sl-reel-1" data-reel="1"><span class="slots-symbol">?</span></div>
              <div class="slots-reel" id="sl-reel-2" data-reel="2"><span class="slots-symbol">?</span></div>
            </div>
            <div class="slots-payline" aria-hidden="true"></div>
          </div>

          <!-- Résultat -->
          <div class="game-result" id="sl-result">GOOD LUCK</div>
        </div>

        <!-- Commandes -->
        <div class="slots-controls">
          <!-- Mise -->
          <div class="bet-panel">
            <span class="bet-panel__label">Bet</span>
            <button class="bet-btn" id="sl-bet-down">−</button>
            <span class="bet-value" id="sl-bet-display">${this.bet}</span>
            <button class="bet-btn" id="sl-bet-up">+</button>
            <div class="bet-presets">
              ${BETS.map(b => `<button class="bet-preset-btn" data-bet="${b}">${b}</button>`).join('')}
            </div>
          </div>

          <!-- SPIN -->
          <div class="action-row">
            <button class="btn btn-primary btn-spin" id="sl-spin">SPIN</button>
            <button class="btn btn-secondary" id="sl-stop-all" disabled>STOP ALL</button>
          </div>

          <!-- Stats session -->
          <div class="slots-session" id="sl-session">
            <span>SPINS <b id="sl-stat-spins">0</b></span>
            <span>WINS  <b id="sl-stat-wins">0</b></span>
          </div>
        </div>

      </div>`;

    this._reelEls = [
      this.el.querySelector('#sl-reel-0'),
      this.el.querySelector('#sl-reel-1'),
      this.el.querySelector('#sl-reel-2'),
    ];

    this._sessionSpins = 0;
    this._sessionWins  = 0;

    this._bind();
  }

  _bind() {
    this.el.querySelector('#sl-spin').addEventListener('click', () => this._spin());
    this.el.querySelector('#sl-stop-all').addEventListener('click', () => this._stopAll());

    this.el.querySelector('#sl-bet-up').addEventListener('click', () => {
      const idx = BETS.indexOf(this.bet);
      if (idx < BETS.length - 1) this._setBet(BETS[idx + 1]);
    });
    this.el.querySelector('#sl-bet-down').addEventListener('click', () => {
      const idx = BETS.indexOf(this.bet);
      if (idx > 0) this._setBet(BETS[idx - 1]);
    });
    this.el.querySelectorAll('.bet-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setBet(parseInt(btn.dataset.bet)));
    });

    // Clic sur un rouleau = stop ce rouleau
    this._reelEls.forEach((el, i) => {
      el.addEventListener('click', () => {
        if (this.spinning && !this._stopFlags[i]) this._stopReel(i);
      });
    });
  }

  _setBet(v) {
    this.bet = v;
    const el = this.el.querySelector('#sl-bet-display');
    if (el) el.textContent = v;
    SFX.chip();
  }

  async _spin() {
    if (this.spinning) return;
    if (this.core.credits.credits < this.bet) {
      this._setResult('NOT ENOUGH CREDITS', 'lose');
      this.core.showToast('CREDITS INSUFFISANTS', 'lose');
      return;
    }

    this.spinning = true;
    this._stopFlags = [false, false, false];
    this.reels = [null, null, null];

    const spinBtn   = this.el.querySelector('#sl-spin');
    const stopBtn   = this.el.querySelector('#sl-stop-all');
    spinBtn.disabled = true;
    stopBtn.disabled = false;
    this._setBetControlsDisabled(true);

    await this.core.reward(-this.bet, 'chip');
    this._sessionSpins++;
    this._updateStats();
    this._setResult('SPINNING...', '');

    // Pré-calcule les résultats
    const results = [weightedRandom(), weightedRandom(), weightedRandom()];

    SFX.spin();

    // Lance les 3 rouleaux en parallèle avec arrêts décalés
    const reelPromises = results.map((sym, i) =>
      this._animateReel(i, sym, 1200 + i * 600)
    );

    await Promise.all(reelPromises);

    this.spinning = false;
    spinBtn.disabled = false;
    stopBtn.disabled = true;
    this._setBetControlsDisabled(false);

    await this._evaluate(results);
  }

  _stopAll() {
    for (let i = 0; i < 3; i++) {
      if (!this._stopFlags[i]) this._stopReel(i);
    }
    SFX.click();
  }

  _stopReel(i) {
    this._stopFlags[i] = true;
    SFX.tick();
  }

  /**
   * Anime un rouleau : fait défiler des symboles aléatoires
   * jusqu'à stopFlag ou timeout, puis pose le symbole final.
   */
  _animateReel(index, finalSymbol, autoStopMs) {
    return new Promise(resolve => {
      const el = this._reelEls[index];
      const symEl = el.querySelector('.slots-symbol');
      el.classList.add('spinning');

      let elapsed = 0;
      const interval = 80;

      const autoStop = setTimeout(() => {
        this._stopFlags[index] = true;
      }, autoStopMs);

      const tick = setInterval(() => {
        elapsed += interval;

        if (this._stopFlags[index]) {
          clearInterval(tick);
          clearTimeout(autoStop);
          symEl.textContent = finalSymbol.glyph;
          el.classList.remove('spinning');
          el.classList.add('stopped');
          setTimeout(() => el.classList.remove('stopped'), 300);
          this.reels[index] = finalSymbol;
          resolve();
          return;
        }

        // Affiche un symbole aléatoire pendant le spin
        symEl.textContent = POOL[Math.floor(Math.random() * POOL.length)].glyph;
      }, interval);

      this._spinTimers.push(tick);
    });
  }

  async _evaluate(results) {
    const payout = evaluate(results);
    
    if (payout) {
      const gain = this.bet * payout.mult;
      const sfx  = payout.mult >= 20 ? 'bigWin' : 'win';
      await this.core.reward(gain, sfx);
      this._setResult(`${payout.label}  +${gain} CR`, 'win');
      this.core.showToast(`${payout.label}  +${gain} CR`, 'win');
      this._sessionWins++;

      // Flash rouleaux gagnants
      this._reelEls.forEach(el => el.classList.add('reel-win'));
      setTimeout(() => this._reelEls.forEach(el => el.classList.remove('reel-win')), 800);
    } else {
      SFX.lose();
      this._setResult(`RIEN — −${this.bet} CR`, 'lose');
    }

    this._updateStats();

    // Auto-ajuste la mise si plus assez de crédits
    if (this.core.credits.credits < this.bet) {
      const newBet = BETS.slice().reverse().find(b => b <= this.core.credits.credits);
      if (newBet) this._setBet(newBet);
    }
  }

  _setResult(txt, cls) {
    const el = this.el.querySelector('#sl-result');
    if (!el) return;
    el.textContent  = txt;
    el.className    = 'game-result' + (cls ? ` ${cls}` : '');
  }

  _updateStats() {
    const spinsEl = this.el.querySelector('#sl-stat-spins');
    const winsEl  = this.el.querySelector('#sl-stat-wins');
    if (spinsEl) spinsEl.textContent = this._sessionSpins;
    if (winsEl)  winsEl.textContent  = this._sessionWins;
  }

  _setBetControlsDisabled(disabled) {
    ['#sl-bet-up', '#sl-bet-down'].forEach(sel => {
      const el = this.el.querySelector(sel);
      if (el) el.disabled = disabled;
    });
    this.el.querySelectorAll('.bet-preset-btn').forEach(btn => {
      btn.disabled = disabled;
    });
  }
}
