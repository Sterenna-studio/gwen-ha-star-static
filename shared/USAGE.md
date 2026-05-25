# USAGE — Assets & Modules partagés · Gwen Ha Star

> Ce fichier documente comment utiliser les ressources du dossier `shared/`
> dans n'importe quel projet du réseau Sterenna (GHS, PokéGang, TCG, Botanica, Clicker…).

---

## 📍 Base URL

Tous les assets sont servis depuis la racine du domaine principal :

```
https://nitro.sterenna.fr/shared/
```

Pour les projets sous-domaines (ex: `pokegang.sterenna.fr`), utiliser l'URL absolue.
Pour les pages internes au même site, les chemins relatifs fonctionnent.

---

## 🌟 Logos — Gwen Ha Star

### Logo principal
```
shared/logos/star_logo/star_logo_original.png
```
Usage recommandé : favicon, header, carte de présentation.
```html
<img src="/shared/logos/star_logo/star_logo_original.png" alt="Gwen Ha Star" width="90" height="90">
```

### Variantes couleur (`star_logo/star_logo_color_set/`)

| Fichier | Couleur | Usage type |
|---|---|---|
| `star_logo_cyan_blue.png` | Cyan / Bleu | Interface principale, dark mode |
| `star_logo_gold_orange.png` | Or / Orange | Récompenses, monnaie, highlights |
| `star_logo_green_lime.png` | Vert / Lime | Succès, validation, nature |
| `star_logo_red.png` | Rouge | Alerte, danger, PvP |
| `star_logo_white_silver.png` | Blanc / Argent | Favicon, fonds sombres |

```html
<!-- Exemple favicon -->
<link rel="icon" type="image/png" href="/shared/logos/star_logo/star_logo_color_set/star_logo_white_silver.png">
```

> ⚠️ Toujours fournir `width` et `height` pour éviter le layout shift (CLS).

---

## 🏴 Logos — BZH Power & Chronicles

| Fichier | Description | Dimensions recommandées |
|---|---|---|
| `shared/logos/bzh_power.png` | Logo BZH Power — crew originel | 110×80 |
| `shared/logos/bzh_chronicles.png` | Logo BZH Chronicles — monnaie / casino | 120×auto |
| `shared/logos/pixel_tcg_card.png` | Dos de carte TCG pixel art | 90×auto |

```html
<img src="/shared/logos/bzh_power.png" alt="BZH Power" width="110" height="80" loading="lazy">
```

> `loading="lazy"` recommandé pour tous les assets non critiques au premier rendu.

---

## 🚗 Sprites Véhicules (`shared/images/vehicule/`)

Véhicules emblématiques des membres du crew. Style pixel art / illustration.

| Fichier | Véhicule | Membre |
|---|---|---|
| `vehicule_mash_muten.png` | Mash 400 | MutenRock |
| `vehicule_ax_sniky.png` | Citroën AX | Sniky |
| `vehicule_quad_spirit.png` | Quad | Spirit |

```html
<img src="/shared/images/vehicule/vehicule_mash_muten.png"
     alt="Mash de MutenRock"
     style="image-rendering: pixelated;"
     width="128" loading="lazy">
```

> ⚠️ **Obligatoire** : ajouter `image-rendering: pixelated` (ou la classe CSS `.pixel`) sur tous les sprites pixel art pour conserver le rendu crénelé.

---

## 👤 Avatars Pixel — BZH PW (`shared/images/pixel_pp/`)

Photos de profil pixelisées de la team originelle.

| Fichier | Membre | Notes |
|---|---|---|
| `pixel_pp_abad.png` | Abad | — |
| `pixel_pp_aligax.png` | Aligax | — |
| `pixel_pp_cowboy.png` | Cowboy | — |
| `pixel_pp_sniky.png` | Sniky | Utilisé dans les symboles du casino |
| `pixel_pp_spirit.png` | Spirit | — |
| `pixel_pp_team.png` | Team BZH PW | Photo de groupe |
| `poke_pixel_pp_16x16/` | Sous-dossier | Avatars 16×16 style Pokémon |

```html
<img src="/shared/images/pixel_pp/pixel_pp_sniky.png"
     alt="Sniky" width="48" height="48"
     style="image-rendering: pixelated;" loading="lazy">
```

---

## 🎮 OTK — Aphalone (`shared/images/OTK/`)

Assets visuels du JDR **Aphalone** créé par **Dr.SoRn**.
> 🌐 Wiki : [worldanvil.com/w/aphalone-drsorn](https://www.worldanvil.com/w/aphalone-drsorn)

| Fichier | Description |
|---|---|
| `OTK_aphalone_map.png` | Carte du monde d'Aphalone |
| `OTK_cover_pixel.png` | Cover pixel art OTK |
| `OTK_pixel_cute_nosame.png` | Nosame cute (casino, widgets) |
| `OTK_pixel_nosame.png` | Nosame détaillé |

---

## ✨ Animations (`shared/images/animated/`)

GIFs animés utilisables dans pages, TCG ou widgets.
Même règle : `image-rendering: pixelated` si style pixel art.

---

## 🃏 SVG Jeux (`shared/logos/SVG_game/`)

SVG des logos de jeux du réseau Nitro. Idéal pour les hero cards, badges et icônes scalables.

```html
<img src="/shared/logos/SVG_game/botanica.svg" alt="Botanica Obscura" width="48">
```

---

## ⚙️ Modules JS partagés

Ces modules s'importent en ES module depuis n'importe quelle page du domaine.

| Module | Export principal | Usage |
|---|---|---|
| `shared/supabase-client.js` | `supabase` | Client Supabase initialisé |
| `shared/auth.js` | `signIn`, `signOut`, `getSession` | Auth Supabase |
| `shared/guards.js` | `guardStar`, `guardPublic` | Redirection si non connecté |
| `shared/profile.js` | `getProfile` | Récupère le profil utilisateur |
| `shared/session-ui.js` | `renderSessionUI` | Composant avatar + déconnexion |
| `shared/nitro-apps.js` | `NITRO_APPS` | Registre des apps Nitro |

```js
import { supabase } from '/shared/supabase-client.js';
import { getProfile } from '/shared/profile.js';
```

> Pour les sous-domaines (ex: `pokegang.sterenna.fr`) qui utilisent leur propre `config.js`,
> ne pas importer `supabase-client.js` depuis GHS — utiliser leur propre instance.

---

## 🎨 Règles CSS globales

### Pixel art
```css
.pixel {
  image-rendering: pixelated;
  image-rendering: crisp-edges; /* fallback Firefox */
}
```

### Logos sur fond sombre
Préférer les variantes `white_silver` ou `cyan_blue` du star_logo pour la lisibilité.

### Lazy loading
Tous les assets hors viewport initial doivent avoir `loading="lazy"`.
Les assets critiques (favicon, logo header) ne doivent **pas** avoir `loading="lazy"`.
