# Star activity feed

Surface : `/star/index.html`, widget `#widget-activity`.

Module principal :

- `js/star/activity.js` ecoute `public.activity_log` via Supabase Realtime.
- `js/star/activity-events.js` publie les evenements et conserve un fallback local.
- `js/star/activity-feed-schema.js` definit les canaux, types et regles de visibilite client.

## Canaux

| Channel | Usage | Visibilite |
| --- | --- | --- |
| `personal` | Gain de titre, gain de Chronicles, notification individuelle. | Membre cible uniquement (`user_id`, `target_user_id` ou `owner_id`). |
| `crew` | Evenements operationnels : admin, push git, maintenance, config cockpit. | Membres connectes. En RLS stricte, emission reservee aux superusers. |
| `global` | Signal commun : phrases Lemegeton, mini-evenements, pubs in-universe. | Membres connectes. |

Le widget affiche `TOUT`, `GLOBAL`, `CREW`, `PERSO` et filtre en client. La vraie frontiere de securite doit rester la RLS Supabase.

## Payload

La table actuelle reste compatible :

```json
{
  "type": "git_push",
  "user_id": "<auth.uid>",
  "payload": {
    "event_type": "git_push",
    "channel": "crew",
    "audience": "crew",
    "message": "Push git Sterenna-studio/gwen-ha-star-static:main · c300178",
    "actor": "pierr",
    "source": "github-actions",
    "client_event_id": "..."
  }
}
```

Pour `personal`, ajouter `payload.target_user_id`.

## Types supportes

- `title_unlocked` : titre obtenu.
- `chronicles_gain` : credit Chronicles.
- `git_push` : push Git.
- `lemegeton_phrase` : phrase dite ou diffusee par Lemegeton.
- `mini_pirate_signal` : flux pirate capte.
- `mini_capsule_sos` : SOS capsule perdue.
- `mini_ad` : mini pub in-universe.
- `admin_background`, `admin_hero_cards`, `admin_space_background` : consoles admin.
- `member_join`, `project`, `cig_updated` : compat historique.

Helpers disponibles dans `js/star/activity-events.js` :

- `publishActivityEvent(auth, type, message, detail)`
- `publishTitleUnlocked(auth, titleLabel, detail)`
- `publishChroniclesGain(auth, amount, reason, detail)`
- `publishGitPush(auth, git, detail)`
- `publishLemegetonPhrase(auth, phrase, detail)`
- `publishMiniEvent(auth, eventId, detail)`

## Supabase

Le script `scripts/sql/003_activity_feed_channels.sql` ajoute les indexes payload, les grants `authenticated`, RLS et policies par channel.

Notes :

- Les events `crew` et `global` sont prevus pour des sources fiables (`superuser`, GitHub Actions, RPC serveur).
- Les events `personal` peuvent etre emis pour l'utilisateur courant.
- Un workflow GitHub ne doit pas exposer de cle service role au navigateur. Il doit publier via une action serveur/RPC protegee.
- `.github/workflows/deploy-ovh.yml` publie `git_push` apres smoke test si le secret `GHSTAR_SUPABASE_SERVICE_ROLE` est configure.
- Les projets Supabase recents peuvent demander des grants explicites pour que la Data API expose la table.
- `scripts/sql/004_activity_log_recent_backfill.sql` remplit un historique recent idempotent avec des resumes Supabase et des signaux ambient synthetiques.
