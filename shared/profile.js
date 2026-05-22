// ── NITRO SHARED PROFILE HELPERS ────────────────────────────────────────────

import { supabase } from './supabase-client.js';

let profileCache = null;
let cachedUserId = null;

export async function getProfile(userId, force = false) {
  if (!userId) return null;

  if (!force && profileCache !== null && cachedUserId === userId) {
    return profileCache;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    profileCache = data;
    cachedUserId = userId;
    return data;
  } catch {
    return null;
  }
}

export function invalidateProfileCache() {
  profileCache = null;
  cachedUserId = null;
}

export function getProfileMeta(profile = {}, user = {}) {
  const email = user?.email ?? '';
  const fallbackName = email ? email.split('@')[0] : 'AGENT';

  return {
    username: profile.username ?? user?.user_metadata?.username ?? user?.user_metadata?.name ?? fallbackName,
    role: profile.role ?? 'guest',
    activeTitle: profile.active_title ?? profile.activeTitle ?? 'Recrue',
    titles: profile.titles ?? ['Recrue'],
    avatarUrl: profile.avatar_url ?? profile.avatarUrl ?? null,
  };
}

export function getDisplayNameFromUser(user, profile = null) {
  if (profile?.username) return profile.username;
  if (!user) return 'Agent invité';

  return (
    user.user_metadata?.username ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Agent'
  );
}
