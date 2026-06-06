import {
  UPGRADES,
  MILESTONES,
  SCALING_LAYERS,
  VERSION,
  createDefaultState,
  hydrateState,
  isUpgradeUnlocked,
  prestigeRequirement,
  upgradeCost,
} from './clicker-state.js';

const SNAPSHOT_PREFIX = 'nitro-clicker.save.';
const EXPORT_VERSION = 1;
let mounted = false;
let activePanel = 'pause';
let fileInput;

// ── FIX PERF : état live partagé ─────────────────────────────────────────────
// Au lieu de relire localStorage x2/s dans updateCurrentGoalPanel, on expose
// un cache mis à jour par setLiveState() appelé depuis app.js à chaque tick.
let _liveStateCache = null;
export function setLiveState(state) { _liveStateCache = state; }
function getLiveState() { return _liveStateCache; }
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value) {
  const n = Math.floor(Number(value ?? 0));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('fr-FR');
}

function getSaveKeys() {
  return Object.keys(localStorage).filter(k => k.startsWith(SNAPSHOT_PREFIX));
}

function readSnapshot() {
  const keys = getSaveKeys();
  let best = null;
  let bestKey = null;
  for (const key of keys) {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!best || (data?.updatedAt ?? 0) > (best?.updatedAt ?? 0)) {
        best = data;
        bestKey = key;
      }
    } catch {}
  }
  return best ? { ...best, __key: bestKey } : {};
}

// ── FIX DEBUG : liveText log en dev si l'ID est absent ───────────────────────
function liveText(id, fallback = '0') {
  const el = document.getElementById(id);
  if (!el && typeof process === 'undefined') {
    // Avertissement non-bloquant uniquement hors production
    console.warn(`[ui-panels] liveText: élément #${id} introuvable, fallback utilisé.`);
  }
  return el?.textContent?.trim() || fallback;
}
// ─────────────────────────────────────────────────────────────────────────────

function mountAuxPanels() {
  if (mounted) return;
  const top = document.querySelector('.top-actions');
  const core = document.getElementById('core-panel');
  if (!top || !core) return;
  mounted = true;

  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'nav-btn';
  pauseBtn.type = 'button';
  pauseBtn.id = 'open-pause-panel';
  pauseBtn.textContent = '⏸ PAUSE';

  const statsBtn = document.createElement('button');
  statsBtn.className = 'nav-btn';
  statsBtn.type = 'button';
  statsBtn.id = 'open-stats-panel';
  statsBtn.textContent = '📊 STATS';

  top.prepend(statsBtn);
  top.prepend(pauseBtn);

  document.body.insertAdjacentHTML('beforeend', renderOverlay());
  bindOverlay();

  pauseBtn.addEventListener('click', () => openPanel('pause'));
  statsBtn.addEventListener('click', () => openPanel('stats'));
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'p') openPanel('pause');
    if (event.key === 'Escape') closePanel();
  });

  injectPeripheralVisuals();
  injectCurrentGoalPanel();
  updateCurrentGoalPanel();
  setInterval(updateCurrentGoalPanel, 500);
}

function renderOverlay() {
  return `
    <div class="nc-overlay" id="nc-overlay" aria-hidden="true">
      <div class="nc-overlay-backdrop" data-close-panel></div>
      <section class="nc-panel" role="dialog" aria-modal="true" aria-label="Nitro Clicker pause et statistiques">
        <header class="nc-panel-head">
          <div><div class="nc-panel-kicker">// NITRO CLICKER · CONTROL ROOM</div><h2 id="nc-panel-title">Pause</h2></div>
          <button class="nc-panel-close" type="button" data-close-panel>×</button>
        </header>
        <nav class="nc-tabs" aria-label="Panneau Nitro Clicker">
          <button class="nc-tab active" data-panel-tab="pause" type="button">Pause</button>
          <button class="nc-tab" data-panel-tab="stats" type="button">Stats</button>
          <button class="nc-tab" data-panel-tab="guide" type="button">Guide</button>
          <button class="nc-tab" data-panel-tab="unlocks" type="button">Unlocks</button>
          <button class="nc-tab" data-panel-tab="save" type="button">Save</button>
        </nav>
        <div class="nc-panel-body" id="nc-panel-body"></div>
      </section>
    </div>`;
}

