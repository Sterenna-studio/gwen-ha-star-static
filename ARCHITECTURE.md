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

## Deux modèles de synchronisation

Selon la nature du sous-projet, l'un des deux modèles est utilisé.

### 🟢 Modèle A — Copie de fichiers (sites statiques)

Pour les projets **déjà statiques** (HTML/CSS/JS sans build).

```
push sur le repo enfant
  → repository_dispatch [sync-<projet>]
    → workflow "receive-<projet>.yml" dans ce repo
      → checkout du repo enfant
      → cp -r dans le sous-dossier <projet>/
      → commit des fichiers DANS gwen-ha-star-static
        → deploy-ovh.yml déploie tout vers ~/nitro/
```

- **Secret utilisé** : `SYNC_TOKEN`
- **Les fichiers sont committés** physiquement dans ce repo.
- **URL finale** : `nitro.sterenna.fr/<projet>/`

| Projet | Repo | Sous-dossier | Workflow |
|---|---|---|---|
| Botanica Obscura | `sterenna-studio/botanica-obscura` | `botanica-obscura/` | `receive-botanica-obscura.yml` |
| Nitro Clicker | `sterenna-studio/nitro-clicker` | `clicker/` | `receive-nitro-clicker.yml` |

### 🔵 Modèle B — Submodule + build (apps Next.js)

Pour les projets nécessitant une **étape de build** (Next.js, etc.).

```
push sur le repo enfant
  → repository_dispatch [<projet>-updated]
    → deux workflows dans ce repo :
       1. sync-submodule.yml  → met à jour la référence submodule (versioning)
       2. deploy-<projet>.yml → npm ci + npm run build → rsync out/ vers OVH
```

- **Secret utilisé** : `GH_PAT`
- **Seule une référence de commit** est stockée (submodule, pas les fichiers).
- **URL finale** : `nitro.sterenna.fr/<projet>/` (via `basePath` Next.js)

| Projet | Repo | Submodule | basePath | Déploie vers |
|---|---|---|---|---|
| Skill Arena | `sterenna-studio/skill-arena` | `skill-arena/` | `/arena` | `~/nitro/arena/` |

---

## Secrets requis (Settings → Secrets → Actions)

Dans **ce repo** (`gwen-ha-star-static`) :

| Secret | Usage |
|---|---|
| `SYNC_TOKEN` | Checkout des repos enfants (modèle A) |
| `GH_PAT` | Submodules + déclenchement croisé (modèle B) |
| `OVH_HOST` / `OVH_USER` / `OVH_SSH_KEY` | Déploiement SSH/rsync vers OVH |
| `GHSTAR_SUPABASE_URL` / `GHSTAR_SUPABASE_ANON` | Config Supabase injectée au build |

Dans **chaque repo enfant** : le token (`SYNC_TOKEN` ou `GH_PAT`) pour pouvoir
déclencher le `repository_dispatch` vers ce repo.

---

## Backend partagé

Tous les projets pointent sur **le même projet Supabase**
(`nmdjrcswlnydglrxaivx.supabase.co`) — comptes, scores et données communautaires
sont donc partagés à travers l'écosystème.

- Sites statiques : `shared/config.js` généré au déploiement.
- Next.js : `.env.local` injecté au build (`NEXT_PUBLIC_SUPABASE_*`).

---

## Ajouter un nouveau sous-projet

**Site statique** → copier `receive-nitro-clicker.yml`, adapter le nom du repo,
le sous-dossier et l'event type. Ajouter le dispatch dans le repo enfant.

**App Next.js** → copier `deploy-skill-arena.yml` + `sync-submodule.yml`, adapter,
ajouter le submodule (`git submodule add`), configurer `basePath` dans le projet
enfant et ajouter le workflow `notify-parent.yml` côté enfant.
