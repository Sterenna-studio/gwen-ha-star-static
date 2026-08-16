# Gamer Profile Test — V0.2 active

La V0.2 est désormais la version jouable de **Carré ou Rond ?** servie par `quiz/quizzes/gamer-profile-test/index.html` et publiée sous `https://nitro.sterenna.fr/quiz/`.

La V0.1 reste figée dans la branche Git `archive/gamer-profile-test-v0.1`. Les 30 questions de base restent générées depuis les sources historiques ; l'UI active leur ajoute les données de ce dossier V0.2 afin d'éviter de dupliquer le contenu.

## Flux V0.2

1. Avant le questionnaire : nom/pseudo, âge, sexe/genre inclusif et animaux de compagnie.
2. Nom, âge et sexe/genre sont descriptifs et ne modifient jamais le score.
3. `has_pets` peut activer automatiquement les `context_bonuses` déclarés dans `question-patches.json`.
4. Chaque réponse conserve **behavior + quote**.
5. Scoring principal : A = 0 point Rond, B = 1, C = 2.
6. 35 questions : score de base maximal 70 ; maximum effectif 72 avec les deux bonus contextuels.
7. Résultat principal : `{nom}, vous avez {points} points : vous êtes {niveau}.`
8. Le résultat détaille score de base, bonus appliqués et tendances par axe.

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
- Construction d’un village/base dans les jeux : planification propre ↔ extension organique ↔ chaos assumé.

## Fichiers V0.2

- `profile.json` : schéma du profil d'entrée.
- `questions-additions.json` : questions 31 à 35.
- `question-patches.json` : bonus contextuels automatiques sur les questions 3 et 18.
- `scoring.json` : barème et intervalles.
- `results.json` : profils de résultat V0.2.
