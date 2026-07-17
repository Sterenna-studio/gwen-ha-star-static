/**
 * alt-cockpit.js — Boot commun des versions alternatives du Star
 * (star/aero.html, star/frutiger-globe/, star/frutiger-biome/, star/frutiger-dock/).
 *
 * Même socle que cockpit.js (auth + widgets réels via initDashboard) mais
 * piloté par attributs data-* pour s'adapter à n'importe quel habillage :
 *   - [data-star-field="username|role|chronicles|members"] → valeur réelle
 *   - [data-star-avatar]  → avatar (img ou initiale)
 *   - [data-star-signout] → bouton de déconnexion
 * Les widgets se montent sur les IDs standards s'ils existent dans la page
 * (widget-radio, widget-activity, widget-video, quick-access-grid, …) —
 * chaque loader est null-safe, une page n'inclut que ce qu'elle veut.
 */
import { initDashboard } from './dashboard.js';
import { supabase, signOut } from '../supabase.js';
import { requireAuth } from './guard.js';
import { getProfile } from './profile-cache.js';

function fillField(name, value) {
  document.querySelectorAll(`[data-star-field="${name}"]`).forEach(el => {
    el.textContent = value;
  });
}

function fillAvatar(profile, username) {
  document.querySelectorAll('[data-star-avatar]').forEach(el => {
    if (profile?.avatar_url) {
      el.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar ${username}" width="44" height="44" loading="lazy">`;
    } else {
      el.textContent = username.charAt(0).toUpperCase();
    }
  });
}

function bindSignOut() {
  document.querySelectorAll('[data-star-signout]').forEach(btn => {
    btn.addEventListener('click', () => signOut());
  });
}

async function loadMembersCount() {
  try {
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    fillField('members', count ?? '?');
  } catch {
    fillField('members', '?');
  }
}

async function bootAltCockpit() {
  const auth = await requireAuth();
  if (!auth) return;

  const { user, profile } = auth;
  const username = profile?.username ?? user.email?.split('@')[0] ?? 'AGENT';
  const role = profile?.active_title ?? 'Agent';

  fillField('username', username.toUpperCase());
  fillField('role', role.toUpperCase());
  fillAvatar(profile, username);
  bindSignOut();
  loadMembersCount();

  getProfile(supabase, user.id).then(cached => {
    fillField('chronicles', (cached?.chronicles ?? 0).toLocaleString('fr-FR'));
  });

  await initDashboard(auth);
}

await bootAltCockpit();
