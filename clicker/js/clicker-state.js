export const VERSION = 9;

export const BALANCE = {
  prestigeBase: 6500,
  prestigeEarlyScale: 2.05,
  prestigeLateScale: 2.3,
  passiveOfflineCapHours: 8,
  overdriveBase: 16,
  overdrivePerLevel: 2.7,
  overdrivePassiveSeconds: 8,
  fragmentBaseChance: 0.08,
  fragmentPrestigeChance: 0.006,
  fragmentOverdriveChance: 0.014,
  fragmentChanceCap: 0.45,
  shellBaseBreakCost: 1250,
  shellBreakCostScale: 1.34,
  // Bonus de chance de fragment lié à la coque (déclenchement Overdrive uniquement)
  shellFragmentBonusBase: 0.035,
  shellFragmentBonusMax: 0.045,
  shellFragmentBonusPerCapacity: 0.004,
  autoClickGainRatio: 0.58,
  autoClickSurchargeRatio: 0.85,
  autoClickMaxBurstsPerTick: 12,
};

export const SCALING_LAYERS = [
  { id: 'core', prestige: 0, name: 'Noyau unique', short: 'CORE', desc: 'Tu stabilises un seul réacteur Nitro vivant.', mult: 1 },
  { id: 'engine_bay', prestige: 3, name: 'Baie moteur', short: 'BAY', desc: 'Plusieurs modules commencent à tourner autour du noyau.', mult: 1.32 },
  { id: 'factory', prestige: 10, name: 'Multiplicateur de noyau', short: 'CORE×', desc: 'Le noyau se duplique. Copies à 10%→80% du noyau principal.', mult: 2.15 },
  { id: 'district', prestige: 25, name: 'District énergétique', short: 'DISTRICT', desc: 'Le réseau alimente un quartier entier du hub Star.', mult: 4.55 },
  { id: 'orbital', prestige: 50, name: 'Anneau orbital', short: 'ORBITAL', desc: 'Production à échelle orbitale : les usines deviennent un essaim.', mult: 10.2 },
];

