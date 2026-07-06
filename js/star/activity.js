import { supabase } from '../supabase.js';
import { getLocalActivityEvents } from './activity-events.js';

let activityChannel = null;

export async function loadActivity() {
  const el = document.getElementById('widget-activity');
  if (!el) return;

  setActivityState(el, 'loading');

  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('type, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;

    const items = mergeActivityItems(data, getLocalActivityEvents());

    if (items.length === 0) {
      renderActivityPlaceholder(el);
    } else {
      renderActivityFeed(el, items);
    }

    subscribeActivity(el);
  } catch {
    const localItems = getLocalActivityEvents();
    if (localItems.length) {
      renderActivityFeed(el, localItems);
    } else {
      renderActivityPlaceholder(el, {
        state: 'offline',
        message: 'Flux activité indisponible',
        sub: 'ACTIVITY_LOG · OFFLINE',
      });
    }
  }
}

function activityIcon(type) {
  const icons = {
    admin_background: '▧',
    admin_hero_cards: '⬡',
    admin_space_background: '✦',
    cig_updated: '✎',
    member_join: '⬡',
    project: '◈',
    default: '·',
  };
  return icons[type] ?? icons.default;
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
    .filter(item => {
      const id = item?.payload?.client_event_id ?? `${item?.type}:${item?.created_at}:${item?.payload?.message ?? ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);
}

function renderActivityFeed(el, items) {
  setActivityState(el, 'ready');

  const feed = document.createElement('ul');
  feed.className = 'activity-feed';
  feed.setAttribute('role', 'log');
  feed.setAttribute('aria-live', 'polite');
  items.forEach(item => feed.appendChild(createActivityItem(item)));

  el.replaceChildren(feed);
}

function prependActivity(el, item) {
  const feed = el.querySelector('.activity-feed');
  if (!feed) {
    renderActivityFeed(el, [item]);
    return;
  }

  setActivityState(el, 'ready');
  const li = createActivityItem(item, true);
  feed.prepend(li);
  while (feed.children.length > 12) feed.lastElementChild.remove();
}

function createActivityItem(item, isNew = false) {
  const li = document.createElement('li');
  li.className = `activity-item${isNew ? ' activity-item--new' : ''}`;
  li.dataset.type = item?.type ?? 'default';

  const icon = document.createElement('span');
  icon.className = 'activity-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = activityIcon(item?.type);

  const text = document.createElement('span');
  text.className = 'activity-text';
  text.textContent = item?.payload?.message ?? item?.type ?? 'Activité réseau';

  const time = document.createElement('time');
  time.className = 'activity-time';
  time.dateTime = item?.created_at ?? '';
  time.textContent = item?.created_at ? timeAgo(item.created_at) : 'maintenant';

  li.append(icon, text, time);
  return li;
}

function renderActivityPlaceholder(el, options = {}) {
  const {
    state = 'listening',
    message = 'Aucune activité récente',
    sub = 'ACTIVITY_LOG · EN ÉCOUTE',
  } = options;

  setActivityState(el, state);

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
  el.replaceChildren(root);
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
