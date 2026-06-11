import { requireAuth } from '/shared/guards.js';
import { getProfile, getDisplayNameFromUser } from '/shared/profile.js';
import {
  UPGRADES,
  SCALING_LAYERS,
  applyOfflineProgress,
  attemptCoreShellBreak,
  buyUpgradeAmount,
  checkAndClaimMilestones,
  clickCore,
  doPrestige,
  getCoreGrowthLevel,
  getCoreShellInfo,
  getCurrency,
  getScalingLayer,
  getVisibleMilestones,
  canPrestige,
  isUpgradeUnlocked,
  prestigeRequirement,
  tickPassive,
  upgradeBulkCost,
  upgradeCost,
} from './clicker-state.js';
import { loadSave, saveAll } from './clicker-save.js';
import { setClassToggle, setHtml, setText, setTransformScaleX } from './ui/render-cache.js';

const app = document.getElementById('app');
const FX_KEY = 'nitro-clicker.fx.enabled';
const BUY_MULT_KEY = 'nitro-clicker.buy.multiplier';
const BUY_MULTIPLIERS = [1, 5, 10];
const LAYOUT_KEY = 'nitro-clicker.layout';
const LAYOUTS = ['nexus', 'orbital', 'command', 'mono'];

let auth;
let profile;
let state;
let userId;
let saveTimer;
let lastTick = performance.now();
let lastUpgradeSignature = '';
let lastScaleSignature = '';
let lastMilestoneSignature = '';
let lastModuleSignature = '';
let lastFactorySignature = '';
let lastTendrilSignature = '';
let lastLayerId = '';
let lastShellSignature = '';
let fxEnabled = localStorage.getItem(FX_KEY) !== 'false';
let buyMultiplier = Number(localStorage.getItem(BUY_MULT_KEY) || 1);
if (!BUY_MULTIPLIERS.includes(buyMultiplier)) buyMultiplier = 1;
let currentLayout = localStorage.getItem(LAYOUT_KEY) ?? 'nexus';
if (!LAYOUTS.includes(currentLayout)) currentLayout = 'nexus';
let lastSubCoreCount = -1;
let audioCtx = null;
let lastEnergyPulse = 0;
const bounceParticles = [];
let bounceLoop = null;
let bounceCanvas = null;
let bounceCtx = null;

