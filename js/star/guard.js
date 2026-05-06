/**
 * guard.js — Protège toutes les pages star/
 * À importer en PREMIER dans chaque page star/*.html
 * Redirige vers /login.html?next=<url> si pas de session active.
 */
import { supabase } from '../supabase.js';

export async function guardStar() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    window.location.replace('/login.html?next=' + next);
    // Stoppe l'exécution pendant la redirection
    await new Promise(() => {});
  }
  return session;
}

/**
 * Retourne les métadonnées du profil (username, avatar_url, rang)
 * depuis user_metadata Supabase ou la table profiles si elle existe.
 */
export function getProfileMeta(session) {
  const meta = session.user.user_metadata ?? {};
  return {
    id:         session.user.id,
    email:      session.user.email ?? '',
    username:   meta.username ?? meta.name ?? session.user.email.split('@')[0],
    avatar_url: meta.avatar_url ?? null,
    rang:       meta.rang ?? 'MEMBRE',
  };
}