export function createDefaultState(userId = null) {
  return {
    version: VERSION,
    userId,
    energy: 0,
    totalEnergy: 0,
    lifetimeEnergy: 0,
    fragments: 0,
    totalFragments: 0,
    clickPower: 1,
    passiveRate: 0,
    autoClickRate: 0,
    autoClickAccumulator: 0,
    prestige: 0,
    totalClicks: 0,
    surcharge: 0,
    maxSurcharge: 100,
    surchargeGain: 5,
    overdriveLevel: 0,
    overdriveCount: 0,
    factoryRate: 0,
    permanentMultiplier: 1,
    coreShellCapacity: 0,
    coreShellHardness: 0,
    coreShellReflect: 0,
    coreShellBreakBonus: 0,
    coreShell: { storedFragments: 0, cracks: 0, lastBreakAt: 0, failedBreaks: 0 },
    upgrades: {
      clickAmplifier: 0,
      autoCore: 0,
      autoClicker: 0,
      resonance: 0,
      surchargeCoil: 0,
      prism: 0,
      bioConduit: 0,
      coreIsolation: 0,
      reflectiveAlloy: 0,
      mirrorGel: 0,
      prismGlass: 0,
      fractureTuning: 0,
      fragmentCatalyst: 0,
      nitroFactory: 0,
      enginePlant: 0,
      orbitalHive: 0,
    },
    milestones: {},
    lemegetonSkills: {},
    lemegetonToggles: {},
    lastTickAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Arbre de compétences LEMEGETON ────────────────────────────────────────
// Compétences permanentes achetées en FRAGMENTS, survivant au prestige.
// S'activent une fois LEMEGETON en ligne (1 Md énergie cumulée ou Prestige 10).
export const LEMEGETON_ONLINE_LIFETIME = 1_000_000_000;

export function isLemegetonOnline(state) {
  const lifetime = Number(state?.lifetimeEnergy ?? state?.totalEnergy ?? 0);
  return lifetime >= LEMEGETON_ONLINE_LIFETIME || Number(state?.prestige ?? 0) >= 10;
}

export const LEMEGETON_SKILLS = [
  {
    id: 'overclock', name: 'Surcadence', icon: '🌀', kind: 'leveled',
    baseCost: 10, scale: 1.5, maxLevel: 30, perLevel: 0.04,
    desc(state) {
      const lvl = lemegetonSkillLevel(state, 'overclock');
      return `+4% production globale par niveau (clic · passif · usine). Actuel : +${Math.round(lvl * 4)}%.`;
    },
    unlock: state => isLemegetonOnline(state),
    lockedText: 'Nécessite LEMEGETON en ligne (1 Md énergie cumulée ou Prestige 10).',
  },
  {
    id: 'autoPurchase', name: 'Auto-achat', icon: '🧠', kind: 'unlock', toggleable: true,
    cost: 35,
    desc: 'LEMEGETON améliore seul les systèmes automatiques : noyau automatique et auto-clicker de maintien.',
    unlock: state => isLemegetonOnline(state),
    lockedText: 'Nécessite LEMEGETON en ligne (1 Md énergie cumulée ou Prestige 10).',
  },
  {
    id: 'fragmentResonance', name: 'Résonance fragmentaire', icon: '💠', kind: 'leveled',
    baseCost: 14, scale: 1.55, maxLevel: 25, perLevel: 0.05,
    desc(state) {
      const lvl = lemegetonSkillLevel(state, 'fragmentResonance');
      return `+5% de fragments gagnés (prestige & brisure de coque) par niveau. Actuel : +${Math.round(lvl * 5)}%.`;
    },
    unlock: state => isLemegetonOnline(state) && Number(state?.prestige ?? 0) >= 3,
    lockedText: 'Nécessite LEMEGETON en ligne et Prestige 3.',
  },
  {
    id: 'critOverdrive', name: 'Surcharge critique', icon: '💥', kind: 'leveled',
    baseCost: 18, scale: 1.6, maxLevel: 12,
    desc(state) {
      const lvl = lemegetonSkillLevel(state, 'critOverdrive');
      if (lvl === 0) return 'Un overdrive sur N devient CRITIQUE (×gain massif). N diminue et le multiplicateur monte par niveau.';
      return `1 overdrive sur ${getCritOverdriveInterval(state)} est CRITIQUE ×${getCritOverdriveMultiplier(state).toFixed(1)}.`;
    },
    unlock: state => isLemegetonOnline(state) && Number(state?.prestige ?? 0) >= 5,
    lockedText: 'Nécessite LEMEGETON en ligne et Prestige 5.',
  },
  {
    id: 'offlineGrid', name: 'Grille offline', icon: '🛰️', kind: 'unlock',
    cost: 80,
    desc: 'LEMEGETON maintient le réseau hors-ligne : cap de farm offline porté de 8 h à 24 h.',
    unlock: state => isLemegetonOnline(state) && Number(state?.prestige ?? 0) >= 10,
    lockedText: 'Nécessite LEMEGETON en ligne et Prestige 10.',
  },
];

export function lemegetonSkillLevel(state, id) {
  return Math.max(0, Math.floor(Number(state?.lemegetonSkills?.[id] ?? 0)));
}

export function isLemegetonSkillUnlocked(state, skill) {
  return skill.unlock ? !!skill.unlock(state) : true;
}

export function lemegetonSkillCost(skill, level) {
  if (skill.kind === 'unlock') return skill.cost;
  return Math.floor(skill.baseCost * Math.pow(skill.scale, level));
}

export function isLemegetonSkillMaxed(state, skill) {
  const lvl = lemegetonSkillLevel(state, skill.id);
  return skill.kind === 'unlock' ? lvl >= 1 : lvl >= (skill.maxLevel ?? Infinity);
}

export function buyLemegetonSkill(state, skillId) {
  const skill = LEMEGETON_SKILLS.find(s => s.id === skillId);
  if (!skill) return { ok: false, reason: 'unknown_skill' };
  if (!isLemegetonSkillUnlocked(state, skill)) return { ok: false, reason: 'locked' };
  if (isLemegetonSkillMaxed(state, skill)) return { ok: false, reason: 'maxed' };

  const level = lemegetonSkillLevel(state, skill.id);
  const cost = lemegetonSkillCost(skill, level);
  if (Number(state.fragments ?? 0) < cost) return { ok: false, reason: 'not_enough_fragments', cost };

  state.fragments -= cost;
  if (!state.lemegetonSkills) state.lemegetonSkills = {};
  state.lemegetonSkills[skill.id] = level + 1;
  recalcDerivedStats(state);
  state.updatedAt = Date.now();
  return { ok: true, cost, level: level + 1, skill };
}

// Effets dérivés des compétences (lus par recalc, la boucle de jeu et l'offline)
export function getLemegetonProdMultiplier(state) {
  return 1 + lemegetonSkillLevel(state, 'overclock') * 0.04;
}
export function getFragmentGainMultiplier(state) {
  return 1 + lemegetonSkillLevel(state, 'fragmentResonance') * 0.05;
}
// Compétences activables/désactivables (toggleable) : actives par défaut une
// fois achetées, mises en pause si le joueur le décide.
export function isLemegetonSkillActive(state, id) {
  if (lemegetonSkillLevel(state, id) < 1) return false;
  return state?.lemegetonToggles?.[id] !== false;
}
export function toggleLemegetonSkill(state, id) {
  const skill = LEMEGETON_SKILLS.find(s => s.id === id);
  if (!skill?.toggleable || lemegetonSkillLevel(state, id) < 1) return { ok: false };
  if (!state.lemegetonToggles) state.lemegetonToggles = {};
  const next = !isLemegetonSkillActive(state, id);
  state.lemegetonToggles[id] = next;
  state.updatedAt = Date.now();
  return { ok: true, active: next };
}
export function isAutoPurchaseEnabled(state) {
  return isLemegetonSkillActive(state, 'autoPurchase');
}
export function getCritOverdriveInterval(state) {
  const lvl = lemegetonSkillLevel(state, 'critOverdrive');
  if (lvl <= 0) return 0;
  return Math.max(10, 50 - (lvl - 1) * 4); // Lv.1 : 1/50 · Lv.11+ : 1/10
}
export function getCritOverdriveMultiplier(state) {
  const lvl = lemegetonSkillLevel(state, 'critOverdrive');
  return lvl <= 0 ? 1 : 5 + lvl * 1.5; // Lv.1 : ×6.5 · Lv.12 : ×23
}
export function getOfflineCapHours(state) {
  return lemegetonSkillLevel(state, 'offlineGrid') >= 1 ? 24 : BALANCE.passiveOfflineCapHours;
}

export const UPGRADES = [
  {
    id: 'clickAmplifier', name: 'Amplificateur de clic', icon: '⚡', baseCost: 14, scale: 1.30, currency: 'energy', tier: 0,
    desc: '+1.15 puissance de clic par niveau. Très rentable en début de run.',
    unlock: () => true,
    apply(state) { state.clickPower += 1.15; },
  },
  {
    id: 'autoCore', name: 'Noyau automatique', icon: '⬡', baseCost: 65, scale: 1.40, currency: 'energy', tier: 0,
    desc: '+0.55 énergie / seconde par niveau. Production passive stable.',
    unlock: () => true,
    apply(state) { state.passiveRate += 0.55; },
  },
  {
    id: 'autoClicker', name: 'Auto-clicker de maintien', icon: '◌', baseCost: 180, scale: 1.45, currency: 'energy', tier: 1,
    desc: 'Simule des clics automatiques : charge la surcharge, déclenche l\'Overdrive, aide LEMEGETON.',
    unlock: state => state.totalEnergy >= 220 || state.prestige >= 1,
    lockedText: 'Débloqué à 220 énergie totale.',
    apply(state) { state.autoClickRate += 0.22; state.surchargeGain += 0.18; state.overdriveLevel += 0.25; },
  },
  {
    id: 'resonance', name: 'Résonance Star', icon: '✦', baseCost: 300, scale: 1.50, currency: 'energy', tier: 1,
    desc: '+3.5 clic et +1/s. Débloque le réacteur vivant.',
    unlock: state => state.totalEnergy >= 360 || state.prestige >= 1,
    lockedText: 'Débloqué à 360 énergie totale.',
    apply(state) { state.clickPower += 3.5; state.passiveRate += 1; },
  },
  {
    id: 'surchargeCoil', name: 'Bobine de surcharge', icon: '🧬', baseCost: 620, scale: 1.45, currency: 'energy', tier: 1,
    desc: '+10 capacité de surcharge, +2 charge par clic. Overdrive plus fréquent.',
    unlock: state => state.totalEnergy >= 720 || state.prestige >= 1,
    lockedText: 'Débloqué à 720 énergie totale.',
    apply(state) { state.maxSurcharge += 10; state.surchargeGain += 2; state.overdriveLevel += 1; },
  },
  {
    id: 'coreIsolation', name: 'Isolation du noyau', icon: '◉', baseCost: 950, scale: 1.38, currency: 'energy', tier: 2,
    desc: 'Crée une sphère de confinement. +2 stockage fragment, +1 dureté, +8 surcharge.',
    unlock: state => state.totalEnergy >= 1000 || state.prestige >= 1,
    lockedText: 'Débloqué à 1 000 énergie totale : première coque de confinement.',
    apply(state) { state.coreShellCapacity += 2; state.coreShellHardness += 1; state.maxSurcharge += 8; },
  },
  {
    id: 'reflectiveAlloy', name: 'Alliage réflecteur', icon: '⬣', baseCost: 2400, scale: 1.42, currency: 'energy', tier: 2,
    desc: 'Matériau miroir : +1 stockage, +1 dureté, +4.5% rendement, +1.8/s.',
    unlock: state => (state.upgrades?.coreIsolation ?? 0) >= 1 || state.totalEnergy >= 3600 || state.prestige >= 1,
    lockedText: 'Nécessite Isolation du noyau Lv.1.',
    apply(state) { state.coreShellCapacity += 1; state.coreShellHardness += 1; state.coreShellReflect += 0.045; state.passiveRate += 1.8; },
  },
  {
    id: 'mirrorGel', name: 'Gel miroir vivant', icon: '◍', baseCost: 6800, scale: 1.48, currency: 'energy', tier: 3,
    desc: 'Gel biopunk réflectif : +2 stockage, +1 dureté, +7.5% rendement, fissures plus visibles.',
    unlock: state => (state.upgrades?.reflectiveAlloy ?? 0) >= 2 || state.totalEnergy >= 12000 || state.prestige >= 2,
    lockedText: 'Nécessite Alliage réflecteur Lv.2 ou 12 000 énergie totale.',
    apply(state) { state.coreShellCapacity += 2; state.coreShellHardness += 1; state.coreShellReflect += 0.075; state.passiveRate += 5; state.clickPower += 5; },
  },
  {
    id: 'prism', name: 'Prisme Nitro', icon: '◆', baseCost: 1400, scale: 1.54, currency: 'energy', tier: 2,
    desc: '+10 clic et +3/s. Stabilise les flux biopunk.',
    unlock: state => state.totalEnergy >= 1800 || state.prestige >= 1,
    lockedText: 'Débloqué à 1 800 énergie totale.',
    apply(state) { state.clickPower += 10; state.passiveRate += 3; },
  },
  {
    id: 'prismGlass', name: 'Verre prismatique', icon: '◇', baseCost: 18000, scale: 1.50, currency: 'energy', tier: 3,
    desc: 'Couche cristalline : +2 stockage, +1 dureté, +10% rendement.',
    unlock: state => (state.upgrades?.mirrorGel ?? 0) >= 1 && (state.upgrades?.prism ?? 0) >= 1 || state.totalEnergy >= 38000 || state.prestige >= 3,
    lockedText: 'Nécessite Gel miroir + Prisme Nitro, ou 38 000 énergie totale.',
    apply(state) { state.coreShellCapacity += 2; state.coreShellHardness += 1; state.coreShellReflect += 0.10; state.passiveRate += 10; state.clickPower += 9; },
  },
  {
    id: 'bioConduit', name: 'Conduit organique', icon: '🫀', baseCost: 4300, scale: 1.52, currency: 'energy', tier: 2,
    desc: '+7 clic, +9.5/s, tentacules plus denses.',
    unlock: state => (state.upgrades?.prism ?? 0) >= 2 || state.totalEnergy >= 6000 || state.prestige >= 2,
    lockedText: 'Débloqué avec Prisme Nitro Lv.2 ou 6 000 énergie totale.',
    apply(state) { state.clickPower += 7; state.passiveRate += 9.5; state.maxSurcharge += 5; },
  },
  {
    id: 'fractureTuning', name: 'Accord de fracture', icon: '✧', baseCost: 3, scale: 1.45, currency: 'fragments', tier: 3, persistent: true,
    desc: 'Upgrade permanent : augmente les chances de briser la sphère et réduit les coups requis.',
    unlock: state => state.totalFragments >= 1 || state.prestige >= 1,
    lockedText: 'Nécessite au moins un Fragment Nitro découvert.',
    apply(state) { state.coreShellBreakBonus += 0.085; state.permanentMultiplier += 0.03; },
  },
  {
    id: 'fragmentCatalyst', name: 'Catalyseur de fragments', icon: '💠', baseCost: 3, scale: 1.45, currency: 'fragments', tier: 3, persistent: true,
    desc: 'Upgrade permanent : +6.5% multiplicateur global par niveau. Survit aux resets du noyau.',
    unlock: state => state.fragments >= 1 || state.totalFragments >= 1 || state.prestige >= 1,
    lockedText: 'Débloqué après ton premier Fragment Nitro.',
    apply(state) { state.permanentMultiplier += 0.065; },
  },
  {
    id: 'nitroFactory', name: 'Multiplicateur de noyau', icon: '⚛️', baseCost: 62000, scale: 1.42, currency: 'energy', tier: 4,
    desc(state) {
      const lvl = state?.upgrades?.nitroFactory ?? 0;
      const cores = Math.floor(lvl / 10);
      if (cores === 0) return '+1 noyau dupliqué tous les 10 niveaux · copies à 10%→80% du noyau principal.';
      const mult = state?.coreMultiplier ?? 1;
      const nextIn = lvl % 10 === 0 ? 10 : 10 - (lvl % 10);
      return `${cores} noyau${cores > 1 ? 'x' : ''} actif${cores > 1 ? 's' : ''} · ×${mult.toFixed(2)} puissance · prochain dans ${nextIn} niveaux.`;
    },
    unlock: state => state.prestige >= 10,
    lockedText: 'Débloqué au Prestige 10 : le noyau devient multiplicable.',
    apply(_state) { /* effet géré dans recalcDerivedStats via coreMultiplier */ },
  },
  {
    id: 'enginePlant', name: 'Chaîne de production moteur', icon: '⚙️', baseCost: 900000, scale: 1.38, currency: 'energy', tier: 5,
    desc(state) {
      const lvl = state?.upgrades?.enginePlant ?? 0;
      if (lvl === 0) return 'Allume l’usine : +75 énergie/s industrielle par niveau, amplifiée par tes noyaux dupliqués.';
      const rate = Math.round(state?.factoryRate ?? 0);
      return `Usine active · ${rate.toLocaleString('fr-FR')} é/s industrielle · +75 é/s par niveau (×noyaux).`;
    },
    unlock: state => state.prestige >= 20,
    lockedText: 'Débloqué au Prestige 20.',
    apply(state) { state.clickPower += 140; state.passiveRate += 200; state.factoryRate += 75; },
  },
  {
    id: 'orbitalHive', name: 'Ruche orbitale Nitro', icon: '🛰️', baseCost: 6200000, scale: 1.48, currency: 'energy', tier: 6,
    desc(state) {
      const lvl = state?.upgrades?.orbitalHive ?? 0;
      if (lvl === 0) return 'Essaim orbital : +300 é/s industrielle et +10% production usine par niveau.';
      return `Essaim ×${lvl} · +${lvl * 10}% production usine · +300 é/s par niveau.`;
    },
    unlock: state => state.prestige >= 50,
    lockedText: 'Débloqué au Prestige 50.',
    apply(state) { state.clickPower += 560; state.passiveRate += 800; state.factoryRate += 300; state.factoryMult += 0.10; state.maxSurcharge += 50; },
  },
];

export const MILESTONES = [
  { id: 'energy_100', label: 'Premier allumage', desc: 'Atteindre 100 énergie totale.', test: s => s.totalEnergy >= 100, reward: { energy: 80 } },
  { id: 'energy_1000', label: 'Réacteur vivant', desc: 'Atteindre 1 000 énergie totale.', test: s => s.totalEnergy >= 1000, reward: { fragments: 2 } },
  { id: 'clicks_250', label: 'Main nerveuse', desc: 'Faire 250 clics.', test: s => s.totalClicks >= 250, reward: { energy: 900 } },
  { id: 'passive_10', label: 'Flux stable', desc: 'Atteindre 10 énergie/seconde.', test: s => s.passiveRate >= 10, reward: { fragments: 3 } },
  { id: 'shell_first_stack', label: 'Fragment confiné', desc: 'Stocker un fragment dans la sphère isolante.', test: s => (s.coreShell?.storedFragments ?? 0) >= 1, reward: { energy: 2500 } },
  { id: 'shell_first_break', label: 'Brisure Nitro', desc: 'Briser la sphère de confinement.', test: s => (s.coreShell?.lastBreakAt ?? 0) > 0, reward: { fragments: 3 } },
  { id: 'first_prestige', label: 'Surcharge contrôlée', desc: 'Atteindre le Prestige 1.', test: s => s.prestige >= 1, reward: { fragments: 5 } },
  { id: 'prestige_3', label: 'Baie moteur', desc: 'Atteindre le Prestige 3.', test: s => s.prestige >= 3, reward: { fragments: 8 } },
  { id: 'prestige_10', label: 'Dézoom industriel', desc: 'Atteindre le Prestige 10.', test: s => s.prestige >= 10, reward: { fragments: 26, energy: 70000 } },
  { id: 'prestige_25', label: 'District énergétique', desc: 'Atteindre le Prestige 25.', test: s => s.prestige >= 25, reward: { fragments: 70 } },
];

export function getScalingLayer(state) {
  const prestige = state?.prestige ?? 0;
  return [...SCALING_LAYERS].reverse().find(layer => prestige >= layer.prestige) ?? SCALING_LAYERS[0];
}

export function isPersistentUpgrade(upgrade) {
  return !!upgrade?.persistent || upgrade?.currency === 'fragments';
}

export function getPersistentUpgradeLevels(state) {
  return Object.fromEntries(UPGRADES.filter(isPersistentUpgrade).map(upgrade => [upgrade.id, Math.max(0, Number(state?.upgrades?.[upgrade.id] ?? 0))]));
}

export function isUpgradeUnlocked(state, upgrade) {
  return upgrade.unlock ? !!upgrade.unlock(state) : true;
}

export function upgradeCost(upgrade, level) {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.scale, level));
}

