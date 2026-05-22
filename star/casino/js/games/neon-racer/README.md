# Neon Racer

## État

Playable alpha — currently wrapped from the legacy `../neon-racer.js` implementation.

## Règle

- Le joueur choisit un véhicule.
- Il choisit une mise via les cœurs : 1❤, 2❤, 3❤.
- Chaque cœur donne une vie.
- Le jeu alterne entre axe horizontal et axe vertical tous les 500m.
- Le gain dépend de la distance et du véhicule.

## Équilibrage actuel

- Jeu plus orienté skill que hasard.
- Mise fixe par nombre de cœurs : 50 / 100 / 200 C.
- Certains véhicules ont des bonus forts : combo, shield, gain.

## À améliorer

- Déplacer physiquement le code legacy dans ce dossier.
- Séparer véhicules, obstacles et SFX dans des fichiers dédiés.
- Harmoniser wallet/results avec les autres mini-jeux.
