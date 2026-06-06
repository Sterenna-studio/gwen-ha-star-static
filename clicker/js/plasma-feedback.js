let mounted = false;
let lastMeterBuckets = new Map();
let lastStatBuckets = new Map();
let lastMilestoneDone = 0;

function mountPlasmaFeedback() {
  if (mounted) return;
  const core = document.getElementById('click-core');
  const panel = document.getElementById('core-panel');
  if (!core || !panel) return;
  mounted = true;

  const arcLayer = document.createElement('div');
  arcLayer.id = 'plasma-arc-layer';
  arcLayer.className = 'plasma-arc-layer';
  arcLayer.setAttribute('aria-hidden', 'true');
  panel.appendChild(arcLayer);

  core.addEventListener('click', event => {
    triggerPlasmaArc(event.clientX, event.clientY, event.isTrusted ? 5 : 2);
    panel.classList.remove('plasma-click-hit');
    void panel.offsetWidth;
    panel.classList.add('plasma-click-hit');
  });

  setInterval(scanDopamineTriggers, 350);
}

function triggerPlasmaArc(clientX, clientY, count = 4) {
  const panel = document.getElementById('core-panel');
  const layer = document.getElementById('plasma-arc-layer');
  const core = document.getElementById('click-core');
  if (!panel || !layer || !core) return;

  const panelRect = panel.getBoundingClientRect();
  const coreRect = core.getBoundingClientRect();
  const origin = {
    x: Number.isFinite(clientX) ? clientX - panelRect.left : coreRect.left + coreRect.width / 2 - panelRect.left,
    y: Number.isFinite(clientY) ? clientY - panelRect.top : coreRect.top + coreRect.height / 2 - panelRect.top,
  };

  for (let i = 0; i < count; i++) {
    const target = pickArcTarget(coreRect, panelRect);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    path.classList.add('plasma-arc-svg');
    path.setAttribute('viewBox', `0 0 ${panelRect.width} ${panelRect.height}`);
    path.innerHTML = `<path class="plasma-arc-main" d="${makeArcPath(origin.x, origin.y, target.x, target.y)}"/><path class="plasma-arc-glow" d="${makeArcPath(origin.x, origin.y, target.x, target.y)}"/>`;
    layer.appendChild(path);
    setTimeout(() => path.remove(), 460 + Math.random() * 160);
  }
}

function pickArcTarget(coreRect, panelRect) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.min(panelRect.width, panelRect.height) * (0.18 + Math.random() * 0.22);
  const cx = coreRect.left + coreRect.width / 2 - panelRect.left;
  const cy = coreRect.top + coreRect.height / 2 - panelRect.top;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function makeArcPath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const steps = 7;
  const parts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const jitter = i === 0 || i === steps ? 0 : (Math.random() * 2 - 1) * (12 + len * 0.035);
    const x = x1 + dx * t + nx * jitter;
    const y = y1 + dy * t + ny * jitter;
    parts.push(`${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(' ');
}

function scanDopamineTriggers() {
  scanMeters();
  scanStats();
  scanMilestones();
}

function scanMeters() {
  const meters = [
    ['energy', document.getElementById('meter-energy')],
    ['surcharge', document.getElementById('meter-surcharge')],
    ['prestige', document.getElementById('meter-prestige')],
    ['goal', document.getElementById('goal-meter')],
    ['spin', document.getElementById('spin-hud-meter')],
  ];

  for (const [id, node] of meters) {
    if (!node) continue;
    const ratio = readScaleX(node);
    const bucket = Math.floor(ratio * 4); // 25/50/75/100
    const prev = lastMeterBuckets.get(id) ?? bucket;
    if (bucket > prev && ratio >= 0.25) {
      pulseMeter(node, bucket);
      fireRewardBurst(node, bucket >= 4 ? 'MAX' : `${bucket * 25}%`);
    }
    lastMeterBuckets.set(id, bucket);
  }
}

function scanStats() {
  const stats = [
    ['energy', document.getElementById('stat-energy')],
    ['fragments', document.getElementById('stat-fragments')],
    ['prestige', document.getElementById('stat-prestige')],
  ];

  for (const [id, node] of stats) {
    if (!node) continue;
    const value = parseNumber(node.textContent);
    const bucket = value > 0 ? Math.floor(Math.log10(Math.max(1, value))) : 0;
    const prev = lastStatBuckets.get(id) ?? bucket;
    if (bucket > prev) {
      node.closest('.stat-card')?.classList.add('dopamine-stat-pop');
      fireRewardBurst(node.closest('.stat-card') ?? node, id === 'prestige' ? 'PALIER' : '×10');
      setTimeout(() => node.closest('.stat-card')?.classList.remove('dopamine-stat-pop'), 650);
    }
    lastStatBuckets.set(id, bucket);
  }
}

function scanMilestones() {
  const done = document.querySelectorAll('.milestone.done').length;
  if (done > lastMilestoneDone) {
    const target = [...document.querySelectorAll('.milestone.done')].at(-1);
    if (target) fireRewardBurst(target, 'DONE');
  }
  lastMilestoneDone = done;
}

function pulseMeter(node, bucket) {
  const parent = node.parentElement;
  if (!parent) return;
  parent.classList.remove('dopamine-meter-pulse');
  parent.dataset.meterBucket = String(bucket);
  void parent.offsetWidth;
  parent.classList.add('dopamine-meter-pulse');
  setTimeout(() => parent.classList.remove('dopamine-meter-pulse'), 650);
}

function fireRewardBurst(targetNode, label = '') {
  const rect = targetNode.getBoundingClientRect();
  const layer = getBurstLayer();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const badge = document.createElement('span');
  badge.className = 'dopamine-badge';
  badge.textContent = label;
  badge.style.left = `${cx}px`;
  badge.style.top = `${cy}px`;
  layer.appendChild(badge);
  setTimeout(() => badge.remove(), 900);

  for (let i = 0; i < 10; i++) {
    const p = document.createElement('span');
    p.className = 'dopamine-spark';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 80}px`);
    p.style.setProperty('--dy', `${-20 - Math.random() * 70}px`);
    p.style.setProperty('--delay', `${Math.random() * 80}ms`);
    layer.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
}

function getBurstLayer() {
  let layer = document.getElementById('dopamine-burst-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'dopamine-burst-layer';
    layer.className = 'dopamine-burst-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

function readScaleX(node) {
  const raw = node.style.transform || '';
  const match = raw.match(/scaleX\(([-0-9.]+)\)/);
  return match ? Math.max(0, Math.min(1, Number(match[1]) || 0)) : 0;
}

function parseNumber(text) {
  const clean = String(text ?? '').replace(/\s/g, '').replace(',', '.');
  const match = clean.match(/([0-9.]+)([KMB])?/i);
  if (!match) return 0;
  const base = Number(match[1]) || 0;
  const suffix = match[2]?.toUpperCase();
  if (suffix === 'K') return base * 1_000;
  if (suffix === 'M') return base * 1_000_000;
  if (suffix === 'B') return base * 1_000_000_000;
  return base;
}

const boot = setInterval(() => {
  mountPlasmaFeedback();
  if (mounted) clearInterval(boot);
}, 250);

window.NitroPlasmaFeedback = {
  trigger: triggerPlasmaArc,
  burst: fireRewardBurst,
};
