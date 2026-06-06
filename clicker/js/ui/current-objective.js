const SAVE_PREFIX = 'nitro-clicker.save.';

let mounted = false;
let lastObjectiveId = '';

function mountCurrentObjective() {
  if (mounted) return true;
  const metaPanel = document.querySelector('.meta-panel');
  if (!metaPanel) return false;

  const scaleTitle = [...metaPanel.querySelectorAll('.panel-title')]
    .find(node => /ÉCHELLE|MILESTONES/i.test(node.textContent ?? ''));

  const html = `
    <section class="current-objective-card" id="current-objective-card">
      <div class="current-objective-kicker">OBJECTIF ACTUEL</div>
      <div class="current-objective-main">
        <strong id="current-objective-title">Synchronisation...</strong>
        <p id="current-objective-text">Analyse de l’état du noyau.</p>
      </div>
      <div class="current-objective-meter"><span id="current-objective-fill"></span></div>
      <small id="current-objective-progress">0%</small>
    </section>
  `;

  if (scaleTitle) scaleTitle.insertAdjacentHTML('beforebegin', html);
  else metaPanel.insertAdjacentHTML('afterbegin', html);

  mounted = true;
  updateCurrentObjective(true);
  return true;
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

function updateCurrentObjective(force = false) {
  if (!mounted && !mountCurrentObjective()) return;
  const state = readState();
  const objective = getObjective(state);
  const card = document.getElementById('current-objective-card');
  if (!card) return;

  if (force || objective.id !== lastObjectiveId) {
    card.classList.remove('objective-changed');
    void card.offsetWidth;
    card.classList.add('objective-changed');
    lastObjectiveId = objective.id;
  }

  setText('current-objective-title', objective.title);
  setText('current-objective-text', objective.text);
  setText('current-objective-progress', objective.progressText);
  setScale('current-objective-fill', objective.ratio);
  card.dataset.objective = objective.id;
}

function getObjective(state) {
  const energy = Number(state.energy ?? 0);
  const totalEnergy = Number(state.totalEnergy ?? 0);
  const prestige = Number(state.prestige ?? 0);
  const upgrades = state.upgrades ?? {};
  const shell = state.coreShell ?? {};
  const storedFragments = Number(shell.storedFragments ?? 0);
  const fragments = Number(state.fragments ?? 0);
  const totalFragments = Number(state.totalFragments ?? fragments);
  const passive = Number(state.passiveRate ?? 0);
  const lastBreakAt = Number(shell.lastBreakAt ?? 0);

  if (totalEnergy < 100) {
    return objective('first_energy', 'Allumer le noyau', 'Clique le noyau pour atteindre 100 énergie totale et obtenir ton premier bonus.', totalEnergy / 100, `${format(totalEnergy)} / 100 E total`);
  }

  if ((upgrades.autoCore ?? 0) < 1) {
    return objective('first_idle', 'Installer un flux passif', 'Achète Noyau automatique pour produire même sans cliquer.', energy / cost(65, 1.40, upgrades.autoCore ?? 0), `${format(energy)} E · coût estimé ${format(cost(65, 1.40, upgrades.autoCore ?? 0))}`);
  }

  if (totalEnergy < 1000) {
    return objective('reactor_living', 'Atteindre le réacteur vivant', 'Monte à 1 000 énergie totale pour accélérer les fragments Nitro.', totalEnergy / 1000, `${format(totalEnergy)} / 1 000 E total`);
  }

  if ((upgrades.coreIsolation ?? 0) < 1) {
    return objective('core_isolation', 'Former la sphère d’isolation', 'Achète Isolation du noyau pour commencer à stocker les fragments dans une coque visible.', energy / cost(950, 1.38, upgrades.coreIsolation ?? 0), `${format(energy)} E · coût ${format(cost(950, 1.38, upgrades.coreIsolation ?? 0))}`);
  }

  if (storedFragments < 1 && totalFragments < 3) {
    return objective('store_fragment', 'Confiner un Fragment Nitro', 'Déclenche des Overdrives : la coque peut maintenant stocker les fragments trouvés.', Math.min(1, totalEnergy / 6500), `${storedFragments} fragment stocké · surcharge/Overdrive recommandé`);
  }

  if (storedFragments >= 1 && lastBreakAt <= 0) {
    const breakCost = approximateBreakCost(state);
    return objective('break_shell', 'Briser la sphère', 'Dépense un pic d’énergie pour fissurer ou briser la coque et libérer les fragments stockés.', energy / breakCost, `${format(energy)} / ${format(breakCost)} E`);
  }

  if (fragments >= 3 && (upgrades.fractureTuning ?? 0) < 1) {
    return objective('fracture_tuning', 'Stabiliser les ruptures', 'Achète Accord de fracture : les prochaines ruptures seront moins aléatoires.', fragments / 3, `${format(fragments)} / 3 F`);
  }

  if (fragments >= 3 && (upgrades.fragmentCatalyst ?? 0) < 1) {
    return objective('fragment_catalyst', 'Installer le catalyseur permanent', 'Achète Catalyseur de fragments pour conserver un multiplicateur global après les prestiges.', fragments / 3, `${format(fragments)} / 3 F`);
  }

  const prestigeReq = prestigeRequirementApprox(prestige);
  if (totalEnergy < prestigeReq) {
    return objective('prestige_ready', 'Préparer la surcharge contrôlée', 'Continue à charger le noyau jusqu’au seuil de prestige pour reset proprement et gagner des fragments.', totalEnergy / prestigeReq, `${format(totalEnergy)} / ${format(prestigeReq)} E total`);
  }

  if (prestige < 3) {
    return objective('prestige_click', 'Activer le prestige', 'Lance Surcharge contrôlée pour passer au niveau suivant et accélérer le scaling.', 1, 'Prestige prêt');
  }

  if (prestige < 10) {
    return objective('engine_bay', 'Atteindre la baie moteur', 'Enchaîne les prestiges jusqu’au dézoom industriel du Prestige 10.', prestige / 10, `${prestige} / 10 prestiges`);
  }

  if ((upgrades.nitroFactory ?? 0) < 1) {
    return objective('first_factory', 'Construire la première usine Nitro', 'Achète Usine de moteurs Nitro pour entrer dans la progression industrielle.', energy / cost(62000, 1.42, upgrades.nitroFactory ?? 0), `${format(energy)} E · coût ${format(cost(62000, 1.42, upgrades.nitroFactory ?? 0))}`);
  }

  if (prestige < 25) {
    return objective('district', 'Alimenter le district énergétique', 'Continue les cycles prestige/usines pour atteindre le niveau de fonctionnement du vaisseau.', prestige / 25, `${prestige} / 25 prestiges`);
  }

  return objective('ship_online', 'Étendre le réseau Gwen Ha Star', 'Le système est opérationnel. Optimise fragments, usines et rupture de coque pour préparer les paliers orbitaux.', 1, 'Système opérationnel');
}

function objective(id, title, text, ratio, progressText) {
  return {
    id,
    title,
    text,
    ratio: Math.max(0, Math.min(1, Number(ratio) || 0)),
    progressText,
  };
}

function cost(base, scale, level) {
  return Math.floor(base * Math.pow(scale, Math.max(0, Number(level ?? 0))));
}

function prestigeRequirementApprox(prestige) {
  const p = Math.max(0, Number(prestige ?? 0));
  const base = 6500;
  if (p <= 10) return Math.floor(base * Math.pow(2.05, p));
  const p10 = base * Math.pow(2.05, 10);
  return Math.floor(p10 * Math.pow(2.3, p - 10));
}

function approximateBreakCost(state) {
  const hardness = Math.max(0, Number(state.coreShellHardness ?? 0));
  const stored = Math.max(1, Number(state.coreShell?.storedFragments ?? 1));
  const hardnessFactor = Math.pow(1.34, Math.max(0, hardness - 1));
  const storedFactor = 0.8 + stored * 0.85;
  return Math.floor(1250 * hardnessFactor * storedFactor);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node && node.textContent !== String(value)) node.textContent = String(value);
}

function setScale(id, value) {
  const node = document.getElementById(id);
  const next = `scaleX(${Math.max(0, Math.min(1, Number(value) || 0))})`;
  if (node && node.style.transform !== next) node.style.transform = next;
}

function format(value) {
  const n = Math.floor(Number(value ?? 0));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('fr-FR');
}

const boot = setInterval(() => {
  if (mountCurrentObjective()) clearInterval(boot);
}, 250);

setInterval(updateCurrentObjective, 550);

window.NitroCurrentObjective = { update: updateCurrentObjective };
