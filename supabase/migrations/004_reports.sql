-- Fleet operations report RPCs.
-- Apply via supabase/setup.sql (or run this file separately).

-- =============================================================================
-- ACTIVITY SUMMARY — per-vehicle aggregates over a date range
-- =============================================================================
create or replace function public.report_vehicle_activity(
  date_from timestamptz,
  date_to timestamptz
)
returns table (
  vehicle_id          uuid,
  plate               text,
  label               text,
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
  group by v.id, v.plate, v.label
  order by v.label;
$$;

-- =============================================================================
-- SPEED VIOLATIONS — pings above threshold, with vehicle metadata
-- =============================================================================
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

-- =============================================================================
-- IDLE EVENTS — pings where idle_seconds > min threshold (default 5 min)
-- =============================================================================
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

-- =============================================================================
-- ANOMALY REPORT — flagged pings, grouped by vehicle + kind
-- =============================================================================
create or replace function public.report_anomalies(
  date_from   timestamptz,
  date_to     timestamptz
)
returns table (
  vehicle_id      uuid,
  plate           text,
  label           text,
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
    coalesce(l.anomaly_kind, 'unknown') as anomaly_kind,
    count(*)::bigint as occurrences,
    max(l.created_at) as last_occurrence
  from public.locations l
  join public.vehicles v on v.id = l.vehicle_id
  where l.created_at between date_from and date_to
    and l.anomaly = true
  group by l.vehicle_id, v.plate, v.label, l.anomaly_kind
  order by occurrences desc, last_occurrence desc;
$$;
