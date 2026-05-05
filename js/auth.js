/**
 * auth.js — Gère l'état de connexion dans le header.
 *
 * Comportement :
 *  - Non connecté  → bouton [CONNEXION]
 *  - Connecté      → badge CONNECTÉ (vert) + bouton [MON ESPACE / CIG] + bouton [DÉCO]
 */

import { getSession, onAuthChange, signOut } from './supabase.js';

const AUTH_CONTAINER = 'header-auth';
const CIG_URL        = '/cig.html';

// ── RENDER ────────────────────────────────────────────────────────────────
function renderGuest() {
  const el = document.getElementById(AUTH_CONTAINER);
  if (!el) return;
  el.innerHTML = `
    <a href="/login.html" class="btn-auth btn-auth-login" aria-label="Se connecter">
      ⬡ CONNEXION
    </a>
  `;
}

function renderUser(session) {
  const el = document.getElementById(AUTH_CONTAINER);
  if (!el) return;

  const user  = session.user;
  const email = user.email ?? '';
  const label = user.user_metadata?.username
             ?? user.user_metadata?.name
             ?? email.split('@')[0].toUpperCase();

  el.innerHTML = `
    <div class="auth-connected">
      <span class="auth-badge" title="Connecté en tant que ${email}">
        <span class="auth-dot" aria-hidden="true"></span>
        <span class="auth-label">${label}</span>
      </span>
      <a href="${CIG_URL}" class="btn-auth btn-auth-cig" aria-label="Mon espace CIG">
        ⬡ MON ESPACE
      </a>
      <button class="btn-auth btn-auth-signout" id="btn-signout"
              aria-label="Se déconnecter">
        ✕
      </button>
    </div>
  `;

  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await signOut();
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────
export async function initAuth() {
  const session = await getSession();
  session ? renderUser(session) : renderGuest();

  // Écoute les changements en temps réel (login depuis un autre onglet, expiration...)
  onAuthChange((newSession) => {
    newSession ? renderUser(newSession) : renderGuest();
  });
}