const FX = {
  ctx() {
    if (!fxEnabled) return null;
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  },
  tone(freq = 440, type = 'sine', vol = 0.05, dur = 0.08) {
    const ctx = this.ctx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  },
  click() { this.tone(660 + Math.random() * 120, 'triangle', 0.035, 0.055); },
  zap() { [880, 1240, 660].forEach((f, i) => setTimeout(() => this.tone(f + Math.random() * 80, 'sawtooth', 0.035, 0.045), i * 28)); },
  buy() { [392, 523, 659, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', 0.065, 0.11), i * 58)); },
  milestone() { [784, 988, 1175].forEach((f, i) => setTimeout(() => this.tone(f, 'sine', 0.055, 0.12), i * 70)); },
  overdrive() { [110, 220, 440, 880, 1760].forEach((f, i) => setTimeout(() => this.tone(f, i < 2 ? 'sawtooth' : 'square', 0.045, 0.09), i * 42)); },
  prestige() { [262, 392, 523, 784, 1047, 1568].forEach((f, i) => setTimeout(() => this.tone(f, i % 2 ? 'triangle' : 'square', 0.055, 0.13), i * 70)); },
  crack() { [180, 320, 640, 420].forEach((f, i) => setTimeout(() => this.tone(f, i % 2 ? 'sawtooth' : 'triangle', 0.04, 0.075), i * 38)); },
  shatter() { [130, 260, 520, 1040, 1560].forEach((f, i) => setTimeout(() => this.tone(f, i < 2 ? 'square' : 'triangle', 0.065, 0.11), i * 45)); },
};

function fmt(value) {
  const n = Math.floor(Number(value ?? 0));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('fr-FR');
}

function currencyLabel(currency) {
  return currency === 'fragments' ? 'F' : 'E';
}

function toast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function renderShell() {
  const name = getDisplayNameFromUser(auth.user, profile);
  app.classList.toggle('fx-disabled', !fxEnabled);
  app.innerHTML = `
    <svg class="lightning-layer" id="lightning-layer" aria-hidden="true"></svg>
    <header class="topbar">
      <div>
        <h1 class="brand-title">NITRO <span>CLICKER</span></h1>
        <div class="brand-sub">// AGENT ${name.toUpperCase()} · PROGRESSION PAR ÉCHELLES</div>
      </div>
      <nav class="top-actions">
        <button class="nav-btn" id="fx-toggle" type="button">${fxEnabled ? '✨ FX ON' : 'FX OFF'}</button>
        <div class="layout-switcher" role="group" aria-label="Disposition des panels">
          ${LAYOUTS.map(l => `<button class="layout-btn${currentLayout === l ? ' active' : ''}" data-layout-btn="${l}" type="button">${l.toUpperCase()}</button>`).join('')}
        </div>
        <a href="/star/" class="nav-btn">⬡ STAR</a>
        <a href="/" class="nav-btn">← HUB</a>
        <a href="/clicker/deploy.html" class="nav-btn deploy-badge" id="deploy-badge" title="Deploy status">BUILD</a>
      </nav>
    </header>

    <section class="stats-grid stats-grid-extended">
      <article class="stat-card energy-stat"><div class="stat-label">ÉNERGIE</div><div class="stat-value primary" id="stat-energy">0</div><div class="stat-meter"><span id="meter-energy"></span></div></article>
      <article class="stat-card"><div class="stat-label">ÉNERGIE TOTALE</div><div class="stat-value total" id="stat-total-energy">0</div><div class="stat-meter total"><span id="meter-total-energy"></span></div></article>
      <article class="stat-card"><div class="stat-label">FRAGMENTS</div><div class="stat-value fragment" id="stat-fragments">0</div><div class="stat-meter fragment"><span id="meter-fragments"></span></div></article>
      <article class="stat-card"><div class="stat-label">PAR CLIC</div><div class="stat-value" id="stat-click">1</div><div class="stat-meter small"><span id="meter-click"></span></div></article>
      <article class="stat-card"><div class="stat-label">AUTO / SEC</div><div class="stat-value" id="stat-passive">0</div><div class="stat-meter small"><span id="meter-passive"></span></div></article>
      <article class="stat-card"><div class="stat-label">SURCHARGE</div><div class="stat-value danger" id="stat-surcharge">0%</div><div class="stat-meter danger"><span id="meter-surcharge"></span></div></article>
      <article class="stat-card"><div class="stat-label">COQUE</div><div class="stat-value shell" id="stat-shell">0/0</div><div class="stat-meter shell"><span id="meter-shell"></span></div></article>
      <article class="stat-card"><div class="stat-label">PRESTIGE</div><div class="stat-value accent" id="stat-prestige">0</div><div class="stat-meter accent"><span id="meter-prestige"></span></div></article>
      <article class="stat-card"><div class="stat-label">ÉCHELLE</div><div class="stat-value layer" id="stat-layer">CORE</div><div class="stat-meter layer"><span id="meter-layer"></span></div></article>
      <article class="stat-card"><div class="stat-label">USINES</div><div class="stat-value factory" id="stat-factory">0</div><div class="stat-meter factory"><span id="meter-factory"></span></div></article>
    </section>

    <section class="game-grid game-grid-wide" id="game-grid" data-layout="${currentLayout}">
      <article class="panel core-panel" id="core-panel">
        <div class="scale-radar" id="scale-radar" aria-hidden="true"></div>
        <div class="factory-field" id="factory-field" aria-hidden="true"></div>
        <div class="tendril-layer" id="tendril-layer" aria-hidden="true"></div>
        <div class="sub-core-field" id="sub-core-field" aria-hidden="true"></div>
        <div class="energy-field" id="energy-field" aria-hidden="true"></div>
        <div class="module-orbit" id="module-orbit" aria-hidden="true"></div>
        <div class="core-shell-visual" id="core-shell-visual" aria-hidden="true"><span></span><i></i><b></b></div>
        <button class="click-core" id="click-core" aria-label="Cliquer le noyau Nitro">
          <span class="core-rings"></span>
          <span class="core-glyph">⬡</span>
          <small id="core-label">CLICK CORE</small>
        </button>
        <div class="layer-caption" id="layer-caption"></div>
        <div class="reactor-gauges" aria-hidden="true">
          <div class="reactor-gauge"><span id="reactor-a"></span></div>
          <div class="reactor-gauge"><span id="reactor-b"></span></div>
          <div class="reactor-gauge"><span id="reactor-c"></span></div>
        </div>
      </article>

      <aside class="panel progression-panel">
        <div class="upgrade-title-row">
          <h2 class="panel-title">UPGRADES</h2>
          <div class="buy-mult-row" role="group" aria-label="Multiplicateur d'achat">
            ${BUY_MULTIPLIERS.map(mult => `<button class="buy-mult-btn ${buyMultiplier === mult ? 'active' : ''}" data-buy-mult="${mult}" type="button">×${mult}</button>`).join('')}
          </div>
        </div>
        <div class="upgrade-sync-hint" id="upgrade-sync-hint">SYNC LIVE · ACHAT ×${buyMultiplier}</div>
        <div class="upgrade-list" id="upgrade-list"></div>
        <div class="prestige-upgrade-footer">
          <button class="upgrade-btn prestige-card" id="prestige-btn" type="button">
            <span class="upgrade-fill" id="prestige-fill"></span>
            <div class="upgrade-head"><span class="upgrade-name">✦ Surcharge contrôlée</span><span class="upgrade-cost" id="prestige-cost"></span></div>
            <div class="upgrade-desc">Reset le run, conserve tes fragments, augmente l'échelle et débloque des systèmes.</div>
          </button>
        </div>
      </aside>

      <aside class="panel meta-panel">
        <div class="meta-panel-head">
          <div>
            <div class="meta-panel-kicker">SYS · META</div>
            <h2 class="meta-panel-title">NEXUS</h2>
          </div>
          <button class="action-btn meta-save-btn" id="save-btn" type="button">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 1v7M3 5l3 3 3-3M1 11h10"/></svg>
            SAVE
          </button>
        </div>

        <section class="meta-section meta-section--scale">
          <div class="meta-section-header">
            <span class="meta-section-accent"></span>
            <span class="meta-section-icon">◈</span>
            <h2 class="meta-title">ÉCHELLE & MILESTONES</h2>
            <span class="meta-section-rule"></span>
          </div>
          <div class="scale-card" id="scale-card"></div>
          <div class="milestone-list" id="milestone-list"></div>
        </section>

        <section class="meta-section meta-section--shell">
          <div class="meta-section-header">
            <span class="meta-section-accent"></span>
            <span class="meta-section-icon">◇</span>
            <h2 class="meta-title">COQUE DU NOYAU</h2>
            <span class="meta-section-rule"></span>
          </div>
          <div class="core-shell-card" id="core-shell-card"></div>
          <button class="upgrade-btn shell-break-card" id="shell-break-btn" type="button">
            <span class="upgrade-fill" id="shell-break-fill"></span>
            <div class="upgrade-head"><span class="upgrade-name">◇ Briser la sphère</span><span class="upgrade-cost" id="shell-break-cost"></span></div>
            <div class="upgrade-desc" id="shell-break-desc">Stocke des fragments Nitro dans la sphère, puis dépense un fort pic d'énergie pour tenter de la briser.</div>
          </button>
        </section>

      </aside>
    </section>
  `;

  bindStaticEvents();
  renderAll();
}

function bindStaticEvents() {
  document.getElementById('fx-toggle').addEventListener('click', () => {
    fxEnabled = !fxEnabled;
    localStorage.setItem(FX_KEY, String(fxEnabled));
    app.classList.toggle('fx-disabled', !fxEnabled);
    setText('fx-toggle', fxEnabled ? '✨ FX ON' : 'FX OFF');
  });

  document.querySelectorAll('[data-buy-mult]').forEach(btn => {
    btn.addEventListener('click', () => {
      buyMultiplier = Number(btn.dataset.buyMult);
      localStorage.setItem(BUY_MULT_KEY, String(buyMultiplier));
      document.querySelectorAll('[data-buy-mult]').forEach(node => setClassToggle(node, 'active', Number(node.dataset.buyMult) === buyMultiplier));
      setText('upgrade-sync-hint', `SYNC LIVE · ACHAT ×${buyMultiplier}`);
      renderUpgrades(true);
    });
  });

  document.getElementById('click-core').addEventListener('click', event => {
    const result = clickCore(state);
    const gain = typeof result === 'number' ? result : result.gain;
    FX.click();
    spawnPop(event.clientX, event.clientY, `+${fmt(gain)}`);
    spawnBouncingBurst(event.clientX, event.clientY, Math.min(14, 4 + Math.floor(gain / Math.max(1, state.clickPower / 3))));
    pulseReactor();
    pulseSubCores();
    sparkTendrils();

    if (result?.overdrive) {
      FX.overdrive();
      spawnSystemWave(`OVERDRIVE +${fmt(result.overdriveGain)}`);
      lightningStorm(5);
    }
    if (result?.fragmentsStored) {
      pulseShell('store');
      toast(`Fragment Nitro confiné dans la sphère +${result.fragmentsStored}`);
    }
    if (result?.fragments) {
      toast(`Fragment Nitro obtenu +${result.fragments}`);
      spawnFragmentOrbs(result.fragments);
    }
    if (Math.random() > 0.45) zapToRandomModule();

    claimMilestonesAndRender();
    scheduleSave();
  });

  document.getElementById('shell-break-btn').addEventListener('click', () => {
    const result = attemptCoreShellBreak(state);
    if (!result.ok) {
      if (result.reason === 'locked') return toast('Isolation du noyau requise pour créer une sphère.');
      if (result.reason === 'empty') return toast('Aucun fragment stocké dans la sphère.');
      if (result.reason === 'not_enough_energy') return toast(`Pic d'énergie insuffisant : ${fmt(result.shell.breakCost)} E requis.`);
      if (result.reason === 'failed') {
        FX.crack();
        pulseShell('crack');
        spawnSystemWave('FISSURE');
        lightningStorm(3);
        renderAll(true);
        scheduleSave();
        return toast(`Rupture ratée · fissure ${result.cracks}/${result.shell.requiredHits} · chance ${Math.round(result.chance * 100)}%`);
      }
      return;
    }
    FX.shatter();
    pulseShell('break');
    spawnSystemWave(`SPHÈRE BRISÉE +${result.released}F`);
    lightningStorm(8);
    renderAll(true);
    claimMilestonesAndRender();
    scheduleSave();
    toast(`Fragments libérés : +${result.released}F${result.forced ? ' · rupture forcée par fissures' : ''}`);
  });

  document.querySelectorAll('[data-layout-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLayout = btn.dataset.layoutBtn;
      localStorage.setItem(LAYOUT_KEY, currentLayout);
      const grid = document.getElementById('game-grid');
      if (grid) grid.dataset.layout = currentLayout;
      document.querySelectorAll('[data-layout-btn]').forEach(b => setClassToggle(b, 'active', b.dataset.layoutBtn === currentLayout));
    });
  });

  document.getElementById('save-btn').addEventListener('click', () => {
    const ok = saveAll(userId, state);
    toast(ok ? 'Sauvegarde locale OK.' : 'Sauvegarde locale impossible.');
  });

  document.getElementById('prestige-btn').addEventListener('click', () => {
    const beforeLayer  = getScalingLayer(state).id;
    const oldFragments = state.fragments ?? 0;
    const result = doPrestige(state);
    if (!result.ok) return toast('Prestige pas encore prêt. Continue à charger le noyau.');
    state = result.state;
    FX.prestige();
    saveAll(userId, state);
    renderAll(true);
    spawnSystemWave('PRESTIGE +1');
    lightningStorm(9);
    if (getScalingLayer(state).id !== beforeLayer) spawnScaleShift();
    claimMilestonesAndRender();
    toast('Prestige activé. Échelle du système recalculée.');
    const earned = (state.fragments ?? 0) - oldFragments;
    if (earned > 0) setTimeout(() => spawnFragmentOrbs(earned), 500);
  });
}

