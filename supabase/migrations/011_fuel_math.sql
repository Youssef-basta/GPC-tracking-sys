-- Fuel tank size per vehicle + refined sensor-report RPC that computes
-- actual fuel consumed (skipping refuel jumps) and L/100km efficiency.

alter table public.vehicles
  add column if not exists fuel_tank_litres double precision;

-- Recreate the RPC — return type changes so we have to drop first.
drop function if exists public.report_vehicle_sensors(timestamptz, timestamptz);

create or replace function public.report_vehicle_sensors(
  date_from timestamptz,
  date_to   timestamptz
)
returns table (
  vehicle_id              uuid,
  plate                   text,
  label                   text,
  driver_name             text,
  tank_litres             numeric,
  reading_count           bigint,
  fuel_avg                numeric,
  fuel_min                numeric,
  fuel_max                numeric,
  fuel_consumed_percent   numeric,
  fuel_consumed_litres    numeric,
  temp_avg                numeric,
  temp_max                numeric,
  voltage_avg             numeric,
  voltage_min             numeric,
  rpm_avg                 numeric,
  odometer_start          numeric,
  odometer_end            numeric,
  distance_km             numeric,
  efficiency_l_per_100km  numeric,
  last_reading_at         timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with ordered as (
    select
      sr.vehicle_id,
      sr.fuel_percent,
      sr.temp_celsius,
      sr.voltage_v,
      sr.engine_rpm,
      sr.odometer_km,
      sr.created_at,
      lag(sr.fuel_percent) over (
        partition by sr.vehicle_id order by sr.created_at
      ) as prev_fuel
    from public.sensor_readings sr
    where sr.created_at between date_from and date_to
  ),
  agg as (
    select
      vehicle_id,
      count(*)                                  as reading_count,
      avg(fuel_percent)                         as fuel_avg,
      min(fuel_percent)                         as fuel_min,
      max(fuel_percent)                         as fuel_max,
      sum(
        case when prev_fuel is not null and prev_fuel > fuel_percent
             then prev_fuel - fuel_percent
             else 0 end
      )                                          as fuel_consumed_percent,
      avg(temp_celsius)                         as temp_avg,
      max(temp_celsius)                         as temp_max,
      avg(voltage_v)                            as voltage_avg,
      min(voltage_v)                            as voltage_min,
      avg(engine_rpm)                           as rpm_avg,
      (array_agg(odometer_km order by created_at asc))[1]  as odometer_start,
      (array_agg(odometer_km order by created_at desc))[1] as odometer_end,
      max(created_at)                           as last_reading_at
    from ordered
    group by vehicle_id
  )
  select
    v.id,
    v.plate,
    v.label,
    v.driver_name,
    round(v.fuel_tank_litres::numeric, 1),
    coalesce(a.reading_count, 0)::bigint,
    round(a.fuel_avg::numeric, 1),
    round(a.fuel_min::numeric, 1),
    round(a.fuel_max::numeric, 1),
    round(a.fuel_consumed_percent::numeric, 1),
    case
      when v.fuel_tank_litres is null then null
      else round((a.fuel_consumed_percent * v.fuel_tank_litres / 100.0)::numeric, 2)
    end,
    round(a.temp_avg::numeric, 1),
    round(a.temp_max::numeric, 1),
    round(a.voltage_avg::numeric, 2),
    round(a.voltage_min::numeric, 2),
    round(a.rpm_avg::numeric, 0),
    round(a.odometer_start::numeric, 1),
    round(a.odometer_end::numeric, 1),
    round(greatest(coalesce(a.odometer_end - a.odometer_start, 0), 0)::numeric, 1),
    case
      when v.fuel_tank_litres is null
        or coalesce(a.odometer_end - a.odometer_start, 0) <= 0
        or coalesce(a.fuel_consumed_percent, 0) <= 0
      then null
      else round(
        ((a.fuel_consumed_percent * v.fuel_tank_litres / 100.0)
          / (a.odometer_end - a.odometer_start) * 100.0)::numeric,
        2
      )
    end,
    a.last_reading_at
  from public.vehicles v
  left join agg a on a.vehicle_id = v.id
  where v.deleted_at is null
  order by v.label;
$$;
