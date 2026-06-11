// pages/homePage.js — v1.0.0
// Home: greeting + stat cards + daily widget + quick nav
import { mount as mountDaily } from './dailyWidget.js';
import { getCachedPlayer }      from '../data/supabaseData.js';

const NAV_ITEMS = [
  { hash: '#/packs',      icon: '🃏', label: 'Boosters'   },
  { hash: '#/shop',       icon: '🛒', label: 'Boutique'   },
  { hash: '#/collection', icon: '📖', label: 'Collection' },
];

const CSS = `
.home-wrap {
  color:#dfe; display:flex; flex-direction:column; align-items:center;
  gap:28px; padding:24px 12px 48px;
}
.home-greeting { font-size:22px; font-weight:800; color:#c8f0d0; letter-spacing:.4px; }
.home-row {
  display:flex; flex-wrap:wrap; justify-content:center;
  gap:20px; width:100%; max-width:900px;
}
.stat-card {
  background:#0b1218; border:1px solid #1a2e40; border-radius:16px;
  padding:18px 24px; min-width:140px; text-align:center; flex:1;
}
.stat-val   { font-size:28px; font-weight:900; color:#ffd36b; }
.stat-label { font-size:12px; color:#5a8a7a; margin-top:4px; text-transform:uppercase; letter-spacing:.5px; }
.home-nav   { display:flex; flex-wrap:wrap; gap:14px; justify-content:center; }
.nav-btn {
  display:flex; flex-direction:column; align-items:center; gap:6px;
  border:1px solid #1e3a4a; background:#0b1624; color:#cde;
  padding:18px 28px; border-radius:16px; cursor:pointer;
  font-size:13px; font-weight:700; text-decoration:none;
  transition:filter .15s,transform .1s; min-width:100px;
}
.nav-btn:hover { filter:brightness(1.15); transform:translateY(-2px); }
.nav-icon { font-size:28px; }
`;

export async function render(root) {
  if (!document.getElementById('home-page-style')) {
    const s = document.createElement('style');
    s.id = 'home-page-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'home-wrap';

  // --- Greeting ---
  const player   = getCachedPlayer();
  const name     = player?.username || 'Joueur';
  const greeting = document.createElement('div');
  greeting.className   = 'home-greeting';
  greeting.textContent = `Bienvenue, ${name} ⚔️`;
  wrap.appendChild(greeting);

  // --- Stat cards ---
  const statsRow = document.createElement('div');
  statsRow.className = 'home-row';
  const STATS = [
    { id: 'stat-gold',   val: player?.gold        ?? 0, label: '⛁ Or'           },
    { id: 'stat-cards',  val: player?.cards_count ?? 0, label: '🃏 Cartes'       },
    { id: 'stat-packs',  val: player?.pack_count  ?? 0, label: '📦 Packs ouverts' },
  ];
  STATS.forEach(({ id, val, label }) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<div class="stat-val" id="${id}">${val}</div><div class="stat-label">${label}</div>`;
    statsRow.appendChild(card);
  });
  wrap.appendChild(statsRow);

  // --- Daily widget ---
  const dailySlot = document.createElement('div');
  await mountDaily(dailySlot);
  wrap.appendChild(dailySlot);

  // --- Quick nav ---
  const nav = document.createElement('div');
  nav.className = 'home-nav';
  NAV_ITEMS.forEach(({ hash, icon, label }) => {
    const a = document.createElement('a');
    a.className = 'nav-btn';
    a.href      = hash;
    a.innerHTML = `<span class="nav-icon">${icon}</span>${label}`;
    nav.appendChild(a);
  });
  wrap.appendChild(nav);

  root.appendChild(wrap);

  // Live gold update after daily claim
  const onGold = (e) => {
    const el = root.querySelector('#stat-gold');
    if (el && e.detail?.gold != null) el.textContent = String(e.detail.gold);
  };
  window.addEventListener('tcg:gold', onGold);
  root.addEventListener('removed', () => window.removeEventListener('tcg:gold', onGold));
}
