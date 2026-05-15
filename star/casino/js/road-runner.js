/**
 * road-runner.js — STAR ARCADE  JEU 05
 * Vertical scroll shooter : évite les obstacles, collecte les boosts.
 * Dispatche road-runner:back et road-runner:result sur document.
 */

const RR_WIDTH   = 360;
const RR_HEIGHT  = 560;
const RR_LANES   = 3;          // 0=left, 1=center, 2=right
const RR_SPEED0  = 4;          // px/frame initial
const RR_ACCEL   = 0.0012;     // accélération par frame
const RR_LIVES   = 3;

const OBSTACLE_TYPES = [
  { type:'rock',   emoji:'🪨', pts:0,   prob:.45, w:38, h:34 },
  { type:'cactus', emoji:'🌵', pts:0,   prob:.30, w:28, h:42 },
  { type:'bomb',   emoji:'💣', pts:0,   prob:.15, w:32, h:32 },
  { type:'star',   emoji:'⭐', pts:5,   prob:.07, w:30, h:30 },
  { type:'coin',   emoji:'🪙', pts:2,   prob:.03, w:26, h:26 },
];

export class RoadRunner {
  /**
   * @param {string} mountId  — id de la <section> cible (sans #)
   * @param {string|null} userId
   * @param {number} credits
   * @param {number} bet
   * @param {function} onCreditsChange  — appelé avec le nouveau solde
   */
  constructor(mountId, userId, credits, bet, onCreditsChange) {
    this._mountId  = mountId;
    this._userId   = userId;
    this._credits  = credits;
    this._bet      = bet;
    this._onCr     = onCreditsChange;

    this._running  = false;
    this._raf      = null;
    this._frame    = 0;
    this._speed    = RR_SPEED0;
    this._score    = 0;
    this._lives    = RR_LIVES;
    this._lane     = 1;          // lane courante du joueur
    this._invincible = 0;        // frames d'invincibilité après un hit
    this._obstacles  = [];       // { lane, y, type }
    this._particles  = [];       // { x, y, vx, vy, life, emoji }
    this._bgOffset   = 0;
    this._canvas     = null;
    this._ctx        = null;
    this._keyBound   = null;
    this._touchStartX = null;
  }

  // ─── PUBLIC ───────────────────────────────────────────────────────
  mount() {
    const section = document.getElementById(this._mountId);
    if (!section) return;
    section.innerHTML = `
      <div class="rr-wrap" id="rr-wrap">
        <canvas id="rr-canvas" width="${RR_WIDTH}" height="${RR_HEIGHT}"></canvas>
        <div class="rr-overlay" id="rr-overlay">
          <div class="rr-overlay-title" id="rr-ov-title">ROAD RUNNER</div>
          <div class="rr-overlay-sub"   id="rr-ov-sub">Évite les obstacles, collecte les étoiles</div>
          <button class="rr-btn-start" id="rr-btn-start">▶ DÉMARRER</button>
        </div>
        <div class="rr-hud" id="rr-hud">
          <span id="rr-score-disp">0 PTS</span>
          <span id="rr-lives-disp">❤️❤️❤️</span>
        </div>
      </div>`;

    this._canvas = document.getElementById('rr-canvas');
    this._ctx    = this._canvas.getContext('2d');
    this._drawIdle();

    document.getElementById('rr-btn-start')?.addEventListener('click', () => this._startGame(), { once: true });
  }

  destroy() {
    this._stopLoop();
    if (this._keyBound) {
      document.removeEventListener('keydown', this._keyBound);
      this._keyBound = null;
    }
    if (this._canvas) {
      this._canvas.removeEventListener('touchstart', this._onTouchStart);
      this._canvas.removeEventListener('touchend',   this._onTouchEnd);
    }
  }

