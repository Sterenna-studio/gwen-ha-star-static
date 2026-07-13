# Audit du système radio / audio — Gwen Ha Star

Date : 2026-07-13. Périmètre : tout ce qui joue du son sur le site (hub, Star, Chronicles FM,
jukebox). Objectif : poser un état des lieux avant toute nouvelle fonctionnalité audio, parce
que le système actuel a grossi par empilement de patches successifs plutôt que par design.

Voir l'issue de suivi : [#17](https://github.com/Sterenna-studio/gwen-ha-star-static/issues/17).

## 1. Cartographie — 4 systèmes indépendants qui ne se parlent pas

Le site ne fait pas "un lecteur audio", il en fait quatre, avec quatre bases de code, quatre
formats de données et zéro coordination entre eux.

### 1.1 Star Radio (`RadioPlayer`)

- Classe `RadioPlayer` dans [js/star/widgets.js:193](../js/star/widgets.js#L193) (~770 lignes à elle seule).
  Gère 4 modes (`jukebox`, `stream`, `clock`, `dedication`), un scheduler "horloge serveur"
  qui simule un direct à partir de MP3 statiques (`_getClockPosition`), une visualisation
  Web Audio (canvas FFT), et un système de dédicaces payantes via Supabase RPC.
- Montée sur `#widget-radio` par [js/star/radio.js](../js/star/radio.js).
- **Patchée à chaud par 3 fichiers séparés**, chacun qui réécrit des méthodes du prototype :
  - [js/star/radio-player-gate.js](../js/star/radio-player-gate.js) — écran "rejoindre le flux",
    override de `render()`.
  - [js/star/radio-dedication-rules.js](../js/star/radio-dedication-rules.js) — override de
    `render()` et `_submitDedication()`, règles d'affichage du prix/longueur.
  - [js/star/radio-player-stabilizer.js](../js/star/radio-player-stabilizer.js) — override de
    `_syncClockTrack()`, `_play()`, `_fetchDedicationForSlot()` pour corriger une récursion.
  - Ordre de chargement critique et implicite : `radio-player-stabilizer.js` importe les deux
    autres en tête de fichier pour forcer l'ordre des patches. Rien n'empêche un futur import
    direct de `radio-player-gate.js` ailleurs, dans un ordre différent, qui romprait le
    patch stack silencieusement (aucune erreur, juste un comportement différent).
- Backend : `radio/live.json` (config statique), table `public.radio_dedications` +
  3 RPC Supabase dans [scripts/sql/002_radio_dedications.sql](../scripts/sql/002_radio_dedications.sql).

### 1.2 Chronicles FM (widget flottant `#cfm-bar`)

- [js/chronicles-fm-widget.js](../js/chronicles-fm-widget.js) (420 lignes, IIFE, aucun lien
  avec `RadioPlayer`) : lecteur YouTube iframe caché, playlists par "fréquence", ticker
  défilant, panneau "Lemegeton" avec phrases françaises codées en dur dans le fichier
  (`FREQ_PHRASES`, `AMBIENT_PHRASES`, `NIGHT_PHRASES`, `INTRO_PHRASES`).
- Chargé directement (pas de lazy load) sur **4 pages** : [star/index.html:212](../star/index.html#L212),
  [index.html](../index.html), [prod/index.html](../prod/index.html),
  [versions/background-presets/index.html](../versions/background-presets/index.html).
- [js/chronicles-fm-launcher.js](../js/chronicles-fm-launcher.js) est une variante *lazy-load*
  du même widget (import dynamique au clic) — utilisée sur d'autres pages que celles listées
  ci-dessus. Deux stratégies de chargement pour le même composant, non documentées, à
  choisir au cas par cas par copier-coller du bloc `<script>`.
- [js/chronicles-fm-star-skin.js](../js/chronicles-fm-star-skin.js) reskin le widget via un
  `MutationObserver` qui watch tout `document.documentElement` en continu pour injecter un
  bandeau custom dès que `#cfm-bar` apparaît — un observer global juste pour du CSS de marque.

### 1.3 Jukebox — 3 implémentations séparées du même lecteur vinyle

- [jukebox/js/JukeboxPlayer.js](../jukebox/js/JukeboxPlayer.js) — classe ES exportable
  (1288 lignes), pensée pour être embarquée ailleurs via
  [jukebox/js/embed.js](../jukebox/js/embed.js) (`data-jk-mode="widget"`).
- [jukebox/js/app.js](../jukebox/js/app.js) — 580 lignes de fonctions top-level
  (`loadTrack`, `playTrack`, `pauseTrack`, `renderShelf`...), **duplique** la logique de
  `JukeboxPlayer.js` pour faire tourner `jukebox/index.html` (version "vinyle rétro,
  manivelle à remonter", voir [jukebox/README.md](../jukebox/README.md)) sans jamais
  importer la classe ci-dessus.
- [star/jukebox-3d/js/app.js](../star/jukebox-3d/js/app.js) — encore 586 lignes séparées,
  troisième réimplémentation (projection 3D, drag vers la platine), sa propre copie de
  `records.json`.
- Résultat : un bug de lecture/format de piste corrigé dans une version ne l'est pas dans
  les deux autres. Le format `records.json` (`vinylStyle`, `coverColor`, `labelColor`,
  `durationSeconds`...) est donc dupliqué et doit rester synchronisé à la main entre
  [jukebox/records.json](../jukebox/records.json) et [star/jukebox-3d/records.json](../star/jukebox-3d/records.json).

### 1.4 Voix "Lemegeton" — 3 implémentations, la meilleure n'est branchée nulle part

- [js/lemegeton-voice.js](../js/lemegeton-voice.js) — classe `LemegetonVoice` propre : file
  d'attente, priorité MP3 (`manifest.json`) → Web Speech FR → texte seul, sélection de voix
  française masculine (`fr.find(v => /thomas|nicolas|pierre|male/i.test(v.name))`), volume/
  rate/pitch configurables, banque de phrases avec tags (`rave`, `bass`, `chill`, `rock`...).
  **Recherche confirmée : ce module n'est importé nulle part dans le reste du repo.** Code
  mort — probablement écrit en prévision d'une intégration jamais faite.
- [js/chronicles-fm-widget.js](../js/chronicles-fm-widget.js) réimplémente en interne une
  version plus pauvre : ses propres tableaux de phrases (contenu différent de `PHRASES` dans
  `lemegeton-voice.js`), sa propre fonction `playLemeAudio()`. Le tier "MP3" y est déclaré via
  `const AVAILABLE_LEME_AUDIO = new Set([])` (ligne 16) — **set vide**, donc `playLemeAudio()`
  retourne toujours tôt (`if (!AVAILABLE_LEME_AUDIO.has(filename) ...) return;`). Le panneau
  "Lemegeton" du widget n'a donc jamais produit un seul son depuis son introduction : c'est un
  texte qui défile avec un effet machine à écrire, rien de plus.
- `RadioPlayer._speakDedication()` dans [js/star/widgets.js:687](../js/star/widgets.js#L687)
  appelle `window.speechSynthesis` directement, sans passer par `LemegetonVoice` : pas de
  sélection de voix (prend la voix FR par défaut du navigateur, homme ou femme au hasard),
  pas de gestion de file d'attente propre, `rate`/`pitch` codés en dur (0.95 / 1) différents
  des valeurs de `LemegetonVoice` (0.82 / 0.88).
- [jukebox/lemegeton/manifest.json](../jukebox/lemegeton/manifest.json) confirme : `"_status":
  "vide — ajoute tes MP3 ici"`. La banque de voix pré-enregistrées n'existe pas encore, sur
  aucun des deux systèmes qui la référencent.

## 2. Constats concrets, par sévérité

### 🔴 Incohérence prix dédicace — l'utilisateur voit un prix, en paie un autre

- Le template HTML de base de `RadioPlayer.render()` affiche **"200 C"** en dur
  ([js/star/widgets.js:265](../js/star/widgets.js#L265)).
- [js/star/radio-dedication-rules.js:4](../js/star/radio-dedication-rules.js#L4) définit
  `DEDICATION_COST = 20` et réécrit le texte affiché en **"20 C"** au render.
- Le vrai coût côté serveur est **200** Chronicles, en dur dans le SQL :
  `v_cost integer := 200;` dans `submit_radio_dedication`
  ([scripts/sql/002_radio_dedications.sql:56](../scripts/sql/002_radio_dedications.sql#L56)),
  et `cost integer not null default 200` sur la table (ligne 10).
- Donc l'UI annonce 20 C, débite réellement 200 C. Même écart sur la longueur max : l'UI
  patchée limite à 100 caractères
  ([js/star/radio-dedication-rules.js:5](../js/star/radio-dedication-rules.js#L5)), le serveur
  accepte jusqu'à 160 (`char_length(v_message) ... > 160` dans le SQL, et
  `if (message.length > 160)` dans le fallback client non patché,
  [js/star/widgets.js:736](../js/star/widgets.js#L736)).
- **Impact** : un joueur peut se sentir arnaqué (prix annoncé × 10 par rapport au prix payé).
  C'est un bug de confiance, pas juste un détail visuel.

### 🔴 Clé admin client-side en dur, partagée par les deux jukebox

- `superKey: 'bzhAdmin2025'` codé en dur dans
  [jukebox/js/embed.js:22](../jukebox/js/embed.js#L22) et repris comme valeur par défaut dans
  [jukebox/js/JukeboxPlayer.js:27](../jukebox/js/JukeboxPlayer.js#L27)
  (`this.superKey = opts.superKey || 'bzhAdmin2025';`).
- Même mot de passe en dur, indépendamment, dans
  [jukebox/js/app.js:84](../jukebox/js/app.js#L84) (`const HASH = 'bzhAdmin2025';`).
- Débloque le panneau admin (édition des morceaux/styles) via un hash d'URL
  (`#bzhAdmin2025`) ou un flag `localStorage`. Le mot de passe est visible en clair dans le
  JS servi au client — donc public de fait, à qui sait lire une source JS.
- Le reste de l'écosystème a un pattern établi et correct pour ça (rôle superuser vérifié
  côté Supabase, voir la note interne `no-hardcoded-ids`) : c'est justement ce que fait déjà
  `admin-audio.html`. Le module jukebox est le seul endroit du système audio encore sur
  l'ancien schéma "mot de passe en dur côté client".

### 🟠 Deux lecteurs audio actifs simultanément sur `star/index.html`, sans coordination

- Ligne [star/index.html:207](../star/index.html#L207) charge la stack Star Radio
  (`radio-player-stabilizer.js` → patch complet de `RadioPlayer`).
- Ligne [star/index.html:212](../star/index.html#L212) charge en plus, sans lazy-load,
  `chronicles-fm-widget.js` (le lecteur YouTube flottant).
- Les deux exposent chacun un bouton play/pause, un volume, un "rejoindre le direct"
  indépendants. Rien ne coupe l'un quand l'autre démarre : un utilisateur qui rejoint le
  flux Star Radio puis ouvre et lance Chronicles FM (ou l'inverse) entend les deux en même
  temps.

### 🟠 "Chronicles FM" désigne deux playlists différentes selon la page

- Le widget flottant charge
  [`/jukebox/chronicles-fm.json`](../jukebox/chronicles-fm.json)
  ([js/chronicles-fm-widget.js:5](../js/chronicles-fm-widget.js#L5)) — **13 fréquences**,
  ids type `drspig-mix`, `tags` en string libre.
- La page dédiée `/chronicles-fm/` charge
  [`/chronicles-fm/data.json`](../chronicles-fm/data.json)
  ([chronicles-fm/index.html:273](../chronicles-fm/index.html#L273)) — **10 fréquences**,
  ids type `cfm-01`, `tags` en tableau JSON. Schéma légèrement différent en plus du contenu.
- Un utilisateur qui visite `/chronicles-fm/` puis ouvre le widget flottant sur une autre
  page ne retrouve pas la même liste de fréquences pour la même marque "Chronicles FM".
  Un des deux fichiers est visiblement une version antérieure jamais supprimée (l'historique
  Git montre `9104339 chore(jukebox): supprime chronicles-fm.html redondant → remplacé par
  /chronicles-fm/index.html`, mais `jukebox/chronicles-fm.json` — la donnée, pas la page —
  n'a pas suivi ce nettoyage).

### 🟡 Trois surfaces d'administration différentes pour le même domaine (audio)

1. `admin/index.php` — documenté dans [jukebox/README.md](../jukebox/README.md) §1 et §6,
   mais **n'existe plus dans le repo** (aucun fichier `.php` dans tout le projet). Doc
   obsolète qui décrit un système supprimé.
2. Panneau admin intégré au jukebox, débloqué par le mot de passe en dur `bzhAdmin2025`
   (voir plus haut) — actif, mais sur un schéma d'auth différent du reste du site.
3. [admin-audio.html](../admin-audio.html) — protégé par Basic Auth serveur (voir la note
   interne `ovh-server-access`), branché sur Supabase pour la gestion des dédicaces/uploads.
   C'est le pattern le plus proche du reste de l'admin du site.

### 🟡 Code mort / fonctionnalités jamais finalisées

- `LemegetonVoice` ([js/lemegeton-voice.js](../js/lemegeton-voice.js)) : classe complète et
  soignée, zéro import ailleurs dans le repo.
- `AVAILABLE_LEME_AUDIO` vide dans le widget Chronicles FM : le tier "voix pré-enregistrée"
  n'a jamais été activé, malgré tout le code écrit autour (`playLemeAudio`, `AUDIO_BASE`,
  gestion d'erreur `onerror`).
- [jukebox/lemegeton/manifest.json](../jukebox/lemegeton/manifest.json) : fichier "exemple"
  vide, aucun MP3 réel dans `jukebox/lemegeton/`.
- Web Audio "grain vinyle" retiré en v6.2 d'après le changelog
  ([jukebox/README.md](../jukebox/README.md) §4.1) — vérifier qu'aucun CSS/JS mort lié au
  grain ne traîne encore (le README le signale lui-même comme nettoyage optionnel jamais
  confirmé fait, §5).

## 3. Réflexions — pourquoi c'est comme ça, et ce que ça coûte

Le système a évolué par accumulation, pas par refonte : chaque nouvelle idée (dédicaces
payantes, direct simulé par horloge, playlists YouTube par ambiance, avatar vocal Lemegeton,
vinyle 3D) a été livrée comme un **système autonome de plus**, plutôt que comme une extension
d'un système audio central. Le pattern de "patcher le prototype depuis un fichier séparé"
(`RadioPlayer.prototype.xxx = ...`) dans `radio-player-gate.js` /
`radio-dedication-rules.js` / `radio-player-stabilizer.js` est symptomatique : c'est une
façon d'ajouter du comportement sans toucher au fichier source, qui marche mais qui rend
l'ordre de `<script>` significatif et invisible à la lecture d'un seul fichier.

Trois causes profondes qui reviennent dans presque tous les constats ci-dessus :

- **Aucune source de vérité unique pour "qu'est-ce qui joue du son en ce moment sur la
  page"**. Chaque système possède son propre `<audio>` / iframe YouTube / SpeechSynthesis,
  sans registre commun. C'est ce qui permet à deux lecteurs de tourner en même temps sans
  qu'aucun des deux ne le sache.
- **Les données (playlists, prix, textes) sont dupliquées au lieu d'être référencées.**
  `records.json` existe deux fois, `chronicles-fm.json`/`data.json` divergent, le prix de
  dédicace est écrit à trois endroits (HTML par défaut, patch JS, SQL) qui peuvent driver
  indépendamment — et ont dérivé.
- **La confiance/sécurité admin est à deux vitesses** : le reste du site est passé à un
  modèle serveur (Supabase `profiles.role`, Basic Auth serveur), le module jukebox est resté
  sur un mot de passe client en dur hérité d'une version antérieure du projet (probablement
  antérieure à l'intégration Supabase, à en juger par le nom `admin/index.php` dans le
  changelog).

Aucun de ces problèmes n'est bloquant individuellement — le site fonctionne, les gens
écoutent de la musique. Mais chaque nouvelle fonctionnalité audio ajoutée sur cette base
(un 4ᵉ lecteur, un 4ᵉ format de playlist) rend la convergence future plus chère. C'est le bon
moment pour choisir une direction avant que `star/jukebox-3d` ou un futur module ne devienne
un 4ᵉ système parallèle de plus.

## 4. Pistes d'amélioration (à trancher, pas encore décidées)

Non classées par ordre de priorité — à discuter avant d'ouvrir du travail :

1. **Un seul "audio bus" côté client** : un petit registre partagé (`window` singleton ou
   module ES) que `RadioPlayer` et le widget Chronicles FM interrogent avant de lancer la
   lecture, pour couper l'autre automatiquement. Correctif ciblé, n'exige pas de fusionner
   les deux systèmes.
2. **Réconcilier les deux `chronicles-fm.json`** : décider laquelle des deux listes (13 vs
   10 fréquences) est la version actuelle, supprimer l'autre, faire pointer les deux
   consommateurs vers le même fichier.
3. **Corriger l'incohérence de prix des dédicaces** : soit remonter le prix affiché à 200 C
   partout, soit baisser le coût réel côté SQL à 20 — mais aligner les trois sources
   (HTML par défaut, patch JS, fonction SQL) sur une seule valeur, idéalement lue depuis un
   seul endroit (le SQL pourrait exposer le prix via une fonction `get_radio_dedication_cost()`
   que le client interroge au lieu de le coder en dur des deux côtés).
4. **Retirer le mot de passe client en dur du jukebox** et passer par le même contrôle
   superuser que le reste du site (`profiles.role === 'superuser'`), en cohérence avec
   `admin-audio.html`.
5. **Choisir entre les 3 implémentations jukebox** (`JukeboxPlayer.js` vs `app.js` vs
   `star/jukebox-3d/js/app.js`) laquelle devient la référence, et faire pointer les deux
   autres pages dessus plutôt que de maintenir trois bases de code pour le même lecteur
   vinyle — même logique que la convergence déjà faite pour le casino
   (`skill-arena` canonique, `star/casino` en redirect).
6. **Décider du sort de `LemegetonVoice`** : soit la brancher réellement (Chronicles FM et
   les dédicaces Star Radio l'utiliseraient toutes les deux, au lieu de deux implémentations
   de repli différentes), soit la retirer si l'idée est abandonnée.
7. **Nettoyer `jukebox/README.md`** pour ne plus décrire un `admin/index.php` qui n'existe
   plus, une fois le point 4 tranché.

## 5. Fichiers cités (référence rapide)

| Système | Fichiers clés |
| --- | --- |
| Star Radio | `js/star/widgets.js` (classe `RadioPlayer`), `js/star/radio.js`, `js/star/radio-player-gate.js`, `js/star/radio-dedication-rules.js`, `js/star/radio-player-stabilizer.js`, `radio/live.json`, `scripts/sql/002_radio_dedications.sql` |
| Chronicles FM (widget) | `js/chronicles-fm-widget.js`, `js/chronicles-fm-launcher.js`, `js/chronicles-fm-star-skin.js`, `jukebox/chronicles-fm.json` |
| Chronicles FM (page) | `chronicles-fm/index.html`, `chronicles-fm/data.json` |
| Jukebox | `jukebox/js/JukeboxPlayer.js`, `jukebox/js/app.js`, `jukebox/js/embed.js`, `jukebox/index.html`, `jukebox/records.json`, `jukebox/vinyl_styles.json` |
| Jukebox 3D | `star/jukebox-3d/js/app.js`, `star/jukebox-3d/index.html`, `star/jukebox-3d/records.json` |
| Voix Lemegeton | `js/lemegeton-voice.js` (non utilisé), `jukebox/lemegeton/manifest.json`, `data/lemegeton-state.json` |
| Admin | `admin-audio.html` |
