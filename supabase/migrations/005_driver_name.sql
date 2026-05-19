-- Add driver_name to vehicles + propagate into report RPCs.

alter table public.vehicles
  add column if not exists driver_name text;

create index if not exists vehicles_driver_idx
  on public.vehicles(driver_name)
  where deleted_at is null and driver_name is not null;

-- Replace the report RPCs to include driver_name in their output.
-- (CREATE OR REPLACE can't change return type — drop first.)
drop function if exists public.report_vehicle_activity(timestamptz, timestamptz);
drop function if exists public.report_speed_violations(timestamptz, timestamptz, numeric, int);
drop function if exists public.report_idle_events(timestamptz, timestamptz, int, int);
drop function if exists public.report_anomalies(timestamptz, timestamptz);

create or replace function public.report_vehicle_activity(
  date_from timestamptz,
  date_to timestamptz
)
returns table (
  vehicle_id          uuid,
  plate               text,
  label               text,
  driver_name         text,
  ping_count          bigint,
  distance_km         numeric,
  max_speed_kmh       numeric,
  avg_moving_kmh      numeric,
  total_idle_seconds  bigint,
  anomaly_count       bigint,
  last_seen           timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with segs as (
    select
      l.vehicle_id,
      l.lat, l.lng, l.speed_kmh, l.idle_seconds, l.anomaly, l.created_at,
      lag(l.lat) over (partition by l.vehicle_id order by l.created_at) as prev_lat,
      lag(l.lng) over (partition by l.vehicle_id order by l.created_at) as prev_lng
    from public.locations l
    where l.created_at between date_from and date_to
  )
  select
    v.id,
    v.plate,
    v.label,
    v.driver_name,
    coalesce(count(s.*), 0)::bigint,
    coalesce(sum(
      case when s.prev_lat is not null then
        2 * 6371 * asin(least(1, sqrt(
          power(sin(radians((s.lat - s.prev_lat) / 2)), 2) +
          cos(radians(s.prev_lat)) * cos(radians(s.lat)) *
          power(sin(radians((s.lng - s.prev_lng) / 2)), 2)
        )))
      else 0 end
    ), 0)::numeric(10, 2),
    coalesce(max(s.speed_kmh), 0)::numeric(10, 2),
    coalesce(avg(s.speed_kmh) filter (where s.speed_kmh > 0), 0)::numeric(10, 2),
    coalesce(sum(s.idle_seconds), 0)::bigint,
    coalesce(sum(case when s.anomaly then 1 else 0 end), 0)::bigint,
    max(s.created_at)
  from public.vehicles v
  left join segs s on s.vehicle_id = v.id
  where v.deleted_at is null
  group by v.id, v.plate, v.label, v.driver_name
  order by v.label;
$$;

create or replace function public.report_speed_violations(
  date_from         timestamptz,
  date_to           timestamptz,
  threshold_kmh     numeric default 80,
  max_rows          int default 500
)
returns table (
  vehicle_id      uuid,
  plate           text,
  label           text,
  driver_name     text,
  speed_kmh       numeric,
  lat             double precision,
  lng             double precision,
  created_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.vehicle_id,
    v.plate,
    v.label,
    v.driver_name,
    l.speed_kmh::numeric(10, 2),
    l.lat,
    l.lng,
    l.created_at
  from public.locations l
  join public.vehicles v on v.id = l.vehicle_id
  where l.created_at between date_from and date_to
    and l.speed_kmh > threshold_kmh
  order by l.speed_kmh desc, l.created_at desc
  limit max_rows;
$$;

create or replace function public.report_idle_events(
  date_from           timestamptz,
  date_to             timestamptz,
  min_idle_seconds    int default 300,
  max_rows            int default 500
)
returns table (
  vehicle_id      uuid,
  plate           text,
  label           text,
  driver_name     text,
  idle_seconds    int,
  lat             double precision,
  lng             double precision,
  created_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.vehicle_id,
    v.plate,
    v.label,
    v.driver_name,
    l.idle_seconds,
    l.lat,
    l.lng,
    l.created_at
  from public.locations l
  join public.vehicles v on v.id = l.vehicle_id
  where l.created_at between date_from and date_to
    and l.idle_seconds >= min_idle_seconds
  order by l.idle_seconds desc, l.created_at desc
  limit max_rows;
$$;

create or replace function public.report_anomalies(
  date_from   timestamptz,
  date_to     timestamptz
)
returns table (
  vehicle_id      uuid,
  plate           text,
  label           text,
  driver_name     text,
  anomaly_kind    text,
  occurrences     bigint,
  last_occurrence timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.vehicle_id,
    v.plate,
    v.label,
    v.driver_name,
    coalesce(l.anomaly_kind, 'unknown') as anomaly_kind,
    count(*)::bigint as occurrences,
    max(l.created_at) as last_occurrence
  from public.locations l
  join public.vehicles v on v.id = l.vehicle_id
  where l.created_at between date_from and date_to
    and l.anomaly = true
  group by l.vehicle_id, v.plate, v.label, v.driver_name, l.anomaly_kind
  order by occurrences desc, last_occurrence desc;
$$;
