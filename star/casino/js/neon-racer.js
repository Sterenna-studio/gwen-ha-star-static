/**
 * neon-racer.js — STAR ARCADE  JEU 04  v1.0
 * Fusion Midnight Chase (horizontal) + Road Runner (vertical)
 * Les axes alternent à chaque checkpoint (500 m / 500 pts).
 * Mise = coeurs choisis : 1❤ = 50 C · 2❤ = 100 C · 3❤ = 200 C
 * Un véhicule a autant de vies que de coeurs misés.
 * Dispatche  neon-racer:result  sur document à la fin.
 */
import { supabase } from '../../../js/supabase.js';

// ── VÉHICULES ─────────────────────────────────────────────────────────
const VEHICLES = [
  {
    id:'mash', name:'MASH', type:'MOTO',
    img:'../../../shared/images/vehicule/mash.png',
    speed:4, handling:5,
    bonus:'COMBO ×1.5', bonusKey:'combo',
    color:'#ff6eb4', stars:[4,5],
    desc:'Légère et agile. Combo multiplié ×1.5 à chaque boost.'
  },
  {
    id:'citroenAX', name:'CITROËN AX', type:'VOITURE',
    img:'../../../shared/images/vehicule/citroenAX.png',
    speed:3, handling:3,
    bonus:'BOUCLIER ×2', bonusKey:'shield',
    color:'#00e5ff', stars:[3,3],
    desc:'Robuste. Les boucliers collectés durent deux fois plus longtemps.'
  },
  {
    id:'barossa', name:'BAROSSA', type:'QUAD',
    img:'../../../shared/images/vehicule/barossa.png',
    speed:5, handling:2,
    bonus:'GAIN ×2', bonusKey:'gain',
    color:'#ffcc00', stars:[5,2],
    desc:'Brute de vitesse. Le gain final est doublé mais la maniabilité est réduite.'
  }
];

// ── COÛTS COEURS ──────────────────────────────────────────────────────
const HEART_COSTS = [50, 100, 200];   // index 0=1❤  1=2❤  2=3❤

// ── CANVAS DIMS ───────────────────────────────────────────────────────
const CW = 800, CH = 320;
// Horizontal (Chase) road zone
const H_ROAD_TOP    = 60;
const H_ROAD_BOTTOM = CH - 40;
const H_LANE_COUNT  = 3;
const H_LANE_H      = (H_ROAD_BOTTOM - H_ROAD_TOP) / H_LANE_COUNT;
const H_LANE_Y      = Array.from({length:H_LANE_COUNT},(_,i)=>H_ROAD_TOP+H_LANE_H*i+H_LANE_H/2);
// Vertical (Runner) road zone — full canvas width split into 3 lanes
const V_LANE_COUNT  = 3;
const V_MARGIN      = 60;
const V_LANE_W      = (CW - V_MARGIN*2) / V_LANE_COUNT;
const V_LANE_X      = Array.from({length:V_LANE_COUNT},(_,i)=>V_MARGIN+V_LANE_W*i+V_LANE_W/2);
const V_PLAYER_Y    = CH - 72;

// ── OBSTACLES ─────────────────────────────────────────────────────────
const H_OBSTACLES = [
  {type:'car',     emoji:'🚗', w:64,h:36,color:'#ff4757',harm:true, prob:.45},
  {type:'truck',   emoji:'🚛', w:80,h:44,color:'#ff6348',harm:true, prob:.25},
  {type:'barrier', emoji:'🚧', w:40,h:30,color:'#ffa502',harm:true, prob:.15},
  {type:'boost',   emoji:'⚡', w:30,h:30,color:'#00e5ff',harm:false,prob:.15},
];
const V_OBSTACLES = [
  {type:'rock',   emoji:'🪨', w:38,h:34,harm:true, pts:0,  prob:.40},
  {type:'cactus', emoji:'🌵', w:28,h:42,harm:true, pts:0,  prob:.28},
  {type:'bomb',   emoji:'💣', w:32,h:32,harm:true, pts:0,  prob:.15},
  {type:'star',   emoji:'⭐', w:30,h:30,harm:false,pts:50, prob:.10},
  {type:'coin',   emoji:'🪙', w:26,h:26,harm:false,pts:20, prob:.07},
];

const CHECKPOINT_DIST = 500;  // unités avant bascule d'axe

