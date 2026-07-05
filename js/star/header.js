import { signOut } from '../supabase.js';

export function renderHeader(profile) {
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