export function upgradeBulkCost(upgrade, level, amount = 1) {
  const qty = Math.max(1, Math.floor(Number(amount) || 1));
  let total = 0;
  for (let i = 0; i < qty; i++) total += upgradeCost(upgrade, level + i);
  return total;
}

export function getCurrency(state, currency = 'energy') {
  return currency === 'fragments' ? state.fragments : state.energy;
}

export function spendCurrency(state, currency, amount) {
  if (currency === 'fragments') state.fragments -= amount;
  else state.energy -= amount;
}

function addEnergy(state, amount) {
  const gain = Math.max(0, Number(amount) || 0);
  if (gain <= 0) return 0;
  state.energy += gain;
  state.totalEnergy += gain;
  state.lifetimeEnergy = Math.max(0, Number(state.lifetimeEnergy ?? 0)) + gain;
  return gain;
}

export function addFragments(state, amount) {
  const gain = Math.max(0, Math.floor(amount));
  state.fragments += gain;
  state.totalFragments += gain;
  return gain;
}

export function hydrateState(raw, userId = null) {
  const base = createDefaultState(userId);
  const merged = { ...base, ...(raw ?? {}) };
  merged.upgrades = { ...base.upgrades, ...(raw?.upgrades ?? {}) };
  merged.milestones = { ...base.milestones, ...(raw?.milestones ?? {}) };
  merged.lemegetonSkills = { ...base.lemegetonSkills, ...(raw?.lemegetonSkills ?? {}) };
  merged.lemegetonToggles = { ...base.lemegetonToggles, ...(raw?.lemegetonToggles ?? {}) };
  merged.coreShell = { ...base.coreShell, ...(raw?.coreShell ?? {}) };
  merged.fragments = Number(merged.fragments ?? 0);
  merged.totalFragments = Number(merged.totalFragments ?? merged.fragments ?? 0);
  merged.totalClicks = Number(merged.totalClicks ?? 0);
  merged.surcharge = Number(merged.surcharge ?? 0);
  merged.autoClickRate = Number(merged.autoClickRate ?? 0);
  merged.autoClickAccumulator = Number(merged.autoClickAccumulator ?? 0);
  merged.lifetimeEnergy = Math.max(0, Number(merged.lifetimeEnergy ?? raw?.totalLifetimeEnergy ?? raw?.totalEnergy ?? raw?.energy ?? 0));
  merged.coreShell.storedFragments = Math.max(0, Number(merged.coreShell.storedFragments ?? 0));
  merged.coreShell.cracks = Math.max(0, Number(merged.coreShell.cracks ?? 0));
  merged.userId = userId ?? merged.userId;
  // ORDER MATTERS: recalcDerivedStats doit précéder le clamp storedFragments
  recalcDerivedStats(merged);
  // FIX #3 : clamp avec trace de l'overflow pour éviter perte silencieuse sur vieux saves
  const shellCapacity = getCoreShellInfo(merged).capacity;
  const shellOverflow = Math.max(0, merged.coreShell.storedFragments - shellCapacity);
  if (shellOverflow > 0) {
    merged.coreShell.storedFragments = shellCapacity;
    // Les fragments en excès sont rendus au joueur plutôt que perdus
    merged.fragments += shellOverflow;
    merged.totalFragments += shellOverflow;
  }
  return merged;
}

