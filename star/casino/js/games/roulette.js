/**
 * roulette.js — Roulette européenne pour le module Casino STAR
 * Export : mount(container, casinoCore) → instance
 */

// Numéros rouges de la roulette européenne
const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function numColor(n) {
  if (n === 0) return 'green';
  return RED_NUMS.has(n) ? 'red' : 'black';
}

const BET_TYPES = [
  { id: 'red',    label: 'Rouge',  mult: 2,  check: n => n !== 0 && RED_NUMS.has(n) },
  { id: 'black',  label: 'Noir',   mult: 2,  check: n => n !== 0 && !RED_NUMS.has(n) },
  { id: 'even',   label: 'Pair',   mult: 2,  check: n => n !== 0 && n % 2 === 0 },
  { id: 'odd',    label: 'Impair', mult: 2,  check: n => n !== 0 && n % 2 !== 0 },
  { id: 'low',    label: '1-18',   mult: 2,  check: n => n >= 1 && n <= 18 },
  { id: 'high',   label: '19-36',  mult: 2,  check: n => n >= 19 && n <= 36 },
  { id: 'dozen1', label: '1-12',   mult: 3,  check: n => n >= 1 && n <= 12 },
  { id: 'dozen2', label: '13-24',  mult: 3,  check: n => n >= 13 && n <= 24 },
  { id: 'dozen3', label: '25-36',  mult: 3,  check: n => n >= 25 && n <= 36 },
];

export async function mount(container, core) {
  const game = new RouletteGame(container, core);
  game.render();
  return game;
}

class RouletteGame {
  constructor(container, core) {
    this.el       = container;
    this.core     = core;
    this.bet      = 10;
    this.BETS     = [1, 5, 10, 25, 50, 100];
    this.placedBets = [];   // [{ type, amount, extra }]
    this.spinning   = false;
    this.lastNumber = null;
  }

  render() {
    this.el.innerHTML = `
      <div class="game-wrap roulette-wrap">

        <!-- Roue + résultat -->
        <div class="roulette-wheel-area">
          <div class="roulette-wheel-canvas-wrap">
            <canvas id="roulette-canvas" width="200" height="200"></canvas>
            <div class="roulette-ball-marker" id="roulette-ball"></div>
          </div>
          <div class="roulette-result-display">
            <div class="roulette-number-big" id="r-number-big">—</div>
            <div class="roulette-num-label" id="r-num-label">SPIN TO PLAY</div>
          </div>
        </div>

        <!-- Résultat -->
        <div class="game-result" id="r-result">PLACE YOUR BETS</div>

        <!-- Paris placés -->
        <div class="roulette-bets-panel">
          <div class="roulette-bets-title">PARIS ACTIFS</div>
          <div class="roulette-placed-bets" id="r-placed-bets"></div>

          <!-- Types de paris -->
          <div class="roulette-bet-types" id="r-bet-types">
            ${BET_TYPES.map(bt => `
              <button class="r-bet-btn" data-bettype="${bt.id}">
                ${bt.label}
                <span class="r-bet-mult">×${bt.mult}</span>
              </button>`).join('')}
          </div>

          <!-- Grille numéros -->
          <div class="roulette-grid" id="r-number-grid"></div>
        </div>

        <!-- Mise -->
        <div class="bet-panel">
          <span class="bet-panel__label">Jeton</span>
          <button class="bet-btn" id="r-bet-down">−</button>
          <span class="bet-value" id="r-bet-display">${this.bet}</span>
          <button class="bet-btn" id="r-bet-up">+</button>
          <div class="bet-presets">
            ${this.BETS.map(b => `<button class="bet-preset-btn" data-bet="${b}">${b}</button>`).join('')}
          </div>
        </div>

        <!-- Actions -->
        <div class="action-row">
          <button class="btn btn-primary" id="r-spin">SPIN</button>
          <button class="btn btn-danger"  id="r-clear">CLEAR</button>
        </div>
      </div>`;

    this._buildGrid();
    this._drawWheel();
    this._bind();
  }

