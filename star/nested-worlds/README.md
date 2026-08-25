# Nested Worlds

Observatoire de planètes procédurales statique : une seed construit toujours le même monde. Le projet ne dépend ni de Supabase, ni d’API, ni de compte.

## Systèmes

```text
src/core/planet-generator.js  seed -> données de planète
src/core/discovery-engine.js  conditions -> découverte
src/data/content.js           biomes, espèces, anomalies
src/render/planet-renderer.js Canvas isolé
src/storage/codex-repository  codex localStorage
src/app.js                    orchestration
```

## Découverte

Le moteur analyse le type de monde et la température. Chaque famille possède actuellement une espèce avec une plage climatique. Les anneaux ou plusieurs lunes peuvent aussi révéler une anomalie. Une découverte reçoit un identifiant déterministe (`seed:type:contenu`) puis est enregistrée une seule fois dans le codex local.

## Principes

- La seed reste la source de vérité du monde.
- Les données éditoriales sont séparées du renderer.
- Le moteur de règles ne touche pas au DOM ni au Canvas.
- `localStorage` conserve les découvertes sans infrastructure.

## Suite

Ajouter plusieurs espèces par biome, un vrai écran Codex, des couches de rendu spécifiques à chaque famille, puis export d’une fiche ou capture PNG.