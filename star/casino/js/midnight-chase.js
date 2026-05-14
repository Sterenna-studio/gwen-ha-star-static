/**
 * midnight-chase.js — STAR ARCADE v1.0
 * Endless runner horizontal · 3 lanes · sprites véhicules
 * Mise → distance × multiplicateur → gain Chronicles
 */
import { supabase } from '../../../js/supabase.js';

const VEHICLES = [
  {
    id: 'mash',
    name: 'MASH',
    type: 'MOTO',
    img: '../../../shared/images/vehicule/mash.png',
    speed:    4,   // vitesse scroll px/frame
    handling: 5,   // réactivité lane change (1-5)
    bonus:    'COMBO ×1.5',
    bonusKey: 'combo',
    color:    '#ff6eb4',
    stars:    [4,5],
    desc:     'Légère et agile. Le combo est multiplié par 1.5 à chaque powerup.'
  },
  {
    id: 'citroenAX',
    name: 'CITROËN AX',
    type: 'VOITURE',
    img: '../../../shared/images/vehicule/citroenAX.png',
    speed:    3,
    handling: 3,
    bonus:    'BOUCLIER ×2',
    bonusKey: 'shield',
    color:    '#00e5ff',
    stars:    [3,3],
    desc:     'Robuste et polyvalente. Les boucliers collectés durent deux fois plus longtemps.'
  },
  {
    id: 'barossa',
    name: 'BAROSSA',
    type: 'QUAD',
    img: '../../../shared/images/vehicule/barossa.png',
    speed:    5,
    handling: 2,
    bonus:    'GAIN ×2',
    bonusKey: 'gain',
    color:    '#ffcc00',
    stars:    [5,2],
    desc:     'Brute de vitesse. Le gain final est doublé mais la maniabilité est réduite.'
  }
];

const LANE_COUNT  = 3;
const GAME_H      = 300;    // hauteur canvas
const ROAD_TOP    = 60;
const ROAD_BOTTOM = GAME_H - 40;
const LANE_H      = (ROAD_BOTTOM - ROAD_TOP) / LANE_COUNT;
const LANE_CENTERS = Array.from({length:LANE_COUNT},(_,i) => ROAD_TOP + LANE_H * i + LANE_H/2);

const OBSTACLE_TYPES = [
  { type:'car',     emoji:'🚗', w:64, h:36, color:'#ff4757', pts:-1, prob:.5  },
  { type:'truck',   emoji:'🚛', w:80, h:44, color:'#ff6348', pts:-2, prob:.25 },
  { type:'barrier', emoji:'🚧', w:40, h:30, color:'#ffa502', pts:-1, prob:.15 },
  { type:'boost',   emoji:'⚡', w:30, h:30, color:'#00e5ff', pts:+3, prob:.1  },
];

const SFX = {
  _ctx:null,
  _g(){ if(!this._ctx) try{this._ctx=new(window.AudioContext||window.webkitAudioContext)();}catch{return null;} if(this._ctx.state==='suspended')this._ctx.resume(); return this._ctx; },
  _t(f,type,vol,atk,dec,t0){ const ctx=this._g();if(!ctx)return; const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g);g.connect(ctx.destination); o.type=type;o.frequency.setValueAtTime(f,t0??ctx.currentTime); g.gain.setValueAtTime(0,t0??ctx.currentTime); g.gain.linearRampToValueAtTime(vol,(t0??ctx.currentTime)+atk); g.gain.linearRampToValueAtTime(0,(t0??ctx.currentTime)+atk+dec); o.start(t0??ctx.currentTime);o.stop((t0??ctx.currentTime)+atk+dec+.01); },
  engine(speed){ const ctx=this._g();if(!ctx)return; const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sawtooth';o.frequency.value=80+speed*12; g.gain.value=.03; o.connect(g);g.connect(ctx.destination); o.start();o.stop(ctx.currentTime+.08); },
  hit()  { this._t(180,'sawtooth',.12,.003,.18); },
  boost(){ const ctx=this._g();if(!ctx)return; [880,1100,1320].forEach((f,i)=>this._t(f,'sine',.06,.005,.1,ctx.currentTime+i*.04)); },
  lane() { this._t(660,'sine',.04,.002,.05); },
  end()  { const ctx=this._g();if(!ctx)return; [330,280,220].forEach((f,i)=>this._t(f,'sawtooth',.08,.01,.2,ctx.currentTime+i*.1)); },
  start(){ const ctx=this._g();if(!ctx)return; [440,554,659,880].forEach((f,i)=>this._t(f,'triangle',.07,.005,.12,ctx.currentTime+i*.08)); },
  countdown(n){ this._t(n===0?880:440,'square',.07,.005,.1); },
};