// ── SFX ───────────────────────────────────────────────────────────────
const SFX = {
  _ctx:null,
  _g(){ if(!this._ctx)try{this._ctx=new(window.AudioContext||window.webkitAudioContext)();}catch{return null;} if(this._ctx.state==='suspended')this._ctx.resume();return this._ctx; },
  _t(f,type,vol,atk,dec,t0){const ctx=this._g();if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type=type;o.frequency.setValueAtTime(f,t0??ctx.currentTime);g.gain.setValueAtTime(0,t0??ctx.currentTime);g.gain.linearRampToValueAtTime(vol,(t0??ctx.currentTime)+atk);g.gain.linearRampToValueAtTime(0,(t0??ctx.currentTime)+atk+dec);o.start(t0??ctx.currentTime);o.stop((t0??ctx.currentTime)+atk+dec+.01);},
  hit()   {this._t(180,'sawtooth',.12,.003,.18);},
  boost() {const ctx=this._g();if(!ctx)return;[880,1100,1320].forEach((f,i)=>this._t(f,'sine',.06,.005,.1,ctx.currentTime+i*.04));},
  lane()  {this._t(660,'sine',.04,.002,.05);},
  end()   {const ctx=this._g();if(!ctx)return;[330,280,220].forEach((f,i)=>this._t(f,'sawtooth',.08,.01,.2,ctx.currentTime+i*.1));},
  start() {const ctx=this._g();if(!ctx)return;[440,554,659,880].forEach((f,i)=>this._t(f,'triangle',.07,.005,.12,ctx.currentTime+i*.08));},
  checkpoint(){const ctx=this._g();if(!ctx)return;[660,880,1100,1320].forEach((f,i)=>this._t(f,'sine',.09,.005,.14,ctx.currentTime+i*.06));},
  loseLife(){const ctx=this._g();if(!ctx)return;[300,240,180].forEach((f,i)=>this._t(f,'sawtooth',.1,.005,.22,ctx.currentTime+i*.09));},
  countdown(n){this._t(n===0?880:440,'square',.07,.005,.1);},
};

