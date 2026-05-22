import { ArcadeSFX as SFX } from '../../arcade-sfx.js';

export class CrashGame {
  constructor({ mountId, getBet, debit, credit, addHistory, backToLobby }) {
    this.mountId = mountId;
    this.getBet = getBet;
    this.debit = debit;
    this.credit = credit;
    this.addHistory = addHistory;
    this.backToLobby = backToLobby;
    this.running = false;
    this.raf = null;
  }

  mount() {
    const game = document.getElementById(this.mountId);
    if (!game) return;
    game.innerHTML = `${this.header('CRA', 'SH')}
      <div class="crash-rules">
        <div class="crash-rules-title">⚡ COMMENT JOUER</div>
        <div class="crash-rules-grid">
          <div class="crash-rule-block"><span class="crb-icon">🛸</span><span class="crb-label">DÉCOLLAGE</span><span class="crb-desc">Le vaisseau du hub Gwen Ha Star grimpe avec le multiplicateur.</span></div>
          <div class="crash-rule-block"><span class="crb-icon">🚀</span><span class="crb-label">ÉJECTION</span><span class="crb-desc">Encaisse mise × multiplicateur avant la rupture moteur.</span></div>
          <div class="crash-rule-block"><span class="crb-icon">🤖</span><span class="crb-label">AUTO-EJECT</span><span class="crb-desc">Seuil conseillé : ×1.6 à ×2.5 pour limiter le risque.</span></div>
        </div>
      </div>
      <div class="crash-layout">
        <div class="crash-canvas-wrap"><canvas class="crash-canvas" id="cr-canvas" width="800" height="220"></canvas><div class="crash-mult" id="cr-mult">1.00×</div></div>
        <div class="crash-history" id="cr-history"></div>
        <div class="crash-controls">
          <button class="action-btn primary" id="cr-start">▶ LANCER</button>
          <button class="action-btn" id="cr-eject" disabled>🚀 ÉJECTER</button>
          <div class="crash-autoeject-row">AUTO ×<input class="crash-autoeject-inp" id="cr-auto" type="number" min="1.1" max="50" step="0.1" value="2.0"></div>
        </div>
        <div class="game-msg" id="cr-msg">MISE ET LANCE LE VAISSEAU</div>
      </div>`;
    document.getElementById('game-back')?.addEventListener('click', () => this.backToLobby());
    document.getElementById('cr-start')?.addEventListener('click', () => this.start());
    document.getElementById('cr-eject')?.addEventListener('click', () => this.eject());
    this.points = [[0, 1]];
    this.draw(1, false);
  }

  header(title, accent = '') {
    return `<div class="game-header">
      <button class="game-back-btn" id="game-back">← LOBBY</button>
      <span class="game-title">${title} ${accent ? `<span class="game-title-accent">${accent}</span>` : ''}</span>
    </div>`;
  }

  async start() {
    if (this.running) return;
    const bet = this.getBet();
    if (!(await this.debit(bet))) return this.setMsg('CRÉDITS INSUFFISANTS', 'lose');
    this.running = true;
    this.cashed = false;
    this.target = this.crashPoint();
    this.auto = Number(document.getElementById('cr-auto')?.value ?? 0);
    this.t0 = performance.now();
    this.points = [[0, 1]];
    this.exhaust = [];
    document.getElementById('cr-start').disabled = true;
    document.getElementById('cr-eject').disabled = false;
    this.setMsg('PROPULSEURS ACTIFS — ÉJECTE-TOI AVANT LE CRASH', 'neutral');
    this.loop();
  }

  crashPoint() {
    const houseEdge = 0.94;
    const r = Math.max(0.002, Math.random());
    const point = Math.floor((houseEdge / r) * 100) / 100;
    return Math.max(1.01, Math.min(point, 80));
  }

