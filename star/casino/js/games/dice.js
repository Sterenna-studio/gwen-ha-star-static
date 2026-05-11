/**
 * dice.js — Jeu de dés (Yahtzee-like) pour le module Casino STAR
 * Export : mount(container, casinoCore) → instance
 *
 * Mécanisme :
 *  - 5 dés, 3 lancers maximum
 *  - Cliquer sur un dé = le garder (marqué gold)
 *  - Après les lancers : choisir une combinaison pour scorer
 *  - Le gain = mise × multiplicateur de la combo
 */

const DIE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

const COMBOS = [
  {
    id: 'ones',   name: '1s',         mult: 0,
    score: (dice) => dice.filter(d => d === 1).reduce((a,b) => a+b, 0),
    desc: 'Somme des 1'
  },
  {
    id: 'twos',   name: '2s',         mult: 0,
    score: (dice) => dice.filter(d => d === 2).reduce((a,b) => a+b, 0),
    desc: 'Somme des 2'
  },
  {
    id: 'threes', name: '3s',         mult: 0,
    score: (dice) => dice.filter(d => d === 3).reduce((a,b) => a+b, 0),
    desc: 'Somme des 3'
  },
  {
    id: 'fours',  name: '4s',         mult: 0,
    score: (dice) => dice.filter(d => d === 4).reduce((a,b) => a+b, 0),
    desc: 'Somme des 4'
  },
  {
    id: 'fives',  name: '5s',         mult: 0,
    score: (dice) => dice.filter(d => d === 5).reduce((a,b) => a+b, 0),
    desc: 'Somme des 5'
  },
  {
    id: 'sixes',  name: '6s',         mult: 0,
    score: (dice) => dice.filter(d => d === 6).reduce((a,b) => a+b, 0),
    desc: 'Somme des 6'
  },
  {
    id: 'threeofakind', name: 'Brelan', mult: 1,
    score: (dice) => {
      const c = _counts(dice);
      return Object.values(c).some(v => v >= 3) ? dice.reduce((a,b)=>a+b,0) : 0;
    },
    desc: '3 identiques — somme'
  },
  {
    id: 'fourofakind', name: 'Carré', mult: 2,
    score: (dice) => {
      const c = _counts(dice);
      return Object.values(c).some(v => v >= 4) ? dice.reduce((a,b)=>a+b,0) : 0;
    },
    desc: '4 identiques — somme'
  },
  {
    id: 'fullhouse', name: 'Full', mult: 3,
    score: (dice) => {
      const v = Object.values(_counts(dice)).sort();
      return (v.length === 2 && v[0] === 2 && v[1] === 3) ? 25 : 0;
    },
    desc: '2+3 identiques — 25 pts'
  },
  {
    id: 'smallstraight', name: 'P. Suite', mult: 3,
    score: (dice) => _hasStraight(dice, 4) ? 30 : 0,
    desc: '4 consécutifs — 30 pts'
  },
  {
    id: 'largestraight', name: 'G. Suite', mult: 5,
    score: (dice) => _hasStraight(dice, 5) ? 40 : 0,
    desc: '5 consécutifs — 40 pts'
  },
  {
    id: 'yahtzee', name: 'YAHTZEE', mult: 10,
    score: (dice) => {
      const c = _counts(dice);
      return Object.values(c).some(v => v === 5) ? 50 : 0;
    },
    desc: '5 identiques — 50 pts × 10'
  },
  {
    id: 'chance', name: 'Chance', mult: 1,
    score: (dice) => dice.reduce((a,b)=>a+b,0),
    desc: 'Somme de tous les dés'
  },
];

function _counts(dice) {
  const c = {};
  dice.forEach(d => { c[d] = (c[d] || 0) + 1; });
  return c;
}

function _hasStraight(dice, len) {
  const uniq = [...new Set(dice)].sort((a,b)=>a-b);
  let streak = 1;
  for (let i = 1; i < uniq.length; i++) {
    if (uniq[i] === uniq[i-1] + 1) streak++;
    else streak = 1;
    if (streak >= len) return true;
  }
  return streak >= len;
}

