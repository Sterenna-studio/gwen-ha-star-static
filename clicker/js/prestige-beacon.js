/**
 * prestige-beacon.js
 * Bouton prestige flottant — indépendant du panel pause.
 * Visible uniquement quand le prestige est disponible.
 * L'overcharge (0→1) module la couleur/intensité rouge.
 * Aucun confirm() / alert() — modale in-game uniquement.
 */
import {
  createDefaultState,
  hydrateState,
  prestigeRequirement,
} from './clicker-state.js';

const SNAPSHOT_PREFIX = 'nitro-clicker.save.';

// ── Helpers ──────────────────────────────────────────────────
function readSnapshot() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(SNAPSHOT_PREFIX));
  let best = null;
  for (const key of keys) {
    try {
      const d = JSON.parse(localStorage.getItem(key));
      if (!best || (d?.updatedAt ?? 0) > (best?.updatedAt ?? 0)) best = d;
    } catch {}
  }
  return best ?? {};
}

function fmt(n) {
  const v = Math.floor(Number(n ?? 0));
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 100_000)       return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString('fr-FR');
}

function safeState(raw) {
  try {
    return hydrateState(
      raw && typeof raw === 'object' ? raw : createDefaultState('guest'),
      raw?.userId ?? 'guest'
    );
  } catch { return createDefaultState('guest'); }
}

// ── Modale in-game (sans confirm/alert natif) ─────────────────
function injectModalCSS() {
  if (document.getElementById('pb-modal-style')) return;
  const s = document.createElement('style');
  s.id = 'pb-modal-style';
  s.textContent = `
    #pb-modal-backdrop {
      position: fixed; inset: 0; z-index: 300;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: pbModalIn .2s ease both;
    }
    @keyframes pbModalIn {
      from { opacity:0; } to { opacity:1; }
    }
    #pb-modal {
      position: relative;
      width: min(360px, calc(100vw - 32px));
      padding: 24px 20px 20px;
      border-radius: 20px;
      border: 1.5px solid rgba(255,71,71,.35);
      background:
        radial-gradient(ellipse at 30% 0%, rgba(200,30,30,.18), transparent 55%),
        rgba(10,5,5,.96);
      box-shadow: 0 0 40px rgba(200,30,30,.22), 0 20px 60px rgba(0,0,0,.6);
      font-family: var(--font-mono, 'Share Tech Mono', monospace);
      animation: pbModalPop .28s cubic-bezier(.12,.85,.18,1) both;
    }
    @keyframes pbModalPop {
      from { opacity:0; transform: scale(.92) translateY(12px); }
      to   { opacity:1; transform: scale(1)   translateY(0);    }
    }
    #pb-modal .pb-modal-kicker {
      font-size: 8px; letter-spacing: .2em; color: rgba(255,90,90,.8);
      text-transform: uppercase; margin-bottom: 8px;
    }
    #pb-modal h3 {
      font-size: 15px; font-weight: 800; letter-spacing: .12em;
      color: #fff; margin: 0 0 10px;
      font-family: var(--font-display, 'Exo 2', sans-serif);
    }
    #pb-modal p {
      font-size: 11px; line-height: 1.55; color: rgba(232,250,255,.72);
      margin: 0 0 18px;
    }
    #pb-modal .pb-modal-actions {
      display: flex; gap: 8px; justify-content: flex-end;
    }
    #pb-modal .pb-modal-cancel {
      padding: 8px 16px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      color: rgba(200,220,255,.7);
      font-family: inherit; font-size: 10px; letter-spacing: .12em;
      cursor: pointer;
      transition: background .15s;
    }
    #pb-modal .pb-modal-cancel:hover { background: rgba(255,255,255,.12); }
    #pb-modal .pb-modal-confirm {
      padding: 8px 18px; border-radius: 999px;
      border: none;
      background: linear-gradient(90deg, #b91c1c, #ef4444);
      color: #fff;
      font-family: inherit; font-size: 10px; font-weight: 700;
      letter-spacing: .14em; cursor: pointer;
      box-shadow: 0 0 18px rgba(220,40,40,.4);
      transition: filter .15s, transform .12s;
    }
    #pb-modal .pb-modal-confirm:hover { filter: brightness(1.15); transform: scale(1.03); }
  `;
  document.head.appendChild(s);
}