export function recalcDerivedStats(state) {
  const layer = getScalingLayer(state);
  state.clickPower = (1 + state.prestige) * layer.mult;
  state.passiveRate = state.prestige * 0.14 * layer.mult;
  state.autoClickRate = 0;
  state.maxSurcharge = 100;
  state.surchargeGain = 5;
  state.overdriveLevel = 0;
  state.factoryRate = 0;
  state.factoryMult = 1;
  state.permanentMultiplier = 1;
  state.coreShellCapacity = 0;
  state.coreShellHardness = 0;
  state.coreShellReflect = 0;
  state.coreShellBreakBonus = 0;

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id] ?? 0;
    for (let i = 0; i < level; i++) upgrade.apply(state);
  }

  // ── Multiplicateur de noyau (nitroFactory) ──────────────────────────────
  // +1 noyau par tranche de 10 niveaux. Noyau i : min(i×10%, 80%) du principal.
  const nitroLvl = state.upgrades?.nitroFactory ?? 0;
  let coreMult = 1;
  for (let i = 10; i <= nitroLvl; i += 10) {
    coreMult += Math.min(0.80, (i / 10) * 0.10);
  }
  state.coreMultiplier = coreMult;

  const reflectMultiplier = 1 + Math.min(1.35, state.coreShellReflect ?? 0);
  state.clickPower  *= state.permanentMultiplier * reflectMultiplier * coreMult;
  state.passiveRate *= state.permanentMultiplier * reflectMultiplier * coreMult;
  state.autoClickRate *= state.permanentMultiplier;
  // Production industrielle : source d'énergie/s réelle (tickPassive + offline).
  // Boostée par le mult permanent, l'essaim orbital (factoryMult) et les noyaux.
  state.factoryRate   *= state.permanentMultiplier * (state.factoryMult ?? 1) * coreMult;

  // Surcadence (compétence LEMEGETON) : +% production globale, persistant.
  const lemeProd = getLemegetonProdMultiplier(state);
  if (lemeProd !== 1) {
    state.clickPower    *= lemeProd;
    state.passiveRate   *= lemeProd;
    state.autoClickRate *= lemeProd;
    state.factoryRate   *= lemeProd;
  }

  state.surcharge = Math.min(state.surcharge ?? 0, state.maxSurcharge);
}

