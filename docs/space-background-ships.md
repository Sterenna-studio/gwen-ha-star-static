# Gwen Ha Star — Background spatial

Ce document sert à gérer rapidement le background spatial de l'accueil : vaisseaux, étoiles, nébuleuse, planètes, astéroïdes, satellites, crashs, previews, backups et presets d'univers.

## Page admin

```txt
/star/admin/background.html
```

La page contient maintenant quatre zones :

1. **Ambiance** : sliders globaux historiques.
2. **Bibliothèque de vaisseaux** : modèles activables avec preview.
3. **Aperçu · Backup · Reset** : iframe live, aperçu temporaire, backups Supabase, restore, reset safe.
4. **Éléments & tests rapides** : étoiles, planètes, astéroïdes, satellites, crashs, presets et tests.

## Ce qui est déjà historisé

Un passage sur les anciens commits a retrouvé les 4 familles historiques de vaisseaux :

- `scout`
- `freighter`
- `needle`
- `carrier`

Ces familles viennent de l'ancien moteur inline `ship-canvas` de `index.html`. Elles ont été réintégrées dans l'overlay actuel avec leurs métadonnées utiles : `engine`, `fill`, `stroke`, `accent`, `flame`, `weight`, `size`, `speedMin`, `speedMax`.

Aucun autre modèle de vaisseau distinct n'a été retrouvé dans les anciens commits inspectés. Les variantes futures doivent donc partir de ces 4 formes de base.

---

## Bibliothèque de vaisseaux

### Modèle de données

```json
{
  "id": "custom-corsaire-bzh",
  "label": "Corsaire BZH",
  "enabled": true,
  "custom": true,
  "weight": 2,
  "shape": "freighter",
  "engine": 42,
  "size": 1.1,
  "speedMin": 90,
  "speedMax": 150,
  "stroke": "#00ffe7",
  "fill": "rgba(0,255,231,.08)",
  "accent": "#39ff14",
  "flame": "#ffaa00"
}
```

| Champ | Rôle |
|---|---|
| `id` | Identifiant unique. Minuscules et tirets. |
| `label` | Nom visible dans l'admin. |
| `enabled` | Active ou coupe le modèle. |
| `custom` | `true` pour un modèle ajouté. |
| `weight` | Fréquence relative. `0` = inactif, `8` = fréquent. |
| `shape` | `scout`, `freighter`, `needle`, `carrier`. |
| `engine` | Point arrière de propulsion. Hérité de l'ancien moteur. |
| `size` | Taille visuelle. Conseillé : `0.4` à `1.8`. |
| `speedMin` | Vitesse minimale. |
| `speedMax` | Vitesse maximale. |
| `stroke` | Couleur principale. |
| `fill` | Remplissage translucide. |
| `accent` | Couleur secondaire. |
| `flame` | Couleur propulsion / particules. |

### Formes disponibles

- `scout` : petit vaisseau équilibré, drones, navettes, chasseurs légers.
- `freighter` : silhouette large avec modules, cargos, transports, industriel.
- `needle` : très fin et rapide, intercepteurs, sondes, prototypes.
- `carrier` : grand vaisseau massif, croiseurs, porte-nefs, passages rares.

### Création rapide à la main

1. Ouvrir `/star/admin/background.html`.
2. Cliquer sur `+ VAISSEAU`.
3. Donner un nom.
4. Choisir une forme de base : `scout`, `freighter`, `needle` ou `carrier`.
5. Régler `poids / fréquence` et `taille`.
6. Sauvegarder.
7. Recharger l'accueil.

---

## Bibliothèque d'éléments

La zone **ÉLÉMENTS & TESTS RAPIDES** pilote les mêmes champs que les sliders historiques, mais sous forme d'éléments activables.

| Élément | Champ config | Usage |
|---|---|---|
| Champ d'étoiles | `stars` | Densité du ciel. |
| Nébuleuse | `nebula` | Halo cyan/vert. |
| Petites planètes | `planets` | Disques et anneaux lents. |
| Astéroïdes | `asteroids` | Rochers traversants. |
| Satellites | `satellites` | Petits objets orbitaux. |
| Crashs / incidents | `crashes` | Explosions et particules. |
| Secousses écran | `shake` | Tremblement lors des incidents. |
| Trafic global | `ships` | Volume de passages. |
| Vitesse globale | `speed` | Vitesse générale du décor. |

