import { initDashboard } from './dashboard.js';
import { supabase, signOut } from '../supabase.js';
import { requireAuth } from './guard.js';
import { getProfile } from './profile-cache.js';
import { renderNitroHeroCards } from './nitro-app-renderer.js';

function startClock() {
  const el = document.getElementById('sb-clock');
  const tick = () => {
    if (el) el.textContent = new Date().toLocaleTimeString('fr-FR');
  };
  tick();
  setInterval(tick, 1000);
}

function startUptime() {
  const t0 = Date.now();
  const el = document.getElementById('kpi-uptime');

  setInterval(() => {
    if (!el) return;
    const s = Math.floor((Date.now() - t0) / 1000);
    el.textContent =
      `${String(Math.floor(s / 3600)).padStart(2, '0')}:` +
      `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:` +
      `${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}

function bindSignOut() {
  document.getElementById('btn-signout-strip')?.addEventListener('click', () => signOut());
}

function bindChroniclesToggle() {
  document.getElementById('sb-cfm')?.addEventListener('click', () => {
    const bar = document.getElementById('cfm-widget');
    if (bar) bar.classList.toggle('cfm-visible');
  });
}

async function loadMembers() {
  const el = document.getElementById('kpi-members');
  try {
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    if (el) el.textContent = count ?? '?';
  } catch {
    if (el) el.textContent = '?';
  }
}

function populateWelcome(user, profile) {
  const username = profile?.username ?? user.email?.split('@')[0] ?? 'AGENT';
  const role = profile?.active_title ?? 'Agent';

  document.getElementById('w-name').textContent = username.toUpperCase();
  document.getElementById('w-role').textContent = '◆ ' + role.toUpperCase();
  document.getElementById('sb-username').textContent = username.toUpperCase();

  const av = document.getElementById('w-avatar');
  if (av) {
    if (profile?.avatar_url) {
      av.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" width="50" height="50" loading="lazy">`;
    } else {
      av.textContent = username.charAt(0).toUpperCase();
    }
  }
}

async function bootCockpit() {
  startClock();
  startUptime();
  bindSignOut();
  bindChroniclesToggle();

  renderNitroHeroCards('nitro-hero-cards');

  const auth = await requireAuth();
  if (!auth) return;

  const { user, profile } = auth;
  populateWelcome(user, profile);
  loadMembers();

  const cachedProfile = await getProfile(supabase, user.id);
  const el = document.getElementById('kpi-chronicles');
  if (el) el.textContent = (cachedProfile?.chronicles ?? 0).toLocaleString('fr-FR');

  await initDashboard(auth);
}

await bootCockpit();
