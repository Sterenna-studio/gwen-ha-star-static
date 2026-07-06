import { supabase } from '../supabase.js';
import { getLocalActivityEvents } from './activity-events.js';
import {
  ACTIVITY_CHANNEL_FILTERS,
  filterActivityItemsByChannel,
  getActivityChannel,
  getActivityChannelLabel,
  getActivityEventMeta,
  getActivityEventType,
} from './activity-feed-schema.js';

let activityChannel = null;
let activeActivityChannel = 'all';
let latestActivityItems = [];
let latestHighlightId = null;
let currentAuthContext = null;

export async function loadActivity(authContext = null) {
  const el = document.getElementById('widget-activity');
  if (!el) return;

  currentAuthContext = authContext;
  setActivityState(el, 'loading');

  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('type, payload, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) throw error;

    latestActivityItems = mergeActivityItems(data, getLocalActivityEvents());
    latestHighlightId = null;
    renderActivityWidget(el, latestActivityItems);

    subscribeActivity(el);
  } catch {
    latestActivityItems = mergeActivityItems([], getLocalActivityEvents());
    latestHighlightId = null;
    if (latestActivityItems.length) {
      renderActivityWidget(el, latestActivityItems);
    } else {
      renderActivityPlaceholder(el, {
        state: 'offline',
        message: 'Flux activité indisponible',
        sub: 'ACTIVITY_LOG · OFFLINE',
      });
    }
  }
}

function timeAgo(iso) {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return 'maintenant';

  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function setActivityState(el, state) {
  el.dataset.widgetState = state;
}

function mergeActivityItems(remote = [], local = []) {
  const seen = new Set();
  return [...(remote ?? []), ...(local ?? [])]
    .filter(Boolean)
    .filter(item => {
      const id = getActivityItemId(item);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 40);
}

function renderActivityWidget(el, items, options = {}) {
  setActivityState(el, 'ready');
  latestHighlightId = options.highlightId ?? latestHighlightId;

  const visibleItems = filterActivityItemsByChannel(
    items,
    activeActivityChannel,
    currentAuthContext,
  ).slice(0, 12);

  const children = [createActivityTabs()];
  if (visibleItems.length) {
    children.push(createActivityFeed(visibleItems));
  } else {
    children.push(createActivityEmptyNode({
      state: 'listening',
      message: activeActivityChannel === 'all'
        ? 'Aucune activité récente'
        : `Aucun signal ${getActivityChannelLabel(activeActivityChannel).toLowerCase()}`,
      sub: `${getActivityFilterLabel(activeActivityChannel)} · EN ÉCOUTE`,
    }));
  }

  el.replaceChildren(...children);
}

function createActivityTabs() {
  const nav = document.createElement('div');
  nav.className = 'activity-channel-tabs';
  nav.setAttribute('aria-label', 'Canaux du flux activité');

  ACTIVITY_CHANNEL_FILTERS.forEach(filter => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'activity-channel-tab';
    btn.dataset.activityChannel = filter.id;
    btn.setAttribute('aria-pressed', String(activeActivityChannel === filter.id));
    btn.textContent = filter.label;
    btn.addEventListener('click', () => {
      activeActivityChannel = filter.id;
      const target = document.getElementById('widget-activity') ?? nav.parentElement;
      if (target) renderActivityWidget(target, latestActivityItems);
    });
    nav.appendChild(btn);
  });

  return nav;
}

function createActivityFeed(items) {
  const feed = document.createElement('ul');
  feed.className = 'activity-feed';
  feed.setAttribute('role', 'log');
  feed.setAttribute('aria-live', 'polite');
  items.forEach(item => feed.appendChild(createActivityItem(item, getActivityItemId(item) === latestHighlightId)));
  return feed;
}

function prependActivity(el, item) {
  latestHighlightId = getActivityItemId(item);
  latestActivityItems = mergeActivityItems([item], latestActivityItems);
  renderActivityWidget(el, latestActivityItems, { highlightId: latestHighlightId });
}

function createActivityItem(item, isNew = false) {
  const eventType = getActivityEventType(item);
  const channel = getActivityChannel(item);
  const eventMeta = getActivityEventMeta(eventType);

  const li = document.createElement('li');
  li.className = `activity-item${isNew ? ' activity-item--new' : ''}`;
  li.dataset.type = eventType;
  li.dataset.channel = channel;

  const icon = document.createElement('span');
  icon.className = 'activity-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = eventMeta.icon;

  const copy = document.createElement('span');
  copy.className = 'activity-copy';

  const meta = document.createElement('span');
  meta.className = 'activity-meta';

  const channelPill = document.createElement('span');
  channelPill.className = `activity-channel-pill activity-channel-pill--${channel}`;
  channelPill.textContent = getActivityChannelLabel(channel);

  const kind = document.createElement('span');
  kind.className = 'activity-event-kind';
  kind.textContent = eventMeta.label;

  const text = document.createElement('span');
  text.className = 'activity-text';
  text.textContent = item?.payload?.message ?? eventType ?? 'Activité réseau';

  meta.append(channelPill, kind);
  copy.append(meta, text);

  const time = document.createElement('time');
  time.className = 'activity-time';
  time.dateTime = item?.created_at ?? '';
  time.textContent = item?.created_at ? timeAgo(item.created_at) : 'maintenant';

  li.append(icon, copy, time);
  return li;
}

function renderActivityPlaceholder(el, options = {}) {
  setActivityState(el, options.state ?? 'listening');
  el.replaceChildren(createActivityTabs(), createActivityEmptyNode(options));
}

function createActivityEmptyNode(options = {}) {
  const {
    state = 'listening',
    message = 'Aucune activité récente',
    sub = 'ACTIVITY_LOG · EN ÉCOUTE',
  } = options;

  const root = document.createElement('div');
  root.className = `widget-empty widget-empty--${state}`;

  const icon = document.createElement('span');
  icon.className = 'widget-empty-icon';
  icon.textContent = '◈';

  const text = document.createElement('p');
  text.textContent = message;

  const meta = document.createElement('span');
  meta.className = 'widget-empty-sub';
  meta.textContent = sub;

  root.append(icon, text, meta);
  return root;
}

function subscribeActivity(el) {
  if (activityChannel) return;

  activityChannel = supabase.channel('activity_log_changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log' },
      payload => prependActivity(document.getElementById('widget-activity') ?? el, payload.new),
    )
    .subscribe(status => {
      const target = document.getElementById('widget-activity') ?? el;
      if (!target) return;
      if (status === 'SUBSCRIBED' && target.dataset.widgetState === 'loading') {
        setActivityState(target, 'listening');
      }
    });
}

function getActivityFilterLabel(channel) {
  if (channel === 'all') return 'TOUT';
  return getActivityChannelLabel(channel);
}

function getActivityItemId(item) {
  return item?.payload?.client_event_id ?? `${item?.type}:${item?.created_at}:${item?.payload?.message ?? ''}`;
}