  // ─── GAME LIFECYCLE ───────────────────────────────────────────────
  _startGame() {
    document.getElementById('rr-overlay')?.style.setProperty('display','none');
    this._running  = true;
    this._frame    = 0;
    this._speed    = RR_SPEED0;
    this._score    = 0;
    this._lives    = RR_LIVES;
    this._lane     = 1;
    this._invincible = 0;
    this._obstacles  = [];
    this._particles  = [];
    this._bgOffset   = 0;
    this._bindInput();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _stopLoop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  _loop() {
    if (!this._running) return;
    this._frame++;
    this._speed += RR_ACCEL;
    this._update();
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // ─── INPUT ────────────────────────────────────────────────────────
  _bindInput() {
    this._keyBound = (e) => {
      if (e.key === 'ArrowLeft'  || e.key === 'a') this._moveLane(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') this._moveLane(+1);
    };
    document.addEventListener('keydown', this._keyBound);

    // Touch swipe
    this._onTouchStart = (e) => { this._touchStartX = e.touches[0].clientX; };
    this._onTouchEnd   = (e) => {
      if (this._touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - this._touchStartX;
      if (Math.abs(dx) > 30) this._moveLane(dx > 0 ? 1 : -1);
      this._touchStartX = null;
    };
    this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this._canvas.addEventListener('touchend',   this._onTouchEnd);
  }

  _moveLane(dir) {
    this._lane = Math.max(0, Math.min(RR_LANES - 1, this._lane + dir));
  }

  // ─── UPDATE ───────────────────────────────────────────────────────
  _update() {
    this._bgOffset = (this._bgOffset + this._speed) % RR_HEIGHT;

    // Spawn obstacles every N frames (faster as speed increases)
    const spawnRate = Math.max(28, Math.round(72 - this._speed * 5));
    if (this._frame % spawnRate === 0) this._spawnObstacle();

    // Move obstacles
    this._obstacles.forEach(o => { o.y += this._speed; });

    // Collision / collect
    const playerY  = RR_HEIGHT - 90;
    const laneX    = this._laneX(this._lane);
    const HIT_R    = 26;
    this._obstacles = this._obstacles.filter(o => {
      if (o.y > RR_HEIGHT + 40) return false;
      const ox  = this._laneX(o.lane);
      const oy  = o.y;
      const dx  = Math.abs(ox - laneX);
      const dy  = Math.abs(oy - playerY);
      if (dx < HIT_R && dy < HIT_R) {
        this._onHit(o);
        return false;
      }
      return true;
    });

    // Score: 1 pt per 6 frames survived
    if (this._frame % 6 === 0) this._score++;

    // Particles
    this._particles = this._particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.life--;
      return p.life > 0;
    });

    // Invincibility countdown
    if (this._invincible > 0) this._invincible--;

    // HUD
    this._updateHUD();
  }

  _spawnObstacle() {
    const r = Math.random(); let cum = 0;
    let picked = OBSTACLE_TYPES[0];
    for (const t of OBSTACLE_TYPES) { cum += t.prob; if (r < cum) { picked = t; break; } }
    this._obstacles.push({ lane: Math.floor(Math.random() * RR_LANES), y: -40, ...picked });
  }

  _onHit(o) {
    if (o.pts > 0) {
      // Collect bonus
      this._score += o.pts * 10;
      this._spawnParticles(this._laneX(o.lane), o.y, o.emoji, 6);
      return;
    }
    if (this._invincible > 0) return;
    this._lives = Math.max(0, this._lives - 1);
    this._invincible = 80;
    this._spawnParticles(this._laneX(this._lane), RR_HEIGHT - 90, '💥', 8);
    if (this._lives <= 0) this._gameOver();
  }

  _spawnParticles(x, y, emoji, n) {
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 / n) * i;
      this._particles.push({
        x, y, emoji,
        vx: Math.cos(angle) * (1.5 + Math.random()),
        vy: Math.sin(angle) * (1.5 + Math.random()) - 1,
        life: 28 + Math.floor(Math.random() * 14),
      });
    }
  }

  _updateHUD() {
    const s = document.getElementById('rr-score-disp');
    const l = document.getElementById('rr-lives-disp');
    if (s) s.textContent = `${this._score} PTS`;
    if (l) l.textContent = '❤️'.repeat(this._lives) || '💀';
  }

