/**
 * lib/authModal.js — Connexion déléguée à Gwen Ha Star (/login.html)
 * La modal inline est supprimée : le bouton Login redirige directement
 * vers la page d'authentification centrale de nitro.sterenna.fr.
 */
import { signOut, openAuthModal } from './auth.js';

export function initAuthModal() {
  // Bouton login header → redirige vers /login.html
  document.getElementById('loginBtn')
    ?.addEventListener('click', () => openAuthModal());

  // Bouton logout header
  document.getElementById('logoutBtn')
    ?.addEventListener('click', async () => { await signOut(); });
}
