/**
 * dashboard.js — Orchestration du cockpit star/index.html.
 */
import { requireAuth, getProfileMeta } from './guard.js';
import { loadActivity } from './activity.js';
import { renderHeader } from './header.js';
import { loadPokegangFromSupabase, loadPokegangLeaderboard } from './pokegang.js';
import { renderQuickAccess } from './quick-access.js';
import { loadRadio } from './radio.js';
import { loadVideo } from './video.js';

export async function initDashboard(authContext = null) {
  const auth = authContext ?? await requireAuth();
  if (!auth) return;

  const { user, profile } = auth;
  const meta = auth.meta ?? getProfileMeta(profile ?? {}, user);

  renderHeader(meta);
  renderQuickAccess();

  await Promise.all([
    loadVideo(),
    loadActivity(auth),
    loadPokegangFromSupabase(user.id),
    loadPokegangLeaderboard(user.id),
  ]);

  loadRadio(user, meta);
}
