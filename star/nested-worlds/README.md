# Nested Worlds

Générateur de planètes procédurales, issu de l’axe visuel de `nested-loops` : les cycles deviennent surface, atmosphère et phénomènes orbitaux.

## Architecture

```text
assets/css/main.css        interface
src/app.js                 orchestration et événements
src/core/planet-generator  seed -> données déterministes
src/render/planet-renderer rendu Canvas isolé
```

Aucun CSS ou JavaScript applicatif n’est inline. Le générateur est indépendant du DOM et le renderer ne décide pas des règles de jeu.

## Contrat

Une seed produit `type`, `palette`, `bands`, `moons`, `rings`, `rotation`, `phase` et une fenêtre de biosignal. La même URL `?seed=` doit produire le même monde.

## Roadmap

- Déplacer familles, espèces et anomalies dans `src/data/`.
- Créer un moteur de découverte dans `src/core/`.
- Ajouter couches scanner/thermique sous `src/render/layers/`.
- Créer un repository de codex local, puis un adaptateur Supabase.
- Ajouter captures, audio et atlas communautaire.
