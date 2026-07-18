const STYLE_ID = 'korigan-bot-bridge-style-v1';
const CARD_ID = 'korigan-bot-bridge-card';
const STORAGE_KEY = 'koriganBotBridgeEndpoint';
const POLL_MS = 30000;

const DEFAULT_ENDPOINTS = [
  '/api/korigan/bots/status',
  '/korigan/api/bots/status',
  'https://nitro.sterenna.fr/api/korigan/bots/status',
  'https://korigan.sterenna.fr/api/korigan/bots/status',
  'https://nitro.sterenna.fr/korigan/api/bots/status',
];

const BOT_SPECS = Object.freeze({
  discord: {
    label: 'DISCORD',
    accent: 'var(--c-purple)',
    futureCommands: ['discord status', 'discord channels'],
  },
  twitch: {
    label: 'TWITCH',
    accent: 'var(--c-amber)',
    futureCommands: ['twitch status', 'twitch chat'],
  },
});

let pollTimer = null;
let lastState = null;

installKoriganBotBridge();

export function installKoriganBotBridge() {
  injectStyle();
  const run = () => {
    mountCard();
    refreshBridge();
    if (!pollTimer) pollTimer = window.setInterval(refreshBridge, POLL_MS);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
}

function mountCard() {
  if (document.getElementById(CARD_ID)) return;
  const bento = document.querySelector('.bento');
  if (!bento) return;

  const card = document.createElement('div');
  card.id = CARD_ID;
  card.className = 'bc bc-korigan-bots';
  card.innerHTML = `
    <div class="bc-label korigan-bots-label"><span class="bc-dot"></span>KORIGAN · BOT BRIDGE</div>
    <div class="korigan-bots-screen" role="region" aria-label="Branchement futur Discord et Twitch via Korigan">
      <div class="korigan-bots-head">
        <div>
          <div class="korigan-bots-title">SOCIAL BUS</div>
          <div class="korigan-bots-sub" id="korigan-bots-endpoint">endpoint: auto</div>
        </div>
        <span class="korigan-bots-pill korigan-bots-pill--plan" id="korigan-bots-status">PLAN</span>
      </div>

      <div class="korigan-bots-list" id="korigan-bots-list"></div>
      <pre class="korigan-bots-log" id="korigan-bots-log">Discord/Twitch : provider reel non branche.\nKorigan reste la frontiere d'activation future.</pre>

      <div class="korigan-bots-actions">
        <button type="button" id="korigan-bots-refresh">RESCAN</button>
        <button type="button" id="korigan-bots-set-endpoint">ENDPOINT</button>
      </div>
    </div>
  `;

  const chat = document.getElementById('korigan-chat-state-card');
  const activity = document.querySelector('.bc.bc-activity');
  const radio = document.querySelector('.bc.bc-radio');
  if (chat?.parentNode) chat.parentNode.insertBefore(card, chat.nextSibling);
  else if (activity?.parentNode) activity.parentNode.insertBefore(card, activity);
  else if (radio?.parentNode) radio.parentNode.insertBefore(card, radio.nextSibling);
  else bento.appendChild(card);

  document.getElementById('korigan-bots-refresh')?.addEventListener('click', () => refreshBridge(true));
  document.getElementById('korigan-bots-set-endpoint')?.addEventListener('click', configureEndpoint);
}

async function refreshBridge(force = false) {
  const endpoint = getEndpoint();
  setText('korigan-bots-endpoint', `endpoint: ${endpoint || 'auto'}`);

  try {
    const raw = await fetchBridge(endpoint, force);
    lastState = normalizeBridgeState(raw);
    renderBridge(lastState);
  } catch (error) {
    renderPlanned(error);
  }
}

function getEndpoint() {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

function configureEndpoint() {
  const current = getEndpoint();
  const next = window.prompt('Endpoint bots Korigan', current || DEFAULT_ENDPOINTS[0]);
  if (next == null) return;
  try {
    if (next.trim()) localStorage.setItem(STORAGE_KEY, next.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  refreshBridge(true);
}

async function fetchBridge(endpoint, force = false) {
  const endpoints = endpoint ? [endpoint] : DEFAULT_ENDPOINTS;
  let lastError = null;

  for (const url of endpoints) {
    try {
      const target = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
      const response = await fetch(target, { cache: force ? 'reload' : 'no-store' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const json = await response.json();
      return { ...json, endpoint: url };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Korigan bot bridge endpoint unavailable');
}

function normalizeBridgeState(raw = {}) {
  const providers = raw.providers || raw.bots || raw.integrations || {};
  return {
    ok: raw.ok !== false,
    mode: normalizeMode(raw.mode || raw.status || 'mock'),
    endpoint: raw.endpoint || getEndpoint() || 'auto',
    updatedAt: raw.updatedAt || raw.timestamp || new Date().toISOString(),
    providers: {
      discord: normalizeProvider('discord', providers.discord || raw.discord),
      twitch: normalizeProvider('twitch', providers.twitch || raw.twitch),
    },
  };
}

function normalizeProvider(id, raw = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    id,
    configured: Boolean(value.configured ?? value.hasConfig ?? value.ready),
    enabled: Boolean(value.enabled ?? value.active),
    connected: Boolean(value.connected ?? value.online),
    mode: normalizeMode(value.mode || value.status || 'mock'),
    channels: Number(value.channels ?? value.channelCount ?? value.rooms ?? 0) || 0,
    lastEventAt: value.lastEventAt || value.lastMessageAt || value.updatedAt || null,
    commands: Array.isArray(value.commands) ? value.commands.slice(0, 4) : BOT_SPECS[id].futureCommands,
  };
}

function normalizeMode(mode) {
  const value = String(mode || '').toLowerCase();
  if (['live', 'enabled', 'online', 'connected'].includes(value)) return 'live';
  if (['mock', 'dry-run', 'dryrun', 'planned', 'plan'].includes(value)) return 'mock';
  return 'planned';
}

function renderBridge(state) {
  setStatus(state.mode === 'live' ? 'LIVE' : 'MOCK', state.mode === 'live' ? 'online' : 'mock');
  setText('korigan-bots-endpoint', `endpoint: ${state.endpoint}`);
  renderProviders(state.providers);
  renderLog([
    `[korigan-bots] ${state.mode} · ${formatTime(state.updatedAt)}`,
    'frontiere: Korigan gere les providers reels',
    'secrets: jamais lus ni affiches cote Star',
    ...Object.values(state.providers).map(provider => (
      `${provider.id}: cfg=${provider.configured ? 'yes' : 'no'} enabled=${provider.enabled ? 'yes' : 'no'} connected=${provider.connected ? 'yes' : 'no'}`
    )),
  ]);
}

function renderPlanned(error = null) {
  setStatus('PLAN', 'plan');
  setText('korigan-bots-endpoint', `endpoint: ${getEndpoint() || 'auto'}`);
  const planned = {
    discord: normalizeProvider('discord', { mode: 'planned' }),
    twitch: normalizeProvider('twitch', { mode: 'planned' }),
  };
  renderProviders(planned);
  renderLog([
    '[korigan-bots] implementation future',
    'discord: bot gateway via Korigan, non branche',
    'twitch: chat/event bridge via Korigan, non branche',
    'activation: config Korigan + endpoint status safe',
    error ? `scan: ${String(error.message || error).slice(0, 90)}` : 'scan: en attente',
    lastState ? `last-known: ${lastState.mode} · ${formatTime(lastState.updatedAt)}` : 'last-known: none',
  ]);
}

function renderProviders(providers) {
  const list = document.getElementById('korigan-bots-list');
  if (!list) return;

  list.replaceChildren(...Object.values(providers).map(provider => {
    const spec = BOT_SPECS[provider.id];
    const row = document.createElement('article');
    row.className = `korigan-bot-row korigan-bot-row--${provider.mode}`;
    row.style.setProperty('--bot-accent', spec.accent);

    const head = document.createElement('div');
    head.className = 'korigan-bot-row-head';

    const name = document.createElement('strong');
    name.textContent = spec.label;

    const status = document.createElement('span');
    status.textContent = provider.connected ? 'CONNECTED' : provider.enabled ? 'READY' : provider.mode.toUpperCase();

    head.append(name, status);

    const meta = document.createElement('div');
    meta.className = 'korigan-bot-meta';
    meta.append(
      badge(provider.configured ? 'CONFIG OK' : 'CONFIG FUTURE'),
      badge(provider.enabled ? 'ENABLED' : 'DISABLED'),
      badge(`${provider.channels} CH`),
    );

    const commands = document.createElement('p');
    commands.textContent = `cmd: ${provider.commands.join(' · ')}`;

    row.append(head, meta, commands);
    return row;
  }));
}

function badge(text) {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

function renderLog(lines) {
  const log = document.getElementById('korigan-bots-log');
  if (log) log.textContent = lines.join('\n');
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function setStatus(text, mode) {
  const element = document.getElementById('korigan-bots-status');
  if (!element) return;
  element.textContent = text;
  element.className = `korigan-bots-pill korigan-bots-pill--${mode}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bc-korigan-bots {
      grid-column:span 5;
      border-color:color-mix(in oklch, var(--c-purple) 32%, var(--c-border));
      background:
        radial-gradient(circle at 90% 0%, color-mix(in oklch, var(--c-purple) 12%, transparent), transparent 34%),
        var(--c-surface);
    }
    .korigan-bots-label { color:var(--c-purple) !important; }
    .korigan-bots-screen {
      position:relative;
      display:flex;
      flex-direction:column;
      gap:11px;
      min-height:250px;
      padding:14px;
      border:1px solid color-mix(in oklch, var(--c-purple) 24%, var(--c-border));
      border-radius:14px;
      background:
        repeating-linear-gradient(to bottom, transparent 0 3px, rgba(0,0,0,.18) 3px 4px),
        linear-gradient(135deg, rgba(191,95,255,.06), transparent 48%),
        color-mix(in oklch, var(--c-bg) 88%, #05020b);
      box-shadow:inset 0 0 28px rgba(0,0,0,.28);
      overflow:hidden;
    }
    .korigan-bots-screen::after {
      content:'';
      position:absolute;
      inset:0;
      pointer-events:none;
      background:radial-gradient(circle at 50% 54%, transparent 58%, rgba(0,0,0,.34));
    }
    .korigan-bots-head,
    .korigan-bots-list,
    .korigan-bots-log,
    .korigan-bots-actions { position:relative; z-index:1; }
    .korigan-bots-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .korigan-bots-title { font-family:var(--font-display); font-size:20px; letter-spacing:0; color:var(--c-text); text-shadow:0 0 16px color-mix(in oklch, var(--c-purple) 42%, transparent); }
    .korigan-bots-sub { margin-top:3px; font-family:var(--font-mono); font-size:9px; letter-spacing:0; color:var(--c-text-faint); overflow:hidden; text-overflow:ellipsis; max-width:320px; white-space:nowrap; }
    .korigan-bots-pill { font-family:var(--font-mono); font-size:9px; letter-spacing:0; border-radius:999px; padding:5px 9px; border:1px solid currentColor; }
    .korigan-bots-pill--plan { color:var(--c-amber); }
    .korigan-bots-pill--mock { color:var(--c-cyan); }
    .korigan-bots-pill--online { color:var(--c-primary); box-shadow:0 0 12px color-mix(in oklch, var(--c-primary) 28%, transparent); }
    .korigan-bots-list { display:grid; gap:8px; }
    .korigan-bot-row {
      display:grid;
      gap:7px;
      padding:10px;
      border:1px solid color-mix(in oklch, var(--bot-accent) 38%, var(--c-border));
      border-radius:10px;
      background:color-mix(in oklch, var(--bot-accent) 7%, transparent);
    }
    .korigan-bot-row-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .korigan-bot-row strong { color:var(--bot-accent); font-family:var(--font-display); font-size:18px; line-height:1; letter-spacing:0; }
    .korigan-bot-row-head span { color:var(--c-text-faint); font:9px var(--font-mono); letter-spacing:0; }
    .korigan-bot-meta { display:flex; flex-wrap:wrap; gap:6px; }
    .korigan-bot-meta span { border:1px solid color-mix(in oklch, var(--bot-accent) 32%, var(--c-border)); border-radius:999px; color:var(--c-text-muted); padding:4px 7px; font:8px var(--font-mono); letter-spacing:0; }
    .korigan-bot-row p { margin:0; color:var(--c-text-faint); font:9px/1.4 var(--font-mono); letter-spacing:0; overflow-wrap:anywhere; }
    .korigan-bots-log { flex:1; min-height:74px; margin:0; padding:10px; border-radius:10px; border:1px solid color-mix(in oklch, var(--c-purple) 18%, var(--c-border)); background:rgba(0,0,0,.24); color:var(--c-text-muted); font:10px/1.45 var(--font-mono); letter-spacing:0; white-space:pre-wrap; overflow:auto; }
    .korigan-bots-actions { display:flex; gap:8px; justify-content:flex-end; }
    .korigan-bots-actions button { border:1px solid var(--c-border); background:transparent; color:var(--c-text-muted); border-radius:8px; padding:6px 10px; font:9px var(--font-mono); letter-spacing:0; cursor:pointer; }
    .korigan-bots-actions button:hover { color:var(--c-purple); border-color:var(--c-purple); }
    @media(max-width:1100px){ .bc-korigan-bots { grid-column:span 12; } }
  `;
  document.head.appendChild(style);
}
