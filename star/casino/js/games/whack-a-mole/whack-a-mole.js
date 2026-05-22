import { ArcadeSFX as SFX } from '../../arcade-sfx.js';
import { weightedPick } from '../../arcade-utils.js';

const WAM_DURATION = 30;
const WAM_HOLES = 12;
const WAM_TYPES = [
  { emoji: '🤖', pts: 1, cls: 'normal', weight: 54, ttl: 850 },
  { emoji: '⚡', pts: 2, cls: 'fast', weight: 23, ttl: 520 },
  { emoji: '⭐', pts: 5, cls: 'golden', weight: 8, ttl: 650 },
  { emoji: '💣', pts: -4, cls: 'bomb', weight: 15, ttl: 900 },
];

export class WhackAMoleGame {
  constructor({ mountId, getBet, debit, credit, addHistory, backToLobby }) {
    this.mountId = mountId;
    this.getBet = getBet;
    this.debit = debit;
    this.credit = credit;
    this.addHistory = addHistory;
    this.backToLobby = backToLobby;
    this.timers = [];
    this.running = false;
    this.raf = null;
  }

  mount() {
    const game = document.getElementById(this.mountId);
    if (!game) return;
    game.innerHTML = `${this.header('WHACK-A-', 'MOLE')}
      <div class="wam-arena" id="wam-arena">
        <div class="wam-hud">
          <div class="wam-hud-block"><span class="wam-hud-label">SCORE</span><span class="wam-hud-val" id="wam-score">0</span></div>
          <div class="wam-hud-block"><span class="wam-hud-label">TEMPS</span><span class="wam-hud-val wam-timer" id="wam-timer">${WAM_DURATION}</span></div>
          <div class="wam-hud-block"><span class="wam-hud-label">COMBO</span><span class="wam-hud-val wam-combo" id="wam-combo">x1</span></div>
          <div class="wam-hud-block"><span class="wam-hud-label">RATIO</span><span class="wam-hud-val" style="color:var(--c-green);font-size:1.15rem">12 pts = mise</span></div>
        </div>
        <div class="wam-grid" id="wam-grid">${Array.from({ length: WAM_HOLES }, (_, i) => `<button class="wam-hole" id="wam-hole-${i}" data-type="normal"><span class="wam-mole">🤖</span></button>`).join('')}</div>
        <div class="wam-timebar-wrap"><div class="wam-timebar" id="wam-timebar"></div></div>
      </div>
      <div class="game-msg" id="wam-msg">MISE ET LANCE LA PARTIE</div>
      <div class="action-row"><button class="action-btn primary" id="wam-start">▶ DÉMARRER</button></div>`;
    document.getElementById('game-back')?.addEventListener('click', () => this.backToLobby());
    document.getElementById('wam-start')?.addEventListener('click', () => this.launch());
  }

  header(title, accent = '') {
    return `<div class="game-header">
      <button class="game-back-btn" id="game-back">← LOBBY</button>
      <span class="game-title">${title} ${accent ? `<span class="game-title-accent">${accent}</span>` : ''}</span>
    </div>`;
  }

  async launch() {
    if (this.running) return;
    const bet = this.getBet();
    if (!(await this.debit(bet))) return this.setMsg('CRÉDITS INSUFFISANTS', 'lose');
    this.running = true;
    this.score = 0;
    this.combo = 1;
    this.hits = 0;
    this.startedAt = performance.now();
    document.getElementById('wam-start').disabled = true;
    this.setMsg('GO !', 'neutral');
    this.scheduleMoles();
    this.raf = requestAnimationFrame(() => this.tick());
  }

  scheduleMoles() {
    if (!this.running) return;
    const holes = [...document.querySelectorAll('.wam-hole:not(.active)')];
    const elapsed = (performance.now() - this.startedAt) / 1000;
    const maxActive = elapsed < 8 ? 2 : elapsed < 20 ? 3 : 4;
    if (holes.length && document.querySelectorAll('.wam-hole.active').length < maxActive) {
      this.popMole(holes[Math.floor(Math.random() * holes.length)]);
    }
    this.timers.push(setTimeout(() => this.scheduleMoles(), 320 + Math.random() * 500));
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
      const pts = type.pts < 0 ? type.pts : type.pts * this.combo;
      this.score = Math.max(0, this.score + pts);
      this.hits += type.pts > 0 ? 1 : 0;
      this.combo = type.pts < 0 ? 1 : Math.min(8, this.combo + 1);
      document.getElementById('wam-score').textContent = this.score;
      document.getElementById('wam-combo').textContent = `x${this.combo}`;
      hole.className = `wam-hole ${type.pts < 0 ? 'miss' : 'hit'}`;
      const pop = document.createElement('span');
      pop.className = `wam-score-pop${type.pts < 0 ? ' neg' : ''}`;
      pop.textContent = `${pts > 0 ? '+' : ''}${pts}`;
      hole.appendChild(pop);
      setTimeout(() => { hole.className = 'wam-hole'; pop.remove(); }, 260);
      type.pts < 0 ? SFX.lose() : SFX.tick();
    };
  }

  tick() {
    if (!this.running) return;
    const elapsed = (performance.now() - this.startedAt) / 1000;
    const left = Math.max(0, WAM_DURATION - elapsed);
    document.getElementById('wam-timer').textContent = Math.ceil(left);
    document.getElementById('wam-timebar').style.transform = `scaleX(${left / WAM_DURATION})`;
    if (left <= 0) return this.end();
    this.raf = requestAnimationFrame(() => this.tick());
  }

  async end() {
    this.stop();
    const bet = this.getBet();
    const gain = Math.max(0, Math.round(bet * this.score / 12));
    const net = gain - bet;
    if (gain > 0) await this.credit(gain);
    const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    this.addHistory('WHACK', bet, result, net);
    this.setMsg(`Score ${this.score} · ${this.hits} hits · ${net >= 0 ? '+' : ''}${net} C`, result);
    const btn = document.getElementById('wam-start');
    if (btn) { btn.disabled = false; btn.textContent = '↺ REJOUER'; }
    result === 'win' ? SFX.win() : SFX.lose();
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    document.querySelectorAll('.wam-hole.active').forEach(h => h.className = 'wam-hole');
  }

  setMsg(text, type = '') {
    const node = document.getElementById('wam-msg');
    if (!node) return;
    node.textContent = text;
    node.className = 'game-msg' + (type ? ` ${type}` : '');
  }
}
