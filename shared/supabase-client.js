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

scheduleHubVersionConsoleGate();

function scheduleHubVersionConsoleGate() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const run = () => {
    if (!document.querySelector('.hub-hero')) return;
    installHubVersionConsoleGate();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}

function installHubVersionConsoleGate() {
  installHubVersionConsoleStyle();

  const applyLockedState = allowed => {
    if (!document.body) return;
    document.body.dataset.ghsSuperuser = allowed ? 'true' : 'false';
    if (!allowed) document.getElementById('hub-version-switcher')?.remove();
  };

  const observer = new MutationObserver(() => {
    if (document.body?.dataset.ghsSuperuser === 'false') {
      document.getElementById('hub-version-switcher')?.remove();
    }
  });

  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  isCurrentUserSuperuser()
    .then(applyLockedState)
    .catch(error => {
      console.warn('[hub-version] superuser gate failed:', error?.message || error);
      applyLockedState(false);
    });
}

function installHubVersionConsoleStyle() {
  const id = 'hub-version-superuser-gate-style';
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    body:not([data-ghs-superuser="true"]) #hub-version-switcher {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

async function isCurrentUserSuperuser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.user) return false;

  const user = sessionData.session.user;
  if (hasSuperuserClaim(user?.app_metadata) || hasSuperuserClaim(user?.user_metadata)) return true;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,roles,is_superuser,superuser')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) return false;
  return hasSuperuserClaim(profile);
}

function hasSuperuserClaim(source = {}) {
  if (!source || typeof source !== 'object') return false;

  if (source.is_superuser === true || source.superuser === true) return true;

  const role = String(source.role ?? '').toLowerCase();
  if (role === 'superuser') return true;

  const roles = Array.isArray(source.roles) ? source.roles : [];
  return roles.some(value => String(value).toLowerCase() === 'superuser');
}
