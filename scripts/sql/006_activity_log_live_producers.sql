-- 006_activity_log_live_producers.sql
-- Emit core Star activity events in the same transaction as their source row.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.write_star_activity(
  p_type text,
  p_user_id uuid,
  p_payload jsonb,
  p_created_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if nullif(btrim(p_type), '') is null then
    raise exception 'activity type is required';
  end if;

  if nullif(btrim(coalesce(p_payload->>'client_event_id', '')), '') is null then
    raise exception 'activity client_event_id is required';
  end if;

  insert into public.activity_log(type, user_id, payload, created_at)
  values (p_type, p_user_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_created_at, now()))
  on conflict do nothing;
end
$$;

revoke all on function private.write_star_activity(text, uuid, jsonb, timestamptz) from public;
revoke all on function private.write_star_activity(text, uuid, jsonb, timestamptz) from anon;
revoke all on function private.write_star_activity(text, uuid, jsonb, timestamptz) from authenticated;

create or replace function private.log_chronicles_ledger_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor text;
  v_event_type text;
  v_reason text;
  v_message text;
begin
  select left(coalesce(nullif(btrim(p.username), ''), 'AGENT'), 32)
    into v_actor
  from public.profiles p
  where p.id = new.user_id;

  v_actor := coalesce(v_actor, 'AGENT');
  v_event_type := case when new.amount < 0 then 'chronicles_spent' else 'chronicles_gain' end;
  v_reason := case new.type
    when 'daily_bonus' then 'bonus quotidien'
    when 'battle_reward' then 'récompense de combat'
    when 'quest' then 'récompense de quête'
    when 'admin_grant' then 'ajustement administratif'
    when 'purchase' then 'achat Star'
    else replace(new.type, '_', ' ')
  end;
  v_message := format('%s%s Chronicles · %s', case when new.amount > 0 then '+' else '' end, new.amount, v_reason);

  perform private.write_star_activity(
    v_event_type,
    new.user_id,
    jsonb_build_object(
      'event_type', v_event_type,
      'channel', 'personal',
      'audience', 'self',
      'message', v_message,
      'actor', v_actor,
      'role', 'member',
      'source', 'db-trigger:chronicles_ledger',
      'target_user_id', new.user_id,
      'ledger_id', new.id,
      'ledger_type', new.type,
      'amount', new.amount,
      'client_event_id', 'chronicles-ledger:' || new.id::text
    ),
    coalesce(new.created_at, now())
  );

  return new;
end
$$;

revoke all on function private.log_chronicles_ledger_activity() from public;
revoke all on function private.log_chronicles_ledger_activity() from anon;
revoke all on function private.log_chronicles_ledger_activity() from authenticated;

drop trigger if exists trg_activity_chronicles_ledger on public.chronicles_ledger;
create trigger trg_activity_chronicles_ledger
after insert on public.chronicles_ledger
for each row execute function private.log_chronicles_ledger_activity();

create or replace function private.log_profile_join_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor text := left(coalesce(nullif(btrim(new.username), ''), 'NOUVEL AGENT'), 32);
begin
  perform private.write_star_activity(
    'member_join',
    new.id,
    jsonb_build_object(
      'event_type', 'member_join',
      'channel', 'crew',
      'audience', 'crew',
      'message', 'Nouveau membre Star : ' || v_actor || ' a rejoint le cockpit',
      'actor', v_actor,
      'role', coalesce(nullif(btrim(new.role), ''), 'member'),
      'source', 'db-trigger:profiles',
      'profile_id', new.id,
      'client_event_id', 'profile-join:' || new.id::text
    ),
    coalesce(new.joined_at, new.created_at, now())
  );

  return new;
end
$$;

revoke all on function private.log_profile_join_activity() from public;
revoke all on function private.log_profile_join_activity() from anon;
revoke all on function private.log_profile_join_activity() from authenticated;

drop trigger if exists trg_activity_profile_join on public.profiles;
create trigger trg_activity_profile_join
after insert on public.profiles
for each row execute function private.log_profile_join_activity();

