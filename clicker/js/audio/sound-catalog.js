// Nitro Clicker sound catalog
// Every gameplay sound should be declared here with a stable id, label and default synth pattern.
// Later, a sound can be replaced by a file by adding `src: './assets/sfx/your-file.webm'`.

export const SOUND_BANKS = [
  {
    id: 'core',
    label: 'Noyau',
    sounds: [
      {
        id: 'core.click',
        label: 'Clic noyau',
        description: 'Petit clic électrique mélodique joué quand le joueur appuie sur le noyau.',
        volume: 0.45,
        synth: [
          { freq: 660, type: 'triangle', gain: 0.045, dur: 0.055, detune: 90 },
        ],
      },
      {
        id: 'core.passivePulse',
        label: 'Pulse passif',
        description: 'Signal doux pour rappeler que le noyau produit en arrière-plan.',
        volume: 0.22,
        synth: [
          { freq: 330, type: 'sine', gain: 0.025, dur: 0.09 },
          { freq: 495, type: 'sine', gain: 0.018, dur: 0.11, delay: 0.04 },
        ],
      },
    ],
  },
  {
    id: 'economy',
    label: 'Achats & upgrades',
    sounds: [
      {
        id: 'upgrade.buy',
        label: 'Achat upgrade',
        description: 'Arpège court et satisfaisant à chaque achat.',
        volume: 0.65,
        synth: [
          { freq: 392, type: 'triangle', gain: 0.06, dur: 0.10 },
          { freq: 523, type: 'triangle', gain: 0.055, dur: 0.10, delay: 0.055 },
          { freq: 659, type: 'triangle', gain: 0.052, dur: 0.11, delay: 0.11 },
          { freq: 1047, type: 'sine', gain: 0.038, dur: 0.12, delay: 0.17 },
        ],
      },
      {
        id: 'upgrade.levelUp',
        label: 'Montée de niveau',
        description: 'Effet plus marqué quand un upgrade prend un niveau ou un palier.',
        volume: 0.72,
        synth: [
          { freq: 523, type: 'triangle', gain: 0.05, dur: 0.10 },
          { freq: 784, type: 'triangle', gain: 0.055, dur: 0.12, delay: 0.06 },
          { freq: 1175, type: 'sine', gain: 0.045, dur: 0.16, delay: 0.13 },
        ],
      },
      {
        id: 'upgrade.locked',
        label: 'Achat impossible',
        description: 'Feedback discret quand les ressources manquent.',
        volume: 0.35,
        synth: [
          { freq: 196, type: 'square', gain: 0.025, dur: 0.07 },
          { freq: 155, type: 'square', gain: 0.020, dur: 0.09, delay: 0.055 },
        ],
      },
    ],
  },
  {
    id: 'power',
    label: 'Overdrive & prestige',
    sounds: [
      {
        id: 'overdrive.trigger',
        label: 'Overdrive',
        description: 'Explosion électrique principale de l’Overdrive.',
        volume: 0.78,
        synth: [
          { freq: 110, type: 'sawtooth', gain: 0.045, dur: 0.09 },
          { freq: 220, type: 'sawtooth', gain: 0.045, dur: 0.09, delay: 0.04 },
          { freq: 440, type: 'square', gain: 0.04, dur: 0.10, delay: 0.08 },
          { freq: 880, type: 'triangle', gain: 0.045, dur: 0.12, delay: 0.13 },
          { freq: 1760, type: 'sine', gain: 0.035, dur: 0.18, delay: 0.18 },
        ],
      },
      {
        id: 'prestige.activate',
        label: 'Prestige',
        description: 'Séquence ascendante longue pour la surcharge contrôlée.',
        volume: 0.74,
        synth: [
          { freq: 262, type: 'triangle', gain: 0.045, dur: 0.12 },
          { freq: 392, type: 'square', gain: 0.040, dur: 0.12, delay: 0.07 },
          { freq: 523, type: 'triangle', gain: 0.046, dur: 0.13, delay: 0.14 },
          { freq: 784, type: 'square', gain: 0.045, dur: 0.13, delay: 0.21 },
          { freq: 1047, type: 'triangle', gain: 0.045, dur: 0.14, delay: 0.28 },
          { freq: 1568, type: 'sine', gain: 0.04, dur: 0.18, delay: 0.36 },
        ],
      },
      {
        id: 'milestone.claim',
        label: 'Milestone',
        description: 'Validation claire d’un objectif ou palier.',
        volume: 0.66,
        synth: [
          { freq: 784, type: 'sine', gain: 0.045, dur: 0.11 },
          { freq: 988, type: 'sine', gain: 0.045, dur: 0.12, delay: 0.07 },
          { freq: 1175, type: 'sine', gain: 0.05, dur: 0.16, delay: 0.14 },
        ],
      },
    ],
  },
  {
    id: 'shell',
    label: 'Coque & fragments',
    sounds: [
      {
        id: 'shell.store',
        label: 'Fragment confiné',
        description: 'Son cristallin quand un fragment est stocké dans la sphère.',
        volume: 0.62,
        synth: [
          { freq: 740, type: 'sine', gain: 0.04, dur: 0.10 },
          { freq: 1480, type: 'triangle', gain: 0.025, dur: 0.16, delay: 0.04 },
        ],
      },
      {
        id: 'shell.crack',
        label: 'Fissure coque',
        description: 'Craquement électrique sur tentative de rupture ratée.',
        volume: 0.70,
        synth: [
          { freq: 180, type: 'sawtooth', gain: 0.045, dur: 0.07 },
          { freq: 320, type: 'triangle', gain: 0.04, dur: 0.08, delay: 0.04 },
          { freq: 640, type: 'sawtooth', gain: 0.035, dur: 0.08, delay: 0.08 },
          { freq: 420, type: 'triangle', gain: 0.035, dur: 0.07, delay: 0.12 },
        ],
      },
      {
        id: 'shell.shatter',
        label: 'Sphère brisée',
        description: 'Impact majeur quand la coque explose et libère les fragments.',
        volume: 0.85,
        synth: [
          { freq: 130, type: 'square', gain: 0.065, dur: 0.10 },
          { freq: 260, type: 'square', gain: 0.058, dur: 0.11, delay: 0.04 },
          { freq: 520, type: 'triangle', gain: 0.058, dur: 0.13, delay: 0.09 },
          { freq: 1040, type: 'triangle', gain: 0.045, dur: 0.16, delay: 0.14 },
          { freq: 1560, type: 'sine', gain: 0.035, dur: 0.20, delay: 0.20 },
        ],
      },
    ],
  },
  {
    id: 'ui',
    label: 'Interface',
    sounds: [
      {
        id: 'ui.zap',
        label: 'Arc électrique UI',
        description: 'Petit zap pour les arcs, boutons et modules.',
        volume: 0.38,
        synth: [
          { freq: 880, type: 'sawtooth', gain: 0.03, dur: 0.045, detune: 80 },
          { freq: 1240, type: 'sawtooth', gain: 0.026, dur: 0.045, delay: 0.025, detune: 70 },
          { freq: 660, type: 'triangle', gain: 0.022, dur: 0.055, delay: 0.055, detune: 50 },
        ],
      },
      {
        id: 'ui.objective',
        label: 'Nouvel objectif',
        description: 'Signal léger quand l’objectif actuel change.',
        volume: 0.50,
        synth: [
          { freq: 587, type: 'triangle', gain: 0.035, dur: 0.10 },
          { freq: 880, type: 'sine', gain: 0.032, dur: 0.14, delay: 0.07 },
        ],
      },
    ],
  },
];

export function flattenSoundCatalog() {
  return SOUND_BANKS.flatMap(bank => bank.sounds.map(sound => ({ ...sound, bankId: bank.id, bankLabel: bank.label })));
}

export function getSoundDefinition(id) {
  return flattenSoundCatalog().find(sound => sound.id === id) ?? null;
}