function openPrestigeModal(onConfirm) {
  injectModalCSS();
  if (document.getElementById('pb-modal-backdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'pb-modal-backdrop';
  backdrop.innerHTML = `
    <div id="pb-modal" role="dialog" aria-modal="true" aria-labelledby="pb-modal-title">
      <div class="pb-modal-kicker">// NITRO CLICKER · PRESTIGE</div>
      <h3 id="pb-modal-title">Lancer le Prestige ?</h3>
      <p>
        Ton énergie et tous tes upgrades seront <strong style="color:#f87171">réinitialisés</strong>.<br>
        En échange tu gagneras des <strong style="color:#7dfcfc">fragments Nitro permanents</strong>
        qui boostent ton prochain run.
      </p>
      <div class="pb-modal-actions">
        <button class="pb-modal-cancel"  id="pb-modal-cancel">ANNULER</button>
        <button class="pb-modal-confirm" id="pb-modal-confirm">CONFIRMER LE PRESTIGE</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  document.getElementById('pb-modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.getElementById('pb-modal-confirm').addEventListener('click', () => {
    close();
    onConfirm();
  });

  // focus trap basique
  setTimeout(() => document.getElementById('pb-modal-cancel')?.focus(), 50);
}

// ── DOM bootstrap ─────────────────────────────────────────────
function injectBeacon() {
  if (document.getElementById('prestige-beacon')) return;

  const vig = document.createElement('div');
  vig.id = 'prestige-vignette';
  document.body.appendChild(vig);

  document.body.insertAdjacentHTML('beforeend', `
    <div id="prestige-beacon" role="complementary" aria-label="Prestige disponible" data-overloaded="false" data-critical="false">
      <div class="pb-meter-wrap">
        <div class="pb-meter">
          <div class="pb-meter-fill" id="pb-meter-fill"></div>
        </div>
        <span class="pb-meter-label" id="pb-meter-label">SEUIL 0%</span>
      </div>
      <button class="pb-btn" id="pb-btn" type="button" aria-label="Lancer le prestige">
        <span class="pb-icon"  id="pb-icon">✦</span>
        <span class="pb-text">
          <span class="pb-title" id="pb-title">LANCER LE PRESTIGE</span>
          <span class="pb-sub"   id="pb-sub">Reset run · fragments permanents</span>
        </span>
        <span class="pb-badge">SURCHARGE</span>
      </button>
    </div>
  `);

  document.getElementById('pb-btn').addEventListener('click', () => {
    if (window.NitroPrestige && !window.NitroPrestige.canDo()) return;
    openPrestigeModal(() => {
      window.NitroPrestige?.exec?.();
    });
  });
}

// ── Update loop ───────────────────────────────────────────────
function updateBeacon() {
  const beacon = document.getElementById('prestige-beacon');
  if (!beacon) return;

  let energy, totalEnergy, req;
  if (window.NitroPrestige?.info) {
    ({ energy, totalEnergy, req } = window.NitroPrestige.info());
  } else {
    const raw   = readSnapshot();
    const state = safeState(raw);
    req         = prestigeRequirement(state);
    energy      = Number(state.energy ?? 0);
    totalEnergy = Number(state.totalEnergy ?? 0);
  }

  const rawP  = Math.min(energy / Math.max(1, req), 2);
  const isReady      = rawP >= 1;
  const overcharge   = isReady ? Math.min(rawP - 1, 1) : 0;
  const isOverloaded = isReady && overcharge > 0.05;
  const isCritical   = isReady && overcharge > 0.70;
  const pct      = Math.round(rawP * 100);
  const nextFrag = Math.max(1, Math.floor(Math.sqrt(totalEnergy / 1000)));

  beacon.classList.toggle('visible', isReady);
  beacon.dataset.overloaded = String(isOverloaded);
  beacon.dataset.critical   = String(isCritical);
  beacon.style.setProperty('--oc', overcharge.toFixed(4));

  const vig = document.getElementById('prestige-vignette');
  if (vig) {
    vig.style.background = `radial-gradient(
      ellipse at 50% 100%,
      oklch(0.40 0.22 25 / ${(overcharge * 0.18).toFixed(4)}) 0%,
      oklch(0.30 0.22 25 / ${(overcharge * 0.08).toFixed(4)}) 100%
    )`;
  }

  const fill = document.getElementById('pb-meter-fill');
  if (fill) fill.style.transform = `scaleX(${Math.min(rawP, 1).toFixed(4)})`;

  const label = document.getElementById('pb-meter-label');
  if (label) label.textContent = `${fmt(energy)} / ${fmt(req)} · ${pct}%`;

  const icon  = document.getElementById('pb-icon');
  const title = document.getElementById('pb-title');
  const sub   = document.getElementById('pb-sub');

  if (icon)  icon.textContent  = isOverloaded ? '🔴' : '✦';
  if (title) title.textContent = 'LANCER LE PRESTIGE';
  if (sub)   sub.textContent   = isOverloaded
    ? `Surcharge ${Math.round(overcharge * 100)}% — noyau instable · +${nextFrag} frag${nextFrag > 1 ? 's' : ''}`
    : `Reset run · +${nextFrag} fragment${nextFrag > 1 ? 's' : ''} permanent${nextFrag > 1 ? 's' : ''}`;
}

// ── Boot ──────────────────────────────────────────────────────
const boot = setInterval(() => {
  if (!document.body) return;
  injectBeacon();
  clearInterval(boot);
}, 100);

setInterval(updateBeacon, 800);
setTimeout(updateBeacon, 400);
