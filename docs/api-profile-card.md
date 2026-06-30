# API — Profile Card

Endpoint public permettant de récupérer les infos de base d'un profil Gwen-Ha-Star (carte CIG).
Conçu pour être utilisé depuis des projets externes : bot Discord, overlay Twitch, autres sites Sterenna.

## Endpoint

```
GET https://nmdjrcswlnydglrxaivx.supabase.co/functions/v1/profile-card
```

### Authentification

Aucune. L'endpoint est **public** — pas de JWT, pas d'API key requis.

---

## Paramètres

| Paramètre | Type | Où | Description |
|-----------|------|----|-------------|
| `username` | string | query string **ou** path | Pseudo du profil à récupérer |

### Deux formats supportés

```
# Query string
GET /functions/v1/profile-card?username=pierrot

# Path param
GET /functions/v1/profile-card/pierrot
```

---

## Réponse

### 200 — Profil trouvé

```json
{
  "username": "pierrot",
  "avatar_url": "https://...",
  "avatar_frame": "gold",
  "bio": "Développeur & fondateur Sterenna.",
  "lang": "fr",
  "role": "superuser",
  "chronicles": 1250,
  "joined_at": "2024-03-01T12:00:00.000Z",
  "active_title": "Fondateur",
  "titles_count": 5,
  "specialty": "Développeur",
  "titles": [
    {
      "slug": "fondateur",
      "label_fr": "Fondateur",
      "label_en": "Founder",
      "rarity": "legendary",
      "category": "general",
      "unlocked_at": "2024-03-01T12:00:00.000Z"
    }
  ],
  "games": {
    "lol_id": "Pierrot#EUW",
    "rl_id": "Pierrot#sterenna",
    "tcg": {
      "total_cards": 42,
      "wins": 10,
      "losses": 3,
      "elo": 1200
    },
    "pokegang": {
      "gang_name": "Team Sterenna",
      "boss_name": "Pikachu Boss",
      "reputation": 9800,
      "total_caught": 312,
      "shiny_count": 7
    }
  }
}
```

### Champs détaillés

| Champ | Type | Description |
|-------|------|-------------|
| `username` | string | Pseudo unique du profil |
| `avatar_url` | string \| null | URL de l'avatar |
| `avatar_frame` | string \| null | Identifiant du cadre d'avatar équipé |
| `bio` | string \| null | Biographie |
| `lang` | `"fr"` \| `"en"` | Langue préférée |
| `role` | `"guest"` \| `"superuser"` | Rôle sur la plateforme |
| `chronicles` | integer | Solde de Chronicles (monnaie) |
| `joined_at` | ISO 8601 | Date d'inscription |
| `active_title` | string \| null | Titre actif affiché sur la CIG |
| `titles_count` | integer | Nombre total de titres débloqués |
| `specialty` | string \| null | Spécialité du profil |
| `titles` | array | Liste complète des titres débloqués (voir ci-dessous) |
| `games.lol_id` | string \| null | Identifiant League of Legends (ex: `Pseudo#EUW`) |
| `games.rl_id` | string \| null | Identifiant Rocket League |
| `games.tcg` | object \| null | Stats TCG Chronicles (null si non inscrit) |
| `games.pokegang` | object \| null | Stats Pokegang (null si non inscrit) |

#### Objet `titles[]`

| Champ | Type | Description |
|-------|------|-------------|
| `slug` | string | Identifiant unique du titre |
| `label_fr` | string | Libellé français |
| `label_en` | string | Libellé anglais |
| `rarity` | `"common"` \| `"rare"` \| `"epic"` \| `"legendary"` | Rareté |
| `category` | string | Catégorie du titre |
| `unlocked_at` | ISO 8601 | Date de déverrouillage |

### 400 — Paramètre manquant

```json
{ "error": "Missing username. Use ?username=xxx or /profile-card/xxx" }
```

### 404 — Profil introuvable

```json
{ "error": "Profile not found", "username": "inconnu" }
```

---

## Exemples d'utilisation

### JavaScript / Fetch (browser ou Node)

```js
const BASE = 'https://nmdjrcswlnydglrxaivx.supabase.co/functions/v1';

async function getProfile(username) {
  const res = await fetch(`${BASE}/profile-card?username=${username}`);
  if (!res.ok) throw new Error(`Profile not found: ${username}`);
  return res.json();
}

const profile = await getProfile('pierrot');
console.log(profile.active_title, profile.chronicles);
```

### Bot Discord (discord.js)

```js
// Commande slash /profil [username]
async execute(interaction) {
  const username = interaction.options.getString('username');
  const res = await fetch(
    `https://nmdjrcswlnydglrxaivx.supabase.co/functions/v1/profile-card?username=${username}`
  );

  if (res.status === 404) {
    return interaction.reply({ content: `Profil \`${username}\` introuvable.`, ephemeral: true });
  }

  const p = await res.json();
  const embed = {
    title: `${p.username} — ${p.active_title ?? 'Recrue'}`,
    description: p.bio ?? 'Pas de bio.',
    fields: [
      { name: '💰 Chronicles', value: `${p.chronicles}`, inline: true },
      { name: '🏷️ Titres', value: `${p.titles_count}`, inline: true },
      { name: '🎖️ Spécialité', value: p.specialty ?? '—', inline: true },
      p.games.lol_id ? { name: 'LoL', value: p.games.lol_id, inline: true } : null,
      p.games.rl_id  ? { name: 'RL',  value: p.games.rl_id,  inline: true } : null,
    ].filter(Boolean),
    thumbnail: p.avatar_url ? { url: p.avatar_url } : undefined,
  };

  return interaction.reply({ embeds: [embed] });
}
```

### Overlay Twitch (JS vanille)

```js
const username = new URLSearchParams(location.search).get('user') ?? 'pierrot';

fetch(`https://nmdjrcswlnydglrxaivx.supabase.co/functions/v1/profile-card?username=${username}`)
  .then(r => r.json())
  .then(p => {
    document.getElementById('name').textContent    = p.username;
    document.getElementById('title').textContent   = p.active_title ?? '';
    document.getElementById('chrono').textContent  = p.chronicles;
    document.getElementById('avatar').src          = p.avatar_url ?? '';
  });
```

### Python (FastAPI / script)

```python
import httpx

def get_profile(username: str) -> dict:
    r = httpx.get(
        f"https://nmdjrcswlnydglrxaivx.supabase.co/functions/v1/profile-card",
        params={"username": username},
        timeout=5
    )
    r.raise_for_status()
    return r.json()

profile = get_profile("pierrot")
print(profile["active_title"], profile["chronicles"])
```

---

## Source

- **Edge Function** : `supabase/functions/profile-card/index.ts`
- **Déployée sur** : Supabase project `nmdjrcswlnydglrxaivx`
- **CORS** : `*` (tous les origines autorisés)
- **JWT** : désactivé (public)
