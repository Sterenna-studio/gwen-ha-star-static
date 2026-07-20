import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NITRO_APPS } from '../shared/nitro-apps.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const radio = JSON.parse(fs.readFileSync(path.join(root, 'radio/live.json'), 'utf8'));
const playlists = JSON.parse(fs.readFileSync(path.join(root, 'jukebox/chronicles-fm.json'), 'utf8'));

// Korigan's Minitel "BZH CHRONICLES / CHRONICLES FM" screen keys off the
// `jukebox` app entry (id === 'jukebox'). Guarantee it survives the top-12
// cut regardless of its position in NITRO_APPS.
const nonArchived = NITRO_APPS.filter(app => app.status !== 'archived');
const PRIORITY_APP_IDS = ['jukebox'];
const priorityApps = PRIORITY_APP_IDS.map(id => nonArchived.find(app => app.id === id)).filter(Boolean);
const remainingApps = nonArchived.filter(app => !PRIORITY_APP_IDS.includes(app.id));
const apps = [...priorityApps, ...remainingApps].slice(0, 12).map(app => ({
  id: app.id,
  name: app.name,
  status: app.status,
  terminalLabel: app.quickDesc || app.description,
  url: new URL(app.url, 'https://nitro.sterenna.fr').href,
}));

const featured = playlists.find(item => item.featured) || playlists[0] || {};
const dedications = await fetchRecentPlayedDedications();

const feed = {
  version: 3,
  updatedAt: new Date().toISOString(),
  source: 'gwen-ha-star-static',
  network: { name: 'Gwen Ha Star', domain: 'nitro.sterenna.fr', status: 'online', summary: `${apps.length} modules Nitro publies pour le terminal.` },
  agent: { displayName: 'MutenRock', rank: 'Agent Nitro', crew: 'BZH Chronicles', status: 'online', visibility: 'public' },
  apps,
  chroniclesFm: {
    frequencyCount: playlists.length,
    nowPlaying: { title: featured.title || null, style: featured.style || null, mood: featured.mood || null },
  },
  dedications,
  signals: [
    `Chronicles FM: ${playlists.length} frequences.`,
    radio.enabled ? `${radio.stationName} active.` : `${radio.stationName} en pause.`,
    dedications.length
      ? `Derniere dedicace: "${dedications[0].message}" - ${dedications[0].username}`
      : 'Aucune dedicace recente.',
    'Donnees synchronisees depuis Nitro.',
  ],
  links: { publicPage: 'https://nitro.sterenna.fr/star/', websocket: 'wss://nitro.sterenna.fr/minitel/ws', telnet: 'nitro.sterenna.fr:3615' },
};
const output = path.join(root, 'data', '3615-feed.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Generated ${path.relative(root, output)} with ${apps.length} apps and ${dedications.length} dedications.`);

const avatarState = {
  version: 2,
  updatedAt: feed.updatedAt,
  source: 'gwen-ha-star-static',
  avatar: { name: 'LEMEGETON', status: radio.enabled ? 'online' : 'idle', mode: radio.enabled ? 'listening' : 'idle', mood: featured.mood || 'neutral', eyes: radio.enabled ? 'focused' : 'open', mouth: 'closed', intensity: radio.enabled ? 0.65 : 0.2, renderer: 'nitro-radio-state' },
  expressions: [
    { id: 'idle', label: 'Repos', eyes: 'open', mouth: 'closed', note: 'Radio en pause.' },
    { id: 'listening', label: 'Ecoute', eyes: 'focused', mouth: 'closed', note: featured.title || radio.stationName },
  ],
  pipeline: [`Station: ${radio.stationName}`, `Frequence: ${featured.title || 'aucune'}`, `Playlists: ${playlists.length}`],
};
const avatarOutput = path.join(root, 'data', 'lemegeton-state.json');
fs.writeFileSync(avatarOutput, `${JSON.stringify(avatarState, null, 2)}\n`);
console.log(`Generated ${path.relative(root, avatarOutput)}.`);

// Recent played radio dedications (Star Radio), fetched from the terminal-safe
// public.get_recent_played_dedications() RPC (see scripts/sql/007_radio_dedications_public_feed.sql).
// Never touches user_id/cost; returns [] if Supabase config is missing or unreachable
// so local builds without shared/config.js still succeed.
async function fetchRecentPlayedDedications(limit = 5) {
  let config;
  try {
    config = await import('../shared/config.js');
  } catch {
    console.warn('[3615-feed] shared/config.js not found, skipping dedications fetch.');
    return [];
  }

  const { SUPABASE_URL, SUPABASE_ANON } = config;
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.warn('[3615-feed] Supabase config incomplete, skipping dedications fetch.');
    return [];
  }

  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/get_recent_played_dedications`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_limit: limit }),
    });
    if (!response.ok) {
      console.warn(`[3615-feed] dedications fetch failed: HTTP ${response.status}`);
      return [];
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(row => ({
      id: row.id,
      message: truncate(String(row.message ?? ''), 160),
      username: truncate(String(row.username ?? 'AGENT'), 32),
      playedAt: row.played_at ?? null,
    }));
  } catch (error) {
    console.warn(`[3615-feed] dedications fetch error: ${error.message}`);
    return [];
  }
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
