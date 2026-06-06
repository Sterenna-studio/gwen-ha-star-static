# Contribuer à l'écosystème Sterenna Studio

Bienvenue 👋 Ce dépôt (`gwen-ha-star-static`) est le **hub central** déployé sur
`nitro.sterenna.fr`. Plusieurs sous-projets vivent dans leur propre repo et sont
synchronisés ici automatiquement. Avant de coder, lis **[ARCHITECTURE.md](./ARCHITECTURE.md)**
pour comprendre les deux modèles de synchronisation.

---

## Organisation GitHub

Tous les repos sont sous l'organisation **[`sterenna-studio`](https://github.com/sterenna-studio)**.

- Les repos de l'écosystème nitro sont **publics** (pour que les org secrets gratuits
  fonctionnent en CI).
- Les secrets partagés (`SYNC_TOKEN`, `GH_PAT`, `OVH_*`, `GHSTAR_SUPABASE_*`) sont
  définis **au niveau de l'org** → jamais besoin de les recopier par repo.

---

## Démarrer en local

Aucun secret n'est requis pour développer en local. Les secrets servent **uniquement
à la CI** (déploiement, synchronisation).

### Sites statiques (gwen-ha-star-static, botanica, titan, clicker)

```bash
# n'importe quel serveur statique suffit
python -m http.server 8000
# puis http://localhost:8000/
```

### Apps Next.js (skill-arena)

```bash
cd skill-arena
npm install
npm run dev        # http://localhost:3000/arena
```

Copie `.env.example` → `.env.local` et mets tes propres clés Supabase si tu veux
tester l'auth/les scores en local (sinon le jeu tourne sans).

---

## Workflow de contribution

1. **Crée une branche** depuis `main` (jamais de push direct sur `main`) :
   ```bash
   git checkout -b feat/ma-fonctionnalite
   ```
2. **Commits** : messages clairs, en français ou anglais, à l'impératif.
   Préfixes recommandés : `feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `refactor:`.
3. **Pousse** ta branche et **ouvre une Pull Request** vers `main`.
4. **Attends la CI** (build/lint) et au moins **une review** avant de merger.
5. **Squash & merge** de préférence, pour garder un historique propre.

---

## Ajouter un nouveau sous-projet

Voir la section dédiée dans **[ARCHITECTURE.md](./ARCHITECTURE.md#ajouter-un-nouveau-sous-projet)**.
En résumé :

- **Site statique** → modèle « copie de fichiers » (`receive-<projet>.yml` ici +
  `sync-to-gwen-ha-star-static.yml` dans le repo enfant).
- **App Next.js** → modèle « submodule + build » (`deploy-<projet>.yml` +
  `sync-submodule.yml` ici, `basePath` configuré côté enfant).

Dans les deux cas, le sous-projet devient accessible sous
`nitro.sterenna.fr/<projet>/`.

---

## Conventions

- **Pas de secrets commités.** Les `.env*` sont gitignorés ; utilise les `.env.example`
  comme modèles. La clé Supabase **anon** est publique par design (protégée par RLS),
  mais la clé **service_role** ne doit JAMAIS être commitée ni mise côté client.
- **Crédits d'assets** : conserve les mentions d'auteur existantes.
- **Backend partagé** : tous les projets pointent sur le même Supabase
  (comptes & données communautaires partagés).

---

## Questions

Ouvre une issue sur le repo concerné, ou contacte un mainteneur de l'org.
