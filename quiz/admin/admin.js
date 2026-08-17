import { requireStarSuperuser } from '../../star/admin/admin-guard.js';
import { supabase } from '../../shared/supabase-client.js';

const app = document.getElementById('app');
const axisLabels = {
  organisation: 'Organisation', anticipation: 'Anticipation', maintenance: 'Maintenance',
  hygiene_numerique: 'Hygiène numérique', setup: 'Setup',
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

boot();

async function boot() {
  const auth = await requireStarSuperuser(app, { title: 'QUIZZ ADMIN' });
  if (!auth) return;
  app.innerHTML = `
    <header class="admin-top"><div><p class="kicker">// GWEN HA STAR</p><h1>STATS <span>QUIZZ</span></h1><p class="sub">Résultats agrégés du test Gamer Profile. Les données démographiques détaillées ne sont jamais enregistrées.</p></div><nav class="actions"><a class="button" href="../">← Tous les quizz</a><select id="version-filter" aria-label="Filtrer par version"><option value="all">Toutes les versions</option></select><button class="button primary" id="refresh" type="button">↻ Actualiser</button></nav></header>
    <section class="stats" id="stats"></section>
    <section class="section admin-card"><div class="section-head"><h2>Tendance Rond moyenne par axe</h2></div><div class="axis-list" id="axes"></div></section>
    <section class="section admin-card"><div class="section-head"><h2>Profils globaux</h2></div><div class="profile-list" id="profiles"></div></section>
    <section class="section admin-card"><div class="section-head"><h2>Derniers résultats</h2><span class="stat-label" id="sample-note"></span></div><div class="table-wrap" id="recent"></div></section>`;
  document.getElementById('refresh').addEventListener('click', refresh);
  document.getElementById('version-filter').addEventListener('change', refresh);
  await refresh();
}

async function refresh() {
  const filter = document.getElementById('version-filter').value;
  const refreshButton = document.getElementById('refresh');
  refreshButton.disabled = true;
  let query = supabase.from('quiz_results').select('created_at,quiz_version,pseudonym,global_level,global_profile,rond_percent,carre_percent,axis_scores,bonus_points,has_pets').eq('quiz_id', 'gamer-profile-test').order('created_at', { ascending: false }).limit(5000);
  if (filter !== 'all') query = query.eq('quiz_version', filter);
  const { data, error } = await query;
  refreshButton.disabled = false;
  if (error) { showError(error.message); return; }
  const rows = Array.isArray(data) ? data : [];
  updateVersionFilter(rows, filter);
  renderStats(rows);
}

function updateVersionFilter(rows, selected) {
  const select = document.getElementById('version-filter');
  const known = new Set([...select.options].slice(1).map((option) => option.value));
  [...new Set(rows.map((row) => row.quiz_version))].sort().forEach((version) => {
    if (known.has(version)) return;
    const option = document.createElement('option'); option.value = version; option.textContent = `Version ${version}`; select.append(option);
  });
  select.value = selected;
}

function renderStats(rows) {
  const average = (key) => rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length) : 0;
  const versions = new Set(rows.map((row) => row.quiz_version)).size;
  const petRate = rows.length ? Math.round((rows.filter((row) => row.has_pets).length / rows.length) * 100) : 0;
  document.getElementById('stats').innerHTML = [
    ['Réponses', rows.length], ['Rond moyen', `${average('rond_percent')} %`], ['Avec bonus animal', `${petRate} %`], ['Versions actives', versions],
  ].map(([label, value]) => `<article class="admin-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></article>`).join('');

  document.getElementById('axes').innerHTML = Object.entries(axisLabels).map(([axis, label]) => {
    const value = rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.axis_scores?.[axis] || 0), 0) / rows.length) : 0;
    return `<div class="bar-row"><span>${label}</span><span class="bar-track"><span class="bar-fill" style="width:${value}%"></span></span><span class="bar-value">${value} %</span></div>`;
  }).join('');

  const counts = rows.reduce((map, row) => map.set(row.global_profile, (map.get(row.global_profile) || 0) + 1), new Map());
  const sortedProfiles = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  document.getElementById('profiles').innerHTML = sortedProfiles.length ? sortedProfiles.map(([profile, count]) => {
    const value = Math.round((count / rows.length) * 100);
    return `<div class="bar-row"><span>${escapeHtml(profile)}</span><span class="bar-track"><span class="bar-fill" style="width:${value}%"></span></span><span class="bar-value">${value} %</span></div>`;
  }).join('') : '<p class="empty">Aucun résultat enregistré.</p>';

  document.getElementById('sample-note').textContent = rows.length === 5000 ? 'Échantillon limité aux 5 000 derniers' : `${rows.length} résultat(s)`;
  document.getElementById('recent').innerHTML = rows.length ? `<table><thead><tr><th>Date</th><th>Pseudo</th><th>Version</th><th>Profil</th><th>Gradient</th><th>Bonus</th></tr></thead><tbody>${rows.slice(0, 100).map((row) => `<tr><td>${escapeHtml(new Date(row.created_at).toLocaleString('fr-FR'))}</td><td>${escapeHtml(row.pseudonym)}</td><td>V${escapeHtml(row.quiz_version)}</td><td>${escapeHtml(row.global_level)} · ${escapeHtml(row.global_profile)}</td><td>${escapeHtml(row.carre_percent)} % Carré / ${escapeHtml(row.rond_percent)} % Rond</td><td>+${escapeHtml(row.bonus_points)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucun résultat enregistré.</p>';
}

function showError(message) {
  document.getElementById('stats').innerHTML = `<article class="admin-card error">Chargement impossible : ${escapeHtml(message)}</article>`;
  document.getElementById('axes').innerHTML = '';
  document.getElementById('profiles').innerHTML = '';
  document.getElementById('recent').innerHTML = '';
}
