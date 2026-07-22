# Architecture — Écosystème Gwen Ha Star / nitro.sterenna.fr

Ce repo (`gwen-ha-star-static`) est le **hub central** déployé sur OVH à l'adresse
`nitro.sterenna.fr`. Plusieurs sous-projets vivent dans leur propre repo GitHub et
sont synchronisés ici automatiquement via GitHub Actions.

---

## Architecture de la Home (`index.html`)

> **Statut : validé — stable avant refacto `home.js`**
> Dernière mise à jour : juillet 2026

### 1. Head / base technique

La page charge les CSS globaux dans cet ordre :

```
base.css → theme.css → components.css → auth.css → hub.css → home.css
```

Un script inline anti-FOUT restaure le thème via `sessionStorage.getItem('ghs-theme')`
avant tout rendu, pour éviter le flash de thème par défaut.

---

### 2. Couches visuelles globales

| Couche | Mécanisme | Source |
|---|---|---|
| Scanlines | CSS pur, overlay fixe | `hub.css` |
| Fond spatial animé | Injecté par JS | `/js/space-background.js` |
| Console HUB VERSION | Injectée si `.hub-hero` présent | `/js/space-background.js` |

Le fond spatial charge la config depuis Supabase (`space_background_config` id `home`),
ce qui permet à l'admin de modifier le preset en live sans toucher au HTML.

La console HUB VERSION est masquée pour les non-superusers et permet de naviguer
entre les variantes archivées dans `/versions/`. **Les libellés historiques de cette
console sont à nettoyer lors de la prochaine passe de maintenance.**

---

### 3. Structure des sections HTML

```
index.html
├── <head>          CSS globaux + script anti-FOUT
├── .scanlines      Overlay visuel (CSS)
├── <header>        Logo · bouton thème ◐ · zone auth (#header-auth)
├── .hub-hero       Hero : baseline / titre / sous-texte / CTA → /star/index.html
├── #acces-direct   Grille de cartes (menu principal)
├── #twitch         Player live (placeholder → iframe au clic/viewport)
├── #jukebox        Mini-lecteur audio local Dr.Spig
├── #web-radio      Sélecteur fréquence + iframe YouTube playlists
├── #chronicles-fm  Carte narrative radio pirate
├── #youtube        Section chaîne MutenRock (embed playlist + abonnement)
└── <footer>        © 2026 STERENNA · Pierre H — HUB v2.8
```

---

### 4. Grille "Accès direct" — rôles des cartes

| Carte | Destination | Type |
|---|---|---|
| Pokegang | Lien externe univers Pokémon | Externe |
| TCG | Jeu de cartes Nitro | Interne |
| Twitch | Chaîne MutenRock | Externe |
| YouTube | Chaîne YouTube | Externe |
| Jukebox | Ancre `#jukebox` | Ancre interne |
| Web Radio | Ancre `#web-radio` | Ancre interne |
| Chronicles FM | Ancre `#chronicles-fm` | Ancre interne |
| Chronicles | `/star/index.html` portail membre | Interne |

---

### 5. Pôles audio/vidéo — frontières validées

> **Décision actée** : les trois pôles restent séparés. Leurs rôles sont distincts.

#### Jukebox (`#jukebox` + `/jukebox/`)
- **Contenu** : musiques originales locales Dr.Spig
- **Source** : fichiers dans `/audio/`
- **Contrôle** : player HTML natif (cover · titre · play/pause · progress · volume · tracklist)
- **Label UI recommandé** : "Musiques originales"

#### Web Radio (`#web-radio` + `/chronicles-fm/chronicles-fm.json`)
- **Contenu** : playlists YouTube Chronicles FM
- **Source** : `chronicles-fm.json` → select de fréquences → iframe YouTube
- **Contrôle** : `home.js` charge le JSON, remplit le `<select>`, remplace le placeholder
- **Label UI recommandé** : "Écouter"

#### Chronicles FM (`#chronicles-fm` + `/chronicles-fm/`)
- **Contenu** : carte narrative/identité de la radio pirate
- **Source** : HTML statique + widget JS (`chronicles-fm-widget.js`)
- **Contrôle** : présentation uniquement — lien vers page complète + bouton widget flottant
- **Label UI recommandé** : "Découvrir"

---

### 6. YouTube — double présence confirmée

> **Décision actée** : les deux surfaces coexistent, rôles différents.

- **Carte "Accès direct"** : lien externe rapide vers la chaîne → pour les habitués
- **Section `#youtube`** : embed playlist BZH Chronicles + avatar + bouton abonnement → pour la découverte

Pas de fusion prévue.

---

### 7. Scripts runtime de la home

| Script | Responsabilités |
|---|---|
| `/js/home.js` | Auth · thème · Twitch (lazy) · jukebox · radio YouTube · bouton widget Chronicles FM |
| `/js/chronicles-fm-widget.js` | Widget radio flottant persistant |
| `/js/space-background.js` | Fond spatial (config Supabase) · console HUB VERSION superuser |

