/**
 * dashboard.js — Logique star/index.html
 */
import { requireAuth, getProfileMeta } from './guard.js';
import { supabase }                    from '../supabase.js';
import { signOut }                     from '../supabase.js';
import { VideoDay, RadioPlayer }       from './widgets.js';
import { renderNitroQuickAccess }      from './nitro-app-renderer.js';

// ── INIT ──────────────────────────────────────────────────────────────────────
export async function initDashboard() {
  const auth = await requireAuth();
  if (!auth) return;
  const { user, profile } = auth;
  const meta = getProfileMeta(profile, user);

  _installNitroAppStyles();
  _renderHeader(meta);
  _renderQuickAccess();
  // NB: hero cards déjà injectées via renderNitroHeroCards() dans star/index.html

  await Promise.all([
    _loadVideo(),
    _loadActivity(),
    _loadPokegangFromSupabase(user.id),
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

// ── POKEGANG (depuis Supabase → pokegang_players) ─────────────────────────────
async function _loadPokegangFromSupabase(userId) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  const sbPg  = document.getElementById('sb-pg');
  const sbDot = sbPg?.querySelector('.sb-dot');
  const sbLbl = sbPg?.querySelector('span:last-child');

  try {
    const { data, error } = await supabase
      .from('pokegang_players')
      .select('gang_name, boss_name, reputation, total_caught, shiny_count, dex_kanto_count, dex_national_count, agents_count')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      _renderPokegangOffline();
      return;
    }

    if (sbDot) { sbDot.classList.remove('off'); sbDot.classList.add('green'); }
    if (sbLbl) sbLbl.textContent = 'POKEGANG · SYNC';

    setEl('pg-gang-name', data.gang_name  ?? 'TEAM ???');
    setEl('pg-boss-name', `BOSS : ${data.boss_name ?? '???'}`);
    setEl('pg-rep',       (data.reputation ?? 0).toLocaleString('fr-FR'));
    setEl('pg-caught',    (data.total_caught ?? 0).toLocaleString('fr-FR'));
    setEl('pg-shinies',   `✦ SHINIES : ${(data.shiny_count ?? 0).toLocaleString('fr-FR')}`);
    setEl('pg-dex',       (data.dex_kanto_count ?? 0).toLocaleString('fr-FR'));
    setEl('pg-dex-nat',   `NATIONAL : ${(data.dex_national_count ?? 0).toLocaleString('fr-FR')}`);
    setEl('pg-agents',    (data.agents_count ?? 0).toLocaleString('fr-FR'));
    setEl('kpi-pg-rep',   (data.reputation ?? 0).toLocaleString('fr-FR'));

  } catch {
    _renderPokegangOffline();
  }
}

function _renderPokegangOffline() {
  const sbPg  = document.getElementById('sb-pg');
  const sbDot = sbPg?.querySelector('.sb-dot');
  const sbLbl = sbPg?.querySelector('span:last-child');
  if (sbDot) sbDot.classList.add('off');
  if (sbLbl) sbLbl.textContent = 'POKEGANG · OFFLINE';

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('pg-gang-name', 'NON CONNECTÉ');
  setEl('pg-boss-name', 'BOSS : —');
  setEl('pg-rep',       '—');
  setEl('pg-caught',    '—');
  setEl('pg-shinies',   '✦ SHINIES : —');
  setEl('pg-dex',       '—');
  setEl('pg-dex-nat',   'NATIONAL : —');
  setEl('pg-agents',    '—');
  setEl('kpi-pg-rep',   'OFFLINE');
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

// ── HERO CARDS — STYLE HOLOGRAPHIQUE ─────────────────────────────────────────
function _installNitroAppStyles() {
  if (document.getElementById('nitro-app-renderer-style')) return;
  const style = document.createElement('style');
  style.id = 'nitro-app-renderer-style';
  style.textContent = `

    /* ── BENTO SLOT ────────────────────────────────────────────────────────────────── */
    .bc-nitro-hero {
      grid-column: span 4;
      padding: 0;
      overflow: hidden;
      border: none;
      background: transparent;
    }
    @media(max-width:1100px){ .bc-nitro-hero { grid-column: span 6; } }
    @media(max-width:900px){  .bc-nitro-hero { grid-column: span 12; } }

    /* ── CARTE DE BASE ───────────────────────────────────────────────────────────────── */
    .hero-card {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      position: relative;
      width: 100%;
      min-height: 200px;
      border-radius: 18px;
      overflow: hidden;
      text-decoration: none;
      transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s;
    }
    .hero-card:hover {
      transform: translateY(-3px) scale(1.01);
    }

    /* ── VERRE HOLOGRAPHIQUE ─────────────────────────────────────────────────────────── */
    .hero-card--nitro {
      background:
        linear-gradient(135deg,
          rgba(255,255,255,.07) 0%,
          rgba(255,255,255,.02) 40%,
          rgba(0,0,0,.18) 100%);
      border: 1px solid rgba(255,255,255,.15);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.18),
        inset 0 -1px 0 rgba(0,0,0,.3),
        0 8px 32px rgba(0,0,0,.5),
        0 0 0 1px rgba(0,255,204,.08);
      backdrop-filter: blur(18px) saturate(1.6);
      -webkit-backdrop-filter: blur(18px) saturate(1.6);
    }
    .hero-card--nitro:hover {
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.28),
        inset 0 -1px 0 rgba(0,0,0,.2),
        0 16px 48px rgba(0,0,0,.55),
        0 0 0 1px rgba(0,255,204,.22),
        0 0 40px rgba(0,255,204,.12);
    }

    /* ── SCÈNE DE FOND ────────────────────────────────────────────────────────────────── */
    .hero-scene--nitro {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    /* Grille holographique en fond */
    .hsc-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(0,255,204,.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,255,204,.06) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%);
      animation: hscGridDrift 12s linear infinite;
    }
    @keyframes hscGridDrift {
      from { background-position: 0 0; }
      to   { background-position: 32px 32px; }
    }

    /* Reflet de lumière diagonale */
    .hero-scene--nitro::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 120% 60% at 20% 20%, rgba(255,255,255,.08), transparent 55%),
        radial-gradient(ellipse 60% 80% at 80% 80%, rgba(0,255,204,.10), transparent 50%);
      animation: hscAura 8s ease-in-out infinite alternate;
    }
    @keyframes hscAura {
      from { opacity: .7; transform: scale(1) rotate(0deg); }
      to   { opacity: 1;  transform: scale(1.05) rotate(2deg); filter: hue-rotate(30deg); }
    }

    /* Ligne étincelante horizontale (reflet de verre) */
    .hero-scene--nitro::after {
      content: '';
      position: absolute;
      top: 18%;
      left: -60%;
      width: 220%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.35) 40%, rgba(255,255,255,.6) 50%, rgba(255,255,255,.35) 60%, transparent);
      animation: hscSweep 6s ease-in-out infinite;
      opacity: 0;
    }
    @keyframes hscSweep {
      0%,100% { opacity: 0; transform: translateX(-30%) rotate(-8deg); }
      30%      { opacity: 1; }
      60%      { opacity: 0; transform: translateX(30%) rotate(-8deg); }
    }

    /* ── ORB ─────────────────────────────────────────────────────────────────────────── */
    .nitro-hero-orb {
      position: absolute;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 78px;
      height: 78px;
      display: grid;
      place-items: center;
      border-radius: 20px;
      font-size: 2.1rem;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.18);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.25),
        inset 0 -1px 0 rgba(0,0,0,.2),
        0 4px 24px rgba(0,0,0,.4),
        0 0 20px rgba(0,255,204,.10);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      animation: nitroOrb 3s ease-in-out infinite alternate;
    }
    @keyframes nitroOrb {
      from { transform: translateY(-50%) scale(1); filter: brightness(1); }
      to   { transform: translateY(-54%) scale(1.04); filter: brightness(1.2) drop-shadow(0 0 12px rgba(0,255,204,.4)); }
    }

    /* ── PARTICULES ────────────────────────────────────────────────────────────────── */
    .nitro-hero-spark {
      position: absolute;
      width: 3px;
      height: 3px;
      border-radius: 50%;
      animation: nitroSpark 5s ease-in-out infinite;
      opacity: 0;
    }
    .nitro-hero-spark-1 { left:15%; bottom:25%; background:#00ffcc; box-shadow:0 0 6px #00ffcc; animation-delay:0s; }
    .nitro-hero-spark-2 { left:52%; bottom:65%; background:#fff;    box-shadow:0 0 8px #fff;    animation-delay:1.5s; width:2px; height:2px; }
    .nitro-hero-spark-3 { left:35%; bottom:42%; background:#ff3df2; box-shadow:0 0 6px #ff3df2; animation-delay:2.8s; }
    @keyframes nitroSpark {
      0%,100% { opacity:0; transform:translateY(0) scale(1); }
      30%     { opacity:.9; }
      60%     { opacity:0; transform:translateY(-22px) scale(0.5); }
    }

    /* ── SCANLINES ─────────────────────────────────────────────────────────────────── */
    .hero-scanlines {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(0,0,0,.04) 3px,
        rgba(0,0,0,.04) 4px
      );
      z-index: 2;
    }

    /* ── CONTENU TEXTE ───────────────────────────────────────────────────────────────── */
    .hero-content {
      position: relative;
      z-index: 3;
      padding: 18px 20px 16px;
      background: linear-gradient(
        to top,
        rgba(0,0,0,.72) 0%,
        rgba(0,0,0,.42) 55%,
        transparent 100%
      );
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    .hero-eyebrow {
      font-family: 'Share Tech Mono', monospace;
      font-size: 9px;
      letter-spacing: .22em;
      color: rgba(0,255,204,.75);
      margin-bottom: 5px;
      text-transform: uppercase;
    }

    .hero-title--nitro {
      font-size: 1.3rem;
      font-weight: 800;
      line-height: 1.1;
      color: #fff;
      text-shadow:
        0 1px 3px rgba(0,0,0,.8),
        0 0 18px rgba(0,255,204,.35);
      letter-spacing: .04em;
    }
    .hero-title-accent {
      color: rgba(0,255,204,.95);
    }

    .hero-sub {
      font-family: 'Share Tech Mono', monospace;
      font-size: 10px;
      line-height: 1.5;
      color: rgba(255,255,255,.7);
      margin-top: 5px;
      letter-spacing: .04em;
    }

    .hero-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
    }

    .hero-badge--nitro {
      font-family: 'Share Tech Mono', monospace;
      font-size: 8px;
      letter-spacing: .18em;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.18);
      color: rgba(255,255,255,.85);
      backdrop-filter: blur(6px);
      text-transform: uppercase;
    }

    .hero-cta {
      font-family: 'Share Tech Mono', monospace;
      font-size: 9px;
      letter-spacing: .18em;
      color: rgba(0,255,204,.9);
      text-shadow: 0 0 8px rgba(0,255,204,.5);
      transition: letter-spacing .2s;
    }
    .hero-card:hover .hero-cta {
      letter-spacing: .28em;
    }

    /* ── COULEURS PAR APP ──────────────────────────────────────────────────────────── */

    /* Star Arcade — or */
    .hero-card--star-arcade .hero-eyebrow,
    .hero-card--star-arcade .hero-cta { color: rgba(255,210,0,.9); }
    .hero-card--star-arcade .hero-scene--nitro::before {
      background:
        radial-gradient(ellipse 120% 60% at 20% 20%, rgba(255,255,255,.07), transparent 55%),
        radial-gradient(ellipse 60% 80% at 80% 80%, rgba(255,200,0,.12), transparent 50%);
    }
    .hero-card--star-arcade .hsc-grid {
      background-image:
        linear-gradient(rgba(255,200,0,.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,200,0,.07) 1px, transparent 1px);
    }
    .hero-card--star-arcade .hero-title--nitro { text-shadow: 0 1px 3px rgba(0,0,0,.8), 0 0 18px rgba(255,200,0,.35); }
    .hero-card--star-arcade .hero-title-accent { color: rgba(255,210,0,.95); }

    /* Botanica — vert */
    .hero-card--botanica .hero-eyebrow,
    .hero-card--botanica .hero-cta { color: rgba(125,216,122,.9); }
    .hero-card--botanica .hero-scene--nitro::before {
      background:
        radial-gradient(ellipse 120% 60% at 20% 20%, rgba(255,255,255,.07), transparent 55%),
        radial-gradient(ellipse 60% 80% at 80% 80%, rgba(80,200,80,.12), transparent 50%);
    }
    .hero-card--botanica .hsc-grid {
      background-image:
        linear-gradient(rgba(80,200,80,.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(80,200,80,.07) 1px, transparent 1px);
    }
    .hero-card--botanica .hero-title--nitro { text-shadow: 0 1px 3px rgba(0,0,0,.8), 0 0 18px rgba(80,200,80,.35); }
    .hero-card--botanica .hero-title-accent { color: rgba(125,216,122,.95); }

    /* Clicker — rose/magenta */
    .hero-card--clicker .hero-eyebrow,
    .hero-card--clicker .hero-cta { color: rgba(255,80,240,.9); }
    .hero-card--clicker .hero-scene--nitro::before {
      background:
        radial-gradient(ellipse 120% 60% at 20% 20%, rgba(255,255,255,.07), transparent 55%),
        radial-gradient(ellipse 60% 80% at 80% 80%, rgba(255,61,242,.14), transparent 50%);
    }
    .hero-card--clicker .hsc-grid {
      background-image:
        linear-gradient(rgba(255,61,242,.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,61,242,.07) 1px, transparent 1px);
    }
    .hero-card--clicker .hero-title--nitro { text-shadow: 0 1px 3px rgba(0,0,0,.8), 0 0 18px rgba(255,61,242,.35); }
    .hero-card--clicker .hero-title-accent { color: rgba(255,80,240,.95); }

  `;
  document.head.appendChild(style);
}
