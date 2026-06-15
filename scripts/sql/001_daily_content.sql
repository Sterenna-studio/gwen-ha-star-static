-- 001_daily_content.sql
-- Table « Vidéo du jour » du cockpit Star (widget VideoDay, js/star/widgets.js).
-- À exécuter dans le SQL Editor du dashboard Supabase (droits DDL requis).
--
-- Le widget lit la ligne la plus récente :
--   select title, url, platform, note from daily_content order by date desc limit 1
-- platform ∈ { 'youtube', 'peertube' } (cf. VideoDay._embedUrl).

create table if not exists public.daily_content (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  title      text,
  url        text not null,
  platform   text not null check (platform in ('youtube', 'peertube')),
  note       text,
  created_at timestamptz not null default now()
);

alter table public.daily_content enable row level security;

-- Lecture publique (le cockpit lit avec la clé publishable).
drop policy if exists "daily_content public read" on public.daily_content;
create policy "daily_content public read"
  on public.daily_content for select using (true);

-- Vidéo d'exemple — remplace l'URL par la vraie (puis supprime ce commentaire).
insert into public.daily_content (title, url, platform, note)
values ('BZH Chronicles', 'https://www.youtube.com/watch?v=XXXXXXXXXXX', 'youtube', 'Vidéo du jour');
