// app/ui-shell.js — v3.0.0
// Navbar persistante : active state, live gold, #/packs, tcg_player_packs
import { navigate, boot } from './router.js';
import { set } from './state.js';
import { getClient, getUser, requireLogin } from '../logic/supaRaw.js';
import { getDisplayName, initPlayer } from '../data/supabaseData.js';

const NAV_LINKS = [
  { hash: '#/home',       icon: '\u{1F3E0}', label: 'Accueil'    },
  { hash: '#/packs',      icon: '\u{1F0CF}', label: 'Boosters'   },
  { hash: '#/shop',       icon: '\u{1F6D2}', label: 'Boutique'   },
  { hash: '#/collection', icon: '\u{1F4D6}', label: 'Collection' },
];

const SHELL_CSS = `
#topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: linear-gradient(90deg, #060c10 0%, #081210 100%);
  border-bottom: 1px solid #1a2e22;
  box-shadow: 0 2px 16px rgba(0,0,0,.45);
}
.topbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 52px;
}
.brand {
  font-weight: 900;
  font-size: 15px;
  color: #aaedbb;
  letter-spacing: .4px;
  white-space: nowrap;
  margin-right: 8px;
}
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}
.btn-nav {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: #8ab;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: color .15s, background .15s, border-color .15s;
  white-space: nowrap;
}
.btn-nav:hover {
  color: #cef;
  background: #0e1f2a;
  border-color: #1e3a4a;
}
.btn-nav.active {
  color: #b5f0c0;
  background: #0d2218;
  border-color: #2a5e34;
}
.userbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 13px;
  color: #7ab;
  white-space: nowrap;
}
.gold-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(180deg,#0f1a10,#0b140c);
  border: 1px solid #3b2;
  color: #ffd36b;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13px;
}
.btn-cig {
  border: 1px solid #234;
  background: #0a1018;
  color: #89b;
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  transition: filter .15s;
}
.btn-cig:hover { filter: brightness(1.2); }
`;

document.addEventListener('DOMContentLoaded', async () => {
  // Inject shell CSS
  if (!document.getElementById('shell-style')) {
    const s = document.createElement('style');
    s.id = 'shell-style';
    s.textContent = SHELL_CSS;
    document.head.appendChild(s);
  }

  const top = document.getElementById('topbar');
  top.innerHTML = `
    <div class="topbar-inner">
      <div class="brand">Lab TCG</div>
      <nav class="nav" id="main-nav"></nav>
      <div class="userbar">
        <span id="ub-name">…</span>
        <div class="gold-chip">⛁ <span id="ub-gold">0</span></div>
        <button class="btn-cig" id="btn-cig" title="Carte d'Identification">CIG</button>
      </div>
    </div>`;

  // Build nav links
  const navEl = top.querySelector('#main-nav');
  NAV_LINKS.forEach(({ hash, icon, label }) => {
    const btn = document.createElement('button');
    btn.className = 'btn-nav';
    btn.dataset.hash = hash;
    btn.innerHTML = `<span>${icon}</span><span>${label}</span>`;
    btn.addEventListener('click', () => navigate(hash));
    navEl.appendChild(btn);
  });

  // Active state on hash change
  function syncActive() {
    const h = location.hash || '#/home';
    navEl.querySelectorAll('.btn-nav').forEach(b => {
      b.classList.toggle('active', b.dataset.hash === h);
    });
  }
  window.addEventListener('hashchange', syncActive);
  syncActive();

  // CIG button
  top.querySelector('#btn-cig').addEventListener('click', openCIGModal);

  // Auth + player init
  await requireLogin();
  const sb   = await getClient();
  const user = await getUser();
  if (!user) return;

  const player = await initPlayer(sb, user);
  set({ user, player, gold: player?.gold ?? 0 });

  const nameEl = document.getElementById('ub-name');
  const goldEl = document.getElementById('ub-gold');
  nameEl.textContent = getDisplayName();
  goldEl.textContent = String(player?.gold ?? 0);

  // Live gold update from any page
  window.addEventListener('tcg:gold', (e) => {
    if (e.detail?.gold != null) goldEl.textContent = String(e.detail.gold);
  });

  // Boot router after shell is ready
  boot();
});

// ---- CIG Modal ----
async function openCIGModal() {
  const sb   = await getClient();
  const user = await getUser();
  if (!user) return;

  const { data: packs } = await sb
    .from('tcg_player_packs')
    .select('quantity')
    .eq('player_id', user.id);
  const boostersOwned = (packs || []).reduce((a, b) => a + (b.quantity || 0), 0);

  const { data: cards } = await sb
    .from('tcg_player_cards')
    .select('quantity')
    .eq('user_id', user.id);
  const cardsTotal = (cards || []).reduce((a, b) => a + (b.quantity || 0), 0);

  const name = getDisplayName();

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,.7)',
    zIndex: '9999', display: 'grid', placeItems: 'center'
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: '340px', padding: '24px', borderRadius: '18px',
    color: '#dfe', background: 'radial-gradient(circle at top,#0b0f14,#000)',
    boxShadow: '0 0 32px rgba(100,200,120,.25)', border: '1px solid #1e3a22'
  });
  card.innerHTML = `
    <div style="text-align:center;font-weight:800;font-size:15px;color:#aaedbb;margin-bottom:14px;letter-spacing:.4px">
      Carte d'Identification Galactique
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:14px">
      <div>👤 Joueur : <b>${name}</b></div>
      <div>🃏 Cartes : <b>${cardsTotal}</b></div>
      <div>📦 Boosters : <b>${boostersOwned}</b></div>
    </div>
    <div style="text-align:right;margin-top:18px">
      <button id="close-cig" class="btn-nav" style="border-color:#1e3a4a">Fermer</button>
    </div>`;

  overlay.appendChild(card);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  card.querySelector('#close-cig').addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
