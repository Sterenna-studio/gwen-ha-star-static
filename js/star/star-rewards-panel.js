import { supabase } from '../supabase.js';

const STYLE_ID = 'star-rewards-panel-style-v1';
const CARD_ID = 'star-rewards-panel';
const DAILY_REWARDS = [50, 75, 100, 125, 150, 175, 300];

installRewardsPanel();

export function installRewardsPanel() {
  injectStyle();
  const run = () => {
    mountRewardsPanel();
    refreshRewardsPanel();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
}

function mountRewardsPanel() {
  if (document.getElementById(CARD_ID)) return;
  const bento = document.querySelector('.bento');
  if (!bento) return;

  const card = document.createElement('div');
  card.id = CARD_ID;
  card.className = 'bc bc-rewards';
  card.innerHTML = `
    <div class="bc-label rewards-label"><span class="bc-dot"></span>CHRONICLES · RÉCOMPENSES</div>
    <div class="rewards-panel" role="region" aria-label="Récompenses Chronicles">
      <div class="rewards-head">
        <div>
          <div class="rewards-title">BOUNTY TERMINAL</div>
          <div class="rewards-sub" id="rewards-sub">connexion au ledger…</div>
        </div>
        <div class="rewards-balance"><span>SOLDE</span><b id="rewards-balance">—</b></div>
      </div>

      <div class="rewards-main">
        <section class="reward-card reward-card--daily">
          <div class="reward-card-top">
            <span class="reward-kind">STREAK JOURNALIER</span>
            <span class="reward-pill" id="daily-claim-state">SCAN</span>
          </div>
          <div class="reward-amount"><span id="daily-next-reward">+—</span><small>Chronicles</small></div>
          <div class="reward-desc" id="daily-desc">Récompense de connexion quotidienne.</div>
          <div class="streak-track" id="daily-streak-track" aria-hidden="true"></div>
          <button type="button" class="reward-btn" id="claim-daily-btn">RÉCUPÉRER</button>
        </section>

        <section class="reward-card reward-card--challenge">
          <div class="reward-card-top">
            <span class="reward-kind">DÉFI DU JOUR</span>
            <span class="reward-pill reward-pill--challenge" id="challenge-claim-state">ESC</span>
          </div>
          <div class="reward-amount"><span>+75</span><small>Chronicles</small></div>
          <div class="reward-desc" id="challenge-desc">Bonus quotidien pour une victoire Escouade.</div>
          <button type="button" class="reward-btn reward-btn--ghost" id="claim-challenge-btn">CLAIM DÉFI</button>
        </section>
      </div>

      <div class="rewards-log" id="rewards-log">Système de récompenses initialisé.</div>
    </div>
  `;

  const korigan = document.getElementById('korigan-chat-state-card');
  const activity = document.querySelector('.bc.bc-activity');
  const radio = document.querySelector('.bc.bc-radio');
  if (korigan?.parentNode) korigan.parentNode.insertBefore(card, korigan.nextSibling);
  else if (activity?.parentNode) activity.parentNode.insertBefore(card, activity);
  else if (radio?.parentNode) radio.parentNode.insertBefore(card, radio.nextSibling);
  else bento.appendChild(card);

  document.getElementById('claim-daily-btn')?.addEventListener('click', claimDailyReward);
  document.getElementById('claim-challenge-btn')?.addEventListener('click', claimChallengeReward);
}

async function refreshRewardsPanel() {
  setBusy(true);
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Session absente');

    const [{ data: player }, { data: profile }] = await Promise.all([
      supabase.from('tcg_players').select('daily_streak,last_daily_at').eq('id', user.id).maybeSingle(),
      supabase.from('profiles').select('chronicles').eq('id', user.id).maybeSingle()
    ]);

    const status = computeDailyStatus(player, profile);
    renderDailyStatus(status);
    await renderChallengeStatus();
    setText('rewards-sub', 'ledger synchronisé');
  } catch (err) {
    setText('rewards-sub', 'ledger indisponible');
    setText('rewards-log', `Erreur récompenses : ${String(err?.message ?? err)}`);
    setClaimState('daily-claim-state', 'OFF', 'off');
    setClaimState('challenge-claim-state', 'OFF', 'off');
  } finally {
    setBusy(false);
  }
}

async function claimDailyReward() {
  setBusy(true);
  setText('rewards-log', 'Claim du streak journalier…');
  try {
    const { data, error } = await supabase.rpc('claim_daily_login');
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Claim refusé');

    if (!data.rewarded) {
      setText('rewards-log', `Déjà réclamé aujourd'hui · streak ${data.streak ?? 0}`);
    } else {
      setText('rewards-log', `+${data.amount} Chronicles · streak jour ${data.streak}`);
      pulseBalance(data.balance);
      updateTopBalance(data.balance);
    }
    await refreshRewardsPanel();
  } catch (err) {
    setText('rewards-log', `Daily impossible : ${String(err?.message ?? err)}`);
  } finally {
    setBusy(false);
  }
}

