/**
 * dashboard.js — Logique star/index.html
 */
import { requireAuth, getProfileMeta } from './guard.js';
import { supabase }                    from '../supabase.js';
import { signOut }                     from '../supabase.js';
import { VideoDay, RadioPlayer }       from './widgets.js';
import { renderNitroHeroCardsAuto, renderNitroQuickAccess } from './nitro-app-renderer.js';

// ── INIT ──────────────────────────────────────────────────────────────────────
export async function initDashboard() {
  const auth = await requireAuth();
  if (!auth) return; // guard a redirigé vers login
  const { user, profile } = auth;
  const meta = getProfileMeta(profile, user);

  _installNitroAppStyles();
  _renderHeader(meta);
  _renderQuickAccess();
  renderNitroHeroCardsAuto();
  _renderPokegangFallbackInfo();
  await Promise.all([
    _loadVideo(),
    _loadActivity(),
  ]);
  _loadRadio();
}

// ── HEADER ────────────────────────────────────────────────────────────────────
function _renderHeader(profile) {
  const el = document.getElementById('star-header-user');
  if (!el) return;
  const initials = profile.username.slice(0, 2).toUpperCase();
  el.innerHTML = `
    <div class="star-user-info">
      <div class="star-avatar" aria-hidden="true">
        ${ profile.avatarUrl
          ? `<img src="${profile.avatarUrl}" alt="Avatar ${profile.username}" width="36" height="36" loading="lazy">`
          : `<span class="star-avatar-initials">${initials}</span>`
        }
      </div>
      <div class="star-user-meta">
        <span class="star-username">${profile.username}</span>
        <span class="star-rang">${profile.activeTitle}</span>
      </div>
    </div>
    <nav class="star-header-nav" aria-label="Navigation hub">
      <a href="/cig.html"        class="star-nav-link">MA CIG</a>
      <a href="/star/crew.html"  class="star-nav-link">CREW</a>
      <a href="/TCG/"            class="star-nav-link">TCG</a>
      <a href="/clicker/"        class="star-nav-link">CLICKER</a>
      <a href="https://sterenna.fr"          target="_blank" rel="noopener" class="star-nav-link star-nav-ext">STERENNA ↗</a>
      <a href="https://pokegang.sterenna.fr" target="_blank" rel="noopener" class="star-nav-link star-nav-ext">POKEGANG ↗</a>
    </nav>
    <button class="star-signout-btn" id="star-signout" aria-label="Déconnexion">
      ✕ DÉCO
    </button>
  `;
  document.getElementById('star-signout')?.addEventListener('click', () => signOut());
}

// ── VIDEO DU JOUR ─────────────────────────────────────────────────────────────
async function _loadVideo() {
  const widget = new VideoDay('widget-video');
  await widget.load();
}

// ── WEB RADIO ─────────────────────────────────────────────────────────────────
function _loadRadio() {
  const radio = new RadioPlayer('widget-radio');
  radio.render();
}

// ── FLUX D'ACTIVITÉ ───────────────────────────────────────────────────────────
async function _loadActivity() {
  const el = document.getElementById('widget-activity');
  if (!el) return;

  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('type, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error || !data || data.length === 0) {
      _renderActivityPlaceholder(el);
      return;
    }
    _renderActivityFeed(el, data);

    supabase.channel('activity_log_changes')
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activity_log' },
          payload => _prependActivity(el, payload.new)
      ).subscribe();

  } catch {
    _renderActivityPlaceholder(el);
  }
}

function _activityIcon(type) {
  const icons = { cig_updated: '✎', member_join: '⬡', project: '◈', default: '·' };
  return icons[type] ?? icons.default;
}

