import { NITRO_APPS, getHeroNitroApps, getQuickNitroApps } from '../../shared/nitro-apps.js';
import { publishActivityEvent } from '../../js/star/activity-events.js';
import { requireStarSuperuser } from './admin-guard.js';

const app = document.getElementById('app');

boot();

async function boot() {
  const auth = await requireStarSuperuser(app, { title: 'HERO CARDS' });
  if (!auth) return;

  const heroApps = getHeroNitroApps();
  const quickApps = getQuickNitroApps();
  const duplicateIds = getDuplicateIds(NITRO_APPS);
  render(auth, heroApps, quickApps, duplicateIds);
}

function render(auth, heroApps, quickApps, duplicateIds) {
  app.replaceChildren(
    renderTop(),
    renderKpis(heroApps, quickApps, duplicateIds),
    renderWarning(duplicateIds),
    renderHeroCards(heroApps),
    renderRegistryTable(),
  );

  document.getElementById('export-heroes')?.addEventListener('click', () => {
    downloadJson('star-hero-cards-config.json', {
      schema: 'gwen-ha-star/star-hero-cards@1',
      exportedAt: new Date().toISOString(),
      source: 'shared/nitro-apps.js',
      counts: {
        registry: NITRO_APPS.length,
        heroCards: heroApps.length,
        quickAccess: quickApps.length,
        duplicateIds: duplicateIds.length,
      },
      heroCards: heroApps,
      quickAccess: quickApps,
      registry: NITRO_APPS,
    });

    void publishActivityEvent(auth, 'admin_hero_cards', 'Hero cards exportées depuis la console admin', {
      action: 'export',
      heroCards: heroApps.length,
      quickAccess: quickApps.length,
      duplicateIds: duplicateIds.length,
      target: '/star/index.html',
    });
  });
}

function renderTop() {
  const header = document.createElement('header');
  header.className = 'star-admin-top';
  header.innerHTML = `
    <div>
      <p class="star-admin-kicker">// GWEN HA STAR · ADMIN</p>
      <h1 class="star-admin-title">HERO <span>CARDS</span></h1>
      <p class="star-admin-sub">Lecture du registre central des apps Nitro affichées dans le cockpit Star.</p>
    </div>
    <nav class="star-admin-actions" aria-label="Navigation admin">
      <a class="star-admin-btn" href="/star/">COCKPIT</a>
      <a class="star-admin-btn" href="/star/admin/cockpit-background.html">BACKGROUND STAR</a>
      <a class="star-admin-btn" href="/star/admin/background.html">BACKGROUND PUBLIC</a>
      <button class="star-admin-btn primary" type="button" id="export-heroes">EXPORT JSON</button>
    </nav>
  `;
  return header;
}

function renderKpis(heroApps, quickApps, duplicateIds) {
  const section = document.createElement('section');
  section.className = 'star-admin-kpis';
  section.append(
    kpi(NITRO_APPS.length, 'APPS REGISTRE'),
    kpi(heroApps.length, 'HERO CARDS'),
    kpi(quickApps.length, 'ACCÈS RAPIDE'),
    kpi(duplicateIds.length, 'IDS DOUBLONS'),
  );
  return section;
}

function kpi(value, label) {
  const card = document.createElement('article');
  card.className = 'star-admin-card star-admin-kpi';
  const strong = document.createElement('strong');
  strong.textContent = value;
  const span = document.createElement('span');
  span.textContent = label;
  card.append(strong, span);
  return card;
}

function renderWarning(duplicateIds) {
  const section = document.createElement('section');
  section.className = 'star-admin-card hero-admin-warning';
  if (!duplicateIds.length) {
    section.textContent = 'Audit OK : aucun id dupliqué dans le registre.';
    return section;
  }

  section.textContent = `Audit : id dupliqué détecté (${duplicateIds.join(', ')}). La liste reste lisible, mais getNitroApp(id) renverra le premier match.`;
  return section;
}

function renderHeroCards(heroApps) {
  const wrap = document.createElement('section');
  wrap.className = 'hero-admin-layout';

  const title = document.createElement('p');
  title.className = 'star-admin-kicker';
  title.textContent = '// LISTE HERO CARDS';

  const list = document.createElement('div');
  list.className = 'hero-admin-list';
  heroApps.forEach(appConfig => list.append(renderHeroCard(appConfig)));

  wrap.append(title, list);
  return wrap;
}

function renderHeroCard(appConfig) {
  const article = document.createElement('article');
  article.className = 'star-admin-card hero-admin-card';
  article.style.setProperty('--card-color', `var(${appConfig.color ?? '--c-primary'})`);

  const orb = document.createElement('div');
  orb.className = 'hero-admin-orb';
  orb.textContent = appConfig.icon ?? '⬡';

  const name = document.createElement('h2');
  name.className = 'hero-admin-name';
  name.textContent = appConfig.heroTitle ?? appConfig.name;

  const sub = document.createElement('p');
  sub.className = 'star-admin-muted';
  sub.textContent = appConfig.heroSub ?? appConfig.description ?? appConfig.status;

  const meta = document.createElement('div');
  meta.className = 'hero-admin-meta';
  meta.append(
    badge(appConfig.id),
    badge(appConfig.heroBadge ?? appConfig.status),
    badge(appConfig.auth ?? 'auth ?'),
    badge(appConfig.scope ?? 'scope ?'),
  );

  const link = document.createElement('a');
  link.className = 'star-admin-btn';
  link.href = appConfig.url;
  link.textContent = appConfig.url.startsWith('http') ? 'OUVRIR EXTERNE' : 'OUVRIR';
  if (appConfig.url.startsWith('http')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  article.append(orb, name, sub, meta, link);
  return article;
}

function renderRegistryTable() {
  const section = document.createElement('section');
  section.className = 'star-admin-card hero-admin-registry';

  const title = document.createElement('p');
  title.className = 'star-admin-kicker';
  title.textContent = '// REGISTRE COMPLET shared/nitro-apps.js';

  const table = document.createElement('table');
  table.className = 'hero-admin-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Nom</th>
        <th>Hero</th>
        <th>Quick</th>
        <th>Statut</th>
        <th>Auth</th>
        <th>URL</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  NITRO_APPS.forEach(appConfig => {
    const tr = document.createElement('tr');
    tr.append(
      cell(appConfig.id),
      cell(appConfig.name),
      cell(appConfig.hero ? 'oui' : 'non'),
      cell(appConfig.quickAccess ? appConfig.quickLabel ?? 'oui' : 'non'),
      cell(appConfig.status),
      cell(appConfig.auth),
      linkCell(appConfig.url),
    );
    tbody.append(tr);
  });
  table.append(tbody);
  section.append(title, table);
  return section;
}

function cell(value) {
  const td = document.createElement('td');
  td.textContent = value ?? '—';
  return td;
}

function linkCell(url) {
  const td = document.createElement('td');
  const a = document.createElement('a');
  a.href = url;
  a.textContent = url;
  if (url.startsWith('http')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  td.append(a);
  return td;
}

function badge(text) {
  const span = document.createElement('span');
  span.className = 'star-admin-badge';
  span.textContent = text ?? '—';
  return span;
}

function getDuplicateIds(items) {
  const seen = new Set();
  const duplicates = new Set();
  items.forEach(item => {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  });
  return [...duplicates];
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
