# Architecture — Écosystème Gwen Ha Star / nitro.sterenna.fr

Ce repo (`gwen-ha-star-static`) est le **hub central** déployé sur OVH à l'adresse
`nitro.sterenna.fr`. Plusieurs sous-projets vivent dans leur propre repo GitHub et
sont synchronisés ici automatiquement via GitHub Actions.

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
