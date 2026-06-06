const SAVE_PREFIX = 'nitro-clicker.save.';
const TANK_STEP = 100_000_000;
const TANK_COUNT = 10;

let mounted = false;
let lastFilled = -1;
let lastStage = '';

const STAGES = [
  {
    min: 0,
    id: 'dormant',
    label: 'SYSTÈME DORMANT',
    objective: 'Objectif : produire 100M énergie cumulée depuis le début du jeu pour remplir la première bonbonne.',
    text: 'Le Gwen Ha Star attend une source Nitro stable.',
  },
  {
    min: 1,
    id: 'charging',
    label: 'BPRD · ACCUMULATION',
    objective: 'Objectif : remplir les 10 bonbonnes BPRD, 100M énergie lifetime chacune. Les resets ne vident pas les bonbonnes.',
    text: 'Les bonbonnes arrière-plan stockent toute l’énergie produite depuis le début du jeu.',
  },
  {
    min: 10,
    id: 'lemegeton_boot',
    label: 'LEMEGETON · BOOT',
    objective: 'Objectif : activer l’auto-clicker et atteindre les prestiges suivants.',
    text: 'Ordinateur de bord chargé. Lancement du programme LEMEGETON. Réparation du Gwen Ha Star enclenchée.',
  },
  {
    min: 12,
    id: 'auto_detected',
    label: 'LEMEGETON · ANOMALIE',
    objective: 'Objectif : renforcer l’auto-clicker pour laisser LEMEGETON analyser les circuits.',
    text: 'LEMEGETON détecte une activité automatisée dans les circuits.',
  },
  {
    min: 16,
    id: 'auto_control',
    label: 'LEMEGETON · CONTRÔLE',
    objective: 'Objectif : laisser LEMEGETON prendre le contrôle du maintien automatique.',
    text: 'LEMEGETON prend le contrôle de l’auto-clicker.',
  },
  {
    min: 22,
    id: 'fusion',
    label: 'FUSION NOYAU/LEMEGETON',
    objective: 'Objectif : poursuivre les prestiges pour synchroniser noyau et ordinateur de bord.',
    text: 'Préparation de la fusion cognitive avec le noyau Nitro.',
  },
  {
    min: 30,
    id: 'cells',
    label: 'DÉMULTIPLICATION CELLULAIRE',
    objective: 'Objectif : multiplier les cellules-noyaux et alimenter le réseau BPRD.',
    text: 'Le noyau se duplique en cellules énergétiques synchronisées.',
  },
  {
    min: 45,
    id: 'ship_power',
    label: 'GWEN HA STAR · RÉSEAU COMPLET',
    objective: 'Objectif final actuel : alimenter le système électrique complet du Gwen Ha Star.',
    text: 'Alimentation progressive du système électrique BPRD, puis du vaisseau complet.',
  },
];

function mount() {
  if (mounted) return;
  const panel = document.getElementById('core-panel');
  const metaPanel = document.querySelector('.meta-panel');
  const shell = document.querySelector('.clicker-shell');
  if (!panel || !shell) return;
  mounted = true;

  if (!document.getElementById('lemegeton-bg')) {
    document.body.insertAdjacentHTML('afterbegin', `
      <div class="lemegeton-bg" id="lemegeton-bg" aria-hidden="true">
        ${Array.from({ length: TANK_COUNT }, (_, i) => `
          <div class="energy-tank" data-tank="${i}">
            <span class="energy-tank-fill"></span>
            <i></i>
            <em>${i + 1}</em>
          </div>
        `).join('')}
      </div>
    `);
  }

  if (!document.getElementById('core-cell-field')) {
    panel.insertAdjacentHTML('afterbegin', '<div class="core-cell-field" id="core-cell-field" aria-hidden="true"></div>');
  }

  const statusHtml = `
    <section class="lemegeton-status" id="lemegeton-status">
      <span id="lemegeton-kicker">BPRD POWER GRID</span>
      <strong id="lemegeton-label">SYSTÈME DORMANT</strong>
      <p id="lemegeton-text">Le Gwen Ha Star attend une source Nitro stable.</p>
      <small id="lemegeton-objective">Objectif : produire 100M énergie lifetime.</small>
      <div class="lemegeton-progress"><b id="lemegeton-progress-fill"></b></div>
      <small id="lemegeton-progress-text">0 / 10 bonbonnes · prochaine 0%</small>
    </section>
  `;

  if (metaPanel && !document.getElementById('lemegeton-status')) {
    metaPanel.insertAdjacentHTML('afterbegin', statusHtml);
  } else if (!document.getElementById('lemegeton-status')) {
    panel.insertAdjacentHTML('afterend', statusHtml);
  }

  update();
  setInterval(update, 700);
}

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

