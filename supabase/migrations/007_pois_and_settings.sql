-- Points of Interest + per-user settings.
--
-- POIs are user-created markers on the map (depots, customer sites,
-- gas stations, hospitals). Each POI can be private (owner-only) or
-- public (visible to all authenticated users). Admins always see all.

create type poi_category as enum (
  'depot',
  'customer',
  'fuel',
  'service',
  'hospital',
  'police',
  'landmark',
  'other'
);

create table public.pois (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  category      poi_category not null default 'other',
  icon_color    text not null default '#0ea5e9',
  lat           double precision not null,
  lng           double precision not null,
  is_public     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index pois_active_idx on public.pois(deleted_at) where deleted_at is null;
create index pois_owner_idx on public.pois(created_by) where deleted_at is null;
create index pois_public_idx on public.pois(is_public) where deleted_at is null and is_public = true;

-- =============================================================================
-- USER SETTINGS — per-profile preferences
-- =============================================================================
create table public.user_settings (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  units          text not null default 'metric' check (units in ('metric', 'imperial')),
  language       text not null default 'en',
  default_zoom   integer not null default 11 check (default_zoom between 1 and 20),
  show_trails    boolean not null default false,
  trail_points   integer not null default 30 check (trail_points between 5 and 200),
  updated_at     timestamptz not null default now()
);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.pois enable row level security;
alter table public.user_settings enable row level security;

-- POIs: anyone authenticated can read public POIs OR their own POIs;
-- admins read everything (including soft-deleted)
create policy "pois_read"
  on public.pois for select
  using (
    auth.role() = 'authenticated' and (
      public.is_admin()
      or (deleted_at is null and (is_public = true or created_by = auth.uid()))
    )
  );

create policy "pois_insert"
  on public.pois for insert
  with check (auth.uid() = created_by);

create policy "pois_update_own_or_admin"
  on public.pois for update
  using (auth.uid() = created_by or public.is_admin());

create policy "pois_delete_own_or_admin"
  on public.pois for delete
  using (auth.uid() = created_by or public.is_admin());

-- User settings: each user reads/writes their own row only
create policy "user_settings_self_read"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "user_settings_self_upsert"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "user_settings_self_update"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- =============================================================================
-- REALTIME — POIs change rarely but it's nice to have
-- =============================================================================
alter publication supabase_realtime add table public.pois;
