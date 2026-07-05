import { supabase } from '../supabase.js';

const PG_TRAINER_SPRITE = sprite =>
  `https://play.pokemonshowdown.com/sprites/trainers/${encodeURIComponent(sprite)}.png`;

export async function loadPokegangFromSupabase(userId) {
  const sbPg = document.getElementById('sb-pg');
  const sbDot = sbPg?.querySelector('.sb-dot');
  const sbLbl = sbPg?.querySelector('span:last-child');

  try {
    const { data, error } = await supabase
      .from('pokegang_players')
      .select('gang_name, boss_name, reputation, total_caught, shiny_count, dex_kanto_count, dex_national_count, agents_count')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      renderPokegangOffline();
      return;
    }

    if (sbDot) {
      sbDot.classList.remove('off');
      sbDot.classList.add('green');
    }
    if (sbLbl) sbLbl.textContent = 'POKEGANG · SYNC';

    setEl('pg-gang-name', data.gang_name ?? 'TEAM ???');
    setEl('pg-boss-name', `BOSS : ${data.boss_name ?? '???'}`);
    setEl('pg-rep', (data.reputation ?? 0).toLocaleString('fr-FR'));
    setEl('pg-caught', (data.total_caught ?? 0).toLocaleString('fr-FR'));
    setEl('pg-shinies', `✦ SHINIES : ${(data.shiny_count ?? 0).toLocaleString('fr-FR')}`);
    setEl('pg-dex', (data.dex_kanto_count ?? 0).toLocaleString('fr-FR'));
    setEl('pg-dex-nat', `NATIONAL : ${(data.dex_national_count ?? 0).toLocaleString('fr-FR')}`);
    setEl('pg-agents', (data.agents_count ?? 0).toLocaleString('fr-FR'));
    setEl('kpi-pg-rep', (data.reputation ?? 0).toLocaleString('fr-FR'));
  } catch {
    renderPokegangOffline();
  }
}

export async function loadPokegangLeaderboard(userId) {
  const el = document.getElementById('pg-leaderboard');
  if (!el) return;

  try {
    const { data, error } = await supabase
      .from('pokegang_leaderboard')
      .select('user_id, gang_name, boss_name, boss_sprite, reputation, total_caught, shiny_count, dex_national_count, agents_count')
      .eq('is_anonymous', false)
      .order('reputation', { ascending: false })
      .limit(8);

    if (error || !data || data.length === 0) {
      renderPgBoardEmpty(el);
      return;
    }

    renderPgBoard(el, data, userId);
  } catch {
    renderPgBoardEmpty(el);
  }
}

function renderPokegangOffline() {
  const sbPg = document.getElementById('sb-pg');
  const sbDot = sbPg?.querySelector('.sb-dot');
  const sbLbl = sbPg?.querySelector('span:last-child');

  if (sbDot) sbDot.classList.add('off');
  if (sbLbl) sbLbl.textContent = 'POKEGANG · OFFLINE';

  setEl('pg-gang-name', 'NON CONNECTÉ');
  setEl('pg-boss-name', 'BOSS : —');
  setEl('pg-rep', '—');
  setEl('pg-caught', '—');
  setEl('pg-shinies', '✦ SHINIES : —');
  setEl('pg-dex', '—');
  setEl('pg-dex-nat', 'NATIONAL : —');
  setEl('pg-agents', '—');
  setEl('kpi-pg-rep', 'OFFLINE');
}

function renderPgBoard(el, rows, userId) {
  el.innerHTML = `<ol class="pgl-list" role="list">
    ${rows.map((g, i) => {
      const rank = i + 1;
      const me = userId && g.user_id === userId ? ' pgl-row--me' : '';
      const top = rank <= 3 ? ` pgl-row--top pgl-rank-${rank}` : '';
      const sprite = g.boss_sprite
        ? `<img class="pgl-sprite" src="${PG_TRAINER_SPRITE(g.boss_sprite)}" alt="" loading="lazy" onerror="this.remove()">`
        : '<span class="pgl-sprite pgl-sprite--none" aria-hidden="true">◉</span>';
      return `<li class="pgl-row${top}${me}">
        <span class="pgl-rank">${rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : '#' + rank}</span>
        ${sprite}
        <div class="pgl-id">
          <span class="pgl-gang">${esc(g.gang_name) || 'Team ???'}</span>
          <span class="pgl-boss">BOSS · ${esc(g.boss_name) || '???'}</span>
        </div>
        <div class="pgl-stats">
          <span class="pgl-stat"><b>${compactNum(g.reputation)}</b><i>RÉPUT.</i></span>
          <span class="pgl-stat"><b>${compactNum(g.total_caught)}</b><i>CAPT.</i></span>
          <span class="pgl-stat pgl-stat--shiny"><b>${compactNum(g.shiny_count)}</b><i>✦ SHINY</i></span>
          <span class="pgl-stat"><b>${compactNum(g.dex_national_count)}</b><i>DEX</i></span>
        </div>
      </li>`;
    }).join('')}
  </ol>
  <div class="pgl-foot">SYNC · POKEGANG.STERENNA.FR · TOP ${rows.length}</div>`;
}

function renderPgBoardEmpty(el) {
  el.innerHTML = `
    <div class="widget-empty">
      <span class="widget-empty-icon">◉</span>
      <p>Classement indisponible</p>
      <span class="widget-empty-sub">POKEGANG_LEADERBOARD · OFFLINE</span>
    </div>`;
}

function compactNum(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
