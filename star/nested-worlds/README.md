# Nested Worlds

Observatoire procédural local : une seed crée un système orbital reproductible et désormais rendu en mini-planètes 3D.

## Pipeline

```text
seed -> LoopTree -> SystemModel -> System3DRenderer
```

Les boucles principales deviennent des orbites de planètes ; les sous-boucles deviennent des lunes ; les boucles fragmentées deviennent des ceintures d’astéroïdes. Rayon, phase, vitesse et poids restent communs au modèle et au mouvement.

## Rendu 3D

`src/render/system-3d-renderer.js` utilise Three.js chargé comme module ES afin de rendre une étoile, les orbites, sphères planétaires, lunes, anneaux et débris. Le générateur reste indépendant de Three.js : un autre renderer peut utiliser le même `SystemModel`.

Le Codex et les découvertes restent locaux (`localStorage`) ; aucune API ni backend n’est requis.