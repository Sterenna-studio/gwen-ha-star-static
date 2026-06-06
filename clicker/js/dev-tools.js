// Legacy in-game debug overlay disabled.
// The standalone rescue tool remains available at /clicker/debug.html.

localStorage.removeItem('nitro-clicker.dev.enabled');
localStorage.removeItem('nitro-clicker.log');

function removeLegacyDebugPanels() {
  document.getElementById('dev-log')?.remove();
  document.getElementById('dev-panel')?.remove();
  document.querySelectorAll('.dev-log, .dev-panel').forEach(node => node.remove());
}

removeLegacyDebugPanels();
setTimeout(removeLegacyDebugPanels, 250);
setTimeout(removeLegacyDebugPanels, 1000);
