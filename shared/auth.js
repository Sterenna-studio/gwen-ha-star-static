// ── NITRO SHARED AUTH HELPERS ───────────────────────────────────────────────

import { supabase } from './supabase-client.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[Nitro Auth] getSession error:', error.message);
    return null;
  }
  return data.session;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('[Nitro Auth] getUser error:', error.message);
    return null;
  }
  return data.user;
}

export async function signIn(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut(redirectTo = '/login.html') {
  await supabase.auth.signOut();
  window.location.href = redirectTo;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
