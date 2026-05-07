/**
 * theme.js — Gestion du cycle de thèmes sans FOUT.
 *
 * Usage : importer initTheme() dans chaque page.
 * Le script anti-FOUT inline dans <head> lit sessionStorage
 * et applique data-theme avant le premier paint.
 */

const THEMES = ['dark', 'violet', 'light'];
const ICONS  = { dark: '◐', violet: '✦', light: '○' };
const STORE_KEY = 'ghs-theme';

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  sessionStorage.setItem(STORE_KEY, theme);
  // Met à jour l'icône de tous les boutons toggle présents
  document.querySelectorAll('.theme-cycle-btn').forEach(btn => {
    btn.textContent = ICONS[theme] ?? '◐';
    btn.setAttribute('aria-label', `Thème actuel : ${theme}. Cliquer pour changer.`);
  });
}

function cycleTheme() {
  const current = getCurrentTheme();
  const idx     = THEMES.indexOf(current);
  const next    = THEMES[(idx + 1) % THEMES.length];
  applyTheme(next);
}

export function initTheme() {
  // Sync l'icône au thème déjà appliqué par le script head
  applyTheme(getCurrentTheme());

  // Câble tous les boutons toggle présents dans la page
  document.querySelectorAll('.theme-cycle-btn').forEach(btn => {
    btn.addEventListener('click', cycleTheme);
  });
}
