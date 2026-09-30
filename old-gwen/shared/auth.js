import { supabase } from './supabaseClient.js';

export async function requireLogin() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    window.location.href = '/old-gwen/login.html';
    return null;
  }
  return data.user;
}
