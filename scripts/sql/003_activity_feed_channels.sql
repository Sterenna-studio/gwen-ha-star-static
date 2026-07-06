-- Activity feed v1 for /star/index.html
-- Backing table: public.activity_log(type, payload, user_id, created_at)
--
-- The app stores channel/event metadata in payload to stay compatible with the
-- current generated Supabase types:
--   payload->>'channel'    = personal | crew | global
--   payload->>'event_type' = title_unlocked | chronicles_gain | git_push | ...
--   payload->>'target_user_id' is required for personal events.

create index if not exists activity_log_created_at_desc_idx
  on public.activity_log (created_at desc);

create index if not exists activity_log_payload_channel_idx
  on public.activity_log ((payload->>'channel'));

create index if not exists activity_log_payload_event_type_idx
  on public.activity_log ((payload->>'event_type'));

grant select, insert on table public.activity_log to authenticated;

do $$
declare
  activity_log_id_sequence regclass;
begin
  select pg_get_serial_sequence('public.activity_log', 'id')::regclass
    into activity_log_id_sequence;

  if activity_log_id_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', activity_log_id_sequence);
  end if;
end $$;

alter table public.activity_log enable row level security;

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
