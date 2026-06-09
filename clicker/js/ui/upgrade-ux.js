const GUIDE_KEY = 'nitro-clicker.guide.v1.seen';
const ACTIVE_SHOP_KEY = 'nitro-clicker.upgrade-shop.active';

const GROUPS = [
  { id: 'core', title: 'NOYAU', subtitle: 'Clic, flux stable et modules organiques.', upgrades: ['clickAmplifier', 'autoCore', 'resonance', 'prism', 'bioConduit'] },
  { id: 'shell', title: 'COQUE', subtitle: 'Isolation, matériaux réflecteurs, stockage et fissures.', upgrades: ['coreIsolation', 'reflectiveAlloy', 'mirrorGel', 'prismGlass'] },
  { id: 'overdrive', title: 'OVERDRIVE', subtitle: 'Surcharge et explosions énergétiques.', upgrades: ['surchargeCoil'] },
  { id: 'automation', title: 'AUTO', subtitle: 'Clics automatiques, surcharge et LEMEGETON.', upgrades: ['autoClicker'] },
  { id: 'fragments', title: 'FRAGMENTS', subtitle: 'Bonus permanents et rupture de coque.', upgrades: ['fragmentCatalyst', 'fractureTuning'] },
  { id: 'infrastructure', title: 'INFRA', subtitle: 'Noyaux dupliqués, production et réseau orbital.', upgrades: ['nitroFactory', 'enginePlant', 'orbitalHive'] },
];

const UPGRADE_INFO = {
  clickAmplifier: { tip: 'Augmente la valeur de chaque clic manuel. Très fort au début.', stat: '+ puissance / clic' },
  autoCore: { tip: 'Production passive stable. Ne déclenche pas l’Overdrive directement.', stat: '+ énergie / seconde' },
  autoClicker: { tip: 'Simule des clics automatiques : charge la surcharge et peut déclencher des Overdrives.', stat: '+ clics auto / surcharge' },
  resonance: { tip: 'Améliore à la fois le clic et le flux passif.', stat: '+ clic + passif' },
  surchargeCoil: { tip: 'Augmente la capacité de surcharge et accélère l’accès à l’Overdrive.', stat: '+ surcharge / overdrive' },
  coreIsolation: { tip: 'Crée une sphère autour du noyau. Les fragments peuvent y être stockés avant rupture.', stat: '+ coque + stockage' },
  reflectiveAlloy: { tip: 'Couche miroir qui renvoie l’énergie vers le noyau et augmente la dureté globale.', stat: '+ réflexion + dureté' },
  mirrorGel: { tip: 'Gel biopunk réflectif. Plus de stockage et meilleur rendement.', stat: '+ stockage + rendement' },
  prismGlass: { tip: 'Couche cristalline avancée : forte réflexion, stockage, mais sphère plus dure.', stat: '+ verre prismatique' },
  prism: { tip: 'Stabilise le noyau et donne un gros gain de puissance global.', stat: '+ gros bonus hybride' },
  bioConduit: { tip: 'Renforce les conduits organiques autour du noyau. Gros gain passif.', stat: '+ passif + stabilité' },
  fractureTuning: { tip: 'Permanent : améliore les chances de rupture et réduit les coups nécessaires.', stat: '+ rupture de coque' },
  fragmentCatalyst: { tip: 'Permanent : multiplicateur global conservé après prestige.', stat: '+ multiplicateur permanent' },
  nitroFactory: { tip: '+1 noyau tous les 10 niveaux. Copies à 10%→80% du noyau principal — puissant mais plafonné.', stat: '× noyaux dupliqués' },
  enginePlant: { tip: 'Transforme la production en chaîne moteur massive.', stat: '+ production industrielle' },
  orbitalHive: { tip: 'Réseau orbital pour préparer les paliers très hauts.', stat: '+ réseau orbital' },
};

let organizing = false;
let lastLevels = new Map();
let guideStep = 0;
let guideActive = false;
let activeShop = localStorage.getItem(ACTIVE_SHOP_KEY) || 'core';

