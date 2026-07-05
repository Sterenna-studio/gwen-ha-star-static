import { requireAuth } from '../../shared/guards.js';

export async function requireStarSuperuser(app, options = {}) {
  const auth = await requireAuth({ redirectTo: '/login.html' });
  if (!auth) return null;

  if (auth.profile?.role !== 'superuser') {
    renderDenied(app, auth, options.title ?? 'ADMIN STAR');
    return null;
  }

  return auth;
}

function renderDenied(app, auth, title) {
  if (!app) return;

  const section = document.createElement('section');
  section.className = 'star-admin-card star-admin-locked';

  const kicker = document.createElement('p');
  kicker.className = 'star-admin-kicker';
  kicker.textContent = `// ${title}`;

  const heading = document.createElement('h1');
  heading.className = 'star-admin-title';
  heading.innerHTML = 'ACCÈS <span>REFUSÉ</span>';

  const copy = document.createElement('p');
  copy.className = 'star-admin-sub';
  copy.textContent = `Console réservée aux profils superuser. Rôle détecté : ${auth.profile?.role ?? 'aucun profil'}.`;

  const link = document.createElement('a');
  link.className = 'star-admin-btn';
  link.href = '/star/';
  link.textContent = 'RETOUR COCKPIT';

  section.append(kicker, heading, copy, link);
  app.replaceChildren(section);
}
