# Gwen Ha Star — Nitro Static Hub

> Hub public de **Sterenna EI** et portail d'identité du réseau Nitro / Chronicles.

---

## Concept

**Gwen Ha Star** est le portail central de l'écosystème Nitro.

Il sert à la fois de :

- vitrine publique des projets Sterenna ;
- point d'entrée vers l'espace membre `/star/` ;
- socle d'authentification Supabase partagé ;
- base commune pour les apps connectées comme Botanica, TCG et les intégrations externes.

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

## Architecture cible

```txt
gwen-ha-star-static/
├── index.html                 # Hub public Nitro / Gwen Ha Star
├── login.html                 # Connexion Supabase / Nitro
├── reset.html                 # Réinitialisation mot de passe
├── update-password.html       # Mise à jour mot de passe Supabase
├── cig.html                   # CIG — profil agent connecté
│
├── star/                      # Cockpit connecté statique historique
│   └── admin/
│       ├── background.html    # Console background spatial superuser
│       ├── background-admin.js
│       ├── background-elements-admin.js
│       └── background-admin.css
├── TCG/                       # App interne TCG
├── jukebox/                   # Jukebox statique
├── docs/
│   └── space-background-ships.md
│
├── shared/                    # Socle commun Nitro
│   ├── config.js              # Généré au déploiement, non versionné
│   ├── supabase-client.js     # Client Supabase partagé
│   ├── auth.js                # Helpers login/session/logout
│   ├── guards.js              # requireAuth / requireGuest
│   ├── profile.js             # Profil Agent / cache / display name
│   ├── session-ui.js          # Widget header session
│   ├── .htaccess              # CORS pour imports cross-domain depuis PokéGang
│   ├── logos/
│   └── images/
│
├── css/                       # Styles globaux Nitro
├── js/                        # Logique propre au hub
│   ├── main.js
│   ├── data.js
│   ├── radar.js
│   ├── theme.js
│   ├── auth.js                # Wrapper vers shared/session-ui.js + overlay background
│   ├── supabase.js            # Wrapper vers shared auth/client
│   ├── home-sections-runtime.js
│   ├── space-background.js
│   ├── space-ships-library-overlay.js
│   └── star/                  # Logique spécifique au cockpit Star statique
│
└── .github/workflows/
    └── deploy-ovh.yml         # Déploiement SSH/rsync vers OVH ~/nitro/
```

---

## Navigation

| URL | Accès | Rôle |
|---|---|---|
| `/` | Public | Hub public Gwen Ha Star / Nitro |
| `/login.html` | Public | Connexion agent |
| `/cig.html` | Connecté | Carte d'Identification Galactique |
| `/star/` | Connecté | Cockpit membre / crew / réseau statique historique |
| `/star/admin/background.html` | Superuser | Gestion du background spatial public |
| `/docs/space-background-ships.md` | Technique | Guide vaisseaux, éléments, presets et agent IA |
| `/TCG/` | Connecté | App TCG |
| `/jukebox/` | Public / intégré | Lecteur musical |
| `/shared/` | Technique | Modules communs Nitro |
| `/botanica/` | Connecté | Déployé par le repo `botanica-obscura` sous Nitro |

---

## Background spatial public

L'accueil utilise plusieurs modules complémentaires :

```txt
/js/space-background.js
/js/space-ships-library-overlay.js
/js/home-sections-runtime.js
/star/admin/background.html
```

La console admin permet de modifier rapidement :

- activation globale du background ;
- densité d'étoiles ;
- nébuleuse ;
- petites planètes ;
- astéroïdes ;
- satellites ;
- crashs / incidents ;
- secousses écran ;
- trafic et vitesse ;
- bibliothèque de vaisseaux avec preview ;
- presets `CALME`, `VIVANT`, `TEMPÊTE`, `MINIMAL` ;
- test local de secousse.

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
/shared/supabase-client.js
/shared/auth.js
/shared/guards.js
/shared/profile.js
/shared/session-ui.js
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
```

### Apps externes / sous-domaines séparés

Les apps comme PokéGang restent sur :

```txt
https://pokegang.sterenna.fr
```

Elles peuvent importer les modules `/shared` grâce au CORS configuré dans `shared/.htaccess`, mais la session navigateur n'est pas automatiquement partagée entre sous-domaines.

Pour PokéGang, l'intégration Nitro doit donc rester progressive : détection, liaison de compte, cloud sync, récompenses, etc.

---
