/**
 * casino-core.js — Moteur central du module Casino STAR
 *
 * Usage standalone (star/casino/index.html) :
 *   import { CasinoCore } from './casino-core.js';
 *   const casino = await CasinoCore.boot({ userId, supabase });
 *   casino.showGame('blackjack');
 *
 * Usage embarqué dans STAR :
 *   import { CasinoCore } from '../casino/js/casino-core.js';
 *   const casino = await CasinoCore.boot({ mount: '#casino-root', userId, supabase });
 */

import { supabase as _defaultSupabase } from '../../../js/supabase.js';

// ── SFX ENGINE (autonome, ne dépend pas de widgets.js) ───────────────────────
export const SFX = {
  _ctx: null,
  _get() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },
  _t(freq, type, vol, att, dec, t0) {
    const ctx = this._get(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type;
    const T = t0 ?? ctx.currentTime;
    o.frequency.setValueAtTime(freq, T);
    g.gain.setValueAtTime(0, T);
    g.gain.linearRampToValueAtTime(vol, T + att);
    g.gain.linearRampToValueAtTime(0, T + att + dec);
    o.start(T); o.stop(T + att + dec + 0.01);
  },
  _n(vol, dur, t0) {
    const ctx = this._get(); if (!ctx) return;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf; s.connect(g); g.connect(ctx.destination);
    const T = t0 ?? ctx.currentTime;
    g.gain.setValueAtTime(vol, T);
    g.gain.linearRampToValueAtTime(0, T + dur);
    s.start(T);
  },
  click()     { this._t(880, 'sine', 0.08, 0.005, 0.06); },
  card()      { this._t(600, 'triangle', 0.06, 0.003, 0.08); this._n(0.03, 0.04); },
  chip()      { this._t(1400, 'sine', 0.05, 0.003, 0.05); },
  spin()      {
    const ctx = this._get(); if (!ctx) return;
    [200, 180, 160, 140].forEach((f, i) => this._t(f, 'sawtooth', 0.06, 0.01, 0.05, ctx.currentTime + i * 0.05));
    this._n(0.04, 0.3);
  },
  win()       {
    const ctx = this._get(); if (!ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => this._t(f, 'triangle', 0.10, 0.01, 0.14, ctx.currentTime + i * 0.09));
  },
  bigWin()    {
    const ctx = this._get(); if (!ctx) return;
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this._t(f, 'square', 0.08, 0.01, 0.16, ctx.currentTime + i * 0.07));
  },
  lose()      {
    const ctx = this._get(); if (!ctx) return;
    [330, 280, 220].forEach((f, i) => this._t(f, 'sawtooth', 0.07, 0.01, 0.18, ctx.currentTime + i * 0.12));
  },
  tick()      { this._t(1200, 'square', 0.03, 0.002, 0.02); },
  diceRoll()  { this._n(0.08, 0.15); this._t(800, 'square', 0.04, 0.002, 0.06); },
  push()      { this._t(440, 'sine', 0.06, 0.01, 0.2); },
};

// ── CREDITS MANAGER ──────────────────────────────────────────────────────────
export class CreditsManager {
  constructor(supabase, userId) {
    this.sb       = supabase;
    this.userId   = userId;
    this.credits  = 0;
    this._watchers = [];
  }

  async load() {
    if (!this.userId) { this.credits = 500; return this.credits; }
    try {
      const { data, error } = await this.sb
        .from('profiles')
        .select('chronicles')
        .eq('id', this.userId)
        .single();
      if (!error && data) {
        this.credits = data.chronicles ?? 0;
        if (this.credits === 0) {
          this.credits = 1000;
          await this.save();
        }
      } else {
        this.credits = 500;
      }
    } catch { this.credits = 500; }
    this._notify();
    return this.credits;
  }

  async save() {
    if (!this.userId) return;
    try {
      await this.sb
        .from('profiles')
        .update({ chronicles: this.credits })
        .eq('id', this.userId);
    } catch { /* silencieux */ }
    this._notify();
  }