export async function mount(container, core) {
  const game = new DiceGame(container, core);
  game.render();
  return game;
}

class DiceGame {
  constructor(container, core) {
    this.el       = container;
    this.core     = core;
    this.bet      = 10;
    this.BETS     = [5, 10, 25, 50, 100];
    this.dice     = [1,1,1,1,1];
    this.kept     = [false,false,false,false,false];
    this.rollsLeft = 3;
    this.phase    = 'bet';  // bet | rolling | score
    this.scoredCombos = new Set();
    this.totalScore = 0;
    this.roundGain  = 0;
    this.round      = 0;
    this.MAX_ROUNDS = 13;
  }

  render() {
    this.el.innerHTML = `
      <div class="game-wrap dice-wrap">

        <!-- Dés -->
        <div class="dice-area">
          <div class="dice-row" id="dice-row"></div>
          <div class="dice-rolls-left" id="dice-rolls-left">Lancers restants : <span>${this.rollsLeft}</span></div>
        </div>

        <!-- Résultat -->
        <div class="game-result" id="dice-result">NOUVELLE PARTIE — LANCEZ LES DÉS</div>

        <!-- Score actuel -->
        <div class="dice-score-panel">
          <div class="dice-score-item">
            <span class="dice-score-label">Score total</span>
            <span class="dice-score-value" id="dice-total-score">0</span>
          </div>
          <div class="dice-score-item">
            <span class="dice-score-label">Gain round</span>
            <span class="dice-score-value" id="dice-round-gain">—</span>
          </div>
          <div class="dice-score-item">
            <span class="dice-score-label">Round</span>
            <span class="dice-score-value" id="dice-round">${this.round}/${this.MAX_ROUNDS}</span>
          </div>
        </div>

        <!-- Mise -->
        <div class="bet-panel">
          <span class="bet-panel__label">Mise</span>
          <button class="bet-btn" id="dice-bet-down">−</button>
          <span class="bet-value" id="dice-bet-display">${this.bet}</span>
          <button class="bet-btn" id="dice-bet-up">+</button>
          <div class="bet-presets">
            ${this.BETS.map(b => `<button class="bet-preset-btn" data-bet="${b}">${b}</button>`).join('')}
          </div>
        </div>

        <!-- Actions -->
        <div class="action-row">
          <button class="btn btn-primary" id="dice-roll">LANCER</button>
          <button class="btn btn-secondary" id="dice-new-game">NOUVELLE PARTIE</button>
        </div>

        <!-- Combos -->
        <div class="dice-combos" id="dice-combos"></div>
      </div>`;

    this._renderDice();
    this._renderCombos();
    this._bind();
  }

