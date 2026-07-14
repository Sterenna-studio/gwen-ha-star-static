import { supabase } from '../supabase.js';
import {
  getActivityAudience,
  getAmbientActivityEvent,
  getDefaultActivityChannel,
  normalizeActivityChannel,
  normalizeActivityEventType,
} from './activity-feed-schema.js';

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
  const eventType = normalizeActivityEventType(type);
  const channel = normalizeActivityChannel(detail.channel, getDefaultActivityChannel(eventType));
  const targetUserId = detail.target_user_id ?? detail.targetUserId ?? (
    channel === 'personal' ? auth?.user?.id ?? null : null
  );

  const item = normalizeActivityEvent({
    type: eventType,
    created_at: new Date().toISOString(),
    user_id: auth?.user?.id ?? null,
    payload: {
      ...detail,
      message,
      event_type: eventType,
      channel,
      audience: getActivityAudience(channel),
      actor: detail.actor ?? getActorName(auth),
      role: auth?.profile?.role ?? auth?.meta?.role ?? 'member',
      source: detail.source ?? 'star-cockpit',
      target_user_id: targetUserId,
      client_event_id: detail.client_event_id ?? createEventId(),
    },
  });

  if (!item) {
    return emitPublishResult({
      remote: false,
      local: false,
      duplicate: false,
      item: null,
      error: 'invalid activity event',
    });
  }

  const local = saveLocalActivityEvent(item);

  try {
    const { error } = await supabase.from('activity_log').insert({
      type: item.type,
      payload: item.payload,
      user_id: item.user_id,
    });

    if (error?.code === '23505') {
      return emitPublishResult({ remote: true, local, duplicate: true, item, error: null });
    }
    if (error) throw error;

    return emitPublishResult({ remote: true, local, duplicate: false, item, error: null });
  } catch (error) {
    const message = error?.message || String(error);
    console.warn('[star-activity] remote publish skipped:', message);
    return emitPublishResult({ remote: false, local, duplicate: false, item, error: message });
  }
}

export function publishTitleUnlocked(auth, titleLabel, detail = {}) {
  return publishActivityEvent(auth, 'title_unlocked', `Titre obtenu : ${titleLabel}`, {
    ...detail,
    channel: detail.channel ?? 'personal',
    title: titleLabel,
  });
}

export function publishChroniclesGain(auth, amount, reason = 'gain cockpit', detail = {}) {
  const value = Number(amount) || 0;
  const type = value < 0 ? 'chronicles_spent' : 'chronicles_gain';
  const sign = value > 0 ? '+' : '';
  return publishActivityEvent(auth, type, `${sign}${value} Chronicles · ${reason}`, {
    ...detail,
    channel: detail.channel ?? 'personal',
    amount: value,
    reason,
  });
}

export function publishGitPush(auth, git = {}, detail = {}) {
  const repo = git.repo ?? detail.repo ?? 'repo';
  const branch = git.branch ?? detail.branch ?? 'main';
  const commit = git.commit ?? detail.commit ?? null;
  const suffix = commit ? ` · ${String(commit).slice(0, 7)}` : '';

  return publishActivityEvent(auth, 'git_push', `Push git ${repo}:${branch}${suffix}`, {
    ...detail,
    ...git,
    channel: detail.channel ?? 'crew',
    repo,
    branch,
    commit,
  });
}

export function publishLemegetonPhrase(auth, phrase, detail = {}) {
  return publishActivityEvent(auth, 'lemegeton_phrase', `Lemegeton : ${phrase}`, {
    ...detail,
    channel: detail.channel ?? 'global',
    phrase,
  });
}

export function publishMiniEvent(auth, eventId = null, detail = {}) {
  const preset = typeof eventId === 'object' && eventId
    ? eventId
    : getAmbientActivityEvent(eventId);

  if (!preset) {
    return Promise.resolve({
      remote: false,
      local: false,
      duplicate: false,
      item: null,
      error: 'unknown ambient activity event',
    });
  }

  return publishActivityEvent(auth, preset.type, preset.message, {
    ...(preset.detail ?? {}),
    ...detail,
    channel: detail.channel ?? preset.channel,
    mini_event_id: preset.id ?? eventId,
  });
}

function saveLocalActivityEvent(item, storage = getStorage()) {
  if (!storage) return false;

  try {
    const events = getLocalActivityEvents(storage);
    const next = [item, ...events]
      .filter((event, index, list) => {
        const id = getActivityEventId(event);
        return list.findIndex(other => getActivityEventId(other) === id) === index;
      })
      .slice(0, MAX_LOCAL_EVENTS);

    storage.setItem(LOCAL_ACTIVITY_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function emitPublishResult(result) {
  try {
    window.dispatchEvent(new CustomEvent('star:activity-publish-result', { detail: result }));
  } catch {}
  return result;
}

function normalizeActivityEvent(item) {
  if (!item || typeof item !== 'object') return null;

  const type = normalizeActivityEventType(item.payload?.event_type ?? item.type);
  if (!type) return null;

  const createdAt = item.created_at || new Date().toISOString();
  const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
  const channel = normalizeActivityChannel(payload.channel, getDefaultActivityChannel(type));

  return {
    type,
    created_at: createdAt,
    user_id: item.user_id ?? null,
    payload: {
      ...payload,
      event_type: type,
      channel,
      audience: payload.audience ?? getActivityAudience(channel),
    },
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
    'member'
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
