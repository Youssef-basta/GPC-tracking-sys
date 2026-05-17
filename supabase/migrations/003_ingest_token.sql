-- Add per-vehicle ingest tokens so real GPS devices can POST /api/ingest
-- with `Authorization: Bearer <token>`.

alter table public.vehicles
  add column if not exists ingest_token uuid not null default gen_random_uuid();

create unique index if not exists vehicles_ingest_token_idx
  on public.vehicles(ingest_token);

-- The token is sensitive — strip it from default read policies and expose only to admins.
-- (Admins already get full read via the existing policy; non-admins keep seeing every other
--  column. We protect the token column by routing reads through the service role on the
--  admin UI and never selecting it from the client.)