  _bind() {
    this.el.querySelector('#dice-roll').addEventListener('click', () => this._roll());
    this.el.querySelector('#dice-new-game').addEventListener('click', () => this._newGame());

    this.el.querySelector('#dice-bet-up').addEventListener('click', () => {
      const idx = this.BETS.indexOf(this.bet);
      if (idx < this.BETS.length - 1) { this.bet = this.BETS[idx + 1]; this._updateBetDisplay(); }
    });
    this.el.querySelector('#dice-bet-down').addEventListener('click', () => {
      const idx = this.BETS.indexOf(this.bet);
      if (idx > 0) { this.bet = this.BETS[idx - 1]; this._updateBetDisplay(); }
    });
    this.el.querySelectorAll('.bet-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => { this.bet = parseInt(btn.dataset.bet); this._updateBetDisplay(); });
    });
  }

  _updateBetDisplay() {
    const el = this.el.querySelector('#dice-bet-display');
    if (el) el.textContent = this.bet;
    import('../casino-core.js').then(m => m.SFX.chip());
  }

  _renderDice() {
    const row = this.el.querySelector('#dice-row');
    if (!row) return;
    row.innerHTML = this.dice.map((d, i) => `
      <div class="die${this.kept[i] ? ' kept' : ''}" data-idx="${i}">
        ${DIE_FACES[d-1]}
        ${this.kept[i] ? '<span class="kept-badge">✓</span>' : ''}
      </div>`).join('');

    row.querySelectorAll('.die').forEach(die => {
      die.addEventListener('click', () => {
        if (this.phase !== 'rolling') return;
        const idx = parseInt(die.dataset.idx);
        this.kept[idx] = !this.kept[idx];
        import('../casino-core.js').then(m => m.SFX.click());
        this._renderDice();
      });
    });
  }

  _renderCombos() {
    const el = this.el.querySelector('#dice-combos');
    if (!el) return;
    el.innerHTML = COMBOS.map(c => {
      const pts    = this.phase === 'rolling' || this.phase === 'score' ? c.score(this.dice) : 0;
      const gain   = pts > 0 ? Math.round(this.bet * (c.mult || 1) * (pts / 10)) : 0;
      const scored = this.scoredCombos.has(c.id);
      const active = pts > 0 && !scored;
      return `<div class="dice-combo${active ? ' active' : ''}${scored ? ' scored' : ''}" data-combo="${c.id}">
        <div>
          <div class="dice-combo__name">${c.name}</div>
          <div class="dice-combo__preview">${c.desc}</div>
        </div>
        <div class="dice-combo__mult">${scored ? '✓' : (pts > 0 ? `+${gain > 0 ? gain : pts}` : '—')}</div>
      </div>`;
    }).join('');

    el.querySelectorAll('.dice-combo:not(.scored)').forEach(card => {
      card.addEventListener('click', () => {
        if (this.phase !== 'rolling' && this.phase !== 'score') return;
        if (this.scoredCombos.has(card.dataset.combo)) return;
        import('../casino-core.js').then(m => m.SFX.click());
        this._scoreCombo(card.dataset.combo);
      });
    });
  }

  async _roll() {
    if (this.phase === 'bet') {
      // Début de round
      if (this.core.credits.credits < this.bet) {
        this.core.showToast('CREDITS INSUFFISANTS', 'lose');
        return;
      }
      await this.core.reward(-this.bet, 'chip');
      this.phase     = 'rolling';
      this.rollsLeft = 3;
      this.kept      = [false,false,false,false,false];
      this.round++;
      const rndEl = this.el.querySelector('#dice-round');
      if (rndEl) rndEl.textContent = `${this.round}/${this.MAX_ROUNDS}`;
      const betPanel = this.el.querySelector('.bet-panel');
      if (betPanel) betPanel.style.opacity = '0.4';
      const betBtns = this.el.querySelectorAll('.bet-btn, .bet-preset-btn');
      betBtns.forEach(b => b.disabled = true);
    }

    if (this.rollsLeft <= 0) {
      this.phase = 'score';
      this._setResult('CHOISISSEZ UNE COMBINAISON', '');
      this._renderCombos();
      return;
    }

    import('../casino-core.js').then(m => m.SFX.diceRoll());

    // Animer les dés non-gardés
    const row = this.el.querySelector('#dice-row');
    row?.querySelectorAll('.die:not(.kept)').forEach(d => {
      d.classList.add('rolling');
      setTimeout(() => d.classList.remove('rolling'), 400);
    });

    await new Promise(r => setTimeout(r, 150));

    // Lancer
    this.dice = this.dice.map((d, i) =>
      this.kept[i] ? d : Math.floor(Math.random() * 6) + 1
    );
    this.rollsLeft--;

    this._renderDice();
    this._renderCombos();

    const rollsEl = this.el.querySelector('#dice-rolls-left span');
    if (rollsEl) rollsEl.textContent = this.rollsLeft;

    const rollBtn = this.el.querySelector('#dice-roll');
    if (this.rollsLeft === 0) {
      this.phase = 'score';
      this._setResult('CHOISISSEZ UNE COMBINAISON', '');
      if (rollBtn) { rollBtn.disabled = true; rollBtn.textContent = 'SCORÉ'; }
    } else {
      this._setResult(`${this.rollsLeft} LANCER${this.rollsLeft > 1 ? 'S' : ''} RESTANT${this.rollsLeft > 1 ? 'S' : ''}`, '');
    }
  }

  async _scoreCombo(comboId) {
    const combo = COMBOS.find(c => c.id === comboId);
    if (!combo) return;

    const pts  = combo.score(this.dice);
    const gain = pts > 0
      ? Math.max(1, Math.round(this.bet * Math.max(combo.mult, 1) * (pts / 10)))
      : 0;

    this.scoredCombos.add(comboId);
    this.totalScore += pts;
    this.roundGain  += gain;

    const totalEl = this.el.querySelector('#dice-total-score');
    const gainEl  = this.el.querySelector('#dice-round-gain');
    if (totalEl) totalEl.textContent = this.totalScore;
    if (gainEl)  gainEl.textContent  = `+${this.roundGain}`;

    if (gain > 0) {
      await this.core.reward(gain, gain >= this.bet * 5 ? 'bigWin' : 'win');
      this._setResult(`${combo.name} — +${gain} CR`, 'win');
      this.core.showToast(`${combo.name.toUpperCase()} — +${gain} CR`, 'win');
    } else {
      import('../casino-core.js').then(m => m.SFX.lose());
      this._setResult(`${combo.name} — 0 pts`, 'lose');
    }

    // Prochain round
    if (this.round < this.MAX_ROUNDS) {
      this.phase     = 'bet';
      this.rollsLeft = 3;
      this.kept      = [false,false,false,false,false];
      this.dice      = [1,1,1,1,1];
      this._renderDice();
      const rollBtn = this.el.querySelector('#dice-roll');
      if (rollBtn) { rollBtn.disabled = false; rollBtn.textContent = 'LANCER'; }
      const betPanel = this.el.querySelector('.bet-panel');
      if (betPanel) betPanel.style.opacity = '1';
      const betBtns = this.el.querySelectorAll('.bet-btn, .bet-preset-btn');
      betBtns.forEach(b => b.disabled = false);
      const rollsEl = this.el.querySelector('#dice-rolls-left span');
      if (rollsEl) rollsEl.textContent = 3;
    } else {
      // Fin de partie
      this._endGame();
    }
    this._renderCombos();
  }

  async _endGame() {
    this.phase = 'bet';
    const msg = `PARTIE TERMINÉE — Score : ${this.totalScore} — Gain total : +${this.roundGain} CR`;
    this._setResult(msg, this.roundGain > 0 ? 'win' : 'lose');
    this.core.showToast(msg, this.roundGain > 0 ? 'win' : 'lose', 4000);
    if (this.roundGain > 0) import('../casino-core.js').then(m => m.SFX.bigWin());
  }

  _newGame() {
    this.scoredCombos = new Set();
    this.totalScore   = 0;
    this.roundGain    = 0;
    this.round        = 0;
    this.dice         = [1,1,1,1,1];
    this.kept         = [false,false,false,false,false];
    this.rollsLeft    = 3;
    this.phase        = 'bet';
    this._renderDice();
    this._renderCombos();
    this._setResult('NOUVELLE PARTIE — LANCEZ LES DÉS', '');
    const totalEl = this.el.querySelector('#dice-total-score');
    const gainEl  = this.el.querySelector('#dice-round-gain');
    const rndEl   = this.el.querySelector('#dice-round');
    const rollsEl = this.el.querySelector('#dice-rolls-left span');
    const rollBtn = this.el.querySelector('#dice-roll');
    if (totalEl) totalEl.textContent = 0;
    if (gainEl)  gainEl.textContent  = '—';
    if (rndEl)   rndEl.textContent   = `0/${this.MAX_ROUNDS}`;
    if (rollsEl) rollsEl.textContent = 3;
    if (rollBtn) { rollBtn.disabled = false; rollBtn.textContent = 'LANCER'; }
    const betPanel = this.el.querySelector('.bet-panel');
    if (betPanel) betPanel.style.opacity = '1';
    const betBtns = this.el.querySelectorAll('.bet-btn, .bet-preset-btn');
    betBtns.forEach(b => b.disabled = false);
    import('../casino-core.js').then(m => m.SFX.click());
  }

  _setResult(txt, cls) {
    const el = this.el.querySelector('#dice-result');
    if (!el) return;
    el.textContent = txt;
    el.className = 'game-result' + (cls ? ` ${cls}` : '');
  }
}
