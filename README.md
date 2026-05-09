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
│   └── ...                 # Hub joueurs : projets, jeux, infos, crew
│
├── jukebox/                # Lecteur musical (JukeboxPlayer — composant autonome)
│
└── TCG/                    # Sous-projet indépendant — Trading Card Game Sterenna
    └── ...                 # App TCG full-stack statique avec Supabase
```

---

## 🧭 Navigation

| Zone | Accès | Description |
|---|---|---|
| `index.html` | Public | Vitrine des projets Sterenna, présentation du Gwen Ha Star |
| `login.html` | Public | Connexion / inscription agent |
| `cig.html` | Connecté | Carte d'Identification Galactique — profil de l'agent |
| `/star` | Connecté | Cockpit — hub membres, projets, crew, jeux |
| `/TCG` | Variable | Jeu de cartes à collectionner Sterenna |

---

## 🛠️ Stack technique

- **HTML / CSS / JS vanilla** — aucun framework, site 100% statique
- **Supabase** — authentification + base de données (PostgreSQL)
- **OVH Hébergement Web** — déploiement via webhook GitHub (auto-pull à chaque push)
- **esm.sh** — import ESM du SDK Supabase côté client

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

Membres Sterenna EI — tous les agents connectés apparaissent dans l'espace `/star`.

---

## 📁 Projets liés

| Projet | Dossier | Description |
|---|---|---|
| TCG Sterenna | `/TCG` | Jeu de cartes à collectionner — app statique Supabase |
| Jukebox | `/jukebox` | Lecteur musical autonome (web component) |

---

*Sterenna EI — © 2025-2026*
