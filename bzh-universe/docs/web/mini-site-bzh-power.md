# Mini-site BZH POWER / BZH Chronicles — fragments historiques documentés

## 1. Hero / bannière
### Asset de fond
- `http://sterenna.fr/wp-content/uploads/2024/07/chronicles_city.webp`

### Contenu
- titre :
  - `BZH POWER`
- style :
  - lettres pixel art ;
  - contour noir ;
  - texte très lisible sur image.

### Interactions présentes dans l’ancien bloc
- effet parallaxe au scroll ;
- déformation légère ou translation liée au mouvement de souris.

## 2. Bloc lecteur musique
### Fonctionnement récupéré
- même fond `chronicles_city.webp` ;
- background fixe ;
- vignettes / miniatures de pistes ;
- balise :
  - `<audio id="audio-player">`
- tableau JS de pistes.

### Exemples de médias cités dans ce vieux bloc
- `album_cover_2.png`
- `music-5-.jpg`
- `track-1.mp3`
- `track-2.mp3`
- `track-3.mp3`

## 3. Présentation éditoriale de l’univers
Texte historique :
> Bienvenue dans l’univers épique de « BZH Chronicles »…  
> une odyssée musicale portée par les héros de BZH Power.  
> Découvrez les héros de BZH Power : MutenRock, Sniky, Aligax, Spirit, Dr. Sorn…  
> chaque morceau est une aventure…  
> Rejoignez-nous et laissez-vous emporter par la puissance de « BZH Chronicles ».

## 4. Éléments techniques à reconstituer plus tard
Le HUB conserve la structure, mais pas le bloc HTML/CSS/JS intégral mot pour mot lorsqu’il n’est pas retrouvé textuellement.

À réimporter dans :
```txt
web/legacy/
```
- hero complet ;
- lecteur musique complet ;
- version WordPress du snippet ;
- éventuels scripts de sélection de piste.
