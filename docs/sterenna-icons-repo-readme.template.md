# Sterenna Icons

Sources et exports favicon / app icons pour les projets Sterenna Studio, Nitro, Gwen Ha Star, BZH Chronicles et Pokegang.

## Objectifs

- centraliser les sources SVG ;
- générer les exports `.ico`, `.png`, `apple-touch-icon` et `site.webmanifest` ;
- éviter les 404 sur `/favicon.ico` ;
- harmoniser les icônes entre les projets ;
- documenter la convention de nommage.

## Convention

Chaque icône possède un identifiant stable :

```txt
<scope>-<project>
```

Exemples :

```txt
star-gwen-ha-star
bzh-universe
nitro-clicker
botanica-obscura
nitro-skill-arena
nitro-titan-rocket-run
pokegang
chronicles-tcg
```

## Arborescence

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

## Kit minimum à déployer par repo web

```txt
/favicon.ico
/favicon.svg
/favicon-32.png
/apple-touch-icon.png
/site.webmanifest
```

## Balises HTML

Pour un site servi à la racine :

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#070b14">
```

Pour un sous-projet servi dans un dossier :

```html
<link rel="icon" href="./favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="./favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="manifest" href="./site.webmanifest">
<meta name="theme-color" content="#070b14">
```

## Première passe P0

- `star-gwen-ha-star`
- `bzh-universe`
- `nitro-clicker`
- `botanica-obscura`
- `nitro-skill-arena`
- `nitro-titan-rocket-run`
- `pokegang`
- `chronicles-tcg`

## Notes

Les fichiers `.ico` et `.png` sont binaires. Les générer via un outil local ou workflow, puis les committer normalement.
