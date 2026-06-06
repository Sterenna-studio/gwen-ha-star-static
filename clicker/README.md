# Nitro Clicker

> Private local-only clicker game connected to the Nitro / Gwen Ha Star ecosystem.

Nitro Clicker is a small authenticated web app deployed under Nitro:

```txt
https://nitro.sterenna.fr/clicker/
```

It is designed as a quick progression loop for the Star ecosystem:

```txt
click → collect energy → buy upgrades → generate passive energy → prestige
```

## Architecture

```txt
nitro-clicker/
├── index.html
├── css/
│   └── clicker.css
├── js/
│   ├── app.js
│   ├── clicker-state.js
│   └── clicker-save.js
├── docs/
│   └── game-design.md
└── .github/workflows/
    └── deploy-ovh.yml
```

## Nitro shared auth

This app is deployed under `nitro.sterenna.fr`, so it can use the shared Nitro modules:

```js
import { requireAuth } from '/shared/guards.js';
import { getProfile } from '/shared/profile.js';
```

The app requires a Nitro session. If the user is not connected, they are redirected to:

```txt
/login.html?next=/clicker/
```

## Save model

Nitro Clicker is intentionally local-only for gameplay data.

```txt
localStorage key: nitro-clicker.save.<user_id>
```

No game table is required in Supabase. Supabase is used only for Nitro authentication/profile through `/shared`.

## Deployment

The GitHub Actions workflow deploys the app with SSH + rsync:

```txt
main branch
→ GitHub Actions
→ ~/nitro/clicker/
→ https://nitro.sterenna.fr/clicker/
```

Required GitHub secrets:

```txt
OVH_HOST
OVH_USER
OVH_SSH_KEY
```

No Supabase key is stored in this repo.

## Current status

Alpha scaffold:

- Nitro auth required
- localStorage save only
- click power upgrades
- passive generation upgrades
- prestige loop placeholder
- offline progress from local timestamp
