# Quiz Sterenna

Sous-projet autonome regroupé dans `gwen-ha-star-static/quiz`. Il réunit le hub, les modules jouables, leurs données sources et les outils qui régénèrent le catalogue.

## Modules

- **Carré ou Rond ?** : test de profil gamer, 30 questions et 5 axes équilibrés.
- **Live Data Quizz** : partie LoL générée depuis `data/players.json` et `data/questions-static.json`.
- **Mega Quizz LoL** : 10 questions tirées d'un pool consolidé de 216 entrées.
- **Datadock Stats** : association des joueurs à leurs statistiques, alimentée par la même base joueurs.

Le dossier vide historique `bzh-pw-lol-2` a été retiré. Chaque module publiable possède désormais un fichier `quiz.json`; `data/quizzes.json` est généré automatiquement à partir de ces métadonnées.

## Développement

Le projet ne nécessite aucune dépendance tierce. Depuis la racine de Gwen Ha Star :

```powershell
npm --prefix quiz run build:data
npm --prefix quiz run validate
npm --prefix quiz test
```

Pour tout reconstruire et contrôler en une commande :

```powershell
npm --prefix quiz run check
```

Servez ensuite la racine de Gwen Ha Star avec n'importe quel serveur HTTP statique. Exemple :

```powershell
python -m http.server 8080
```

## Ajouter un quizz

1. Créer `quizzes/mon-quizz/index.html`.
2. Ajouter `quizzes/mon-quizz/quiz.json` avec les champs `id`, `title`, `description`, `theme`, `date`, `order` et `status`.
3. Lancer `npm --prefix quiz run build:manifest` depuis la racine du dépôt.
4. Lancer `npm --prefix quiz run check` avant le commit.

Les données éditoriales doivent rester hors du HTML quand elles sont volumineuses ou partagées. Les fichiers générés restent versionnés pour permettre un déploiement statique simple.

## Déploiement

Gwen Ha Star publie ce sous-projet à l'adresse `/quiz/`. Tous les chemins restent relatifs à ce dossier afin que le hub et les modules soient servis par le même déploiement statique.

Voir [docs/MIGRATION.md](docs/MIGRATION.md) pour la provenance et les décisions de consolidation.
