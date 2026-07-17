# Guidelines — travailler sur le système audio/radio

Ce document fixe des règles pour tout travail futur sur le système audio (Star Radio,
Chronicles FM, jukebox, voix Lemegeton). Il complète
[docs/audio-radio-system-audit.md](./audio-radio-system-audit.md) (issue
[#17](https://github.com/Sterenna-studio/gwen-ha-star-static/issues/17)), qui documente
l'état actuel et sa dette. L'audit explique *comment on en est arrivé là* : le système a
grossi par empilement, chaque fonctionnalité livrée comme un système autonome de plus
plutôt que comme une extension d'un socle commun. Ces règles servent à ne pas reproduire
ce schéma — que ce soit en corrigeant les points de l'issue #17 ou en ajoutant une
fonctionnalité audio complètement nouvelle.

## Règles

1. **Chercher avant de créer.** Avant d'ajouter un lecteur, une playlist ou une voix, vérifier
   s'il existe déjà un système qui fait à peu près ça (`RadioPlayer`, le widget Chronicles FM,
   `JukeboxPlayer`, `LemegetonVoice`) et l'étendre plutôt que d'en écrire un nouveau à côté.
   L'audit liste 3 implémentations jukebox et 3 implémentations voix qui viennent toutes de
   ne pas avoir fait cette vérification.
2. **Une donnée, un fichier.** Une playlist / config = un seul fichier JSON, référencé par
   tous ses consommateurs. Pas de copie par page « pour aller vite » (voir le cas
   `jukebox/chronicles-fm.json` vs `chronicles-fm/data.json` dans l'audit).
3. **Les prix/limites transactionnels vivent côté serveur.** Tout ce qui touche à une
   transaction Supabase (coût en Chronicles, longueur max d'un message, etc.) est défini
   une seule fois côté SQL ; le client va le lire, il ne le recopie jamais en dur dans le JS.
   (Voir le bug de prix de dédicace dans l'audit : deux valeurs en dur, une seule vraie.)
4. **Pas de secret admin côté client.** Contrôle admin = rôle superuser vérifié côté Supabase
   (`profiles.role`) ou Basic Auth serveur — jamais un mot de passe/hash codé en dur dans un
   fichier JS livré au client.
5. **Un seul son à la fois.** Avant de démarrer une lecture, vérifier/couper les autres
   lecteurs actifs sur la page. Tant qu'il n'y a pas de bus audio partagé (voir piste #1 de
   l'audit), tout nouveau composant audio doit au minimum exposer un moyen simple de le
   mettre en pause depuis l'extérieur.
6. **Patcher un composant existant = dernier recours.** Si un comportement doit être ajouté à
   un composant existant (ex. `RadioPlayer`), préférer modifier directement le fichier source
   ou ajouter un vrai paramètre de config plutôt qu'un nouveau fichier qui réécrit son
   prototype à l'import. Si un patch de prototype est vraiment nécessaire, documenter en
   commentaire, en tête du fichier de patch, l'ordre de chargement requis et pourquoi.
7. **Doc et code avancent ensemble.** Si une fonctionnalité audio est retirée ou remplacée
   (ex. un admin PHP), le README/doc qui la décrit est mis à jour ou supprimé dans le même
   commit — pas laissé pour plus tard.
8. **La voix passe par `js/lemegeton-voice.js`.** Toute nouvelle fonctionnalité vocale utilise
   la classe `LemegetonVoice` plutôt que de réimplémenter une file d'attente TTS/MP3 ad hoc.
   Si l'idée d'une voix Lemegeton est abandonnée, ce fichier est supprimé plutôt que laissé
   mort (voir issue #17, point 5).

## Checklist avant de merger une PR qui touche à l'audio

- [ ] Aucune nouvelle implémentation parallèle d'un système déjà existant (règle 1)
- [ ] Aucun JSON de playlist/config dupliqué (règle 2)
- [ ] Aucun prix/limite transactionnel recopié en dur côté client (règle 3)
- [ ] Aucun secret/mot de passe en dur (règle 4)
- [ ] Vérifié qu'aucun autre lecteur ne peut jouer en même temps sans le vouloir (règle 5)
- [ ] README/doc à jour si un comportement ou une architecture change (règle 7)

## Processus

Comme documenté dans [CONTRIBUTING.md](../CONTRIBUTING.md) : branche dédiée, commits clairs,
Pull Request vers `main`, review avant merge. Particulièrement vrai pour ce domaine vu l'état
documenté dans l'audit — pas de push direct sur `main` pour les correctifs de l'issue #17.
