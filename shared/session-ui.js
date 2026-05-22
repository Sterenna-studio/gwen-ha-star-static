// ── NITRO SHARED SESSION UI ─────────────────────────────────────────────────

import { getSession, onAuthChange, signOut } from './auth.js';
import { getDisplayNameFromUser } from './profile.js';

export async function mountSessionWidget(containerId = 'header-auth', options = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const {
    loginUrl = '/login.html',
    spaceUrl = '/star/',
    spaceLabel = '⬡ MON ESPACE',
  } = options;

  function renderGuest() {
    el.innerHTML = `
      <a href="${loginUrl}" class="btn-auth btn-auth-login" aria-label="Se connecter">
        ⬡ CONNEXION
      </a>
    `;
  }

  function renderUser(session) {
    const user = session.user;
    const email = user.email ?? '';
    const label = getDisplayNameFromUser(user);

    el.innerHTML = `
      <div class="auth-connected">
        <span class="auth-badge" title="Connecté en tant que ${email}">
          <span class="auth-dot" aria-hidden="true"></span>
          <span class="auth-label">${label}</span>
        </span>
        <a href="${spaceUrl}" class="btn-auth btn-auth-cig" aria-label="Mon espace Star">
          ${spaceLabel}
        </a>
        <button class="btn-auth btn-auth-signout" id="shared-signout" aria-label="Se déconnecter">
          ✕
        </button>
      </div>
    `;

    document.getElementById('shared-signout')?.addEventListener('click', async () => {
      await signOut(loginUrl);
    });
  }

  const session = await getSession();
  session ? renderUser(session) : renderGuest();

  onAuthChange((newSession) => {
    newSession ? renderUser(newSession) : renderGuest();
  });
}
