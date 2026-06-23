-- 002_radio_dedications.sql
-- Dedicaces payantes pour la web radio Star.
-- Le debit des chronicles et la creation du message sont atomiques via RPC.

create table if not exists public.radio_dedications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  username_snapshot text not null default 'AGENT',
  message           text not null,
  cost              integer not null default 200 check (cost >= 0),
  status            text not null default 'queued'
                    check (status in ('queued', 'scheduled', 'played', 'rejected')),
  slot_key          text unique,
  scheduled_at      timestamptz,
  played_at         timestamptz,
  created_at        timestamptz not null default now(),
  constraint radio_dedications_message_len
    check (char_length(message) between 3 and 160)
);

create index if not exists radio_dedications_queue_idx
  on public.radio_dedications (status, created_at);

create index if not exists radio_dedications_user_idx
  on public.radio_dedications (user_id, created_at desc);

alter table public.radio_dedications enable row level security;

revoke all on table public.radio_dedications from anon;
revoke all on table public.radio_dedications from authenticated;
grant select on table public.radio_dedications to authenticated;

drop policy if exists "radio_dedications authenticated read" on public.radio_dedications;
create policy "radio_dedications authenticated read"
  on public.radio_dedications
  for select
  to authenticated
  using (status in ('queued', 'scheduled', 'played'));

create or replace function public.submit_radio_dedication(p_message text)
returns table (
  id uuid,
  message text,
  username text,
  cost integer,
  new_balance integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_message text := regexp_replace(trim(coalesce(p_message, '')), '\s+', ' ', 'g');
  v_cost integer := 200;
  v_balance integer;
  v_username text;
  v_id uuid;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if char_length(v_message) < 3 or char_length(v_message) > 160 then
    raise exception 'MESSAGE_LENGTH_INVALID' using errcode = '22023';
  end if;

  update public.profiles
     set chronicles = chronicles - v_cost
   where profiles.id = v_user_id
     and profiles.chronicles >= v_cost
   returning profiles.chronicles,
             coalesce(nullif(trim(profiles.username), ''), split_part(profiles.email, '@', 1), 'AGENT')
        into v_balance, v_username;

  if not found then
    raise exception 'INSUFFICIENT_CHRONICLES' using errcode = 'P0001';
  end if;

  insert into public.radio_dedications (user_id, username_snapshot, message, cost)
  values (v_user_id, v_username, v_message, v_cost)
  returning radio_dedications.id, radio_dedications.created_at
       into v_id, v_created_at;

  id := v_id;
  message := v_message;
  username := v_username;
  cost := v_cost;
  new_balance := v_balance;
  created_at := v_created_at;
  return next;
end;
$$;

create or replace function public.get_radio_dedication_for_slot(
  p_slot_key text,
  p_scheduled_at timestamptz default now()
)
returns table (
  id uuid,
  message text,
  username text,
  cost integer,
  status text,
  slot_key text,
  scheduled_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slot_key text := trim(coalesce(p_slot_key, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if char_length(v_slot_key) < 6 or char_length(v_slot_key) > 120 then
    raise exception 'INVALID_SLOT_KEY' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_slot_key));

  return query
  select d.id, d.message, d.username_snapshot, d.cost, d.status, d.slot_key,
         d.scheduled_at, d.created_at
    from public.radio_dedications d
   where d.slot_key = v_slot_key
     and d.status in ('scheduled', 'played')
   limit 1;

  if found then
    return;
  end if;

  return query
  with next_item as (
    select d.id
      from public.radio_dedications d
     where d.status = 'queued'
     order by d.created_at asc
     for update skip locked
     limit 1
  ),
  claimed as (
    update public.radio_dedications d
       set status = 'scheduled',
           slot_key = v_slot_key,
           scheduled_at = coalesce(p_scheduled_at, now())
      from next_item
     where d.id = next_item.id
     returning d.id, d.message, d.username_snapshot, d.cost, d.status,
               d.slot_key, d.scheduled_at, d.created_at
  )
  select claimed.id, claimed.message, claimed.username_snapshot, claimed.cost,
         claimed.status, claimed.slot_key, claimed.scheduled_at, claimed.created_at
    from claimed;
end;
$$;

create or replace function public.mark_radio_dedication_played(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  update public.radio_dedications
     set status = 'played',
         played_at = coalesce(played_at, now())
   where id = p_id
     and status in ('scheduled', 'played');
end;
$$;

revoke all on function public.submit_radio_dedication(text) from public;
revoke all on function public.submit_radio_dedication(text) from anon;
grant execute on function public.submit_radio_dedication(text) to authenticated;

revoke all on function public.get_radio_dedication_for_slot(text, timestamptz) from public;
revoke all on function public.get_radio_dedication_for_slot(text, timestamptz) from anon;
grant execute on function public.get_radio_dedication_for_slot(text, timestamptz) to authenticated;

revoke all on function public.mark_radio_dedication_played(uuid) from public;
revoke all on function public.mark_radio_dedication_played(uuid) from anon;
grant execute on function public.mark_radio_dedication_played(uuid) to authenticated;
