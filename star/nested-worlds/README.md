# Nested Worlds

Observatoire procédural local. Une seed crée toujours le même monde et, désormais, le même **système orbital**.

## Nested Loops comme générateur

La seed produit un arbre de boucles : une boucle principale devient une orbite planétaire ; ses sous-boucles deviennent des lunes ; une boucle fragmentée devient une ceinture d’astéroïdes. Rayon, vitesse, phase et poids sont donc des paramètres communs à la géométrie, au mouvement et à la narration du système.

```text
seed -> LoopTree -> SystemModel -> renderer
```

## Modules système

- `loop-tree-generator.js` : génère les boucles hiérarchiques déterministes.
- `system-generator.js` : convertit les boucles en étoile, planètes, lunes, anneaux et ceintures.
- `orbital-math.js` : fournit les positions dans le temps pour tout renderer.

Le renderer actuel reste une vue de planète. La prochaine étape est une scène WebGL/Three.js légère qui affichera le `SystemModel` sous forme de mini-planètes 3D, sans modifier le générateur.