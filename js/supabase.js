// ── SUPABASE CONFIG ─────────────────────────────────────────────────────────
// Dashboard → Settings → API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = 'https://nmdjrcswlnydglrxaivx.supabase.co';
const SUPABASE_ANON = 'sb_publishable_dE0SfyUd-Xw4JhuAVy4x1A_NZfB7lcH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── AUTH HELPERS ─────────────────────────────────────────────────────────────

/** Retourne la session active ou null */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Retourne l'utilisateur connecté ou null */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Connexion email + mot de passe */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/** Déconnexion */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}

/** Écoute les changements de session (login/logout) */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
