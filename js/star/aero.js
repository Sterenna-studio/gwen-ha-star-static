const body = document.body;
const clock = document.getElementById('aero-clock-value');
const porthole = document.getElementById('aero-porthole');
const status = document.getElementById('aero-action-status');
const speed = document.getElementById('aero-speed-readout');
const shield = document.getElementById('aero-shield-readout');
const traffic = document.getElementById('aero-traffic-value');
const throttle = document.getElementById('aero-throttle');
const alerts = document.getElementById('aero-alerts');

const actionLabels = {
  stabilize: 'STABILISATION ORBITALE',
  scan: 'SCAN ATMOSPHÉRIQUE',
  dock: 'PROCÉDURE DOCKING',
  hyper: 'HYPERDRIVE FLASH',
  aqua: 'MODE AQUA ORBIT'
};

const logToneClass = {
  warning: 'aero-led-warning',
  danger: 'aero-led-danger'
};

function setClock() {
  if (!clock) return;
  const now = new Date();
  clock.textContent = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatSpeed(value) {
  const raw = String(Math.round(3600 + value * 88)).padStart(6, '0');
  return `${raw.slice(0, 2)} ${raw.slice(2, 5)} km/h`;
}

function updateGauges() {
  document.querySelectorAll('.aero-gauge').forEach((gauge) => {
    const base = Number(gauge.dataset.aeroGauge || 80);
    const value = Math.max(42, Math.min(100, Math.round(base + (Math.random() * 6 - 3))));
    const valueNode = gauge.querySelector('.aero-gauge-value');
    const fill = gauge.querySelector('.aero-bar-fill');

    if (valueNode) valueNode.textContent = `${value}%`;
    if (fill) fill.style.width = `${value}%`;
  });

  const thrust = Number(throttle?.value || 62);
  if (speed) speed.textContent = formatSpeed(thrust);
  if (shield) shield.textContent = `${Math.round(92 + Math.random() * 7)}%`;
  if (traffic) traffic.textContent = `${Math.round(8 + Math.random() * 8)} BLIPS`;
}

function pushLog(text, tone = '') {
  if (!alerts) return;

  const row = document.createElement('div');
  const led = document.createElement('span');
  const message = document.createElement('span');
  const time = document.createElement('time');

  row.className = 'aero-alert';
  led.className = ['aero-led', logToneClass[tone]].filter(Boolean).join(' ');
  message.textContent = text;
  time.textContent = 'NOW';

  row.append(led, message, time);
  alerts.prepend(row);

  while (alerts.children.length > 5) {
    alerts.lastElementChild.remove();
  }
}

function runScan() {
  if (!porthole) return;
  porthole.classList.remove('is-scanning');
  window.requestAnimationFrame(() => {
    porthole.classList.add('is-scanning');
  });
  pushLog('Scan visuel du hublot terminé');
}

function runHyperdrive() {
  body.classList.remove('is-hyperjump');
  window.requestAnimationFrame(() => {
    body.classList.add('is-hyperjump');
  });
  pushLog('Pic lumineux hyperdrive simulé', 'warning');
}

function toggleAquaOrbit() {
  body.classList.toggle('is-aqua-orbit');
  const active = body.classList.contains('is-aqua-orbit');
  pushLog(active ? 'Mode Aqua Orbit activé' : 'Mode Aero standard restauré');
}

function handleAction(action) {
  if (status) status.textContent = actionLabels[action] || 'COMMANDE ACTIVE';

  switch (action) {
    case 'scan':
      runScan();
      break;
    case 'hyper':
      runHyperdrive();
      break;
    case 'aqua':
      toggleAquaOrbit();
      break;
    case 'dock':
      pushLog('Alignement docking sur balise Nitro');
      break;
    case 'stabilize':
      pushLog('Assiette orbitale stabilisée');
      break;
    default:
      pushLog('Commande cockpit reçue');
  }
}

document.querySelectorAll('[data-aero-action]').forEach((button) => {
  button.addEventListener('click', () => handleAction(button.dataset.aeroAction));
});

throttle?.addEventListener('input', updateGauges);

setClock();
updateGauges();
setInterval(setClock, 1000);
setInterval(updateGauges, 2200);
