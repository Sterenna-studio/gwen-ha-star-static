# Nested Worlds

Observatoire procédural local : une seed crée un système orbital reproductible et rendu en mini-planètes 3D.

## Nested Loops

Chaque objet est une conséquence d’une boucle hiérarchique, pas un décor ajouté après coup.

```text
seed -> LoopTree -> SystemModel -> System3DRenderer
                                 -> System2DPlan
```

Le même `SystemModel` alimente aussi un plan orbital 2D simplifié (`System2DPlan`), affiché sur le flanc en complément de la génération 3D réelle au centre. Il reprend la logique de projection à la Nested Loops (`rotate3` + division perspective sur l'axe de profondeur) plutôt qu'une simple vue de dessus : chaque orbite garde son inclinaison (`orbit.tilt`) et le plan entier est observé sous un angle oblique fixe, donc rien n'est aplati dans un seul plan XY.

Une boucle porte désormais : `radius`, `frequency`, `phase`, `amplitude`, `tilt`, `eccentricity`, `wobble`, `subdivisions`, `resonance` et `children`.

- Boucle mère : planète et orbite principale.
- Boucle enfant : lune ou sous-orbite.
- Subdivisions : harmoniques et fragmentation.
- Amplitude + tilt : déplacement sur les trois axes.
- Eccentricity + wobble : orbite non circulaire et perturbée.
- Fragments : ceinture d’astéroïdes.
- Résonance : base pour des événements futurs, éclipses et anomalies.

Les positions combinent révolution, harmoniques de boucle et oscillation verticale, tout en restant déterministes par seed.