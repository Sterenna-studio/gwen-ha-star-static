const SAVE_PREFIX = 'nitro-clicker.save.';

function readState() {
  const keys = Object.keys(localStorage).filter(key => key.startsWith(SAVE_PREFIX));
  let best = null;
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (!best || Number(parsed?.updatedAt ?? 0) > Number(best?.updatedAt ?? 0)) best = parsed;
    } catch {}
  }
  return best ?? {};
}

function prestigeRequirement(prestige = 0) {
  const p = Math.max(0, Number(prestige ?? 0));
  const base = 6500;
  if (p <= 10) return Math.floor(base * Math.pow(2.05, p));
  const p10 = base * Math.pow(2.05, 10);
  return Math.floor(p10 * Math.pow(2.3, p - 10));
}

function format(value) {
  const n = Math.floor(Number(value ?? 0));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('fr-FR');
}

function updatePrestigeUi() {
  const state = readState();
  const btn = document.getElementById('prestige-btn');
  const cost = document.getElementById('prestige-cost');
  const fill = document.getElementById('prestige-fill');
  const desc = btn?.querySelector('.upgrade-desc');
  if (!btn || !cost || !fill) return;

  const energy = Number(state.energy ?? 0);
  const req = prestigeRequirement(state.prestige ?? 0);
  const ready = energy >= req;
  cost.textContent = `${format(energy)} / ${format(req)} E instantanée`;
  fill.style.transform = `scaleX(${Math.min(1, energy / Math.max(1, req))})`;
  btn.disabled = !ready;
  btn.classList.toggle('can-buy', ready);
  if (desc) desc.textContent = 'Reset le run, conserve les fragments, augmente l’échelle. Seuil basé sur l’énergie instantanée disponible, pas le cumul lifetime.';
}

setInterval(updatePrestigeUi, 250);
window.NitroPrestigeCurrentEnergy = { update: updatePrestigeUi };