  async _gameOver() {
    this._stopLoop();
    if (this._keyBound) { document.removeEventListener('keydown', this._keyBound); this._keyBound = null; }

    // Calcul gain : 1 C par 20 pts de score, plafonné à 10× la mise
    const rawGain  = Math.floor(this._score / 20);
    const gain     = Math.min(rawGain, this._bet * 10);
    const net      = gain - this._bet;
    const result   = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';

    if (gain > 0) {
      this._credits += gain;
      this._onCr(this._credits);
    }

    document.dispatchEvent(new CustomEvent('road-runner:result', {
      detail: { bet: this._bet, result, net, score: this._score }
    }));

    // Show result overlay
    const ov  = document.getElementById('rr-overlay');
    const ovT = document.getElementById('rr-ov-title');
    const ovS = document.getElementById('rr-ov-sub');
    const btn = document.getElementById('rr-btn-start');
    if (ov && ovT && ovS) {
      ovT.textContent = `GAME OVER — ${this._score} PTS`;
      const gainTxt = net >= 0 ? `+${net} C` : `${net} C`;
      ovS.textContent = `MISE ${this._bet} C → GAIN ${gain} C (${gainTxt})`;
      ovS.style.color = net > 0 ? 'var(--c-green,#2ed573)' : net < 0 ? 'var(--c-red,#ff4757)' : '';
      if (btn) {
        btn.textContent = '↺ REJOUER';
        btn.style.display = '';
        btn.addEventListener('click', () => {
          this._startGame();
        }, { once: true });
      }
      ov.style.removeProperty('display');
    }
  }

  // ─── DRAW ─────────────────────────────────────────────────────────
  _laneX(lane) {
    const margin = 54;
    const step   = (RR_WIDTH - margin * 2) / (RR_LANES - 1);
    return margin + lane * step;
  }

  _drawIdle() {
    const ctx = this._ctx;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, RR_WIDTH, RR_HEIGHT);
    this._drawRoad(ctx, 0);
  }

  _draw() {
    const ctx = this._ctx;
    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, RR_WIDTH, RR_HEIGHT);
    this._drawRoad(ctx, this._bgOffset);

    // Obstacles
    this._obstacles.forEach(o => {
      ctx.font = `${o.h}px serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1;
      ctx.fillText(o.emoji, this._laneX(o.lane), o.y);
    });

    // Player
    const px = this._laneX(this._lane);
    const py = RR_HEIGHT - 90;
    if (this._invincible > 0) {
      ctx.globalAlpha = Math.sin(this._frame * 0.35) > 0 ? 0.35 : 1;
    }
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏎️', px, py);
    ctx.globalAlpha = 1;

    // Particles
    this._particles.forEach(p => {
      ctx.globalAlpha = p.life / 42;
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.emoji, p.x, p.y);
    });
    ctx.globalAlpha = 1;

    // Lane guides (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth   = 1;
    for (let l = 0; l < RR_LANES; l++) {
      const x = this._laneX(l);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RR_HEIGHT); ctx.stroke();
    }
  }

  _drawRoad(ctx, offset) {
    // Road surface
    ctx.fillStyle = '#111120';
    ctx.fillRect(24, 0, RR_WIDTH - 48, RR_HEIGHT);
    // Dashed center lines
    ctx.strokeStyle = 'rgba(255,220,50,.18)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([28, 20]);
    const dashStep = (RR_WIDTH - 96) / (RR_LANES - 1);
    for (let l = 0; l < RR_LANES - 1; l++) {
      const x = 54 + (l + 0.5) * dashStep;
      ctx.lineDashOffset = -offset;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RR_HEIGHT); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Road edges
    ctx.strokeStyle = 'rgba(255,110,180,.25)';
    ctx.lineWidth   = 3;
    ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(24, RR_HEIGHT); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(RR_WIDTH - 24, 0); ctx.lineTo(RR_WIDTH - 24, RR_HEIGHT); ctx.stroke();
  }
}
