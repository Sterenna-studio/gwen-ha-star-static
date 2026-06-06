// Offline production gate.
// Before the ship is operational, closing the page should not farm passive energy.
// This runs before app.js so applyOfflineProgress() sees a fresh lastTickAt.

const SAVE_PREFIX = 'nitro-clicker.save.';
const NOTICE_KEY = 'nitro-clicker.offlineFarm.blockedNotice';
const SHIP_TOTAL_ENERGY_REQUIREMENT = 1_000_000_000; // 10 BPRD tanks × 100M
const SHIP_PRESTIGE_REQUIREMENT = 25; // district-level power grid

function isShipOperationalForOffline(save) {
  const totalEnergy = Number(save?.totalEnergy ?? 0);
  const prestige = Number(save?.prestige ?? 0);
  return totalEnergy >= SHIP_TOTAL_ENERGY_REQUIREMENT || prestige >= SHIP_PRESTIGE_REQUIREMENT;
}

function secondsSinceLastTick(save, now = Date.now()) {
  return Math.max(0, Math.floor((now - Number(save?.lastTickAt ?? now)) / 1000));
}

function blockOfflineFarmUntilShipOnline() {
  const now = Date.now();
  const keys = Object.keys(localStorage).filter(key => key.startsWith(SAVE_PREFIX));
  for (const key of keys) {
    try {
      const save = JSON.parse(localStorage.getItem(key) || 'null');
      if (!save || isShipOperationalForOffline(save)) continue;
      const elapsed = secondsSinceLastTick(save, now);
      save.lastTickAt = now;
      save.updatedAt = Math.max(Number(save.updatedAt ?? 0), now);
      save.offlineFarmLocked = true;
      localStorage.setItem(key, JSON.stringify(save));
      if (elapsed > 60 && Number(save.passiveRate ?? 0) > 0) {
        sessionStorage.setItem(NOTICE_KEY, JSON.stringify({ elapsed, at: now }));
      }
    } catch (error) {
      console.warn('[Nitro Clicker] offline farm gate skipped save:', key, error);
    }
  }
}

function mountOfflineNotice() {
  const raw = sessionStorage.getItem(NOTICE_KEY);
  if (!raw) return;
  const app = document.getElementById('app');
  if (!app || !document.querySelector('.topbar')) return;
  sessionStorage.removeItem(NOTICE_KEY);
  let elapsed = 0;
  try { elapsed = JSON.parse(raw)?.elapsed ?? 0; } catch {}
  const minutes = Math.max(1, Math.floor(elapsed / 60));
  const node = document.createElement('div');
  node.className = 'offline-gate-toast';
  node.innerHTML = `
    <strong>FARM HORS-LIGNE VERROUILLÉ</strong>
    <span>${minutes} min ignorées · le vaisseau doit atteindre le niveau de fonctionnement avant de produire fermé.</span>
  `;
  app.appendChild(node);
  setTimeout(() => node.remove(), 6200);
}

blockOfflineFarmUntilShipOnline();

const noticeBoot = setInterval(() => {
  mountOfflineNotice();
  if (document.querySelector('.topbar')) clearInterval(noticeBoot);
}, 300);

window.NitroOfflinePolicy = {
  isShipOperationalForOffline,
  requirements: {
    totalEnergy: SHIP_TOTAL_ENERGY_REQUIREMENT,
    prestige: SHIP_PRESTIGE_REQUIREMENT,
  },
};
