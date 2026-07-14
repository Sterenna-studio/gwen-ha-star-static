# Star activity feed

Surface : `/star/index.html`, widget `#widget-activity`.

Issue de suivi : [#19](https://github.com/Sterenna-studio/gwen-ha-star-static/issues/19).

## Modules

- `js/star/activity.js` lit `public.activity_log` et écoute les `INSERT` via Supabase Realtime.
- `js/star/activity-events.js` publie les événements frontend, conserve un fallback local et retourne un statut `{ remote, local, duplicate, error }`.
- `js/star/activity-feed-schema.js` définit les canaux, types et règles de visibilité client.
- `scripts/sql/005_activity_log_security_realtime.sql` nettoie les anciennes policies, réduit les grants, ajoute l'idempotence et active Realtime.
- `scripts/sql/006_activity_log_live_producers.sql` ajoute les producteurs transactionnels côté base.

## Canaux

| Channel | Usage | Visibilité |
| --- | --- | --- |
| `personal` | Titres, gains/dépenses de Chronicles, notifications individuelles. | Membre cible uniquement (`user_id`, `target_user_id` ou `owner_id`). |
| `crew` | Administration, push Git, maintenance et configuration cockpit. | Membres connectés. Émission frontend réservée aux superusers. |
| `global` | Contenus publiés, Lemegeton, dédicaces diffusées et signaux communs. | Membres connectés. |

Le widget affiche `TOUT`, `GLOBAL`, `CREW`, `PERSO`. Le filtrage client améliore l'interface, mais la frontière de sécurité est la RLS Supabase.

## Format

```json
{
  "type": "git_push",
  "user_id": null,
  "payload": {
    "event_type": "git_push",
    "channel": "crew",
    "audience": "crew",
    "message": "Push git Sterenna-studio/gwen-ha-star-static:main · c300178 deploy OK",
    "actor": "github-actions",
    "source": "github-actions.deploy-ovh",
    "client_event_id": "github:Sterenna-studio/gwen-ha-star-static:123456:1"
  }
}
```

Règles :

- `payload.client_event_id` est obligatoire pour les producteurs serveur et doit être stable ;
- les événements `personal` doivent définir `payload.target_user_id` ;
- aucune adresse email ou donnée privée ne doit être copiée dans un message global/crew ;
- un producteur fiable définit lui-même `role`, `source`, `channel` et `audience`.

## Types supportés

- `title_unlocked` : titre obtenu ;
- `chronicles_gain` : crédit de Chronicles ;
- `chronicles_spent` : dépense de Chronicles ;
- `daily_content_published` : contenu quotidien publié ;
- `radio_dedication` : dédicace effectivement diffusée ;
- `git_push` : déploiement Git terminé ;
- `lemegeton_phrase` : phrase réellement dite ou diffusée par Lemegeton ;
- `mini_pirate_signal`, `mini_capsule_sos`, `mini_ad` : signaux ambiants ;
- `admin_background`, `admin_hero_cards`, `admin_space_background` : consoles admin ;
- `member_join`, `project`, `cig_updated` : compatibilité historique ;
- `system` : maintenance et état de la station.

## Producteurs Supabase actifs

Les producteurs suivants sont des triggers `SECURITY DEFINER` non exposés, placés dans le schéma `private`. Ils écrivent dans la même transaction que l'opération métier.

| Source | Condition | Événement | Canal |
| --- | --- | --- | --- |
| `chronicles_ledger` | chaque `INSERT` | `chronicles_gain` ou `chronicles_spent` | `personal` |
| `profiles` | création | `member_join` | `crew` |
| `profiles.titles` | nouveau titre ajouté | `title_unlocked` | `personal` |
| `daily_content` | création | `daily_content_published` | `global` |
| `radio_dedications` | passage à `played` / `played_at` défini | `radio_dedication` | `global` |

Les mises à jour fréquentes de `tcg_players` et `pokegang_players` ne sont volontairement pas journalisées à chaque sauvegarde. Ajouter seulement des événements de jalon afin d'éviter le spam.

## Producteurs frontend

Helpers disponibles dans `js/star/activity-events.js` :

- `publishActivityEvent(auth, type, message, detail)` ;
- `publishTitleUnlocked(auth, titleLabel, detail)` ;
- `publishChroniclesGain(auth, amount, reason, detail)` ;
- `publishGitPush(auth, git, detail)` ;
- `publishLemegetonPhrase(auth, phrase, detail)` ;
- `publishMiniEvent(auth, eventId, detail)`.

Le résultat d'une publication indique explicitement si l'événement est synchronisé à distance ou seulement conservé localement.

## GitHub Actions

`.github/workflows/deploy-ovh.yml` publie `git_push` après le smoke test.

Secrets nécessaires :

- `GHSTAR_SUPABASE_URL` ;
- `GHSTAR_SUPABASE_SERVICE_ROLE`.

Le second secret est serveur uniquement et ne doit jamais être écrit dans le dépôt ou exposé au navigateur. Si le secret manque, le déploiement continue mais le résumé GitHub Actions affiche un avertissement explicite.

## Sécurité Supabase

Après `005_activity_log_security_realtime.sql` :

- `anon` ne dispose d'aucun privilège sur `activity_log` ;
- `authenticated` dispose uniquement de `SELECT` et `INSERT` ;
- trois policies RLS canoniques restent actives ;
- `client_event_id` est protégé par un index unique partiel ;
- `activity_log` appartient à la publication `supabase_realtime` ;
- les fonctions de trigger privées ne sont exécutables ni par `anon`, ni par `authenticated`, ni par `PUBLIC`.

## Vérifications

```sql
select
  count(*) as total,
  count(*) filter (
    where coalesce(payload->>'source', '') not like 'supabase-backfill:%'
  ) as live_events,
  max(created_at) as latest_event
from public.activity_log;
```

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'activity_log';
```

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'activity_log';
```

Test Realtime : ouvrir le cockpit connecté, provoquer un mouvement de Chronicles ou une sauvegarde admin, puis vérifier l'apparition de l'événement sans rechargement et l'absence de doublon après refresh.

## Historique

- `003_activity_feed_channels.sql` : première version des canaux et policies ;
- `004_activity_log_recent_backfill.sql` : historique ponctuel, pas un producteur récurrent ;
- `005_activity_log_security_realtime.sql` : réparation sécurité/Realtime ;
- `006_activity_log_live_producers.sql` : producteurs métier continus.