function mountUpgradeUx() {
  const root = document.getElementById('upgrade-list');
  if (!root || root.dataset.upgradeUxMounted) return;
  root.dataset.upgradeUxMounted = 'true';
  new MutationObserver(() => organizeUpgradeList()).observe(root, { childList: true });
  organizeUpgradeList();

  document.addEventListener('click', event => {
    const tab = event.target.closest?.('[data-upgrade-shop-tab]');
    if (tab) {
      event.preventDefault();
      setActiveShop(tab.dataset.upgradeShopTab);
      return;
    }

    const info = event.target.closest?.('[data-upgrade-info]');
    if (info) {
      event.preventDefault();
      event.stopPropagation();
      showInfoBubble(info, info.dataset.upgradeInfo);
      return;
    }

    const upgradeButton = event.target.closest?.('[data-upgrade]');
    if (upgradeButton && !upgradeButton.classList.contains('locked')) {
      setTimeout(() => detectUpgradeStatChanges(), 80);
      maybeAdvanceGuide(upgradeButton.dataset.upgrade);
    }
  }, true);

  setTimeout(showInitialGuide, 800);
}

function organizeUpgradeList() {
  if (organizing) return;
  const root = document.getElementById('upgrade-list');
  if (!root) return;
  const rawButtons = [...root.children].filter(node => node.matches?.('.upgrade-btn'));
  if (!rawButtons.length) return;

  organizing = true;
  const buttonsById = new Map(rawButtons.map(button => [button.dataset.upgrade, button]));
  const fragment = document.createDocumentFragment();

  const tabs = document.createElement('nav');
  tabs.className = 'upgrade-shop-tabs';
  tabs.innerHTML = GROUPS.map(group => `<button type="button" class="upgrade-shop-tab ${activeShop === group.id ? 'active' : ''}" data-upgrade-shop-tab="${group.id}">${group.title}</button>`).join('');
  fragment.appendChild(tabs);

  for (const group of GROUPS) {
    const groupButtons = group.upgrades.map(id => buttonsById.get(id)).filter(Boolean);
    if (!groupButtons.length) continue;
    const section = document.createElement('section');
    section.className = `upgrade-group upgrade-group-${group.id} ${activeShop === group.id ? 'active' : ''}`;
    section.dataset.upgradeGroup = group.id;
    section.innerHTML = `<header class="upgrade-group-head"><div><strong>${group.title}</strong><small>${group.subtitle}</small></div></header>`;
    const list = document.createElement('div');
    list.className = 'upgrade-group-list';
    groupButtons.forEach(button => {
      enhanceUpgradeButton(button);
      list.appendChild(button);
      buttonsById.delete(button.dataset.upgrade);
    });
    section.appendChild(list);
    fragment.appendChild(section);
  }

  for (const button of buttonsById.values()) {
    enhanceUpgradeButton(button);
    fragment.appendChild(button);
  }
  root.replaceChildren(fragment);
  organizing = false;
  detectUpgradeStatChanges(true);
}

function setActiveShop(id) {
  activeShop = GROUPS.some(group => group.id === id) ? id : 'core';
  localStorage.setItem(ACTIVE_SHOP_KEY, activeShop);
  document.querySelectorAll('[data-upgrade-shop-tab]').forEach(tab => tab.classList.toggle('active', tab.dataset.upgradeShopTab === activeShop));
  document.querySelectorAll('[data-upgrade-group]').forEach(group => group.classList.toggle('active', group.dataset.upgradeGroup === activeShop));
}

function enhanceUpgradeButton(button) {
  const id = button.dataset.upgrade;
  if (!id || button.dataset.upgradeUxEnhanced) return;
  button.dataset.upgradeUxEnhanced = 'true';
  button.classList.add(`upgrade-type-${getGroupForUpgrade(id)}`);
  const info = UPGRADE_INFO[id];
  const desc = button.querySelector('.upgrade-desc');
  if (desc && info) desc.innerHTML = `${desc.textContent}<span class="upgrade-effect-line">${info.stat}</span>`;
  const head = button.querySelector('.upgrade-head');
  if (head && info && !button.classList.contains('locked')) {
    const bubble = document.createElement('span');
    bubble.className = 'upgrade-info-dot';
    bubble.dataset.upgradeInfo = id;
    bubble.textContent = 'i';
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');
    bubble.setAttribute('aria-label', `Info ${id}`);
    head.appendChild(bubble);
  }
}