export class NeonRacer {
  /**
   * @param {string}   mountId
   * @param {string}   userId
   * @param {number}   credits
   * @param {function} onCreditsChange
   */
  constructor(mountId, userId, credits, onCreditsChange) {
    this.mountId         = mountId;
    this.userId          = userId;
    this.credits         = credits;
    this.onCreditsChange = onCreditsChange;
    this._raf            = null;
    this._running        = false;
    this._vehicle        = VEHICLES[0];
    this._heartIdx       = 0;    // 0=1❤ 1=2❤ 2=3❤
    this._bet            = HEART_COSTS[0];
    this._phase          = 'select';
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
      this._stop();
      document.dispatchEvent(new CustomEvent('neon-racer:back'));
    });
    this._renderSelect();
  }

  // ── SELECT ─────────────────────────────────────────────────────────
  _renderSelect() {
    this._phase = 'select';
    const root  = document.getElementById('nr-inner');
    root.innerHTML = `
      <div class="chase-select">
        <div class="chase-select-title">// CHOISIR TON VÉHICULE</div>
        <div class="chase-vehicles-grid" id="nr-vgrid">
          ${VEHICLES.map((v,i)=>`
          <div class="chase-vcard ${i===0?'selected':''}" data-idx="${i}" style="--vc:${v.color}">
            <img src="${v.img}" alt="${v.name}" class="chase-vimg" loading="eager">
            <div class="chase-vname">${v.name}</div>
            <div class="chase-vtype">${v.type}</div>
            <div class="chase-vstars"><span class="chase-vstat-lbl">VITESSE</span>${'★'.repeat(v.stars[0])}${'☆'.repeat(5-v.stars[0])}</div>
            <div class="chase-vstars"><span class="chase-vstat-lbl">MANIAB.</span>${'★'.repeat(v.stars[1])}${'☆'.repeat(5-v.stars[1])}</div>
            <div class="chase-vbonus">${v.bonus}</div>
            <div class="chase-vdesc">${v.desc}</div>
          </div>`).join('')}
        </div>

        <div class="nr-hearts-panel">
          <div class="nr-hearts-title">MISE — CHOISIR TES COEURS</div>
          <div class="nr-hearts-row" id="nr-hearts-row">
            ${HEART_COSTS.map((c,i)=>`
            <button class="nr-heart-btn ${i===0?'active':''}" data-idx="${i}">
              ${'❤️'.repeat(i+1)}
              <span class="nr-heart-cost">${c} C</span>
              <span class="nr-heart-lives">${i+1} vie${i>0?'s':''}</span>
            </button>`).join('')}
          </div>
          <div class="nr-hearts-hint" id="nr-hearts-hint">Mise : <strong>50 C</strong> · 1 vie · 1 crash = game over</div>
        </div>

        <div class="chase-how">
          <div class="chase-how-title">⚡ COMMENT JOUER</div>
          <div class="chase-how-grid">
            <div class="chase-how-block"><span>↔</span><span>Axe horizontal : ↑↓ pour changer de voie</span></div>
            <div class="chase-how-block"><span>↕</span><span>Axe vertical : ←→ pour changer de voie</span></div>
            <div class="chase-how-block"><span>🏁</span><span>Tous les 500m l'axe bascule</span></div>
            <div class="chase-how-block"><span>❤️</span><span>Chaque crash coûte 1 vie — 0 vie = fin</span></div>
            <div class="chase-how-block"><span>⚡⭐</span><span>Boosts et étoiles = score bonus</span></div>
            <div class="chase-how-block"><span>💰</span><span>Gain = mise × distance / 150</span></div>
          </div>
        </div>

        <div class="action-row">
          <button class="action-btn primary" id="nr-start">▶ DÉMARRER</button>
        </div>
      </div>`;

    // Vehicle selection
    document.getElementById('nr-vgrid')?.querySelectorAll('.chase-vcard').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.chase-vcard').forEach(c=>c.classList.remove('selected'));
        card.classList.add('selected');
        this._vehicle = VEHICLES[parseInt(card.dataset.idx)];
        SFX.lane();
      });
    });

    // Heart selection
    document.getElementById('nr-hearts-row')?.querySelectorAll('.nr-heart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nr-heart-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        this._heartIdx = parseInt(btn.dataset.idx);
        this._bet = HEART_COSTS[this._heartIdx];
        const lives = this._heartIdx + 1;
        document.getElementById('nr-hearts-hint').innerHTML =
          `Mise : <strong>${this._bet} C</strong> · ${lives} vie${lives>1?'s':''} · ${lives} crash${lives>1?'s':''} toléré${lives>1?'s':''}`;
        SFX.lane();
      });
    });

    document.getElementById('nr-start')?.addEventListener('click', () => this._launchGame());
  }

  // ── LAUNCH ─────────────────────────────────────────────────────────
  async _launchGame() {
    if (this.credits < this._bet) {
      this._flashMsg('CRÉDITS INSUFFISANTS'); return;
    }
    this.credits -= this._bet;
    this.onCreditsChange(this.credits);
    if (this.userId) {
      try { await supabase.from('profiles').update({chronicles:this.credits}).eq('id',this.userId); } catch {}
    }

    const root = document.getElementById('nr-inner');
    root.innerHTML = `
      <div class="chase-arena" id="nr-arena">
        <canvas id="nr-canvas" width="${CW}" height="${CH}" style="width:100%;height:auto;display:block"></canvas>
        <div class="chase-hud" id="nr-hud">
          <div class="chase-hud-block"><span class="chase-hud-lbl">DIST.</span><span class="chase-hud-val" id="nr-dist">0</span><span class="chase-hud-unit">m</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">SCORE</span><span class="chase-hud-val" id="nr-score">0</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">VIES</span><span class="chase-hud-val" id="nr-lives">❤️</span></div>
          <div class="chase-hud-block" id="nr-axis-block"><span class="chase-hud-lbl">AXE</span><span class="chase-hud-val" id="nr-axis">↔</span></div>
          <div class="chase-hud-block" id="nr-next-block"><span class="chase-hud-lbl">NEXT</span><span class="chase-hud-val" id="nr-next">500m</span></div>
        </div>
        <div id="nr-axis-flash" class="nr-axis-flash" style="display:none"></div>
      </div>`;

    await this._countdown();
    this._startLoop();
  }

  async _countdown() {
    const arena = document.getElementById('nr-arena');
    for (const txt of ['3','2','1','GO!']) {
      SFX.countdown(txt==='GO!'?0:1);
      const d = document.createElement('div'); d.className='wam-countdown'; d.textContent=txt;
      arena.appendChild(d); await new Promise(r=>setTimeout(r,650)); d.remove();
    }
    SFX.start();
  }

  // ── GAME LOOP ──────────────────────────────────────────────────────
  _startLoop() {
    this._running     = true;
    this._phase       = 'playing';
    this._axis        = 'H';    // 'H' horizontal | 'V' vertical
    this._checkpointN = 1;      // prochain checkpoint
    this._dist        = 0;
    this._score       = 0;
    this._lives       = this._heartIdx + 1;
    this._combo       = 1;
    this._shield      = 0;
    this._invincible  = 0;
    this._scrollSpd   = this._vehicle.speed;
    this._bgOff       = 0;
    this._obstacles   = [];
    this._particles   = [];
    this._spawnTimer  = 0;
    this._lastT       = performance.now();
    this._axisTransition = false;

    // H-axis player
    this._hLane    = 1;
    this._hTargetY = H_LANE_Y[1];
    this._hPlayerY = H_LANE_Y[1];
    this._hPlayerX = 100;
    this._hCooldown= 0;

    // V-axis player
    this._vLane    = 1;
    this._vPlayerX = V_LANE_X[1];
    this._vCooldown= 0;

    // Vehicle image
    this._vImg = new Image(); this._vImg.src = this._vehicle.img;

    // Controls
    this._onKey = (e) => {
      if (this._axis === 'H') {
        if (e.key==='ArrowUp'  ||e.key==='w') this._hChangeLane(-1);
        if (e.key==='ArrowDown'||e.key==='s') this._hChangeLane(+1);
      } else {
        if (e.key==='ArrowLeft' ||e.key==='a') this._vChangeLane(-1);
        if (e.key==='ArrowRight'||e.key==='d') this._vChangeLane(+1);
      }
    };
    window.addEventListener('keydown', this._onKey);

    this._touchStart = null;
    this._onTouchS = (e)=>{ this._touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}; };
    this._onTouchE = (e)=>{
      if(!this._touchStart)return;
      const dx=e.changedTouches[0].clientX-this._touchStart.x;
      const dy=e.changedTouches[0].clientY-this._touchStart.y;
      if(this._axis==='H'){ if(Math.abs(dy)>30) this._hChangeLane(dy>0?1:-1); }
      else                 { if(Math.abs(dx)>30) this._vChangeLane(dx>0?1:-1); }
      this._touchStart=null;
    };
    const cv = document.getElementById('nr-canvas');
    cv?.addEventListener('touchstart',this._onTouchS,{passive:true});
    cv?.addEventListener('touchend',  this._onTouchE,{passive:true});

    this._raf = requestAnimationFrame(t=>this._frame(t));
  }

  _frame(ts) {
    if (!this._running) return;
    const dt = Math.min((ts-this._lastT)/16.67, 3);
    this._lastT = ts;

    // Progress
    this._dist      += this._scrollSpd * dt * 0.5;
    this._scrollSpd += 0.002 * dt;
    this._bgOff      = (this._bgOff + this._scrollSpd*dt*2) % 80;
    if (this._shield>0)     this._shield     -= dt/60;
    if (this._invincible>0) this._invincible -= dt;
    if (this._hCooldown>0)  this._hCooldown  -= dt;
    if (this._vCooldown>0)  this._vCooldown  -= dt;

    // Checkpoint check
    if (this._dist >= this._checkpointN * CHECKPOINT_DIST && !this._axisTransition) {
      this._checkpointN++;
      this._triggerAxisSwitch();
    }

    // H axis: smooth lane lerp
    if (this._axis === 'H') {
      const dy = this._hTargetY - this._hPlayerY;
      this._hPlayerY += dy * Math.min(0.15*this._vehicle.handling*dt, 1);
    }

    // Spawn
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnObstacle();
      this._spawnTimer = Math.max(28, 85 - this._scrollSpd*4);
    }

    // Move obstacles
    if (this._axis==='H') {
      this._obstacles.forEach(o=>{ o.x -= (this._scrollSpd+o.spd)*dt; });
      this._obstacles = this._obstacles.filter(o=>o.x>-100);
    } else {
      this._obstacles.forEach(o=>{ o.y += this._scrollSpd*dt; });
      this._obstacles = this._obstacles.filter(o=>o.y<CH+60);
    }

    // Particles
    this._particles.forEach(p=>{ p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.r=Math.max(0,p.r-.1*dt); });
    this._particles = this._particles.filter(p=>p.life>0);

    // Collision
    this._checkCollisions();

    // Score: 1pt per 4 frames survived in V mode
    if (this._axis==='V') this._score += 0.02*dt;

    this._draw();
    this._updateHUD();
    this._raf = requestAnimationFrame(t=>this._frame(t));
  }

  // ── AXIS SWITCH ────────────────────────────────────────────────────
  _triggerAxisSwitch() {
    this._axisTransition = true;
    SFX.checkpoint();
    this._obstacles = [];
    const flash = document.getElementById('nr-axis-flash');
    const newAxis = this._axis==='H'?'V':'H';
    if (flash) {
      flash.textContent = newAxis==='H' ? '↔ AXE HORIZONTAL' : '↕ AXE VERTICAL';
      flash.style.display = '';
      flash.classList.add('visible');
      setTimeout(()=>{ flash.classList.remove('visible'); setTimeout(()=>{ flash.style.display='none'; this._axisTransition=false; },400); }, 900);
    }
    this._axis = newAxis;
    // Reset lane positions
    if (newAxis==='H') { this._hLane=1; this._hTargetY=H_LANE_Y[1]; this._hPlayerY=H_LANE_Y[1]; }
    else               { this._vLane=1; this._vPlayerX=V_LANE_X[1]; }
  }

  // ── LANE CHANGES ───────────────────────────────────────────────────
  _hChangeLane(dir) {
    if (this._hCooldown>0) return;
    const n = Math.max(0,Math.min(H_LANE_COUNT-1,this._hLane+dir));
    if (n===this._hLane) return;
    this._hLane=n; this._hTargetY=H_LANE_Y[n];
    this._hCooldown = 8*(6-this._vehicle.handling);
    SFX.lane();
  }
  _vChangeLane(dir) {
    if (this._vCooldown>0) return;
    const n = Math.max(0,Math.min(V_LANE_COUNT-1,this._vLane+dir));
    if (n===this._vLane) return;
    this._vLane=n; this._vPlayerX=V_LANE_X[n];
    this._vCooldown = 8*(6-this._vehicle.handling);
    SFX.lane();
  }

  // ── SPAWN ──────────────────────────────────────────────────────────
  _spawnObstacle() {
    if (this._axisTransition) return;
    const pool = this._axis==='H' ? H_OBSTACLES : V_OBSTACLES;
    const r=Math.random(); let cum=0; let picked=pool[0];
    for(const t of pool){ cum+=t.prob; if(r<cum){picked=t;break;} }
    if (this._axis==='H') {
      const lane=Math.floor(Math.random()*H_LANE_COUNT);
      this._obstacles.push({...picked,x:CW+80+Math.random()*200,y:H_LANE_Y[lane],lane,spd:Math.random()*1.5});
    } else {
      const lane=Math.floor(Math.random()*V_LANE_COUNT);
      this._obstacles.push({...picked,x:V_LANE_X[lane],y:-60,lane,spd:0});
    }
  }

  // ── COLLISION ──────────────────────────────────────────────────────
  _checkCollisions() {
    if (this._invincible>0) return;
    const HIT=24;
    const px = this._axis==='H' ? this._hPlayerX : this._vPlayerX;
    const py = this._axis==='H' ? this._hPlayerY : V_PLAYER_Y;

    for (let i=this._obstacles.length-1;i>=0;i--) {
      const o=this._obstacles[i];
      const ox = this._axis==='H' ? o.x : o.x;
      const oy = this._axis==='H' ? o.y : o.y;
      const dx=Math.abs(ox-px), dy=Math.abs(oy-py);
      const hit = this._axis==='H'
        ? dx<(35+o.w/2)*.7 && dy<(17+o.h/2)*.7
        : dx<HIT && dy<HIT;
      if (!hit) continue;
      this._obstacles.splice(i,1);
      if (!o.harm) {
        // Collect bonus
        SFX.boost();
        const pts = o.pts ?? 3;
        this._score += pts*this._combo;
        this._combo = Math.min(8,this._combo+1);
        if (this._vehicle.bonusKey==='combo') this._combo=Math.min(16,this._combo);
        if (this._vehicle.bonusKey==='shield') this._shield=Math.max(this._shield,180);
        this._spawnParticles(px,py,'#00e5ff',8);
      } else {
        if (this._shield>0) {
          this._shield=0;
          this._spawnParticles(px,py,'#00e5ff',6);
        } else {
          SFX.loseLife();
          this._lives = Math.max(0,this._lives-1);
          this._combo = 1;
          this._invincible = 90;
          this._spawnParticles(px,py,'#ff4757',12);
          if (this._lives<=0) { this._stop(); this._gameOver(); return; }
        }
      }
    }
  }

  _spawnParticles(x,y,color,n) {
    for(let i=0;i<n;i++) {
      const a=Math.random()*Math.PI*2,s=2+Math.random()*4;
      this._particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:4+Math.random()*3,color,life:20+Math.random()*20});
    }
  }

  // ── DRAW ───────────────────────────────────────────────────────────
  _draw() {
    const cv=document.getElementById('nr-canvas'); if(!cv)return;
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,CW,CH);
    if (this._axis==='H') this._drawH(ctx);
    else                  this._drawV(ctx);
  }

  _drawH(ctx) {
    // Sky
    const sky=ctx.createLinearGradient(0,0,0,H_ROAD_TOP);
    sky.addColorStop(0,'#07080c'); sky.addColorStop(1,'#0d0f1a');
    ctx.fillStyle=sky; ctx.fillRect(0,0,CW,H_ROAD_TOP);
    // Road
    const rg=ctx.createLinearGradient(0,H_ROAD_TOP,0,H_ROAD_BOTTOM);
    rg.addColorStop(0,'#1a1d2e'); rg.addColorStop(1,'#0d0f18');
    ctx.fillStyle=rg; ctx.fillRect(0,H_ROAD_TOP,CW,H_ROAD_BOTTOM-H_ROAD_TOP);
    // Dashes
    ctx.setLineDash([24,20]); ctx.lineDashOffset=-this._bgOff;
    ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=2;
    for(let i=1;i<H_LANE_COUNT;i++){
      const y=H_ROAD_TOP+H_LANE_H*i;
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW,y);ctx.stroke();
    }
    ctx.setLineDash([]);
    // Borders
    ctx.strokeStyle=this._vehicle.color+'40'; ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,H_ROAD_TOP);ctx.lineTo(CW,H_ROAD_TOP);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,H_ROAD_BOTTOM);ctx.lineTo(CW,H_ROAD_BOTTOM);ctx.stroke();
    // Ground
    ctx.fillStyle='#07080c'; ctx.fillRect(0,H_ROAD_BOTTOM,CW,CH-H_ROAD_BOTTOM);
    // Obstacles
    this._obstacles.forEach(o=>{
      ctx.save();ctx.shadowColor=o.color??'#fff';ctx.shadowBlur=10;
      ctx.font=`${o.h}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(o.emoji,o.x,o.y);ctx.restore();
    });
    // Particles
    this._particles.forEach(p=>{
      ctx.save();ctx.globalAlpha=Math.min(1,p.life/15);ctx.fillStyle=p.color;
      ctx.shadowColor=p.color;ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    // Player
    this._drawPlayer(ctx,this._hPlayerX,this._hPlayerY,'H');
  }

  _drawV(ctx) {
    // BG
    ctx.fillStyle='#0a0a14'; ctx.fillRect(0,0,CW,CH);
    // Road
    ctx.fillStyle='#111120';
    ctx.fillRect(V_MARGIN,0,CW-V_MARGIN*2,CH);
    // Dashes
    ctx.strokeStyle='rgba(255,220,50,.14)'; ctx.lineWidth=2;
    ctx.setLineDash([28,20]); ctx.lineDashOffset=-this._bgOff;
    for(let l=0;l<V_LANE_COUNT-1;l++){
      const x=V_MARGIN+(l+1)*V_LANE_W;
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CH);ctx.stroke();
    }
    ctx.setLineDash([]);
    // Borders
    ctx.strokeStyle=this._vehicle.color+'50'; ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(V_MARGIN,0);ctx.lineTo(V_MARGIN,CH);ctx.stroke();
    ctx.beginPath();ctx.moveTo(CW-V_MARGIN,0);ctx.lineTo(CW-V_MARGIN,CH);ctx.stroke();
    // Obstacles
    this._obstacles.forEach(o=>{
      ctx.font=`${o.h??32}px serif`;ctx.textAlign='center';ctx.globalAlpha=1;
      ctx.fillText(o.emoji,o.x,o.y);
    });
    // Particles
    this._particles.forEach(p=>{
      ctx.save();ctx.globalAlpha=Math.min(1,p.life/15);ctx.fillStyle=p.color;
      ctx.shadowColor=p.color;ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    ctx.globalAlpha=1;
    // Player
    this._drawPlayer(ctx,this._vPlayerX,V_PLAYER_Y,'V');
  }

  _drawPlayer(ctx,px,py,axis) {
    ctx.save();
    if (this._invincible>0) ctx.globalAlpha=Math.sin(performance.now()/60)>.5?.35:1;
    if (this._shield>0) {
      ctx.shadowColor='#00e5ff';ctx.shadowBlur=20;
      ctx.strokeStyle='rgba(0,229,255,.4)';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(px,py,50,28,axis==='V'?Math.PI/2:0,0,Math.PI*2);ctx.stroke();
    } else {
      ctx.shadowColor=this._vehicle.color;ctx.shadowBlur=12;
    }
    if (this._vImg.complete&&this._vImg.naturalWidth>0) {
      const ratio=this._vImg.naturalWidth/this._vImg.naturalHeight;
      const h=44,w=h*ratio;
      // En mode V on pivote le sprite 90°
      if (axis==='V') {
        ctx.translate(px,py); ctx.rotate(-Math.PI/2);
        ctx.drawImage(this._vImg,-w/2,-h/2,w,h);
      } else {
        ctx.drawImage(this._vImg,px-w/2,py-h/2,w,h);
      }
    } else {
      ctx.font='36px serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(axis==='V'?'🏎️':'🚗',px,py);
    }
    ctx.restore();
  }

  _updateHUD() {
    const dist  = document.getElementById('nr-dist');
    const score = document.getElementById('nr-score');
    const lives = document.getElementById('nr-lives');
    const axis  = document.getElementById('nr-axis');
    const next  = document.getElementById('nr-next');
    if (dist)  dist.textContent  = Math.floor(this._dist);
    if (score) score.textContent = Math.floor(this._score);
    if (lives) lives.textContent = '❤️'.repeat(this._lives)||'💀';
    if (axis)  axis.textContent  = this._axis==='H'?'↔':'↕';
    if (next) {
      const rem = Math.max(0, this._checkpointN*CHECKPOINT_DIST - this._dist);
      next.textContent = Math.ceil(rem)+'m';
    }
  }

  // ── GAME OVER ──────────────────────────────────────────────────────
  async _gameOver() {
    SFX.end();
    const dist = Math.floor(this._dist);
    let gain   = Math.round(this._bet * dist / 150);
    if (this._vehicle.bonusKey==='gain') gain *= 2;
    const net    = gain - this._bet;
    const result = net>0?'win':net<0?'lose':'push';

    this.credits += gain;
    this.onCreditsChange(this.credits);
    if (this.userId) {
      try { await supabase.from('profiles').update({chronicles:this.credits}).eq('id',this.userId); } catch {}
    }

    const arena = document.getElementById('nr-arena'); if(!arena)return;
    const netTxt = net>=0
      ? `<span style="color:var(--c-green)">+${net} C</span>`
      : `<span style="color:var(--c-red)">${net} C</span>`;
    const res = document.createElement('div'); res.className='wam-result-screen';
    res.innerHTML = `
      <div class="wam-result-title">GAME OVER</div>
      <div class="wam-result-score">${dist} m</div>
      <div class="wam-result-gain">MISE ${this._bet} C → GAIN <strong>${gain} C</strong> ${netTxt}</div>
      <div style="font-size:11px;letter-spacing:.12em;color:var(--c-text-faint)">SCORE : ${Math.floor(this._score)} · CHECKPOINTS : ${this._checkpointN-1}</div>
      <button class="action-btn primary" id="nr-retry" style="margin-top:16px">↺ REJOUER</button>`;
    arena.appendChild(res);
    document.getElementById('nr-retry')?.addEventListener('click',()=>{ res.remove(); this._renderSelect(); });
    document.dispatchEvent(new CustomEvent('neon-racer:result',{detail:{bet:this._bet,result,net,dist}}));
  }

  _stop() {
    this._running=false;
    if(this._raf){cancelAnimationFrame(this._raf);this._raf=null;}
    window.removeEventListener('keydown',this._onKey);
  }

  _flashMsg(txt) {
    const root=document.getElementById('nr-inner');if(!root)return;
    const d=document.createElement('div');d.className='game-msg lose';d.textContent=txt;
    d.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10';
    root.appendChild(d);setTimeout(()=>d.remove(),2000);
  }
}
