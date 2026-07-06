export const ACTIVITY_CHANNELS = Object.freeze({
  global: {
    id: 'global',
    label: 'GLOBAL',
    description: 'Flux visible par les membres connectes.',
  },
  crew: {
    id: 'crew',
    label: 'CREW',
    description: 'Flux operationnel pour le crew Star.',
  },
  personal: {
    id: 'personal',
    label: 'PERSO',
    description: 'Flux personnel visible par le membre cible.',
  },
});

export const ACTIVITY_CHANNEL_FILTERS = Object.freeze([
  { id: 'all', label: 'TOUT' },
  { id: 'global', label: ACTIVITY_CHANNELS.global.label },
  { id: 'crew', label: ACTIVITY_CHANNELS.crew.label },
  { id: 'personal', label: ACTIVITY_CHANNELS.personal.label },
]);

export const ACTIVITY_EVENT_TYPES = Object.freeze({
  admin_background: {
    label: 'ADMIN BG',
    icon: '▧',
    defaultChannel: 'crew',
  },
  admin_hero_cards: {
    label: 'HERO CARD',
    icon: '⬡',
    defaultChannel: 'crew',
  },
  admin_space_background: {
    label: 'SPACE BG',
    icon: '✦',
    defaultChannel: 'crew',
  },
  cig_updated: {
    label: 'CIG',
    icon: '✎',
    defaultChannel: 'crew',
  },
  member_join: {
    label: 'MEMBRE',
    icon: '⬡',
    defaultChannel: 'crew',
  },
  project: {
    label: 'PROJET',
    icon: '◈',
    defaultChannel: 'crew',
  },
  title_unlocked: {
    label: 'TITRE',
    icon: '★',
    defaultChannel: 'personal',
  },
  chronicles_gain: {
    label: 'CHRONICLES',
    icon: '¤',
    defaultChannel: 'personal',
  },
  git_push: {
    label: 'GIT PUSH',
    icon: '⇧',
    defaultChannel: 'crew',
  },
  lemegeton_phrase: {
    label: 'LEMEGETON',
    icon: '◌',
    defaultChannel: 'global',
  },
  mini_pirate_signal: {
    label: 'PIRATE',
    icon: '⌁',
    defaultChannel: 'global',
  },
  mini_capsule_sos: {
    label: 'SOS',
    icon: '◇',
    defaultChannel: 'global',
  },
  mini_ad: {
    label: 'PUB',
    icon: '▤',
    defaultChannel: 'global',
  },
  system: {
    label: 'SYSTEM',
    icon: '·',
    defaultChannel: 'global',
  },
});

export const AMBIENT_ACTIVITY_EVENTS = Object.freeze([
  {
    id: 'pirate-fragment',
    type: 'mini_pirate_signal',
    channel: 'global',
    message: 'Flux pirate capte sur la bande 29.7 · paquet partiel archive',
    detail: { frequency: '29.7', signal: 'pirate-fragment' },
  },
  {
    id: 'lost-capsule-sos',
    type: 'mini_capsule_sos',
    channel: 'global',
    message: 'SOS capsule perdue · balise faible detectee pres du relais Armorica',
    detail: { sector: 'Armorica Relay', signal: 'capsule-sos' },
  },
  {
    id: 'station-ad-canteen',
    type: 'mini_ad',
    channel: 'global',
    message: 'Mini pub captee · Cantine orbitale : galettes chaudes jusqu a 03:00',
    detail: { sponsor: 'Cantine orbitale', signal: 'station-ad' },
  },
]);

const KNOWN_CHANNELS = new Set(Object.keys(ACTIVITY_CHANNELS));
const KNOWN_EVENT_TYPES = new Set(Object.keys(ACTIVITY_EVENT_TYPES));

export function normalizeActivityChannel(channel, fallback = 'global') {
  const value = String(channel ?? '').trim().toLowerCase();
  if (KNOWN_CHANNELS.has(value)) return value;
  return KNOWN_CHANNELS.has(fallback) ? fallback : 'global';
}

export function normalizeActivityEventType(type, fallback = 'system') {
  const value = String(type ?? '').trim();
  if (KNOWN_EVENT_TYPES.has(value)) return value;
  return value || fallback;
}

export function getDefaultActivityChannel(type) {
  const eventType = normalizeActivityEventType(type);
  return normalizeActivityChannel(ACTIVITY_EVENT_TYPES[eventType]?.defaultChannel, 'global');
}

export function getActivityChannel(item) {
  const type = getActivityEventType(item);
  return normalizeActivityChannel(item?.payload?.channel, getDefaultActivityChannel(type));
}

export function getActivityEventType(item) {
  return normalizeActivityEventType(item?.payload?.event_type ?? item?.type);
}

export function getActivityChannelLabel(channel) {
  const id = normalizeActivityChannel(channel);
  return ACTIVITY_CHANNELS[id]?.label ?? id.toUpperCase();
}

export function getActivityEventMeta(itemOrType) {
  const type = typeof itemOrType === 'string'
    ? normalizeActivityEventType(itemOrType)
    : getActivityEventType(itemOrType);

  return ACTIVITY_EVENT_TYPES[type] ?? {
    label: type.toUpperCase(),
    icon: '·',
    defaultChannel: 'global',
  };
}

export function getActivityAudience(channel) {
  const id = normalizeActivityChannel(channel);
  if (id === 'personal') return 'self';
  if (id === 'crew') return 'crew';
  return 'members';
}

export function isActivityVisible(item, authContext = null) {
  const channel = getActivityChannel(item);
  const userId = getAuthUserId(authContext);

  if (channel === 'personal') {
    if (!userId) return false;
    const payload = item?.payload ?? {};
    return [item?.user_id, payload.user_id, payload.target_user_id, payload.owner_id]
      .filter(Boolean)
      .map(String)
      .includes(String(userId));
  }

  if (channel === 'crew') return Boolean(userId);
  return true;
}

export function filterActivityItemsByChannel(items, activeChannel = 'all', authContext = null) {
  const channel = activeChannel === 'all' ? 'all' : normalizeActivityChannel(activeChannel);
  return (items ?? []).filter(item => {
    if (!isActivityVisible(item, authContext)) return false;
    return channel === 'all' || getActivityChannel(item) === channel;
  });
}

export function getAmbientActivityEvent(eventId = null) {
  if (!eventId) {
    const index = Math.floor(Math.random() * AMBIENT_ACTIVITY_EVENTS.length);
    return AMBIENT_ACTIVITY_EVENTS[index] ?? null;
  }

  return AMBIENT_ACTIVITY_EVENTS.find(event => (
    event.id === eventId ||
    event.type === eventId
  )) ?? null;
}

function getAuthUserId(authContext) {
  return authContext?.user?.id ?? authContext?.user_id ?? null;
}