function claimMilestonesAndRender() {
  const claimed = checkAndClaimMilestones(state);
  if (claimed.length) {
    FX.milestone();
    for (const m of claimed) {
      const bits = [];
      if (m.reward?.energy) bits.push(`+${fmt(m.reward.energy)} E`);
      if (m.reward?.fragments) bits.push(`+${fmt(m.reward.fragments)} F`);
      toast(`Milestone : ${m.label} · ${bits.join(' · ')}`);
      spawnSystemWave(m.label.toUpperCase());
    }
  }
  renderAll(!!claimed.length);
}

function spawnPop(x, y, text) {
  const core = document.getElementById('click-core');
  if (!core) return;
  const rect = core.getBoundingClientRect();
  if (!rect.width) return;
  const pop = document.createElement('div');
  pop.className = 'float-pop';
  pop.style.left = `${x - rect.left}px`;
  pop.style.top = `${y - rect.top}px`;
  pop.textContent = text;
  core.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
}

function ensureBounceCanvas() {
  if (bounceCanvas?.isConnected) return true;
  if (bounceLoop) { cancelAnimationFrame(bounceLoop); bounceLoop = null; }
  bounceParticles.length = 0;
  bounceCanvas = null;
  bounceCtx = null;
  const core = document.getElementById('click-core');
  if (!core) return false;
  bounceCanvas = document.createElement('canvas');
  bounceCanvas.className = 'bounce-canvas';
  bounceCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;border-radius:50%;';
  core.appendChild(bounceCanvas);
  const rect = core.getBoundingClientRect();
  bounceCanvas.width = Math.round(rect.width) || 240;
  bounceCanvas.height = Math.round(rect.height) || 240;
  bounceCtx = bounceCanvas.getContext('2d');
  return true;
}

