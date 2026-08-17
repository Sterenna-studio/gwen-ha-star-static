# Gamer Profile Test — V0.3

La V0.3 est une évolution **data-first** construite au-dessus de la V0.2 actuelle. Elle ne remplace ni la V0.1 originale ni la V0.2 étendue : elle devient une troisième version sélectionnable.

## Principes

- 40 questions au total.
- 8 questions par axe : organisation, anticipation, maintenance, hygiene_numerique, setup.
- 4 réponses par question.
- Échelle habituelle : `0 / 0.5 / 1 / 2` points Rond.
- Les réponses restent mélangées à l’affichage.
- Les 35 questions V0.2 sont conservées ; V0.3 ajoute une quatrième réponse via `answer-extensions.json`.
- 5 nouvelles questions sont ajoutées via `questions-additions.json`.
- Les bonus animaux V0.2 restent appliqués.
- Le résultat principal utilise des intervalles en points bruts et conserve les profils historiques.

## Fichiers

- `IDEA_AUDIT.md` : audit des idées proposées, doublons et futur pool.
- `scoring.json` : règles de score et équilibre des axes.
- `answer-extensions.json` : quatrième réponse des questions 1 à 35.
- `questions-additions.json` : questions 36 à 40.
- `results.json` : intervalles V0.3 sur 82 points maximum.

## Construction de la V0.3

1. Charger les 30 questions V0.1 depuis `../questions.json`.
2. Ajouter les 5 questions V0.2 depuis `../v0.2/questions-additions.json`.
3. Ajouter la quatrième réponse V0.3 aux questions 1–35 depuis `answer-extensions.json`.
4. Ajouter les questions 36–40 depuis `questions-additions.json`.
5. Appliquer les bonus contextuels depuis `../v0.2/question-patches.json`.
6. Utiliser `results.json` pour les intervalles du résultat global.

La V0.3 doit rester compatible avec le formulaire de profil, le mélange des réponses, la carte PNG partageable et l’enregistrement pseudonymisé des résultats déjà présents dans l’interface actuelle.
