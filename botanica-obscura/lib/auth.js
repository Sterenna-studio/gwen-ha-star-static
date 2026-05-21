/**
 * lib/auth.js — Authentification Supabase pour Botanica Obscura
 * Session partagée avec Gwen Ha Star (nitro.sterenna.fr).
 * Si l'utilisateur n'est pas connecté → pop-up modale bloquante.
 */

import { supabase, restoreStarSession } from './supabaseClient.js';

let _user     = null;
let _session  = null;
let _ready    = false;
let _readyCallbacks = [];

// ── Écoute des changements de session ─────────────────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  _session = session;
  _user    = session?.user ?? null;

  if (_user) {
    _removeAuthWall();
    await _ensureBotanicaPlayerData(_user.id);
    _updateUI(true);
  } else {
    _updateUI(false);
  }

  if (!_ready) {
    _ready = true;
    _readyCallbacks.forEach(cb => cb(_user));
    _readyCallbacks = [];
  }
});

// ── Init : restaure la session Star puis vérifie ───────────────────────────
// À appeler UNE seule fois en tout début d'app.js / profil.js / leaderboard.js
export async function initAuth() {
  await restoreStarSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) _showAuthWall();
}

// ── Pop-up bloquante ──────────────────────────────────────────────────────
function _showAuthWall() {
  if (document.getElementById('botanica-auth-wall')) return;

  const overlay = document.createElement('div');
  overlay.id = 'botanica-auth-wall';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:rgba(5,15,5,0.97)',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'gap:1.4rem', 'font-family:var(--font-mono,monospace)',
    'backdrop-filter:blur(6px)',
  ].join(';');

  overlay.innerHTML = `
    <div style="font-size:3.5rem;animation:float 3s ease-in-out infinite">🌿</div>
    <div style="font-size:1.3rem;font-family:serif;color:#f0d080;letter-spacing:.05em">
      Botanica Obscura
    </div>
    <div style="
      background:rgba(0,20,0,.8);border:1px solid rgba(74,158,63,.35);
      border-radius:14px;padding:2rem 2.5rem;text-align:center;max-width:380px;
    ">
      <div style="font-size:2rem;margin-bottom:.8rem">🔒</div>
      <p style="font-size:.8rem;line-height:1.8;color:rgba(168,230,168,.75);
                letter-spacing:.05em;margin-bottom:1.4rem">
        Une session <strong style="color:#a8e6a8">Gwen Ha Star</strong> est requise<br>
        pour jouer à Botanica Obscura.
      </p>
      <a href="/login.html"
         style="
           display:inline-block;background:#2e7d32;color:#a8e6a8;
           border:1px solid rgba(74,158,63,.6);border-radius:30px;
           padding:10px 28px;font-size:.75rem;letter-spacing:.12em;
           text-decoration:none;transition:box-shadow .2s;
         "
         onmouseover="this.style.boxShadow='0 0 20px rgba(74,158,63,.5)'"
         onmouseout="this.style.boxShadow='none'"
      >🔑 SE CONNECTER</a>
      <div style="margin-top:1rem;font-size:.65rem;color:rgba(168,230,168,.3);
                  letter-spacing:.1em">
        Redirection vers nitro.sterenna.fr/login.html
      </div>
    </div>
    <style>
      @keyframes float {
        0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)}
      }
    </style>
  `;

  // Empêche tout scroll/interaction derrière
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
}

function _removeAuthWall() {
  const wall = document.getElementById('botanica-auth-wall');
  if (wall) { wall.remove(); document.body.style.overflow = ''; }
}

// ── Garantit l'existence d'une ligne botanica_player_data ─────────────────
async function _ensureBotanicaPlayerData(userId) {
  const { error } = await supabase
    .from('botanica_player_data')
    .upsert(
      { user_id: userId, last_active: new Date().toISOString() },
      { onConflict: 'user_id', ignoreDuplicates: false }
    );
  if (error) console.warn('[auth] botanica_player_data upsert:', error.message);
}

// ── Mise à jour UI header ─────────────────────────────────────────────────
function _updateUI(loggedIn) {
  const authZone  = document.getElementById('authZone');
  const userBadge = document.getElementById('userBadge');
  const loginBtn  = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (!authZone) return;

  if (loggedIn) {
    const meta   = _user.user_metadata;
    const name   = meta?.username ?? meta?.full_name ?? _user.email?.split('@')[0] ?? 'Botaniste';
    const avatar = meta?.avatar_url;
    userBadge.innerHTML = `
      ${avatar
        ? `<img src="${avatar}" class="auth-avatar" alt="avatar" />`
        : '<span class="auth-avatar-placeholder">🌿</span>'
      }
      <span class="auth-username">${name}</span>
    `;
    userBadge.style.display = 'flex';
    loginBtn.style.display  = 'none';
    logoutBtn.style.display = 'inline-flex';
  } else {
    userBadge.style.display  = 'none';
    loginBtn.style.display   = 'inline-flex';
    logoutBtn.style.display  = 'none';
  }
}

// ── Modal login interne (conservé pour compat, redirige vers /login.html) ──
export function openAuthModal()  { window.location.href = '/login.html'; }
export function closeAuthModal() {}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}

// ── API publique ──────────────────────────────────────────────────────────
export function currentUser()    { return _user; }
export function currentSession() { return _session; }
export function isLoggedIn()     { return !!_user; }

export function onAuthReady(cb) {
  if (_ready) cb(_user);
  else _readyCallbacks.push(cb);
}

// Plus de fallback anon — l'auth est obligatoire
export function getBotanicaUserId() {
  return _user?.id ?? null;
}
