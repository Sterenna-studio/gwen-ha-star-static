// admin-dashboard.js — Sterenna superuser dashboard
import { supabase } from '/shared/supabase-client.js';

const SUPER_ID = 'c496aac4-7ed3-4173-9666-a4f30098cac7';

// ── Auth guard ────────────────────────────────────────────────────────────────
const { data: { session } } = await supabase.auth.getSession();
if (!session || session.user.id !== SUPER_ID) {
  document.getElementById('guard').innerHTML = '⛔ Accès refusé';
} else {
  document.getElementById('guard').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('refresh-btn').addEventListener('click', loadAll);
  loadAll();
}

// ── Log ───────────────────────────────────────────────────────────────────────
function log(msg, level = 'ok') {
  const el = document.getElementById('log');
  const ts = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const div = document.createElement('div');
  div.className = 'entry';
  div.innerHTML = `<span class="ts">${ts}</span><span class="${level}">${msg}</span>`;
  el.prepend(div);
  while (el.children.length > 60) el.removeChild(el.lastChild);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function badge(text, type = 'info') {
  return `<span class="badge ${type}">${text}</span>`;
}
function shortId(id) {
  return id ? `<span title="${id}">${id.slice(0, 8)}…</span>` : '—';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function kpi(id, val, color = '') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<span style="color:${color || 'var(--accent2)'}">${val}</span>`;
}
function empty(tbodyId, cols, msg = 'Aucune donnée') {
  document.getElementById(tbodyId).innerHTML =
    `<tr><td colspan="${cols}" style="color:var(--muted);text-align:center;padding:14px">${msg}</td></tr>`;
}

// ── Projects / OVH ───────────────────────────────────────────────────────────
const PROJECTS = [
  { name: 'Accueil',          url: '/' },
  { name: 'Login',            url: '/login.html' },
  { name: 'CIG',              url: '/cig.html' },
  { name: 'Skill Arena',      url: '/arena/' },
  { name: 'Nitro Clicker',    url: '/clicker/' },
  { name: 'BZH Universe',     url: '/bzh-universe/' },
  { name: 'Corebots',         url: '/corebots/' },
  { name: 'Titan Rocket Run', url: '/titan-rocket-run/' },
  { name: 'Botanica Obscura', url: '/botanica-obscura/' },
  { name: 'TCG',              url: '/TCG/' },
  { name: 'Jukebox',          url: '/jukebox/' },
  { name: 'Star Crew',        url: '/star/' },
];

async function pingUrl(url) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0) };
  } catch { return { ok: false, status: 0, ms: null }; }
}

async function loadProjectStatus() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = PROJECTS.map((p, i) => `
    <div class="proj-card" id="proj-${i}">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="status-dot pending" id="dot-${i}"></span>
        <span class="proj-name">${p.name}</span>
      </div>
      <div class="proj-url">${p.url}</div>
      <div class="proj-meta">
        <span class="proj-ms" id="ms-${i}">…</span>
        <span class="badge info" id="st-${i}">…</span>
      </div>
    </div>`).join('');

  let up = 0;
  await Promise.all(PROJECTS.map(async (p, i) => {
    const r = await pingUrl(p.url);
    document.getElementById(`dot-${i}`).className = 'status-dot ' + (r.ok ? 'ok' : 'err');
    document.getElementById(`proj-${i}`).classList.add(r.ok ? 'online' : 'offline');
    document.getElementById(`ms-${i}`).textContent = r.ms != null ? r.ms + ' ms' : '—';
    const stEl = document.getElementById(`st-${i}`);
    stEl.className  = 'badge ' + (r.ok ? 'ok' : 'err');
    stEl.textContent = r.ok ? (r.status || 'OK') : (r.status || 'ERR');
    if (r.ok) up++;
  }));

  kpi('kpi-projects', `${up}/${PROJECTS.length}`, up === PROJECTS.length ? 'var(--ok)' : 'var(--warn)');
  log(`✓ Ping: ${up}/${PROJECTS.length} projets en ligne`, up === PROJECTS.length ? 'ok' : 'warn');
}

// ── GitHub Actions ────────────────────────────────────────────────────────────
async function loadGHActions() {
  try {
    const res = await fetch(
      'https://api.github.com/repos/sterenna-studio/gwen-ha-star-static/actions/runs?per_page=10',
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { workflow_runs: runs } = await res.json();
    if (!runs?.length) { empty('tbl-actions', 6, 'Aucun run'); return; }

    const rows = runs.map(r => {
      const conclusion = r.conclusion ?? r.status ?? '?';
      const btype = conclusion === 'success' ? 'ok'
                  : conclusion === 'failure' ? 'err'
                  : conclusion === 'in_progress' ? 'warn' : 'info';
      const dur = (r.run_started_at && r.updated_at)
        ? Math.round((new Date(r.updated_at) - new Date(r.run_started_at)) / 1000) + 's'
        : '—';
      return `<tr>
        <td class="name">${r.name}</td>
        <td>${badge(conclusion, btype)}</td>
        <td class="mono">${r.head_branch}</td>
        <td class="mono">${r.event}</td>
        <td class="mono">${dur}</td>
        <td class="mono">${fmtDate(r.run_started_at)}</td>
      </tr>`;
    }).join('');
    document.getElementById('tbl-actions').innerHTML = rows;
    log(`✓ ${runs.length} GH Actions runs chargés`, 'ok');
  } catch(e) {
    log('⚠ GitHub Actions: ' + e.message, 'warn');
    empty('tbl-actions', 6, '⚠ ' + e.message);
  }
}

// ── Load all ──────────────────────────────────────────────────────────────────
async function loadAll() {
  document.getElementById('last-refresh').textContent = 'Chargement…';
  log('→ Rafraîchissement en cours…', 'ok');
  await Promise.allSettled([
    loadProjectStatus(),
    loadGHActions(),
    loadPlayers(),
    loadPackTypes(),
    loadTopCards(),
    loadAuthUsers(),
  ]);
  document.getElementById('last-refresh').textContent =
    'Mis à jour ' + new Date().toLocaleTimeString('fr-FR');
  log('✓ Rafraîchissement terminé', 'ok');
}

// ── Players ───────────────────────────────────────────────────────────────────
async function loadPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('gold', { ascending: false })
    .limit(100);

  if (error) { log('❌ players: ' + error.message, 'err'); empty('tbl-players', 6, '❌ ' + error.message); return; }

  kpi('kpi-players', data.length);
  const totalGold = data.reduce((s, p) => s + (p.gold ?? 0), 0);
  kpi('kpi-gold', totalGold.toLocaleString('fr-FR'), 'var(--warn)');
  const totalCards = data.reduce((s, p) => s + (p.cards_count ?? 0), 0);
  kpi('kpi-cards', totalCards.toLocaleString('fr-FR'), 'var(--accent)');

  if (!data.length) { empty('tbl-players', 6); return; }

  const rows = data.map(p => {
    const legendBadge = p.has_legendary
      ? badge('✦ OUI', 'mythic')
      : badge('non', 'info');
    return `<tr>
      <td class="name">${p.username || '—'}</td>
      <td>${(p.gold ?? 0).toLocaleString('fr-FR')} <span style="color:var(--warn)">G</span></td>
      <td>${(p.cards_count ?? 0).toLocaleString('fr-FR')}</td>
      <td>${legendBadge}</td>
      <td>${p.pack_count ?? '—'}</td>
      <td class="mono">${shortId(p.id)}</td>
    </tr>`;
  }).join('');
  document.getElementById('tbl-players').innerHTML = rows;
  log(`✓ ${data.length} joueurs chargés`, 'ok');
}

// ── Pack types ────────────────────────────────────────────────────────────────
async function loadPackTypes() {
  const { data, error } = await supabase
    .from('pack_types')
    .select('*')
    .order('price', { ascending: true });

  if (error) { log('❌ pack_types: ' + error.message, 'err'); empty('tbl-packs', 6, '❌ ' + error.message); return; }

  kpi('kpi-packs', data.length, 'var(--accent2)');

  if (!data.length) { empty('tbl-packs', 6); return; }

  const rows = data.map(p => {
    const guarantees = [
      p.require_champion  && badge('Champion', 'info'),
      p.require_epic      && badge('Epic', 'warn'),
      p.require_legendary && badge('Legendary', 'mythic'),
      p.require_mythical  && badge('Mythical', 'err'),
    ].filter(Boolean).join(' ') || '—';
    return `<tr>
      <td class="name">${p.name}</td>
      <td>${badge(p.set_id || '—', 'info')}</td>
      <td>${(p.price ?? 0).toLocaleString('fr-FR')} <span style="color:var(--warn)">G</span></td>
      <td>${p.card_count ?? '—'}</td>
      <td>${guarantees}</td>
      <td class="mono">${shortId(String(p.id))}</td>
    </tr>`;
  }).join('');
  document.getElementById('tbl-packs').innerHTML = rows;
  log(`✓ ${data.length} pack_types chargés`, 'ok');
}

// ── Top cards ─────────────────────────────────────────────────────────────────
async function loadTopCards() {
  const { data, error } = await supabase
    .from('player_cards')
    .select('player_id, card_id, qty')
    .order('qty', { ascending: false })
    .limit(20);

  if (error) { log('❌ player_cards: ' + error.message, 'err'); empty('tbl-cards', 3, '❌ ' + error.message); return; }

  if (!data.length) { empty('tbl-cards', 3); return; }

  const rows = data.map(c => `<tr>
    <td class="mono">${shortId(c.player_id)}</td>
    <td>${c.card_id}</td>
    <td>${badge(c.qty, c.qty >= 5 ? 'err' : c.qty >= 3 ? 'warn' : 'ok')}</td>
  </tr>`).join('');
  document.getElementById('tbl-cards').innerHTML = rows;
  log(`✓ Top ${data.length} cartes chargées`, 'ok');
}

// ── Auth users ────────────────────────────────────────────────────────────────
async function loadAuthUsers() {
  // Nécessite service_role ou RLS permissive sur auth.users — sinon vide
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) { log('⚠ profiles: ' + error.message, 'warn'); empty('tbl-users', 5, '⚠ ' + error.message); return; }

  kpi('kpi-users', data.length + (data.length === 10 ? '+' : ''), 'var(--accent2)');

  if (!data.length) { empty('tbl-users', 5, 'Table profiles vide ou inaccessible'); return; }

  const rows = data.map(u => `<tr>
    <td class="name">${u.username || '—'}</td>
    <td class="mono">${fmtDate(u.created_at)}</td>
    <td class="mono">${fmtDate(u.updated_at)}</td>
    <td>${badge('supabase', 'info')}</td>
    <td class="mono">${shortId(u.id)}</td>
  </tr>`).join('');
  document.getElementById('tbl-users').innerHTML = rows;
  log(`✓ ${data.length} profils chargés`, 'ok');
}