### Presets rapides admin

| Preset | Usage |
|---|---|
| `CALME` | Fond discret, peu d'événements. |
| `VIVANT` | Valeur équilibrée recommandée. |
| `TEMPÊTE` | Beaucoup de vie, crashs, astéroïdes, vitesse. |
| `MINIMAL` | Background presque fixe, sans trafic. |

Le bouton `TEST SHAKE` déclenche une secousse locale sans attendre un crash.

---

## Aperçu, backup et reset safe

La zone **APERÇU · BACKUP · RESET** ajoute :

| Bouton | Rôle |
|---|---|
| `APERÇU LIVE` | Recharge l'accueil dans une iframe avec la dernière config sauvegardée. |
| `APERÇU NON SAUVÉ` | Envoie les valeurs visibles dans un preset local temporaire et recharge l'iframe. |
| `BACKUP MAINTENANT` | Crée un backup persistant Supabase de la configuration live. |
| `RESTORE DERNIER` | Restaure le dernier backup disponible. |
| `RESET SAFE` | Crée un backup puis applique une config stable recommandée. |

Les backups sont stockés dans Supabase via :

```txt
space_background_config_backups
admin_backup_space_background_config
admin_list_space_background_backups
admin_restore_space_background_backup
```

---

## Presets disponibles directement sur l'accueil

L'accueil affiche un sélecteur `BACKGROUND` en bas de page.

| Preset public | Rôle |
|---|---|
| `LIVE ADMIN` | Utilise la dernière configuration sauvegardée par l'admin. |
| `DÉFAUT` | Fond local stable, indépendant de la config live. |
| `PATROUILLE ARMORICA` | Ambiance claire, ronde, protectrice. |
| `TRAFIC CONTREBANDE` | Plus de trafic, néons violets/rouges. |
| `TEMPÊTE DU CODE` | Version dramatique, crashs et activité forte. |
| `RUINES ORBITALES` | Planètes, astéroïdes, ambiance lente et ancienne. |

Le choix est stocké localement dans le navigateur avec `localStorage.spaceBgPreset`. Il ne modifie pas la configuration live Supabase.

---

## Prompt pour agent IA

```txt
Tu travailles sur le repo gwen-ha-star-static.
Objectif : proposer des variantes de background spatial pour Gwen Ha Star / BZH Chronicles.

Contraintes :
- Ne pas casser les 4 formes historiques : scout, freighter, needle, carrier.
- Pour les vaisseaux, utiliser ce format :
  { id, label, enabled, custom, weight, shape, engine, size, speedMin, speedMax, stroke, fill, accent, flame }
- shape doit être : scout, freighter, needle ou carrier.
- weight entre 0 et 8.
- size entre 0.4 et 1.8.
- speedMin doit être inférieur à speedMax.
- Pour l'ambiance globale, utiliser uniquement les champs :
  stars, nebula, planets, asteroids, satellites, crashes, shake, ships, speed.

Propose :
1. trois nouveaux vaisseaux cohérents avec l'univers BZH Chronicles ;
2. un preset calme ;
3. un preset très vivant ;
4. un preset dramatique / crash / tempête.

Réponds en JSON uniquement.
```

---

## Exemples de vaisseaux

```json
{
  "id": "custom-dolmen-runner",
  "label": "Dolmen Runner",
  "enabled": true,
  "custom": true,
  "weight": 3,
  "shape": "scout",
  "engine": 34,
  "size": 0.85,
  "speedMin": 180,
  "speedMax": 280,
  "stroke": "#00ffe7",
  "fill": "rgba(0,255,231,.08)",
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
  "engine": 42,
  "size": 1.15,
  "speedMin": 80,
  "speedMax": 130,
  "stroke": "#bf5fff",
  "fill": "rgba(191,95,255,.08)",
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
  "engine": 56,
  "size": 1.35,
  "speedMin": 60,
  "speedMax": 105,
  "stroke": "#ffaa00",
  "fill": "rgba(255,170,0,.07)",
  "accent": "#ff2d55",
  "flame": "#ffaa00"
}
```
