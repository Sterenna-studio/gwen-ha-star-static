# Quiz Sterenna

Sous-projet autonome regroupé dans `gwen-ha-star-static/quiz`. Il réunit le hub, les modules jouables, leurs données sources et les outils qui régénèrent le catalogue.

## Emplacement canonique

- **URL publique unique** : `https://nitro.sterenna.fr/quiz/`
- **Dossier du dépôt** : `gwen-ha-star-static/quiz/`
- **Dossier local de référence** : `C:\DEV\repos\gwen-ha-star-static\quiz`

Tous les nouveaux quizz, leurs données, assets, scripts et documentations doivent être ajoutés sous ce dossier. Les anciens emplacements (`/quizz/`, `lab.sterenna.fr/quiz/` ou dépôts/copies de migration) ne sont plus des destinations de publication.

## Modules

- **Carré ou Rond ? V0.2** : version jouable active, 35 questions, profil d’entrée, scoring en points Rond et bonus contextuels. La V0.1 reste archivée dans Git.
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

En développement local, le hub est alors accessible sous `/quiz/`. En production, ce même dossier est publié sous `https://nitro.sterenna.fr/quiz/`.

## Ajouter un quizz

1. Créer `quiz/quizzes/mon-quizz/index.html` depuis la racine du dépôt.
2. Ajouter `quiz/quizzes/mon-quizz/quiz.json` avec les champs `id`, `title`, `description`, `theme`, `date`, `order` et `status`.
3. Conserver les données et assets spécifiques dans `quiz/quizzes/mon-quizz/` ou, pour les données réellement partagées, dans `quiz/data/`.
4. Lancer `npm --prefix quiz run build:manifest` depuis la racine du dépôt.
5. Lancer `npm --prefix quiz run check` avant le commit.

Les données éditoriales doivent rester hors du HTML quand elles sont volumineuses ou partagées. Les fichiers générés restent versionnés pour permettre un déploiement statique simple.

## Déploiement

Le workflow principal de Gwen Ha Star déploie le dossier `quiz/` avec le reste du site vers `~/nitro/quiz/`. L'adresse publique canonique est donc :

`https://nitro.sterenna.fr/quiz/`

Les chemins internes restent relatifs à `quiz/` afin que le hub et les modules fonctionnent également en développement local. Aucun second déploiement des quizz n'est à maintenir ailleurs.

Voir [docs/MIGRATION.md](docs/MIGRATION.md) pour la provenance et les décisions de consolidation.