export class MidnightChase {
  constructor(mountId, userId, credits, onCreditsChange) {
    this.mountId         = mountId;
    this.userId          = userId;
    this.credits         = credits;
    this.onCreditsChange = onCreditsChange;
    this.bet             = 10;
    this._raf            = null;
    this._running        = false;
    this._vehicle        = VEHICLES[0];
    this._phase          = 'select'; // select | ready | playing | dead
  }

  mount() {
    const root = document.getElementById(this.mountId);
    if (!root) return;
    root.innerHTML = `
      <div class="game-header">
        <button class="game-back-btn" id="chase-back">← LOBBY</button>
        <span class="game-title">MIDNIGHT <span class="game-title-accent" style="--game-accent:var(--c-amber)">CHASE</span></span>
      </div>
      <div id="chase-inner"></div>`;
    document.getElementById('chase-back')?.addEventListener('click', () => {
      this._stop();
      // signal retour au casino-core
      document.dispatchEvent(new CustomEvent('chase:back'));
    });
    this._renderSelect();
  }

  // ── VEHICLE SELECT ───────────────────────────────────────────
  _renderSelect() {
    this._phase = 'select';
    const root = document.getElementById('chase-inner');
    const presets = [1,5,10,25,50,100];
    root.innerHTML = `
      <div class="chase-select">
        <div class="chase-select-title">// CHOISIR TON VÉHICULE</div>
        <div class="chase-vehicles-grid" id="chase-vgrid">
          ${VEHICLES.map((v,i) => `
          <div class="chase-vcard ${i===0?'selected':''}" data-idx="${i}" style="--vc:${v.color}">
            <img src="${v.img}" alt="${v.name}" class="chase-vimg" loading="eager">
            <div class="chase-vname">${v.name}</div>
            <div class="chase-vtype">${v.type}</div>
            <div class="chase-vstars">
              <span class="chase-vstat-lbl">VITESSE</span>
              ${'★'.repeat(v.stars[0])}${'☆'.repeat(5-v.stars[0])}
            </div>
            <div class="chase-vstars">
              <span class="chase-vstat-lbl">MANIAB.</span>
              ${'★'.repeat(v.stars[1])}${'☆'.repeat(5-v.stars[1])}
            </div>
            <div class="chase-vbonus">${v.bonus}</div>
            <div class="chase-vdesc">${v.desc}</div>
          </div>`).join('')}
        </div>

        <div class="bet-panel">
          <span class="bet-label">MISE</span>
          <button class="bet-btn" id="chase-bet-down">−</button>
          <span class="bet-val" id="chase-bet-val">${this.bet}</span>
          <button class="bet-btn" id="chase-bet-up">+</button>
          <div class="bet-presets">
            ${presets.map(p=>`<button class="bet-preset${this.bet===p?' active':''}" data-preset="${p}">${p}</button>`).join('')}
          </div>
        </div>

        <div class="chase-how">
          <div class="chase-how-title">⚡ COMMENT JOUER</div>
          <div class="chase-how-grid">
            <div class="chase-how-block"><span>⬆⬇</span><span>Changer de voie (flèches ou swipe)</span></div>
            <div class="chase-how-block"><span>🚗</span><span>Évite les véhicules et barrières</span></div>
            <div class="chase-how-block"><span>⚡</span><span>Collecte les boosts pour +points</span></div>
            <div class="chase-how-block"><span>💰</span><span>Gain = mise × distance / 100</span></div>
          </div>
        </div>

        <div class="action-row">
          <button class="action-btn primary" id="chase-start">▶ DÉMARRER</button>
        </div>
      </div>`;

    // Vehicle selection
    document.getElementById('chase-vgrid')?.querySelectorAll('.chase-vcard').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.chase-vcard').forEach(c=>c.classList.remove('selected'));
        card.classList.add('selected');
        this._vehicle = VEHICLES[parseInt(card.dataset.idx)];
        SFX.lane();
      });
    });

    // Bet panel
    const updBet = () => {
      const v = document.getElementById('chase-bet-val');
      if (v) v.textContent = this.bet;
      document.querySelectorAll('.bet-preset').forEach(b => b.classList.toggle('active', Number(b.dataset.preset) === this.bet));
    };
    document.getElementById('chase-bet-down')?.addEventListener('click', () => { SFX.lane(); this.bet=Math.max(1,this.bet-(this.bet>10?5:1)); updBet(); });
    document.getElementById('chase-bet-up')?.addEventListener('click',   () => { SFX.lane(); this.bet=Math.min(this.credits,this.bet+(this.bet>=10?5:1)); updBet(); });
    document.querySelectorAll('.bet-preset').forEach(b =>
      b.addEventListener('click', () => { SFX.lane(); this.bet=Math.min(this.credits,Number(b.dataset.preset)); updBet(); })
    );

    document.getElementById('chase-start')?.addEventListener('click', () => this._launchGame());
  }

  // ── GAME LAUNCH ───────────────────────────────────────────────
  async _launchGame() {
    if (this.credits < this.bet) {
      this._showMsg('CRÉDITS INSUFFISANTS', 'lose'); return;
    }
    this.credits -= this.bet;
    this.onCreditsChange(this.credits);

    const root = document.getElementById('chase-inner');
    root.innerHTML = `
      <div class="chase-arena" id="chase-arena">
        <canvas id="chase-canvas" width="800" height="${GAME_H}"></canvas>
        <div class="chase-hud">
          <div class="chase-hud-block"><span class="chase-hud-lbl">DIST.</span><span class="chase-hud-val" id="ch-dist">0</span><span class="chase-hud-unit">m</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">SCORE</span><span class="chase-hud-val" id="ch-score">0</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">COMBO</span><span class="chase-hud-val" id="ch-combo">×1</span></div>
          <div class="chase-hud-block" id="ch-shield-block" style="display:none"><span class="chase-hud-lbl">🛡</span><span class="chase-hud-val" id="ch-shield">0</span></div>
          <div class="chase-hud-block" style="margin-left:auto">
            <img src="${this._vehicle.img}" alt="${this._vehicle.name}" style="height:36px;filter:drop-shadow(0 0 8px ${this._vehicle.color})">
          </div>
        </div>
      </div>`;

    await this._countdown();
    this._startLoop();
  }

  async _countdown() {
    const arena = document.getElementById('chase-arena');
    for (const txt of ['3','2','1','GO!']) {
      SFX.countdown(txt==='GO!'?0:1);
      const d = document.createElement('div'); d.className='wam-countdown'; d.textContent=txt;
      arena.appendChild(d); await new Promise(r=>setTimeout(r,650)); d.remove();
    }
    SFX.start();
  }

  // ── GAME LOOP ─────────────────────────────────────────────────
  _startLoop() {
    this._running   = true;
    this._phase     = 'playing';
    this._lane      = 1;       // current lane 0-2
    this._targetY   = LANE_CENTERS[1];
    this._playerY   = LANE_CENTERS[1];
    this._playerX   = 100;
    this._scrollSpd = this._vehicle.speed;
    this._dist      = 0;
    this._score     = 0;
    this._combo     = 1;
    this._shield    = 0;
    this._obstacles = [];
    this._particles = [];
    this._roadOffset = 0;
    this._spawnTimer = 0;
    this._t0        = performance.now();
    this._lastT     = this._t0;
    this._laneChangeCooldown = 0;

    // Preload vehicle image
    this._vImg = new Image();
    this._vImg.src = this._vehicle.img;

    // Controls
    this._onKey = (e) => {
      if (e.key==='ArrowUp'||e.key==='ArrowLeft')   this._changeLane(-1);
      if (e.key==='ArrowDown'||e.key==='ArrowRight') this._changeLane(+1);
    };
    window.addEventListener('keydown', this._onKey);

    // Touch/swipe
    this._touchY = null;
    this._onTouchStart = (e) => { this._touchY = e.touches[0].clientY; };
    this._onTouchEnd   = (e) => {
      if (this._touchY === null) return;
      const dy = e.changedTouches[0].clientY - this._touchY;
      if (Math.abs(dy) > 30) this._changeLane(dy > 0 ? 1 : -1);
      this._touchY = null;
    };
    const canvas = document.getElementById('chase-canvas');
    canvas?.addEventListener('touchstart', this._onTouchStart, {passive:true});
    canvas?.addEventListener('touchend',   this._onTouchEnd,   {passive:true});

    this._raf = requestAnimationFrame(t => this._frame(t));
  }

  _frame(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this._lastT) / 16.67, 3); // normalize to 60fps
    this._lastT = ts;

    // Update
    this._dist      += this._scrollSpd * dt * 0.5;
    this._scrollSpd += 0.002 * dt;  // accélération progressive
    this._roadOffset = (this._roadOffset + this._scrollSpd * dt * 2) % 80;
    if (this._shield > 0) this._shield -= dt / 60;
    if (this._laneChangeCooldown > 0) this._laneChangeCooldown -= dt;

    // Smooth lane change
    const dy = this._targetY - this._playerY;
    const lerpSpd = 0.15 * this._vehicle.handling;
    this._playerY += dy * Math.min(lerpSpd * dt, 1);

    // Spawn obstacles
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnObstacle();
      this._spawnTimer = Math.max(30, 90 - this._dist / 50);
    }

    // Move obstacles
    this._obstacles.forEach(o => { o.x -= (this._scrollSpd + o.spd) * dt; });
    this._obstacles = this._obstacles.filter(o => o.x > -100);

    // Particles
    this._particles.forEach(p => { p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; p.r=Math.max(0,p.r-.1*dt); });
    this._particles = this._particles.filter(p => p.life > 0);

    // Collision
    this._checkCollisions();

    // Draw
    this._draw();
    this._updateHUD();

    this._raf = requestAnimationFrame(t => this._frame(t));
  }

  _changeLane(dir) {
    if (this._laneChangeCooldown > 0) return;
    const newLane = Math.max(0, Math.min(LANE_COUNT-1, this._lane + dir));
    if (newLane === this._lane) return;
    this._lane = newLane;
    this._targetY = LANE_CENTERS[this._lane];
    this._laneChangeCooldown = 8 * (6 - this._vehicle.handling); // moins réactif si handling bas
    SFX.lane();
  }

  _spawnObstacle() {
    const r = Math.random(); let cum = 0;
    let type = OBSTACLE_TYPES[0];
    for (const t of OBSTACLE_TYPES) { cum += t.prob; if (r < cum) { type = t; break; } }
    const lane = Math.floor(Math.random() * LANE_COUNT);
    this._obstacles.push({
      ...type,
      x: 820 + Math.random() * 200,
      y: LANE_CENTERS[lane],
      lane,
      spd: Math.random() * 1.5,
    });
  }

  _checkCollisions() {
    const px = this._playerX, py = this._playerY;
    const pw = 70, ph = 34;
    for (let i = this._obstacles.length - 1; i >= 0; i--) {
      const o = this._obstacles[i];
      const dx = Math.abs(o.x - px), dy = Math.abs(o.y - py);
      if (dx < (pw/2 + o.w/2) * .7 && dy < (ph/2 + o.h/2) * .7) {
        this._obstacles.splice(i, 1);
        if (o.type === 'boost') {
          SFX.boost();
          this._score += 3 * this._combo;
          this._combo = Math.min(8, this._combo + 1);
          if (this._vehicle.bonusKey === 'combo') this._combo = Math.min(16, this._combo);
          if (this._vehicle.bonusKey === 'shield') this._shield = Math.max(this._shield, 180);
          this._spawnParticles(px, py, '#00e5ff', 8);
        } else {
          if (this._shield > 0) {
            this._shield = 0;
            this._spawnParticles(px, py, '#00e5ff', 6);
          } else {
            SFX.hit();
            this._combo = 1;
            this._spawnParticles(px, py, '#ff4757', 10);
            this._stop();
            this._gameOver();
            return;
          }
        }
      }
    }
  }

  _spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      this._particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, r: 4+Math.random()*4, color, life: 20+Math.random()*20 });
    }
  }

  // ── DRAW ──────────────────────────────────────────────────────
  _draw() {
    const canvas = document.getElementById('chase-canvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    sky.addColorStop(0, '#07080c');
    sky.addColorStop(1, '#0d0f1a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, ROAD_TOP);

    // Neon city horizon line
    ctx.strokeStyle = 'rgba(0,229,255,.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ROAD_TOP); ctx.lineTo(W, ROAD_TOP); ctx.stroke();
    // Distant city glow
    const cityGrad = ctx.createRadialGradient(W/2, ROAD_TOP, 0, W/2, ROAD_TOP, 300);
    cityGrad.addColorStop(0, 'rgba(0,229,255,.06)');
    cityGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = cityGrad; ctx.fillRect(0, 0, W, ROAD_TOP + 20);

    // Road
    const roadGrad = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
    roadGrad.addColorStop(0, '#1a1d2e');
    roadGrad.addColorStop(1, '#0d0f18');
    ctx.fillStyle = roadGrad; ctx.fillRect(0, ROAD_TOP, W, ROAD_BOTTOM - ROAD_TOP);

    // Lane dividers (dashed, scrolling)
    ctx.setLineDash([24, 20]);
    ctx.lineDashOffset = -this._roadOffset;
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
    for (let i = 1; i < LANE_COUNT; i++) {
      const y = ROAD_TOP + LANE_H * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Road borders neon
    ctx.strokeStyle = `${this._vehicle.color}40`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, ROAD_TOP); ctx.lineTo(W, ROAD_TOP); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ROAD_BOTTOM); ctx.lineTo(W, ROAD_BOTTOM); ctx.stroke();

    // Ground below road
    ctx.fillStyle = '#07080c'; ctx.fillRect(0, ROAD_BOTTOM, W, H - ROAD_BOTTOM);

    // Obstacles
    this._obstacles.forEach(o => {
      ctx.save();
      ctx.shadowColor = o.color; ctx.shadowBlur = 10;
      ctx.font = `${o.h}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.emoji, o.x, o.y);
      ctx.restore();
    });

    // Particles
    this._particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 15);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });

    // Player vehicle
    ctx.save();
    if (this._shield > 0) {
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 20;
      // Shield bubble
      ctx.strokeStyle = 'rgba(0,229,255,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this._playerX, this._playerY, 50, 28, 0, 0, Math.PI*2); ctx.stroke();
    } else {
      ctx.shadowColor = this._vehicle.color; ctx.shadowBlur = 12;
    }
    if (this._vImg.complete && this._vImg.naturalWidth > 0) {
      const ratio = this._vImg.naturalWidth / this._vImg.naturalHeight;
      const h = 48, w = h * ratio;
      ctx.drawImage(this._vImg, this._playerX - w/2, this._playerY - h/2, w, h);
    } else {
      ctx.font = '36px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🚗', this._playerX, this._playerY);
    }
    ctx.restore();

    // Speed lines (parallax effect)
    if (this._scrollSpd > 5) {
      ctx.save(); ctx.globalAlpha = (this._scrollSpd - 5) / 20;
      ctx.strokeStyle = this._vehicle.color; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = ROAD_TOP + Math.random() * (ROAD_BOTTOM - ROAD_TOP);
        const len = 20 + Math.random() * 40;
        ctx.beginPath(); ctx.moveTo(this._playerX + 40, y); ctx.lineTo(this._playerX + 40 + len, y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  _updateHUD() {
    const d = document.getElementById('ch-dist');
    const s = document.getElementById('ch-score');
    const c = document.getElementById('ch-combo');
    const sh = document.getElementById('ch-shield');
    const shb = document.getElementById('ch-shield-block');
    if (d) d.textContent = Math.floor(this._dist);
    if (s) s.textContent = this._score;
    if (c) c.textContent = `×${this._combo}`;
    if (sh && shb) {
      shb.style.display = this._shield > 0 ? '' : 'none';
      sh.textContent = Math.ceil(this._shield / 60) + 's';
    }
  }

  // ── GAME OVER ─────────────────────────────────────────────────
  async _gameOver() {
    SFX.end();
    const dist  = Math.floor(this._dist);
    let gain    = Math.round(this.bet * dist / 100);
    if (this._vehicle.bonusKey === 'gain') gain *= 2;
    const net   = gain - this.bet;
    const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';

    this.credits += gain;
    this.onCreditsChange(this.credits);

    // Save to Supabase
    if (this.userId) {
      try { await supabase.from('profiles').update({ chronicles: this.credits }).eq('id', this.userId); } catch {}
    }

    const arena = document.getElementById('chase-arena');
    if (!arena) return;
    const netTxt = net >= 0 ? `<span style="color:var(--c-green)">+${net} C</span>` : `<span style="color:var(--c-red)">${net} C</span>`;
    const res = document.createElement('div'); res.className = 'wam-result-screen';
    res.innerHTML = `
      <div class="wam-result-title">GAME OVER</div>
      <div class="wam-result-score">${dist} m</div>
      <div class="wam-result-gain">MISE ${this.bet} C → GAIN <strong>${gain} C</strong> ${netTxt}</div>
      <div style="font-size:11px;letter-spacing:.12em;color:var(--c-text-faint)">SCORE : ${this._score} · COMBO MAX : ×${this._combo}</div>
      <button class="action-btn primary" id="chase-retry" style="margin-top:16px">↺ REJOUER</button>`;
    arena.appendChild(res);
    document.getElementById('chase-retry')?.addEventListener('click', () => {
      res.remove();
      this._renderSelect();
    });
    // Dispatch to casino-core history
    document.dispatchEvent(new CustomEvent('chase:result', { detail: { bet: this.bet, result, net } }));
  }

  _stop() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    window.removeEventListener('keydown', this._onKey);
  }

  _showMsg(txt, type) {
    const root = document.getElementById('chase-inner');
    if (!root) return;
    const d = document.createElement('div');
    d.className = `game-msg ${type}`; d.textContent = txt;
    d.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10';
    root.appendChild(d); setTimeout(() => d.remove(), 2000);
  }
}
