# Background admin summary

Console : `/star/admin/background.html`

Consoles cockpit Star :

- `/star/admin/hero-cards.html` : audit visuel des hero cards injectées depuis `shared/nitro-apps.js`, avec export JSON du registre.
- `/star/admin/cockpit-background.html` : aperçu du background seul de `/star/index.html`, réglage des variables CSS, sauvegarde locale et export/import JSON.

Modules :

- `/star/admin/background-admin.js`
- `/star/admin/background-elements-admin.js`
- `/star/admin/background-advanced-admin.js`
- `/js/space-preset-switcher.js`
- `/js/space-custom-preview.js`
- `/js/space-ships-library-overlay.js`

Fonctions admin :

- sliders d'ambiance ;
- bibliothèque de vaisseaux avec preview ;
- éléments rapides : étoiles, nébuleuse, planètes, astéroïdes, satellites, crashs, shake, trafic, vitesse ;
- presets admin : calme, vivant, tempête, minimal ;
- aperçu live dans iframe ;
- aperçu non sauvegardé ;
- backup persistant ;
- export JSON portable ;
- restore dernier backup ;
- reset safe avec backup préalable.

Presets publics accueil :

- LIVE ADMIN ;
- DÉFAUT ;
- PATROUILLE ARMORICA ;
- TRAFIC CONTREBANDE ;
- TEMPÊTE DU CODE ;
- RUINES ORBITALES.

Backups : voir migration `20260702024500_space_background_config_backups.sql` dans `Sterenna-studio/chronicles-tcg`.

Guide complet : `/docs/space-background-ships.md`.
