// ── NITRO SHARED SUPABASE CLIENT ────────────────────────────────────────────
// Shared by Gwen Ha Star, /star, Botanica, TCG and future Nitro apps.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0?bundle';
import { SUPABASE_URL, SUPABASE_ANON, assertSupabaseConfig } from './supabase-config.js';

assertSupabaseConfig();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