function spawnBouncingBurst(clientX, clientY, count = 8) {
  if (!fxEnabled) return;
  if (!ensureBounceCanvas()) return;
  const core = document.getElementById('click-core');
  const rect = core.getBoundingClientRect();
  const w = Math.round(rect.width) || 240;
  const h = Math.round(rect.height) || 240;
  if (bounceCanvas.width !== w || bounceCanvas.height !== h) {
    bounceCanvas.width = w;
    bounceCanvas.height = h;
    bounceCtx = bounceCanvas.getContext('2d');
  }
  const cx = w / 2;
  const cy = h / 2;
  const R = cx - 4;
  const px0 = (clientX - rect.left) - cx;
  const py0 = (clientY - rect.top) - cy;
  const COLORS = [
    { fill: '#00ffcc', glow: 'rgba(0,255,204,.9)' },
    { fill: '#ffcc00', glow: 'rgba(255,204,0,.9)' },
    { fill: '#ff3df2', glow: 'rgba(255,61,242,.9)' },
  ];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 160 + Math.random() * 230;
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    bounceParticles.push({
      x: px0, y: py0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2.5 + Math.random() * 2.5,
      life: 1,
      decay: 0.65 + Math.random() * 0.5,
      fill: col.fill, glow: col.glow,
    });
  }
  if (bounceLoop) return;
  let lastTime = performance.now();
  function tick(now) {
    if (!bounceCanvas?.isConnected) { bounceLoop = null; bounceParticles.length = 0; return; }
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const bw = bounceCanvas.width, bh = bounceCanvas.height;
    const bcx = bw / 2, bcy = bh / 2, bR = bcx - 4;
    bounceCtx.clearRect(0, 0, bw, bh);
    const friction = Math.pow(0.28, dt);
    for (let i = bounceParticles.length - 1; i >= 0; i--) {
      const p = bounceParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= friction;
      p.vy *= friction;
      p.life -= p.decay * dt;
      // Bounce off sphere wall
      const d = Math.sqrt(p.x * p.x + p.y * p.y);
      if (d > 0 && d + p.r > bR) {
        const nx = p.x / d, ny = p.y / d;
        const dot = p.vx * nx + p.vy * ny;
        if (dot > 0) { p.vx = (p.vx - 2 * dot * nx) * 0.70; p.vy = (p.vy - 2 * dot * ny) * 0.70; }
        const push = bR - p.r - 1;
        p.x = nx * push; p.y = ny * push;
      }
      if (p.life <= 0) { bounceParticles.splice(i, 1); continue; }
      bounceCtx.save();
      bounceCtx.globalAlpha = Math.max(0, p.life);
      bounceCtx.shadowColor = p.glow;
      bounceCtx.shadowBlur = 9;
      bounceCtx.beginPath();
      bounceCtx.arc(bcx + p.x, bcy + p.y, p.r, 0, Math.PI * 2);
      bounceCtx.fillStyle = p.fill;
      bounceCtx.fill();
      bounceCtx.restore();
    }
    bounceLoop = bounceParticles.length > 0 ? requestAnimationFrame(tick) : null;
    if (!bounceLoop) bounceCtx.clearRect(0, 0, bw, bh);
  }
  bounceLoop = requestAnimationFrame(tick);
}

function spawnFragmentOrbs(count) {
  if (count <= 0) return;
  const core  = document.getElementById('click-core');
  const panel = document.getElementById('core-panel');
  if (!core || !panel) return;
  const cr  = core.getBoundingClientRect();
  const pr  = panel.getBoundingClientRect();
  const cx  = cr.left + cr.width  / 2 - pr.left;
  const cy  = cr.top  + cr.height / 2 - pr.top;
  const orbitR = cr.width / 2 * 1.12;
  const n = Math.min(count, 8);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (Math.random() * 0.35 - 0.175);
    const orb = document.createElement('div');
    orb.className = 'fragment-orb';
    orb.textContent = '⬡';
    orb.style.left = `${cx + Math.cos(angle) * orbitR}px`;
    orb.style.top  = `${cy + Math.sin(angle) * orbitR}px`;
    panel.appendChild(orb);
    const t = setTimeout(() => collectOrb(orb), 2000);
    orb.addEventListener('click', e => { e.stopPropagation(); clearTimeout(t); collectOrb(orb); }, { once: true });
  }
}

function collectOrb(orb) {
  if (!orb.isConnected) return;
  const stat = document.getElementById('stat-fragments');
  const or   = orb.getBoundingClientRect();
  orb.remove();
  if (!stat || !fxEnabled) return;
  const sr    = stat.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'fragment-orb-ghost';
  ghost.textContent = '⬡';
  ghost.style.left = `${or.left + or.width  / 2}px`;
  ghost.style.top  = `${or.top  + or.height / 2}px`;
  ghost.style.setProperty('--tx', `${sr.left + sr.width  / 2 - or.left - or.width  / 2}px`);
  ghost.style.setProperty('--ty', `${sr.top  + sr.height / 2 - or.top  - or.height / 2}px`);
  document.body.appendChild(ghost);
  requestAnimationFrame(() => ghost.classList.add('fragment-orb-ghost--fly'));
  setTimeout(() => ghost.remove(), 600);
}

function pulseReactor() {
  if (!fxEnabled) return;
  const core = document.getElementById('click-core');
  core?.classList.remove('pulse-hit');
  requestAnimationFrame(() => core?.classList.add('pulse-hit'));
}

function pulseShell(mode = 'store') {
  if (!fxEnabled) return;
  const panel = document.getElementById('core-panel');
  panel?.classList.remove('shell-store-hit', 'shell-crack-hit', 'shell-break-hit');
  requestAnimationFrame(() => panel?.classList.add(mode === 'break' ? 'shell-break-hit' : mode === 'crack' ? 'shell-crack-hit' : 'shell-store-hit'));
}

function sparkTendrils() {
  if (!fxEnabled) return;
  const panel = document.getElementById('core-panel');
  panel?.classList.remove('tendril-hit');
  requestAnimationFrame(() => panel?.classList.add('tendril-hit'));
}

function spawnModule(upgradeId, level) {
  if (!fxEnabled) return;
  const orbit = document.getElementById('module-orbit');
  if (!orbit) return;
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  const node = document.createElement('div');
  node.className = 'spawned-module';
  node.textContent = upgrade?.icon ?? '◆';
  node.title = `${upgrade?.name ?? upgradeId} Lv.${level}`;
  node.style.setProperty('--angle', `${Math.random() * 360}deg`);
  node.style.setProperty('--radius', `${118 + Math.random() * 90}px`);
  orbit.appendChild(node);
  while (orbit.children.length > 26) orbit.firstElementChild.remove();
}

