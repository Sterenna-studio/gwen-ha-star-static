# Brief Codex — future interface

Construire ensuite le questionnaire web à partir des sources éditoriales de ce dossier.

## Priorité

La **donnée est la source de vérité**. Ne pas hardcoder les 30 questions dans le HTML/JS.

Avant de construire l'UI, transformer `CONTENT_V0.md` en un fichier de données structuré (`questions.json` ou équivalent) en préservant exactement :

- le texte de chaque question ;
- les trois réponses A/B/C ;
- surtout la petite phrase incarnée associée à chaque réponse ;
- l'axe de scoring ;
- les éventuels bonus humour ;
- les notes d'illustration.

## Scoring

- A = 2 points Carré.
- B = 1 point.
- C = 0 point.
- Calculer séparément les 5 axes : organisation, anticipation, maintenance, hygiène numérique, setup.
- Normaliser chaque axe sur 100.
- Le score Carré global est la moyenne des 5 axes pour qu'ils aient le même poids.
- Score Rond = `100 - score Carré`.
- Mapper ensuite le score global sur les profils de `RESULTS_V0.md`.

## Interface souhaitée plus tard

- une question à la fois ;
- responsive mobile-first ;
- navigation clavier et focus visibles ;
- possibilité de revenir à la question précédente ;
- afficher le comportement **et** la petite phrase pour chaque choix ;
- barre de progression ;
- écran final avec profil global + quelques sous-profils par axe ;
- bouton recommencer ;
- résultat partageable sans compte utilisateur obligatoire.

## Visuels

Prévoir la structure dès le départ, mais l'interface doit fonctionner sans aucune image.

Trois formats doivent rester possibles :

1. une illustration par question ;
2. une vignette par réponse ;
3. seulement une grande illustration au résultat.

Une future donnée d'image peut contenir au minimum :

```json
{
  "asset": null,
  "prompt_hint": "description courte du visuel"
}
```

Ne jamais afficher `prompt_hint` à l'utilisateur : c'est une métadonnée de production.

## Ton

Le test est humoristique, pas psychométrique. Ne jamais présenter Rond comme un échec ni Carré comme une réussite. Les réponses chaotiques doivent rester attachantes et crédibles.
