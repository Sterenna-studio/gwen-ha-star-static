/**
 * crew.js — Logique star/crew.html
 * Charge la liste des membres depuis Supabase (table profiles)
 * Filtre par rang, recherche par pseudo
 */
import { guardStar }  from './guard.js';
import { supabase }   from '../supabase.js';
import { signOut }    from '../supabase.js';

export async function initCrew() {
  const session = await guardStar();
  _renderCrewHeader(session);
  await _loadCrew();
  _bindFilters();
}

function _renderCrewHeader(session) {
  const el = document.getElementById('star-header-user');
  if (!el) return;
  const meta = session.user.user_metadata ?? {};
  const username = meta.username ?? meta.name ?? session.user.email.split('@')[0];
  el.innerHTML = `
    <div class="star-user-info">
      <span class="star-username">${username}</span>
    </div>
    <nav class="star-header-nav" aria-label="Navigation hub">
      <a href="/star/index.html"  class="star-nav-link">HUB</a>
      <a href="/cig.html"         class="star-nav-link">MA CIG</a>
    </nav>
    <button class="star-signout-btn" id="star-signout" aria-label="Déconnexion">✕ DÉCO</button>
  `;
  document.getElementById('star-signout')?.addEventListener('click', () => signOut());
}

async function _loadCrew() {
  const el = document.getElementById('crew-grid');
  if (!el) return;

  el.innerHTML = `<div class="crew-loading">
    <span class="crew-loading-dot"></span>
    <span class="crew-loading-dot"></span>
    <span class="crew-loading-dot"></span>
  </div>`;

  try {
    // Essaie table `profiles` — colonnes attendues : id, username, rang, avatar_url, bio_short
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, rang, avatar_url, bio_short')
      .order('rang', { ascending: true })
      .order('username', { ascending: true });

    if (error || !data || data.length === 0) {
      _renderCrewPlaceholder(el);
      return;
    }

    window._crewData = data; // cache pour les filtres
    _renderCrewGrid(el, data);

    // Popule le filtre de rang
    const rangs = [...new Set(data.map(m => m.rang).filter(Boolean))];
    _populateRangFilter(rangs);

  } catch {
    _renderCrewPlaceholder(el);
  }
}

function _renderCrewGrid(el, members) {
  if (!members.length) {
    _renderCrewPlaceholder(el);
    return;
  }
  el.innerHTML = members.map(m => {
    const initials = (m.username ?? '??').slice(0, 2).toUpperCase();
    return `
      <a href="/cig.html?id=${m.id}" class="crew-card" aria-label="CIG de ${m.username}">
        <div class="crew-avatar" aria-hidden="true">
          ${ m.avatar_url
            ? `<img src="${m.avatar_url}" alt="" width="48" height="48" loading="lazy">`
            : `<span class="crew-avatar-initials">${initials}</span>`
          }
        </div>
        <div class="crew-info">
          <span class="crew-username">${m.username ?? 'ANONYME'}</span>
          ${ m.rang ? `<span class="crew-rang">${m.rang}</span>` : '' }
          ${ m.bio_short ? `<span class="crew-bio">${m.bio_short}</span>` : '' }
        </div>
        <span class="crew-arrow" aria-hidden="true">→</span>
      </a>
    `;
  }).join('');
}

function _renderCrewPlaceholder(el) {
  el.innerHTML = `
    <div class="widget-empty crew-empty">
      <span class="widget-empty-icon">⬡</span>
      <p>Aucun membre trouvé</p>
      <span class="widget-empty-sub">PROFILES · OFFLINE</span>
    </div>
  `;
}

function _populateRangFilter(rangs) {
  const sel = document.getElementById('crew-filter-rang');
  if (!sel) return;
  rangs.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    sel.appendChild(opt);
  });
}

function _bindFilters() {
  const search = document.getElementById('crew-search');
  const rang   = document.getElementById('crew-filter-rang');
  const apply  = () => {
    const q = (search?.value ?? '').toLowerCase();
    const r = rang?.value ?? '';
    const filtered = (window._crewData ?? []).filter(m => {
      const matchQ = !q || (m.username ?? '').toLowerCase().includes(q);
      const matchR = !r || m.rang === r;
      return matchQ && matchR;
    });
    _renderCrewGrid(document.getElementById('crew-grid'), filtered);
  };
  search?.addEventListener('input',  apply);
  rang?.addEventListener('change', apply);
}