**Règle de sécurité Twitch** : `home.js` ne recrée pas l'iframe si elle existe déjà
(vérification avant montage).

---

### 8. Roadmap refacto `home.js`

> **Prérequis validés avant découpage en modules** :
> - [x] Architecture fonctionnelle des sections documentée
> - [x] Frontières audio/video actées (Jukebox / Web Radio / Chronicles FM)
> - [x] Double présence YouTube confirmée
> - [ ] Labels UI mis à jour dans la grille "Accès direct"
> - [ ] Libellés historiques console HUB VERSION nettoyés

Une fois les prérequis cochés, `home.js` peut être découpé en :

```
home.js (orchestrateur)
├── home-auth.js       → init auth + thème
├── home-twitch.js     → player Twitch lazy
├── home-jukebox.js    → mini-lecteur Dr.Spig
└── home-radio.js      → Web Radio YouTube (load JSON + iframe)
```

`chronicles-fm-widget.js` et `space-background.js` restent indépendants.

---

## Déploiement — un seul workflow

> **État actuel** : le repo ne contient plus qu'un workflow,
> [`.github/workflows/deploy-ovh.yml`](.github/workflows/deploy-ovh.yml).
> Les anciens workflows de sync (`receive-*.yml`, `sync-submodule.yml`,
> `deploy-<projet>.yml`) ont été retirés — cette section décrit ce qui tourne
> réellement.

À chaque `push` sur `main` (ou `workflow_dispatch`), `deploy-ovh.yml` :

1. **génère `shared/config.js`** depuis les secrets Supabase (config runtime) ;
2. **construit le feed 3615** (`node scripts/build-3615-feed.mjs`) ;
3. **déploie par `rsync -avz --delete`** vers `~/nitro/` sur OVH ;
4. **smoke-teste** une liste d'URLs publiques (`curl --fail`) ;
5. **publie une entrée `activity_log`** (`git_push`) via la clé service-role.

```
push sur main
  → deploy-ovh.yml
    → génère shared/config.js (secrets)
    → build 3615-feed.json
    → rsync --delete  ./  →  sterenn@OVH:~/nitro/
    → smoke tests + activity_log
```

### ⚠️ `rsync --delete` : le garde-fou des excludes

Le web root `~/nitro/` est **partagé** : d'autres apps (Skill Arena, TCG,
Botanica, Clicker, etc.) y sont déployées **séparément**, par leurs propres
pipelines, et ne vivent **pas** dans ce repo. Comme le déploiement utilise
`--delete`, **tout dossier présent sur le serveur mais absent de ce repo serait
effacé** s'il n'est pas explicitement exclu.

➡️ **Règle** : toute app déployée séparément vers `~/nitro/<x>/` doit figurer
dans la liste `--exclude='/<x>/'` de `deploy-ovh.yml`. En cas de doute, on
**ajoute** un exclude (opération sûre) — on n'en retire jamais un sans vérifier
le contenu réel du serveur.

Excludes actuels : `.git`, `.github`, `docs/`, `icons/`, les docs racine
(`README.md`, `LICENSE`, `ARCHITECTURE.md`, `CONTRIBUTING.md`,
`contexte-gwen-ha-star.md`), `mockups/`, et les apps externes
(`arena`, `skill-arena`, `dedale`, `clicker`, `corebots`, `TCG`,
`bzh-universe`, `titan-rocket-run`, `botanica`, `botanica-obscura`,
`geotia`, `goetia`).

---

## Secrets requis (Settings → Secrets → Actions)

Utilisés par `deploy-ovh.yml` :

| Secret | Usage |
|---|---|
| `OVH_HOST` / `OVH_USER` / `OVH_SSH_KEY` | Déploiement SSH/rsync vers OVH |
| `GHSTAR_SUPABASE_URL` / `GHSTAR_SUPABASE_ANON` | Génération de `shared/config.js` |
| `GHSTAR_SUPABASE_SERVICE_ROLE` | Publication de l'`activity_log` (git_push) |

---

## Backend partagé

Tous les projets pointent sur **le même projet Supabase**
(`nmdjrcswlnydglrxaivx.supabase.co`) — comptes, scores et données communautaires
sont donc partagés à travers l'écosystème.

- Sites statiques : `shared/config.js` généré au déploiement (clé `sb_publishable_…`).
  En local, `bash generate-config.sh` reproduit ce fichier depuis `.env`.
- Next.js : `.env.local` injecté au build (`NEXT_PUBLIC_SUPABASE_*`).

---

## Ajouter un nouveau sous-projet

Les sous-projets ne sont plus synchronisés dans ce repo. Un nouveau projet
déployé sous `nitro.sterenna.fr/<x>/` est géré par **son propre pipeline** vers
`~/nitro/<x>/`. Côté ce repo, la seule action requise est d'**ajouter
`--exclude='/<x>/'`** dans `deploy-ovh.yml` pour que le `rsync --delete` ne
l'efface pas.
