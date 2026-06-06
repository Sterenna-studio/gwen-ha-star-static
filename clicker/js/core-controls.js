const SAVE_PREFIX = 'nitro-clicker.save.';

let mounted = false;
let autoAccumulator = 0;
let lastAutoTick = performance.now();

function mountCoreControls() {
  if (mounted) return;
  const core = document.getElementById('click-core');
  const panel = document.getElementById('core-panel');
  if (!core || !panel) return;
  mounted = true;

  core.classList.add('core-3d-ready');
  panel.classList.add('core-control-ready');
  panel.classList.remove('core-spinning');
  panel.style.removeProperty('--core-rot-z');
  panel.style.removeProperty('--spin-charge');

  requestAnimationFrame(loop);
}

function loop(now) {
  const delta = Math.min(1, (now - lastAutoTick) / 1000);
  lastAutoTick = now;
  runAutoClicker(delta);
  requestAnimationFrame(loop);
}

function runAutoClicker(delta) {
  const level = getAutoClickerLevel();
  if (level <= 0) return;
  const rate = Math.min(12, level * 0.16);
  autoAccumulator += rate * delta;
  while (autoAccumulator >= 1) {
    autoAccumulator -= 1;
    syntheticCoreClick('auto');
  }
}

function syntheticCoreClick(mode = 'auto') {
  const core = document.getElementById('click-core');
  if (!core) return;
  const rect = core.getBoundingClientRect();
  const jitter = mode === 'auto' ? 8 : 12;
  const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * jitter;
  const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * jitter;
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  core.classList.add('auto-click-pulse');
  core.dispatchEvent(event);
  setTimeout(() => core.classList.remove('auto-click-pulse'), 180);
}

function getAutoClickerLevel() {
  const live = document.querySelector('[data-upgrade="autoClicker"] [data-upgrade-level="autoClicker"]');
  const match = live?.textContent?.match(/Lv\.([0-9]+)/i);
  if (match) return Number(match[1]) || 0;

  const save = readLatestSave();
  return Number(save?.upgrades?.autoClicker ?? 0);
}

function readLatestSave() {
  const keys = Object.keys(localStorage).filter(key => key.startsWith(SAVE_PREFIX));
  let best = null;
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (!best || Number(parsed?.updatedAt ?? 0) > Number(best?.updatedAt ?? 0)) best = parsed;
    } catch {}
  }
  return best;
}

const boot = setInterval(() => {
  mountCoreControls();
  if (mounted) clearInterval(boot);
}, 250);

window.NitroCoreControls = {
  autoClick() { syntheticCoreClick('auto'); },
};
