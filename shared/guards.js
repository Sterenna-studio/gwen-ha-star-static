// ── NITRO SHARED ROUTE GUARDS ───────────────────────────────────────────────

import { getSession } from './auth.js';
import { getProfile, getProfileMeta } from './profile.js';

export async function requireAuth(options = {}) {
  const {
    redirectTo = '/login.html',
    preserveNext = true,
    withProfile = true,
  } = options;

  const session = await getSession();

  if (!session) {
    if (preserveNext) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${redirectTo}?next=${next}`;
    } else {
      window.location.href = redirectTo;
    }
    return null;
  }

  const user = session.user;
  const profile = withProfile ? await getProfile(user.id) : null;

  return {
    session,
    user,
    profile: profile ?? {},
    meta: getProfileMeta(profile ?? {}, user),
  };
}

export async function requireGuest(redirectTo = '/star/') {
  const session = await getSession();

  if (session) {
    window.location.href = redirectTo;
    return null;
  }

  return true;
}
