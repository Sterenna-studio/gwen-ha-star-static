-- 004_activity_log_recent_backfill.sql
-- One-shot/idempotent backfill for the Star activity feed.
--
-- Goal: fill public.activity_log with recent visible history using existing
-- Supabase data plus clearly synthetic ambient signals.
-- Run from Supabase SQL Editor or an admin/service-role SQL session.
--
-- No email or raw user message is copied into the activity feed.
-- Idempotency is based on payload.client_event_id.

with
ambient_seed(event_id, event_type, created_at, message, detail) as (
  values
    (
      'backfill:ambient:lemegeton-drift:d0',
      'lemegeton_phrase',
      now() - interval '2 hours',
      'Lemegeton : les relais ont recompte les etoiles mortes',
      '{"signal":"lemegeton-drift","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:pirate-fragment:d0',
      'mini_pirate_signal',
      now() - interval '11 hours',
      'Flux pirate capte sur la bande 29.7 - paquet partiel archive',
      '{"frequency":"29.7","signal":"pirate-fragment","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:capsule-sos:d1',
      'mini_capsule_sos',
      now() - interval '1 day 5 hours',
      'SOS capsule perdue - balise faible detectee pres du relais Armorica',
      '{"sector":"Armorica Relay","signal":"capsule-sos","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:canteen-ad:d2',
      'mini_ad',
      now() - interval '2 days 8 hours',
      'Mini pub captee - Cantine orbitale : galettes chaudes jusqu a 03:00',
      '{"sponsor":"Cantine orbitale","signal":"station-ad","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:port-cleanup:d4',
      'system',
      now() - interval '4 days 3 hours',
      'Maintenance portuaire : caches cockpit purges et journaux synchronises',
      '{"signal":"port-cleanup","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:radar-quiet:d6',
      'system',
      now() - interval '6 days 6 hours',
      'Radar Star : veille calme, douze micro-signaux classes sans alerte',
      '{"signal":"radar-quiet","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:merchant-hail:d8',
      'mini_ad',
      now() - interval '8 days 9 hours',
      'Annonce relais : un cargo marchand demande une fenetre de quai',
      '{"signal":"merchant-hail","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:lost-pack:d11',
      'mini_capsule_sos',
      now() - interval '11 days 2 hours',
      'Balise faible : colis de bord derive entre deux couloirs de service',
      '{"signal":"lost-pack","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:old-broadcast:d15',
      'mini_pirate_signal',
      now() - interval '15 days 12 hours',
      'Ancien broadcast pirate retrouve dans les buffers de la nuit',
      '{"signal":"old-broadcast","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:lemegeton-archive:d19',
      'lemegeton_phrase',
      now() - interval '19 days 7 hours',
      'Lemegeton : aucune carte ne ment quand la station dort',
      '{"signal":"lemegeton-archive","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:crew-ping:d24',
      'system',
      now() - interval '24 days 4 hours',
      'Ping crew archive : modules Nitro alignes sur la meme antenne',
      '{"signal":"crew-ping","synthetic":true}'::jsonb
    ),
    (
      'backfill:ambient:station-market:d30',
      'mini_ad',
      now() - interval '30 days 1 hour',
      'Annonce marche : pieces recuperees, badges polis, cafe de quart pret',
      '{"signal":"station-market","synthetic":true}'::jsonb
    )
),
ambient_events as (
  select
    event_type as type,
    null::uuid as user_id,
    created_at,
    jsonb_build_object(
      'event_type', event_type,
      'channel', 'global',
      'audience', 'members',
      'message', message,
      'actor', 'station',
      'role', 'automation',
      'source', 'supabase-backfill:ambient',
      'client_event_id', event_id
    ) || detail as payload
  from ambient_seed
),
ledger_weekly as (
  select
    date_trunc('week', created_at)::date as week_start,
    type as ledger_type,
    count(*)::integer as event_count,
    coalesce(sum(amount), 0)::integer as amount_sum
  from public.chronicles_ledger
  where created_at >= now() - interval '8 weeks'
  group by 1, 2
),
ledger_events as (
  select
    case
      when ledger_type = 'purchase' then 'project'
      else 'chronicles_gain'
    end as type,
    null::uuid as user_id,
    least(now() - interval '45 minutes', week_start::timestamptz + interval '6 days 20 hours') as created_at,
    jsonb_build_object(
      'event_type', case when ledger_type = 'purchase' then 'project' else 'chronicles_gain' end,
      'channel', case when ledger_type in ('purchase', 'admin_grant') then 'crew' else 'global' end,
      'audience', case when ledger_type in ('purchase', 'admin_grant') then 'crew' else 'members' end,
      'message', case
        when ledger_type = 'daily_bonus'
          then format('Semaine Star : %s bonus quotidiens archives (+%s Chronicles)', event_count, greatest(amount_sum, 0))
        when ledger_type = 'battle_reward'
          then format('Escouades : %s recompenses de combat archivees (+%s Chronicles)', event_count, greatest(amount_sum, 0))
        when ledger_type = 'quest'
          then format('Quetes Star : %s recompenses validees (+%s Chronicles)', event_count, greatest(amount_sum, 0))
        when ledger_type = 'admin_grant'
          then format('Maintenance Chronicles : %s ajustements admin archives', event_count)
        when ledger_type = 'purchase'
          then format('Marche Star : %s achats archives (%s Chronicles engages)', event_count, abs(amount_sum))
        else format('Chronicles : %s operations %s archivees', event_count, ledger_type)
      end,
      'actor', 'station',
      'role', 'automation',
      'source', 'supabase-backfill:chronicles_ledger',
      'ledger_type', ledger_type,
      'event_count', event_count,
      'amount_sum', amount_sum,
      'week_start', week_start,
      'client_event_id', 'backfill:ledger-week:' || week_start::text || ':' || ledger_type
    ) as payload
  from ledger_weekly
),
radio_events as (
  select
    'mini_ad'::text as type,
    d.user_id,
    d.created_at,
    jsonb_build_object(
      'event_type', 'mini_ad',
      'channel', 'global',
      'audience', 'members',
      'message', 'Radio Star : dedicace archivee de ' || left(coalesce(nullif(trim(d.username_snapshot), ''), 'AGENT'), 32),
      'actor', left(coalesce(nullif(trim(d.username_snapshot), ''), 'AGENT'), 32),
      'role', 'member',
      'source', 'supabase-backfill:radio_dedications',
      'dedication_id', d.id,
      'status', d.status,
      'cost', d.cost,
      'client_event_id', 'backfill:radio-dedication:' || d.id::text
    ) as payload
  from public.radio_dedications d
),
daily_content_events as (
  select
    'project'::text as type,
    null::uuid as user_id,
    coalesce(dc.created_at, dc.date::timestamptz + interval '12 hours') as created_at,
    jsonb_build_object(
      'event_type', 'project',
      'channel', 'global',
      'audience', 'members',
      'message', 'Video du jour archivee : ' || left(coalesce(nullif(trim(dc.title), ''), dc.platform, 'contenu Star'), 80),
      'actor', 'station',
      'role', 'automation',
      'source', 'supabase-backfill:daily_content',
      'daily_content_id', dc.id,
      'platform', dc.platform,
      'content_date', dc.date,
      'client_event_id', 'backfill:daily-content:' || dc.id::text
    ) as payload
  from public.daily_content dc
),
tcg_ranked as (
  select
    t.*,
    row_number() over (
      order by coalesce(t.updated_at, t.created_at) desc, coalesce(t.cards_count, 0) desc, t.id
    ) as rn
  from public.tcg_players t
),
tcg_events as (
  select
    'project'::text as type,
    t.id as user_id,
    coalesce(t.updated_at, t.created_at, now()) as created_at,
    jsonb_build_object(
      'event_type', 'project',
      'channel', 'global',
      'audience', 'members',
      'message', format(
        'TCG Star : %s synchronise %s cartes%s',
        left(coalesce(nullif(trim(t.username), ''), 'AGENT'), 32),
        coalesce(t.cards_count, 0),
        case when coalesce(t.daily_streak, 0) > 0 then format(' - serie %s j', t.daily_streak) else '' end
      ),
      'actor', left(coalesce(nullif(trim(t.username), ''), 'AGENT'), 32),
      'role', 'member',
      'source', 'supabase-backfill:tcg_players',
      'cards_count', coalesce(t.cards_count, 0),
      'daily_streak', coalesce(t.daily_streak, 0),
      'has_legendary', coalesce(t.has_legendary, false),
      'client_event_id', 'backfill:tcg-player:' || t.id::text
    ) as payload
  from tcg_ranked t
  where t.rn <= 6
),
pokegang_ranked as (
  select
    p.*,
    row_number() over (
      order by coalesce(p.updated_at, now()) desc, coalesce(p.reputation, 0) desc, p.user_id
    ) as rn
  from public.pokegang_players p
),
pokegang_events as (
  select
    'project'::text as type,
    p.user_id,
    coalesce(p.updated_at, now()) as created_at,
    jsonb_build_object(
      'event_type', 'project',
      'channel', 'global',
      'audience', 'members',
      'message', format(
        'Pokegang : %s signale %s captures et %s reputation',
        left(coalesce(nullif(trim(p.gang_name), ''), 'Gang Star'), 40),
        coalesce(p.total_caught, 0),
        coalesce(p.reputation, 0)
      ),
      'actor', left(coalesce(nullif(trim(p.gang_name), ''), 'Gang Star'), 40),
      'role', 'member',
      'source', 'supabase-backfill:pokegang_players',
      'reputation', coalesce(p.reputation, 0),
      'total_caught', coalesce(p.total_caught, 0),
      'shiny_count', coalesce(p.shiny_count, 0),
      'client_event_id', 'backfill:pokegang-player:' || p.user_id::text
    ) as payload
  from pokegang_ranked p
  where p.rn <= 6
),
profile_ranked as (
  select
    p.*,
    row_number() over (
      order by coalesce(p.joined_at, p.created_at) desc, p.id
    ) as rn
  from public.profiles p
  where coalesce(p.joined_at, p.created_at) >= now() - interval '16 weeks'
),
profile_events as (
  select
    'member_join'::text as type,
    p.id as user_id,
    coalesce(p.joined_at, p.created_at, now()) as created_at,
    jsonb_build_object(
      'event_type', 'member_join',
      'channel', 'crew',
      'audience', 'crew',
      'message', 'Nouveau membre Star : ' || left(coalesce(nullif(trim(p.username), ''), 'AGENT'), 32) || ' a rejoint le cockpit',
      'actor', left(coalesce(nullif(trim(p.username), ''), 'AGENT'), 32),
      'role', coalesce(nullif(trim(p.role), ''), 'member'),
      'source', 'supabase-backfill:profiles',
      'profile_id', p.id,
      'joined_at', coalesce(p.joined_at, p.created_at),
      'client_event_id', 'backfill:profile-join:' || p.id::text
    ) as payload
  from profile_ranked p
  where p.rn <= 8
),
seed as (
  select * from ambient_events
  union all select * from ledger_events
  union all select * from radio_events
  union all select * from daily_content_events
  union all select * from tcg_events
  union all select * from pokegang_events
  union all select * from profile_events
)
insert into public.activity_log (type, user_id, created_at, payload)
select
  seed.type,
  seed.user_id,
  seed.created_at,
  seed.payload
from seed
where not exists (
  select 1
  from public.activity_log existing
  where existing.payload->>'client_event_id' = seed.payload->>'client_event_id'
)
order by seed.created_at asc;