function spawnSystemWave(text) {
  if (!fxEnabled) return;
  const panel = document.getElementById('core-panel');
  if (!panel) return;
  const node = document.createElement('div');
  node.className = 'system-wave';
  node.textContent = text;
  panel.appendChild(node);
  setTimeout(() => node.remove(), 1700);
}

function spawnScaleShift() {
  if (!fxEnabled) return;
  app.classList.remove('scale-shift');
  requestAnimationFrame(() => app.classList.add('scale-shift'));
  setTimeout(() => app.classList.remove('scale-shift'), 1800);
}

function renderSubCores() {
  const field = document.getElementById('sub-core-field');
  if (!field) return;
  const lvl = state.upgrades?.nitroFactory ?? 0;
  const coreCount = Math.floor(lvl / 10);
  if (coreCount === lastSubCoreCount) return;
  lastSubCoreCount = coreCount;
  field.innerHTML = '';
  for (let i = 1; i <= coreCount; i++) {
    const eff = Math.min(0.80, i * 0.10);
    const angle = -90 + ((i - 1) / coreCount) * 360;
    const div = document.createElement('div');
    div.className = 'sub-core';
    div.style.setProperty('--angle', `${angle}deg`);
    div.style.setProperty('--eff', String(eff));
    div.title = `Noyau ×${i} · ${Math.round(eff * 100)}% du principal`;
    div.innerHTML = `<div class="sub-core-inner"><span class="sub-core-glyph">⬡</span><span class="sub-core-eff">${Math.round(eff * 100)}%</span></div>`;
    field.appendChild(div);
  }
}

function pulseSubCores() {
  if (!fxEnabled) return;
  document.querySelectorAll('.sub-core-inner').forEach(inner => {
    inner.classList.remove('pulse-hit');
    void inner.offsetWidth;
    inner.classList.add('pulse-hit');
  });
}

function getCoreCenter() {
  const core = document.getElementById('click-core');
  const rect = core?.getBoundingClientRect();
  if (!rect) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function makeLightningPath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = 7;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const jitter = i === 0 || i === steps ? 0 : (Math.random() * 2 - 1) * 22;
    const nx = -dy;
    const ny = dx;
    const len = Math.max(1, Math.hypot(nx, ny));
    points.push({ x: x1 + dx * t + (nx / len) * jitter, y: y1 + dy * t + (ny / len) * jitter });
  }
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

function spawnLightningToElement(element, label = '') {
  if (!fxEnabled || !element) return;
  const layer = document.getElementById('lightning-layer');
  const core = getCoreCenter();
  const rect = element.getBoundingClientRect();
  if (!layer || !core || !rect) return;
  const target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'lightning-bolt');
  path.setAttribute('d', makeLightningPath(core.x, core.y, target.x, target.y));
  layer.appendChild(path);
  setTimeout(() => path.remove(), 520);
  FX.zap();

  if (label) {
    const tag = document.createElement('div');
    tag.className = 'zap-label';
    tag.textContent = label;
    tag.style.left = `${target.x}px`;
    tag.style.top = `${target.y}px`;
    document.body.appendChild(tag);
    setTimeout(() => tag.remove(), 850);
  }
}

function zapToRandomModule() {
  const modules = [...document.querySelectorAll('.spawned-module')];
  if (!modules.length) return;
  spawnLightningToElement(modules[Math.floor(Math.random() * modules.length)]);
}

function lightningStorm(count = 5) {
  const targets = [...document.querySelectorAll('.upgrade-btn:not(.locked), .shell-break-card, .prestige-card, .spawned-module, .factory-node')].sort(() => Math.random() - 0.5).slice(0, count);
  targets.forEach((target, i) => setTimeout(() => spawnLightningToElement(target), i * 70));
}

function renderAll(force = false) {
  renderStats();
  renderCoreShell(force);
  renderScaleCard(force);
  renderUpgrades(force);
  renderMilestones(force);
  renderModules(force);
  renderTendrils(force);
  renderFactories(force);
  renderSubCores();
}

function renderLive() {
  renderStats();
  renderCoreShell();
  renderUpgradesLive();
}

function getNextAffordableCost() {
  const costs = UPGRADES
    .filter(upgrade => isUpgradeUnlocked(state, upgrade))
    .map(upgrade => upgradeBulkCost(upgrade, state.upgrades[upgrade.id] ?? 0, buyMultiplier));
  return Math.min(...costs, prestigeRequirement(state));
}

