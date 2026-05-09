# shared/images — Inventaire des assets visuels

Ce dossier contient tous les assets images partagés entre les pages du site.

---

## 📁 animated/
GIFs animés utilisables dans les pages, le TCG ou les widgets.

---

## 📁 OTK/
Éléments visuels liés à **One True King** — le JDR *Aphalone* créé par **Dr.SoRn**.

> 🌐 Wiki Aphalone : https://www.worldanvil.com/w/aphalone-drsorn

| Fichier | Description |
|---|---|
| `OTK_aphalone_map.png` | Carte du monde d'Aphalone |
| `OTK_cover_pixel.png` | Cover pixel art OTK (haute résolution) |
| `OTK_pixel_cute_nosame.png` | Nosame version cute pixel art (utilisé dans le casino) |
| `OTK_pixel_nosame.png` | Nosame version détaillée pixel art |

---

## 📁 pixel_pp/
Photos de profil **version pixelisée** de la team originelle du BZH PW.

| Fichier | Membre |
|---|---|
| `pixel_pp_abad.png` | Abad |
| `pixel_pp_aligax.png` | Aligax |
| `pixel_pp_cowboy.png` | Cowboy |
| `pixel_pp_sniky.png` | Sniky (utilisé dans le casino) |
| `pixel_pp_spirit.png` | Spirit |
| `pixel_pp_team.png` | Photo de groupe team BZH PW |
| `poke_pixel_pp_16x16/` | Sous-dossier : avatars 16×16 style Pokémon |

---

## 📁 vehicule/
Véhicules emblématiques des membres du crew :

| Fichier attendu | Description |
|---|---|
| Quad de Spirit | Quad de Spirit |
| AX de Sniky | Citroën AX de Sniky |
| Mash de Muten | Mash de MutenRock |

---

## Notes d'utilisation
- Les assets `OTK/OTK_pixel_cute_nosame.png` et `pixel_pp/pixel_pp_sniky.png` sont intégrés comme **symboles du casino** dans `js/star/widgets.js`.
- Le lien WorldAnvil vers Aphalone est accessible depuis le bouton **APHALONE** dans le quick-access de `star/index.html`.
- Toutes les images pixel art doivent être affichées avec `image-rendering: pixelated` pour préserver le rendu.