  async change(delta) {
    this.credits = Math.max(0, this.credits + delta);
    this._notify();
    await this.save();
    return this.credits;
  }

  watch(fn) { this._watchers.push(fn); }

  _notify() {
    this._watchers.forEach(fn => fn(this.credits));
    // sync KPI STAR si présent
    const kpi = document.getElementById('kpi-chronicles');
    if (kpi) kpi.textContent = this.credits.toLocaleString('fr-FR');
  }
}

// ── CASINO CORE ──────────────────────────────────────────────────────────────
export class CasinoCore {
  /**
   * @param {object} opts
   * @param {string}  [opts.mount]    - sélecteur CSS du conteneur (défaut: 'body')
   * @param {string}  [opts.userId]   - user.id Supabase
   * @param {object}  [opts.supabase] - client Supabase (défaut: import interne)
   * @param {boolean} [opts.standalone] - true = gérer le shell HTML complet
   */
  static async boot(opts = {}) {
    const instance = new CasinoCore(opts);
    await instance._init();
    return instance;
  }

  constructor(opts) {
    this.mountSel   = opts.mount ?? 'body';
    this.userId     = opts.userId ?? null;
    this.sb         = opts.supabase ?? _defaultSupabase;
    this.standalone = opts.standalone ?? true;
    this.credits    = new CreditsManager(this.sb, this.userId);
    this._gameEl    = null;
    this._currentGame = null;
    this._toastTimer  = null;
  }

  async _init() {
    this._root = document.querySelector(this.mountSel);
    if (!this._root) throw new Error(`CasinoCore: mount "${this.mountSel}" not found`);

    if (this.standalone) this._renderShell();

    this._gameEl = this._root.querySelector('#casino-game-area');
    this._huds   = this._root.querySelectorAll('.casino-credits-hud__value');

    await this.credits.load();
    this.credits.watch(v => this._updateHUD(v));
    this._updateHUD(this.credits.credits);
  }

  _renderShell() {
    this._root.innerHTML = `
      <div class="casino-shell">
        <header class="casino-topbar">
          <div class="casino-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span class="casino-logo-text">STAR CASINO</span>
          </div>
          <div class="casino-credits-hud">
            <span class="casino-credits-hud__label">CR</span>
            <span class="casino-credits-hud__value" id="casino-hud-credits">—</span>
          </div>
          <button class="casino-back-btn" id="casino-back-lobby">
            ← LOBBY
          </button>
        </header>
        <main class="casino-content">
          <div id="casino-game-area"></div>
        </main>
      </div>
      <div id="casino-toast"></div>`;

    this._root.querySelector('#casino-back-lobby')?.addEventListener('click', () => {
      SFX.click();
      this.showLobby();
    });
  }

  _updateHUD(val) {
    const el = this._root.querySelector('#casino-hud-credits') ?? document.getElementById('casino-hud-credits');
    if (el) el.textContent = val.toLocaleString('fr-FR');
  }

  showToast(msg, type = 'info', duration = 2200) {
    const toast = document.getElementById('casino-toast');
    if (!toast) return;
    clearTimeout(this._toastTimer);
    toast.textContent = msg;
    toast.className = `visible toast-${type}`;
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  }

