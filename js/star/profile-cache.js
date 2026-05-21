/**
 * profile-cache.js — Cache module-level pour les appels /rest/v1/profiles
 *
 * Pattern : si le profil a déjà été fetché dans la session courante,
 * on retourne le cache sans refaire de requête réseau.
 *
 * Usage :
 *   import { getProfile } from './profile-cache.js';
 *   const profile = await getProfile(supabase, userId);
 */

/** @type {Object|null} */
let _profileCache = null;
/** @type {string|null} */
let _cachedUserId = null;

/**
 * Retourne le profil Supabase de l'utilisateur, avec cache module-level.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {boolean} [force=false] — force un re-fetch même si le cache existe
 * @returns {Promise<Object|null>}
 */
export async function getProfile(supabase, userId, force = false) {
  if (!force && _profileCache !== null && _cachedUserId === userId) {
    return _profileCache;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    _profileCache = data;
    _cachedUserId = userId;
    return data;
  } catch {
    return null;
  }
}

/**
 * Invalide le cache (utile après une mise à jour du profil).
 */
export function invalidateProfileCache() {
  _profileCache = null;
  _cachedUserId = null;
}
