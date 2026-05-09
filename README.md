# Gwen Ha Star — Site Statique

> Vitrine des projets de **Sterenna EI** — et portail d'accès aux Chronicles.
---

## 🌌 Concept

**Gwen Ha Star** (« Blanc et Étoile » en breton) est le site principal de Sterenna EI.  
Il sert à la fois de vitrine publique des projets et de point d'entrée vers un espace membres : **les Chronicles**.

Toute personne peut s'inscrire. Une fois connectée, elle devient un **Agent des Chronicles** et accède à son cockpit personnel — le sous-espace `/star`.

---

## 🗺️ Structure du projet

```
gwen-ha-star-static/
│
├── index.html              # Page d'accueil publique — vitrine Sterenna / Gwen Ha Star
├── login.html              # Connexion agent
├── reset.html              # Demande de réinitialisation mot de passe
├── update-password.html    # Mise à jour du mot de passe (lien email Supabase)
│
├── cig.html                # CIG — Carte d'Identification Galactique (profil membre connecté)
│
├── config.js               # Configuration Supabase (clés injectées, repo PRIVÉ)
├── generate-config.sh      # Script bash : génère config.js depuis .env
├── .env.example            # Template .env (sans valeurs sensibles)
│
├── css/                    # Feuilles de style globales
├── js/
│   ├── auth.js             # Gestion authentification (guards, redirections)
│   ├── supabase.js         # Client Supabase + helpers auth
│   ├── data.js             # Requêtes données Supabase
│   ├── main.js             # Init page principale
│   ├── radar.js            # Composant radar (visualisation)
│   ├── theme.js            # Toggle light/dark mode
│   └── star/               # Scripts spécifiques à l'espace Star
│
├── star/                   # Espace membres connectés — "le cockpit du Gwen Ha Star"
│   └── ...                 # Hub agents : projets, jeux, infos, crew
│
├── jukebox/                # Lecteur musical (JukeboxPlayer — web component autonome)
│
└── TCG/                    # Projet interne — Trading Card Game Sterenna (accès via /star)
    └── ...                 # App TCG full-stack statique avec Supabase
```

---

## 🧭 Navigation

| Zone | Accès | Description |
|---|---|---|
| `index.html` | Public | Vitrine des projets Sterenna, présentation du Gwen Ha Star |
| `login.html` | Public | Connexion / inscription agent |
| `cig.html` | Connecté | Carte d'Identification Galactique — profil de l'agent |
| `/star` | Connecté | Cockpit — hub membres, projets internes, crew, jeux |
| `/TCG` | Connecté | Jeu de cartes à collectionner — projet interne au Star |

---

## 🛠️ Stack technique

- **HTML + JS (modules ES natifs) + CSS** — stack vanilla solide, sans framework, sans bundler
- **Architecture modulaire** — chaque fonctionnalité est un module JS importé explicitement (`import/export`)
- **Supabase** — authentification + base de données (PostgreSQL), SDK chargé via `esm.sh`
- **OVH Hébergement Web** — déploiement continu via webhook GitHub (auto-pull à chaque push sur `main`)

---

## 🌐 Écosystème des projets

Les projets Sterenna s'articulent autour du Star selon deux modèles :

### Projets internes — vivent dans le Star
Hébergés directement dans ce repo, accessibles uniquement aux agents connectés.

| Projet | Dossier | Description |
|---|---|---|
| TCG Sterenna | `/TCG` | Jeu de cartes à collectionner, collection et duels |
| Jukebox | `/jukebox` | Lecteur musical ambiance (web component) |

### Projets externes — vivent librement, enrichis par le Star
Projets autonomes avec leur propre existence, mais dont la connexion au compte Star débloque des fonctionnalités supplémentaires.

| Projet | Description |
|---|---|
| **PokeGang** | Jeu Pokemon indépendant — la connexion au Star offre bonus, synergies et profil partagé |

> D'autres projets externes pourront rejoindre cet écosystème via l'API Supabase partagée.

---

## 🚀 Déploiement

Le repo est lié à l'hébergement OVH via un **webhook GitHub**.  
À chaque `git push` sur `main`, OVH pull automatiquement les changements.

### Workflow local

```bash
# 1. Cloner le repo
git clone https://github.com/MutenRock/gwen-ha-star-static.git
cd gwen-ha-star-static

# 2. Créer le fichier .env (non versionné)
cp .env.example .env
# → remplir SUPABASE_URL et SUPABASE_ANON_KEY dans .env

# 3. Générer config.js avec les vraies clés
bash generate-config.sh
```

> ⚠️ **Repo PRIVÉ** — `config.js` contient les clés Supabase.  
> Ne jamais repasser le repo en public sans avoir vidé `config.js` au préalable.

---

## 👥 Crew

Tous les agents connectés au Star font partie du Crew et sont visibles dans l'espace `/star`.

---

*Sterenna EI — © 2025-2026*
