/**
 * Neon Racer — cyberpunk pseudo-3D arcade racer.
 *
 * Dedicated Star Arcade mini-game module.
 * The arcade core owns the wallet and passes `onCreditsChange()`.
 */
import { ArcadeSFX as SFX } from '../../arcade-sfx.js';

const VEHICLES = [
  {
    id: 'mash', name: 'MASH', type: 'MOTO', img: '/shared/images/vehicule/mash.png',
    maxSpeed: 8.2, accel: 0.075, handling: 0.058, stability: 0.92,
    bonus: 'DRIFT +', bonusKey: 'drift', color: '#ff6eb4', stars: [4, 5],
    desc: 'Moto légère. Très agile dans les virages et bonus de drift.',
  },
  {
    id: 'citroenAX', name: 'CITROËN AX', type: 'VOITURE', img: '/shared/images/vehicule/citroenAX.png',
    maxSpeed: 7.2, accel: 0.062, handling: 0.043, stability: 0.72,
    bonus: 'BOUCLIER +', bonusKey: 'shield', color: '#00e5ff', stars: [3, 3],
    desc: 'Stable et fiable. Les boucliers protègent plus longtemps.',
  },
  {
    id: 'barossa', name: 'BAROSSA', type: 'QUAD', img: '/shared/images/vehicule/barossa.png',
    maxSpeed: 9.1, accel: 0.07, handling: 0.034, stability: 0.55,
    bonus: 'GAIN ×2', bonusKey: 'gain', color: '#ffcc00', stars: [5, 2],
    desc: 'Très rapide mais lourd dans les courbes. Gain final doublé.',
  },
];

const HEART_COSTS = [50, 100, 200];
const CW = 800;
const CH = 420;
const ROAD_HORIZON = 120;
const ROAD_BOTTOM = CH + 20;
const SEGMENTS = 38;
const LANES = [-0.55, 0, 0.55];
const CHECKPOINT_DIST = 750;
const MAX_ROAD_X = 1.18;
const BASE_REWARD_DISTANCE = 220;

const OBSTACLES = [
  { type: 'traffic', label: '🚗', harm: true, weight: 34, w: 0.18 },
  { type: 'truck', label: '🚚', harm: true, weight: 18, w: 0.24 },
  { type: 'barrier', label: '🚧', harm: true, weight: 18, w: 0.20 },
  { type: 'coin', label: '🪙', harm: false, score: 55, weight: 15, w: 0.14 },
  { type: 'boost', label: '⚡', harm: false, boost: true, score: 90, weight: 10, w: 0.14 },
  { type: 'shield', label: '🛡️', harm: false, shield: true, score: 60, weight: 5, w: 0.14 },
];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return t * t * (3 - 2 * t); }
function pick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) { roll -= item.weight; if (roll <= 0) return item; }
  return items[0];
}

