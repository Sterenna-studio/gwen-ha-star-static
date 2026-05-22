/**
 * Compatibility wrapper for Star profile cache.
 * Shared Nitro profile logic now lives in /shared/profile.js.
 */

import { getProfile as getSharedProfile, invalidateProfileCache } from '../../shared/profile.js';

export async function getProfile(_supabase, userId, force = false) {
  return await getSharedProfile(userId, force);
}

export { invalidateProfileCache };