function bindOverlay() {
  document.querySelectorAll('[data-close-panel]').forEach(node => node.addEventListener('click', closePanel));
  document.querySelectorAll('[data-panel-tab]').forEach(btn => btn.addEventListener('click', () => openPanel(btn.dataset.panelTab)));
}

function openPanel(panel = 'pause') {
  activePanel = panel;
  const overlay = document.getElementById('nc-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('nc-paused');
  renderPanelBody();
}

function closePanel() {
  const overlay = document.getElementById('nc-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('nc-paused');
}

function renderPanelBody() {
  document.querySelectorAll('[data-panel-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.panelTab === activePanel));
  const title = document.getElementById('nc-panel-title');
  const body = document.getElementById('nc-panel-body');
  if (!body || !title) return;
  const titles = { pause: 'Pause', stats: 'Statistiques', guide: 'Guide du jeu', unlocks: 'Déblocages', save: 'Sauvegarde' };
  title.textContent = titles[activePanel] ?? 'Pause';
  if (activePanel === 'stats') body.innerHTML = renderStatsPanel();
  else if (activePanel === 'guide') body.innerHTML = renderGuidePanel();
  else if (activePanel === 'unlocks') body.innerHTML = renderUnlockPanel();
  else if (activePanel === 'save') { body.innerHTML = renderSavePanel(); bindSavePanel(); }
  else body.innerHTML = renderPausePanel();
}

/* ──────────────────────────────────────────────────────────────
   PRESTIGE WARNING BLOCK
   Calcule le niveau de surcharge et génère le HTML+CSS du bloc.
   overcharge = 0  → seuil tout juste atteint (prêt à prestige)
   overcharge = 1  → 100% au-delà du seuil (surcharge maximale)
────────────────────────────────────────────────────────────── */
function renderPrestigeWarningBlock() {
  const s = readSnapshot();
  const state = normalizeSave(s) ?? createDefaultState('guest');
  const req = prestigeRequirement(state);
  const totalEnergy = state.totalEnergy ?? 0;
  const rawProgress = Math.min(totalEnergy / Math.max(1, req), 2); // cap à 200%
  const isReady = rawProgress >= 1;
  // overcharge : 0 si exactement au seuil, monte jusqu'à ~1 si 200% du seuil
  const overcharge = isReady ? Math.min((rawProgress - 1), 1) : 0;
  const pct = Math.round(rawProgress * 100);
  const isOverloaded = isReady && overcharge > 0.05;

  // Fragments estimés au prochain prestige
  const nextFragments = Math.max(1, Math.floor(Math.sqrt(totalEnergy / 1000)));

  // ── FIX UX : le bouton prestige délègue au #prestige-btn natif ─────────────
  // On évite confirm() (bloquant, incohérent) et l'accès fragile à #reset-btn.
  // Le #prestige-btn dans app.js gère déjà la logique complète (doPrestige,
  // feedback, save, renderAll). On lui envoie juste un clic programmatique.
  const onPrestigeClick = `(function(){const btn=document.getElementById('prestige-btn');if(btn&&!btn.disabled){btn.click();}else{const o=document.getElementById('nc-overlay');if(o){o.classList.remove('open');document.body.classList.remove('nc-paused');}}document.getElementById('nc-overlay')?.classList.remove('open');document.body.classList.remove('nc-paused');})()`;
  // ─────────────────────────────────────────────────────────────────────────────

  return `
    <div
      class="prestige-warn-block"
      data-ready="${isReady}"
      data-overloaded="${isOverloaded}"
      style="--overcharge:${overcharge.toFixed(3)}"
    >
      <div class="prestige-warn-info">
        <div class="prestige-warn-info-left">
          <span class="prestige-warn-label">${isReady ? (isOverloaded ? '⚠ SURCHARGE ACTIVE — RÉINITIALISEZ' : '✦ SEUIL ATTEINT — PRESTIGE DISPONIBLE') : '◇ PROCHAIN PRESTIGE'}</span>
          <span class="prestige-warn-reward">
            +<em>${nextFragments}</em> fragment${nextFragments > 1 ? 's' : ''} Nitro
          </span>
        </div>
        <div class="prestige-warn-meter-wrap">
          <div class="prestige-warn-meter">
            <div class="prestige-warn-meter-fill" style="transform:scaleX(${Math.min(rawProgress, 1).toFixed(3)})"></div>
          </div>
          <span class="prestige-warn-pct">${fmt(totalEnergy)} / ${fmt(req)} · ${pct}%</span>
        </div>
      </div>
      <button
        class="prestige-warn-btn"
        type="button"
        ${isReady ? '' : 'disabled'}
        onclick="${isReady ? onPrestigeClick : ''}"
        aria-label="Lancer le prestige et réinitialiser le run"
      >
        <span class="prestige-warn-btn-icon">${isOverloaded ? '🔴' : (isReady ? '✦' : '◇')}</span>
        <span class="prestige-warn-btn-label">
          <span class="prestige-warn-btn-title">${isReady ? 'LANCER LE PRESTIGE' : 'PRESTIGE VERROUILLÉ'}</span>
          <span class="prestige-warn-btn-sub">${isOverloaded ? 'Surcharge critique — le noyau demande un reset' : (isReady ? 'Reset run · gain fragments permanent' : `Seuil : ${fmt(req)} énergie totale`)}</span>
        </span>
        <span class="prestige-warn-badge">SURCHARGE</span>
      </button>
    </div>`;
}

function renderPausePanel() {
  const s = readSnapshot();
  const goal = getCurrentGoal(s);
  return `
    <div class="nc-pause-hero"><div class="nc-pause-core">⬡</div><div><h3>Noyau en veille contrôlée</h3><p>Le jeu continue à tourner localement. Tu peux reprendre, exporter ta sauvegarde, consulter les règles ou vérifier ton scaling.</p></div></div>
    ${renderGoalBlock(goal)}
    <div class="nc-action-grid">
      <button class="nc-action primary" type="button" onclick="document.getElementById('nc-overlay').classList.remove('open');document.body.classList.remove('nc-paused')">▶ Reprendre</button>
      <button class="nc-action" type="button" onclick="document.getElementById('save-btn')?.click()">💾 Sauver local</button>
      <button class="nc-action" type="button" onclick="document.querySelector('[data-panel-tab=save]')?.click()">📦 Export / Import</button>
      <button class="nc-action danger" type="button" onclick="document.getElementById('reset-btn')?.click()">⚠ Reset local</button>
    </div>
    ${renderPrestigeWarningBlock()}
    <div class="nc-mini-grid">
      ${metric('Énergie', liveText('stat-energy', fmt(s.energy)))}
      ${metric('Fragments', liveText('stat-fragments', fmt(s.fragments)))}
      ${metric('Prestige', liveText('stat-prestige', fmt(s.prestige)))}
      ${metric('Échelle', liveText('stat-layer', 'CORE'))}
    </div>`;
}

function renderStatsPanel() {
  const s = readSnapshot();
  const upgradesTotal = Object.values(s.upgrades ?? {}).reduce((a, b) => a + Number(b ?? 0), 0);
  const milestonesDone = Object.keys(s.milestones ?? {}).length;
  const layer = getLayerFromPrestige(s.prestige ?? 0);
  return `
    <div class="nc-mini-grid wide">
      ${metric('Énergie actuelle', liveText('stat-energy', fmt(s.energy)))}${metric('Énergie totale', fmt(s.totalEnergy))}${metric('Fragments Nitro', liveText('stat-fragments', fmt(s.fragments)))}${metric('Fragments gagnés', fmt(s.totalFragments))}
      ${metric('Puissance clic', liveText('stat-click', fmt(s.clickPower)))}${metric('Auto / sec', liveText('stat-passive', Number(s.passiveRate ?? 0).toFixed(2)))}${metric('Clics totaux', fmt(s.totalClicks))}${metric('Upgrades achetés', fmt(upgradesTotal))}
      ${metric('Milestones', `${milestonesDone}/${MILESTONES.length}`)}${metric('Prestige', liveText('stat-prestige', fmt(s.prestige)))}${metric('Échelle', layer.name)}${metric('Usines', liveText('stat-factory', fmt(s.factoryRate)))}
    </div>
    <h3 class="nc-subtitle">Niveaux d'upgrades</h3>
    <div class="nc-upgrade-stats">${UPGRADES.map(up => `<div><span>${up.icon} ${up.name}</span><strong>Lv.${s.upgrades?.[up.id] ?? 0}</strong></div>`).join('')}</div>`;
}

function renderGuidePanel() {
  return `<div class="nc-guide-grid">
    ${guideCard('⬡', 'Cliquer le noyau', 'Chaque clic produit de l\'énergie. Plus tu achètes d\'amplificateurs, plus chaque clic devient puissant.')}
    ${guideCard('🧬', 'Surcharge', 'La jauge de surcharge se remplit avec les clics. À 100%, elle déclenche un Overdrive avec un gros gain et une chance de fragment.')}
    ${guideCard('💠', 'Fragments Nitro', 'Ressource permanente. Elle survit au prestige et sert aux upgrades plus rares comme le Catalyseur de fragments.')}
    ${guideCard('✦', 'Prestige', 'Quand ton énergie totale atteint le seuil, tu peux reset ton run pour gagner des fragments et augmenter ton scaling.')}
    ${guideCard('🏭', 'Dézoom', 'À certains prestiges, le jeu change d\'échelle : noyau unique, baie moteur, usine, district puis anneau orbital.')}
    ${guideCard('◇', 'Objectif actuel', 'Le panneau visible en jeu indique toujours le prochain unlock, milestone ou prestige à viser.')}
  </div>`;
}

function renderUnlockPanel() {
  return `
    <h3 class="nc-subtitle">Échelles de prestige</h3><div class="nc-unlock-list">${SCALING_LAYERS.map(layer => `<div><span>${layer.short}</span><strong>${layer.name}</strong><em>Prestige ${layer.prestige}</em><small>${layer.desc}</small></div>`).join('')}</div>
    <h3 class="nc-subtitle">Upgrades & conditions</h3><div class="nc-unlock-list">${UPGRADES.map(up => `<div><span>${up.icon}</span><strong>${up.name}</strong><em>${up.currency === 'fragments' ? 'Fragments' : 'Énergie'} · Tier ${up.tier}</em><small>${up.lockedText ?? 'Disponible dès le départ.'}</small></div>`).join('')}</div>`;
}

function renderSavePanel() {
  const s = readSnapshot();
  return `
    <div class="nc-save-grid">
      <article class="nc-save-card"><h3>Exporter</h3><p>Télécharge une copie JSON de ta sauvegarde locale.</p><button class="nc-action primary" type="button" id="nc-export-save">📤 Exporter JSON</button></article>
      <article class="nc-save-card"><h3>Importer</h3><p>Remplace la sauvegarde actuelle par un fichier JSON Nitro Clicker.</p><button class="nc-action" type="button" id="nc-import-save">📥 Importer JSON</button></article>
      <article class="nc-save-card"><h3>Réparer</h3><p>Normalise la sauvegarde actuelle avec le moteur VERSION ${VERSION}.</p><button class="nc-action" type="button" id="nc-repair-save">🛠 Réparer save</button></article>
    </div>
    <textarea class="nc-save-textarea" id="nc-save-textarea" spellcheck="false" placeholder="Colle une sauvegarde JSON ici, puis clique sur Importer JSON.">${escapeHtml(JSON.stringify(buildExportPayload(s), null, 2))}</textarea>`;
}

function bindSavePanel() {
  document.getElementById('nc-export-save')?.addEventListener('click', exportSave);
  document.getElementById('nc-import-save')?.addEventListener('click', importSaveFromTextareaOrFile);
  document.getElementById('nc-repair-save')?.addEventListener('click', repairSave);
}

function getCurrentSaveKey(snapshot = readSnapshot()) {
  return snapshot.__key || getSaveKeys()[0] || `${SNAPSHOT_PREFIX}guest`;
}

function buildExportPayload(snapshot = readSnapshot()) {
  const clean = { ...snapshot };
  delete clean.__key;
  return { app: 'nitro-clicker', exportVersion: EXPORT_VERSION, exportedAt: new Date().toISOString(), save: clean };
}

function exportSave() {
  const payload = buildExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nitro-clicker-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSaveFromTextareaOrFile() {
  const text = document.getElementById('nc-save-textarea')?.value?.trim();
  if (text) return importSaveText(text);
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      importSaveText(await file.text());
      fileInput.value = '';
    });
  }
  fileInput.click();
}

function importSaveText(text) {
  let payload;
  try { payload = JSON.parse(text); } catch { return alert('JSON invalide.'); }
  const normalized = normalizeSave(payload?.save ?? payload);
  if (!normalized) return alert('Sauvegarde Nitro Clicker invalide.');
  if (!confirm('Importer cette sauvegarde et remplacer la sauvegarde actuelle ?')) return;
  localStorage.setItem(getCurrentSaveKey(), JSON.stringify(normalized));
  location.reload();
}

function repairSave() {
  const snapshot = readSnapshot();
  const normalized = normalizeSave(snapshot);
  if (!normalized) return alert('Aucune sauvegarde à réparer.');
  localStorage.setItem(getCurrentSaveKey(snapshot), JSON.stringify(normalized));
  alert('Sauvegarde réparée. La page va recharger.');
  location.reload();
}

function normalizeSave(raw) {
  try {
    const normalized = hydrateState(raw && typeof raw === 'object' ? raw : createDefaultState('guest'), raw?.userId ?? 'guest');
    normalized.version = VERSION;
    normalized.updatedAt = Date.now();
    delete normalized.__key;
    return normalized;
  } catch { return null; }
}

function getCurrentGoal(s) {
  // ── FIX PERF : priorité au live state en mémoire ─────────────────────────
  // Si le live state est disponible (injecté via setLiveState depuis app.js),
  // on l'utilise directement sans passer par readSnapshot() / normalizeSave().
  const state = getLiveState() ?? normalizeSave(s ?? readSnapshot()) ?? createDefaultState('guest');
  // ─────────────────────────────────────────────────────────────────────────
  const lockedUpgrade = UPGRADES.find(up => !isUpgradeUnlocked(state, up));
  if (lockedUpgrade) return { kind: 'UNLOCK', label: lockedUpgrade.name, desc: lockedUpgrade.lockedText ?? 'Progresse pour débloquer ce module.', progress: guessUnlockProgress(state, lockedUpgrade), progressLabel: 'Déblocage progressif' };
  const milestone = MILESTONES.find(m => !state.milestones?.[m.id]);
  if (milestone) return { kind: 'MILESTONE', label: milestone.label, desc: milestone.desc, progress: guessMilestoneProgress(state, milestone), progressLabel: `${Math.floor(guessMilestoneProgress(state, milestone) * 100)}%` };
  const req = prestigeRequirement(state);
  return { kind: 'PRESTIGE', label: 'Surcharge contrôlée', desc: 'Atteins le seuil d\'énergie totale pour relancer le run avec plus de fragments et un meilleur scaling.', progress: Math.min(1, (state.totalEnergy ?? 0) / Math.max(1, req)), progressLabel: `${fmt(state.totalEnergy)} / ${fmt(req)} énergie totale` };
}

// ── FIX FRAGILE : regex robuste pour guessUnlockProgress ─────────────────────
// Le lockedText peut contenir des espaces normaux, insécables (\u00a0), ou des
// milliers formatés avec virgule. On normalise avant de parser le nombre.
function guessUnlockProgress(state, up) {
  const text = up.lockedText ?? '';
  // Normalise les séparateurs de milliers (espaces, insécables, virgules)
  const normalized = text.replace(/[\u00a0\u202f,]/g, '').replace(/ /g, '');
  const energyMatch = normalized.match(/([0-9]+)énergie/i)
    ?? text.replace(/[\u00a0\u202f]/g, ' ').match(/([0-9][\d\s]*)\sénergie/i);
  if (energyMatch) return Math.min(1, (state.totalEnergy ?? 0) / Math.max(1, Number(energyMatch[1].replace(/\s/g, ''))));
  const prestigeMatch = text.match(/Prestige\s+([0-9]+)/i);
  if (prestigeMatch) return Math.min(1, (state.prestige ?? 0) / Math.max(1, Number(prestigeMatch[1])));
  if (up.id === 'bioConduit') return Math.min(1, (state.upgrades?.prism ?? 0) / 2);
  if (up.id === 'fragmentCatalyst') return Math.min(1, (state.totalFragments ?? 0) / 1);
  return 0.15;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── FIX BUG : guessMilestoneProgress — cas manquants ─────────────────────────
// shell_first_stack et shell_first_break n'avaient aucun cas → toujours 0.
// On ajoute également energy_10000 et clicks_1000 par cohérence défensive.
function guessMilestoneProgress(state, m) {
  if (m.id === 'energy_100') return Math.min(1, (state.totalEnergy ?? 0) / 100);
  if (m.id === 'energy_1000') return Math.min(1, (state.totalEnergy ?? 0) / 1000);
  if (m.id === 'energy_10000') return Math.min(1, (state.totalEnergy ?? 0) / 10000);
  if (m.id === 'clicks_250') return Math.min(1, (state.totalClicks ?? 0) / 250);
  if (m.id === 'clicks_1000') return Math.min(1, (state.totalClicks ?? 0) / 1000);
  if (m.id === 'passive_10') return Math.min(1, (state.passiveRate ?? 0) / 10);
  if (m.id === 'first_prestige') return Math.min(1, (state.prestige ?? 0) / 1);
  if (m.id === 'prestige_3') return Math.min(1, (state.prestige ?? 0) / 3);
  if (m.id === 'prestige_10') return Math.min(1, (state.prestige ?? 0) / 10);
  if (m.id === 'prestige_25') return Math.min(1, (state.prestige ?? 0) / 25);
  // ── Nouveaux cas shell ──
  if (m.id === 'shell_first_stack') {
    const shell = state.coreShell;
    if (!shell) return 0;
    // Progression : fragments stockés / capacité (ou 1 fragment suffit)
    return Math.min(1, (shell.storedFragments ?? 0) / Math.max(1, shell.capacity ?? 1));
  }
  if (m.id === 'shell_first_break') {
    // Ce milestone est complété au premier bris réussi de la sphère.
    // Progression estimée via le ratio de fissures accumulées.
    const shell = state.coreShell;
    if (!shell || !shell.unlocked) return 0;
    return Math.min(1, (shell.cracks ?? 0) / Math.max(1, shell.requiredHits ?? 3));
  }
  return 0;
}
// ─────────────────────────────────────────────────────────────────────────────

function renderGoalBlock(goal) {
  return `<div class="nc-current-goal in-panel"><div class="nc-current-goal-top"><span>${goal.kind}</span><strong>${goal.label}</strong></div><p>${goal.desc}</p><div class="nc-current-goal-meter"><i style="transform:scaleX(${goal.progress})"></i></div><small>${goal.progressLabel}</small></div>`;
}

function injectCurrentGoalPanel() {
  const meta = document.querySelector('.meta-panel');
  if (!meta || document.getElementById('current-goal-panel')) return;
  meta.insertAdjacentHTML('afterbegin', `<div class="current-goal-panel" id="current-goal-panel"><div class="nc-current-goal-top"><span id="goal-kind">OBJECTIF</span><strong id="goal-label">Chargement</strong></div><p id="goal-desc">Analyse du prochain objectif...</p><div class="nc-current-goal-meter"><i id="goal-meter"></i></div><small id="goal-progress">0%</small></div>`);
}

function updateCurrentGoalPanel() {
  const panel = document.getElementById('current-goal-panel');
  if (!panel) return;
  const goal = getCurrentGoal();
  document.getElementById('goal-kind').textContent = goal.kind;
  document.getElementById('goal-label').textContent = goal.label;
  document.getElementById('goal-desc').textContent = goal.desc;
  document.getElementById('goal-meter').style.transform = `scaleX(${goal.progress})`;
  document.getElementById('goal-progress').textContent = goal.progressLabel || `${Math.floor(goal.progress * 100)}%`;
}

function metric(label, value) { return `<div class="nc-metric"><span>${label}</span><strong>${value}</strong></div>`; }
function guideCard(icon, title, text) { return `<article class="nc-guide-card"><div>${icon}</div><h3>${title}</h3><p>${text}</p></article>`; }
function getLayerFromPrestige(prestige) { return [...SCALING_LAYERS].reverse().find(layer => Number(prestige ?? 0) >= layer.prestige) ?? SCALING_LAYERS[0]; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

function injectPeripheralVisuals() {
  const core = document.getElementById('core-panel');
  if (!core || document.getElementById('peripheral-ring')) return;
  core.insertAdjacentHTML('afterbegin', `<div class="peripheral-ring" id="peripheral-ring" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<span style="--i:${i};--a:${i * 22.5}deg"></span>`).join('')}</div><div class="bio-cable-grid" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i};--x:${8 + (i * 11) % 84}%;--d:${(-i * .13).toFixed(2)}s"></i>`).join('')}</div>`);
}

const boot = setInterval(() => {
  mountAuxPanels();
  if (mounted) clearInterval(boot);
}, 250);