export function getCoreGrowthLevel(state) {
  const upgradeLevels = Object.values(state?.upgrades ?? {}).reduce((sum, value) => sum + Math.max(0, Number(value ?? 0)), 0);
  const energyStage = Math.floor(Math.log10(Math.max(1, Number(state?.totalEnergy ?? 0))) / 2);
  return Math.max(0, Math.min(24, upgradeLevels + energyStage + Math.floor((state?.prestige ?? 0) / 2)));
}

export function getCoreShellInfo(state) {
  const capacity = Math.max(0, Math.floor(Number(state?.coreShellCapacity ?? 0)));
  const hardness = Math.max(0, Math.floor(Number(state?.coreShellHardness ?? 0)));
  const stored = Math.max(0, Math.floor(Number(state?.coreShell?.storedFragments ?? 0)));
  const cracks = Math.max(0, Math.floor(Number(state?.coreShell?.cracks ?? 0)));
  const breakCost = getCoreShellBreakCost(state);
  const requiredHits = getCoreShellRequiredHits(state);
  const breakChance = getCoreShellBreakChance(state);
  return {
    unlocked: capacity > 0,
    capacity,
    hardness,
    storedFragments: Math.min(stored, capacity),
    fillRatio: capacity > 0 ? Math.min(1, stored / capacity) : 0,
    cracks,
    crackRatio: requiredHits > 0 ? Math.min(1, cracks / requiredHits) : 0,
    requiredHits,
    breakCost,
    breakChance,
    reflect: Math.max(0, Number(state?.coreShellReflect ?? 0)),
  };
}

