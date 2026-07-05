# Home publique v3.0

La home publique officielle est désormais la version modulaire actuelle.

## Version active

```txt
/index.html
/css/home.css
/js/home.js
/js/space-background.js
/js/chronicles-fm-widget.js
```

## Règles retenues

- `Outils & Univers` reste le menu éditorial principal de l'accueil public.
- `shared/nitro-apps.js` reste le registre technique central des apps Nitro.
- `js/hub/nitro-public-renderer.js` est conservé mais non activé sur la home publique pour éviter les doublons avec `Outils & Univers`.
- Les anciens fichiers `js/main.js`, `js/radar.js`, `js/data.js` ont été archivés dans `/archive/legacy-home/`.
- La console `HUB VERSION` reste réservée aux superusers Supabase.
- Le background public reste piloté par la config admin Supabase `space_background_config` avec `id = 'home'`.

## Sections visibles

1. Hero Gwen Ha Star.
2. Outils & Univers.
3. Twitch live.
4. Jukebox Dr.Spig.
5. Web Radio Live / playlists YouTube.
6. Chronicles FM / présentation radio pirate.
7. YouTube @mutenrock.

## À ne pas réactiver sans décision

- La grille auto `Apps Nitro` sur la home publique.
- Le vieux trio `main.js`, `radar.js`, `data.js` en runtime public.