export class NeonRacer {
  constructor(mountId, userId, credits, onCreditsChange) {
    this.mountId = mountId;
    this.userId = userId;
    this.credits = credits;
    this.onCreditsChange = onCreditsChange;
    this.vehicle = VEHICLES[0];
    this.heartIdx = 0;
    this.bet = HEART_COSTS[0];
    this.keys = new Set();
    this.running = false;
    this.raf = null;
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
        <div class="chase-select-title">// COURSE CYBERPUNK — CIRCUIT GWEN HA STAR</div>
        <div class="chase-vehicles-grid" id="nr-vgrid">
          ${VEHICLES.map((v, i) => `
            <div class="chase-vcard ${i === 0 ? 'selected' : ''}" data-idx="${i}" style="--vc:${v.color}">
              <img src="${v.img}" alt="${v.name}" class="chase-vimg" loading="eager" onerror="this.style.opacity=.16">
              <div class="chase-vname">${v.name}</div><div class="chase-vtype">${v.type}</div>
              <div class="chase-vstars"><span class="chase-vstat-lbl">VITESSE</span>${'★'.repeat(v.stars[0])}${'☆'.repeat(5 - v.stars[0])}</div>
              <div class="chase-vstars"><span class="chase-vstat-lbl">TENUE</span>${'★'.repeat(v.stars[1])}${'☆'.repeat(5 - v.stars[1])}</div>
              <div class="chase-vbonus">${v.bonus}</div><div class="chase-vdesc">${v.desc}</div>
            </div>`).join('')}
        </div>
        <div class="nr-hearts-panel">
          <div class="nr-hearts-title">MISE — CONTRAT DE COURSE</div>
          <div class="nr-hearts-row" id="nr-hearts-row">
            ${HEART_COSTS.map((cost, i) => `
              <button class="nr-heart-btn ${i === 0 ? 'active' : ''}" data-idx="${i}">
                ${'❤️'.repeat(i + 1)}<span class="nr-heart-cost">${cost} C</span><span class="nr-heart-lives">${i + 1} crash${i > 0 ? 's' : ''} toléré${i > 0 ? 's' : ''}</span>
              </button>`).join('')}
          </div>
          <div class="nr-hearts-hint" id="nr-hearts-hint">Mise : <strong>50 C</strong> · 1 vie · circuit à virages dynamiques</div>
        </div>
        <div class="chase-how">
          <div class="chase-how-title">⚡ PILOTAGE</div>
          <div class="chase-how-grid">
            <div class="chase-how-block"><span>←→</span><span>Tourne et reste dans la trajectoire.</span></div>
            <div class="chase-how-block"><span>↑</span><span>Accélération active.</span></div>
            <div class="chase-how-block"><span>↓</span><span>Freinage pour les virages serrés.</span></div>
            <div class="chase-how-block"><span>SPACE</span><span>Boost si la jauge est prête.</span></div>
            <div class="chase-how-block"><span>🌆</span><span>Les virages changent avec les districts cyberpunk.</span></div>
            <div class="chase-how-block"><span>💰</span><span>Gain selon distance, score, drift et risque.</span></div>
          </div>
        </div>
        <div class="action-row"><button class="action-btn primary" id="nr-start">▶ LANCER LA COURSE</button></div>
      </div>`;

    document.querySelectorAll('.chase-vcard').forEach(card => card.addEventListener('click', () => {
      document.querySelectorAll('.chase-vcard').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      this.vehicle = VEHICLES[Number(card.dataset.idx)];
      SFX.click();
    }));
    document.querySelectorAll('.nr-heart-btn').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.nr-heart-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.heartIdx = Number(btn.dataset.idx);
      this.bet = HEART_COSTS[this.heartIdx];
      const lives = this.heartIdx + 1;
      document.getElementById('nr-hearts-hint').innerHTML = `Mise : <strong>${this.bet} C</strong> · ${lives} vie${lives > 1 ? 's' : ''} · virages dynamiques`;
      SFX.click();
    }));
    document.getElementById('nr-start')?.addEventListener('click', () => this.launch());
  }

  async launch() {
    if (this.credits < this.bet) return this.flash('CRÉDITS INSUFFISANTS');
    this.credits -= this.bet;
    await this.onCreditsChange(this.credits);
    const root = document.getElementById('nr-inner');
    if (!root) return;
    root.innerHTML = `
      <div class="chase-arena" id="nr-arena">
        <canvas id="nr-canvas" width="${CW}" height="${CH}" style="width:100%;height:auto;display:block;border-radius:18px;background:#05050c"></canvas>
        <div class="chase-hud" id="nr-hud">
          <div class="chase-hud-block"><span class="chase-hud-lbl">DIST.</span><span class="chase-hud-val" id="nr-dist">0</span><span class="chase-hud-unit">m</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">VITESSE</span><span class="chase-hud-val" id="nr-speed">0</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">VIES</span><span class="chase-hud-val" id="nr-lives">❤️</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">DRIFT</span><span class="chase-hud-val" id="nr-drift">0</span></div>
          <div class="chase-hud-block"><span class="chase-hud-lbl">BOOST</span><span class="chase-hud-val" id="nr-boost">0%</span></div>
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
      await new Promise(resolve => setTimeout(resolve, 480));
      d.remove();
    }
    SFX.win();
  }

  startLoop() {
    this.running = true; this.distance = 0; this.score = 0; this.lives = this.heartIdx + 1;
    this.speed = 2.6; this.roadX = 0; this.roadVX = 0; this.carX = 0; this.steer = 0;
    this.curve = 0; this.targetCurve = 0; this.curveTimer = 0; this.boost = 30; this.boosting = 0;
    this.shield = 0; this.invincible = 0; this.driftScore = 0; this.combo = 1;
    this.objects = []; this.spawnTimer = 0; this.lastT = performance.now();
    this.vehicleImg = new Image(); this.vehicleImg.src = this.vehicle.img;
    this.onKeyDown = event => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'a', 'd', 'w', 's'].includes(event.key)) event.preventDefault();
      this.keys.add(event.key.toLowerCase());
    };
    this.onKeyUp = event => this.keys.delete(event.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  frame(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lastT) / 16.67, 3);
    this.lastT = ts;
    this.update(dt); this.draw(); this.updateHUD();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  update(dt) {
    const left = this.keys.has('arrowleft') || this.keys.has('a');
    const right = this.keys.has('arrowright') || this.keys.has('d');
    const up = this.keys.has('arrowup') || this.keys.has('w');
    const down = this.keys.has('arrowdown') || this.keys.has('s');
    const boostKey = this.keys.has(' ');
    this.steer = (left ? -1 : 0) + (right ? 1 : 0);
    const targetSpeed = this.vehicle.maxSpeed + (this.boosting > 0 ? 2.4 : 0);
    if (up || this.speed < 4) this.speed += this.vehicle.accel * dt; else this.speed -= 0.018 * dt;
    if (down) this.speed -= 0.12 * dt;
    this.speed = clamp(this.speed, 1.4, targetSpeed);
    if (boostKey && this.boost >= 100 && this.boosting <= 0) { this.boost = 0; this.boosting = 130; SFX.jackpot?.(); }
    if (this.boosting > 0) this.boosting -= dt;
    else this.boost = clamp(this.boost + 0.045 * dt + this.speed * 0.01 * dt, 0, 100);
    this.curveTimer -= dt;
    if (this.curveTimer <= 0) {
      this.targetCurve = (Math.random() * 2 - 1) * (0.25 + Math.random() * 0.85);
      this.curveTimer = 180 + Math.random() * 190;
      this.showDistrict();
    }
    this.curve = lerp(this.curve, this.targetCurve, 0.018 * dt);
    const curveForce = this.curve * this.speed * 0.006;
    this.roadVX += curveForce * dt; this.roadVX *= 0.86; this.roadX += this.roadVX * dt;
    this.carX += this.steer * this.vehicle.handling * dt;
    this.carX -= curveForce * dt * (1.6 - this.vehicle.stability);
    this.carX = clamp(this.carX, -MAX_ROAD_X, MAX_ROAD_X);
    if (Math.abs(this.carX) > 0.93) this.speed -= 0.08 * dt;
    const drift = Math.abs(this.steer) > 0 && Math.sign(this.steer) !== Math.sign(this.curve) && Math.abs(this.curve) > 0.35;
    if (drift && this.speed > 4.2) {
      const bonus = this.vehicle.bonusKey === 'drift' ? 2.2 : 1;
      this.driftScore += Math.round(this.speed * bonus * dt); this.score += 0.25 * bonus * dt;
      this.boost = clamp(this.boost + 0.09 * dt * bonus, 0, 100);
    }
    this.distance += this.speed * 0.75 * dt; this.score += this.speed * 0.022 * dt;
    this.invincible = Math.max(0, this.invincible - dt); this.shield = Math.max(0, this.shield - dt);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnObject(); this.spawnTimer = Math.max(20, 88 - this.speed * 5.5); }
    this.objects.forEach(obj => { obj.z -= this.speed * dt * 0.012; obj.x += this.curve * dt * 0.004 * obj.z; });
    this.objects = this.objects.filter(obj => obj.z > 0.03);
    this.checkCollisions();
  }

  showDistrict() {
    const flash = document.getElementById('nr-axis-flash'); if (!flash) return;
    const names = ['DISTRICT NEON', 'RUE DES DRONES', 'PÉRIPH DATA', 'PORT CYBER', 'TUNNEL TRISKEL'];
    flash.textContent = names[Math.floor(Math.random() * names.length)] + (this.targetCurve > 0 ? ' ↱' : ' ↰');
    flash.style.display = ''; flash.classList.add('visible');
    setTimeout(() => { flash.classList.remove('visible'); setTimeout(() => { flash.style.display = 'none'; }, 350); }, 850);
  }

  spawnObject() {
    const item = pick(OBSTACLES); const lane = LANES[Math.floor(Math.random() * LANES.length)];
    this.objects.push({ ...item, x: lane + (Math.random() * 0.08 - 0.04), z: 1, hit: false });
  }

  checkCollisions() {
    if (this.invincible > 0) return;
    for (const obj of this.objects) {
      if (obj.hit || obj.z > 0.13 || Math.abs(obj.x - this.carX) > obj.w + 0.09) continue;
      obj.hit = true;
      if (!obj.harm) {
        this.score += (obj.score ?? 30) * this.combo; this.combo = Math.min(8, this.combo + 1);
        if (obj.boost) this.boost = clamp(this.boost + 35, 0, 100);
        if (obj.shield) this.shield = this.vehicle.bonusKey === 'shield' ? 220 : 120;
        SFX.tick(); continue;
      }
      if (this.shield > 0) { this.shield = 0; this.invincible = 45; SFX.tick(); continue; }
      this.lives -= 1; this.combo = 1; this.speed = Math.max(1.6, this.speed * 0.55); this.invincible = 85; SFX.lose();
      if (this.lives <= 0) { this.stop(); this.gameOver(); return; }
    }
  }

  draw() {
    const canvas = document.getElementById('nr-canvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, CW, CH);
    this.drawSky(ctx); this.drawRoad(ctx); this.drawObjects(ctx); this.drawPlayer(ctx); this.drawOverlay(ctx);
  }

  drawSky(ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, CH);
    sky.addColorStop(0, '#070313'); sky.addColorStop(0.42, '#12092a'); sky.addColorStop(1, '#05050c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
    ctx.save(); ctx.globalAlpha = 0.35;
    for (let i = 0; i < 26; i++) {
      const x = (i * 97 + Math.sin(this.distance * 0.01 + i) * 28) % CW;
      const h = 34 + ((i * 23) % 120); const y = ROAD_HORIZON - h + 25;
      ctx.fillStyle = i % 3 === 0 ? '#181044' : '#0c1330'; ctx.fillRect(x - 18, y, 34, h);
      ctx.fillStyle = i % 2 === 0 ? '#00e5ff' : '#ff3df2';
      for (let wy = y + 8; wy < y + h - 4; wy += 16) ctx.fillRect(x - 10, wy, 4, 3);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,229,255,.12)'; ctx.lineWidth = 1;
    for (let y = ROAD_HORIZON; y < CH; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }
  }

  drawRoad(ctx) {
    const baseOffset = this.roadX * 110;
    for (let i = SEGMENTS; i >= 1; i--) {
      const p1 = (i - 1) / SEGMENTS; const p2 = i / SEGMENTS;
      const y1 = lerp(ROAD_HORIZON, ROAD_BOTTOM, easeInOut(p1)); const y2 = lerp(ROAD_HORIZON, ROAD_BOTTOM, easeInOut(p2));
      const w1 = lerp(40, 390, p1 * p1); const w2 = lerp(40, 390, p2 * p2);
      const cx1 = CW / 2 + baseOffset + this.curve * 150 * p1 * p1;
      const cx2 = CW / 2 + baseOffset + this.curve * 150 * p2 * p2;
      ctx.fillStyle = i % 2 === 0 ? '#17192a' : '#10121f';
      ctx.beginPath(); ctx.moveTo(cx1 - w1, y1); ctx.lineTo(cx1 + w1, y1); ctx.lineTo(cx2 + w2, y2); ctx.lineTo(cx2 - w2, y2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,229,255,.14)' : 'rgba(255,61,242,.12)';
      ctx.beginPath(); ctx.moveTo(cx1 - w1 - 12, y1); ctx.lineTo(cx1 - w1, y1); ctx.lineTo(cx2 - w2, y2); ctx.lineTo(cx2 - w2 - 18, y2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx1 + w1 + 12, y1); ctx.lineTo(cx1 + w1, y1); ctx.lineTo(cx2 + w2, y2); ctx.lineTo(cx2 + w2 + 18, y2); ctx.closePath(); ctx.fill();
      if (i % 4 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, p2 * 4);
        for (const lane of [-0.33, 0.33]) { ctx.beginPath(); ctx.moveTo(cx1 + lane * w1, y1); ctx.lineTo(cx2 + lane * w2, y2); ctx.stroke(); }
      }
    }
  }

  project(obj) {
    const z = clamp(obj.z, 0.04, 1); const p = 1 - z;
    const roadW = lerp(40, 390, p * p); const roadCx = CW / 2 + this.roadX * 110 + this.curve * 150 * p * p;
    const y = lerp(ROAD_HORIZON, ROAD_BOTTOM - 30, easeInOut(p)); const x = roadCx + obj.x * roadW;
    return { x, y, scale: lerp(0.35, 2.2, p * p) };
  }

  drawObjects(ctx) {
    [...this.objects].sort((a, b) => b.z - a.z).forEach(obj => {
      if (obj.hit) return; const p = this.project(obj);
      ctx.save(); ctx.globalAlpha = clamp(1 - obj.z * 0.2, 0.15, 1);
      ctx.font = `${Math.round(26 * p.scale)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = obj.harm ? '#ff4757' : '#00e5ff'; ctx.shadowBlur = 10 * p.scale; ctx.fillText(obj.label, p.x, p.y); ctx.restore();
    });
  }

  drawPlayer(ctx) {
    const y = CH - 76; const x = CW / 2 + this.carX * 240;
    ctx.save(); if (this.invincible > 0) ctx.globalAlpha = Math.sin(performance.now() / 50) > 0 ? 0.4 : 1;
    if (this.shield > 0) { ctx.strokeStyle = 'rgba(0,229,255,.7)'; ctx.lineWidth = 3; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.ellipse(x, y, 62, 34, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.translate(x, y); ctx.rotate(-this.steer * 0.14 + this.curve * 0.08); ctx.shadowColor = this.vehicle.color; ctx.shadowBlur = 22;
    if (this.vehicleImg.complete && this.vehicleImg.naturalWidth > 0) {
      const ratio = this.vehicleImg.naturalWidth / this.vehicleImg.naturalHeight; const h = 56; const w = h * ratio;
      ctx.drawImage(this.vehicleImg, -w / 2, -h / 2, w, h);
    } else { ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏎️', 0, 0); }
    ctx.restore();
  }

  drawOverlay(ctx) {
    const curveTxt = this.curve > 0.18 ? 'VIRAGE DROITE' : this.curve < -0.18 ? 'VIRAGE GAUCHE' : 'LIGNE NÉON';
    ctx.save(); ctx.font = '10px Share Tech Mono, monospace'; ctx.fillStyle = 'rgba(168,230,255,.7)';
    ctx.fillText(curveTxt, 24, 32); ctx.fillText(`VEHICLE ${this.vehicle.name}`, 24, 48);
    if (this.boosting > 0) { ctx.fillStyle = 'rgba(255,204,0,.85)'; ctx.fillText('BOOST ACTIVE', 24, 64); }
    ctx.restore();
  }

  updateHUD() {
    document.getElementById('nr-dist').textContent = Math.floor(this.distance);
    document.getElementById('nr-speed').textContent = Math.round(this.speed * 42);
    document.getElementById('nr-lives').textContent = '❤️'.repeat(this.lives) || '💀';
    document.getElementById('nr-drift').textContent = Math.floor(this.driftScore);
    document.getElementById('nr-boost').textContent = `${Math.floor(this.boost)}%`;
  }

  async gameOver() {
    SFX.lose();
    const dist = Math.floor(this.distance); const risk = 1 + this.heartIdx * 0.12; const driftBonus = Math.floor(this.driftScore / 130);
    let gain = Math.round(this.bet * dist / BASE_REWARD_DISTANCE * risk + driftBonus);
    if (this.vehicle.bonusKey === 'gain') gain *= 2;
    gain = Math.max(0, gain);
    const net = gain - this.bet; const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    this.credits += gain; await this.onCreditsChange(this.credits);
    const arena = document.getElementById('nr-arena'); if (!arena) return;
    const res = document.createElement('div'); res.className = 'wam-result-screen';
    res.innerHTML = `<div class="wam-result-title">COURSE TERMINÉE</div><div class="wam-result-score">${dist} m</div><div class="wam-result-gain">MISE ${this.bet} C → GAIN <strong>${gain} C</strong> <span style="color:${net >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${net >= 0 ? '+' : ''}${net} C</span></div><div style="font-size:11px;letter-spacing:.12em;color:var(--c-text-faint)">SCORE : ${Math.floor(this.score)} · DRIFT : ${Math.floor(this.driftScore)} · BOOST : ${Math.floor(this.boost)}%</div><button class="action-btn primary" id="nr-retry" style="margin-top:16px">↺ REJOUER</button>`;
    arena.appendChild(res);
    document.getElementById('nr-retry')?.addEventListener('click', () => { res.remove(); this.renderSelect(); });
    document.dispatchEvent(new CustomEvent('neon-racer:result', { detail: { bet: this.bet, result, net, dist } }));
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  flash(text) {
    const root = document.getElementById('nr-inner'); if (!root) return;
    const d = document.createElement('div'); d.className = 'game-msg lose'; d.textContent = text;
    d.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10';
    root.appendChild(d); setTimeout(() => d.remove(), 2000);
  }
}
