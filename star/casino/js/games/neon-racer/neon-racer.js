/**
 * Neon Racer — dedicated Star Arcade mini-game module.
 *
 * Migrated from the legacy /star/casino/js/neon-racer.js file.
 * Uses absolute asset paths and the arcade core wallet callback instead of
 * importing Supabase directly.
 */
import { ArcadeSFX as SFX } from '../../arcade-sfx.js';

const VEHICLES = [
  {
    id: 'mash',
    name: 'MASH',
    type: 'MOTO',
    img: '/shared/images/vehicule/mash.png',
    speed: 4,
    handling: 5,
    bonus: 'COMBO ×1.5',
    bonusKey: 'combo',
    color: '#ff6eb4',
    stars: [4, 5],
    desc: 'Légère et agile. Combo renforcé à chaque bonus.',
  },
  {
    id: 'citroenAX',
    name: 'CITROËN AX',
    type: 'VOITURE',
    img: '/shared/images/vehicule/citroenAX.png',
    speed: 3,
    handling: 3,
    bonus: 'BOUCLIER ×2',
    bonusKey: 'shield',
    color: '#00e5ff',
    stars: [3, 3],
    desc: 'Robuste. Les boucliers protègent plus longtemps.',
  },
  {
    id: 'barossa',
    name: 'BAROSSA',
    type: 'QUAD',
    img: '/shared/images/vehicule/barossa.png',
    speed: 5,
    handling: 2,
    bonus: 'GAIN ×2',
    bonusKey: 'gain',
    color: '#ffcc00',
    stars: [5, 2],
    desc: 'Brute de vitesse. Gain final doublé, maniabilité réduite.',
  },
];

const HEART_COSTS = [50, 100, 200];
const CW = 800;
const CH = 320;
const CHECKPOINT_DIST = 500;
const H_LANES = [110, 170, 230];
const V_LANES = [190, 400, 610];
const V_PLAYER_Y = 248;

const H_OBSTACLES = [
  { type: 'car', emoji: '🚗', harm: true, weight: 42 },
  { type: 'truck', emoji: '🚛', harm: true, weight: 22 },
  { type: 'barrier', emoji: '🚧', harm: true, weight: 16 },
  { type: 'boost', emoji: '⚡', harm: false, pts: 70, weight: 14 },
  { type: 'star', emoji: '⭐', harm: false, pts: 130, weight: 6 },
];

const V_OBSTACLES = [
  { type: 'rock', emoji: '🪨', harm: true, weight: 38 },
  { type: 'cactus', emoji: '🌵', harm: true, weight: 26 },
  { type: 'bomb', emoji: '💣', harm: true, weight: 14 },
  { type: 'coin', emoji: '🪙', harm: false, pts: 40, weight: 14 },
  { type: 'star', emoji: '⭐', harm: false, pts: 100, weight: 8 },
];

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
}

export class NeonRacer {
  constructor(mountId, userId, credits, onCreditsChange) {
    this.mountId = mountId;
    this.userId = userId;
    this.credits = credits;
    this.onCreditsChange = onCreditsChange;
    this._raf = null;
    this._running = false;
    this._vehicle = VEHICLES[0];
    this._heartIdx = 0;
    this._bet = HEART_COSTS[0];
  }

  mount() {
    const root = document.getElementById(this.mountId);
    if (!root) return;

    root.innerHTML = `
      <div class="game-header">
        <button class="game-back-btn" id="nr-back">← LOBBY</button>
        <span class="game-title">NEON <span class="game-title-accent" style="--game-accent:var(--c-amber)">RACER</span></span>
      </div>
      <div id="nr-inner"></div>`;

    document.getElementById('nr-back')?.addEventListener('click', () => {
      this.stop();
      document.dispatchEvent(new CustomEvent('neon-racer:back'));
    });

    this.renderSelect();
  }

