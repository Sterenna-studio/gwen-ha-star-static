# Sources LoL consolidées

Les fichiers de ce dossier sont les entrées éditoriales brutes utilisées par `scripts/build-lol-pool.mjs`.

- `gwen-pool.json` : pool précédemment publié dans `gwen-ha-star-static/quizz`.
- `advanced-pool-v1.json`, `advanced-pool-v2.json`, `stats-v1.json`, `stats-v2.json` : imports depuis `Sterenna-studio/bzh-universe`, commit `cfeff0bfe2c3e140517f807befbba130eb0b77d9`.

Le fichier publié `quizzes/bzh-pw-lol/questions.json` est généré. Les doublons exacts sont fusionnés par question, options et réponse ; les variantes portant sur des joueurs différents restent distinctes.
