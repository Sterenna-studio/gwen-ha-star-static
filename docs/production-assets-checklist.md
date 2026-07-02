# Gwen Ha Star / Nitro — liste des éléments à produire

Document de production pour compléter le hub public, le background spatial, Chronicles FM et les outils admin.

## Légende priorité

- **P0** : utile immédiatement / débloquant
- **P1** : amélioration visible rapide
- **P2** : polish, lore, extensions

## Audio MP3 / OGG

Les sons doivent rester courts, légers et optionnels. Prévoir MP3 pour compatibilité et OGG/WebM si possible.

| Priorité | Élément | Format | Nom conseillé | Notes |
|---|---|---|---|---|
| P0 | Jingle court Chronicles FM | mp3 + ogg | audio/radio/chronicles-fm_jingle_01.mp3 | 3 à 7 s, identité station, pas trop fort. |
| P0 | Stinger “WEB RADIO · YOUTUBE” | mp3 + ogg | audio/radio/web-radio-youtube_stinger_01.mp3 | Transition avant lecteur / playlist. |
| P1 | Ambiance espace légère | mp3 loop + ogg | audio/ambience/space_hum_loop_90s.mp3 | Boucle 60 à 120 s, très discrète, volume bas. |
| P1 | Passage de vaisseau | mp3 + ogg | audio/sfx/ship_flyby_01.mp3 | Whoosh léger, utilisable pour preview/admin. |
| P1 | Crash / incident spatial | mp3 + ogg | audio/sfx/space_crash_01.mp3 | Impact court, à garder rare. |
| P1 | Satellite beep | mp3 + ogg | audio/sfx/satellite_beep_01.mp3 | Bip discret et rétro. |
| P1 | UI click / hover | mp3 + ogg | audio/ui/ui_click_01.mp3 | Son d’interface très court. |
| P1 | UI success / save | mp3 + ogg | audio/ui/ui_success_01.mp3 | Feedback sauvegarde admin. |
| P2 | Alerte “Tempête du Code” | mp3 + ogg | audio/lore/code_storm_alert_01.mp3 | Voix/signal dramatique, événement rare. |
| P2 | Pack voix radio | mp3 | audio/radio/voice_id_*.mp3 | IDs : “Chronicles FM”, “BZH Chronicles”, “live from Nitro”. |

## Visuels background spatial

Assets utiles pour enrichir ou remplacer progressivement le rendu canvas pur.

| Priorité | Élément | Format | Nom conseillé | Notes |
|---|---|---|---|---|
| P0 | Sprites astéroïdes | png/webp transparent | assets/space/asteroid_01.webp | 4 à 8 variantes, 256 px max. |
| P0 | Sprites petites planètes | png/webp transparent | assets/space/planet_01.webp | Anneaux, lunes, couleurs variables. |
| P1 | Sprites satellites | png/webp transparent | assets/space/satellite_01.webp | Style pixel/CRT léger. |
| P1 | Overlay nébuleuse | webp transparent | assets/space/nebula_cyan_green_01.webp | Grand voile léger, compatible fond sombre. |
| P1 | Sprite sheet explosion/crash | png/webp | assets/space/crash_spritesheet_01.webp | 8 à 12 frames, petite taille. |
| P1 | Traînées / particules | png transparent | assets/space/particle_trail_01.png | Optionnel si on sort du canvas pur. |
| P2 | Background “Ruines orbitales” | webp | assets/space/bg_ruines_orbitales.webp | Illustration lointaine, très subtile. |
| P2 | Background “Tempête du Code” | webp | assets/space/bg_tempete_du_code.webp | Effet glitch / fragments verts. |

## Vaisseaux

Les 4 familles historiques existent déjà en canvas : scout, freighter, needle, carrier. Produire des variantes visuelles ou JSON.

| Priorité | Élément | Format | Nom conseillé | Notes |
|---|---|---|---|---|
| P0 | Preview image Scout | png/webp transparent | assets/ships/scout_preview.webp | Pour docs/admin si besoin. |
| P0 | Preview image Freighter | png/webp transparent | assets/ships/freighter_preview.webp | Silhouette cargo. |
| P0 | Preview image Needle | png/webp transparent | assets/ships/needle_preview.webp | Silhouette fine et rapide. |
| P0 | Preview image Carrier | png/webp transparent | assets/ships/carrier_preview.webp | Grand vaisseau rare. |
| P1 | Variantes JSON BZH | json | data/ship-library-bzh.json | Dolmen Runner, Menhir Hauler, Armorica Carrier. |
| P1 | Pack “Contrebande” | json + png | data/ship-library-contrebande.json | Vaisseaux violets/rouges, rapides. |
| P2 | Pack “Tempête du Code” | json + png | data/ship-library-code-storm.json | Vaisseaux glitch, verts/rouges. |

