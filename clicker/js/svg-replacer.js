import { UPGRADES } from './clicker-state.js';
import { svgIcon, upgradeIcon } from './svg-icons.js';

const UPGRADE_BY_ID = new Map(UPGRADES.map(upgrade => [upgrade.id, upgrade]));
const UPGRADE_BY_NAME = new Map(UPGRADES.map(upgrade => [upgrade.name, upgrade]));

const pendingRoots = new Set();
let scheduled = false;
let observer = null;
let observedRoot = null;

function run() {
  scheduled = false;
  const roots = pendingRoots.size ? [...pendingRoots] : [document.getElementById('app') ?? document.body];
  pendingRoots.clear();

  for (const root of roots) {
    if (!root || !root.querySelectorAll) continue;
    replaceCoreGlyphs(root);
    replaceUpgradeIcons(root);
    replaceModuleIcons(root);
    replaceFactoryIcons(root);
    replaceMilestoneIcons(root);
    replaceActionIcons(root);
  }
}

function schedule(root = null) {
  if (root) pendingRoots.add(root.nodeType === Node.ELEMENT_NODE ? root : document.getElementById('app') ?? document.body);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(run);
}

function replaceCoreGlyphs(root) {
  root.querySelectorAll('.core-glyph:not([data-svg-ready])').forEach(node => {
    node.dataset.svgReady = 'true';
    node.innerHTML = svgIcon('core', 'nc-svg-icon nc-svg-core', 'Noyau Nitro');
  });

  root.querySelectorAll('.loading-orb:not([data-svg-ready])').forEach(node => {
    node.dataset.svgReady = 'true';
    node.innerHTML = svgIcon('core', 'nc-svg-icon nc-svg-core', 'Chargement Nitro');
  });
}

function replaceUpgradeIcons(root) {
  root.querySelectorAll('[data-upgrade]').forEach(button => {
    const id = button.dataset.upgrade;
    const upgrade = UPGRADE_BY_ID.get(id);
    const nameNode = button.querySelector('.upgrade-name');
    if (!nameNode || nameNode.dataset.svgReady === 'true') return;

    const levelNode = nameNode.querySelector('small');
    const levelHtml = levelNode ? levelNode.outerHTML : '';
    const isLocked = button.classList.contains('locked');
    nameNode.dataset.svgReady = 'true';
    nameNode.classList.add('upgrade-name-svg');

    if (isLocked || !upgrade) {
      nameNode.innerHTML = `${svgIcon('core', 'nc-svg-icon nc-svg-upgrade locked-svg')} <span class="upgrade-label">???</span> ${levelHtml}`;
      return;
    }

    nameNode.innerHTML = `${upgradeIcon(id, 'nc-svg-icon nc-svg-upgrade')} <span class="upgrade-label">${escapeHtml(upgrade.name)}</span> ${levelHtml}`;
  });

  const prestige = root.querySelector('#prestige-btn .upgrade-name:not([data-svg-ready])');
  if (prestige) {
    prestige.dataset.svgReady = 'true';
    prestige.classList.add('upgrade-name-svg');
    prestige.innerHTML = `${svgIcon('prestige', 'nc-svg-icon nc-svg-upgrade')} <span class="upgrade-label">Surcharge contrôlée</span>`;
  }
}

function replaceModuleIcons(root) {
  root.querySelectorAll('.spawned-module:not([data-svg-ready])').forEach(node => {
    const title = node.getAttribute('title') ?? '';
    const upgrade = [...UPGRADE_BY_NAME.entries()].find(([name]) => title.startsWith(name))?.[1];
    node.dataset.svgReady = 'true';
    node.innerHTML = upgradeIcon(upgrade?.id ?? 'core', 'nc-svg-icon nc-svg-module');
  });
}

function replaceFactoryIcons(root) {
  root.querySelectorAll('.factory-node:not([data-svg-ready])').forEach((node, index) => {
    const raw = node.textContent.trim();
    node.dataset.svgReady = 'true';
    const icon = raw.includes('🏭') ? 'nitroFactory' : raw.includes('⚛️') ? 'core' : raw.includes('⚙') ? 'enginePlant' : index % 3 === 2 ? 'core' : 'nitroFactory';
    node.innerHTML = svgIcon(icon, 'nc-svg-icon nc-svg-factory');
  });
}

function replaceMilestoneIcons(root) {
  root.querySelectorAll('.milestone > span:not([data-svg-ready])').forEach(node => {
    const done = node.textContent.includes('✓');
    node.dataset.svgReady = 'true';
    node.innerHTML = svgIcon(done ? 'milestoneDone' : 'milestoneOpen', 'nc-svg-icon nc-svg-milestone');
  });
}

function replaceActionIcons(root) {
  const fx = root.querySelector('#fx-toggle');
  if (fx && fx.dataset.svgReady !== 'true') {
    const isOn = fx.textContent.includes('ON');
    fx.dataset.svgReady = 'true';
    fx.innerHTML = `${svgIcon('fx', 'nc-svg-icon nc-svg-inline')} ${isOn ? 'FX ON' : 'FX OFF'}`;
  }

  const save = root.querySelector('#save-btn');
  if (save && save.dataset.svgReady !== 'true') {
    save.dataset.svgReady = 'true';
    save.innerHTML = `${svgIcon('save', 'nc-svg-icon nc-svg-inline')} SAUVER LOCAL`;
  }

  root.querySelectorAll('.stat-value.fragment:not([data-svg-stat])').forEach(node => {
    node.dataset.svgStat = 'true';
    node.insertAdjacentHTML('beforebegin', `<div class="stat-icon-bg">${svgIcon('fragment', 'nc-svg-icon nc-svg-stat-bg')}</div>`);
  });
}

function mountObserver() {
  const root = document.getElementById('app') ?? document.body;
  if (!root || observedRoot === root) return;
  observer?.disconnect();
  observedRoot = root;
  observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        schedule(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  schedule(root);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

const boot = setInterval(() => {
  mountObserver();
  if (observedRoot?.id === 'app') clearInterval(boot);
}, 200);

window.NitroSvgReplacer = {
  run: () => schedule(document.getElementById('app') ?? document.body),
  schedule,
};
