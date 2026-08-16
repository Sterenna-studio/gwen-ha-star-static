# Consolidation des quizz

## Source canonique

`C:\DEV\repos\gwen-ha-star-static\quiz` est la source unique de développement et de déploiement. Le dépôt local `C:\DEV\repos\quizz`, créé pendant la consolidation, reste uniquement une copie de migration récupérable et n'est pas canonique.

## Sources fusionnées

- l'ancien `gwen-ha-star-static/quizz` : hub statique, Mega Quizz, Datadock et Gamer Profile.
- `bzh-universe`, commit `cfeff0bfe2c3e140517f807befbba130eb0b77d9` : quatre pools LoL bruts conservés sous `sources/lol-team-stats/`.
- `https://lab.sterenna.fr/quiz/` consulté le 16 août 2026 : métadonnées du Live Quiz, base joueurs et questions de lore publiques.
- `archives/sterenna-old-dev/.../sterenna-quiz-hub` : ancienne copie, désormais remplacée par le dossier canonique intégré.

## Données

- `quiz.json` est la source de vérité des métadonnées d'un module.
- `scripts/generate-manifest.mjs` produit `data/quizzes.json`.
- `scripts/build-lol-pool.mjs` fusionne les pools LoL par signature complète et garde la provenance dans `sources`.
- `data/players.json` alimente Live Data Quizz et Datadock Stats afin d'éviter deux copies divergentes des statistiques.
- Gamer Profile conserve ses Markdown éditoriaux et génère ses JSON structurés avec `build-data.mjs`.

## Intégration Gwen Ha Star

Gwen Ha Star possède le code, les données et le déploiement des quizz dans un seul dossier `quiz/`. Sa page d'accueil pointe vers `/quiz/`; aucun dépôt externe n'est nécessaire pour publier ou faire évoluer la plateforme.
