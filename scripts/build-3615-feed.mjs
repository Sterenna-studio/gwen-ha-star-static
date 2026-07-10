import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NITRO_APPS } from '../shared/nitro-apps.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const radio = JSON.parse(fs.readFileSync(path.join(root, 'radio/live.json'), 'utf8'));
const playlists = JSON.parse(fs.readFileSync(path.join(root, 'jukebox/chronicles-fm.json'), 'utf8'));
const apps = NITRO_APPS.filter(app => app.status !== 'archived').slice(0, 12).map(app => ({
  id: app.id,
  name: app.name,
  status: app.status,
  terminalLabel: app.quickDesc || app.description,
  url: new URL(app.url, 'https://nitro.sterenna.fr').href,
}));
const feed = {
  version: 2,
  updatedAt: new Date().toISOString(),
  source: 'gwen-ha-star-static',
  network: { name: 'Gwen Ha Star', domain: 'nitro.sterenna.fr', status: 'online', summary: `${apps.length} modules Nitro publies pour le terminal.` },
  agent: { displayName: 'MutenRock', rank: 'Agent Nitro', crew: 'BZH Chronicles', status: 'online', visibility: 'public' },
  apps,
  signals: [`Chronicles FM: ${playlists.length} frequences.`, radio.enabled ? `${radio.stationName} active.` : `${radio.stationName} en pause.`, 'Donnees synchronisees depuis Nitro.'],
  links: { publicPage: 'https://nitro.sterenna.fr/star/', websocket: 'wss://nitro.sterenna.fr/minitel/ws', telnet: 'nitro.sterenna.fr:3615' },
};
const output = path.join(root, 'data', '3615-feed.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Generated ${path.relative(root, output)} with ${apps.length} apps.`);

const featured = playlists.find(item => item.featured) || playlists[0] || {};
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