function renderStats() {
  const layer = getScalingLayer(state);
  const shell = getCoreShellInfo(state);
  const growth = getCoreGrowthLevel(state);
  app.dataset.layer = layer.id;
  app.dataset.coreGrowth = String(growth);
  const corePanel = document.getElementById('core-panel');
  if (corePanel) {
    corePanel.dataset.layer = layer.id;
    corePanel.dataset.shellUnlocked = String(shell.unlocked);
    corePanel.style.setProperty('--core-growth', String(growth));
    corePanel.style.setProperty('--core-shell-fill', String(shell.fillRatio));
    corePanel.style.setProperty('--core-shell-crack', String(shell.crackRatio));
    corePanel.style.setProperty('--core-shell-reflect', String(Math.min(1, shell.reflect)));
  }

  if (lastLayerId && lastLayerId !== layer.id) spawnScaleShift();
  lastLayerId = layer.id;

  setText('stat-energy', fmt(state.energy));
  setText('stat-total-energy', fmt(state.totalEnergy));
  setText('stat-fragments', fmt(state.fragments));
  setText('stat-click', fmt(state.clickPower));
  setText('stat-passive', `${Number(state.passiveRate ?? 0).toFixed(2)}`);
  setText('stat-prestige', fmt(state.prestige));
  setText('stat-surcharge', `${Math.floor((state.surcharge / state.maxSurcharge) * 100)}%`);
  setText('stat-layer', layer.short);
  setText('stat-factory', fmt(state.factoryRate));
  setText('stat-shell', shell.unlocked ? `${shell.storedFragments}/${shell.capacity}` : 'LOCK');

  const nextCost = getNextAffordableCost();
  setMeter('meter-energy', Math.min(1, state.energy / Math.max(1, nextCost)));
  setMeter('meter-total-energy', Math.min(1, state.totalEnergy / Math.max(1, prestigeRequirement(state) * 10)));
  setMeter('meter-fragments', Math.min(1, state.fragments / 25));
  setMeter('meter-click', Math.min(1, state.clickPower / 1000));
  setMeter('meter-passive', Math.min(1, state.passiveRate / 2500));
  setMeter('meter-surcharge', Math.min(1, state.surcharge / Math.max(1, state.maxSurcharge)));
  const tierStart = [...SCALING_LAYERS].reverse().find(l => l.prestige <= state.prestige)?.prestige ?? 0;
  const tierEnd = SCALING_LAYERS.find(l => l.prestige > state.prestige)?.prestige ?? (tierStart + 100);
  setMeter('meter-layer', Math.min(1, (state.prestige - tierStart) / Math.max(1, tierEnd - tierStart)));
  setMeter('meter-factory', Math.min(1, state.factoryRate / 50));
  setMeter('meter-shell', shell.unlocked ? Math.max(shell.fillRatio, shell.crackRatio * 0.35) : 0);

  const req = prestigeRequirement(state);
  const prestigeRatio = Math.min(1, state.energy / Math.max(1, req));
  setMeter('meter-prestige', prestigeRatio);
  setMeter('prestige-fill', prestigeRatio);
  setMeter('reactor-a', Math.min(1, state.surcharge / Math.max(1, state.maxSurcharge)));
  setMeter('reactor-b', Math.min(1, (state.clickPower + state.passiveRate) / 5000));
  setMeter('reactor-c', prestigeRatio);

  const btn = document.getElementById('prestige-btn');
  setText('prestige-cost', `${fmt(state.energy)} / ${fmt(req)}`);
  if (btn) {
    btn.disabled = state.energy < req;
    setClassToggle(btn, 'can-buy', state.energy >= req);
  }

  setHtml('layer-caption', `<strong>${layer.name}</strong><span>${layer.desc}</span>`);
  setText('core-label', layer.id === 'factory' || layer.id === 'district' || layer.id === 'orbital' ? 'RUN FACTORIES' : shell.unlocked ? 'CONTAIN CORE' : 'CLICK CORE');
}

function setMeter(id, ratio) {
  setTransformScaleX(id, ratio);
}

function renderCoreShell(force = false) {
  const shell = getCoreShellInfo(state);
  const signature = `${shell.unlocked}:${shell.capacity}:${shell.hardness}:${shell.storedFragments}:${shell.cracks}:${shell.breakCost}:${shell.breakChance}:${shell.reflect}:${state.energy}`;
  if (!force && signature === lastShellSignature) return;
  lastShellSignature = signature;

  const card = document.getElementById('core-shell-card');
  const btn = document.getElementById('shell-break-btn');
  if (!card || !btn) return;

  if (!shell.unlocked) {
    setHtml(card, `<div class="shell-empty"><strong>Sphère non formée</strong><p>Achète <b>Isolation du noyau</b> pour créer une coque qui stocke les fragments Nitro avant extraction.</p></div>`);
    btn.disabled = true;
    setClassToggle(btn, 'can-buy', false);
    setText('shell-break-cost', 'LOCKED');
    setMeter('shell-break-fill', 0);
    return;
  }

  const canTry = shell.storedFragments > 0 && state.energy >= shell.breakCost;
  setClassToggle(btn, 'can-buy', canTry);
  btn.disabled = !canTry;
  setText('shell-break-cost', `${fmt(shell.breakCost)} E`);
  setText('shell-break-desc', `Chance ${Math.round(shell.breakChance * 100)}% · fissures ${shell.cracks}/${shell.requiredHits} · dureté ${shell.hardness}`);
  setMeter('shell-break-fill', Math.min(1, state.energy / Math.max(1, shell.breakCost)));

  setHtml(card, `
    <div class="shell-grid">
      <div><span>Stockage</span><strong>${shell.storedFragments}/${shell.capacity} F</strong></div>
      <div><span>Dureté</span><strong>${shell.hardness}</strong></div>
      <div><span>Réflexion</span><strong>+${Math.round(shell.reflect * 100)}%</strong></div>
      <div><span>Fissures</span><strong>${shell.cracks}/${shell.requiredHits}</strong></div>
    </div>
    <div class="shell-meter"><i style="transform:scaleX(${shell.fillRatio})"></i><b style="transform:scaleX(${shell.crackRatio})"></b></div>
  `);
}

function getUpgradeSignature() {
  return UPGRADES.map(upgrade => {
    const unlocked = isUpgradeUnlocked(state, upgrade) ? 1 : 0;
    const level = state.upgrades[upgrade.id] ?? 0;
    const currency = upgrade.currency ?? 'energy';
    return `${upgrade.id}:${unlocked}:${level}:${buyMultiplier}:${currency}`;
  }).join('|');
}

function renderUpgrades(force = false) {
  const root = document.getElementById('upgrade-list');
  if (!root) return;
  const signature = getUpgradeSignature();
  if (!force && signature === lastUpgradeSignature && root.children.length) {
    renderUpgradesLive();
    return;
  }
  lastUpgradeSignature = signature;
  setHtml(root, UPGRADES.map(upgrade => renderUpgradeButton(upgrade)).join(''));
  bindUpgradeButtons();
}

