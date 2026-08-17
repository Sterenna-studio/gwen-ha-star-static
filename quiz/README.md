# Quiz Sterenna

Sous-projet autonome regroupé dans `gwen-ha-star-static/quiz`. Il réunit le hub, les modules jouables, leurs données sources et les outils qui régénèrent le catalogue.

## Emplacement canonique

- **URL publique unique** : `https://nitro.sterenna.fr/quiz/`
- **Dossier du dépôt** : `gwen-ha-star-static/quiz/`
- **Dossier local de référence** : `C:\DEV\repos\gwen-ha-star-static\quiz`

Tous les nouveaux quizz, leurs données, assets, scripts et documentations doivent être ajoutés sous ce dossier. Les anciens emplacements (`/quizz/`, `lab.sterenna.fr/quiz/` ou dépôts/copies de migration) ne sont plus des destinations de publication.

## Modules

- **Carré ou Rond ? V0.1** : les 30 questions originales, un formulaire personnalisé, des réponses mélangées et un gradient de points Rond sur 62 incluant deux bonus animaux contextuels.
- **Live Data Quizz** : partie LoL générée depuis `data/players.json` et `data/questions-static.json`.
- **Mega Quizz LoL** : 10 questions tirées d'un pool consolidé de 216 entrées.
- **Datadock Stats** : association des joueurs à leurs statistiques, alimentée par la même base joueurs.

Le dossier vide historique `bzh-pw-lol-2` a été retiré. Chaque module publiable possède désormais un fichier `quiz.json`; `data/quizzes.json` est généré automatiquement à partir de ces métadonnées. Les modules qui utilisent une donnée partagée la déclarent dans `data_sources` : le hub peut ainsi regrouper automatiquement les quiz liés à `data/players.json`.

Le test Gamer Profile garde la V0.1 comme choix recommandé et rend la V0.2 étendue jouable depuis le même écran. Sa page finale produit une carte PNG partageable. Le pseudo et les scores sont enregistrés dans Supabase pour les statistiques globales, sans âge exact, genre ni liste d’animaux. Le tableau de bord `/quiz/admin/` est réservé aux superusers.

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
2. Ajouter `quiz/quizzes/mon-quizz/quiz.json` avec les champs `id`, `title`, `description`, `theme`, `date`, `order` et `status`. Ajouter `data_sources` si le module consomme un fichier partagé tel que `data/players.json`.
3. Conserver les données et assets spécifiques dans `quiz/quizzes/mon-quizz/` ou, pour les données réellement partagées, dans `quiz/data/`.
4. Lancer `npm --prefix quiz run build:manifest` depuis la racine du dépôt.
5. Lancer `npm --prefix quiz run check` avant le commit.

Les données éditoriales doivent rester hors du HTML quand elles sont volumineuses ou partagées. Les fichiers générés restent versionnés pour permettre un déploiement statique simple.

## Déploiement

Le workflow principal de Gwen Ha Star déploie le dossier `quiz/` avec le reste du site vers `~/nitro/quiz/`. L'adresse publique canonique est donc :

`https://nitro.sterenna.fr/quiz/`

Les chemins internes restent relatifs à `quiz/` afin que le hub et les modules fonctionnent également en développement local. Aucun second déploiement des quizz n'est à maintenir ailleurs.

Voir [docs/MIGRATION.md](docs/MIGRATION.md) pour la provenance et les décisions de consolidation.
