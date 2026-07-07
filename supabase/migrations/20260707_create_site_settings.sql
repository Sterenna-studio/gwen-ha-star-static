-- ═══════════════════════════════════════════════════════════════
--  Migration : create site_settings table
--  Utilisée pour stocker les configurations UI (ex: cig_style)
--  Gwen Ha Star · 2026-07-07
-- ═══════════════════════════════════════════════════════════════

-- ── TABLE ────────────────────────────────────────────────────────
create table if not exists public.site_settings (
  key        text        primary key,
  value      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table  public.site_settings          is 'Clés de configuration globale du site (UI, styles, feature flags)';
comment on column public.site_settings.key       is 'Identifiant unique de la config (ex: cig_style, cig_layout)';
comment on column public.site_settings.value     is 'Valeur JSON libre associée à la clé';
comment on column public.site_settings.updated_at is 'Date de dernière modification';

-- ── RLS ──────────────────────────────────────────────────────────
alter table public.site_settings enable row level security;

-- Lecture publique (toute personne connectée ou non peut lire les styles)
create policy "site_settings: public read"
  on public.site_settings
  for select
  using (true);

-- Écriture réservée aux superusers (role dans profiles)
create policy "site_settings: superuser write"
  on public.site_settings
  for all
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'superuser'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'superuser'
    )
  );

-- ── SEED : valeur par défaut de cig_style ────────────────────────
insert into public.site_settings (key, value)
values (
  'cig_style',
  '{
    "accent":         "#3ecfcf",
    "accent2":        "#f9ca24",
    "border":         "rgba(62,207,207,.35)",
    "cardBg":         "linear-gradient(135deg, rgba(62,207,207,.08) 0%, rgba(16,20,26,1) 50%, rgba(249,202,36,.06) 100%)",
    "glow":           "0 0 40px rgba(62,207,207,.10), inset 0 1px 0 rgba(255,255,255,.04)",
    "scannerOpacity": "0.25",
    "scannerSpeed":   "5",
    "avatarRadius":   "18",
    "cardRadius":     "24",
    "pseudoSize":     "1.4",
    "titleSize":      "10",
    "monoTracking":   "0.14"
  }'::jsonb
)
on conflict (key) do nothing;
