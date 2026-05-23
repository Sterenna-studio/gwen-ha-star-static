import { getHeroNitroApps, getQuickNitroApps } from '../../shared/nitro-apps.js';

export function renderNitroQuickAccess(containerId = 'quick-access-grid') {
  const el = document.getElementById(containerId);
  if (!el) return;

  const apps = getQuickNitroApps();
  el.innerHTML = apps.map(app => {
    const ext = app.url.startsWith('http');
    return `
      <a href="${app.url}"
         class="qa-card"
         style="--qa-color: var(${app.color ?? '--c-primary'})"
         ${ext ? 'target="_blank" rel="noopener noreferrer"' : ''}
         aria-label="${app.quickLabel ?? app.name}">
        <span class="qa-icon" aria-hidden="true">${app.icon}</span>
        <span class="qa-label">${app.quickLabel ?? app.name}</span>
        <span class="qa-desc">${app.quickDesc ?? app.status}</span>
        ${ext ? '<span class="qa-ext" aria-hidden="true">↗</span>' : ''}
      </a>
    `;
  }).join('');
}

export function renderNitroHeroCards(containerId = 'nitro-hero-cards') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = buildHeroCards();
}

export function renderNitroHeroCardsAuto() {
  const firstHero = document.querySelector('.bc-hero');
  if (!firstHero) return;
  const tpl = document.createElement('template');
  tpl.innerHTML = buildHeroCards();
  firstHero.before(tpl.content);
  document.querySelectorAll('.bc-hero:not([data-nitro-rendered="true"])').forEach(node => node.remove());
}

function buildHeroCards() {
  const apps = getHeroNitroApps();
  return apps.map(app => {
    const kind = app.id.replace(/[^a-z0-9-]/gi, '-');
    return `
      <div class="bc bc-hero bc-nitro-hero" data-app="${app.id}" data-nitro-rendered="true">
        <a href="${app.url}" class="hero-card hero-card--nitro hero-card--${kind}" aria-label="Accéder à ${app.name}">
          <div class="hero-scene hero-scene--nitro hero-scene--${kind}" aria-hidden="true">
            <div class="hsc-grid"></div>
            <div class="nitro-hero-orb">${app.icon}</div>
            <div class="nitro-hero-spark nitro-hero-spark-1"></div>
            <div class="nitro-hero-spark nitro-hero-spark-2"></div>
            <div class="nitro-hero-spark nitro-hero-spark-3"></div>
          </div>
          <div class="hero-content">
            <div class="hero-eyebrow">${app.heroEyebrow ?? '// NITRO · APP'}</div>
            <div class="hero-title hero-title--nitro">${formatHeroTitle(app.heroTitle ?? app.name)}</div>
            <div class="hero-sub">${app.heroSub ?? app.description}</div>
            <div class="hero-footer">
              <span class="hero-badge hero-badge--nitro">${app.heroBadge ?? app.status.toUpperCase()}</span>
              <span class="hero-cta">OUVRIR →</span>
            </div>
          </div>
          <div class="hero-scanlines" aria-hidden="true"></div>
        </a>
      </div>
    `;
  }).join('');
}

function formatHeroTitle(title) {
  const parts = String(title).split(' ');
  if (parts.length <= 1) return title;
  const first = parts.shift();
  return `${first}<br><span class="hero-title-accent">${parts.join(' ')}</span>`;
}
