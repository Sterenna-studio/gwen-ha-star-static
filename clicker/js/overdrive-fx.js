const MAX_SHARDS = 140;
let running = false;

function triggerOverdriveFracture() {
  if (running) return;
  const core = document.getElementById('click-core');
  const panel = document.getElementById('core-panel');
  if (!core || !panel) return;

  running = true;
  core.classList.remove('overdrive-fracture');
  panel.classList.remove('overdrive-window-blast');
  void core.offsetWidth;
  core.classList.add('overdrive-fracture');
  panel.classList.add('overdrive-window-blast');

  const coreRect = core.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const origin = {
    x: coreRect.left + coreRect.width / 2,
    y: coreRect.top + coreRect.height / 2,
  };

  spawnEnergyNova(origin, panelRect);
  spawnCoreSplinters(origin, coreRect);
  spawnEscapingShards(origin, panelRect);
  spawnShockRings(origin, panelRect);

  setTimeout(() => {
    core.classList.remove('overdrive-fracture');
    panel.classList.remove('overdrive-window-blast');
    running = false;
  }, 1650);
}

function getLayer() {
  let layer = document.getElementById('overdrive-shard-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'overdrive-shard-layer';
    layer.className = 'overdrive-shard-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  while (layer.children.length > MAX_SHARDS) layer.firstElementChild?.remove();
  return layer;
}

function spawnEnergyNova(origin, panelRect) {
  const layer = getLayer();
  const count = 48;
  const radius = Math.max(panelRect.width, panelRect.height) * 0.92;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.16;
    const distance = radius * (0.38 + Math.random() * 0.62);
    const beam = document.createElement('span');
    beam.className = 'overdrive-nova-beam';
    beam.style.left = `${origin.x}px`;
    beam.style.top = `${origin.y}px`;
    beam.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    beam.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    beam.style.setProperty('--rot', `${angle}rad`);
    beam.style.setProperty('--len', `${80 + Math.random() * 170}px`);
    beam.style.setProperty('--delay', `${Math.random() * 90}ms`);
    layer.appendChild(beam);
    setTimeout(() => beam.remove(), 1150);
  }

  const coreFlash = document.createElement('span');
  coreFlash.className = 'overdrive-core-nova';
  coreFlash.style.left = `${origin.x}px`;
  coreFlash.style.top = `${origin.y}px`;
  layer.appendChild(coreFlash);
  setTimeout(() => coreFlash.remove(), 850);
}

function spawnCoreSplinters(origin, coreRect) {
  const layer = getLayer();
  const count = 26;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
    const distance = 58 + Math.random() * (coreRect.width * 0.46);
    const shard = document.createElement('span');
    shard.className = 'overdrive-core-splinter';
    shard.style.left = `${origin.x}px`;
    shard.style.top = `${origin.y}px`;
    shard.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    shard.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    shard.style.setProperty('--rot', `${Math.random() * 620 - 310}deg`);
    shard.style.setProperty('--scale', `${0.72 + Math.random() * 1.05}`);
    shard.style.setProperty('--delay', `${Math.random() * 70}ms`);
    layer.appendChild(shard);
    setTimeout(() => shard.remove(), 1250);
  }
}

function spawnEscapingShards(origin, panelRect) {
  const layer = getLayer();
  const count = 44;
  for (let i = 0; i < count; i++) {
    const side = i % 4;
    const target = getExitTarget(side, panelRect);
    const dx = target.x - origin.x + (Math.random() - 0.5) * 200;
    const dy = target.y - origin.y + (Math.random() - 0.5) * 200;
    const shard = document.createElement('span');
    shard.className = `overdrive-energy-shard shard-side-${side}`;
    shard.style.left = `${origin.x}px`;
    shard.style.top = `${origin.y}px`;
    shard.style.setProperty('--dx', `${dx}px`);
    shard.style.setProperty('--dy', `${dy}px`);
    shard.style.setProperty('--rot', `${Math.random() * 900 - 450}deg`);
    shard.style.setProperty('--len', `${36 + Math.random() * 72}px`);
    shard.style.setProperty('--delay', `${Math.random() * 120}ms`);
    layer.appendChild(shard);
    setTimeout(() => shard.remove(), 1500);
  }
}

function spawnShockRings(origin, panelRect) {
  const layer = getLayer();
  for (let i = 0; i < 4; i++) {
    const ring = document.createElement('span');
    ring.className = 'overdrive-shock-ring';
    ring.style.left = `${origin.x}px`;
    ring.style.top = `${origin.y}px`;
    ring.style.setProperty('--size', `${Math.max(panelRect.width, panelRect.height) * (0.32 + i * 0.24)}px`);
    ring.style.setProperty('--delay', `${i * 75}ms`);
    layer.appendChild(ring);
    setTimeout(() => ring.remove(), 1250);
  }

  const flash = document.createElement('span');
  flash.className = 'overdrive-window-flash';
  flash.style.left = `${panelRect.left}px`;
  flash.style.top = `${panelRect.top}px`;
  flash.style.width = `${panelRect.width}px`;
  flash.style.height = `${panelRect.height}px`;
  layer.appendChild(flash);
  setTimeout(() => flash.remove(), 900);
}

function getExitTarget(side, rect) {
  const pad = 150;
  if (side === 0) return { x: rect.left + Math.random() * rect.width, y: rect.top - pad - Math.random() * 160 };
  if (side === 1) return { x: rect.right + pad + Math.random() * 210, y: rect.top + Math.random() * rect.height };
  if (side === 2) return { x: rect.left + Math.random() * rect.width, y: rect.bottom + pad + Math.random() * 160 };
  return { x: rect.left - pad - Math.random() * 210, y: rect.top + Math.random() * rect.height };
}

const observer = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.classList.contains('system-wave') && /OVERDRIVE/i.test(node.textContent ?? '')) {
        triggerOverdriveFracture();
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

window.NitroOverdriveFX = { trigger: triggerOverdriveFracture };
