const SAVE_PREFIX = 'nitro-clicker.save.';
const PRESTIGE_BASE = 6500;
const PRESTIGE_EARLY_SCALE = 2.05;
const PRESTIGE_LATE_SCALE = 2.3;

function readLatestSave() {
  const keys = Object.keys(localStorage).filter(key => key.startsWith(SAVE_PREFIX));
  let best = null;
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      if (!best || Number(parsed.updatedAt ?? 0) > Number(best.updatedAt ?? 0)) best = parsed;
    } catch {}
  }
  return best ?? null;
}

function prestigeRequirement(prestige = 0) {
  const p = Math.max(0, Number(prestige ?? 0));
  if (p <= 10) return Math.floor(PRESTIGE_BASE * Math.pow(PRESTIGE_EARLY_SCALE, p));
  const p10 = PRESTIGE_BASE * Math.pow(PRESTIGE_EARLY_SCALE, 10);
  return Math.floor(p10 * Math.pow(PRESTIGE_LATE_SCALE, p - 10));
}

function fmt(value) {
  const n = Math.floor(Number(value ?? 0));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('fr-FR');
}

function applyPrestigeButtonFix() {
  const save = readLatestSave();
  const btn = document.getElementById('prestige-btn');
  const cost = document.getElementById('prestige-cost');
  const fill = document.getElementById('prestige-fill');
  const desc = btn?.querySelector('.upgrade-desc');
  if (!save || !btn || !cost || !fill) return;

  const energy = Number(save.energy ?? 0);
  const req = prestigeRequirement(save.prestige ?? 0);
  const ready = energy >= req;
  const ratio = Math.max(0, Math.min(1, energy / Math.max(1, req)));

  cost.textContent = `${fmt(energy)} / ${fmt(req)} E instantanée`;
  fill.style.transform = `scaleX(${ratio})`;
  btn.disabled = !ready;
  btn.classList.toggle('can-buy', ready);
  btn.classList.toggle('prestige-ready', ready);
  btn.title = ready ? 'Prestige prêt' : `Il manque ${fmt(req - energy)} énergie instantanée`;
  if (desc) {
    desc.textContent = 'Reset le run, conserve tes fragments et augmente l’échelle. Le seuil utilise l’énergie instantanée disponible.';
  }
}

setInterval(applyPrestigeButtonFix, 180);
setTimeout(applyPrestigeButtonFix, 250);
setTimeout(applyPrestigeButtonFix, 1000);

window.NitroPrestigeButtonFix = { run: applyPrestigeButtonFix };
