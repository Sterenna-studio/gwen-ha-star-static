/**
 * auth.js — Gère l'état de connexion dans le header.
 *
 * Comportement :
 *  - Non connecté  → bouton [CONNEXION]
 *  - Connecté      → badge CONNECTÉ (vert) + bouton [MON ESPACE / CIG] + bouton [DÉCO]
 *
 * La CIG (espace perso) est construite depuis l'email de l'utilisateur :
 *   https://nitro.sterenna.fr/cig/<user_id>
 * Adapte CIG_BASE_URL selon ton vrai domaine.
 */

import { getSession, onAuthChange, signOut } from './supabase.js';

const AUTH_CONTAINER = 'header-auth';
const CIG_BASE_URL   = 'https://nitro.sterenna.fr/cig'; // ← adapte si besoin

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

  const user      = session.user;
  const userId    = user.id;
  const email     = user.email ?? '';
  const label     = user.user_metadata?.username
                 ?? user.user_metadata?.name
                 ?? email.split('@')[0].toUpperCase();
  const cigUrl    = `${CIG_BASE_URL}/${userId}`;

  el.innerHTML = `
    <div class="auth-connected">
      <span class="auth-badge" title="Connecté en tant que ${email}">
        <span class="auth-dot" aria-hidden="true"></span>
        <span class="auth-label">${label}</span>
      </span>
      <a href="${cigUrl}" target="_blank" rel="noopener noreferrer"
         class="btn-auth btn-auth-cig" aria-label="Mon espace CIG">
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
    // signOut redirige vers /login.html — mais si tu veux rester sur la page :
    // renderGuest();
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
