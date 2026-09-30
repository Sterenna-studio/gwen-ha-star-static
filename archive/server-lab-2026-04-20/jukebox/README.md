# Sterenna Jukebox – v6.2

Version : **v6.2 – “manivelle + étagère extractible”**  
Dossier cible : `https://sterenna.fr/lab/jukebox/`

Cette version reprend la v6.1 (styles de vinyles unifiés) et ajoute :

- 🆕 pas de grain audio (suppression du Web Audio “vinyle”)
- 🆕 lecteur de temps (position + durée + seek)
- 🆕 bibliothèque améliorée : quand on clique une pochette, elle **sort** dans un slot sous l’étagère
- 🆕 le disque associé (avec son style de vinyle) apparaît **à moitié derrière la pochette**
- 🆕 drag en temps réel **depuis la zone extraite** vers la platine
- 🆕 nouveau mode de lancement : **manivelle à remonter** (5 tours → joue)
- 🧹 ancien drag-ghost remplacé par un drag “follow” plus simple

---

## 1. Arborescence

```text
jukebox/
├─ index.html
├─ records.json
├─ vinyl_styles.json
├─ css/
│  ├─ style.css
│  └─ bzh_logo.png
├─ js/
│  └─ app.js
├─ img/
│  └─ placeholder.png
├─ audio/
│  └─ ...
└─ admin/
   ├─ index.php
   ├─ upload_audio.php
   └─ styles.php
admin/ : inchangé depuis v6.1 → on a toujours la liste unique de styles

front : c’est lui qui a le plus évolué

2. Fonctionnement général
Le front charge records.json

Il affiche les vinyles dans l’étagère en vue isométrique

Quand tu cliques une pochette :

elle est marquée active dans l’étagère

la pochette est recopiée en bas, dans la zone extracted-slot

un disque correspondant (avec le style choisi en admin) est affiché un peu décalé (−50%) derrière

Tu peux attraper ce disque (mousedown → drag qui suit la souris) et le déposer sur la platine

Quand tu lâches dans la platine → le disque est “chargé” (audio prêt, pas encore joué)

Pour lancer la lecture tu dois remonter la manivelle (5 tours)

Quand la jauge est pleine → le disque commence à tourner et l’audio se lance

Tu peux toujours utiliser les boutons de navigation (prev, next, shuffle)

3. Styles de vinyles (rappel v6.1)
On a une seule liste de styles de vinyles

Cette liste est dans : vinyl_styles.json

Elle est éditable dans admin/styles.php

L’admin “Upload” et “Gestion” proposent cette même liste

Chaque vinyle dans records.json a donc un seul champ :

json
Copier le code
"vinylStyle": "effect-neon"
Et le front applique :

js
Copier le code
deckVinyl.className = "vinyl on-deck";
deckVinyl.style.setProperty("--disc1", rec.coverColor || "#14161a");
deckVinyl.style.setProperty("--disc2", rec.labelColor || "#050608");
if (rec.vinylStyle) deckVinyl.classList.add(rec.vinylStyle);
👉 donc la couleur que tu choisis en admin s’applique bien au pattern.

4. Ce qui a changé en v6.2
4.1 Plus de grain
Le slider “Grain vinyle” a été retiré

Le code Web Audio (bruit blanc + gain) a été retiré

L’audio est lu directement via <audio> + volume

➡️ si tu avais du CSS lié à grain → tu peux le supprimer.

4.2 Lecteur de temps
Ajout dans le HTML :

html
Copier le code
<div class="timebar">
  <span id="curTime">0:00</span>
  <input type="range" id="seek" min="0" max="100" value="0" />
  <span id="durTime">0:00</span>
</div>
Dans le JS :

timeupdate met à jour la barre + le temps

bouger le slider → seek dans la musique

4.3 Bibliothèque extractible
avant : drag “fantôme” direct depuis la carte

maintenant : étape intermédiaire lisible

je clique → la pochette descend

le disque apparaît derrière

je drag le disque

Avantages :

tu vois vraiment le style que tu vas mettre sur la platine

tu peux faire un futur mode “préview vinyle” dans cette zone

plus proche de ce que tu décrivais (“il sort de l’étagère”)

4.4 Manivelle
remplace le bras de lecture

visuel différent selon thème (couleur de la jauge)

5 tours → % = tours/5 * 100

quand % == 100 → startPlayback()

5. Puis-je supprimer .drag-ghost ?
Oui ✅
Dans cette version, on utilise drag-follow (créé par le JS) au lieu de l’ancien .drag-ghost.

Donc tu peux enlever de ton css/style.css :

css
Copier le code
.drag-ghost { ... }
body.show-ghost .drag-ghost { ... }
…à moins que tu aies encore un bout de ton ancien app.js qui l’utilise.
Si tu as bien mis startRealDrag(...) → tu peux nettoyer.

6. Ce qui reste à protéger
/admin/ → à protéger (htaccess OVH)

records.json, img/, audio/, vinyl_styles.json → doivent être écrivable par PHP

7. Migration rapide depuis v6.1
Remplacer index.html

Remplacer js/app.js

Mettre à jour css/style.css (au moins les blocs : .crank-*, .extracted-*, .timebar)

(Optionnel) supprimer .drag-ghost

Ne pas toucher à admin/ ni à vinyl_styles.json

8. TODO / idées
rendre le nombre de tours dépendant du thème (3 en cyber, 5 en steam)

ajouter un petit “click mécanique” au tour de manivelle

ajouter un mode “poser le disque = auto 1 tour” pour pas que l’utilisateur ait 2 actions à chaque fois