export function getCoreShellBreakCost(state) {
  const hardness = Math.max(0, Number(state?.coreShellHardness ?? 0));
  // FIX: Math.max(0, stored) au lieu de Math.max(1, stored || 1)
  // stored=0 et stored=1 avaient le même coût — désormais le coût croît bien dès stored=1
  const stored = Math.max(0, Number(state?.coreShell?.storedFragments ?? 0));
  const hardnessFactor = Math.pow(BALANCE.shellBreakCostScale, Math.max(0, hardness - 1));
  const storedFactor = 0.8 + Math.max(0, stored) * 0.85;
  return Math.floor(BALANCE.shellBaseBreakCost * hardnessFactor * storedFactor);
}

export function getCoreShellRequiredHits(state) {
  const hardness = Math.max(0, Number(state?.coreShellHardness ?? 0));
  const tuning = Math.max(0, Number(state?.upgrades?.fractureTuning ?? 0));
  return Math.max(1, Math.ceil(1 + hardness * 0.42 - tuning * 0.45));
}

export function getCoreShellBreakChance(state) {
  const hardness = Math.max(0, Number(state?.coreShellHardness ?? 0));
  const tuning = Math.max(0, Number(state?.upgrades?.fractureTuning ?? 0));
  const cracks = Math.max(0, Number(state?.coreShell?.cracks ?? 0));
  const stored = Math.max(0, Number(state?.coreShell?.storedFragments ?? 0));
  const capacity = Math.max(1, Number(state?.coreShellCapacity ?? 1));
  const base = 0.28 + tuning * 0.08 + cracks * 0.09 + (stored / capacity) * 0.10 - hardness * 0.012 + (state?.coreShellBreakBonus ?? 0);
  return Math.max(0.12, Math.min(0.90, base));
}

// Chance de drop de fragment à l'Overdrive uniquement (pas par clic normal)
export function getFragmentDropChanceOnOverdrive(state) {
  const shell = getCoreShellInfo(state);
  const shellBonus = shell.unlocked
    ? BALANCE.shellFragmentBonusBase + Math.min(BALANCE.shellFragmentBonusMax, shell.capacity * BALANCE.shellFragmentBonusPerCapacity)
    : 0;
  return Math.min(
    BALANCE.fragmentBaseChance
      + state.prestige * BALANCE.fragmentPrestigeChance
      + state.overdriveLevel * BALANCE.fragmentOverdriveChance
      + shellBonus,
    BALANCE.fragmentChanceCap,
  );
}

// Alias rétrocompat — à supprimer lors d'un futur nettoyage
export const getFragmentDropChance = getFragmentDropChanceOnOverdrive;

export function storeCoreShellFragments(state, amount = 1) {
  const shell = getCoreShellInfo(state);
  if (!shell.unlocked) return { stored: 0, overflow: amount };
  const incoming = Math.max(0, Math.floor(Number(amount) || 0));
  const current = Math.max(0, Math.floor(state.coreShell?.storedFragments ?? 0));
  const free = Math.max(0, shell.capacity - current);
  const stored = Math.min(free, incoming);
  if (stored > 0) {
    state.coreShell.storedFragments = current + stored;
    state.updatedAt = Date.now();
  }
  return { stored, overflow: incoming - stored };
}