function getGroupForUpgrade(id) { return GROUPS.find(group => group.upgrades.includes(id))?.id ?? 'misc'; }

function showInfoBubble(anchor, upgradeId) {
  const info = UPGRADE_INFO[upgradeId];
  if (!info) return;
  document.querySelector('.upgrade-info-pop')?.remove();
  const rect = anchor.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'upgrade-info-pop';
  pop.innerHTML = `<strong>${info.stat}</strong><p>${info.tip}</p>`;
  pop.style.left = `${Math.min(window.innerWidth - 260, rect.left - 210)}px`;
  pop.style.top = `${rect.bottom + 8}px`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 4200);
}

function detectUpgradeStatChanges(initial = false) {
  document.querySelectorAll('[data-upgrade]:not(.locked)').forEach(button => {
    const id = button.dataset.upgrade;
    const levelNode = button.querySelector(`[data-upgrade-level="${id}"]`);
    const level = Number(levelNode?.textContent?.match(/Lv\.([0-9]+)/)?.[1] ?? 0);
    const previous = lastLevels.get(id);
    lastLevels.set(id, level);
    if (initial || previous === undefined || level <= previous) return;
    triggerStatMutation(button, level - previous);
  });
}

function triggerStatMutation(button, delta = 1) {
  button.classList.remove('upgrade-stat-mutated');
  void button.offsetWidth;
  button.classList.add('upgrade-stat-mutated');
  const tag = document.createElement('span');
  tag.className = 'upgrade-mutation-tag';
  tag.textContent = delta > 1 ? `+${delta} LV` : '+STAT';
  button.appendChild(tag);
  setTimeout(() => tag.remove(), 980);
  setTimeout(() => button.classList.remove('upgrade-stat-mutated'), 980);
}

function showInitialGuide() {
  if (localStorage.getItem(GUIDE_KEY) === '1' || guideActive) return;
  guideActive = true;
  showGuideCard({ title: 'Bienvenue dans Nitro Clicker', text: 'Clique le noyau, puis utilise les onglets de boutique pour améliorer le noyau, la coque, l’Overdrive et les systèmes permanents.', action: 'Compris' });
}

function maybeAdvanceGuide(upgradeId) {
  if (localStorage.getItem(GUIDE_KEY) === '1') return;
  guideStep += 1;
  if (guideStep === 1) showGuideCard({ title: 'Premier upgrade installé', text: 'Chaque onglet correspond à une logique différente. Le noyau produit, l’auto-clicker déclenche, la coque stocke, les fragments rendent permanent.', action: 'Continuer' });
  if (upgradeId === 'coreIsolation') showGuideCard({ title: 'Coque de confinement formée', text: 'Les prochains fragments peuvent être stockés dans la sphère. Une fois chargée, tente de la briser avec un pic d’énergie.', action: 'OK' });
  if (upgradeId === 'autoClicker' || guideStep >= 4) showGuideCard({ title: 'Automatisation détectée', text: 'L’auto-clicker simule des clics : il charge la surcharge et prépare les Overdrives automatisés.', action: 'OK', done: true });
}

function showGuideCard({ title, text, action = 'OK', done = false }) {
  document.querySelector('.guide-pop')?.remove();
  const node = document.createElement('aside');
  node.className = 'guide-pop';
  node.innerHTML = `<div class="guide-pop-kicker">ASSISTANT DE BORD</div><strong>${title}</strong><p>${text}</p><button type="button">${action}</button>`;
  document.body.appendChild(node);
  node.querySelector('button').addEventListener('click', () => {
    node.remove();
    if (done) localStorage.setItem(GUIDE_KEY, '1');
  });
}

const boot = setInterval(() => {
  mountUpgradeUx();
  if (document.getElementById('upgrade-list')?.dataset.upgradeUxMounted) clearInterval(boot);
}, 250);

window.NitroUpgradeUx = { resetGuide() { localStorage.removeItem(GUIDE_KEY); guideStep = 0; showInitialGuide(); }, setShop: setActiveShop };
