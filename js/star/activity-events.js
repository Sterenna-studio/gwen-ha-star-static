import { supabase } from '../supabase.js';

const LOCAL_ACTIVITY_KEY = 'star-local-activity-events';
const MAX_LOCAL_EVENTS = 24;

export function getLocalActivityEvents(storage = getStorage()) {
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(LOCAL_ACTIVITY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeActivityEvent).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function publishActivityEvent(auth, type, message, detail = {}) {
  const item = normalizeActivityEvent({
    type,
    created_at: new Date().toISOString(),
    user_id: auth?.user?.id ?? null,
    payload: {
      ...detail,
      message,
      actor: getActorName(auth),
      role: auth?.profile?.role ?? auth?.meta?.role ?? 'superuser',
      source: detail.source ?? 'star-admin',
      client_event_id: createEventId(),
    },
  });

  if (!item) return false;

  saveLocalActivityEvent(item);

  try {
    const { error } = await supabase.from('activity_log').insert({
      type: item.type,
      payload: item.payload,
      user_id: item.user_id,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('[star-activity] remote publish skipped:', error?.message || error);
    return false;
  }
}

function saveLocalActivityEvent(item, storage = getStorage()) {
  if (!storage) return;

  try {
    const events = getLocalActivityEvents(storage);
    const next = [item, ...events]
      .filter((event, index, list) => {
        const id = getActivityEventId(event);
        return list.findIndex(other => getActivityEventId(other) === id) === index;
      })
      .slice(0, MAX_LOCAL_EVENTS);

    storage.setItem(LOCAL_ACTIVITY_KEY, JSON.stringify(next));
  } catch {}
}

function normalizeActivityEvent(item) {
  if (!item || typeof item !== 'object') return null;

  const type = String(item.type ?? '').trim();
  if (!type) return null;

  const createdAt = item.created_at || new Date().toISOString();
  const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};

  return {
    type,
    created_at: createdAt,
    user_id: item.user_id ?? null,
    payload,
  };
}

function getActivityEventId(item) {
  return item?.payload?.client_event_id ?? `${item?.type}:${item?.created_at}:${item?.payload?.message ?? ''}`;
}

function getActorName(auth) {
  return (
    auth?.profile?.username ||
    auth?.meta?.username ||
    auth?.user?.user_metadata?.username ||
    auth?.user?.user_metadata?.name ||
    auth?.user?.email?.split('@')[0] ||
    'superuser'
  );
}

function createEventId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `star-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