export function attemptCoreShellBreak(state) {
  const shell = getCoreShellInfo(state);
  if (!shell.unlocked) return { ok: false, reason: 'locked', shell };
  if (shell.storedFragments <= 0) return { ok: false, reason: 'empty', shell };
  if (state.energy < shell.breakCost) return { ok: false, reason: 'not_enough_energy', shell };

  state.energy -= shell.breakCost;
  const chance = shell.breakChance;
  const naturalSuccess = Math.random() < chance;
  const nextCracks = shell.cracks + 1;
  const forcedSuccess = nextCracks >= shell.requiredHits;

  if (naturalSuccess || forcedSuccess) {
    const released = shell.storedFragments;
    state.coreShell.storedFragments = 0;
    state.coreShell.cracks = 0;
    state.coreShell.lastBreakAt = Date.now();
    state.coreShell.failedBreaks = Math.max(0, Number(state.coreShell.failedBreaks ?? 0));
    const releasedGain = Math.max(released, Math.floor(released * getFragmentGainMultiplier(state)));
    addFragments(state, releasedGain);
    state.updatedAt = Date.now();
    return { ok: true, released: releasedGain, forced: forcedSuccess && !naturalSuccess, chance, shell: getCoreShellInfo(state) };
  }

  state.coreShell.cracks = nextCracks;
  state.coreShell.failedBreaks = Math.max(0, Number(state.coreShell.failedBreaks ?? 0)) + 1;
  state.updatedAt = Date.now();
  return { ok: false, reason: 'failed', cracks: nextCracks, chance, shell: getCoreShellInfo(state) };
}

export function applyOfflineProgress(state) {
  const now = Date.now();
  const rawElapsed = Math.max(0, (now - (state.lastTickAt ?? now)) / 1000);
  const elapsed = Math.min(getOfflineCapHours(state) * 60 * 60, rawElapsed);
  const gained = Math.floor(elapsed * ((state.passiveRate ?? 0) + (state.factoryRate ?? 0)));
  addEnergy(state, gained);
  state.lastTickAt = now;
  state.updatedAt = now;
  // FIX #6 : on retourne aussi le temps réel écoulé et si le cap a été atteint
  return { gained, elapsed, cappedAt: rawElapsed > elapsed ? getOfflineCapHours(state) : null };
}

export function clickCore(state) {
  return applyCoreClick(state, { automatic: false });
}

export function applyCoreClick(state, { automatic = false, gainRatio = 1, surchargeRatio = 1 } = {}) {
  state.totalClicks += automatic ? 0 : 1;
  let gain = Math.max(1, Math.floor(state.clickPower * gainRatio));
  let overdrive = false;
  let overdriveGain = 0;
  let crit = false;
  let fragments = 0;
  let fragmentsStored = 0;

  state.surcharge = Math.min(state.maxSurcharge, (state.surcharge ?? 0) + state.surchargeGain * surchargeRatio);
  if (state.surcharge >= state.maxSurcharge) {
    overdrive = true;
    state.surcharge = 0;
    state.overdriveCount = Math.max(0, Math.floor(Number(state.overdriveCount ?? 0))) + 1;
    overdriveGain = Math.floor(state.clickPower * gainRatio * (BALANCE.overdriveBase + state.overdriveLevel * BALANCE.overdrivePerLevel) + state.passiveRate * BALANCE.overdrivePassiveSeconds);
    // Surcharge critique (compétence LEMEGETON) : 1 overdrive sur N est amplifié.
    const critInterval = getCritOverdriveInterval(state);
    if (critInterval > 0 && state.overdriveCount % critInterval === 0) {
      crit = true;
      overdriveGain = Math.floor(overdriveGain * getCritOverdriveMultiplier(state));
    }
    gain += overdriveGain;
    if (Math.random() < getFragmentDropChanceOnOverdrive(state)) {
      const stored = storeCoreShellFragments(state, 1);
      fragmentsStored = stored.stored;
      if (stored.overflow > 0) fragments = addFragments(state, stored.overflow);
    }
  }

  addEnergy(state, gain);
  state.updatedAt = Date.now();
  return { gain, overdrive, overdriveGain, crit, fragments, fragmentsStored, automatic };
}

export function tickAutoClicks(state, deltaSeconds) {
  if ((state.autoClickRate ?? 0) <= 0 || deltaSeconds <= 0) return { clicks: 0, gain: 0, overdrives: 0, fragments: 0, fragmentsStored: 0 };
  state.autoClickAccumulator = Math.max(0, Number(state.autoClickAccumulator ?? 0)) + state.autoClickRate * deltaSeconds;
  const clicks = Math.min(BALANCE.autoClickMaxBurstsPerTick, Math.floor(state.autoClickAccumulator));
  if (clicks <= 0) return { clicks: 0, gain: 0, overdrives: 0, fragments: 0, fragmentsStored: 0 };
  state.autoClickAccumulator -= clicks;

  const summary = { clicks, gain: 0, overdrives: 0, fragments: 0, fragmentsStored: 0 };
  for (let i = 0; i < clicks; i++) {
    const result = applyCoreClick(state, { automatic: true, gainRatio: BALANCE.autoClickGainRatio, surchargeRatio: BALANCE.autoClickSurchargeRatio });
    summary.gain += result.gain;
    if (result.overdrive) summary.overdrives += 1;
    summary.fragments += result.fragments ?? 0;
    summary.fragmentsStored += result.fragmentsStored ?? 0;
  }
  return summary;
}

export function tickPassive(state, deltaSeconds) {
  const passiveGain = ((state.passiveRate ?? 0) + (state.factoryRate ?? 0)) * deltaSeconds;
  addEnergy(state, passiveGain);
  const auto = tickAutoClicks(state, deltaSeconds);
  state.lastTickAt = Date.now();
  state.updatedAt = Date.now();
  return passiveGain + (auto?.gain ?? 0);
}