  loop() {
    if (!this.running) return;
    const elapsed = (performance.now() - this.t0) / 1000;
    this.mult = Math.round(Math.pow(1.075, elapsed * 5) * 100) / 100;
    this.points.push([elapsed, this.mult]);
    document.getElementById('cr-mult').textContent = `${this.mult.toFixed(2)}×`;
    this.draw(this.mult, false);
    if (this.auto > 1 && this.mult >= this.auto && !this.cashed) return this.eject(true);
    if (this.mult >= this.target) return this.crash();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  async eject(auto = false) {
    if (!this.running || this.cashed) return;
    this.cashed = true;
    const bet = this.getBet();
    const gain = Math.round(bet * this.mult);
    await this.credit(gain);
    this.addHistory('CRASH', bet, 'win', gain - bet);
    this.setMsg(`${auto ? 'AUTO ' : ''}ÉJECTION ×${this.mult.toFixed(2)} · +${gain - bet} C`, 'win');
    document.getElementById('cr-eject').disabled = true;
    this.addPill(this.mult, 'safe');
    SFX.win();
  }

  crash() {
    this.stop(false);
    const mult = document.getElementById('cr-mult');
    if (mult) {
      mult.textContent = `💥 ${this.mult.toFixed(2)}×`;
      mult.classList.add('crashed');
    }
    this.draw(this.mult, true);
    const cat = this.mult < 1.5 ? 'danger' : this.mult < 3 ? 'risky' : 'safe';
    this.addPill(this.mult, cat);
    if (!this.cashed) {
      const bet = this.getBet();
      this.addHistory('CRASH', bet, 'lose', -bet);
      this.setMsg(`RUPTURE MOTEUR ×${this.mult.toFixed(2)} · PERDU`, 'lose');
      SFX.crash();
    }
    document.getElementById('cr-start').disabled = false;
    document.getElementById('cr-eject').disabled = true;
  }

  addPill(mult, cat) {
    const wrap = document.getElementById('cr-history');
    if (!wrap) return;
    const pill = document.createElement('span');
    pill.className = `crash-hist-pill ${cat}`;
    pill.textContent = `${mult.toFixed(2)}×`;
    wrap.prepend(pill);
    while (wrap.children.length > 12) wrap.lastElementChild.remove();
  }

  stop(reset = true) {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.running = false;
    if (reset) this.cashed = false;
  }

  draw(mult, crashed) {
    const canvas = document.getElementById('cr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    this.drawSpaceBackground(ctx, W, H, mult, crashed);

    if (!this.points?.length) return;
    const maxT = Math.max(this.points.at(-1)[0], 5);
    const maxM = Math.max(mult * 1.2, 2);
    const toX = t => 28 + (t / maxT) * (W - 72);
    const toY = m => H - 20 - (m / maxM) * (H - 42);

    ctx.beginPath();
    ctx.strokeStyle = crashed ? '#ff4757' : '#00e5ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = crashed ? '#ff4757' : '#00e5ff';
    ctx.shadowBlur = 14;
    this.points.forEach(([t, m], i) => i ? ctx.lineTo(toX(t), toY(m)) : ctx.moveTo(toX(t), toY(m)));
    ctx.stroke();
    ctx.shadowBlur = 0;

    const last = this.points.at(-1);
    const shipX = toX(last[0]);
    const shipY = toY(last[1]);
    this.drawHubShip(ctx, shipX, shipY, 1, crashed ? 0.92 : 0.78 + Math.min(mult, 8) * 0.035, crashed);
    this.drawShipTrail(ctx, shipX, shipY, crashed);

    if (crashed) this.drawExplosion(ctx, shipX, shipY);
  }

  drawSpaceBackground(ctx, W, H, mult, crashed) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#050716');
    bg.addColorStop(0.58, '#090b1f');
    bg.addColorStop(1, '#020308');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,.045)';
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, H * i / 5);
      ctx.lineTo(W, H * i / 5);
      ctx.stroke();
    }

    ctx.save();
    ctx.globalAlpha = crashed ? 0.24 : 0.14;
    const speed = performance.now() * 0.015 + mult * 3;
    for (let i = 0; i < 34; i++) {
      const x = (i * 71 + speed * (i % 5 + 1)) % W;
      const y = (i * 43) % H;
      ctx.fillStyle = i % 3 === 0 ? '#00ffcc' : i % 3 === 1 ? '#ffffff' : '#ffcc00';
      ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
    ctx.restore();
  }

  // Same silhouette as the hub canvas ship in index.html, adapted for the Crash graph.
  drawHubShip(ctx, x, y, dir = 1, scale = 1, crashed = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(crashed ? -0.9 : -0.18);
    ctx.scale(dir, 1);
    ctx.scale(scale, scale);

    ctx.strokeStyle = crashed ? '#ff4757' : '#00ffcc';
    ctx.shadowColor = crashed ? '#ff4757' : '#00ffcc';
    ctx.shadowBlur = crashed ? 24 : 18;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, -10);
    ctx.lineTo(-36, 0);
    ctx.lineTo(-30, 10);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-20, -22);
    ctx.lineTo(-30, -10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(-20, 22);
    ctx.lineTo(-30, 10);
    ctx.stroke();

    ctx.shadowBlur = crashed ? 30 : 24;
    ctx.shadowColor = crashed ? '#ffcc00' : '#ff6600';
    ctx.strokeStyle = crashed ? '#ffcc00' : '#ff9933';
    ctx.beginPath();
    ctx.moveTo(-36, -5);
    ctx.lineTo(-48 - Math.random() * 12, 0);
    ctx.lineTo(-36, 5);
    ctx.stroke();
    ctx.restore();
  }

  drawShipTrail(ctx, x, y, crashed) {
    ctx.save();
    const grad = ctx.createLinearGradient(x - 95, y + 18, x, y);
    grad.addColorStop(0, 'rgba(255,102,0,0)');
    grad.addColorStop(0.55, crashed ? 'rgba(255,71,87,.3)' : 'rgba(255,153,51,.24)');
    grad.addColorStop(1, crashed ? 'rgba(255,204,0,.65)' : 'rgba(0,255,204,.42)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = crashed ? 7 : 5;
    ctx.shadowColor = crashed ? '#ff4757' : '#00ffcc';
    ctx.shadowBlur = crashed ? 18 : 12;
    ctx.beginPath();
    ctx.moveTo(x - 92, y + 22);
    ctx.quadraticCurveTo(x - 54, y + 10, x - 22, y + 3);
    ctx.stroke();
    ctx.restore();
  }

  drawExplosion(ctx, x, y) {
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      const r = 10 + Math.random() * 28;
      ctx.strokeStyle = i % 2 ? '#ff4757' : '#ffcc00';
      ctx.lineWidth = 2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
  }

  setMsg(text, type = '') {
    const node = document.getElementById('cr-msg');
    if (!node) return;
    node.textContent = text;
    node.className = 'game-msg' + (type ? ` ${type}` : '');
  }
}