create or replace function private.log_profile_titles_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_title text;
  v_actor text := left(coalesce(nullif(btrim(new.username), ''), 'AGENT'), 32);
begin
  for v_title in
    select title
    from unnest(coalesce(new.titles, array[]::text[])) as title
    except
    select title
    from unnest(coalesce(old.titles, array[]::text[])) as title
  loop
    if nullif(btrim(v_title), '') is not null and v_title <> 'Recrue' then
      perform private.write_star_activity(
        'title_unlocked',
        new.id,
        jsonb_build_object(
          'event_type', 'title_unlocked',
          'channel', 'personal',
          'audience', 'self',
          'message', 'Titre obtenu : ' || v_title,
          'actor', v_actor,
          'role', coalesce(nullif(btrim(new.role), ''), 'member'),
          'source', 'db-trigger:profiles.titles',
          'target_user_id', new.id,
          'title', v_title,
          'client_event_id', 'profile-title:' || new.id::text || ':' || md5(v_title)
        ),
        now()
      );
    end if;
  end loop;

  return new;
end
$$;

revoke all on function private.log_profile_titles_activity() from public;
revoke all on function private.log_profile_titles_activity() from anon;
revoke all on function private.log_profile_titles_activity() from authenticated;

drop trigger if exists trg_activity_profile_titles on public.profiles;
create trigger trg_activity_profile_titles
after update of titles on public.profiles
for each row
when (old.titles is distinct from new.titles)
execute function private.log_profile_titles_activity();

create or replace function private.log_daily_content_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_title text := left(coalesce(nullif(btrim(new.title), ''), nullif(btrim(new.platform), ''), 'contenu Star'), 80);
begin
  perform private.write_star_activity(
    'daily_content_published',
    null,
    jsonb_build_object(
      'event_type', 'daily_content_published',
      'channel', 'global',
      'audience', 'members',
      'message', 'Contenu du jour publié : ' || v_title,
      'actor', 'station',
      'role', 'automation',
      'source', 'db-trigger:daily_content',
      'daily_content_id', new.id,
      'platform', new.platform,
      'content_date', new.date,
      'client_event_id', 'daily-content:' || new.id::text
    ),
    coalesce(new.created_at, now())
  );

  return new;
end
$$;

revoke all on function private.log_daily_content_activity() from public;
revoke all on function private.log_daily_content_activity() from anon;
revoke all on function private.log_daily_content_activity() from authenticated;

drop trigger if exists trg_activity_daily_content on public.daily_content;
create trigger trg_activity_daily_content
after insert on public.daily_content
for each row execute function private.log_daily_content_activity();

create or replace function private.log_radio_dedication_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor text := left(coalesce(nullif(btrim(new.username_snapshot), ''), 'AGENT'), 32);
  v_should_log boolean := false;
begin
  if tg_op = 'INSERT' then
    v_should_log := new.status = 'played';
  else
    v_should_log := (
      new.status = 'played'
      and old.status is distinct from new.status
    ) or (
      new.played_at is not null
      and old.played_at is distinct from new.played_at
    );
  end if;

  if v_should_log then
    perform private.write_star_activity(
      'radio_dedication',
      new.user_id,
      jsonb_build_object(
        'event_type', 'radio_dedication',
        'channel', 'global',
        'audience', 'members',
        'message', 'Radio Star : dédicace diffusée de ' || v_actor,
        'actor', v_actor,
        'role', 'member',
        'source', 'db-trigger:radio_dedications',
        'dedication_id', new.id,
        'status', new.status,
        'client_event_id', 'radio-dedication-played:' || new.id::text
      ),
      coalesce(new.played_at, new.created_at, now())
    );
  end if;

  return new;
end
$$;

revoke all on function private.log_radio_dedication_activity() from public;
revoke all on function private.log_radio_dedication_activity() from anon;
revoke all on function private.log_radio_dedication_activity() from authenticated;

drop trigger if exists trg_activity_radio_dedication on public.radio_dedications;
create trigger trg_activity_radio_dedication
after insert or update of status, played_at on public.radio_dedications
for each row execute function private.log_radio_dedication_activity();
