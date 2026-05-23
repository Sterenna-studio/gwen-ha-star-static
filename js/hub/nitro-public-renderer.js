import { getInternalNitroApps } from '../../shared/nitro-apps.js';

export function renderPublicNitroApps() {
  const firstSection = document.querySelector('.hub-section');
  if (!firstSection || document.getElementById('public-nitro-apps')) return;

  installPublicNitroStyles();

  const apps = getInternalNitroApps()
    .filter(app => app.id !== 'star')
    .sort((a, b) => scoreApp(b) - scoreApp(a));

  const section = document.createElement('section');
  section.className = 'hub-section public-nitro-apps';
  section.id = 'public-nitro-apps';
  section.innerHTML = `
    <p class="hub-section-label">// NITRO · PROJETS CONNECTÉS</p>
    <div class="public-nitro-head">
      <h2 class="hub-section-title">Apps Nitro</h2>
      <a href="/star/" class="public-nitro-link">⬡ ESPACE STAR →</a>
    </div>
    <div class="public-nitro-grid">
      ${apps.map(app => renderAppCard(app)).join('')}
    </div>
  `;

  const divider = document.createElement('div');
  divider.className = 'hub-divider public-nitro-divider';

  firstSection.after(divider);
  divider.after(section);
}

function scoreApp(app) {
  if (app.id === 'clicker') return 100;
  if (app.hero) return 80;
  if (app.quickAccess) return 60;
  return 10;
}

function renderAppCard(app) {
  const ext = app.url.startsWith('http');
  const tag = app.auth === 'required' ? 'NITRO LOGIN' : app.auth === 'optional' ? 'ACCÈS LIBRE' : String(app.auth).toUpperCase();
  const color = app.color ? `var(${app.color})` : 'var(--c-primary)';
  return `
    <a href="${app.url}"
       class="public-nitro-card public-nitro-card--${app.id}"
       style="--app-color:${color}"
       ${ext ? 'target="_blank" rel="noopener noreferrer"' : ''}
       aria-label="Ouvrir ${app.name}">
      <div class="public-nitro-orb" aria-hidden="true">${app.icon}</div>
      <div class="public-nitro-meta">
        <div class="public-nitro-status">${app.status} · ${tag}</div>
        <div class="public-nitro-name">${app.name}</div>
        <div class="public-nitro-desc">${app.description}</div>
        <div class="public-nitro-footer">
          <span>${app.scope}</span>
          <strong>OUVRIR ${ext ? '↗' : '→'}</strong>
        </div>
      </div>
      <div class="public-nitro-fx" aria-hidden="true"></div>
    </a>
  `;
}

