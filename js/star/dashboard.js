/**
 * dashboard.js — Logique star/index.html
 */
import { guardStar, getProfileMeta } from './guard.js';
import { supabase }                  from '../supabase.js';
import { signOut }                   from '../supabase.js';
import { VideoDay, RadioPlayer }     from './widgets.js';

// ── INIT ──────────────────────────────────────────────────────────────────────
export async function initDashboard() {
  const session = await guardStar();
  const profile = getProfileMeta(session);

  _renderHeader(profile);
  _renderQuickAccess();
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
        ${ profile.avatar_url
          ? `<img src="${profile.avatar_url}" alt="Avatar ${profile.username}" width="36" height="36" loading="lazy">`
          : `<span class="star-avatar-initials">${initials}</span>`
        }
      </div>
      <div class="star-user-meta">
        <span class="star-username">${profile.username}</span>
        <span class="star-rang">${profile.rang}</span>
      </div>
    </div>
    <nav class="star-header-nav" aria-label="Navigation hub">
      <a href="/cig.html"        class="star-nav-link">MA CIG</a>
      <a href="/star/crew.html"  class="star-nav-link">CREW</a>
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

  // Tente de charger les événements depuis Supabase (table activity_log)
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

    // Temps réel via channel Supabase
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
  li.className  = 'activity-item activity-item--new';
  li.dataset.type = item.type;
  li.innerHTML = `
    <span class="activity-icon" aria-hidden="true">${_activityIcon(item.type)}</span>
    <span class="activity-text">${item.payload?.message ?? item.type}</span>
    <time class="activity-time" datetime="${item.created_at}">${_timeAgo(item.created_at)}</time>
  `;
  feed.prepend(li);
  // Limite à 12 items
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
  const el = document.getElementById('quick-access-grid');
  if (!el) return;
  const links = [
    { label: 'MA CIG',     icon: '⬡', href: '/cig.html',                        color: '--c-primary', desc: 'Voir · éditer ma fiche' },
    { label: 'CREW',       icon: '◈', href: '/star/crew.html',                   color: '--c-cyan',    desc: 'Membres du réseau' },
    { label: 'STERENNA',   icon: '▲', href: 'https://sterenna.fr',               color: '--c-amber',   desc: '3D · Gravure · Web', ext: true },
    { label: 'POKEGANG',   icon: '◉', href: 'https://pokegang.sterenna.fr',      color: '--c-purple',  desc: 'Le jeu du crew', ext: true },
  ];
  el.innerHTML = links.map(l => `
    <a href="${l.href}"
       class="qa-card"
       style="--qa-color: var(${l.color})"
       ${l.ext ? 'target="_blank" rel="noopener noreferrer"' : ''}
       aria-label="${l.label}">
      <span class="qa-icon" aria-hidden="true">${l.icon}</span>
      <span class="qa-label">${l.label}</span>
      <span class="qa-desc">${l.desc}</span>
      ${l.ext ? '<span class="qa-ext" aria-hidden="true">↗</span>' : ''}
    </a>
  `).join('');
}
