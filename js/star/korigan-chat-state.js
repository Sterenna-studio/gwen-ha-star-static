const STYLE_ID = 'korigan-chat-state-style-v2';
const CARD_ID = 'korigan-chat-state-card';
const STORAGE_KEY = 'koriganChatStateEndpoint';
const POLL_MS = 15000;

const DEFAULT_ENDPOINTS = [
  '/minitel/messages',
  '/korigan/minitel/messages',
  'https://nitro.sterenna.fr/minitel/messages',
  'https://nitro.sterenna.fr/korigan/minitel/messages',
  '/minitel/status',
  '/korigan/minitel/status',
  'https://nitro.sterenna.fr/minitel/status',
  'https://nitro.sterenna.fr/korigan/minitel/status',
  '/api/korigan/chat/state',
  '/korigan/api/chat/state',
  'https://nitro.sterenna.fr/api/korigan/chat/state',
  'https://nitro.sterenna.fr/korigan/api/chat/state'
];

let pollTimer = null;
let lastState = null;

installKoriganChatState();

export function installKoriganChatState() {
  injectStyle();
  const run = () => {
    mountCard();
    refreshState();
    if (!pollTimer) pollTimer = window.setInterval(refreshState, POLL_MS);
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
  card.className = 'bc bc-korigan';
  card.innerHTML = `
    <div class="bc-label korigan-label"><span class="bc-dot"></span>KORIGAN · CHAT STATE</div>
    <div class="korigan-screen" role="region" aria-label="Etat du chat Korigan">
      <div class="korigan-screen-head">
        <div>
          <div class="korigan-title">CHAT BUS</div>
          <div class="korigan-sub" id="korigan-endpoint">endpoint: auto</div>
        </div>
        <span class="korigan-pill korigan-pill--scan" id="korigan-status">SCAN</span>
      </div>

      <div class="korigan-grid">
        <div class="korigan-metric"><span>WS</span><b id="korigan-ws">—</b></div>
        <div class="korigan-metric"><span>CLIENTS</span><b id="korigan-clients">—</b></div>
        <div class="korigan-metric"><span>QUEUE</span><b id="korigan-queue">—</b></div>
        <div class="korigan-metric"><span>LAST</span><b id="korigan-last">—</b></div>
      </div>

      <div class="korigan-clients" id="korigan-client-list">
        <span class="korigan-client"><i></i>PC · —</span>
        <span class="korigan-client"><i></i>TEL · —</span>
        <span class="korigan-client"><i></i>MINITEL · —</span>
      </div>

      <pre class="korigan-log" id="korigan-log">Connexion au bus Korigan…
Recherche du runtime /minitel…</pre>

      <div class="korigan-actions">
        <button type="button" id="korigan-refresh">RESCAN</button>
        <button type="button" id="korigan-set-endpoint">ENDPOINT</button>
      </div>
    </div>
  `;

  const radio = document.querySelector('.bc.bc-radio');
  const pokegang = document.querySelector('.bc.bc-pg');
  if (radio?.parentNode) radio.parentNode.insertBefore(card, radio.nextSibling);
  else if (pokegang?.parentNode) pokegang.parentNode.insertBefore(card, pokegang);
  else bento.appendChild(card);

  document.getElementById('korigan-refresh')?.addEventListener('click', () => refreshState(true));
  document.getElementById('korigan-set-endpoint')?.addEventListener('click', configureEndpoint);
}

async function refreshState(force = false) {
  const endpoint = getEndpoint();
  setStatus('SCAN', 'scan');
  setText('korigan-endpoint', `endpoint: ${endpoint || 'auto · /minitel'}`);

  try {
    const state = await fetchState(endpoint, force);
    lastState = normalizeState(state);
    renderState(lastState);
  } catch (err) {
    renderOffline(err);
  }
}

function getEndpoint() {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

function configureEndpoint() {
  const current = getEndpoint();
  const next = window.prompt('Endpoint état Korigan', current || DEFAULT_ENDPOINTS[0]);
  if (next == null) return;
  try {
    if (next.trim()) localStorage.setItem(STORAGE_KEY, next.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  refreshState(true);
}

async function fetchState(endpoint, force = false) {
  const endpoints = endpoint ? [endpoint] : DEFAULT_ENDPOINTS;
  let lastError = null;

  for (const url of endpoints) {
    try {
      const target = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
      const res = await fetch(target, { cache: force ? 'reload' : 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      return { ...json, endpoint: url };
    } catch (err) {
      lastError = new Error(`${url}: ${err?.message || err}`);
    }
  }

  throw lastError || new Error('Korigan endpoint unavailable');
}

function normalizeState(raw = {}) {
  if (isMinitelMessagesPayload(raw)) return normalizeMinitelMessagesState(raw);
  if (isMinitelStatusPayload(raw)) return normalizeMinitelStatusState(raw);
  return normalizeCompatChatState(raw);
}

function isMinitelMessagesPayload(raw) {
  return Boolean(raw?.stats && (Array.isArray(raw.messages) || Array.isArray(raw.sessions)));
}

function isMinitelStatusPayload(raw) {
  return Boolean('wsClients' in raw || 'telnetClients' in raw || raw?.websocket || raw?.transports?.includes?.('websocket'));
}

function normalizeMinitelMessagesState(raw) {
  const stats = raw.stats || {};
  const sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  const pcCount = numberOr(stats.wsClients, countSessions(sessions, 'websocket'));
  const minitelCount = numberOr(stats.telnetClients, countSessions(sessions, 'telnet'));
  const messages = normalizeMinitelMessages(raw.messages || []);
  const lastMessage = messages.at(-1) || null;
  const updatedAt = newestTime([
    raw.updatedAt,
    raw.timestamp,
    lastMessage?.createdAt,
    ...sessions.map(session => session.lastSeenAt || session.connectedAt)
  ]);

  return {
    ok: raw.ok !== false,
    endpoint: raw.endpoint || getEndpoint() || 'auto · /minitel/messages',
    status: raw.ok === false ? 'degraded' : 'online',
    source: 'korigan-minitel-messages',
    ws: { connected: pcCount > 0, count: pcCount },
    clients: {
      pc: { count: pcCount, items: sessions.filter(session => session.transport === 'websocket') },
      phone: { count: 0, items: [] },
      minitel: { count: minitelCount, items: sessions.filter(session => session.transport === 'telnet') },
      count: pcCount + minitelCount
    },
    queue: Number(raw.queue?.pending ?? raw.pendingMessages ?? 0) || 0,
    lastMessage,
    messages: messages.slice(-6),
    updatedAt,
  };
}

function normalizeMinitelStatusState(raw) {
  const pcCount = numberOr(raw.wsClients, 0);
  const minitelCount = numberOr(raw.telnetClients, 0);

  return {
    ok: raw.ok !== false,
    endpoint: raw.endpoint || getEndpoint() || 'auto · /minitel/status',
    status: raw.ok === false ? 'degraded' : (raw.mode || 'online'),
    source: 'korigan-minitel-status',
    ws: { connected: pcCount > 0, count: pcCount },
    clients: {
      pc: { count: pcCount, items: [] },
      phone: { count: 0, items: [] },
      minitel: { count: minitelCount, items: [] },
      count: pcCount + minitelCount
    },
    queue: 0,
    lastMessage: null,
    messages: [],
    updatedAt: raw.updatedAt || raw.timestamp || new Date().toISOString(),
  };
}

function normalizeCompatChatState(raw) {
  const clients = raw.clients || raw.connectedClients || {};
  const pc = normalizeClientGroup(clients.pc || clients.desktop || raw.pcClients);
  const phone = normalizeClientGroup(clients.phone || clients.mobile || clients.tel || raw.phoneClients);
  const minitel = normalizeClientGroup(clients.minitel || clients.vdt || raw.minitelClients);
  const allCount = Number(raw.clientCount ?? raw.clientsCount ?? clients.count ?? pc.count + phone.count + minitel.count) || 0;
  const queue = raw.queue || raw.messagesQueue || raw.outbox || {};
  const messages = Array.isArray(raw.messages || raw.recentMessages || raw.log) ? (raw.messages || raw.recentMessages || raw.log) : [];
  const last = raw.lastMessage || messages.at(-1) || null;

  return {
    ok: raw.ok !== false,
    endpoint: raw.endpoint || getEndpoint() || 'auto · compat',
    status: raw.status || raw.state || 'online',
    source: 'korigan-compat-chat-state',
    ws: raw.ws || raw.websocket || {},
    clients: { pc, phone, minitel, count: allCount },
    queue: Number(queue.pending ?? queue.length ?? raw.pendingMessages ?? 0) || 0,
    lastMessage: last,
    messages: messages.slice(-6),
    updatedAt: raw.updatedAt || raw.timestamp || new Date().toISOString()
  };
}

function normalizeMinitelMessages(messages) {
  return messages
    .map(message => {
      if (typeof message === 'string') return { from: 'korigan', text: message, createdAt: null };
      const nick = message.nick || message.from || message.author || message.transport || 'agent';
      const text = message.kind === 'action'
        ? `* ${message.text || message.message || ''}`
        : (message.text || message.message || message.content || message.body || '');
      return {
        from: nick,
        transport: message.transport || '',
        kind: message.kind || 'message',
        text: String(text).replace(/\s+/g, ' ').trim().slice(0, 120),
        createdAt: message.createdAt || message.timestamp || message.updatedAt || null,
      };
    })
    .filter(message => message.text);
}

function normalizeClientGroup(value) {
  if (Array.isArray(value)) return { count: value.length, items: value };
  if (typeof value === 'number') return { count: value, items: [] };
  if (value && typeof value === 'object') return { count: Number(value.count ?? value.length ?? 0) || 0, items: value.items || value.clients || [] };
  return { count: 0, items: [] };
}

function countSessions(sessions, transport) {
  return sessions.filter(session => String(session.transport || '').toLowerCase() === transport).length;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function newestTime(values) {
  const timestamps = values
    .map(value => {
      if (!value) return NaN;
      if (typeof value === 'number') return value;
      const date = new Date(value);
      return date.getTime();
    })
    .filter(value => Number.isFinite(value));

  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString();
}

function renderState(state) {
  const status = state.ok ? 'ONLINE' : 'DEGRADED';
  setStatus(status, state.ok ? 'online' : 'warn');
  setText('korigan-endpoint', `endpoint: ${state.endpoint}`);
  setText('korigan-ws', state.ws.connected === false ? 'OFF' : `${state.ws.count ?? state.clients.pc.count ? 'ON' : 'IDLE'}`);
  setText('korigan-clients', String(state.clients.count));
  setText('korigan-queue', String(state.queue));
  setText('korigan-last', formatTime(state.updatedAt));
  renderClients(state.clients);
  renderLog(state);
}

function renderOffline(err) {
  setStatus('OFFLINE', 'offline');
  setText('korigan-ws', 'OFF');
  setText('korigan-clients', '0');
  setText('korigan-queue', '—');
  setText('korigan-last', '—');
  renderClients({ pc:{count:0}, phone:{count:0}, minitel:{count:0}, count:0 });
  const log = document.getElementById('korigan-log');
  if (log) {
    log.textContent = [
      '[korigan] endpoint indisponible',
      `reason: ${String(err?.message ?? err ?? 'unknown')}`,
      'hint: endpoint réel Korigan conseillé: /minitel/messages',
      'fallback: /api/korigan/chat/state reste supporté',
      lastState ? `last-known: ${lastState.status} · ${formatTime(lastState.updatedAt)}` : 'last-known: none'
    ].join('\n');
  }
}

function renderClients(clients) {
  const el = document.getElementById('korigan-client-list');
  if (!el) return;
  const rows = [
    ['PC', clients.pc?.count ?? 0],
    ['TEL', clients.phone?.count ?? 0],
    ['MINITEL', clients.minitel?.count ?? 0]
  ];
  el.innerHTML = rows.map(([label, count]) => `<span class="korigan-client ${count ? 'is-on' : ''}"><i></i>${label} · ${count}</span>`).join('');
}

function renderLog(state) {
  const lines = [];
  lines.push(`[korigan] ${state.status} · ${formatTime(state.updatedAt)}`);
  lines.push(`source=${state.source || 'unknown'}`);
  lines.push(`ws=${state.ws.connected === false ? 'off' : (state.ws.count ?? state.clients.pc.count ? 'on' : 'idle')} clients=${state.clients.count} queue=${state.queue}`);

  if (state.lastMessage) {
    lines.push(`last=${formatMessage(state.lastMessage)}`);
  }

  state.messages.forEach((msg, idx) => lines.push(`${String(idx + 1).padStart(2, '0')} ${formatMessage(msg)}`));

  const log = document.getElementById('korigan-log');
  if (log) log.textContent = lines.join('\n');
}

function formatMessage(msg) {
  if (typeof msg === 'string') return msg.slice(0, 120);
  const from = msg.from || msg.nick || msg.author || msg.client || msg.role || msg.transport || 'agent';
  const text = msg.text || msg.message || msg.content || msg.body || JSON.stringify(msg);
  return `${from}: ${String(text).replace(/\s+/g, ' ').slice(0, 100)}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setStatus(text, mode) {
  const el = document.getElementById('korigan-status');
  if (!el) return;
  el.textContent = text;
  el.className = `korigan-pill korigan-pill--${mode}`;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bc-korigan {
      grid-column: span 7;
      border-color: color-mix(in oklch, var(--c-cyan) 35%, var(--c-border));
      background:
        radial-gradient(circle at 10% 0%, color-mix(in oklch, var(--c-cyan) 10%, transparent), transparent 32%),
        var(--c-surface);
    }
    .korigan-label { color: var(--c-cyan) !important; }
    .korigan-screen {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 250px;
      padding: 14px;
      border: 1px solid color-mix(in oklch, var(--c-cyan) 24%, var(--c-border));
      border-radius: 14px;
      background:
        repeating-linear-gradient(to bottom, transparent 0 3px, rgba(0,0,0,.18) 3px 4px),
        linear-gradient(135deg, rgba(0,212,255,.055), transparent 45%),
        color-mix(in oklch, var(--c-bg) 88%, #02050b);
      box-shadow: inset 0 0 28px rgba(0,0,0,.28);
      overflow: hidden;
    }
    .korigan-screen::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,.35));
    }
    .korigan-screen-head,
    .korigan-grid,
    .korigan-clients,
    .korigan-log,
    .korigan-actions { position: relative; z-index: 1; }
    .korigan-screen-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .korigan-title { font-family:var(--font-display); font-size:20px; letter-spacing:.16em; color:var(--c-text); text-shadow:0 0 16px color-mix(in oklch, var(--c-cyan) 42%, transparent); }
    .korigan-sub { margin-top:3px; font-family:var(--font-mono); font-size:9px; letter-spacing:.08em; color:var(--c-text-faint); overflow:hidden; text-overflow:ellipsis; max-width:440px; white-space:nowrap; }
    .korigan-pill { font-family:var(--font-mono); font-size:9px; letter-spacing:.18em; border-radius:999px; padding:5px 9px; border:1px solid currentColor; }
    .korigan-pill--scan { color:var(--c-amber); }
    .korigan-pill--online { color:var(--c-primary); box-shadow:0 0 12px color-mix(in oklch, var(--c-primary) 28%, transparent); }
    .korigan-pill--warn { color:var(--c-amber); }
    .korigan-pill--offline { color:var(--c-red); }
    .korigan-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
    .korigan-metric { display:flex; flex-direction:column; gap:2px; padding:9px 10px; border:1px solid var(--c-border); border-radius:10px; background:rgba(255,255,255,.018); }
    .korigan-metric span { font-family:var(--font-mono); font-size:8px; letter-spacing:.16em; color:var(--c-text-faint); }
    .korigan-metric b { font-family:var(--font-display); font-size:18px; color:var(--c-cyan); line-height:1; }
    .korigan-clients { display:flex; flex-wrap:wrap; gap:7px; }
    .korigan-client { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:9px; letter-spacing:.14em; color:var(--c-text-muted); border:1px solid var(--c-border); border-radius:999px; padding:5px 8px; }
    .korigan-client i { width:6px; height:6px; border-radius:50%; background:var(--c-text-faint); display:inline-block; }
    .korigan-client.is-on { color:var(--c-primary); border-color:color-mix(in oklch, var(--c-primary) 35%, var(--c-border)); }
    .korigan-client.is-on i { background:var(--c-primary); box-shadow:0 0 8px var(--c-primary); }
    .korigan-log { flex:1; min-height:92px; margin:0; padding:10px; border-radius:10px; border:1px solid color-mix(in oklch, var(--c-cyan) 18%, var(--c-border)); background:rgba(0,0,0,.24); color:var(--c-text-muted); font:10px/1.45 var(--font-mono); letter-spacing:.05em; white-space:pre-wrap; overflow:auto; }
    .korigan-actions { display:flex; gap:8px; justify-content:flex-end; }
    .korigan-actions button { border:1px solid var(--c-border); background:transparent; color:var(--c-text-muted); border-radius:8px; padding:6px 10px; font:9px var(--font-mono); letter-spacing:.16em; cursor:pointer; }
    .korigan-actions button:hover { color:var(--c-cyan); border-color:var(--c-cyan); }
    @media(max-width:1100px){ .bc-korigan { grid-column:span 12; } }
    @media(max-width:620px){ .korigan-grid { grid-template-columns:repeat(2,1fr); } .korigan-screen-head { flex-direction:column; } }
  `;
  document.head.appendChild(style);
}
