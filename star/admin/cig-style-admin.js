/**
 * cig-style-admin.js — Admin page pour le style de la carte CIG
 * Persistance via Supabase site_settings key='cig_style'
 * Localisé dans star/admin/ · Gwen Ha Star
 */
import { supabase, getSession, signOut } from '../../js/supabase.js';

// ── DEFAULT STYLE ──────────────────────────────────────────────
const DEFAULT_STYLE = {
  accent:          '#3ecfcf',
  accent2:         '#f9ca24',
  border:          'rgba(62,207,207,.35)',
  cardBg:          'linear-gradient(135deg, rgba(62,207,207,.08) 0%, rgba(16,20,26,1) 50%, rgba(249,202,36,.06) 100%)',
  glow:            '0 0 40px rgba(62,207,207,.10), inset 0 1px 0 rgba(255,255,255,.04)',
  scannerOpacity:  '0.25',
  scannerSpeed:    '5',
  avatarRadius:    '18',
  cardRadius:      '24',
  pseudoSize:      '1.4',
  titleSize:       '10',
  monoTracking:    '0.14',
};

const FIELDS = Object.keys(DEFAULT_STYLE);

// Champs à afficher en valeur numérique live
const RANGE_FIELDS = ['scannerOpacity','scannerSpeed','avatarRadius','cardRadius','pseudoSize','titleSize','monoTracking'];

const $  = id => document.getElementById(id);

function setStatus(msg, type) {
  const el = $('style-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'save-status ' + type;
  setTimeout(() => { el.className = 'save-status'; }, 2800);
}

function readForm() {
  const out = {};
  for (const key of FIELDS) {
    const el = $(key);
    out[key] = el ? el.value : DEFAULT_STYLE[key];
  }
  return out;
}

function fillForm(data) {
  for (const key of FIELDS) {
    const el = $(key);
    if (el) el.value = data[key] ?? DEFAULT_STYLE[key];
  }
  updateRangeLabels(data);
}

function updateRangeLabels(data) {
  for (const key of RANGE_FIELDS) {
    const lbl = $(`${key}-val`);
    if (lbl) lbl.textContent = data[key] ?? DEFAULT_STYLE[key];
  }
}

function applyStyleVars(style) {
  const r = document.documentElement;
  r.style.setProperty('--cig-accent',          style.accent);
  r.style.setProperty('--cig-accent-2',         style.accent2);
  r.style.setProperty('--cig-border',           style.border);
  r.style.setProperty('--cig-card-bg',          style.cardBg);
  r.style.setProperty('--cig-glow',             style.glow);
  r.style.setProperty('--cig-scanner-opacity',  style.scannerOpacity);
  r.style.setProperty('--cig-scanner-speed',    `${style.scannerSpeed}s`);
  r.style.setProperty('--cig-avatar-radius',    `${style.avatarRadius}px`);
  r.style.setProperty('--cig-card-radius',      `${style.cardRadius}px`);
  r.style.setProperty('--cig-pseudo-size',      `${style.pseudoSize}rem`);
  r.style.setProperty('--cig-title-size',       `${style.titleSize}px`);
  r.style.setProperty('--cig-mono-tracking',    `${style.monoTracking}em`);
}

async function loadStyle() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'cig_style')
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_STYLE, ...(data?.value ?? {}) };
}

async function saveStyle(style) {
  const { error } = await supabase
    .from('site_settings')
    .upsert(
      { key: 'cig_style', value: style, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) throw error;
}

function injectHeaderAuth(user, profile) {
  const authZone = $('header-auth');
  if (!authZone) return;
  const username = profile?.username ?? user.email?.split('@')[0] ?? 'AGENT';
  authZone.innerHTML = `
    <div class="auth-connected">
      <span class="auth-badge" title="${user.email}">
        <span class="auth-dot"></span>
        <span class="auth-label">${username.toUpperCase()}</span>
      </span>
      <button class="btn-auth btn-auth-signout" id="hdr-logout" aria-label="Déconnexion">✕</button>
    </div>`;
  $('hdr-logout')?.addEventListener('click', () => signOut());
}

async function init() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/login.html';
    return;
  }

  let current = { ...DEFAULT_STYLE };
  try {
    current = await loadStyle();
  } catch (e) {
    console.error('CIG style load:', e);
  }

  fillForm(current);
  applyStyleVars(current);

  // ── Live preview on input ──────────────────────────────────
  FIELDS.forEach(key => {
    const el = $(key);
    if (!el) return;
    el.addEventListener('input', () => {
      const style = readForm();
      updateRangeLabels(style);
      applyStyleVars(style);
    });
  });

  // ── Save ──────────────────────────────────────────────────
  $('btn-save-style')?.addEventListener('click', async () => {
    const style = readForm();
    const btn = $('btn-save-style');
    btn.disabled = true;
    try {
      await saveStyle(style);
      setStatus('✓ STYLE SAUVEGARDÉ', 'ok');
    } catch (e) {
      console.error(e);
      setStatus('⚠ ' + (e.message ?? 'Erreur sauvegarde'), 'err');
    } finally {
      btn.disabled = false;
    }
  });

  // ── Reset ────────────────────────────────────────────────
  $('btn-reset-style')?.addEventListener('click', () => {
    fillForm(DEFAULT_STYLE);
    applyStyleVars(DEFAULT_STYLE);
    setStatus('✓ RESET', 'ok');
  });

  // ── Header auth ──────────────────────────────────────────
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .maybeSingle();
    injectHeaderAuth(session.user, profile);
  } catch (_) { /* silent */ }
}

init();
