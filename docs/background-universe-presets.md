# Background universe presets

Module : `/star/admin/background-universe-admin.js`

Ce module ajoute une zone `PRESETS D’UNIVERS` dans `/star/admin/background.html`.

Presets :

- `PATROUILLE ARMORICA`
- `TRAFIC CONTREBANDE`
- `TEMPÊTE DU CODE`
- `RUINES ORBITALES`
- `SET DÉFAUT`

Chaque carte propose :

- `APPLIQUER` : applique le preset aux contrôles visibles ;
- `APERÇU` : charge le preset dans l’iframe via un aperçu temporaire local ;
- `SAVE LIVE` : crée un backup puis sauvegarde le preset dans Supabase.

Chaque carte affiche aussi un indicateur :

- `IMPACT FAIBLE`
- `IMPACT MOYEN`
- `IMPACT FORT`

Le module est chargé par `/star/admin/background-advanced-admin.js`.
