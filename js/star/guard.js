/**
 * guard.js — Vérifie la session Supabase.
 * Redirige vers /login.html?next=<url_actuelle> si non connecté.
 * Usage : import { requireAuth } from './guard.js';
 *         const { session, profile } = await requireAuth();
 */
import { supabase, getSession } from '../supabase.js';

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?next=${next}`;
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return { session, user: session.user, profile: profile ?? {} };
}

export function getProfileMeta(profile, user) {
  return {
    username:    profile.username    ?? user.email?.split('@')[0] ?? 'AGENT',
    role:        profile.role        ?? 'guest',
    activeTitle: profile.active_title ?? 'Recrue',
    titles:      profile.titles      ?? ['Recrue'],
    avatarUrl:   profile.avatar_url  ?? null,
  };
}
