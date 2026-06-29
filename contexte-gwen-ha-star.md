# 🌌 Contexte — Gwen Ha Star Static
> Prompt de reprise de conversation — à coller en début de nouvelle session

---

## 🧑‍💻 Qui suis-je ?
- **Pierre H**, développeur/entrepreneur, Limoges (France)
- Business : **Sterenna EI** — 3D printing, miniatures, services web, assets digitaux
- Stack principale : JS vanilla (ES modules), Python, Bash, SQL, HTML/CSS
- Infra : OVH Hébergement Web, Supabase, Cloudflare DNS, GitHub (repos privés)

---

## 📦 Le projet : `gwen-ha-star-static`
**Repo GitHub privé** : `MutenRock/gwen-ha-star-static`

### Concept (lore)
**Gwen Ha Star** = "Blanc et Étoile" en breton — site principal de Sterenna EI.
- Vitrine publique des projets Sterenna
- Portail d'accès à un espace membres : **les Chronicles**
- Les membres connectés deviennent des **Agents des Chronicles**
- L'espace membres s'appelle **le cockpit** → accessible via `/star`

### Structure du repo
```
gwen-ha-star-static/
├── index.html              # Vitrine publique — présentation Sterenna / Gwen Ha Star
├── login.html              # Connexion agent
├── reset.html              # Reset mot de passe
├── update-password.html    # Mise à jour password (lien email Supabase)
├── cig.html                # CIG — Carte d'Identification Galactique (profil membre)
├── config.js               # Config Supabase (clés injectées — repo PRIVÉ)
├── generate-config.sh      # Script bash : génère config.js depuis .env
├── .env.example            # Template .env (sans valeurs sensibles)
├── css/                    # Styles globaux
├── js/
│   ├── auth.js             # Guards auth + redirections
│   ├── supabase.js         # Client Supabase + helpers
│   ├── data.js             # Requêtes Supabase
│   ├── main.js             # Init page principale
│   ├── radar.js            # Composant radar (visualisation)
│   ├── theme.js            # Toggle light/dark mode
│   └── star/               # Scripts espace Star
├── star/                   # Espace membres connectés (cockpit)
├── jukebox/                # Lecteur musical (web component autonome)
└── TCG/                    # Trading Card Game Sterenna (accès via /star)
```

### Navigation
| Zone | Accès | Description |
|---|---|---|
| `index.html` | Public | Vitrine Sterenna |
| `login.html` | Public | Connexion / inscription agent |
| `cig.html` | Connecté | Carte d'Identification Galactique (profil) |
| `/star` | Connecté | Cockpit — hub membres, projets, crew |
| `/TCG` | Connecté | Jeu de cartes — projet interne |

---

## 🛠️ Stack technique
- **HTML + JS ES modules natifs + CSS** — vanilla, sans framework, sans bundler
- **Supabase** — auth + base PostgreSQL (SDK via esm.sh)
- **OVH Hébergement Web** — déploiement continu via webhook GitHub
- **Repo PRIVÉ** — `config.js` contient les clés Supabase (ne jamais repasser public)

---

## 🌐 Écosystème Sterenna

### Projets internes (dans ce repo, accès agents connectés)
| Projet | Dossier | Description |
|---|---|---|
| TCG Sterenna | `/TCG` | Jeu de cartes à collectionner |
| Jukebox | `/jukebox` | Lecteur musical ambiance (web component) |

### Projets externes (repos séparés, enrichis par le Star)
| Projet | Description |
|---|---|
| **PokeGang** | Jeu Pokemon indépendant — connexion Star = bonus, profil partagé |

---

## 🚀 Infra déploiement (état actuel — mai 2026)

### Flux de déploiement
```
Push local → GitHub (main) → Webhook OVH → git pull sur le serveur → site en ligne
```

### Config SSH OVH (réparée le 09/05/2026)
- **Deploy key SSH** générée sur le serveur OVH : `~/.ssh/deploy_key`
- Clé publique ajoutée sur GitHub → Settings > Deploy keys (read-only)
- Config SSH OVH : `~/.ssh/config` → `Host github.com / IdentityFile ~/.ssh/deploy_key`
- Remote du repo : `git@github.com:MutenRock/gwen-ha-star-static.git` (SSH, plus HTTPS)
- **Webhook GitHub** : `https://webhooks-webhosting.eu.ovhapis.com/...` (géré par OVH Manager)
- Serveur OVH : `sterenn@ssh01.cluster129.gra.hosting.ovh.net` (php/8.4/production)
- Dossier repo sur OVH : `~/nitro`

### Workflow local
```bash
git clone https://github.com/MutenRock/gwen-ha-star-static.git
cd gwen-ha-star-static
cp .env.example .env
# → remplir SUPABASE_URL et SUPABASE_ANON_KEY dans .env
bash generate-config.sh
```

---

## 📝 Notes importantes
- ⚠️ `config.js` contient les clés Supabase → repo doit rester PRIVÉ
- Le webhook OVH est géré via **OVH Manager → Hébergements → Git** (pas manuellement)
- Si le webhook retombe en erreur 400 → reconfigurer l'association Git dans le Manager OVH
- La deploy key SSH est en **lecture seule** → sécurisé même si compromise
- Permissions clé privée : `chmod 600 ~/.ssh/deploy_key`

---

*Généré le 09/05/2026 — Sterenna EI / Gwen Ha Star*
