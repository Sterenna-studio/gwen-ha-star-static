import { supabase } from '../supabase.js';

export async function loadActivity() {
  const el = document.getElementById('widget-activity');
  if (!el) return;

  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('type, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error || !data || data.length === 0) {
      renderActivityPlaceholder(el);
      return;
    }

    renderActivityFeed(el, data);

    supabase.channel('activity_log_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        payload => prependActivity(el, payload.new)
      ).subscribe();
  } catch {
    renderActivityPlaceholder(el);
  }
}

function activityIcon(type) {
  const icons = { cig_updated: '✎', member_join: '⬡', project: '◈', default: '·' };
  return icons[type] ?? icons.default;
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function renderActivityFeed(el, items) {
  el.innerHTML = `<ul class="activity-feed" role="log" aria-live="polite">
    ${items.map(item => `
      <li class="activity-item" data-type="${item.type}">
        <span class="activity-icon" aria-hidden="true">${activityIcon(item.type)}</span>
        <span class="activity-text">${item.payload?.message ?? item.type}</span>
        <time class="activity-time" datetime="${item.created_at}">${timeAgo(item.created_at)}</time>
      </li>
    `).join('')}
  </ul>`;
}

function prependActivity(el, item) {
  const feed = el.querySelector('.activity-feed');
  if (!feed) return;

  const li = document.createElement('li');
  li.className = 'activity-item activity-item--new';
  li.dataset.type = item.type;
  li.innerHTML = `
    <span class="activity-icon" aria-hidden="true">${activityIcon(item.type)}</span>
    <span class="activity-text">${item.payload?.message ?? item.type}</span>
    <time class="activity-time" datetime="${item.created_at}">${timeAgo(item.created_at)}</time>
  `;

  feed.prepend(li);
  while (feed.children.length > 12) feed.lastElementChild.remove();
}

function renderActivityPlaceholder(el) {
  el.innerHTML = `
    <div class="widget-empty">
      <span class="widget-empty-icon">◈</span>
      <p>Aucune activité récente</p>
      <span class="widget-empty-sub">ACTIVITY_LOG · OFFLINE</span>
    </div>
  `;
}
