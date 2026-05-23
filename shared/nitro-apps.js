// Nitro app registry.
// Central list used by the hub, docs and future Star dashboard widgets.

export const NITRO_APPS = [
  {
    id: 'star',
    name: 'Star Cockpit',
    url: '/star/',
    icon: '⬡',
    status: 'active',
    scope: 'internal',
    auth: 'required',
    repo: 'MutenRock/gwen-ha-star-static',
    deployPath: '~/nitro/star/',
    description: 'Cockpit membre Nitro : crew, CIG, widgets, activité réseau et accès aux modules Star.',
  },
  {
    id: 'star-arcade',
    name: 'Star Arcade',
    url: '/star/casino/',
    icon: '🎮',
    status: 'active',
    scope: 'internal',
    auth: 'required',
    repo: 'MutenRock/gwen-ha-star-static',
    deployPath: '~/nitro/star/casino/',
    description: 'Arcade Star avec Whack-A-Mole, Crash, Slot Machine et Neon Racer.',
  },
  {
    id: 'botanica',
    name: 'Botanica Obscura',
    url: '/botanica/landing.html',
    icon: '🌿',
    status: 'alpha',
    scope: 'nitro-app',
    auth: 'required',
    repo: 'MutenRock/botanica-obscura',
    deployPath: '~/nitro/botanica/',
    description: 'Idle gacha botanique : mutations, pots, codex partagé, XP, jardin et découvertes serveur.',
  },
  {
    id: 'tcg',
    name: 'Nitro TCG',
    url: '/TCG/',
    icon: '🃏',
    status: 'alpha',
    scope: 'internal',
    auth: 'required',
    repo: 'MutenRock/gwen-ha-star-static',
    deployPath: '~/nitro/TCG/',
    description: 'Trading Card Game communautaire lié à l’univers Star / BZH Chronicles.',
  },
  {
    id: 'jukebox',
    name: 'Jukebox',
    url: '/jukebox/',
    icon: '🎵',
    status: 'active',
    scope: 'internal',
    auth: 'optional',
    repo: 'MutenRock/gwen-ha-star-static',
    deployPath: '~/nitro/jukebox/',
    description: 'Lecteur musical communautaire et archives audio Dr.Spig / BZH Chronicles.',
  },
  {
    id: 'pokegang',
    name: 'PokéGang',
    url: 'https://pokegang.sterenna.fr/',
    icon: '⚡',
    status: 'external-sync',
    scope: 'external',
    auth: 'optional-link',
    repo: 'MutenRock/pokegang-game',
    deployPath: '~/pokegang/',
    description: 'Jeu autonome sur sous-domaine dédié, avec intégration Nitro progressive via CORS et liaison de compte.',
  },
];

export function getNitroApp(id) {
  return NITRO_APPS.find(app => app.id === id) ?? null;
}

export function getInternalNitroApps() {
  return NITRO_APPS.filter(app => app.scope !== 'external');
}
