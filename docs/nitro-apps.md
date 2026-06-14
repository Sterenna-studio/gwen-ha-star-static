# Nitro apps

Ce document décrit comment ajouter et synchroniser des projets dans l'écosystème Nitro.

## Rôle de `gwen-ha-star-static`

`gwen-ha-star-static` reste le socle central :

- hub public Gwen Ha Star ;
- connexion Supabase / Nitro ;
- cockpit `/star/` ;
- shared core `/shared/` ;
- registre des apps Nitro dans `/shared/nitro-apps.js`.

Les gros projets doivent rester dans leurs propres repos et se déployer sous un chemin Nitro dédié.

## Convention d'URL

```txt
https://nitro.sterenna.fr/
├── star/             # cockpit membre
├── star/casino/      # Star Arcade
├── botanica/         # Botanica Obscura, repo séparé
├── TCG/              # TCG
├── jukebox/          # jukebox
├── shared/           # modules communs
└── future-app/       # futurs projets Nitro
```

## Convention repo séparé

Pour une app autonome :

```txt
repo-name
→ GitHub Actions
→ rsync SSH
→ ~/nitro/<app>/
→ https://nitro.sterenna.fr/<app>/
```

Exemple actuel :

```txt
sterenna-studio/botanica-obscura
→ ~/nitro/botanica/
→ https://nitro.sterenna.fr/botanica/
```

## Auth partagée

Les apps servies sous `nitro.sterenna.fr` peuvent utiliser :

```js
import { supabase } from '/shared/supabase-client.js';
import { requireAuth } from '/shared/guards.js';
import { getProfile } from '/shared/profile.js';
```

## Apps externes

Les apps sur un autre sous-domaine, comme PokéGang, peuvent importer `/shared` via CORS mais ne partagent pas automatiquement le localStorage Supabase.

```txt
https://pokegang.sterenna.fr
```

Pour ces apps, l'intégration Nitro doit passer par une liaison de compte progressive.

## Ajouter une app au catalogue

Modifier :

```txt
shared/nitro-apps.js
```

Ajouter une entrée :

```js
{
  id: 'my-app',
  name: 'My App',
  url: '/my-app/',
  icon: '✨',
  status: 'alpha',
  scope: 'nitro-app',
  auth: 'required',
  repo: 'sterenna-studio/my-app',
  deployPath: '~/nitro/my-app/',
  description: 'Description courte.'
}
```

## Secrets GitHub requis pour une app séparée

```txt
OVH_HOST
OVH_USER
OVH_SSH_KEY
```

Si l'app utilise le shared Nitro, elle n'a normalement pas besoin de secrets Supabase propres.

## Checklist

- [ ] app ajoutée à `shared/nitro-apps.js`
- [ ] workflow GitHub Actions configuré
- [ ] chemin distant `~/nitro/<app>/`
- [ ] imports `/shared/...` si auth nécessaire
- [ ] README du repo mis à jour
- [ ] lien ajouté dans le hub ou le cockpit Star si utile

> Pour **afficher les données** d'une app dans le cockpit Star (widget),
> voir [integrer-widget-star.md](integrer-widget-star.md).