  /** Affiche le lobby des jeux */
  showLobby() {
    const area = this._root.querySelector('#casino-game-area');
    if (!area) return;
    this._currentGame = null;
    area.innerHTML = `
      <div class="casino-lobby">
        <h1 class="casino-lobby__title">★ CASINO ★</h1>
        <p class="casino-lobby__sub">CHOOSE YOUR GAME — CHRONICLES ARE ON THE LINE</p>

        <div class="casino-games-grid">
          <div class="casino-game-card" data-game="blackjack">
            <div class="casino-game-card__icon">🃏</div>
            <div class="casino-game-card__name">Blackjack</div>
            <div class="casino-game-card__desc">Beat the dealer.<br>Hit, stand, double.</div>
            <div class="casino-game-card__badge">1 – 200 CR</div>
          </div>
          <div class="casino-game-card" data-game="roulette">
            <div class="casino-game-card__icon">🎡</div>
            <div class="casino-game-card__name">Roulette</div>
            <div class="casino-game-card__desc">European wheel.<br>Numbers, colors, odds.</div>
            <div class="casino-game-card__badge">1 – 100 CR</div>
          </div>
          <div class="casino-game-card" data-game="dice">
            <div class="casino-game-card__icon">🎲</div>
            <div class="casino-game-card__name">Dice</div>
            <div class="casino-game-card__desc">Roll & hold.<br>Build combos, score big.</div>
            <div class="casino-game-card__badge">5 – 100 CR</div>
          </div>
          <div class="casino-game-card" data-game="slots">
            <div class="casino-game-card__icon">🎰</div>
            <div class="casino-game-card__name">Slots</div>
            <div class="casino-game-card__desc">Spin the reels.<br>Match symbols, win big.</div>
            <div class="casino-game-card__badge">1 – 50 CR</div>
          </div>
        </div>

        <div class="casino-stats-bar" id="casino-stats-bar">
          <div class="casino-stat">
            <span class="casino-stat__label">Chronicles</span>
            <span class="casino-stat__value" id="casino-stat-cr">—</span>
          </div>
          <div class="casino-stat">
            <span class="casino-stat__label">Session</span>
            <span class="casino-stat__value" id="casino-stat-session">+0</span>
          </div>
        </div>
      </div>`;

    const crEl = area.querySelector('#casino-stat-cr');
    if (crEl) crEl.textContent = this.credits.credits.toLocaleString('fr-FR');
    this._sessionStart = this._sessionStart ?? this.credits.credits;
    const sesEl = area.querySelector('#casino-stat-session');
    if (sesEl) {
      const diff = this.credits.credits - this._sessionStart;
      sesEl.textContent = (diff >= 0 ? '+' : '') + diff.toLocaleString('fr-FR');
      sesEl.style.color = diff >= 0 ? 'var(--c-win)' : 'var(--c-lose)';
    }

    area.querySelectorAll('.casino-game-card[data-game]').forEach(card => {
      card.addEventListener('click', () => {
        SFX.click();
        this.showGame(card.dataset.game);
      });
    });
  }

  /** Charge et monte un jeu par son slug */
  async showGame(slug) {
    const area = this._root.querySelector('#casino-game-area');
    if (!area) return;
    area.innerHTML = '<div style="text-align:center;padding:40px;color:var(--c-muted)">CHARGEMENT...</div>';

    try {
      let mod;
      switch (slug) {
        case 'blackjack': mod = await import('./games/blackjack.js'); break;
        case 'roulette':  mod = await import('./games/roulette.js');  break;
        case 'dice':      mod = await import('./games/dice.js');       break;
        case 'slots':     mod = await import('./games/slots.js');      break;
        default:
          area.innerHTML = '<p style="color:var(--c-lose)">Jeu inconnu.</p>';
          return;
      }
      area.innerHTML = '';
      this._currentGame = await mod.mount(area, this);
    } catch (e) {
      console.error('Casino: erreur chargement jeu', e);
      area.innerHTML = `<p style="color:var(--c-lose)">Erreur: ${e.message}</p>`;
    }
  }

  /** API pour les jeux : change les crédits et joue un son */
  async reward(delta, sfxName = 'win') {
    const hud = this._root.querySelector('#casino-hud-credits');
    if (hud) {
      hud.classList.remove('flash-win', 'flash-lose');
      void hud.offsetWidth;
      hud.classList.add(delta >= 0 ? 'flash-win' : 'flash-lose');
      setTimeout(() => hud.classList.remove('flash-win', 'flash-lose'), 600);
    }
    if (SFX[sfxName]) SFX[sfxName]();
    return this.credits.change(delta);
  }
}
