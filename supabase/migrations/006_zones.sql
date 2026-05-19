-- Geofencing: zones (circle / rectangle / polygon) and zone-cross events.
--
-- Shape JSONB formats:
--   circle:    { "lat": number, "lng": number, "radius_m": number }
--   rectangle: { "north": number, "south": number, "east": number, "west": number }
--   polygon:   { "points": [[lat,lng], [lat,lng], ...] }

create type zone_kind as enum ('circle', 'rectangle', 'polygon');
create type zone_event_kind as enum ('enter', 'exit');

create table public.zones (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  kind            zone_kind not null,
  shape           jsonb not null,
  is_prohibited   boolean not null default false,
  alert_on        text not null default 'both' check (alert_on in ('enter', 'exit', 'both')),
  created_by      uuid references public.profiles(id) on delete set null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index zones_active_idx on public.zones(deleted_at) where deleted_at is null;

create table public.zone_events (
  id          bigserial primary key,
  zone_id     uuid not null references public.zones(id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  kind        zone_event_kind not null,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now()
);

create index zone_events_vehicle_idx on public.zone_events(vehicle_id, created_at desc);
create index zone_events_zone_idx on public.zone_events(zone_id, created_at desc);
create index zone_events_recent_idx on public.zone_events(created_at desc);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.zones enable row level security;
alter table public.zone_events enable row level security;

create policy "zones_read_authed"
  on public.zones for select
  using (auth.role() = 'authenticated' and (deleted_at is null or public.is_admin()));

create policy "zones_admin_insert"
  on public.zones for insert with check (public.is_admin());

create policy "zones_admin_update"
  on public.zones for update using (public.is_admin());

create policy "zones_admin_delete"
  on public.zones for delete using (public.is_admin());

create policy "zone_events_read_authed"
  on public.zone_events for select using (auth.role() = 'authenticated');

create policy "zone_events_admin_insert"
  on public.zone_events for insert with check (public.is_admin());

-- =============================================================================
-- REALTIME
-- =============================================================================
alter publication supabase_realtime add table public.zones;
alter publication supabase_realtime add table public.zone_events;
