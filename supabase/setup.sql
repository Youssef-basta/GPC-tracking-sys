-- =============================================================================
-- GPC Tracking sys — one-paste schema setup
-- =============================================================================
-- Paste the entire contents of this file into the Supabase SQL editor and run.
-- Includes: 001_init.sql + 003_ingest_token.sql + 002_seed.sql (in that order)
-- =============================================================================

-- ============================ ENUMS ==========================================
create type user_role as enum ('user', 'admin');
create type vehicle_status as enum ('active', 'idle', 'offline', 'maintenance');
create type report_status as enum ('open', 'resolved', 'dismissed');

-- ============================ PROFILES =======================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'user',
  disabled    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_email_idx on public.profiles(email);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select count(*) = 0 into is_first_user from public.profiles;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when is_first_user then 'admin'::user_role else 'user'::user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================ VEHICLES =======================================
create table public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  plate         text not null unique,
  label         text not null,
  model         text,
  status        vehicle_status not null default 'offline',
  description   text,
  owner_id      uuid references public.profiles(id) on delete set null,
  last_lat      double precision,
  last_lng      double precision,
  last_seen_at  timestamptz,
  ingest_token  uuid not null default gen_random_uuid(),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index vehicles_status_idx on public.vehicles(status) where deleted_at is null;
create index vehicles_owner_idx on public.vehicles(owner_id) where deleted_at is null;
create index vehicles_deleted_idx on public.vehicles(deleted_at);
create unique index vehicles_ingest_token_idx on public.vehicles(ingest_token);

-- ============================ LOCATIONS ======================================
create table public.locations (
  id            bigserial primary key,
  vehicle_id    uuid not null references public.vehicles(id) on delete cascade,
  lat           double precision not null,
  lng           double precision not null,
  speed_kmh     double precision not null default 0,
  heading       double precision,
  idle_seconds  integer not null default 0,
  anomaly       boolean not null default false,
  anomaly_kind  text,
  created_at    timestamptz not null default now()
);

create index locations_vehicle_time_idx on public.locations(vehicle_id, created_at desc);
create index locations_anomaly_idx on public.locations(anomaly, created_at desc) where anomaly = true;

create or replace function public.update_vehicle_last_location()
returns trigger
language plpgsql
as $$
begin
  update public.vehicles
     set last_lat = new.lat,
         last_lng = new.lng,
         last_seen_at = new.created_at,
         status = case
           when new.speed_kmh > 1 then 'active'::vehicle_status
           when new.idle_seconds > 600 then 'idle'::vehicle_status
           else status
         end,
         updated_at = now()
   where id = new.vehicle_id;
  return new;
end;
$$;

create trigger trg_locations_update_vehicle
  after insert on public.locations
  for each row execute function public.update_vehicle_last_location();

-- ============================ NOTIFICATIONS ==================================
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  message     text not null,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications(user_id, created_at desc)
  where read = false;
create index notifications_user_recent_idx
  on public.notifications(user_id, created_at desc);

-- ============================ CONTENT REPORTS ================================
create table public.content_reports (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid references public.vehicles(id) on delete cascade,
  reporter_id   uuid references public.profiles(id) on delete set null,
  reason        text not null,
  status        report_status not null default 'open',
  created_at    timestamptz not null default now()
);

create index content_reports_open_idx on public.content_reports(status) where status = 'open';

-- ============================ AUDIT LOG ======================================
create table public.audit_log (
  id            bigserial primary key,
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null,
  target_type   text,
  target_id     text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index audit_log_recent_idx on public.audit_log(created_at desc);
create index audit_log_actor_idx on public.audit_log(actor_id, created_at desc);

-- ============================ HELPERS ========================================
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = uid
       and role = 'admin'
       and disabled = false
  );
$$;

-- ============================ RLS ============================================
alter table public.profiles         enable row level security;
alter table public.vehicles         enable row level security;
alter table public.locations        enable row level security;
alter table public.notifications    enable row level security;
alter table public.content_reports  enable row level security;
alter table public.audit_log        enable row level security;

create policy "profiles_self_read"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_admin_update"
  on public.profiles for update
  using (public.is_admin());

create policy "vehicles_read_all_authed"
  on public.vehicles for select
  using (auth.role() = 'authenticated' and (deleted_at is null or public.is_admin()));

create policy "vehicles_admin_insert"
  on public.vehicles for insert
  with check (public.is_admin());

create policy "vehicles_admin_update"
  on public.vehicles for update
  using (public.is_admin());

create policy "vehicles_admin_delete"
  on public.vehicles for delete
  using (public.is_admin());

create policy "locations_read_authed"
  on public.locations for select
  using (auth.role() = 'authenticated');

create policy "locations_admin_insert"
  on public.locations for insert
  with check (public.is_admin());

create policy "notifications_own_read"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications_own_update"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "notifications_admin_insert"
  on public.notifications for insert
  with check (public.is_admin() or auth.uid() = user_id);

create policy "reports_read_authed"
  on public.content_reports for select
  using (auth.role() = 'authenticated');

create policy "reports_insert_authed"
  on public.content_reports for insert
  with check (auth.uid() = reporter_id);

create policy "reports_admin_update"
  on public.content_reports for update
  using (public.is_admin());

create policy "audit_admin_read"
  on public.audit_log for select
  using (public.is_admin());

create policy "audit_admin_insert"
  on public.audit_log for insert
  with check (public.is_admin());

-- ============================ REALTIME =======================================
alter publication supabase_realtime add table public.vehicles;
alter publication supabase_realtime add table public.locations;
alter publication supabase_realtime add table public.notifications;

-- ============================ ANALYTICS RPCs =================================
create or replace function public.signups_by_day(days int default 7)
returns table(day date, count bigint)
language sql
stable
security definer
set search_path = public, auth
as $$
  select date_trunc('day', created_at)::date as day,
         count(*)::bigint
    from public.profiles
   where created_at >= now() - (days || ' days')::interval
   group by 1
   order by 1;
$$;

create or replace function public.fleet_metrics()
returns table(
  total_users      bigint,
  new_signups_7d   bigint,
  active_users_30d bigint,
  total_vehicles   bigint,
  active_vehicles  bigint,
  anomalies_24h    bigint,
  open_reports     bigint
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    (select count(*) from public.profiles where disabled = false),
    (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    (select count(distinct id) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    (select count(*) from public.vehicles where deleted_at is null),
    (select count(*) from public.vehicles where deleted_at is null and status = 'active'),
    (select count(*) from public.locations where anomaly = true and created_at >= now() - interval '24 hours'),
    (select count(*) from public.content_reports where status = 'open');
$$;

-- ============================ SEED (optional demo vehicles) ==================
insert into public.vehicles (plate, label, model, status, last_lat, last_lng, last_seen_at, description)
values
  ('GPC-1001', 'Truck A',  'Hino 300',        'active',  24.7136, 46.6753, now(), 'Distribution truck — north Riyadh route'),
  ('GPC-1002', 'Van B',    'Toyota HiAce',    'active',  24.7240, 46.6810, now(), 'City courier'),
  ('GPC-1003', 'Truck C',  'Isuzu D-Max',     'idle',    24.7000, 46.6500, now(), 'Construction support'),
  ('GPC-1004', 'Sedan D',  'Toyota Camry',    'offline', 24.6905, 46.6712, now() - interval '2 hours', 'Manager pool car'),
  ('GPC-1005', 'Truck E',  'Mercedes Actros', 'active',  24.7320, 46.7000, now(), 'Heavy haul')
on conflict (plate) do nothing;
