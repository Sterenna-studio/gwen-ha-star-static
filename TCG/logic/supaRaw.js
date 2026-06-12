// TCG/logic/supaRaw.js
// Utilise le client partagé Nitro → session récupérée automatiquement.
import { supabase } from '../shared/supabaseClient.js';
import { getUser as nitroGetUser, getSession } from '/shared/auth.js';

export async function getClient() {
  return supabase;
}

// getUser() depuis le client partagé (session Nitro)
export async function getUser() {
  return await nitroGetUser();
}

export async function getSession_() {
  return await getSession();
}

export async function requireLogin() {
  const user = await getUser();
  if (!user) throw new Error('Non connecté — redirection login');
  return user;
}
