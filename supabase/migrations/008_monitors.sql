-- Custom monitors: user-defined rules that fire actions when conditions match.
--
-- Conditions are stored as a JSONB array; ALL must be true for the monitor
-- to fire. Each condition has a `type` discriminator + per-type params:
--   { "type": "speed_above",   "kmh": 80 }
--   { "type": "speed_below",   "kmh": 5 }
--   { "type": "idle_above",    "seconds": 600 }
--   { "type": "in_zone",       "zone_ids": ["uuid"] }
--   { "type": "out_of_zone",   "zone_ids": ["uuid"] }
--
-- Actions are a JSONB array (currently only one supported):
--   { "type": "notify_admins" }
--
-- vehicle_ids is null = applies to all vehicles; otherwise restricts to the
-- listed IDs. valid_from/valid_until optionally restrict when the monitor
-- evaluates.
--
-- monitor_cooldowns tracks the last time each (monitor, vehicle) pair fired,
-- so we don't spam dispatchers with the same alert every few seconds.

create table public.monitors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  is_active       boolean not null default true,
  valid_from      timestamptz,
  valid_until     timestamptz,
  vehicle_ids     uuid[],
  conditions      jsonb not null default '[]'::jsonb,
  actions         jsonb not null default '[{"type":"notify_admins"}]'::jsonb,
  created_by      uuid references public.profiles(id) on delete set null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index monitors_active_idx
  on public.monitors(is_active)
  where deleted_at is null and is_active = true;

create table public.monitor_cooldowns (
  monitor_id  uuid not null references public.monitors(id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  last_fired  timestamptz not null default now(),
  primary key (monitor_id, vehicle_id)
);

create table public.monitor_events (
  id          bigserial primary key,
  monitor_id  uuid not null references public.monitors(id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  fired_at    timestamptz not null default now(),
  meta        jsonb not null default '{}'::jsonb
);

create index monitor_events_recent_idx on public.monitor_events(fired_at desc);
create index monitor_events_monitor_idx on public.monitor_events(monitor_id, fired_at desc);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.monitors enable row level security;
alter table public.monitor_cooldowns enable row level security;
alter table public.monitor_events enable row level security;

create policy "monitors_read_authed"
  on public.monitors for select
  using (auth.role() = 'authenticated' and (deleted_at is null or public.is_admin()));

create policy "monitors_admin_insert"
  on public.monitors for insert with check (public.is_admin());

create policy "monitors_admin_update"
  on public.monitors for update using (public.is_admin());

create policy "monitors_admin_delete"
  on public.monitors for delete using (public.is_admin());

-- Cooldowns/events are admin-only (the simulator + ingest write via service role)
create policy "monitor_cooldowns_admin"
  on public.monitor_cooldowns for all
  using (public.is_admin()) with check (public.is_admin());

create policy "monitor_events_read"
  on public.monitor_events for select using (public.is_admin());
create policy "monitor_events_insert"
  on public.monitor_events for insert with check (public.is_admin());

alter publication supabase_realtime add table public.monitors;
alter publication supabase_realtime add table public.monitor_events;
