// Legacy compatibility shim.
// Older published home variants may still request /js/home-sections-runtime.js.
// The actual grouped layout now lives in /css/home-sections.css, imported by /css/home.css.

(function ensureHomeSectionsCss() {
  if (document.getElementById('home-sections-css')) return;

  const alreadyLoaded = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(link => String(link.href || '').includes('/css/home-sections.css'));
  if (alreadyLoaded) return;

  const link = document.createElement('link');
  link.id = 'home-sections-css';
  link.rel = 'stylesheet';
  link.href = '/css/home-sections.css?v=20260704-compat';
  document.head.appendChild(link);
})();
