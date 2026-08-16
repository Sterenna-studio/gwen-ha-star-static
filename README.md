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

Le contrat de supervision `KORIGAN · CHAT STATE` / `CHAT BUS` est documenté dans :

```txt
/docs/korigan-chat-bus.md
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
│   ├── korigan-chat-bus.md       # Contrat Korigan Chat State / Chat Bus
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
│   └── home-sections.css         # Garde-fou d'ordre v3.0 + section Musiques & Radio
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
└── .github/
    ├── dependabot.yml           # Bumps hebdo des GitHub Actions
    └── workflows/
        ├── deploy-ovh.yml       # Déploiement SSH/rsync vers OVH ~/nitro/
        ├── security.yml         # Dependency review, gitleaks, trivy, audits
        ├── codeql.yml           # Analyse statique JS/TS
        └── sbom.yml             # SBOM SPDX
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
| `/docs/korigan-chat-bus.md` | Technique | Contrat Korigan Chat State / Chat Bus |
| `/docs/space-background-ships.md` | Technique | Guide vaisseaux, éléments, presets et agent IA |
| `/TCG/` | Connecté | App TCG, selon déploiement actif |
| `/jukebox/` | Public / intégré | Lecteur musical et Chronicles FM |
| `https://lab.sterenna.fr/quiz/` | Public / externe | Hub Quizz, maintenu dans le dépôt dédié `Sterenna-studio/quizz` |
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

Le hero `GWEN HA STAR` est une introduction non numérotée. Les sections numérotées commencent ensuite dans cet ordre :

1. `// 01 · ACCÈS DIRECT` — Outils & Univers.
2. `// 02 · STREAM LIVE` — Twitch live.
3. `// 03 · CHAÎNE` — YouTube @mutenrock.
4. `// 04 · MUSIQUES & RADIO` — Jukebox Dr.Spig, Web Radio / playlists YouTube et Chronicles FM.

La section `MUSIQUES & RADIO` conserve les ancres internes utilisées par les cartes du haut :

```txt
#jukebox
#web-radio
#chronicles-fm
```

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

---

## Tests

Le repo n'a pas de build, mais a des specs sur la logique pure (sans DOM) via
le runner intégré de Node — zéro dépendance (`package.json` n'a aucun
`devDependency`) :

```bash
npm test
```

Couvre par exemple le cache de `probeRadioSite` et le calcul des gains
`SlotMachine._evaluateLines` (`js/star/widget-*.js`), en instanciant les
classes via `Object.create(...)` pour éviter le DOM tout en testant le vrai
code de prod. Voir `test/`. Tourne en CI sur chaque push/PR
(`.github/workflows/test.yml`).

---

## Sécurité / Supply-chain

La politique complète est dans [`SECURITY.md`](SECURITY.md). En résumé, la CI
applique en continu (voir `.github/workflows/`) :

| Check | Déclencheur | Rôle |
|---|---|---|
| **Dependency Review** | pull request | Bloque les dépendances vulnérables ajoutées (seuil : moderate) |
| **Gitleaks** | push / PR / hebdo | Scan de secrets sur tout l'historique |
| **Trivy** | push / PR / hebdo | Vulnérabilités + secrets + misconfig → onglet *Security* (SARIF) |
| **CodeQL** | push / PR / hebdo | Analyse statique JavaScript / TypeScript |
| **SBOM** | push / tag `v*` | Génère un SBOM SPDX JSON |
| **Dependabot** | hebdo | Met à jour les GitHub Actions |

> Rappel : la clé Supabase `anon` / `sb_publishable_…` est **publique par
> design** (RLS côté serveur). Seule la clé `service_role` est secrète et ne
> doit jamais être committée.

### Versioning (SemVer)

Aucun tag n'est créé automatiquement. Convention :

- `v0.1.0` — première version propre ;
- **PATCH** — fix / vuln / bump de dépendance ;
- **MINOR** — feature rétrocompatible ;
- **MAJOR** — breaking change.

```bash
git tag -a v0.1.0 -m "v0.1.0" && git push origin v0.1.0
```

### À activer manuellement dans GitHub (une fois)

- **Settings → Code security** : Dependabot **alerts** + **security updates**.
- **Secret scanning** + **push protection**.
- **Private vulnerability reporting**.
- **CodeQL** : ce repo fournit `codeql.yml` (advanced). Ne pas activer aussi le
  *default setup* (mutuellement exclusifs).
- **Branch protection sur `main`** : PR obligatoire, status checks requis
  (Security / CodeQL), pas de force-push, workflow permissions en *read-only*
  par défaut.