function renderUpgradeButton(upgrade) {
  const level = state.upgrades[upgrade.id] ?? 0;
  const unlocked = isUpgradeUnlocked(state, upgrade);
  const currency = upgrade.currency ?? 'energy';
  const held = getCurrency(state, currency);
  const singleCost = upgradeCost(upgrade, level);
  const bulkCost = upgradeBulkCost(upgrade, level, buyMultiplier);
  const canBuySingle = unlocked && held >= singleCost;
  const canBuyBulk = unlocked && held >= bulkCost;
  const progress = unlocked ? Math.min(1, held / Math.max(1, bulkCost)) : 0;
  const lockText = upgrade.lockedText ?? 'Upgrade verrouillé.';

  if (!unlocked) {
    return `
      <button class="upgrade-btn locked" data-upgrade="${upgrade.id}" disabled>
        <span class="upgrade-fill" data-upgrade-fill="${upgrade.id}" style="transform:scaleX(0)"></span>
        <div class="upgrade-head">
          <span class="upgrade-name">??? <small data-upgrade-level="${upgrade.id}">Tier ${upgrade.tier}</small></span>
          <span class="upgrade-cost" data-upgrade-cost="${upgrade.id}">LOCKED</span>
        </div>
        <div class="upgrade-desc">${lockText}</div>
        <div class="upgrade-buy-meta" data-upgrade-meta="${upgrade.id}">Déblocage progressif</div>
      </button>`;
  }

  return `
    <button class="upgrade-btn ${canBuySingle ? 'can-buy' : ''} ${canBuyBulk ? 'can-buy-bulk' : ''}" data-upgrade="${upgrade.id}" ${canBuyBulk ? '' : 'disabled'}>
      <span class="upgrade-fill" data-upgrade-fill="${upgrade.id}" style="transform:scaleX(${progress})"></span>
      <div class="upgrade-head">
        <span class="upgrade-name">${upgrade.icon} ${upgrade.name} <small data-upgrade-level="${upgrade.id}">Lv.${level}</small></span>
        <span class="upgrade-cost" data-upgrade-cost="${upgrade.id}">${fmt(bulkCost)} ${currencyLabel(currency)}</span>
      </div>
      <div class="upgrade-desc">${typeof upgrade.desc === 'function' ? upgrade.desc(state) : upgrade.desc}</div>
      <div class="upgrade-buy-meta" data-upgrade-meta="${upgrade.id}">Achat ×${buyMultiplier} · unité ${fmt(singleCost)} ${currencyLabel(currency)}</div>
    </button>`;
}

function bindUpgradeButtons() {
  document.querySelectorAll('[data-upgrade]:not(.locked)').forEach(btn => {
    btn.addEventListener('click', event => {
      const result = buyUpgradeAmount(state, btn.dataset.upgrade, buyMultiplier);
      if (!result.ok) return toast(result.reason === 'locked' ? 'Upgrade verrouillé.' : `Ressource insuffisante pour ×${buyMultiplier}.`);
      FX.buy();
      spawnModule(btn.dataset.upgrade, result.level);
      spawnLightningToElement(event.currentTarget, `×${result.amount}`);
      spawnEnergyBurst(event.clientX, event.clientY, Math.min(26, 8 + result.amount * 2));
      if (['coreIsolation', 'reflectiveAlloy', 'mirrorGel', 'prismGlass'].includes(btn.dataset.upgrade)) pulseShell('store');
      claimMilestonesAndRender();
      scheduleSave();
      toast(`${result.persistent ? 'Upgrade permanent' : 'Upgrade'} ×${result.amount} acheté · niveau ${result.level}`);
    });
  });
}

function triggerUnlockShimmer(btn) {
  if (!btn) return;
  btn.classList.remove('unlock-shimmer');
  requestAnimationFrame(() => {
    btn.classList.add('unlock-shimmer');
    setTimeout(() => btn.classList.remove('unlock-shimmer'), 750);
  });
}

function refreshUpgradesIfNeeded() {
  const previous = lastUpgradeSignature;
  const signature = getUpgradeSignature();
  if (signature === previous) {
    renderUpgradesLive();
    return;
  }

  const newlyUnlocked = previous ? signature.split('|').some((part, idx) => {
    const prev = (previous.split('|')[idx] ?? '').split(':');
    const next = part.split(':');
    return prev[1] === '0' && next[1] === '1';
  }) : false;

  renderUpgrades(true);

  if (newlyUnlocked) {
    const justUnlocked = [...document.querySelectorAll('.upgrade-btn.can-buy')].at(-1);
    triggerUnlockShimmer(justUnlocked);
  }
}

function renderUpgradesLive() {
  for (const upgrade of UPGRADES) {
    if (!isUpgradeUnlocked(state, upgrade)) continue;
    const level = state.upgrades[upgrade.id] ?? 0;
    const currency = upgrade.currency ?? 'energy';
    const held = getCurrency(state, currency);
    const singleCost = upgradeCost(upgrade, level);
    const bulkCost = upgradeBulkCost(upgrade, level, buyMultiplier);
    const btn = document.querySelector(`[data-upgrade="${upgrade.id}"]`);
    if (!btn) continue;
    setClassToggle(btn, 'can-buy', held >= singleCost);
    setClassToggle(btn, 'can-buy-bulk', held >= bulkCost);
    btn.disabled = held < bulkCost;
    setMeterNode(btn.querySelector(`[data-upgrade-fill="${upgrade.id}"]`), Math.min(1, held / Math.max(1, bulkCost)));
    setText(btn.querySelector(`[data-upgrade-cost="${upgrade.id}"]`), `${fmt(bulkCost)} ${currencyLabel(currency)}`);
    setText(btn.querySelector(`[data-upgrade-meta="${upgrade.id}"]`), `Achat ×${buyMultiplier} · unité ${fmt(singleCost)} ${currencyLabel(currency)}`);
  }
}

function renderScaleCard(force = false) {
  const layer = getScalingLayer(state);
  const signature = `${layer.id}:${layer.mult}:${state.prestige}`;
  if (!force && signature === lastScaleSignature) return;
  lastScaleSignature = signature;
  setHtml('scale-card', `
    <div class="scale-card-main">
      <span class="scale-chip">${layer.short}</span>
      <div><strong>${layer.name}</strong><p>${layer.desc}</p></div>
    </div>
    <div class="scale-card-sub">Multiplicateur d'échelle ×${layer.mult} · prochain dézoom aux prestiges 3 / 10 / 25 / 50</div>
  `);
}

