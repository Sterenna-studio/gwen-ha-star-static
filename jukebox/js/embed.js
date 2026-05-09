/* ═══════════════════════════════════════════════════════════════
   embed.js — Point d'entrée auto-init
   Ajouter dans n'importe quelle page :

     <div id="jukebox" data-jk-mode="widget" data-jk-base="/jukebox/"></div>
     <script type="module" src="/jukebox/js/embed.js"></script>

   Attributs data :
     data-jk-mode    : 'full' | 'widget' | 'mini'  (défaut: widget)
     data-jk-base    : chemin vers le dossier jukebox (défaut: /jukebox/)
     data-jk-autoplay: présence = autoPlay true
═══════════════════════════════════════════════════════════════ */

import { JukeboxPlayer } from './JukeboxPlayer.js';

document.querySelectorAll('[data-jk-mode], #jukebox, .jukebox-embed').forEach(el => {
  const jk = new JukeboxPlayer({
    container : el,
    basePath  : el.dataset.jkBase  || '/jukebox/',
    mode      : el.dataset.jkMode  || 'widget',
    autoPlay  : el.hasAttribute('data-jk-autoplay'),
    superKey  : 'bzhAdmin2025',
  });
  jk.mount();
  el._jukeboxPlayer = jk; // accès JS depuis l'extérieur
});
