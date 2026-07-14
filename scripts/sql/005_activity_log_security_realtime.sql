-- 005_activity_log_security_realtime.sql
-- Repair public.activity_log security, idempotence and Realtime wiring.
-- Safe for the existing rows created by 004_activity_log_recent_backfill.sql.

alter table public.activity_log enable row level security;

-- Remove legacy permissive policies that bypass the channel model.
drop policy if exists "auth read" on public.activity_log;
drop policy if exists "al_insert" on public.activity_log;
drop policy if exists "al_select_own" on public.activity_log;

-- Canonical read policy: authenticated members can read crew/global, and only
-- their own targeted personal events.
drop policy if exists "activity feed read by channel" on public.activity_log;
create policy "activity feed read by channel"
on public.activity_log
for select
to authenticated
using (
  coalesce(payload->>'channel', 'global') in ('global', 'crew')
  or (
    coalesce(payload->>'channel', 'global') = 'personal'
    and (
      user_id = (select auth.uid())
      or payload->>'target_user_id' = (select auth.uid())::text
      or payload->>'owner_id' = (select auth.uid())::text
    )
  )
);

drop policy if exists "activity feed insert own personal events" on public.activity_log;
create policy "activity feed insert own personal events"
on public.activity_log
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and coalesce(payload->>'channel', 'global') = 'personal'
  and coalesce(payload->>'target_user_id', (select auth.uid())::text) = (select auth.uid())::text
);

drop policy if exists "activity feed insert crew global as superuser" on public.activity_log;
create policy "activity feed insert crew global as superuser"
on public.activity_log
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and coalesce(payload->>'channel', 'global') in ('crew', 'global')
  and public._is_superuser()
);

-- Least privilege for browser roles.
revoke all on table public.activity_log from anon;
revoke all on table public.activity_log from authenticated;
grant select, insert on table public.activity_log to authenticated;

revoke all on sequence public.activity_log_id_seq from anon;
revoke all on sequence public.activity_log_id_seq from authenticated;
grant usage, select on sequence public.activity_log_id_seq to authenticated;

-- Keep the authorization helper unavailable to anonymous sessions.
revoke execute on function public._is_superuser() from public;
revoke execute on function public._is_superuser() from anon;
grant execute on function public._is_superuser() to authenticated;

-- Prevent duplicates when clients retry or local events are resynchronised.
create unique index if not exists activity_log_client_event_id_uidx
on public.activity_log ((payload->>'client_event_id'))
where payload ? 'client_event_id';

-- Enable INSERT delivery to js/star/activity.js.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_log'
  ) then
    alter publication supabase_realtime add table public.activity_log;
  end if;
end
$$;

-- Auditable marker proving the production migration ran.
insert into public.activity_log (type, user_id, payload)
values (
  'system',
  null,
  jsonb_build_object(
    'event_type', 'system',
    'channel', 'global',
    'audience', 'members',
    'message', 'Activity feed : sécurité RLS et Realtime réparés',
    'actor', 'supabase',
    'role', 'automation',
    'source', 'supabase-migration:repair-activity-log',
    'client_event_id', 'migration:repair-activity-log-security-realtime:v1'
  )
)
on conflict ((payload->>'client_event_id')) where payload ? 'client_event_id'
do nothing;