function renderMilestones(force = false) {
  const root = document.getElementById('milestone-list');
  if (!root) return;
  const items = getVisibleMilestones(state);
  const signature = items.map(m => `${m.id}:${state.milestones[m.id] ? 1 : 0}`).join('|');
  if (!force && signature === lastMilestoneSignature) return;
  lastMilestoneSignature = signature;
  setHtml(root, items.map(m => {
    const done = !!state.milestones[m.id];
    const reward = [];
    if (m.reward?.energy) reward.push(`+${fmt(m.reward.energy)} E`);
    if (m.reward?.fragments) reward.push(`+${fmt(m.reward.fragments)} F`);
    return `<div class="milestone ${done ? 'done' : ''}"><span>${done ? '✓' : '◇'}</span><div><strong>${m.label}</strong><small>${m.desc}</small></div><em>${reward.join(' · ')}</em></div>`;
  }).join('') || '<div class="milestone"><span>◇</span><div><strong>Aucun signal</strong><small>Continue à charger le noyau.</small></div></div>');
}

function renderModules(force = false) {
  const orbit = document.getElementById('module-orbit');
  if (!orbit) return;
  const signature = UPGRADES.map(upgrade => `${upgrade.id}:${state.upgrades[upgrade.id] ?? 0}`).join('|');
  if (!force && signature === lastModuleSignature) return;
  lastModuleSignature = signature;
  orbit.innerHTML = '';
  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id] ?? 0;
    const count = Math.min(upgrade.id.includes('Factory') || upgrade.id.includes('Plant') ? 8 : 5, level);
    for (let i = 0; i < count; i++) {
      const node = document.createElement('div');
      node.className = 'spawned-module persistent';
      node.textContent = upgrade.icon;
      node.title = `${upgrade.name} Lv.${level}`;
      node.style.setProperty('--angle', `${((i + 1) / (count + 1)) * 360 + UPGRADES.indexOf(upgrade) * 35}deg`);
      node.style.setProperty('--radius', `${112 + UPGRADES.indexOf(upgrade) * 18}px`);
      orbit.appendChild(node);
    }
  }
}

function renderFactories(force = false) {
  const field = document.getElementById('factory-field');
  if (!field) return;
  const layer = getScalingLayer(state);
  const count = Math.min(28, Math.floor((state.factoryRate ?? 0) + (layer.prestige >= 10 ? 8 : 0)));
  const signature = `${layer.id}:${count}`;
  if (!force && signature === lastFactorySignature) return;
  lastFactorySignature = signature;
  setHtml(field, Array.from({ length: count }, (_, i) => `<span class="factory-node" style="--x:${6 + (i * 17) % 88}%;--y:${12 + (i * 29) % 74}%;--d:${(i * -0.17).toFixed(2)}s">${i % 3 === 0 ? '🏭' : i % 3 === 1 ? '⚙' : '⬡'}</span>`).join(''));
}

function renderTendrils(force = false) {
  const layer = document.getElementById('tendril-layer');
  if (!layer) return;
  const totalLevels = UPGRADES.reduce((sum, upgrade) => sum + (state.upgrades[upgrade.id] ?? 0), 0);
  const count = Math.min(26, 8 + totalLevels + Math.floor(state.prestige / 2));
  const signature = `${totalLevels}:${state.prestige}:${count}`;
  if (!force && signature === lastTendrilSignature) return;
  lastTendrilSignature = signature;
  setHtml(layer, Array.from({ length: count }, (_, i) => {
    const angle = (360 / count) * i + (i % 2 ? 8 : -8);
    const length = 112 + (i % 5) * 20 + Math.min(100, totalLevels * 3 + state.prestige * 2);
    const width = 8 + (i % 3) * 2;
    const delay = -(i * 0.23).toFixed(2);
    return `<span class="bio-tendril" style="--angle:${angle}deg;--len:${length}px;--w:${width}px;--delay:${delay}s"><i></i></span>`;
  }).join(''));
}

function setMeterNode(node, ratio) {
  if (node) setTransformScaleX(node, ratio);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveAll(userId, state), 900);
}

function startLoop() {
  lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const delta = Math.min(2, (now - lastTick) / 1000);
    lastTick = now;
    if (state.passiveRate > 0) tickPassive(state, delta);
    renderLive();
    refreshUpgradesIfNeeded();
    if (fxEnabled && now - lastEnergyPulse > 1800) {
      lastEnergyPulse = now;
      const panel = document.getElementById('core-panel')?.getBoundingClientRect();
      if (panel && state.passiveRate > 0) spawnBouncingBurst(panel.left + panel.width * 0.5, panel.top + panel.height * 0.5, Math.min(8, Math.ceil(state.passiveRate / 4)));
      if (Math.random() > 0.35) zapToRandomModule();
    }
  }, 250);

  setInterval(() => {
    const claimed = checkAndClaimMilestones(state);
    if (claimed.length) claimMilestonesAndRender();
  }, 1000);

  setInterval(() => saveAll(userId, state), 15000);
}

async function fetchDeployBadge() {
  try {
    const r = await fetch('deploy-info.json?t=' + Date.now());
    if (!r.ok) return;
    const d = await r.json();
    const badge = document.getElementById('deploy-badge');
    if (badge) badge.textContent = `#${d.commit}`;
  } catch {}
}

async function init() {
  auth = await requireAuth({ redirectTo: '/login.html' });
  if (!auth) return;

  userId = auth.user.id;
  profile = await getProfile(userId);
  state = loadSave(userId);
  const { gained: offlineGain = 0 } = applyOfflineProgress(state);

  renderShell();
  fetchDeployBadge();
  startLoop();

  window.NitroPrestige = {
    canDo: () => canPrestige(state),
    info: () => ({ energy: state.energy, totalEnergy: state.totalEnergy, req: prestigeRequirement(state) }),
    exec() {
      const btn = document.getElementById('prestige-btn');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    },
  };

  claimMilestonesAndRender();
  if (offlineGain > 0) toast(`Progression hors-ligne : +${fmt(offlineGain)} énergie.`);
}

init().catch(error => {
  console.error('[Nitro Clicker] init failed:', error);
  app.innerHTML = `<section class="auth-error-panel"><div><h1>Erreur Nitro Clicker</h1><p>${error?.message ?? error}</p><a class="nav-btn" href="/star/">Retour Star</a></div></section>`;
});
