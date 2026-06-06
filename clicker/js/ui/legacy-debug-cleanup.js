const LEGACY_DEBUG_KEYS = [
  'nitro-clicker.dev.enabled',
  'nitro-clicker.log',
];

function removeLegacyDebugOverlay() {
  for (const key of LEGACY_DEBUG_KEYS) localStorage.removeItem(key);
  document.getElementById('dev-log')?.remove();
  document.getElementById('dev-panel')?.remove();
  document.querySelectorAll('.dev-log, .dev-panel, .dev-log-toggle, .dev-panel-toggle').forEach(node => node.remove());
}

removeLegacyDebugOverlay();
setTimeout(removeLegacyDebugOverlay, 250);
setTimeout(removeLegacyDebugOverlay, 1000);
setInterval(removeLegacyDebugOverlay, 3000);

window.NitroLegacyDebugCleanup = { run: removeLegacyDebugOverlay };