async function claimChallengeReward() {
  setBusy(true);
  setText('rewards-log', 'Validation du défi quotidien…');
  try {
    const { data, error } = await supabase.rpc('award_daily_squad_win');
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Défi refusé');

    if (!data.rewarded) {
      setText('rewards-log', 'Défi déjà récupéré aujourd’hui.');
    } else {
      setText('rewards-log', `Défi validé · +${data.amount} Chronicles`);
      pulseBalance(data.balance);
      updateTopBalance(data.balance);
    }
    await refreshRewardsPanel();
  } catch (err) {
    setText('rewards-log', `Défi impossible : ${String(err?.message ?? err)}`);
  } finally {
    setBusy(false);
  }
}

async function renderChallengeStatus() {
  const user = await getCurrentUser();
  if (!user) return;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('chronicles_ledger')
    .select('id, created_at')
    .eq('user_id', user.id)
    .eq('type', 'daily_bonus')
    .gte('created_at', start.toISOString())
    .limit(20);

  const claimed = Array.isArray(data) && data.some(row => row?.created_at);
  const btn = document.getElementById('claim-challenge-btn');
  if (claimed) {
    setClaimState('challenge-claim-state', 'CLAIMED', 'done');
    setText('challenge-desc', 'Un bonus quotidien a déjà été inscrit au ledger aujourd’hui.');
    if (btn) btn.disabled = true;
  } else {
    setClaimState('challenge-claim-state', 'READY', 'ready');
    setText('challenge-desc', 'Récompense manuelle pour un défi/victoire Escouade du jour.');
    if (btn) btn.disabled = false;
  }
}

function computeDailyStatus(player, profile) {
  const today = todayUTC();
  const last = player?.last_daily_at ? new Date(player.last_daily_at) : null;
  const streak = Number(player?.daily_streak ?? 0) || 0;
  const canClaim = !(last && stripUTC(last).getTime() >= today.getTime());
  const nextStreak = canClaim ? computeNextStreak(last, streak, today) : streak;
  return {
    canClaim,
    streak,
    nextStreak,
    nextReward: rewardForStreak(nextStreak || 1),
    balance: Number(profile?.chronicles ?? 0) || 0,
    lastClaimAt: last,
    nextClaimAt: canClaim ? null : nextMidnightUTC()
  };
}

function renderDailyStatus(status) {
  setText('rewards-balance', formatNum(status.balance));
  setText('daily-next-reward', `+${status.nextReward}`);
  renderStreakTrack(status.nextStreak);

  const btn = document.getElementById('claim-daily-btn');
  if (status.canClaim) {
    setClaimState('daily-claim-state', 'READY', 'ready');
    setText('daily-desc', `Prochain claim : jour ${status.nextStreak}. Cycle 7 jours.`);
    if (btn) btn.disabled = false;
  } else {
    setClaimState('daily-claim-state', 'CLAIMED', 'done');
    setText('daily-desc', `Déjà récupéré · prochain reset ${formatCountdown(status.nextClaimAt - new Date())}`);
    if (btn) btn.disabled = true;
    window.setTimeout(refreshRewardsPanel, 30000);
  }
}

