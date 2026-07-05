# Gwen Ha Star — Nitro Static Hub

> Hub public de **Sterenna EI** et portail d'identité du réseau Nitro / Chronicles.

---

## Version actuelle

```txt
Home publique : v3.0
Route active  : /
Base active   : home modulaire actuelle
```

La home v3.0 conserve une logique simple : une landing page éditoriale publique, un fond spatial piloté par Supabase admin, et des modules JS séparés pour les comportements interactifs.

La décision de cadrage v3.0 est documentée dans :

```txt
/docs/home-v3.md
```

---

## Concept

**Gwen Ha Star** est le portail central de l'écosystème Nitro.

Il sert à la fois de :

- vitrine publique des projets Sterenna ;
- point d'entrée vers l'espace membre `/star/` ;
- socle d'authentification Supabase partagé ;
- base commune pour les apps connectées comme Botanica, TCG, Skill Arena et les intégrations externes.

Une personne connectée devient un **Agent des Chronicles** et accède à son cockpit personnel dans `/star/`.

---

## Relation avec Korigan et 3615 Gateways

Ce dépôt reste le **hub public statique Nitro / Gwen Ha Star**, notamment pour OVH et les pages publiques.

La version vivante du cockpit connecté est désormais portée par :

```txt
MutenRock/Korigan
```

Korigan contient aussi le runtime actif de 3615 Gateways :

```txt
MutenRock/Korigan/services/3615-gateways
```

Rôles recommandés :

```txt
gwen-ha-star-static
  Vitrine publique Nitro, pages statiques, shared Supabase, déploiement OVH.

MutenRock/Korigan
  Cockpit Next.js authentifié, hub des services locaux, wrapper /star/3615.

MutenRock/Korigan/services/3615-gateways
  Runtime réel Minitel / ESP32 / Telnet / WebSocket.

Sterenna-studio/3615-gateways
  Prototype public autonome et documentation historique du projet 3615.
```

---

## Architecture actuelle

```txt
gwen-ha-star-static/
├── index.html                    # Hub public Nitro / Gwen Ha Star v3.0
├── login.html                    # Connexion Supabase / Nitro
├── reset.html                    # Réinitialisation mot de passe
├── update-password.html          # Mise à jour mot de passe Supabase
├── cig.html                      # CIG — profil agent connecté
│
├── star/                         # Cockpit connecté statique historique
│   └── admin/
│       ├── background.html       # Console background spatial superuser
│       ├── background-admin.js
│       ├── background-elements-admin.js
│       └── background-admin.css
│
├── TCG/                          # App interne TCG, selon modèle de déploiement actif
├── jukebox/                      # Jukebox statique et Chronicles FM
├── docs/
│   ├── home-v3.md                # Cadrage de la home publique v3.0
│   └── space-background-ships.md
│
├── archive/
│   └── legacy-home/              # Ancienne home v1 : ticker, radar, data, main.js
│
├── shared/                       # Socle commun Nitro
│   ├── config.js                 # Généré au déploiement, non versionné
│   ├── supabase-config.js        # Résolution/config runtime avec garde d'erreur
│   ├── supabase-client.js        # Client Supabase partagé + gate superuser home
│   ├── auth.js                   # Helpers login/session/logout
│   ├── guards.js                 # requireAuth / requireGuest
│   ├── profile.js                # Profil Agent / cache / display name
│   ├── session-ui.js             # Widget header session
│   ├── nitro-apps.js             # Registre technique central des apps Nitro
│   ├── .htaccess                 # CORS pour imports cross-domain depuis PokéGang
│   ├── logos/
│   └── images/
│
├── css/
│   ├── home.css                  # Agrégateur CSS de la home
│   ├── home-public.css           # Layout public, cards, Twitch/YT, jukebox
│   ├── home-radio.css            # Web Radio + Chronicles FM
│   ├── home-effects.css          # Effets home, dont no-shake
│   ├── home-utilities.css        # Classes remplaçant les anciens style="..."
│   └── home-sections.css         # Regroupement accueil : Twitch + YouTube puis Radio
│
├── js/
│   ├── home.js                   # Runtime public de la home v3.0
│   ├── theme.js
│   ├── auth.js                   # Wrapper vers shared/session-ui.js + overlay background
│   ├── supabase.js               # Wrapper vers shared auth/client
│   ├── space-background.js       # Background spatial public moderne + HUB VERSION superuser
│   ├── chronicles-fm-widget.js   # Widget radio flottant
│   ├── space-ships-library-overlay.js
│   ├── hub/
│   │   └── nitro-public-renderer.js # Renderer Apps Nitro conservé mais non activé sur `/`
│   └── star/                     # Logique spécifique au cockpit Star statique
│
├── versions/
│   ├── themes/                   # Archive ancienne version thème UI
│   └── background-presets/       # Archive ancienne version presets publics du fond
│
└── .github/workflows/
    └── deploy-ovh.yml            # Déploiement SSH/rsync vers OVH ~/nitro/
```

---

## Navigation

| URL | Accès | Rôle |
|---|---|---|
| `/` | Public | Hub public Gwen Ha Star / Nitro v3.0 |
| `/login.html` | Public | Connexion agent |
| `/cig.html` | Connecté | Carte d'Identification Galactique |
| `/star/` | Connecté | Cockpit membre / crew / réseau statique historique |
| `/star/admin/background.html` | Superuser | Gestion du background spatial public |
| `/docs/home-v3.md` | Technique | Cadrage de la home publique v3.0 |
| `/docs/space-background-ships.md` | Technique | Guide vaisseaux, éléments, presets et agent IA |
| `/TCG/` | Connecté | App TCG, selon déploiement actif |
| `/jukebox/` | Public / intégré | Lecteur musical et Chronicles FM |
| `/shared/` | Technique | Modules communs Nitro |
| `/versions/themes/` | Archive | Ancienne version thème UI |
| `/versions/background-presets/` | Archive | Ancienne version avec presets publics du fond spatial |
| `/botanica/` | Connecté | Déployé par le repo `botanica-obscura` sous Nitro |