export function buyUpgrade(state, upgradeId) {
  return buyUpgradeAmount(state, upgradeId, 1);
}

export function buyUpgradeAmount(state, upgradeId, amount = 1) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return { ok: false, reason: 'unknown_upgrade' };
  if (!isUpgradeUnlocked(state, upgrade)) return { ok: false, reason: 'locked' };

  const qty = Math.max(1, Math.floor(Number(amount) || 1));
  const level = state.upgrades[upgrade.id] ?? 0;
  const cost = upgradeBulkCost(upgrade, level, qty);
  const currency = upgrade.currency ?? 'energy';

  // FIX #4 : raison distincte selon la currency pour ne pas confondre énergie et fragments
  if (getCurrency(state, currency) < cost) {
    const reason = currency === 'fragments' ? 'not_enough_fragments' : 'not_enough_energy';
    return { ok: false, reason, cost, amount: qty, currency };
  }

  spendCurrency(state, currency, cost);
  state.upgrades[upgrade.id] = level + qty;
  recalcDerivedStats(state);
  state.coreShell.storedFragments = Math.min(state.coreShell.storedFragments, getCoreShellInfo(state).capacity);
  state.updatedAt = Date.now();
  return { ok: true, cost, amount: qty, level: level + qty, currency, persistent: isPersistentUpgrade(upgrade) };
}

export function checkAndClaimMilestones(state) {
  const claimed = [];
  for (const milestone of MILESTONES) {
    if (state.milestones[milestone.id]) continue;
    if (!milestone.test(state)) continue;
    state.milestones[milestone.id] = Date.now();
    if (milestone.reward?.energy) addEnergy(state, milestone.reward.energy);
    if (milestone.reward?.fragments) addFragments(state, milestone.reward.fragments);
    claimed.push(milestone);
  }
  if (claimed.length) state.updatedAt = Date.now();
  return claimed;
}

export function getVisibleMilestones(state) {
  return MILESTONES.filter(m => state.milestones[m.id] || m.test(state) || visibleSoon(state, m));
}

function visibleSoon(state, milestone) {
  if (milestone.id === 'energy_100') return true;
  if (milestone.id === 'energy_1000') return state.totalEnergy >= 160;
  if (milestone.id === 'clicks_250') return state.totalClicks >= 25;
  if (milestone.id === 'passive_10') return state.passiveRate >= 2;
  if (milestone.id === 'shell_first_stack') return (state.upgrades?.coreIsolation ?? 0) >= 1;
  if (milestone.id === 'shell_first_break') return (state.coreShell?.storedFragments ?? 0) >= 1 || (state.coreShell?.lastBreakAt ?? 0) > 0;
  if (milestone.id === 'first_prestige') return state.totalEnergy >= prestigeRequirement(state) * 0.4 || state.prestige >= 1;
  if (milestone.id === 'prestige_3') return state.prestige >= 1;
  if (milestone.id === 'prestige_10') return state.prestige >= 6;
  if (milestone.id === 'prestige_25') return state.prestige >= 18;
  return false;
}

export function canPrestige(state) {
  return Number(state.energy ?? 0) >= prestigeRequirement(state);
}

export function prestigeRequirement(state) {
  const prestige = Math.max(0, Number(state.prestige ?? 0));
  if (prestige <= 10) return Math.floor(BALANCE.prestigeBase * Math.pow(BALANCE.prestigeEarlyScale, prestige));
  const p10 = BALANCE.prestigeBase * Math.pow(BALANCE.prestigeEarlyScale, 10);
  return Math.floor(p10 * Math.pow(BALANCE.prestigeLateScale, prestige - 10));
}

export function doPrestige(state) {
  if (!canPrestige(state)) return { ok: false, reason: 'not_ready' };
  const userId = state.userId;
  const keptFragments = Math.max(0, Number(state.fragments ?? 0));
  const keptTotalFragments = Math.max(keptFragments, Number(state.totalFragments ?? keptFragments));
  const keptMilestones = state.milestones;
  const keptTotalClicks = state.totalClicks;
  const keptLifetimeEnergy = Math.max(0, Number(state.lifetimeEnergy ?? state.totalEnergy ?? 0));
  const keptPersistentUpgrades = getPersistentUpgradeLevels(state);
  const keptLemegetonSkills = { ...(state.lemegetonSkills ?? {}) };
  const keptLemegetonToggles = { ...(state.lemegetonToggles ?? {}) };
  const next = createDefaultState(userId);
  next.prestige = state.prestige + 1;
  // Bonus prestige basé sur totalEnergy (progression globale) et non energy courante
  const baseReward = Math.floor(4 + next.prestige * 1.6 + Math.sqrt(Math.max(0, state.totalEnergy)) / 2200 + keptTotalFragments * 0.02);
  // Résonance fragmentaire (compétence LEMEGETON) amplifie le gain de fragments.
  const prestigeReward = Math.floor(baseReward * getFragmentGainMultiplier(state));
  next.fragments = keptFragments + prestigeReward;
  next.totalFragments = keptTotalFragments + prestigeReward;
  next.lifetimeEnergy = keptLifetimeEnergy;
  next.upgrades = { ...next.upgrades, ...keptPersistentUpgrades };
  next.lemegetonSkills = keptLemegetonSkills;
  next.lemegetonToggles = keptLemegetonToggles;
  next.milestones = keptMilestones;
  next.totalClicks = keptTotalClicks;
  recalcDerivedStats(next);
  return { ok: true, state: next, keptPersistentUpgrades, prestigeReward };
}
