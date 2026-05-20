-- Sensor aggregation RPC: per-vehicle stats over a date range.
-- Used by /admin/reports?type=sensors and its CSV / PDF export.

create or replace function public.report_vehicle_sensors(
  date_from timestamptz,
  date_to   timestamptz
)
returns table (
  vehicle_id        uuid,
  plate             text,
  label             text,
  driver_name       text,
  reading_count     bigint,
  fuel_avg          numeric,
  fuel_min          numeric,
  fuel_max          numeric,
  temp_avg          numeric,
  temp_max          numeric,
  voltage_avg       numeric,
  voltage_min       numeric,
  rpm_avg           numeric,
  odometer_start    numeric,
  odometer_end      numeric,
  distance_km       numeric,
  last_reading_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with agg as (
    select
      sr.vehicle_id,
      count(*)                                  as reading_count,
      avg(sr.fuel_percent)                      as fuel_avg,
      min(sr.fuel_percent)                      as fuel_min,
      max(sr.fuel_percent)                      as fuel_max,
      avg(sr.temp_celsius)                      as temp_avg,
      max(sr.temp_celsius)                      as temp_max,
      avg(sr.voltage_v)                         as voltage_avg,
      min(sr.voltage_v)                         as voltage_min,
      avg(sr.engine_rpm)                        as rpm_avg,
      (array_agg(sr.odometer_km order by sr.created_at asc))[1]   as odometer_start,
      (array_agg(sr.odometer_km order by sr.created_at desc))[1]  as odometer_end,
      max(sr.created_at)                        as last_reading_at
    from public.sensor_readings sr
    where sr.created_at between date_from and date_to
    group by sr.vehicle_id
  )
  select
    v.id,
    v.plate,
    v.label,
    v.driver_name,
    coalesce(a.reading_count, 0)::bigint,
    round(a.fuel_avg::numeric, 1),
    round(a.fuel_min::numeric, 1),
    round(a.fuel_max::numeric, 1),
    round(a.temp_avg::numeric, 1),
    round(a.temp_max::numeric, 1),
    round(a.voltage_avg::numeric, 2),
    round(a.voltage_min::numeric, 2),
    round(a.rpm_avg::numeric, 0),
    round(a.odometer_start::numeric, 1),
    round(a.odometer_end::numeric, 1),
    round(greatest(coalesce(a.odometer_end - a.odometer_start, 0), 0)::numeric, 1),
    a.last_reading_at
  from public.vehicles v
  left join agg a on a.vehicle_id = v.id
  where v.deleted_at is null
  order by v.label;
$$;