function _timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff/60)}min`;
  if (diff < 86400)return `il y a ${Math.floor(diff/3600)}h`;
  return `il y a ${Math.floor(diff/86400)}j`;
}

function _renderActivityFeed(el, items) {
  el.innerHTML = `<ul class="activity-feed" role="log" aria-live="polite">
    ${items.map(item => `
      <li class="activity-item" data-type="${item.type}">
        <span class="activity-icon" aria-hidden="true">${_activityIcon(item.type)}</span>
        <span class="activity-text">${item.payload?.message ?? item.type}</span>
        <time class="activity-time" datetime="${item.created_at}">${_timeAgo(item.created_at)}</time>
      </li>
    `).join('')}
  </ul>`;
}

function _prependActivity(el, item) {
  const feed = el.querySelector('.activity-feed');
  if (!feed) return;
  const li = document.createElement('li');
  li.className    = 'activity-item activity-item--new';
  li.dataset.type = item.type;
  li.innerHTML = `
    <span class="activity-icon" aria-hidden="true">${_activityIcon(item.type)}</span>
    <span class="activity-text">${item.payload?.message ?? item.type}</span>
    <time class="activity-time" datetime="${item.created_at}">${_timeAgo(item.created_at)}</time>
  `;
  feed.prepend(li);
  while (feed.children.length > 12) feed.lastElementChild.remove();
}

function _renderActivityPlaceholder(el) {
  el.innerHTML = `
    <div class="widget-empty">
      <span class="widget-empty-icon">◈</span>
      <p>Aucune activité récente</p>
      <span class="widget-empty-sub">ACTIVITY_LOG · OFFLINE</span>
    </div>
  `;
}

// ── ACCÈS RAPIDE ─────────────────────────────────────────────────────────────
function _renderQuickAccess() {
  renderNitroQuickAccess('quick-access-grid');
}

// ── POKEGANG INFO ─────────────────────────────────────────────────────────────
function _renderPokegangFallbackInfo() {
  const status = document.getElementById('sb-pg');
  status?.querySelector('span:last-child')?.replaceChildren(document.createTextNode('POKEGANG · SOUS-DOMAINE'));
  status?.querySelector('.sb-dot')?.classList.remove('off');

  const gang = document.getElementById('pg-gang-name');
  const boss = document.getElementById('pg-boss-name');
  const rep = document.getElementById('pg-rep');
  const caught = document.getElementById('pg-caught');
  const shinies = document.getElementById('pg-shinies');
  const dex = document.getElementById('pg-dex');
  const dexNat = document.getElementById('pg-dex-nat');
  const agents = document.getElementById('pg-agents');
  const kpiRep = document.getElementById('kpi-pg-rep');

  if (gang) gang.textContent = 'TEAM BZH';
  if (boss) boss.textContent = 'BOSS : COMPTE LOCAL PG';
  if (rep) rep.textContent = 'SYNC';
  if (caught) caught.textContent = 'LOCAL';
  if (shinies) shinies.textContent = '✦ VIA POKEGANG';
  if (dex) dex.textContent = 'GEN 1';
  if (dexNat) dexNat.textContent = 'NATIONAL : 151 + MISSINGNO';
  if (agents) agents.textContent = 'CREW';
  if (kpiRep) kpiRep.textContent = 'EXTERNE';
}

// ── STYLE AUTO POUR APPS NITRO ───────────────────────────────────────────────
function _installNitroAppStyles() {
  if (document.getElementById('nitro-app-renderer-style')) return;
  const style = document.createElement('style');
  style.id = 'nitro-app-renderer-style';
  style.textContent = `
    .bc-nitro-hero { grid-column: span 4; padding:0; overflow:hidden; border:none; background:transparent; }
    @media(max-width:1100px){ .bc-nitro-hero { grid-column: span 6; } }
    @media(max-width:900px){ .bc-nitro-hero { grid-column: span 12; } }
    .hero-card--nitro {
      background: linear-gradient(135deg, rgba(0,20,30,.96), rgba(12,10,30,.92), rgba(8,8,12,.98));
      border-color: rgba(0,255,204,.24);
    }
    .hero-card--nitro:hover {
      border-color: rgba(0,255,204,.72);
      box-shadow: 0 0 42px rgba(0,255,204,.18), 0 8px 32px rgba(0,0,0,.62);
    }
    .hero-scene--nitro { position:absolute; inset:0; overflow:hidden; }
    .hero-scene--nitro::before {
      content:''; position:absolute; inset:-30%;
      background: radial-gradient(circle at 40% 45%, rgba(0,255,204,.18), transparent 28%), radial-gradient(circle at 75% 75%, rgba(255,61,242,.14), transparent 32%);
      animation: nitroHeroAura 7s ease-in-out infinite alternate;
    }
    @keyframes nitroHeroAura { to { transform:scale(1.08) rotate(3deg); filter:hue-rotate(35deg); } }
    .nitro-hero-orb {
      position:absolute; right:22px; top:50%; transform:translateY(-50%);
      width:82px; height:82px; display:grid; place-items:center; border-radius:24px;
      font-size:2.25rem; background:rgba(0,255,204,.075); border:1px solid rgba(0,255,204,.26);
      box-shadow:0 0 28px rgba(0,255,204,.18), inset 0 0 30px rgba(255,61,242,.07);
      animation:nitroOrb 2.8s ease-in-out infinite alternate;
    }
    @keyframes nitroOrb { to { transform:translateY(-54%) scale(1.05); filter:brightness(1.3); } }
    .nitro-hero-spark { position:absolute; width:5px; height:5px; border-radius:50%; background:#00ffcc; box-shadow:0 0 12px #00ffcc; animation:nitroSpark 4s ease-in-out infinite; }
    .nitro-hero-spark-1 { left:18%; bottom:22%; animation-delay:0s; }
    .nitro-hero-spark-2 { left:54%; bottom:68%; animation-delay:1.2s; background:#ffcc00; box-shadow:0 0 12px #ffcc00; }
    .nitro-hero-spark-3 { left:38%; bottom:38%; animation-delay:2s; background:#ff3df2; box-shadow:0 0 12px #ff3df2; }
    @keyframes nitroSpark { 0%,100%{opacity:.1;transform:translateY(0)} 50%{opacity:.9;transform:translateY(-18px) scale(1.4)} }
    .hero-title--nitro { color:#00ffcc; text-shadow:0 0 12px rgba(0,255,204,.6), 0 0 42px rgba(255,61,242,.22); }
    .hero-badge--nitro { background:rgba(0,255,204,.12); border:1px solid rgba(0,255,204,.35); color:#00ffcc; }
    .hero-card--botanica .hero-title--nitro, .hero-card--botanica .hero-title-accent { color:#7dd87a; text-shadow:0 0 16px rgba(125,216,122,.62); }
    .hero-card--clicker .hero-title--nitro, .hero-card--clicker .hero-title-accent { color:#ff3df2; text-shadow:0 0 16px rgba(255,61,242,.72); }
    .hero-card--star-arcade .hero-title--nitro, .hero-card--star-arcade .hero-title-accent { color:#ffcc00; text-shadow:0 0 16px rgba(255,204,0,.72); }
  `;
  document.head.appendChild(style);
}
