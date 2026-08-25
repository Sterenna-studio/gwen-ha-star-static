# Nested Worlds

Observatoire procédural local : une seed crée un système orbital reproductible et rendu en mini-planètes 3D.

## Nested Loops

Chaque objet est une conséquence d’une boucle hiérarchique, pas un décor ajouté après coup.

```text
seed -> LoopTree -> SystemModel -> System3DRenderer
```

Une boucle porte désormais : `radius`, `frequency`, `phase`, `amplitude`, `tilt`, `eccentricity`, `wobble`, `subdivisions`, `resonance` et `children`.

- Boucle mère : planète et orbite principale.
- Boucle enfant : lune ou sous-orbite.
- Subdivisions : harmoniques et fragmentation.
- Amplitude + tilt : déplacement sur les trois axes.
- Eccentricity + wobble : orbite non circulaire et perturbée.
- Fragments : ceinture d’astéroïdes.
- Résonance : base pour des événements futurs, éclipses et anomalies.

Les positions combinent révolution, harmoniques de boucle et oscillation verticale, tout en restant déterministes par seed.