function renderStreakTrack(nextStreak) {
  const el = document.getElementById('daily-streak-track');
  if (!el) return;
  const active = ((nextStreak - 1) % 7) + 1;
  el.innerHTML = DAILY_REWARDS.map((reward, index) => {
    const day = index + 1;
    const cls = day < active ? 'is-done' : day === active ? 'is-next' : '';
    return `<span class="streak-dot ${cls}" title="Jour ${day}: +${reward}">${day}</span>`;
  }).join('');
}

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nextMidnightUTC() {
  const t = todayUTC();
  t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

function stripUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function computeNextStreak(last, streak, today) {
  if (!last) return 1;
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return stripUTC(last).getTime() >= yesterday.getTime() ? streak + 1 : 1;
}

function rewardForStreak(streak) {
  return DAILY_REWARDS[(Math.max(1, streak) - 1) % DAILY_REWARDS.length];
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

function setBusy(busy) {
  document.getElementById(CARD_ID)?.classList.toggle('is-busy', busy);
}

function setClaimState(id, text, mode) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `reward-pill reward-pill--${mode}`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatNum(value) {
  return Number(value || 0).toLocaleString('fr-FR');
}

function pulseBalance(balance) {
  setText('rewards-balance', formatNum(balance));
  const el = document.getElementById('rewards-balance');
  if (!el) return;
  el.classList.remove('is-pulsing');
  void el.offsetWidth;
  el.classList.add('is-pulsing');
}

function updateTopBalance(balance) {
  const el = document.getElementById('kpi-chronicles');
  if (el && Number.isFinite(Number(balance))) el.textContent = Number(balance).toLocaleString('fr-FR');
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bc-rewards {
      grid-column: span 5;
      border-color: color-mix(in oklch, var(--c-amber) 34%, var(--c-border));
      background: radial-gradient(circle at 90% 0%, color-mix(in oklch, var(--c-amber) 10%, transparent), transparent 34%), var(--c-surface);
    }
    .rewards-label { color: var(--c-amber) !important; }
    .rewards-panel { display:flex; flex-direction:column; gap:12px; min-height:250px; }
    .rewards-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .rewards-title { font-family:var(--font-display); font-size:20px; letter-spacing:.15em; color:var(--c-text); text-shadow:0 0 18px color-mix(in oklch, var(--c-amber) 36%, transparent); }
    .rewards-sub { margin-top:3px; font-family:var(--font-mono); font-size:9px; letter-spacing:.1em; color:var(--c-text-faint); }
    .rewards-balance { min-width:92px; text-align:right; border:1px solid color-mix(in oklch, var(--c-amber) 25%, var(--c-border)); border-radius:12px; padding:8px 10px; background:rgba(255,255,255,.018); }
    .rewards-balance span { display:block; font:8px var(--font-mono); letter-spacing:.18em; color:var(--c-text-faint); }
    .rewards-balance b { display:block; font-family:var(--font-display); font-size:20px; line-height:1.1; color:var(--c-amber); }
    .rewards-balance b.is-pulsing { animation:reward-balance-pop .6s ease; }
    .rewards-main { display:grid; grid-template-columns:1.1fr .9fr; gap:10px; }
    .reward-card { position:relative; overflow:hidden; display:flex; flex-direction:column; gap:9px; min-height:152px; padding:12px; border:1px solid var(--c-border); border-radius:14px; background:linear-gradient(135deg, rgba(255,255,255,.035), transparent 50%), color-mix(in oklch, var(--c-bg) 84%, var(--c-surface)); }
    .reward-card--daily { border-color:color-mix(in oklch, var(--c-amber) 28%, var(--c-border)); }
    .reward-card--challenge { border-color:color-mix(in oklch, var(--c-cyan) 24%, var(--c-border)); }
    .reward-card-top { display:flex; justify-content:space-between; gap:8px; align-items:center; }
    .reward-kind { font:8px var(--font-mono); letter-spacing:.18em; color:var(--c-text-faint); }
    .reward-pill { border:1px solid currentColor; border-radius:999px; padding:3px 6px; font:8px var(--font-mono); letter-spacing:.14em; color:var(--c-amber); }
    .reward-pill--ready { color:var(--c-primary); box-shadow:0 0 10px color-mix(in oklch, var(--c-primary) 25%, transparent); }
    .reward-pill--done { color:var(--c-text-faint); }
    .reward-pill--off { color:var(--c-red); }
    .reward-pill--challenge { color:var(--c-cyan); }
    .reward-amount { display:flex; align-items:flex-end; gap:6px; font-family:var(--font-display); color:var(--c-amber); }
    .reward-amount span { font-size:30px; line-height:.9; text-shadow:0 0 18px color-mix(in oklch, var(--c-amber) 45%, transparent); }
    .reward-amount small { font:9px var(--font-mono); letter-spacing:.12em; color:var(--c-text-muted); }
    .reward-desc { min-height:30px; font:10px/1.4 var(--font-mono); letter-spacing:.06em; color:var(--c-text-muted); }
    .streak-track { display:flex; gap:5px; margin-top:auto; }
    .streak-dot { width:22px; height:22px; display:grid; place-items:center; border-radius:50%; border:1px solid var(--c-border); font:9px var(--font-mono); color:var(--c-text-faint); }
    .streak-dot.is-done { color:var(--c-primary); border-color:color-mix(in oklch, var(--c-primary) 38%, var(--c-border)); background:color-mix(in oklch, var(--c-primary) 8%, transparent); }
    .streak-dot.is-next { color:var(--c-amber); border-color:var(--c-amber); box-shadow:0 0 12px color-mix(in oklch, var(--c-amber) 30%, transparent); }
    .reward-btn { margin-top:auto; width:100%; border:1px solid var(--c-amber); color:var(--c-amber); background:color-mix(in oklch, var(--c-amber) 8%, transparent); border-radius:10px; padding:8px 10px; font:700 9px var(--font-mono); letter-spacing:.18em; cursor:pointer; }
    .reward-btn--ghost { border-color:var(--c-cyan); color:var(--c-cyan); background:color-mix(in oklch, var(--c-cyan) 6%, transparent); }
    .reward-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 0 16px color-mix(in oklch, currentColor 24%, transparent); }
    .reward-btn:disabled { opacity:.42; cursor:not-allowed; }
    .rewards-log { border:1px solid color-mix(in oklch, var(--c-amber) 18%, var(--c-border)); border-radius:10px; padding:9px 10px; background:rgba(0,0,0,.22); color:var(--c-text-muted); font:10px/1.35 var(--font-mono); letter-spacing:.06em; min-height:34px; }
    .bc-rewards.is-busy .rewards-panel { opacity:.72; }
    @keyframes reward-balance-pop { 0%{transform:scale(1)} 45%{transform:scale(1.18);filter:brightness(1.4)} 100%{transform:scale(1)} }
    @media(max-width:1100px){ .bc-rewards { grid-column:span 12; } }
    @media(max-width:640px){ .rewards-head,.rewards-main { grid-template-columns:1fr; display:grid; } .rewards-balance { text-align:left; } }
  `;
  document.head.appendChild(style);
}
