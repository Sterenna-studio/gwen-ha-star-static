/**
 * slots.js — Machine à sous pour le module Casino STAR
 * Export : mount(container, casinoCore) → instance
 *
 * Mécaniques :
 *  - 3 rouleaux × 3 lignes visibles
 *  - 7 symboles pondérés (thème STAR)
 *  - Mise variable (1–50 CR) via presets
 *  - Paylines : 3 identiques = x mult, 2 identiques = x1 (remboursé)
 *  - Auto-spin toggle
 *  - SFX via core (spin, win, bigWin, lose, chip, tick, push)
 */

// ── SYMBOLES ─────────────────────────────────────────────────────────────────
const SYMBOLS = [
  { id: 'star',   glyph: '⭐', mult: 10, weight: 4  },
  { id: 'gem',    glyph: '💎', mult: 8,  weight: 5  },
  { id: 'planet', glyph: '🪐', mult: 6,  weight: 6  },
  { id: 'rocket', glyph: '🚀', mult: 5,  weight: 8  },
  { id: 'comet',  glyph: '☄️', mult: 4,  weight: 10 },
  { id: 'moon',   glyph: '🌙', mult: 3,  weight: 14 },
  { id: 'bolt',   glyph: '⚡',  mult: 2,  weight: 18 },
];

// Pool pondéré
const POOL = SYMBOLS.flatMap(s => Array(s.weight).fill(s));

function randSymbol() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

// ── EXPORT ───────────────────────────────────────────────────────────────────
export async function mount(container, core) {
  const game = new SlotsGame(container, core);
  game.render();
  return game;
}

// ── CLASSE PRINCIPALE ────────────────────────────────────────────────────────
class SlotsGame {
  constructor(container, core) {
    this.el         = container;
    this.core       = core;
    this.bet        = 5;
    this.BETS       = [1, 2, 5, 10, 20, 50];
    this.spinning   = false;
    this.autoSpin   = false;
    this._autoTimer = null;
    // 3 rouleaux × 3 lignes visibles
    this.reels      = [[null,null,null],[null,null,null],[null,null,null]];
    this._initReels();
  }

