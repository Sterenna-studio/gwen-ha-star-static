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

## Ordre de la home

Le hero `GWEN HA STAR` est une introduction non numérotée.

Les sections numérotées commencent ensuite dans cet ordre :

1. `// 01 · ACCÈS DIRECT` — Outils & Univers.
2. `// 02 · STREAM LIVE` — Twitch live.
3. `// 03 · CHAÎNE` — YouTube @mutenrock.
4. `// 04 · JUKEBOX` — Jukebox Dr.Spig.
5. `// 05 · WEB RADIO LIVE` — Web Radio / playlists YouTube.
6. `// 06 · CHRONICLES FM` — Présentation radio pirate.

## À ne pas réactiver sans décision

- La grille auto `Apps Nitro` sur la home publique.
- Le vieux trio `main.js`, `radar.js`, `data.js` en runtime public.
