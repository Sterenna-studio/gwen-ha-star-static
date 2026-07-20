-- 007_radio_dedications_public_feed.sql
-- Terminal-safe, public (anon) read surface for the radio dedication feed.
-- Used by scripts/build-3615-feed.mjs to publish the last played dedications
-- into /data/3615-feed.json for Korigan's Minitel terminal (BZH CHRONICLES /
-- CHRONICLES FM screen). Never exposes user_id, cost or raw table access.

create or replace function public.get_recent_played_dedications(p_limit integer default 5)
returns table (
  id         uuid,
  message    text,
  username   text,
  played_at  timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.id, d.message, d.username_snapshot as username, d.played_at
    from public.radio_dedications d
   where d.status = 'played'
     and d.played_at is not null
   order by d.played_at desc
   limit least(greatest(coalesce(p_limit, 5), 1), 20)
$$;

revoke all on function public.get_recent_played_dedications(integer) from public;
grant execute on function public.get_recent_played_dedications(integer) to anon, authenticated;
