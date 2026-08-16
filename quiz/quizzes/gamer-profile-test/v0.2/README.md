# Migration V0.2 — Gamer Profile Test

Cette V0.2 est volontairement déposée **à côté** de la version jouable actuelle afin de ne pas casser l’UI en production.

## Version d’origine

L’état actuel est figé dans la branche Git `archive/gamer-profile-test-v0.1`.

## Flux V0.2 souhaité

1. Avant le questionnaire, afficher : nom/pseudo, âge, sexe/genre inclusif, animal de compagnie oui/non (+ type facultatif).
2. Les champs nom, âge et sexe/genre sont purement descriptifs.
3. `has_pets` peut activer automatiquement les `context_bonuses` des questions concernées.
4. Chaque réponse garde impérativement **behavior + quote**.
5. Scoring principal : A = 0 point Rond, B = 1, C = 2.
6. Score de base maximal : 70 ; avec bonus contextuels actuels : 72.
7. Afficher le résultat principal sous la forme : `Pierre, vous avez 47 points : vous êtes Rond.`
8. Afficher ensuite score de base + bonus appliqués + détail des axes.

## Intervalles

- 0–14 : très Carré
- 15–28 : Carré
- 29–42 : Rond-Carré
- 43–56 : Rond
- 57–72 : très Rond

## Questions ajoutées

- Favoris / marque-pages du navigateur.
- Batterie du téléphone.
- Photos et état du Drive/cloud.
- Nombre/gestion des adresses mail.
- Construction d’un village/base dans les jeux : planification propre ↔ extension organique ↔ carottes placées au hasard.

## Compatibilité

La version active actuelle calcule encore un pourcentage Carré. Ne remplacer `questions.json`, `results.json` et `scoring.js` qu’au moment où l’UI V0.2 sait gérer les champs de profil et les points bruts.
