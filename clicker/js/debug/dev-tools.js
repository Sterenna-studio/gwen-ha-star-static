// Legacy debug proxy disabled.
// Use /clicker/debug.html only for standalone rescue/migration tools.

localStorage.removeItem('nitro-clicker.dev.enabled');
localStorage.removeItem('nitro-clicker.log');
document.getElementById('dev-log')?.remove();
document.getElementById('dev-panel')?.remove();