## Presets / data / configuration

Éléments JSON à garder propres pour agents IA et restauration rapide.

| Priorité | Élément | Format | Nom conseillé | Notes |
|---|---|---|---|---|
| P0 | Preset safe recommandé | json | data/presets/background_safe.json | Valeur stable pour reset safe. |
| P0 | Presets univers publics | json | data/presets/background_universe_presets.json | Armorica, Contrebande, Code, Ruines. |
| P1 | Exemples shipLibrary | json | data/examples/ship_library_examples.json | Objets prêts à coller dans Supabase. |
| P1 | Exemples element config | json | data/examples/background_element_examples.json | stars, nebula, planets, asteroids, etc. |
| P2 | Matrice impact perf | json/md | docs/background-performance-matrix.md | Seuils faible / moyen / fort. |

## UI / textes / lore

Textes courts pour rendre le cockpit et l’accueil plus vivant.

| Priorité | Élément | Format | Nom conseillé | Notes |
|---|---|---|---|---|
| P0 | Microcopy admin background | md/json | docs/copy/background-admin-copy.md | Descriptions courtes des boutons et presets. |
| P1 | Descriptions presets publics | md/json | docs/copy/background-presets-copy.md | Pitch lore pour chaque preset. |
| P1 | Messages radio Chronicles FM | txt/json | data/radio/station_messages.json | Messages ticker / station IDs. |
| P1 | Erreurs / succès admin | json | data/copy/admin-feedback.json | Backup créé, restore OK, reset safe, etc. |
| P2 | Lore court des vaisseaux | md/json | docs/lore/ships.md | 1 paragraphe par famille/variante. |

## Images sociales / metadata

Assets pour partage et cohérence publique.

| Priorité | Élément | Format | Nom conseillé | Notes |
|---|---|---|---|---|
| P0 | Open Graph accueil | webp/png | assets/social/og-gwen-ha-star.webp | 1200×630, lisible. |
| P1 | Open Graph Chronicles FM | webp/png | assets/social/og-chronicles-fm.webp | Version radio. |
| P1 | Miniature presets universe | webp | assets/social/bg-presets-preview.webp | Comparatif 4 presets. |
| P2 | Bannière docs/admin | webp | assets/social/background-admin-banner.webp | Pour doc interne/README. |

## Tests et validation

Fichiers/checklists pour éviter les régressions visuelles.

| Priorité | Élément | Format | Nom conseillé | Notes |
|---|---|---|---|---|
| P0 | Checklist test admin | md | docs/qa/background-admin-test.md | Tester backup, restore, reset, preview, save live. |
| P0 | Checklist test accueil | md | docs/qa/background-public-test.md | Tester sélecteur public et mobile. |
| P1 | Captures de référence | png/webp | docs/qa/screenshots/*.webp | Accueil live/default/universe. |
| P1 | Budget perf mobile | md | docs/qa/mobile-performance-budget.md | Limiter canvas, particules, sons. |

## Convention de nommage recommandée

| Famille | Pattern | Exemple |
|---|---|---|
| Audio | audio/<famille>/<nom>_<variant>.<ext> | audio/sfx/ship_flyby_01.mp3 |
| Space assets | assets/space/<type>_<variant>.<ext> | assets/space/asteroid_03.webp |
| Ships | assets/ships/<shape>_<variant>.<ext> | assets/ships/carrier_armorica_01.webp |
| Presets | data/presets/<usage>.json | data/presets/background_universe_presets.json |
| Docs QA | docs/qa/<sujet>.md | docs/qa/background-public-test.md |

## Pack MVP à produire en premier

- 1 jingle Chronicles FM court.
- 1 stinger WEB RADIO · YOUTUBE.
- 1 loop ambiance espace discret.
- 4 previews vaisseaux : scout, freighter, needle, carrier.
- 4 sprites astéroïdes et 4 sprites planètes.
- 1 sprite satellite.
- 1 sprite sheet explosion/crash simple.
- 1 Open Graph accueil.
- 2 checklists QA : admin et accueil.

## Prompt court pour agent IA

```txt
Tu travailles sur Gwen Ha Star / Nitro. Produis une proposition d’assets pour le background spatial et Chronicles FM. Respecte les familles : audio MP3/OGG, visuels WEBP/PNG transparents, presets JSON, docs QA. Garde une priorité P0/P1/P2, propose des noms de fichiers propres, et évite les assets trop lourds pour mobile. Univers : BZH Chronicles, cyberpunk sombre, Bretagne cosmique, Minitel/CRT léger, station radio Chronicles FM.
```