  renderSelect() {
    const root = document.getElementById('nr-inner');
    if (!root) return;

    root.innerHTML = `
      <div class="chase-select">
        <div class="chase-select-title">// CHOISIR TON VÉHICULE</div>
        <div class="chase-vehicles-grid" id="nr-vgrid">
          ${VEHICLES.map((v, i) => `
            <div class="chase-vcard ${i === 0 ? 'selected' : ''}" data-idx="${i}" style="--vc:${v.color}">
              <img src="${v.img}" alt="${v.name}" class="chase-vimg" loading="eager" onerror="this.style.opacity=.15">
              <div class="chase-vname">${v.name}</div>
              <div class="chase-vtype">${v.type}</div>
              <div class="chase-vstars"><span class="chase-vstat-lbl">VITESSE</span>${'★'.repeat(v.stars[0])}${'☆'.repeat(5 - v.stars[0])}</div>
              <div class="chase-vstars"><span class="chase-vstat-lbl">MANIAB.</span>${'★'.repeat(v.stars[1])}${'☆'.repeat(5 - v.stars[1])}</div>
              <div class="chase-vbonus">${v.bonus}</div>
              <div class="chase-vdesc">${v.desc}</div>
            </div>`).join('')}
        </div>

        <div class="nr-hearts-panel">
          <div class="nr-hearts-title">MISE — CHOISIR TES CŒURS</div>
          <div class="nr-hearts-row" id="nr-hearts-row">
            ${HEART_COSTS.map((cost, i) => `
              <button class="nr-heart-btn ${i === 0 ? 'active' : ''}" data-idx="${i}">
                ${'❤️'.repeat(i + 1)}
                <span class="nr-heart-cost">${cost} C</span>
                <span class="nr-heart-lives">${i + 1} vie${i > 0 ? 's' : ''}</span>
              </button>`).join('')}
          </div>
          <div class="nr-hearts-hint" id="nr-hearts-hint">Mise : <strong>50 C</strong> · 1 vie · 1 crash = game over</div>
        </div>

        <div class="chase-how">
          <div class="chase-how-title">⚡ COMMENT JOUER</div>
          <div class="chase-how-grid">
            <div class="chase-how-block"><span>↔</span><span>Axe horizontal : ↑↓ pour changer de voie</span></div>
            <div class="chase-how-block"><span>↕</span><span>Axe vertical : ←→ pour changer de voie</span></div>
            <div class="chase-how-block"><span>🏁</span><span>Tous les 500m l’axe bascule</span></div>
            <div class="chase-how-block"><span>❤️</span><span>Chaque crash coûte 1 vie</span></div>
            <div class="chase-how-block"><span>⚡⭐</span><span>Bonus = score et combo</span></div>
            <div class="chase-how-block"><span>💰</span><span>Gain = mise × distance / 150</span></div>
          </div>
        </div>

        <div class="action-row">
          <button class="action-btn primary" id="nr-start">▶ DÉMARRER</button>
        </div>
      </div>`;

    document.querySelectorAll('.chase-vcard').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.chase-vcard').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this._vehicle = VEHICLES[Number(card.dataset.idx)];
        SFX.click();
      });
    });

    document.querySelectorAll('.nr-heart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nr-heart-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._heartIdx = Number(btn.dataset.idx);
        this._bet = HEART_COSTS[this._heartIdx];
        const lives = this._heartIdx + 1;
        document.getElementById('nr-hearts-hint').innerHTML =
          `Mise : <strong>${this._bet} C</strong> · ${lives} vie${lives > 1 ? 's' : ''}`;
        SFX.click();
      });
    });

    document.getElementById('nr-start')?.addEventListener('click', () => this.launch());
  }

  async launch() {
    if (this.credits < this._bet) return this.flash('CRÉDITS INSUFFISANTS');

    this.credits -= this._bet;
    await this.onCreditsChange(this.credits);

    const root = document.getElementById('nr-inner');
    if (!root) return;

    root.innerHTML = `
      <div class="chase-arena" id="nr-arena">
        <canvas id="nr-canvas" width="${CW}" height="${CH}" style="width:100%;height:auto;display:block"></canvas>
        <div class="chase-hud" id="nr-hud">
          <div class="chase-hud-block"><span class="chase-hud-lbl">DIST.</span><span class="chase-hud-val" id="nr-dist">0</span><span class="chase-hud-unit">m</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">SCORE</span><span class="chase-hud-val" id="nr-score">0</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">VIES</span><span class="chase-hud-val" id="nr-lives">❤️</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">AXE</span><span class="chase-hud-val" id="nr-axis">↔</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">NEXT</span><span class="chase-hud-val" id="nr-next">500m</span></div>
        </div>
        <div id="nr-axis-flash" class="nr-axis-flash" style="display:none"></div>
      </div>`;

    await this.countdown();
    this.startLoop();
  }

  async countdown() {
    const arena = document.getElementById('nr-arena');
    for (const txt of ['3', '2', '1', 'GO!']) {
      SFX.tick();
      const d = document.createElement('div');
      d.className = 'wam-countdown';
      d.textContent = txt;
      arena.appendChild(d);
      await new Promise(resolve => setTimeout(resolve, 520));
      d.remove();
    }
    SFX.win();
  }

  startLoop() {
    this._running = true;
    this._axis = 'H';
    this._checkpoint = 1;
    this._dist = 0;
    this._score = 0;
    this._lives = this._heartIdx + 1;
    this._combo = 1;
    this._shield = 0;
    this._invincible = 0;
    this._speed = this._vehicle.speed;
    this._obstacles = [];
    this._particles = [];
    this._spawnTimer = 0;
    this._lastT = performance.now();
    this._hLane = 1;
    this._vLane = 1;
    this._playerY = H_LANES[1];
    this._vehicleImg = new Image();
    this._vehicleImg.src = this._vehicle.img;

    this._onKey = event => {
      if (this._axis === 'H') {
        if (event.key === 'ArrowUp' || event.key === 'w') this._hLane = Math.max(0, this._hLane - 1);
        if (event.key === 'ArrowDown' || event.key === 's') this._hLane = Math.min(2, this._hLane + 1);
      } else {
        if (event.key === 'ArrowLeft' || event.key === 'a') this._vLane = Math.max(0, this._vLane - 1);
        if (event.key === 'ArrowRight' || event.key === 'd') this._vLane = Math.min(2, this._vLane + 1);
      }
    };
    window.addEventListener('keydown', this._onKey);

    this._raf = requestAnimationFrame(t => this.frame(t));
  }

  frame(ts) {
    if (!this._running) return;

    const dt = Math.min((ts - this._lastT) / 16.67, 3);
    this._lastT = ts;
    this._dist += this._speed * dt * 0.55;
    this._speed += 0.0018 * dt;
    this._score += dt * 0.06;
    this._invincible = Math.max(0, this._invincible - dt);

    if (this._dist >= this._checkpoint * CHECKPOINT_DIST) {
      this._checkpoint += 1;
      this.switchAxis();
    }

    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this.spawnObstacle();
      this._spawnTimer = Math.max(26, 90 - this._speed * 4);
    }

    if (this._axis === 'H') {
      this._playerY += (H_LANES[this._hLane] - this._playerY) * Math.min(0.18 * this._vehicle.handling * dt, 1);
      this._obstacles.forEach(o => { o.x -= (this._speed + o.spd) * dt; });
      this._obstacles = this._obstacles.filter(o => o.x > -90);
    } else {
      this._obstacles.forEach(o => { o.y += this._speed * dt; });
      this._obstacles = this._obstacles.filter(o => o.y < CH + 60);
    }

    this.checkCollisions();
    this.draw();
    this.updateHUD();
    this._raf = requestAnimationFrame(t => this.frame(t));
  }

  switchAxis() {
    this._axis = this._axis === 'H' ? 'V' : 'H';
    this._obstacles = [];
    this._hLane = 1;
    this._vLane = 1;
    this._playerY = H_LANES[1];
    SFX.win();

    const flash = document.getElementById('nr-axis-flash');
    if (flash) {
      flash.textContent = this._axis === 'H' ? '↔ AXE HORIZONTAL' : '↕ AXE VERTICAL';
      flash.style.display = '';
      flash.classList.add('visible');
      setTimeout(() => {
        flash.classList.remove('visible');
        setTimeout(() => { flash.style.display = 'none'; }, 350);
      }, 700);
    }
  }

  spawnObstacle() {
    const pool = this._axis === 'H' ? H_OBSTACLES : V_OBSTACLES;
    const picked = weightedPick(pool);
    if (this._axis === 'H') {
      const lane = Math.floor(Math.random() * H_LANES.length);
      this._obstacles.push({ ...picked, x: CW + 80 + Math.random() * 180, y: H_LANES[lane], spd: Math.random() * 1.5 });
    } else {
      const lane = Math.floor(Math.random() * V_LANES.length);
      this._obstacles.push({ ...picked, x: V_LANES[lane], y: -60, spd: 0 });
    }
  }

  checkCollisions() {
    if (this._invincible > 0) return;
    const px = this._axis === 'H' ? 100 : V_LANES[this._vLane];
    const py = this._axis === 'H' ? this._playerY : V_PLAYER_Y;

    for (let i = this._obstacles.length - 1; i >= 0; i--) {
      const o = this._obstacles[i];
      const dx = Math.abs(o.x - px);
      const dy = Math.abs(o.y - py);
      const hit = this._axis === 'H' ? dx < 46 && dy < 32 : dx < 32 && dy < 32;
      if (!hit) continue;

      this._obstacles.splice(i, 1);
      if (!o.harm) {
        const pts = o.pts ?? 20;
        this._score += pts * this._combo;
        this._combo = Math.min(this._vehicle.bonusKey === 'combo' ? 16 : 8, this._combo + 1);
        if (this._vehicle.bonusKey === 'shield') this._shield = 120;
        SFX.tick();
      } else if (this._shield > 0) {
        this._shield = 0;
        SFX.tick();
      } else {
        this._lives -= 1;
        this._combo = 1;
        this._invincible = 85;
        SFX.lose();
        if (this._lives <= 0) {
          this.stop();
          this.gameOver();
          return;
        }
      }
    }
  }

  draw() {
    const canvas = document.getElementById('nr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    this._axis === 'H' ? this.drawHorizontal(ctx) : this.drawVertical(ctx);
  }

  drawHorizontal(ctx) {
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#101322';
    ctx.fillRect(0, 60, CW, 220);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.setLineDash([24, 20]);
    for (const y of [140, 210]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    this._obstacles.forEach(o => this.drawEmoji(ctx, o.emoji, o.x, o.y, 34));
    this.drawPlayer(ctx, 100, this._playerY, 'H');
  }

  drawVertical(ctx) {
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#101322';
    ctx.fillRect(60, 0, CW - 120, CH);
    ctx.strokeStyle = 'rgba(255,220,50,.15)';
    ctx.setLineDash([28, 20]);
    for (const x of [270, 530]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CH);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    this._obstacles.forEach(o => this.drawEmoji(ctx, o.emoji, o.x, o.y, 34));
    this.drawPlayer(ctx, V_LANES[this._vLane], V_PLAYER_Y, 'V');
  }

  drawEmoji(ctx, emoji, x, y, size) {
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
  }

  drawPlayer(ctx, x, y, axis) {
    ctx.save();
    if (this._invincible > 0) ctx.globalAlpha = Math.sin(performance.now() / 60) > 0.5 ? 0.35 : 1;
    if (this._shield > 0) {
      ctx.strokeStyle = 'rgba(0,229,255,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 50, 28, axis === 'V' ? Math.PI / 2 : 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this._vehicleImg.complete && this._vehicleImg.naturalWidth > 0) {
      const ratio = this._vehicleImg.naturalWidth / this._vehicleImg.naturalHeight;
      const h = 44;
      const w = h * ratio;
      if (axis === 'V') {
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(this._vehicleImg, -w / 2, -h / 2, w, h);
      } else {
        ctx.drawImage(this._vehicleImg, x - w / 2, y - h / 2, w, h);
      }
    } else {
      this.drawEmoji(ctx, axis === 'V' ? '🏎️' : '🚗', x, y, 36);
    }
    ctx.restore();
  }

  updateHUD() {
    document.getElementById('nr-dist').textContent = Math.floor(this._dist);
    document.getElementById('nr-score').textContent = Math.floor(this._score);
    document.getElementById('nr-lives').textContent = '❤️'.repeat(this._lives) || '💀';
    document.getElementById('nr-axis').textContent = this._axis === 'H' ? '↔' : '↕';
    document.getElementById('nr-next').textContent = `${Math.max(0, Math.ceil(this._checkpoint * CHECKPOINT_DIST - this._dist))}m`;
  }

  async gameOver() {
    const dist = Math.floor(this._dist);
    let gain = Math.round(this._bet * dist / 150);
    if (this._vehicle.bonusKey === 'gain') gain *= 2;
    const net = gain - this._bet;
    const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';

    this.credits += gain;
    await this.onCreditsChange(this.credits);

    const arena = document.getElementById('nr-arena');
    if (!arena) return;

    const res = document.createElement('div');
    res.className = 'wam-result-screen';
    res.innerHTML = `
      <div class="wam-result-title">GAME OVER</div>
      <div class="wam-result-score">${dist} m</div>
      <div class="wam-result-gain">MISE ${this._bet} C → GAIN <strong>${gain} C</strong> <span style="color:${net >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${net >= 0 ? '+' : ''}${net} C</span></div>
      <div style="font-size:11px;letter-spacing:.12em;color:var(--c-text-faint)">SCORE : ${Math.floor(this._score)} · CHECKPOINTS : ${this._checkpoint - 1}</div>
      <button class="action-btn primary" id="nr-retry" style="margin-top:16px">↺ REJOUER</button>`;
    arena.appendChild(res);

    document.getElementById('nr-retry')?.addEventListener('click', () => {
      res.remove();
      this.renderSelect();
    });

    document.dispatchEvent(new CustomEvent('neon-racer:result', {
      detail: { bet: this._bet, result, net, dist },
    }));
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
  }

  _stop() {
    this.stop();
  }

  flash(text) {
    const root = document.getElementById('nr-inner');
    if (!root) return;
    const d = document.createElement('div');
    d.className = 'game-msg lose';
    d.textContent = text;
    d.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10';
    root.appendChild(d);
    setTimeout(() => d.remove(), 2000);
  }
}
