-- Seed: a few demo vehicles around Riyadh, KSA
-- Run AFTER 001_init.sql, and AFTER creating at least one admin user.
-- (The first user to sign up is automatically promoted to admin.)

insert into public.vehicles (plate, label, model, status, last_lat, last_lng, last_seen_at, description)
values
  ('GPC-1001', 'Truck A',  'Hino 300',       'active',  24.7136, 46.6753, now(), 'Distribution truck — north Riyadh route'),
  ('GPC-1002', 'Van B',    'Toyota HiAce',   'active',  24.7240, 46.6810, now(), 'City courier'),
  ('GPC-1003', 'Truck C',  'Isuzu D-Max',    'idle',    24.7000, 46.6500, now(), 'Construction support'),
  ('GPC-1004', 'Sedan D',  'Toyota Camry',   'offline', 24.6905, 46.6712, now() - interval '2 hours', 'Manager pool car'),
  ('GPC-1005', 'Truck E',  'Mercedes Actros','active',  24.7320, 46.7000, now(), 'Heavy haul')
on conflict (plate) do nothing;
