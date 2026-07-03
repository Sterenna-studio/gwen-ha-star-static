// ── NITRO SHARED SUPABASE CONFIG ───────────────────────────────────────────
// `config.js` is generated at deploy time from GitHub Actions secrets.
// This wrapper keeps imports centralized and gives clearer errors when runtime
// config is missing or malformed.

import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

export { SUPABASE_URL, SUPABASE_ANON };

export function assertSupabaseConfig() {
  const missing = [];
  if (!SUPABASE_URL || typeof SUPABASE_URL !== 'string') missing.push('SUPABASE_URL');
  if (!SUPABASE_ANON || typeof SUPABASE_ANON !== 'string') missing.push('SUPABASE_ANON');

  if (missing.length) {
    throw new Error(`[Nitro Supabase] Missing runtime config: ${missing.join(', ')}. Generate shared/config.js during deployment.`);
  }

  try {
    const url = new URL(SUPABASE_URL);
    if (!url.hostname.includes('supabase')) {
      console.warn('[Nitro Supabase] SUPABASE_URL does not look like a Supabase host:', url.hostname);
    }
  } catch {
    throw new Error('[Nitro Supabase] SUPABASE_URL is not a valid URL.');
  }
}
