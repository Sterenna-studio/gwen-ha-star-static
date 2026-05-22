/**
 * star-arcade-core.js — Star Arcade router
 *
 * This file now only owns the lobby, wallet, bet panel, history and game routing.
 * Each mini-game lives in its own folder under /star/casino/js/games/.
 */
import { supabase } from '/shared/supabase-client.js';
import { ArcadeSFX as SFX } from './arcade-sfx.js';
import { formatChronicles } from './arcade-utils.js';
import { WhackAMoleGame } from './games/whack-a-mole/whack-a-mole.js';
import { CrashGame } from './games/crash/crash.js';
import { SlotMachineGame } from './games/slot-machine/slot-machine.js';
import { NeonRacer } from './games/neon-racer/neon-racer.js';

const GAME_CARDS = [
  {
    id: 'wam',
    icon: '🔨',
    tag: '// JEU 01',
    title: 'WHACK-A-MOLE',
    desc: '30 secondes. Frappe les entités, évite les bombes, garde ton combo. Jeu plutôt skill.',
    meta: 'RTP CIBLE ~95%',
    color: 'var(--c-orange)',
  },
  {
    id: 'crash',
    icon: '🚀',
    tag: '// JEU 02',
    title: 'CRASH',
    desc: 'Le multiplicateur monte. Éjecte-toi avant le crash ou utilise l’auto-eject.',
    meta: 'RTP CIBLE ~93%',
    color: 'var(--c-pink)',
  },
  {
    id: 'slots',
    icon: '🎰',
    tag: '// JEU 03',
    title: 'SLOT MACHINE',
    desc: '5 rouleaux × 3 lignes. Gains gauche → droite sur 5 lignes. Version réparée.',
    meta: 'RTP CIBLE ~90%',
    color: 'var(--c-amber)',
  },
  {
    id: 'nr',
    icon: '🏁',
    tag: '// JEU 04',
    title: 'NEON RACER',
    desc: 'Course arcade à axes alternés. Choisis véhicule et cœurs. Jeu skill/risque.',
    meta: 'SKILL · COURSE',
    color: 'var(--c-cyan)',
  },
];

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
    this.activeGame = null;
    this.activeGameId = null;
    this.nrResult = null;
    this.nrBack = null;
  }

  async loadCredits() {
    if (!this.userId) {
      this.credits = 500;
      return;
    }

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

          <div class="jackpot-banner" style="width:100%;max-width:620px;margin-bottom:32px">
            <span class="jp-icon">⚖️</span>
            <span class="jp-label">MODE ALPHA ÉQUILIBRÉ</span>
            <span class="jp-val" id="jp-val">MISES LIMITÉES</span>
          </div>

          <div class="lobby-grid">
            ${GAME_CARDS.map(card => this.card(card)).join('')}
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

    GAME_CARDS.forEach(card => {
      document.getElementById(`card-${card.id}`)?.addEventListener('click', () => {
        SFX.click();
        this.showGame(card.id);
      });
    });

    this.renderHistory();
  }

  card(card) {
    return `<button class="game-card" id="card-${card.id}" style="--card-color:${card.color}">
      <div class="gc-icon">${card.icon}</div>
      <div class="gc-tag">${card.tag}</div>
      <div class="gc-title">${card.title}</div>
      <div class="gc-desc">${card.desc}</div>
      <div class="gc-meta"><span class="gc-badge">${card.meta}</span></div>
      <div class="gc-play-btn">▶ JOUER</div>
    </button>`;
  }

  showGame(name) {
    this.cleanupActiveGame();

    document.getElementById('view-lobby')?.style.setProperty('display', 'none');
    document.querySelectorAll('.casino-game').forEach(g => g.classList.remove('active'));
    document.getElementById(`game-${name}`)?.classList.add('active');

    this.activeGameId = name;
    this.renderBetPanel(name);

    const common = {
      mountId: `game-${name}`,
      getBet: () => this.bet,
      debit: amount => this.debit(amount),
      credit: amount => this.credit(amount),
      addHistory: (...args) => this.addHistory(...args),
      backToLobby: () => this.backToLobby(),
    };

    if (name === 'wam') this.activeGame = new WhackAMoleGame(common);
    if (name === 'crash') this.activeGame = new CrashGame(common);
    if (name === 'slots') this.activeGame = new SlotMachineGame(common);
    if (name === 'nr') this.mountNeonRacer();

    if (this.activeGame?.mount) {
      this.activeGame.mount();
      this.renderBetPanel(name);
    }
  }

  renderBetPanel(name) {
    const game = document.getElementById(`game-${name}`);
    if (!game || name === 'nr') return;

    const existing = game.querySelector('.bet-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.innerHTML = this.betPanel(name);

    const header = game.querySelector('.game-header');
    if (header) header.insertAdjacentElement('afterend', panel.firstElementChild);
    else game.prepend(panel.firstElementChild);

    this.bindBetPanel(name);
  }

  backToLobby() {
    this.cleanupActiveGame();
    document.querySelectorAll('.casino-game').forEach(g => g.classList.remove('active'));
    document.getElementById('view-lobby')?.style.removeProperty('display');
    this.activeGameId = null;
    this.updateCreditsDisplay();
    this.renderHistory();
  }

  cleanupActiveGame() {
    if (this.activeGame?.stop) this.activeGame.stop();
    this.activeGame = null;
    this.cleanupNeonRacer();
  }

  betPanel(id, presets = [1, 5, 10, 25, 50, 100]) {
    const maxBet = Math.max(1, Math.min(100, this.credits));
    if (this.bet > maxBet) this.bet = maxBet;

    return `<div class="bet-panel">
      <span class="bet-label">MISE</span>
      <button class="bet-btn" id="${id}-bet-down">−</button>
      <span class="bet-val" id="${id}-bet-val">${this.bet}</span>
      <button class="bet-btn" id="${id}-bet-up">+</button>
      <div class="bet-presets">
        ${presets.map(p => `<button class="bet-preset${this.bet === p ? ' active' : ''}" data-preset="${p}" ${p > this.credits ? 'disabled' : ''}>${p}</button>`).join('')}
      </div>
    </div>`;
  }

  bindBetPanel(id) {
    const update = () => {
      const maxBet = Math.max(1, Math.min(100, this.credits));
      this.bet = Math.max(1, Math.min(maxBet, this.bet));

      const val = document.getElementById(`${id}-bet-val`);
      if (val) val.textContent = this.bet;

      document.querySelectorAll(`#game-${id} .bet-preset`).forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.preset) === this.bet);
        btn.disabled = Number(btn.dataset.preset) > this.credits;
      });
    };

    document.getElementById(`${id}-bet-down`)?.addEventListener('click', () => {
      SFX.click();
      this.bet = Math.max(1, this.bet - (this.bet > 10 ? 5 : 1));
      update();
    });

    document.getElementById(`${id}-bet-up`)?.addEventListener('click', () => {
      SFX.click();
      this.bet += this.bet >= 10 ? 5 : 1;
      update();
    });

    document.querySelectorAll(`#game-${id} .bet-preset`).forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.click();
        this.bet = Number(btn.dataset.preset);
        update();
      });
    });

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
        <span>${h.game}</span>
        <span class="history-result">${h.result.toUpperCase()}</span>
        <span>${h.bet} C</span>
        <span class="history-gain">${gain} C</span>
        <span>${this.format(h.balance)} C</span>
      </div>`;
    }).join('');
  }

  updateCreditsDisplay() {
    const el = document.getElementById('sb-credits');
    if (el) el.textContent = this.format(this.credits);
  }

  mountNeonRacer() {
    const game = document.getElementById('game-nr');
    if (!game) return;

    game.innerHTML = '<div id="nr-mount"></div>';

    this.nrResult = event => {
      const { bet = 50, result = 'push', net = 0 } = event.detail ?? {};
      this.addHistory('NEON', bet, result, net);
      this.updateCreditsDisplay();
    };

    this.nrBack = () => this.backToLobby();

    document.addEventListener('neon-racer:result', this.nrResult);
    document.addEventListener('neon-racer:back', this.nrBack);

    this.activeGame = new NeonRacer('nr-mount', this.userId, this.credits, async newCredits => {
      this.credits = newCredits;
      this.updateCreditsDisplay();
      await this.saveCredits();
    });

    this.activeGame.mount();
  }

  cleanupNeonRacer() {
    if (this.nrResult) {
      document.removeEventListener('neon-racer:result', this.nrResult);
      this.nrResult = null;
    }

    if (this.nrBack) {
      document.removeEventListener('neon-racer:back', this.nrBack);
      this.nrBack = null;
    }
  }

  format(value) {
    return formatChronicles(value);
  }
}
