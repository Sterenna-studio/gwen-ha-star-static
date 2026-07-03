# Sterenna Icon System

Nom proposé du repo dédié : `Sterenna-studio/sterenna-icons`

Objectif : centraliser les sources, exports et conventions de nommage des favicons / app icons pour les projets Sterenna Studio, Nitro, Gwen Ha Star et BZH Chronicles.

## Pourquoi un repo dédié ?

- éviter les favicons manquants dans les sous-projets ;
- éviter les 404 navigateur sur `/favicon.ico` ;
- garder les sources modifiables SVG au même endroit ;
- produire des exports cohérents : `.ico`, `.png`, `apple-touch-icon`, `site.webmanifest` ;
- faciliter les futurs déploiements directs par repo.

## Nom officiel recommandé

```txt
Sterenna-studio/sterenna-icons
```

Alternatives si besoin :

```txt
Sterenna-studio/nitro-icons
Sterenna-studio/sterenna-favicons
Sterenna-studio/sterenna-icon-forge
```

Choix recommandé : `sterenna-icons`, car le périmètre dépasse Nitro.

## Convention de nommage

Chaque projet possède un identifiant court appelé `iconId`.

Format :

```txt
<scope>-<project>
```

Exemples :

```txt
star-gwen-ha-star
bzh-universe
bzh-breach-storm
bzh-nemeton-lockdown
nitro-clicker
nitro-skill-arena
nitro-titan-rocket-run
botanica-obscura
pokegang
chronicles-tcg
spirit-overdrive
```

## Arborescence du repo dédié

```txt
sterenna-icons/
├── README.md
├── icons.registry.json
├── brands/
│   ├── sterenna/
│   ├── gwen-ha-star/
│   ├── bzh-chronicles/
│   ├── nitro/
│   └── pokegang/
├── sources/
│   └── <iconId>/
│       ├── icon.svg
│       ├── icon-dark.svg
│       ├── icon-light.svg
│       └── notes.md
├── exports/
│   └── <iconId>/
│       ├── favicon.ico
│       ├── favicon.svg
│       ├── favicon-16.png
│       ├── favicon-32.png
│       ├── icon-192.png
│       ├── icon-512.png
│       ├── apple-touch-icon.png
│       └── site.webmanifest
└── tools/
    ├── generate-favicons.mjs
    └── rollout-checklist.md
```

## Fichiers à copier dans chaque repo web

Minimum :

```txt
/favicon.ico
/favicon.svg
/favicon-32.png
/apple-touch-icon.png
/site.webmanifest
```

Optionnel :

```txt
/icon-192.png
/icon-512.png
/maskable-icon-512.png
```

## Balises HTML standard

À placer dans le `<head>` des pages principales :

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#070b14">
```

Pour un sous-projet déployé dans un sous-dossier Nitro, préférer des chemins relatifs ou adaptés :

```html
<link rel="icon" href="./favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="./favicon.svg">
<link rel="manifest" href="./site.webmanifest">
```

## Registre initial proposé

| iconId | Repo | Type | Priorité | Base visuelle |
|---|---|---:|---:|---|
| `star-gwen-ha-star` | `Sterenna-studio/gwen-ha-star-static` | hub | P0 | logo Gwen Ha Star |
| `bzh-universe` | `Sterenna-studio/bzh-universe` | hub lore | P0 | triskel / BZH cyber |
| `nitro-clicker` | `Sterenna-studio/nitro-clicker` | jeu | P0 | éclair / monnaie / pixel |
| `botanica-obscura` | `Sterenna-studio/botanica-obscura` | jeu | P0 | feuille obscure / graine |
| `nitro-skill-arena` | `Sterenna-studio/skill-arena` | jeu | P0 | arène / lame / skill |
| `nitro-titan-rocket-run` | `Sterenna-studio/titan-rocket-run` | jeu | P0 | fusée Titan |
| `pokegang` | `Sterenna-studio/pokegang-game` | jeu | P0 | pokéball/gang stylisé |
| `chronicles-tcg` | `Sterenna-studio/chronicles-tcg` | card game | P0 | carte / BZH power |
| `bzh-breach-storm` | `Sterenna-studio/bzh-breach-storm` | jeu | P1 | faille / tempête |
| `bzh-nemeton-lockdown` | `Sterenna-studio/bzh-nemeton-lockdown` | jeu | P1 | arbre sacré / verrou |
| `spirit-overdrive` | `Sterenna-studio/spirit-overdrive` | jeu | P1 | esprit / vitesse |

## Checklist rollout par repo

1. Choisir `iconId` dans `icons.registry.json`.
2. Exporter les fichiers depuis `exports/<iconId>/`.
3. Copier les fichiers à la racine du repo web ou du dossier public.
4. Ajouter les balises HTML dans le `<head>`.
5. Vérifier l’absence de 404 sur `/favicon.ico` ou `./favicon.ico`.
6. Tester en local et après déploiement.
7. Documenter dans le README du repo concerné.

## Note outil

Les sources SVG et fichiers texte peuvent être poussés directement par l’outil GitHub. Les `.ico` et `.png` sont des binaires : il faut les générer localement ou via workflow, puis les committer avec une méthode compatible binaire.
