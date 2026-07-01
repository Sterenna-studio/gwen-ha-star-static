# Schéma C.I.G. — Carte d'Identification Galactique

> Dernière mise à jour : 2026-07-01  
> Concerne : `app/cig/page.tsx` dans **Korigan** · Supabase project `gwen-ha-star`

---

## Tables impliquées

### `profiles`
Table principale du profil agent. Liée à `auth.users` via `id`.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` | Clé primaire, = `auth.users.id` |
| `email` | `text` | Email de l'agent |
| `username` | `text` | Callsign (3–24 chars, `[a-zA-Z0-9_-]`) |
| `specialty` | `text` | Spécialité libre (ou FK vers `specialties.id`) |
| `specialty_id` | `uuid` | FK → `specialties.id` (optionnelle) |
| `bio` | `text` | Bio courte, max 200 caractères |
| `lang` | `text` | Langue préférée (`fr` ou `en`) |
| `active_title` | `text` | Slug du titre actif (FK → `titles.slug`) |
| `avatar_url` | `text` | URL publique de l'avatar (Supabase Storage) |
| `role` | `text` | Rôle (`all` ou `superuser`) |
| `joined_at` | `timestamptz` | Date d'enrollment |

---

### `titles`
Référentiel de tous les titres du jeu.

| Colonne | Type | Description |
|---|---|---|
| `slug` | `text` | Clé primaire (ex: `pionnier`) |
| `label_fr` | `text` | Label affiché en français |
| `rarity` | `text` | `common` \| `rare` \| `epic` \| `legendary` |

---

### `profile_titles`
Table de jointure many-to-many — titres débloqués par agent.

| Colonne | Type | Description |
|---|---|---|
| `profile_id` | `uuid` | FK → `profiles.id` |
| `title_slug` | `text` | FK → `titles.slug` |

---

## Foreign Keys déclarées dans Supabase

Vérifiées le 2026-07-01 via `information_schema.table_constraints` :

```
profile_titles.profile_id  →  profiles.id       (profile_titles_profile_id_fkey)
profile_titles.title_slug  →  titles.slug        (profile_titles_title_slug_fkey)
profiles.specialty_id      →  specialties.id     (profiles_specialty_id_fkey)
```

> ⚠️ Il existe aussi une table `agent_titles` avec des FK sur `titles.id` (integer, pas slug).  
> C'est un ancien système — ne pas utiliser pour la CIG. Utiliser uniquement `profile_titles`.

---

## Requête Supabase unifiée (1 seul round-trip)

La CIG charge toutes les données en **une seule requête** grâce aux FK déclarées.
PostgREST résout les jointures côté serveur en SQL natif.

```ts
const { data } = await supabase
  .from('profiles')
  .select(`
    *,
    profile_titles (
      title_slug,
      titles (*)
    )
  `)
  .eq('id', userId)
  .single()
```

### Résultat typé

```ts
type ProfileTitleJoined = {
  title_slug: string
  titles: TitleRecord | null
}

type ProfileWithJoins = ProfileRecord & {
  profile_titles: ProfileTitleJoined[]
}
```

### Extraction côté client

```ts
const joinedTitles = data.profile_titles || []

// Slugs débloqués
const unlockedSlugs = joinedTitles.map(pt => pt.title_slug)

// Objets TitleRecord dédupliqués
const titlesMap = new Map<string, TitleRecord>()
joinedTitles.forEach(pt => {
  if (pt.titles) titlesMap.set(pt.titles.slug, pt.titles)
})
const allTitles = Array.from(titlesMap.values())
```

---

## Avant / Après — impact performance

| | Avant | Après |
|---|---|---|
| Requêtes au chargement | **3** (profiles, titles, profile_titles séparées) | **1** |
| Round-trips réseau | 3× | 1× |
| Import `ProfileTitleRecord` | Présent | Supprimé (non nécessaire) |

---

## Améliorations CIG (2026-07-01)

Liste des améliorations apportées à `app/cig/page.tsx` :

- **Affichage `joined_at`** — date d'enrollment formatée en français dans le header agent
- **Affichage rôle et spécialité** — badges visibles dans le bloc Agent ID
- **Titre actif coloré** — couleur selon la rareté du titre dans le header
- **Validation username en live** — regex + longueur, erreur inline, Save bloqué si invalide
- **Bio avec compteur** — max 200 chars, compteur jaune à 180, rouge à 200
- **Sélecteur titre visuel** — liste scrollable avec couleur rareté + label LÉGENDAIRE/ÉPIQUE/RARE/COMMUN
- **Titres groupés par rareté** — section Titres organisée par groupe avec compteur `X/Y` par rareté
- **Live preview enrichi** — preview affiche le titre actif avec sa couleur et son label de rareté
- **Danger Zone collapsible** — section rétractable avec UUID agent, pas de bouton destructeur direct
- **Indicateur SYNCED/MODIFIED** — statut visible en temps réel
- **Bouton Reset** — annule les changements non sauvegardés
- **Guard `beforeunload`** — alerte si l'utilisateur quitte avec des modifications non sauvegardées

---

## Couleurs de rareté (`TITLE_RARITY_COLORS`)

```ts
// app/lib/profile-data.ts
export const TITLE_RARITY_COLORS = {
  common:    '#8a9ab5',   // gris-bleu
  rare:      '#3ecfcf',   // cyan
  epic:      '#7b5cf0',   // violet
  legendary: '#f9ca24',   // or
}
```

---

## Storage avatar

- Bucket : `avatars`
- Path : `{profile_id}/avatar.{ext}`
- Upload avec `upsert: true` (remplace l'existant)
- URL publique via `supabase.storage.from('avatars').getPublicUrl(path)`
