# Gwen Ha Star — Bibliothèque de vaisseaux du background

Ce document sert à créer rapidement de nouveaux modèles pour le background spatial de l'accueil.

## Où gérer les vaisseaux

Page admin :

```txt
/star/admin/background.html
```

La section `BIBLIOTHÈQUE DE VAISSEAUX` permet de :

- activer / désactiver un modèle ;
- régler son poids de fréquence ;
- régler sa taille ;
- ajouter une variante rapide basée sur une forme existante.

## Modèle de données

Un vaisseau est un objet JSON de ce type :

```json
{
  "id": "custom-corsaire-bzh",
  "label": "Corsaire BZH",
  "enabled": true,
  "custom": true,
  "weight": 2,
  "shape": "freighter",
  "size": 1.1,
  "speedMin": 90,
  "speedMax": 150,
  "stroke": "#00ffe7",
  "accent": "#39ff14",
  "flame": "#ffaa00"
}
```

## Champs

| Champ | Rôle |
|---|---|
| `id` | Identifiant unique. Utiliser des minuscules et tirets. |
| `label` | Nom visible dans l'admin. |
| `enabled` | `true` ou `false`. Active ou coupe le modèle. |
| `custom` | `true` pour un modèle ajouté à la main. |
| `weight` | Poids de fréquence. `0` = quasi jamais / désactivé, `8` = très fréquent. |
| `shape` | Forme de base : `scout`, `freighter`, `needle`, `carrier`. |
| `size` | Taille visuelle. Exemple : `0.7`, `1`, `1.4`. |
| `speedMin` | Vitesse minimale. |
| `speedMax` | Vitesse maximale. |
| `stroke` | Couleur principale du contour. |
| `accent` | Couleur secondaire / ailes / détails. |
| `flame` | Couleur de propulsion / particules. |

## Formes disponibles

### `scout`

Petit vaisseau équilibré, lisible, fréquent. Bon pour les drones, navettes, chasseurs légers.

### `freighter`

Silhouette plus large avec modules. Bon pour cargos, transports, vaisseaux industriels.

### `needle`

Très fin et rapide. Bon pour intercepteurs, sondes, projectiles, prototypes.

### `carrier`

Grand vaisseau massif. Bon pour croiseurs, porte-nefs, boss visuel, passages rares.

## Création rapide à la main

1. Ouvrir `/star/admin/background.html`.
2. Cliquer sur `+ VAISSEAU`.
3. Donner un nom.
4. Choisir une forme de base : `scout`, `freighter`, `needle` ou `carrier`.
5. Régler `poids / fréquence` et `taille`.
6. Sauvegarder.
7. Recharger l'accueil.

Pour un contrôle plus fin, éditer `shipLibrary` dans Supabase via la config `space_background_config`, clé `home`.

## Prompt pour agent IA

```txt
Tu travailles sur le repo gwen-ha-star-static.
Objectif : ajouter un nouveau modèle de vaisseau au background spatial de l'accueil.

Contraintes :
- Ne pas casser les modèles existants : scout, freighter, needle, carrier.
- Ajouter ou modifier uniquement la clé config.shipLibrary.
- Le modèle doit respecter ce format :
  { id, label, enabled, custom, weight, shape, size, speedMin, speedMax, stroke, accent, flame }
- shape doit être l'une de ces valeurs : scout, freighter, needle, carrier.
- Utiliser des couleurs hexadécimales.
- Garder weight entre 0 et 8.
- Garder size entre 0.4 et 1.8.
- Garder speedMin inférieur à speedMax.

Propose 3 variantes cohérentes avec l'univers Gwen Ha Star / BZH Chronicles :
1. un petit vaisseau courant ;
2. un cargo ou vaisseau utilitaire ;
3. un grand vaisseau rare.

Pour chaque variante, fournis uniquement l'objet JSON prêt à insérer dans shipLibrary.
```

## Exemples rapides

```json
{
  "id": "custom-dolmen-runner",
  "label": "Dolmen Runner",
  "enabled": true,
  "custom": true,
  "weight": 3,
  "shape": "scout",
  "size": 0.85,
  "speedMin": 180,
  "speedMax": 280,
  "stroke": "#00ffe7",
  "accent": "#39ff14",
  "flame": "#ffaa00"
}
```

```json
{
  "id": "custom-menhir-hauler",
  "label": "Menhir Hauler",
  "enabled": true,
  "custom": true,
  "weight": 2,
  "shape": "freighter",
  "size": 1.15,
  "speedMin": 80,
  "speedMax": 130,
  "stroke": "#bf5fff",
  "accent": "#00ffe7",
  "flame": "#ff2d55"
}
```

```json
{
  "id": "custom-armorica-carrier",
  "label": "Armorica Carrier",
  "enabled": true,
  "custom": true,
  "weight": 1,
  "shape": "carrier",
  "size": 1.35,
  "speedMin": 60,
  "speedMax": 105,
  "stroke": "#ffaa00",
  "accent": "#ff2d55",
  "flame": "#ffaa00"
}
```
