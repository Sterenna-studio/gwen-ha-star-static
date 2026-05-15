/**
 * road-runner.js — STAR ARCADE  JEU 05
 * Vertical scrolling road game. Canvas 2D, no external deps.
 * Dispatches: roadrunner:back, roadrunner:result
 */
export class RoadRunner {
  constructor(mountId, userId, credits, onCreditsChange) {
    this.mountId        = mountId;
    this.userId         = userId;
    this.credits        = credits;
    this.onCreditsChange = onCreditsChange;
    this.bet            = 10;
    // canvas / loop
    this._raf    = null;
    this._running = false;
    this._ended   = false;
  }

  mount() {
    const el = document.getElementById(this.mountId);
    if (!el) return;
    el.innerHTML = `
      <div class="game-header">
        <button class="game-back-btn" id="rr-back">← LOBBY</button>
        <span class="game-title">ROAD <span class="game-title-accent">RUNNER</span></span>
      </div>
      <div class="rr-wrap">
        <canvas id="rr-canvas" class="rr-canvas" width="320" height="480"></canvas>
        <div class="rr-side">
          <div class="rr-hud">
            <div class="rr-hud-block"><span class="rr-hud-label">DISTANCE</span><span class="rr-hud-val" id="rr-dist">0 m</span></div>
            <div class="rr-hud-block"><span class="rr-hud-label">VITESSE</span><span class="rr-hud-val" id="rr-speed">0</span></div>
            <div class="rr-hud-block"><span class="rr-hud-label">VIES</span><span class="rr-hud-val" id="rr-lives">❤️❤️❤️</span></div>
          </div>
          <div class="bet-panel rr-bet">
            <span class="bet-label">MISE</span>
            <button class="bet-btn" id="rr-bet-down">−</button>
            <span class="bet-val" id="rr-bet-val">${this.bet}</span>
            <button class="bet-btn" id="rr-bet-up">+</button>
            <div class="bet-presets">
              ${[1,5,10,25,50,100].map(p=>`<button class="bet-preset${this.bet===p?' active':''}" data-preset="${p}">${p}</button>`).join('')}
            </div>
          </div>
          <div class="game-msg" id="rr-msg">MISE ET DÉMARRE</div>
          <div class="action-row" style="flex-direction:column;gap:8px">
            <button class="action-btn primary" id="rr-start">▶ DÉMARRER</button>
            <div class="rr-controls-hint">← → ou A D pour diriger</div>
          </div>
        </div>
      </div>`;

    this._bindBet();
    document.getElementById('rr-back')?.addEventListener('click', () => this._quit());
    document.getElementById('rr-start')?.addEventListener('click', () => this._launch());
    this._drawIdle();
  }

  // ── BET ───────────────────────────────────────────────────────────────
  _bindBet() {
    const upd = () => {
      const v = document.getElementById('rr-bet-val');
      if (v) v.textContent = this.bet;
      document.querySelectorAll('.rr-bet .bet-preset').forEach(b =>
        b.classList.toggle('active', Number(b.dataset.preset) === this.bet));
    };
    document.getElementById('rr-bet-down')?.addEventListener('click', () => {
      this.bet = Math.max(1, this.bet - (this.bet > 10 ? 5 : 1)); upd();
    });
    document.getElementById('rr-bet-up')?.addEventListener('click', () => {
      this.bet = Math.min(this.credits, this.bet + (this.bet >= 10 ? 5 : 1)); upd();
    });
    document.querySelectorAll('.rr-bet .bet-preset').forEach(b =>
      b.addEventListener('click', () => {
        this.bet = Math.min(this.credits, Number(b.dataset.preset)); upd();
      })
    );
  }