  _buildGrid() {
    const grid = this.el.querySelector('#r-number-grid');
    if (!grid) return;
    // 0 en premier
    const cells = [];
    for (let n = 0; n <= 36; n++) {
      const col = numColor(n);
      cells.push(`<div class="roulette-grid-cell r-${col}" data-num="${n}">${n}</div>`);
    }
    grid.innerHTML = cells.join('');
    grid.querySelectorAll('.roulette-grid-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        if (this.spinning) return;
        import('../casino-core.js').then(m => m.SFX.chip());
        this._placeBet('number', this.bet, parseInt(cell.dataset.num));
      });
    });
  }

  _drawWheel(highlight = null, ballAngle = null) {
    const canvas = this.el.querySelector('#roulette-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 100, cy = 100, R = 95, r = 60;
    const nums = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    const slice = (Math.PI * 2) / nums.length;

    ctx.clearRect(0, 0, 200, 200);

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1f2e';
    ctx.fill();

    nums.forEach((n, i) => {
      const start = i * slice - Math.PI / 2;
      const end   = start + slice;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, start, end);
      ctx.closePath();
      const isHL = highlight === n;
      ctx.fillStyle = isHL ? '#ffd700' :
        n === 0 ? '#00aa44' :
        RED_NUMS.has(n) ? (i % 2 === 0 ? '#cc2244' : '#aa1133') :
                          (i % 2 === 0 ? '#222' : '#333');
      ctx.fill();
      ctx.strokeStyle = '#0a0b0d';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Numéro
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = isHL ? '#000' : '#fff';
      ctx.font = `bold ${n >= 10 ? 8 : 10}px monospace`;
      ctx.fillText(String(n), R - 4, 3);
      ctx.restore();
    });

    // Centre
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0d1117';
    ctx.fill();
    ctx.strokeStyle = '#1a1f2e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bille
    if (ballAngle !== null) {
      const bx = cx + (r + 22) * Math.cos(ballAngle);
      const by = cy + (r + 22) * Math.sin(ballAngle);
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fff';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _bind() {
    this.el.querySelector('#r-spin').addEventListener('click',  () => this._spin());
    this.el.querySelector('#r-clear').addEventListener('click', () => {
      import('../casino-core.js').then(m => m.SFX.click());
      this.placedBets = [];
      this._renderPlacedBets();
    });

    this.el.querySelector('#r-bet-up').addEventListener('click', () => {
      const idx = this.BETS.indexOf(this.bet);
      if (idx < this.BETS.length - 1) { this.bet = this.BETS[idx + 1]; this._updateBetDisplay(); }
    });
    this.el.querySelector('#r-bet-down').addEventListener('click', () => {
      const idx = this.BETS.indexOf(this.bet);
      if (idx > 0) { this.bet = this.BETS[idx - 1]; this._updateBetDisplay(); }
    });
    this.el.querySelectorAll('.bet-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => { this.bet = parseInt(btn.dataset.bet); this._updateBetDisplay(); });
    });

    this.el.querySelectorAll('.r-bet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.spinning) return;
        import('../casino-core.js').then(m => m.SFX.chip());
        this._placeBet(btn.dataset.bettype, this.bet);
      });
    });
  }

  _updateBetDisplay() {
    const el = this.el.querySelector('#r-bet-display');
    if (el) el.textContent = this.bet;
    import('../casino-core.js').then(m => m.SFX.chip());
  }

  _placeBet(type, amount, extra = null) {
    this.placedBets.push({ type, amount, extra });
    this._renderPlacedBets();
  }

  _renderPlacedBets() {
    const el = this.el.querySelector('#r-placed-bets');
    if (!el) return;
    el.innerHTML = this.placedBets.map((b, i) => {
      const label = b.type === 'number' ? `N°${b.extra}` :
        BET_TYPES.find(t => t.id === b.type)?.label ?? b.type;
      return `<span class="r-placed-bet-tag">
        ${label} — ${b.amount} CR
        <span class="r-placed-bet-remove" data-idx="${i}">✕</span>
      </span>`;
    }).join('');
    el.querySelectorAll('.r-placed-bet-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.placedBets.splice(parseInt(btn.dataset.idx), 1);
        this._renderPlacedBets();
        import('../casino-core.js').then(m => m.SFX.click());
      });
    });
  }

  async _spin() {
    if (this.spinning) return;
    if (!this.placedBets.length) {
      this.core.showToast('PLACEZ UN PARI D\'ABORD', 'info');
      return;
    }
    const totalBet = this.placedBets.reduce((s, b) => s + b.amount, 0);
    if (this.core.credits.credits < totalBet) {
      this.core.showToast('CREDITS INSUFFISANTS', 'lose');
      return;
    }

    this.spinning = true;
    this._setButtons(true);
    import('../casino-core.js').then(m => m.SFX.spin());

    // Déduire mise totale
    await this.core.reward(-totalBet, 'chip');

    // Tirage
    const result = Math.floor(Math.random() * 37); // 0-36
    this.lastNumber = result;

    // Animation roue
    await this._animateWheel(result);

    // Calcul gains
    let totalGain = 0;
    for (const b of this.placedBets) {
      let won = false;
      if (b.type === 'number') {
        won = b.extra === result;
        if (won) totalGain += b.amount * 36;
      } else {
        const bt = BET_TYPES.find(t => t.id === b.type);
        if (bt && bt.check(result)) { won = true; totalGain += b.amount * bt.mult; }
      }
    }

    // Mise à jour affichage
    const numEl = this.el.querySelector('#r-number-big');
    const lblEl = this.el.querySelector('#r-num-label');
    const col   = numColor(result);
    if (numEl) {
      numEl.textContent = result;
      numEl.className = `roulette-number-big ${col}-num`;
    }
    if (lblEl) {
      const colLabel = col === 'green' ? 'ZÉRO' : col === 'red' ? 'ROUGE' : 'NOIR';
      const parity   = result === 0 ? '' : (result % 2 === 0 ? ' · PAIR' : ' · IMPAIR');
      lblEl.textContent = colLabel + parity;
    }

    // Hit cell
    const cell = this.el.querySelector(`.roulette-grid-cell[data-num="${result}"]`);
    if (cell) {
      cell.classList.add('hit');
      setTimeout(() => cell.classList.remove('hit'), 700);
    }

    if (totalGain > 0) {
      await this.core.reward(totalGain, totalGain >= totalBet * 10 ? 'bigWin' : 'win');
      const msg = `WIN +${totalGain} CR — Numéro ${result}`;
      this._setResult(msg, 'win');
      this.core.showToast(msg, 'win');
    } else {
      import('../casino-core.js').then(m => m.SFX.lose());
      const msg = `PERDU — Numéro ${result} (${col === 'green' ? 'ZÉRO' : col.toUpperCase()})`;
      this._setResult(msg, 'lose');
      this.core.showToast(msg, 'lose');
    }

    this.placedBets = [];
    this._renderPlacedBets();
    this.spinning = false;
    this._setButtons(false);
  }

  async _animateWheel(targetNum) {
    const nums = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    const targetIdx = nums.indexOf(targetNum);
    const slice = (Math.PI * 2) / nums.length;
    const targetAngle = targetIdx * slice - Math.PI / 2;

    const duration = 3000;
    const start    = performance.now();
    const spins    = 5; // tours complets

    return new Promise(resolve => {
      const frame = (now) => {
        const t   = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const angle = ease * (spins * Math.PI * 2 + targetAngle);
        const ballAngle = -angle + Math.PI / 2;
        this._drawWheel(t === 1 ? targetNum : null, ballAngle);
        if (t < 1) requestAnimationFrame(frame);
        else { this._drawWheel(targetNum, targetAngle + Math.PI); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  _setResult(txt, cls) {
    const el = this.el.querySelector('#r-result');
    if (!el) return;
    el.textContent = txt;
    el.className = 'game-result' + (cls ? ` ${cls}` : '');
  }

  _setButtons(spinning) {
    const spin  = this.el.querySelector('#r-spin');
    const clear = this.el.querySelector('#r-clear');
    const bets  = this.el.querySelectorAll('.r-bet-btn, .roulette-grid-cell, .bet-btn, .bet-preset-btn');
    if (spin)  spin.disabled  = spinning;
    if (clear) clear.disabled = spinning;
    bets.forEach(b => b.disabled = spinning);
  }
}