function update() {
  const state = readState();
  const lifetimeEnergy = Number(state.lifetimeEnergy ?? state.totalLifetimeEnergy ?? state.totalEnergy ?? 0);
  const prestige = Number(state.prestige ?? 0);
  const autoLevel = Number(state.upgrades?.autoClicker ?? 0);
  const filled = Math.min(TANK_COUNT, Math.floor(lifetimeEnergy / TANK_STEP));
  const nextProgress = filled >= TANK_COUNT ? 1 : Math.min(1, (lifetimeEnergy % TANK_STEP) / TANK_STEP);

  document.querySelectorAll('.energy-tank').forEach((tank, i) => {
    const fill = tank.querySelector('.energy-tank-fill');
    const ratio = i < filled ? 1 : i === filled ? nextProgress : 0;
    tank.classList.toggle('filled', ratio >= 1);
    tank.classList.toggle('revealed', i <= filled || lifetimeEnergy >= i * TANK_STEP * 0.7);
    if (fill) fill.style.transform = `scaleY(${ratio})`;
  });

  if (filled > lastFilled) {
    lastFilled = filled;
    pulseTank(filled - 1);
    if (filled === TANK_COUNT) dispatchLoreWave('LEMEGETON ONLINE');
  }

  const stage = getStage(filled, prestige, autoLevel);
  const panel = document.getElementById('core-panel');
  if (panel) {
    panel.dataset.lemegetonStage = stage.id;
    panel.style.setProperty('--cell-count', String(getCellCount(filled, prestige)));
  }

  const label = document.getElementById('lemegeton-label');
  const text = document.getElementById('lemegeton-text');
  const objective = document.getElementById('lemegeton-objective');
  const progressFill = document.getElementById('lemegeton-progress-fill');
  const progressText = document.getElementById('lemegeton-progress-text');
  if (label) label.textContent = stage.label;
  if (text) text.textContent = stage.text;
  if (objective) objective.textContent = stage.objective;
  if (progressFill) progressFill.style.transform = `scaleX(${Math.min(1, lifetimeEnergy / (TANK_STEP * TANK_COUNT))})`;
  if (progressText) progressText.textContent = `${filled} / ${TANK_COUNT} bonbonnes · prochaine ${Math.floor(nextProgress * 100)}% · ${formatEnergy(lifetimeEnergy)} lifetime`;

  if (stage.id !== lastStage) {
    lastStage = stage.id;
    dispatchLoreWave(stage.label);
  }

  renderCoreCells(filled, prestige);
}

function getStage(filled, prestige, autoLevel) {
  let powerIndex = filled;
  if (filled >= 10) powerIndex += Math.floor(prestige / 3);
  if (autoLevel > 0 && filled >= 10) powerIndex = Math.max(powerIndex, 12);
  if (autoLevel >= 10 && filled >= 10) powerIndex = Math.max(powerIndex, 16);
  return [...STAGES].reverse().find(stage => powerIndex >= stage.min) ?? STAGES[0];
}

function getCellCount(filled, prestige) {
  if (filled < 10) return 0;
  return Math.min(18, 2 + Math.floor(prestige / 2) + Math.floor((filled - 10) / 2));
}

function renderCoreCells(filled, prestige) {
  const field = document.getElementById('core-cell-field');
  if (!field) return;
  const target = getCellCount(filled, prestige);
  if (field.children.length === target) return;
  field.innerHTML = Array.from({ length: target }, (_, i) => `
    <span class="core-cell" style="--i:${i};--a:${(360 / Math.max(1, target)) * i}deg;--r:${112 + (i % 4) * 24}px"></span>
  `).join('');
}

function pulseTank(index) {
  const tank = document.querySelector(`[data-tank="${index}"]`);
  if (!tank) return;
  tank.classList.remove('tank-just-filled');
  void tank.offsetWidth;
  tank.classList.add('tank-just-filled');
}

function dispatchLoreWave(text) {
  const panel = document.getElementById('core-panel');
  if (!panel) return;
  const node = document.createElement('div');
  node.className = 'lemegeton-wave';
  node.textContent = text;
  panel.appendChild(node);
  setTimeout(() => node.remove(), 2200);
}

function formatEnergy(value) {
  const n = Math.floor(Number(value ?? 0));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

const boot = setInterval(() => {
  mount();
  if (mounted) clearInterval(boot);
}, 250);

window.NitroLemegeton = { update };
