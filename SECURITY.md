# Politique de sécurité

## Versions supportées

Le projet suit un versioning [SemVer](https://semver.org/lang/fr/). Seule la
dernière version publiée (`main` + dernier tag `vX.Y.Z`) reçoit des correctifs
de sécurité.

| Version | Supportée |
|---|---|
| dernière `main` / dernier tag | ✅ |
| versions antérieures | ❌ |

## Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique pour une faille de sécurité.**

Privilégier le **Private Vulnerability Reporting** de GitHub :
*Onglet Security → Report a vulnerability* (à activer dans les paramètres du
repo si ce n'est pas déjà fait).

À défaut, contact direct : **pierrehoyaux1@gmail.com**.

Merci d'inclure : description, étapes de reproduction, impact estimé, et si
possible une suggestion de correctif. Réponse visée sous quelques jours.

## Périmètre & modèle de sécurité

- **Backend partagé Supabase** : l'authentification et l'autorisation reposent
  sur Supabase Auth + **Row Level Security (RLS)**. La sécurité des données est
  garantie côté serveur par les policies RLS, pas par le code client.
- **Clés publiques** : la clé `anon` / `sb_publishable_…` est **publique par
  design** et présente dans le code livré au navigateur. Ce n'est pas un secret.
  La clé **`service_role` est secrète** et ne doit jamais être committée
  (elle vit uniquement dans `.env`, gitignoré, et dans les secrets GitHub
  Actions).
- **Zone admin** : double barrière — rôle `superuser` vérifié via Supabase
  (`profiles.role`) **et** Basic Auth Apache sur les consoles admin
  (`admin-*` à la racine, `star/admin/`).

## Chaîne d'outils (supply-chain)

Le repo exécute automatiquement (voir `.github/workflows/`) :

- **Dependency Review** — revue des dépendances ajoutées en pull request.
- **Gitleaks** — scan de secrets sur l'historique complet
  (allowlist des clés publiques dans `.gitleaks.toml`).
- **Trivy** — scan filesystem (vulnérabilités, secrets, misconfig) → SARIF
  publié dans l'onglet *Security*.
- **CodeQL** — analyse statique JavaScript/TypeScript.
- **SBOM** — génération d'un SBOM SPDX JSON à chaque push/tag.
- **Dependabot** — mises à jour hebdomadaires des GitHub Actions.

## Fuites historiques connues (à faire tourner)

Le scan gitleaks initial a détecté des clés dans **d'anciens commits** (déjà
retirées de l'arbre courant, mais l'historique public reste lisible). Elles sont
baseline-ées dans [`.gitleaksignore`](.gitleaksignore) et **doivent être
considérées comme compromises** :

| Clé | Emplacement historique | Action |
|---|---|---|
| YouTube Data API | `js/chronicles-fm-widget.js` | Régénérer + restreindre (Google Cloud Console) |
| Riot Games API | `star/index.html` | Régénérer (Riot Developer Portal) |
| Supabase JWT `anon` (`imryukpbtkngsihxfxox`) | `TCG/shared/supabaseClient.js` | Publique par design — rotation optionnelle |

> Baseliner (`.gitleaksignore`) ≠ corriger : la vraie remédiation est la
> **rotation** côté fournisseur. Le baseline sert uniquement à garder le CI
> vert tout en continuant de détecter les **nouvelles** fuites.

## Politique de tags / releases (SemVer)

- `v0.1.0` — première version propre.
- **PATCH** (`vX.Y.Z+1`) — correctif de bug, de vulnérabilité ou bump de
  dépendance sans changement d'API.
- **MINOR** (`vX.Y+1.0`) — nouvelle fonctionnalité rétrocompatible.
- **MAJOR** (`vX+1.0.0`) — changement cassant (breaking change).

Créer un tag (aucun tag n'est créé automatiquement) :

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```
