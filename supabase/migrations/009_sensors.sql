-- Sensor readings: fuel, temperature, voltage, RPM, odometer.
-- Time-series storage in sensor_readings + denormalized "last reading"
-- columns on the vehicles row for fast display + monitor evaluation.

alter table public.vehicles
  add column if not exists last_fuel_percent  double precision,
  add column if not exists last_temp_celsius  double precision,
  add column if not exists last_voltage_v     double precision,
  add column if not exists last_engine_rpm    integer,
  add column if not exists last_odometer_km   double precision,
  add column if not exists last_sensor_at     timestamptz;

create table public.sensor_readings (
  id            bigserial primary key,
  vehicle_id    uuid not null references public.vehicles(id) on delete cascade,
  fuel_percent  double precision,
  temp_celsius  double precision,
  voltage_v     double precision,
  engine_rpm    integer,
  odometer_km   double precision,
  extras        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index sensor_readings_vehicle_time_idx
  on public.sensor_readings(vehicle_id, created_at desc);

-- Keep vehicles.last_* fresh on every sensor insert (use coalesce so a
-- partial reading doesn't wipe out the other columns).
create or replace function public.update_vehicle_last_sensors()
returns trigger
language plpgsql
as $$
begin
  update public.vehicles set
    last_fuel_percent = coalesce(new.fuel_percent, last_fuel_percent),
    last_temp_celsius = coalesce(new.temp_celsius, last_temp_celsius),
    last_voltage_v    = coalesce(new.voltage_v,    last_voltage_v),
    last_engine_rpm   = coalesce(new.engine_rpm,   last_engine_rpm),
    last_odometer_km  = coalesce(new.odometer_km,  last_odometer_km),
    last_sensor_at    = new.created_at,
    updated_at        = now()
  where id = new.vehicle_id;
  return new;
end;
$$;

create trigger trg_sensor_readings_update_vehicle
  after insert on public.sensor_readings
  for each row execute function public.update_vehicle_last_sensors();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.sensor_readings enable row level security;

create policy "sensor_readings_read_authed"
  on public.sensor_readings for select
  using (auth.role() = 'authenticated');

create policy "sensor_readings_admin_insert"
  on public.sensor_readings for insert
  with check (public.is_admin());

-- Realtime
alter publication supabase_realtime add table public.sensor_readings;
