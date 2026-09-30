import { supabase } from './supabaseClient.js';

export async function getClient() {
  return supabase;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('getUser error:', error.message);
    return null;
  }
  return data.user || null;
}

export async function requireLogin() {
  const user = await getUser();
  if (!user && typeof window !== 'undefined') {
    window.location.href = '/old-gwen/login.html';
  }
  return user;
}