  _initReels() {
    for (let r = 0; r < 3; r++)
      for (let row = 0; row < 3; row++)
        this.reels[r][row] = randSymbol();
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  render() {
    this.el.innerHTML = `
      <div class="game-wrap slots-wrap">

        <!-- Machine -->
        <div class="slots-machine">
          <div class="slots-title">★ STAR SLOTS ★</div>

          <!-- Rouleaux -->
          <div class="slots-reels" id="slots-reels">
            ${[0,1,2].map(r => `
              <div class="slots-reel" id="slots-reel-${r}">
                ${[0,1,2].map(row => `
                  <div class="slots-cell${row === 1 ? ' slots-cell--center' : ''}" id="slots-cell-${r}-${row}">
                    ${this.reels[r][row].glyph}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>

          <!-- Payline center -->
          <div class="slots-payline" aria-hidden="true"></div>

          <!-- Résultat -->
          <div class="game-result" id="slots-result">PLACE YOUR BET &amp; SPIN</div>
        </div>

        <!-- Paytable -->
        <div class="slots-paytable">
          <div class="slots-paytable__title">PAYTABLE</div>
          ${[...SYMBOLS].sort((a,b) => b.mult - a.mult).map(s =>
            `<div class="slots-pay-row">
              <span class="slots-pay-sym">${s.glyph} ${s.glyph} ${s.glyph}</span>
              <span class="slots-pay-mult">× ${s.mult}</span>
            </div>`
          ).join('')}
          <div class="slots-pay-row slots-pay-row--minor">
            <span class="slots-pay-sym">X X —</span>
            <span class="slots-pay-mult">× 1 (pair)</span>
          </div>
        </div>

        <!-- Contrôles -->
        <div class="slots-controls">
          <div class="bet-panel">
            <span class="bet-panel__label">Bet</span>
            <button class="bet-btn" id="sl-bet-down">−</button>
            <span class="bet-value" id="sl-bet-display">${this.bet}</span>
            <button class="bet-btn" id="sl-bet-up">+</button>
            <div class="bet-presets">
              ${this.BETS.map(b => `<button class="bet-preset-btn" data-bet="${b}">${b}</button>`).join('')}
            </div>
          </div>

          <div class="action-row">
            <button class="btn btn-primary btn-spin" id="sl-spin">SPIN</button>
            <button class="btn btn-secondary" id="sl-auto" aria-pressed="false">AUTO</button>
          </div>
        </div>

      </div>`;

    this._bind();
  }

  // ── BIND ───────────────────────────────────────────────────────────────────
  _bind() {
    this.el.querySelector('#sl-spin').addEventListener('click', () => this._spin());
    this.el.querySelector('#sl-auto').addEventListener('click', () => this._toggleAuto());

    this.el.querySelector('#sl-bet-up').addEventListener('click', () => {
      const idx = this.BETS.indexOf(this.bet);
      if (idx < this.BETS.length - 1) this._setBet(this.BETS[idx + 1]);
    });
    this.el.querySelector('#sl-bet-down').addEventListener('click', () => {
      const idx = this.BETS.indexOf(this.bet);
      if (idx > 0) this._setBet(this.BETS[idx - 1]);
    });
    this.el.querySelectorAll('.bet-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setBet(parseInt(btn.dataset.bet)));
    });
  }

  _setBet(v) {
    if (this.spinning) return;
    this.bet = v;
    const el = this.el.querySelector('#sl-bet-display');
    if (el) el.textContent = v;
    import('../casino-core.js').then(m => m.SFX.chip());
  }

  // ── AUTO SPIN ──────────────────────────────────────────────────────────────
  _toggleAuto() {
    this.autoSpin = !this.autoSpin;
    const btn = this.el.querySelector('#sl-auto');
    if (btn) {
      btn.setAttribute('aria-pressed', String(this.autoSpin));
      btn.classList.toggle('active', this.autoSpin);
      btn.textContent = this.autoSpin ? 'STOP' : 'AUTO';
    }
    if (this.autoSpin && !this.spinning) this._spin();
    else if (!this.autoSpin) clearTimeout(this._autoTimer);
  }

  // ── SPIN ───────────────────────────────────────────────────────────────────
  async _spin() {
    if (this.spinning) return;
    if (this.core.credits.credits < this.bet) {
      this._setResult('NOT ENOUGH CREDITS', 'lose');
      this.core.showToast('CREDITS INSUFFISANTS', 'lose');
      if (this.autoSpin) this._toggleAuto();
      return;
    }

    this.spinning = true;
    this._lockUI(true);
    this._setResult('SPINNING...', '');

    // Débiter la mise
    await this.core.reward(-this.bet, 'chip');
    import('../casino-core.js').then(m => m.SFX.spin());

    // Générer les résultats finaux
    const outcome = [
      [randSymbol(), randSymbol(), randSymbol()],
      [randSymbol(), randSymbol(), randSymbol()],
      [randSymbol(), randSymbol(), randSymbol()],
    ];

    // Animation rouleaux en cascade
    await this._animateReels(outcome);
    this.reels = outcome;

    // Évaluer la ligne centrale (row 1)
    const line   = [outcome[0][1], outcome[1][1], outcome[2][1]];
    const result = this._evaluate(line);
    await this._applyResult(result);

    this.spinning = false;
    this._lockUI(false);

    if (this.autoSpin) {
      this._autoTimer = setTimeout(() => this._spin(), 800);
    }
  }

  // ── ANIMATION ──────────────────────────────────────────────────────────────
  _animateReels(outcome) {
    const TICKS = 10;
    const DELAY = 60;

    const promises = [0, 1, 2].map(r => new Promise(resolve => {
      let tick = 0;
      const total = TICKS + r * 3; // cascade : rouleau 0 s'arrête en premier
      const interval = setInterval(() => {
        tick++;
        const preview = tick < total
          ? [randSymbol(), randSymbol(), randSymbol()]
          : outcome[r];
        this._updateReel(r, preview);
        if (tick >= total) {
          clearInterval(interval);
          import('../casino-core.js').then(m => m.SFX.tick());
          resolve();
        }
      }, DELAY);
    }));

    return Promise.all(promises).then(() => new Promise(r => setTimeout(r, 120)));
  }

  _updateReel(reelIdx, symbols) {
    for (let row = 0; row < 3; row++) {
      const cell = this.el.querySelector(`#slots-cell-${reelIdx}-${row}`);
      if (cell) cell.textContent = symbols[row].glyph;
    }
  }

  // ── ÉVALUATION ─────────────────────────────────────────────────────────────
  _evaluate(line) {
    const [a, b, c] = line;
    if (a.id === b.id && b.id === c.id)
      return { type: 'triple', sym: a, mult: a.mult };
    if (a.id === b.id || b.id === c.id || a.id === c.id)
      return { type: 'pair', mult: 1 };
    return { type: 'miss', mult: 0 };
  }

  async _applyResult({ type, mult, sym }) {
    if (type === 'triple') {
      const win  = this.bet * mult;
      const isBig = mult >= 6;
      await this.core.reward(win, isBig ? 'bigWin' : 'win');
      this._setResult(`${sym.glyph} ${sym.glyph} ${sym.glyph}  ×${mult}  +${win} CR`, 'win');
      this.core.showToast(isBig ? `JACKPOT ! +${win} CR` : `WIN +${win} CR`, 'win', isBig ? 3500 : 2200);
      this._flashCells(isBig ? 'flash-big' : 'flash-win');
    } else if (type === 'pair') {
      await this.core.reward(this.bet, 'push');
      this._setResult('PAIR — REMBOURSÉ', 'push');
      this.core.showToast('PAIR — remboursé', 'info');
    } else {
      import('../casino-core.js').then(m => m.SFX.lose());
      this._setResult(`MISS — −${this.bet} CR`, 'lose');
      this.core.showToast(`−${this.bet} CR`, 'lose');
      this._flashCells('flash-lose');
    }
  }

  _flashCells(cls) {
    [0, 1, 2].forEach(r => {
      const cell = this.el.querySelector(`#slots-cell-${r}-1`);
      if (!cell) return;
      cell.classList.add(cls);
      setTimeout(() => cell.classList.remove(cls), 700);
    });
  }

  // ── HELPERS UI ─────────────────────────────────────────────────────────────
  _setResult(txt, cls = '') {
    const el = this.el.querySelector('#slots-result');
    if (!el) return;
    el.textContent = txt;
    el.className = 'game-result' + (cls ? ` ${cls}` : '');
  }

  _lockUI(locked) {
    const spinBtn = this.el.querySelector('#sl-spin');
    const bets    = this.el.querySelectorAll('.bet-preset-btn, #sl-bet-up, #sl-bet-down');
    if (spinBtn) {
      spinBtn.disabled  = locked;
      spinBtn.textContent = locked ? '...' : 'SPIN';
    }
    bets.forEach(b => b.disabled = locked);
  }
}
