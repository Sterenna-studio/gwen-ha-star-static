# Nitro Clicker — Game Design

## Pitch

Petit clicker connecté au compte Nitro / Gwen Ha Star.

Le joueur charge un noyau énergétique, achète des upgrades, gagne de l'énergie passive, puis déclenche des prestiges pour obtenir des bonus permanents.

## Boucle principale

```txt
cliquer le noyau
→ gagner énergie
→ acheter upgrades
→ produire automatiquement
→ atteindre seuil prestige
→ reset avec bonus permanent
```

## Ressource

- Énergie : ressource principale.
- Prestige : bonus permanent.
- Total Energy : progression globale utilisée pour débloquer le prestige.

## Upgrades alpha

| Upgrade | Effet |
|---|---|
| Amplificateur de clic | +1 par clic |
| Noyau automatique | +0.35 énergie/seconde |
| Résonance Star | +3 clic et +0.5/s |
| Prisme Nitro | +10 clic et +2/s |

## Sauvegarde

L'app utilise :

1. Supabase `nitro_clicker_saves` si la table existe.
2. localStorage en fallback.

## Intégration Nitro

- Auth requise via `/shared/guards.js`.
- Profil lu via `/shared/profile.js`.
- Déploiement sous `/clicker/`.

## Futures idées

- Badges Star liés au prestige.
- Récompenses cosmétiques dans le cockpit.
- Mini événements journaliers.
- Classement hebdomadaire.
- Achievements.
- Ressources secondaires : fragments, data, étoiles.