---

## Home publique v3.0

La home v3.0 est séparée en trois couches :

```txt
index.html       → structure HTML et appels de modules seulement
css/home.css     → agrégateur CSS dédié
js/home.js       → comportement Twitch, Jukebox, Radio, carte Chronicles
```

Scripts actifs sur `/` :

```txt
/js/home.js
/js/chronicles-fm-widget.js
/js/space-background.js
```

Sections visibles :

1. Hero Gwen Ha Star.
2. Outils & Univers.
3. Twitch live.
4. Jukebox Dr.Spig.
5. Web Radio Live / playlists YouTube.
6. Chronicles FM / présentation radio pirate.
7. YouTube @mutenrock.

Règles retenues :

- `Outils & Univers` reste le menu éditorial principal de l'accueil public.
- `shared/nitro-apps.js` reste le registre technique central des apps Nitro.
- `js/hub/nitro-public-renderer.js` est conservé mais non activé sur la home publique pour éviter les doublons avec `Outils & Univers`.
- L'ancien trio `js/main.js`, `js/radar.js`, `js/data.js` est archivé dans `/archive/legacy-home/`.
- Le gros `<style>` inline et le vieux runtime `ship-canvas` ne sont plus la base de la home publique.

---

## Background spatial public

L'accueil utilise principalement :

```txt
/js/space-background.js
/star/admin/background.html
```

Le fond public est piloté par Supabase via :

```txt
space_background_config
id = 'home'
```

La console admin permet de modifier rapidement :

- activation globale du background ;
- densité d'étoiles ;
- nébuleuse ;
- petites planètes ;
- astéroïdes ;
- satellites ;
- crashs / incidents ;
- trafic et vitesse ;
- bibliothèque de vaisseaux avec preview ;
- presets `CALME`, `VIVANT`, `TEMPÊTE`, `MINIMAL`.

Les secousses écran sont désactivées côté home publique : `shake` est forcé à `0` et `body.shaking` est neutralisé.

La console `HUB VERSION` est injectée par `space-background.js`, mais elle est réservée aux superusers Supabase. Les archives `/versions/...` restent statiques et accessibles par URL directe ; elles ne doivent donc pas contenir d'information sensible.

Les 4 familles historiques de vaisseaux importées depuis l'ancien moteur `ship-canvas` sont :

```txt
scout
freighter
needle
carrier
```

La documentation de création rapide et le prompt pour agent IA sont dans :

```txt
/docs/space-background-ships.md
```

---

## Shared Nitro Core

Le dossier `/shared/` est la couche commune utilisée par les apps Nitro.

### Modules principaux

```txt
/shared/supabase-config.js
/shared/supabase-client.js
/shared/auth.js
/shared/guards.js
/shared/profile.js
/shared/session-ui.js
/shared/nitro-apps.js
```

Exemple d'utilisation depuis une app servie sous `nitro.sterenna.fr` :

```js
import { supabase } from '/shared/supabase-client.js';
import { requireAuth } from '/shared/guards.js';

const auth = await requireAuth();
if (!auth) throw new Error('Not authenticated');

const { user, profile } = auth;
```

### Apps sous le même domaine Nitro

Les apps servies sous le même origin partagent naturellement la session Supabase :

```txt
https://nitro.sterenna.fr/star/
https://nitro.sterenna.fr/botanica/
https://nitro.sterenna.fr/TCG/
https://nitro.sterenna.fr/arena/
```

### Apps externes / sous-domaines séparés

Les apps comme PokéGang restent sur :

```txt
https://pokegang.sterenna.fr
```

Elles peuvent importer les modules `/shared` grâce au CORS configuré dans `shared/.htaccess`, mais la session navigateur n'est pas automatiquement partagée entre sous-domaines.

Pour PokéGang, l'intégration Nitro doit donc rester progressive : détection, liaison de compte, cloud sync, récompenses, etc.

---

## Déploiement OVH

Le workflow `.github/workflows/deploy-ovh.yml` :

1. génère `shared/config.js` depuis les secrets GitHub ;
2. synchronise le site statique vers `~/nitro/` en SSH/rsync ;
3. lance un smoke test public sur les endpoints essentiels.

Les dossiers exclus du rsync sont volontaires quand ils sont déployés par un autre repo ou une autre app. Toute nouvelle app Nitro doit documenter son modèle de déploiement avant d'être ajoutée à la navigation publique.

Après un patch de home, vérifier au minimum :

```txt
/
/css/home.css
/js/home.js
/js/space-background.js
/js/chronicles-fm-widget.js
/docs/home-v3.md
```

---

## Serveur et sécurité

Le `.htaccess` gère :

- MIME JS/CSS/audio ;
- cache HTML/JSON/CSS/JS en revalidation ;
- cache images/fonts 7 jours ;
- gzip ;
- headers de sécurité légers ;
- CSP en `Report-Only` pour observer les violations sans casser les embeds Twitch/YouTube/Supabase.

Les anciennes injections HTML serveur via `mod_substitute` sont supprimées.
