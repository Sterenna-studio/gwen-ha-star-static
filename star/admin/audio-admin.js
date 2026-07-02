import { requireAuth } from '../../shared/guards.js';
import { supabase } from '../../shared/supabase-client.js';

const app = document.getElementById('app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

boot();

async function boot() {
  const auth = await requireAuth({ redirectTo: '/login.html' });
  if (!auth) return;

  if (auth.profile?.role !== 'superuser') {
    app.innerHTML = `
      <section class="aa-card aa-locked">
        <p class="aa-kicker">// AUDIO ADMIN</p>
        <h1 class="aa-title">ACCÈS <span>REFUSÉ</span></h1>
        <p class="aa-sub">Console réservée aux profils superuser.</p>
        <p><a class="aa-btn" href="/star/">← COCKPIT</a></p>
      </section>`;
    return;
  }

  app.innerHTML = `
    <header class="aa-top">
      <div>
        <p class="aa-kicker">// GWEN HA STAR</p>
        <h1 class="aa-title">ADMIN <span>AUDIO</span></h1>
        <p class="aa-sub">Dédicaces radio : 20 Chronicles, 100 caractères.</p>
      </div>
      <nav class="aa-actions">
        <a class="aa-btn" href="/star/">← COCKPIT</a>
        <a class="aa-btn" href="/jukebox/chronicles-fm.html">DATA AUDIO</a>
        <button class="aa-btn primary" id="aa-refresh">↻ RAFRAÎCHIR</button>
      </nav>
    </header>
    <section class="aa-grid" id="aa-stats"></section>
    <section class="aa-section aa-card">
      <div class="aa-section-title">// TEST DÉDICACE</div>
      <form class="aa-composer" id="aa-form">
        <textarea class="aa-textarea" id="aa-message" maxlength="100" placeholder="Message antenne, 100 caractères max"></textarea>
        <button class="aa-btn primary" type="submit">ENVOYER</button>
      </form>
      <div class="aa-toast" id="aa-toast"></div>
    </section>
    <section class="aa-section"><div class="aa-section-head"><div class="aa-section-title">// FILE DES DÉDICACES</div></div><div class="aa-list" id="aa-list"></div></section>`;

  document.getElementById('aa-refresh')?.addEventListener('click', refresh);
  document.getElementById('aa-form')?.addEventListener('submit', submitTest);
  await refresh();
}

async function refresh() {
  const statsReq = await supabase.rpc('admin_radio_stats');
  const listReq = await supabase.rpc('admin_radio_list_dedications', { p_status: null, p_limit: 120 });

  const stats = statsReq.data || {};
  document.getElementById('aa-stats').innerHTML = [
    ['TOTAL', stats.total],
    ['QUEUE', stats.queued],
    ['JOUÉES', stats.played],
    ['PRIX', `${stats.cost ?? 20} C`],
    ['LIMITE', stats.maxChars ?? 100],
  ].map(([label, value]) => `<article class="aa-card"><div class="aa-card-label">${label}</div><div class="aa-card-value">${esc(value ?? '—')}</div></article>`).join('');

  const rows = Array.isArray(listReq.data) ? listReq.data : [];
  const list = document.getElementById('aa-list');
  if (!rows.length) {
    list.innerHTML = '<article class="aa-card aa-muted">Aucune dédicace.</article>';
    return;
  }
  list.innerHTML = rows.map(row => `
    <article class="aa-dedication">
      <div>
        <div class="aa-meta"><span class="aa-status ${esc(row.status)}">${esc(row.status)}</span><span>${esc(row.username || 'AGENT')}</span><span>${esc(row.cost)} C</span></div>
        <div class="aa-msg">${esc(row.message)}</div>
      </div>
    </article>`).join('');
}

async function submitTest(event) {
  event.preventDefault();
  const input = document.getElementById('aa-message');
  const toast = document.getElementById('aa-toast');
  const message = input?.value?.trim() ?? '';
  if (message.length < 3 || message.length > 100) {
    toast.textContent = 'Message entre 3 et 100 caractères.';
    toast.classList.add('aa-error');
    return;
  }
  toast.classList.remove('aa-error');
  toast.textContent = 'Envoi...';
  const { error } = await supabase.rpc('submit_radio_dedication', { p_message: message });
  if (error) {
    toast.textContent = 'Envoi impossible.';
    toast.classList.add('aa-error');
    return;
  }
  input.value = '';
  toast.textContent = 'Dédicace ajoutée.';
  await refresh();
}