function installPublicNitroStyles() {
  if (document.getElementById('public-nitro-apps-style')) return;
  const style = document.createElement('style');
  style.id = 'public-nitro-apps-style';
  style.textContent = `
    .public-nitro-head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:var(--space-4);
      margin-bottom:var(--space-6);
    }
    .public-nitro-head .hub-section-title { margin-bottom:0; }
    .public-nitro-link {
      font-family:var(--font-mono);
      font-size:10px;
      letter-spacing:.14em;
      color:var(--c-primary);
      border:1px solid rgba(0,255,204,.28);
      border-radius:var(--radius-md);
      padding:var(--space-2) var(--space-4);
      text-decoration:none;
      background:rgba(0,255,204,.035);
      transition:transform .18s,border-color .18s,box-shadow .18s;
    }
    .public-nitro-link:hover {
      transform:translateY(-1px);
      border-color:rgba(0,255,204,.62);
      box-shadow:0 0 22px rgba(0,255,204,.12);
    }
    .public-nitro-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));
      gap:var(--space-4);
    }
    .public-nitro-card {
      position:relative;
      min-height:190px;
      display:flex;
      align-items:flex-start;
      gap:var(--space-4);
      padding:var(--space-5);
      border:1px solid rgba(255,255,255,.09);
      border-radius:var(--radius-xl);
      background:
        radial-gradient(circle at 16% 20%, color-mix(in srgb, var(--app-color) 24%, transparent), transparent 34%),
        radial-gradient(circle at 84% 80%, rgba(255,61,242,.10), transparent 42%),
        rgba(9,13,24,.84);
      color:inherit;
      text-decoration:none;
      overflow:hidden;
      box-shadow:0 18px 50px rgba(0,0,0,.24), inset 0 0 38px rgba(0,255,204,.025);
      transition:transform .18s,border-color .18s,box-shadow .18s;
    }
    .public-nitro-card::before {
      content:'';
      position:absolute;
      inset:0 0 auto 0;
      height:2px;
      background:linear-gradient(90deg, transparent, var(--app-color), transparent);
      opacity:.85;
    }
    .public-nitro-card:hover {
      transform:translateY(-3px);
      border-color:color-mix(in srgb, var(--app-color) 68%, white 0%);
      box-shadow:0 20px 60px rgba(0,0,0,.36), 0 0 34px color-mix(in srgb, var(--app-color) 22%, transparent);
    }
    .public-nitro-orb {
      width:58px;
      height:58px;
      flex:0 0 auto;
      display:grid;
      place-items:center;
      border-radius:18px;
      border:1px solid color-mix(in srgb, var(--app-color) 46%, transparent);
      background:rgba(255,255,255,.045);
      font-size:1.85rem;
      box-shadow:0 0 24px color-mix(in srgb, var(--app-color) 18%, transparent), inset 0 0 24px rgba(255,255,255,.035);
      animation:publicNitroOrb 2.8s ease-in-out infinite alternate;
      z-index:2;
    }
    @keyframes publicNitroOrb { to { transform:translateY(-3px) scale(1.04); filter:brightness(1.25); } }
    .public-nitro-meta { position:relative; z-index:2; min-width:0; }
    .public-nitro-status {
      font-family:var(--font-mono);
      font-size:8px;
      letter-spacing:.18em;
      color:var(--app-color);
      text-transform:uppercase;
      margin-bottom:var(--space-2);
    }
    .public-nitro-name {
      font-family:var(--font-display);
      font-size:var(--text-lg);
      font-weight:700;
      color:var(--c-text);
      margin-bottom:var(--space-2);
    }
    .public-nitro-desc {
      font-family:var(--font-mono);
      font-size:10px;
      line-height:1.65;
      letter-spacing:.05em;
      color:var(--c-text-muted);
    }
    .public-nitro-footer {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:var(--space-3);
      margin-top:var(--space-4);
      font-family:var(--font-mono);
      font-size:8px;
      letter-spacing:.14em;
      color:var(--c-text-faint);
      text-transform:uppercase;
    }
    .public-nitro-footer strong { color:var(--app-color); font-weight:700; }
    .public-nitro-fx {
      position:absolute;
      inset:-30%;
      background:
        repeating-linear-gradient(115deg, transparent 0 22px, color-mix(in srgb, var(--app-color) 11%, transparent) 23px 24px),
        radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--app-color) 14%, transparent), transparent 26%);
      opacity:.34;
      transform:rotate(-6deg);
      transition:opacity .18s, transform .28s;
      pointer-events:none;
    }
    .public-nitro-card:hover .public-nitro-fx { opacity:.66; transform:rotate(2deg) scale(1.04); }
    .public-nitro-card--clicker {
      background:
        radial-gradient(circle at 24% 22%, rgba(0,255,128,.20), transparent 32%),
        radial-gradient(circle at 78% 78%, rgba(255,61,242,.18), transparent 42%),
        rgba(9,13,24,.88);
    }
    .public-nitro-card--clicker .public-nitro-orb { border-radius:50%; }
    @media(max-width:700px){ .public-nitro-head { align-items:flex-start; flex-direction:column; } }
  `;
  document.head.appendChild(style);
}
