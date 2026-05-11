/**
 * blackjack.js — Jeu de Blackjack pour le module Casino STAR
 * Export : mount(container, casinoCore) → instance
 */

const SUITS  = ['♠', '♥', '♦', '♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

function makeDeck() {
  const d = [];
  for (const s of SUITS)
    for (const v of VALUES)
      d.push({ suit: s, value: v });
  return d;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(v) {
  if (['J','Q','K'].includes(v)) return 10;
  if (v === 'A') return 11;
  return parseInt(v);
}

function handScore(hand) {
  let score = 0, aces = 0;
  for (const c of hand) {
    score += cardValue(c.value);
    if (c.value === 'A') aces++;
  }
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

function cardHTML(card, hidden = false) {
  if (hidden) return `<div class="bj-card hidden"><div class="bj-card__top">?</div><div class="bj-card__suit">?</div><div class="bj-card__bot">?</div></div>`;
  const isRed = RED_SUITS.has(card.suit);
  return `<div class="bj-card ${isRed ? 'red' : 'black'}">
    <div class="bj-card__top">${card.value}</div>
    <div class="bj-card__suit">${card.suit}</div>
    <div class="bj-card__bot">${card.value}</div>
  </div>`;
}

export async function mount(container, core) {
  const game = new BlackjackGame(container, core);
  game.render();
  return game;
}

class BlackjackGame {
  constructor(container, core) {
    this.el   = container;
    this.core = core;
    this.deck = [];
    this.playerHand = [];
    this.dealerHand = [];
    this.bet  = 10;
    this.phase = 'bet'; // bet | play | over
    this.BETS = [5, 10, 20, 50, 100, 200];
  }

  render() {
    this.el.innerHTML = `
      <div class="game-wrap">
        <div class="bj-table">
          <!-- Dealer -->
          <div class="bj-hand-area">
            <div class="bj-hand-label">DEALER</div>
            <div class="bj-cards" id="bj-dealer-cards"></div>
            <div class="bj-score">Score : <span id="bj-dealer-score">—</span></div>
          </div>
          <!-- Player -->
          <div class="bj-hand-area">
            <div class="bj-hand-label">YOU</div>
            <div class="bj-cards" id="bj-player-cards"></div>
            <div class="bj-score">Score : <span id="bj-player-score">—</span></div>
          </div>
        </div>

        <!-- Résultat -->
        <div class="game-result" id="bj-result">PLACE YOUR BET</div>

        <!-- Mise -->
        <div class="bet-panel">
          <span class="bet-panel__label">Bet</span>
          <button class="bet-btn" id="bj-bet-down">−</button>
          <span class="bet-value" id="bj-bet-display">${this.bet}</span>
          <button class="bet-btn" id="bj-bet-up">+</button>
          <div class="bet-presets" id="bj-presets">
            ${this.BETS.map(b => `<button class="bet-preset-btn" data-bet="${b}">${b}</button>`).join('')}
          </div>
        </div>

        <!-- Actions -->
        <div class="action-row">
          <button class="btn btn-primary" id="bj-deal">DEAL</button>
          <button class="btn btn-secondary" id="bj-hit"   disabled>HIT</button>
          <button class="btn btn-secondary" id="bj-stand" disabled>STAND</button>
          <button class="btn btn-secondary" id="bj-double" disabled>DOUBLE</button>
        </div>
      </div>`;

    this._bind();
  }

  _bind() {
    this.el.querySelector('#bj-deal').addEventListener('click',   () => this._deal());
    this.el.querySelector('#bj-hit').addEventListener('click',    () => this._hit());
    this.el.querySelector('#bj-stand').addEventListener('click',  () => this._stand());
    this.el.querySelector('#bj-double').addEventListener('click', () => this._double());

    this.el.querySelector('#bj-bet-up').addEventListener('click', () => {
      const idx = this.BETS.indexOf(this.bet);
      if (idx < this.BETS.length - 1) this._setBet(this.BETS[idx + 1]);
    });
    this.el.querySelector('#bj-bet-down').addEventListener('click', () => {
      const idx = this.BETS.indexOf(this.bet);
      if (idx > 0) this._setBet(this.BETS[idx - 1]);
    });
    this.el.querySelectorAll('.bet-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setBet(parseInt(btn.dataset.bet)));
    });
  }

  _setBet(v) {
    this.bet = v;
    const el = this.el.querySelector('#bj-bet-display');
    if (el) el.textContent = v;
    this.core.SFX?.chip?.() || this.core.credits; // SFX via core
    import('../casino-core.js').then(m => m.SFX.chip());
  }

  _setPhaseButtons(phase) {
    const deal   = this.el.querySelector('#bj-deal');
    const hit    = this.el.querySelector('#bj-hit');
    const stand  = this.el.querySelector('#bj-stand');
    const dbl    = this.el.querySelector('#bj-double');
    const betUp  = this.el.querySelector('#bj-bet-up');
    const betDn  = this.el.querySelector('#bj-bet-down');
    const presets = this.el.querySelectorAll('.bet-preset-btn');

    if (phase === 'bet') {
      deal.disabled = false; hit.disabled = true; stand.disabled = true; dbl.disabled = true;
      betUp.disabled = false; betDn.disabled = false;
      presets.forEach(b => b.disabled = false);
    } else if (phase === 'play') {
      deal.disabled = true; hit.disabled = false; stand.disabled = false; dbl.disabled = false;
      betUp.disabled = true; betDn.disabled = true;
      presets.forEach(b => b.disabled = true);
    } else {
      deal.disabled = false; hit.disabled = true; stand.disabled = true; dbl.disabled = true;
      betUp.disabled = false; betDn.disabled = false;
      presets.forEach(b => b.disabled = false);
    }
  }

  async _deal() {
    if (this.core.credits.credits < this.bet) {
      this._setResult('NOT ENOUGH CREDITS', '');
      this.core.showToast('CREDITS INSUFFISANTS', 'lose');
      return;
    }
    import('../casino-core.js').then(m => m.SFX.spin());
    await this.core.reward(-this.bet, 'chip');

    this.deck = shuffle(makeDeck().concat(makeDeck()));
    this.playerHand = [this.deck.pop(), this.deck.pop()];
    this.dealerHand = [this.deck.pop(), this.deck.pop()];
    this.phase = 'play';

    this._renderCards(true);
    this._setPhaseButtons('play');
    this._setResult('HIT OR STAND ?', '');

    // Blackjack naturel ?
    const ps = handScore(this.playerHand);
    const ds = handScore(this.dealerHand);
    if (ps === 21) {
      if (ds === 21) { await this._finish('push'); }
      else           { await this._finish('blackjack'); }
    }
  }

  async _hit() {
    import('../casino-core.js').then(m => m.SFX.card());
    this.playerHand.push(this.deck.pop());
    this._renderCards(true);
    const score = handScore(this.playerHand);
    if (score > 21) await this._finish('bust');
    else if (score === 21) await this._stand();
  }

  async _stand() {
    this._setPhaseButtons('over');
    // Dealer joue
    this._renderCards(false); // révèle la carte cachée
    await this._dealerPlay();
  }

  async _double() {
    if (this.core.credits.credits < this.bet) {
      this.core.showToast('CREDITS INSUFFISANTS', 'lose');
      return;
    }
    await this.core.reward(-this.bet, 'chip');
    this.bet *= 2;
    const betEl = this.el.querySelector('#bj-bet-display');
    if (betEl) betEl.textContent = this.bet;
    import('../casino-core.js').then(m => m.SFX.card());
    this.playerHand.push(this.deck.pop());
    this._renderCards(true);
    if (handScore(this.playerHand) > 21) await this._finish('bust');
    else await this._stand();
  }

  async _dealerPlay() {
    while (handScore(this.dealerHand) < 17) {
      await new Promise(r => setTimeout(r, 400));
      import('../casino-core.js').then(m => m.SFX.card());
      this.dealerHand.push(this.deck.pop());
      this._renderCards(false);
    }
    const ps = handScore(this.playerHand);
    const ds = handScore(this.dealerHand);
    if (ds > 21 || ps > ds) await this._finish('win');
    else if (ps === ds)      await this._finish('push');
    else                     await this._finish('lose');
  }

  async _finish(outcome) {
    this.phase = 'over';
    this._setPhaseButtons('over');
    this._renderCards(false);

    const msgs = {
      win:       `WIN — +${this.bet * 2} CR`,
      blackjack: `BLACKJACK ! +${Math.floor(this.bet * 2.5)} CR`,
      push:      `PUSH — REMBOURSÉ`,
      bust:      `BUST — PERDU ${this.bet} CR`,
      lose:      `DEALER WIN — PERDU ${this.bet} CR`,
    };
    const classes = {
      win: 'win', blackjack: 'win', push: 'push', bust: 'lose', lose: 'lose',
    };
    const sfxs = {
      win: 'win', blackjack: 'bigWin', push: 'push', bust: 'lose', lose: 'lose',
    };

    this._setResult(msgs[outcome], classes[outcome]);

    if (outcome === 'win')       await this.core.reward(this.bet * 2, sfxs[outcome]);
    else if (outcome === 'blackjack') await this.core.reward(Math.floor(this.bet * 2.5), sfxs[outcome]);
    else if (outcome === 'push') await this.core.reward(this.bet, sfxs[outcome]);
    else import('../casino-core.js').then(m => m.SFX[sfxs[outcome]]?.());

    this.core.showToast(msgs[outcome], classes[outcome]);

    // reset la mise au min si le joueur n'a plus assez
    if (this.core.credits.credits < this.bet) {
      this.bet = this.BETS.find(b => b <= this.core.credits.credits) ?? this.BETS[0];
      const betEl = this.el.querySelector('#bj-bet-display');
      if (betEl) betEl.textContent = this.bet;
    }
  }

  _renderCards(hideDealer) {
    const dc = this.el.querySelector('#bj-dealer-cards');
    const pc = this.el.querySelector('#bj-player-cards');
    const ds = this.el.querySelector('#bj-dealer-score');
    const ps = this.el.querySelector('#bj-player-score');

    if (dc) dc.innerHTML = this.dealerHand.map((c, i) => cardHTML(c, hideDealer && i === 1)).join('');
    if (pc) pc.innerHTML = this.playerHand.map(c => cardHTML(c)).join('');

    const pScore = handScore(this.playerHand);
    const dScore = hideDealer ? cardValue(this.dealerHand[0].value) : handScore(this.dealerHand);

    if (ps) ps.textContent = pScore;
    if (ds) ds.textContent = hideDealer ? '?' : dScore;
  }

  _setResult(txt, cls) {
    const el = this.el.querySelector('#bj-result');
    if (!el) return;
    el.textContent = txt;
    el.className = 'game-result' + (cls ? ` ${cls}` : '');
  }
}