  // ── IDLE SCREEN ───────────────────────────────────────────────────────
  _drawIdle() {
    const cv = document.getElementById('rr-canvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    this._drawRoadBg(ctx, 0);
    // player car
    this._drawCar(ctx, 160, 400, '#00e5ff', 0);
  }

  // ── LAUNCH ────────────────────────────────────────────────────────────
  _launch() {
    if (this._running) return;
    if (this.credits < this.bet) { this._msg('CRÉDITS INSUFFISANTS', 'lose'); return; }
    this.credits -= this.bet;
    this.onCreditsChange(this.credits);
    this._ended  = false;
    this._running = true;

    // Game state
    this._dist     = 0;
    this._speed    = 2.5;          // px/frame scroll speed
    this._lives    = 3;
    this._lane     = 1;            // 0=left 1=center 2=right
    this._laneX    = [96, 160, 224];
    this._playerX  = 160;
    this._playerY  = 400;
    this._obstacles = [];
    this._roadOffset = 0;
    this._spawnTimer = 0;
    this._invincible = 0;          // frames of invincibility after hit
    this._frameCount = 0;
    this._keys     = {};
    this._laneCooldown = 0;

    this._keyDown = (e) => { this._keys[e.code] = true; };
    this._keyUp   = (e) => { this._keys[e.code] = false; };
    document.addEventListener('keydown', this._keyDown);
    document.addEventListener('keyup',   this._keyUp);

    // Touch / swipe
    this._touchStartX = null;
    this._touchHandler = (e) => {
      const t = e.touches[0];
      if (!this._touchStartX) { this._touchStartX = t.clientX; return; }
      const dx = t.clientX - this._touchStartX;
      if (Math.abs(dx) > 30) {
        this._changeLane(dx > 0 ? 1 : -1);
        this._touchStartX = t.clientX;
      }
    };
    const cv = document.getElementById('rr-canvas');
    cv?.addEventListener('touchstart', e => { this._touchStartX = e.touches[0].clientX; }, { passive:true });
    cv?.addEventListener('touchmove',  this._touchHandler, { passive:true });

    document.getElementById('rr-start').disabled = true;
    this._msg('', '');
    this._updateHUD();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // ── MAIN LOOP ─────────────────────────────────────────────────────────
  _loop() {
    if (!this._running) return;
    this._frameCount++;

    // Input
    if (this._laneCooldown > 0) this._laneCooldown--;
    if (this._laneCooldown === 0) {
      if (this._keys['ArrowLeft']  || this._keys['KeyA']) { this._changeLane(-1); this._laneCooldown = 12; }
      if (this._keys['ArrowRight'] || this._keys['KeyD']) { this._changeLane(1);  this._laneCooldown = 12; }
    }

    // Smooth player X towards target lane
    const targetX = this._laneX[this._lane];
    this._playerX += (targetX - this._playerX) * 0.22;

    // Speed ramp: every 300 frames +0.15 px/frame
    if (this._frameCount % 300 === 0) this._speed = Math.min(12, this._speed + 0.15);

    // Road scroll
    this._roadOffset = (this._roadOffset + this._speed) % 60;
    this._dist += this._speed * 0.05;

    // Spawn obstacles
    this._spawnTimer--;
    if (this._spawnTimer <= 0) {
      this._spawnObstacle();
      this._spawnTimer = Math.max(35, 80 - Math.floor(this._speed * 3));
    }

    // Move obstacles
    this._obstacles.forEach(o => o.y += this._speed * 1.1);
    this._obstacles = this._obstacles.filter(o => o.y < 520);

    // Collision
    if (this._invincible > 0) this._invincible--;
    else {
      for (const o of this._obstacles) {
        if (o.hit) continue;
        const dx = Math.abs(this._playerX - o.x);
        const dy = Math.abs(this._playerY - o.y);
        if (dx < 22 && dy < 28) {
          o.hit = true;
          this._lives--;
          this._invincible = 80;
          this._updateHUD();
          if (this._lives <= 0) { this._end(); return; }
        }
      }
    }

    // Draw
    const cv = document.getElementById('rr-canvas');
    if (!cv) { this._running = false; return; }
    const ctx = cv.getContext('2d');
    this._drawRoadBg(ctx, this._roadOffset);
    this._obstacles.forEach(o => this._drawObstacle(ctx, o));
    // Player blink when invincible
    if (this._invincible === 0 || Math.floor(this._invincible / 6) % 2 === 0)
      this._drawCar(ctx, this._playerX, this._playerY, '#00e5ff', 0);

    this._updateHUD();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // ── LANE CHANGE ──────────────────────────────────────────────────────
  _changeLane(dir) {
    const next = this._lane + dir;
    if (next < 0 || next > 2) return;
    this._lane = next;
  }

  // ── SPAWN ────────────────────────────────────────────────────────────
  _spawnObstacle() {
    const types = [
      { type:'car',    color:'#ff4757', w:28, h:44 },
      { type:'car',    color:'#ffa502', w:28, h:44 },
      { type:'barrel', color:'#2ed573', w:20, h:20 },
      { type:'oil',    color:'#747d8c', w:30, h:16 },
    ];
    const t = types[Math.floor(Math.random()*types.length)];
    const lane = Math.floor(Math.random()*3);
    this._obstacles.push({ ...t, x: this._laneX[lane], y: -60, hit: false, lane });
  }

  // ── DRAW HELPERS ─────────────────────────────────────────────────────
  _drawRoadBg(ctx, offset) {
    const W = 320, H = 480;
    // Sky
    const sky = ctx.createLinearGradient(0,0,0,H*0.35);
    sky.addColorStop(0,'#0a0015'); sky.addColorStop(1,'#1a0030');
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,H*0.35);
    // Neon horizon glow
    ctx.save();
    ctx.shadowColor='#ff00ff'; ctx.shadowBlur=30;
    ctx.strokeStyle='#ff00ff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(0,H*0.35); ctx.lineTo(W,H*0.35); ctx.stroke();
    ctx.restore();
    // Road
    ctx.fillStyle='#1a1a2e'; ctx.fillRect(0,H*0.35,W,H*0.65);
    // Kerb stripes left/right
    ctx.fillStyle='#e84393';
    for (let y=H*0.35-offset; y<H; y+=30) {
      ctx.fillRect(40,y,8,14);
      ctx.fillRect(272,y,8,14);
    }
    // Center dashes
    ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=2; ctx.setLineDash([20,20]);
    ctx.lineDashOffset = -offset;
    ctx.beginPath(); ctx.moveTo(160,H*0.35); ctx.lineTo(160,H); ctx.stroke();
    ctx.setLineDash([]);
    // Lane lines
    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; ctx.setLineDash([14,18]);
    ctx.lineDashOffset = -offset;
    [112,208].forEach(lx => {
      ctx.beginPath(); ctx.moveTo(lx,H*0.35); ctx.lineTo(lx,H); ctx.stroke();
    });
    ctx.setLineDash([]);
    // Neon road edge glow
    ctx.save();
    ctx.shadowColor='#00e5ff'; ctx.shadowBlur=12;
    ctx.strokeStyle='#00e5ff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(48,H*0.35); ctx.lineTo(48,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(272,H*0.35); ctx.lineTo(272,H); ctx.stroke();
    ctx.restore();
  }

  _drawCar(ctx, x, y, color, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    // Body
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-12, -22, 24, 44, 4);
    ctx.fill();
    // Windshield
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(-8, -16, 16, 10);
    // Wheels
    ctx.fillStyle = '#222';
    [[-14,-14],[14,-14],[-14,10],[14,10]].forEach(([wx,wy]) => {
      ctx.fillRect(wx-3, wy-4, 6, 8);
    });
    ctx.restore();
  }

  _drawObstacle(ctx, o) {
    ctx.save();
    ctx.globalAlpha = o.hit ? 0.3 : 1;
    ctx.shadowColor = o.color; ctx.shadowBlur = 10;
    ctx.fillStyle = o.color;
    if (o.type === 'car') {
      ctx.beginPath(); ctx.roundRect(o.x - o.w/2, o.y - o.h/2, o.w, o.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(o.x - o.w/2 + 3, o.y - o.h/2 + 6, o.w - 6, 10);
    } else if (o.type === 'barrel') {
      ctx.beginPath(); ctx.arc(o.x, o.y, 10, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(o.x, o.y, 15, 8, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // ── HUD ──────────────────────────────────────────────────────────────
  _updateHUD() {
    const d = document.getElementById('rr-dist');
    const s = document.getElementById('rr-speed');
    const l = document.getElementById('rr-lives');
    if (d) d.textContent = `${Math.floor(this._dist)} m`;
    if (s) s.textContent = `${Math.floor(this._speed * 20)} km/h`;
    if (l) l.textContent = '❤️'.repeat(Math.max(0,this._lives)) + '🖤'.repeat(Math.max(0,3-this._lives));
  }

  // ── END ──────────────────────────────────────────────────────────────
  _end() {
    if (this._ended) return;
    this._ended   = true;
    this._running = false;
    cancelAnimationFrame(this._raf);
    this._removeListeners();

    const dist = Math.floor(this._dist);
    // Gain formula: 0 m = 0×, 200 m = 1×, 500 m = 2×, 1000 m = 4×
    const mult = dist < 100  ? 0
               : dist < 300  ? 1
               : dist < 600  ? 1.5
               : dist < 1000 ? 2.5
               : 4;
    const gain = Math.round(this.bet * mult);
    const net  = gain - this.bet;
    const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';

    if (gain > 0) {
      this.credits += gain;
      this.onCreditsChange(this.credits);
    }

    document.dispatchEvent(new CustomEvent('roadrunner:result', {
      detail: { bet: this.bet, result, net, dist }
    }));

    this._msg(`${dist} m — ${net >= 0 ? '+' : ''}${net} C`, result);

    // Draw game over overlay on canvas
    const cv = document.getElementById('rr-canvas');
    if (cv) {
      const ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(0, 0, 320, 480);
      ctx.fillStyle = '#ff4757';
      ctx.font = 'bold 28px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', 160, 200);
      ctx.fillStyle = '#fff';
      ctx.font = '16px "Share Tech Mono", monospace';
      ctx.fillText(`${dist} m parcourus`, 160, 240);
      ctx.fillStyle = net >= 0 ? '#2ed573' : '#ff4757';
      ctx.fillText(`${net >= 0 ? '+' : ''}${net} Chronicles`, 160, 270);
    }

    const btn = document.getElementById('rr-start');
    if (btn) { btn.disabled = false; btn.textContent = '↺ REJOUER'; }
  }

  _quit() {
    this._running = false;
    this._ended   = true;
    cancelAnimationFrame(this._raf);
    this._removeListeners();
    document.dispatchEvent(new CustomEvent('roadrunner:back'));
  }

  _removeListeners() {
    if (this._keyDown) document.removeEventListener('keydown', this._keyDown);
    if (this._keyUp)   document.removeEventListener('keyup',   this._keyUp);
  }

  _msg(txt, type='') {
    const e = document.getElementById('rr-msg');
    if (!e) return;
    e.textContent = txt;
    e.className   = 'game-msg' + (type ? ` ${type}` : '');
  }
}
