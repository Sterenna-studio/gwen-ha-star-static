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

## Architecture cible

```txt
gwen-ha-star-static/
├── index.html                 # Hub public Nitro / Gwen Ha Star
├── login.html                 # Connexion Supabase / Nitro
├── reset.html                 # Réinitialisation mot de passe
├── update-password.html       # Mise à jour mot de passe Supabase
├── cig.html                   # CIG — profil agent connecté
│
├── star/                      # Cockpit connecté : crew, widgets, arcade, accès apps
├── TCG/                       # App interne TCG
├── jukebox/                   # Jukebox statique
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
│   ├── auth.js                # Wrapper vers shared/session-ui.js
│   ├── supabase.js            # Wrapper vers shared auth/client
│   └── star/                  # Logique spécifique au cockpit Star
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
| `/star/` | Connecté | Cockpit membre / crew / réseau |
| `/TCG/` | Connecté | App TCG |
| `/jukebox/` | Public / intégré | Lecteur musical |
| `/shared/` | Technique | Modules communs Nitro |
| `/botanica/` | Connecté | Déployé par le repo `botanica-obscura` sous Nitro |

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

## Configuration Supabase

Les clés Supabase ne sont plus versionnées dans un `config.js` à la racine.

Le workflow GitHub Actions génère au déploiement :

```txt
shared/config.js
```

à partir des secrets GitHub :

```txt
GHSTAR_SUPABASE_URL
GHSTAR_SUPABASE_ANON
```

`shared/config.js` est ignoré par Git et ne doit pas être commité.

> La clé `anon` / `publishable` reste visible côté navigateur après déploiement, ce qui est normal pour une app front statique Supabase. La sécurité doit être assurée par les règles RLS côté Supabase.

---

## Déploiement

Le repo est déployé avec GitHub Actions, pas via le webhook Git/VCS OVH.

Flux :

```txt
git push main
→ GitHub Actions
→ génération shared/config.js
→ rsync SSH
→ OVH ~/nitro/
→ https://nitro.sterenna.fr/
```

Secrets GitHub requis :

```txt
OVH_HOST
OVH_USER
OVH_SSH_KEY
GHSTAR_SUPABASE_URL
GHSTAR_SUPABASE_ANON
```

Le workflow actif est :

```txt
.github/workflows/deploy-ovh.yml
```

---

## CORS `/shared` pour PokéGang

`shared/.htaccess` autorise les imports de modules depuis :

```txt
https://pokegang.sterenna.fr
```

Headers attendus :

```txt
Access-Control-Allow-Origin: https://pokegang.sterenna.fr
Access-Control-Allow-Methods: GET, OPTIONS
Cross-Origin-Resource-Policy: cross-origin
```

Si PokéGang voit encore une erreur CORS, purger Cloudflare sur :

```txt
https://nitro.sterenna.fr/shared/supabase-client.js
https://nitro.sterenna.fr/shared/auth.js
https://nitro.sterenna.fr/shared/profile.js
https://nitro.sterenna.fr/shared/config.js
```

---

## Développement local

Ce repo est une app statique vanilla : HTML, CSS, JavaScript modules ES natifs.

Lancer localement :

```bash
python -m http.server 8080
```

Puis ouvrir :

```txt
http://localhost:8080/
```

Pour tester Supabase localement, créer temporairement un fichier :

```txt
shared/config.js
```

avec :

```js
export const SUPABASE_URL = 'https://...supabase.co';
export const SUPABASE_ANON = 'sb_publishable_...';
```

Ne pas commiter ce fichier.

---

## Sécurité

Ne jamais commiter :

- `.env` ;
- `shared/config.js` généré ;
- `config.js` racine contenant des clés ;
- clé `service_role` Supabase ;
- mot de passe database ;
- JWT secret ;
- clé privée SSH.

---

## Repos liés

| Repo | Rôle | Déploiement |
|---|---|---|
| `gwen-ha-star-static` | Hub Nitro + shared auth | `~/nitro/` |
| `botanica-obscura` | App Botanica connectée à Nitro | `~/nitro/botanica/` |
| `pokegang-game` | Jeu autonome + intégration Nitro progressive | `~/pokegang/` |

---

*Sterenna EI — Gwen Ha Star / Nitro — 2025-2026*
