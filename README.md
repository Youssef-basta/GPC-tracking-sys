# GPC Tracking sys

Real-time fleet and device GPS tracking with AI anomaly detection.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + Auth + Realtime + RLS) · OpenRouter (AI summarization) · Leaflet + OpenStreetMap · Recharts · Sentry · Google Analytics.

---

## Features

### MVP — Phase 1
- **Email & password auth** — register / login / forgot password / reset password (Supabase Auth, ≥8-char password).
- **Admin role** — RLS-enforced `role` column on `profiles`. Admin routes redirect non-admins to `/dashboard`. **The first user to sign up is automatically promoted to admin.**
- **Live data updates** — Supabase Realtime channel on the dashboard. Markers move as new pings land. Clean unmount + stale-connection indicator.
- **Map display** — Leaflet + OpenStreetMap. Mobile-responsive. Fits to fleet bounds on load.
- **In-app notifications** — `notifications` table, realtime unread badge in the nav, last 20 in the popover, mark-as-read on click. Dedicated `/notifications` page shows the full history.
- **AI text summarization** — `POST /api/ai/summarize` calls OpenRouter and condenses an activity log into 3–5 sentences. Triggered on demand from a vehicle detail page.
- **User management** — admin search / filter / deactivate / reactivate / promote / demote. Every action is logged to `audit_log`.
- **Content management** — admins see all vehicles regardless of `deleted_at`, can soft-delete (sets `deleted_at`) and restore. Open-report count shown on the page header.
- **Analytics dashboard** — total users, new signups (7-day), active users (30-day), total/active vehicles, anomalies (24h), open reports. Recharts bar chart of signups. ISR with 5-minute revalidation.

### Phase 2
- **CSV export** — `GET /api/export/{users|vehicles|audit|locations|reports}` streams a CSV with timestamped filename. Respects the current `?q=` / `?role=` filter state.

### Other
- **GPS simulator** — `/api/simulate` generates pings around each vehicle's last position, flags `long_idle` (>10 min) and `route_jump` (>25 km) anomalies, and inserts admin notifications. Trigger manually from the dashboard or via cron (Vercel cron / Supabase scheduled function).
- **HTTP ingest endpoint** — `POST /api/ingest` accepts real GPS pings from physical trackers. Per-vehicle bearer token, visible to admins on the vehicle detail page (copy + rotate). Accepts a single ping or a batch of up to 200. Same anomaly detection as the simulator.
- **Audit log** — every admin mutation writes to `audit_log` (service role, RLS-restricted reads to admins).

---

## Setup

### 1) Create a Supabase project

1. Create a project at <https://supabase.com>.
2. Copy the **Project URL**, **anon key**, and **service role key**.

### 2) Configure env

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # server-side only, never exposed to client
OPENROUTER_API_KEY=...                 # optional — needed for AI summarization
OPENROUTER_MODEL=anthropic/claude-haiku-4-5
SIMULATE_CRON_SECRET=long-random-string
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

### 3) Apply the database schema

The schema lives in [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).

**Option A — Supabase Dashboard**: open the SQL editor, paste the contents of `001_init.sql`, run. Repeat for `002_seed.sql` (optional demo vehicles).

**Option B — Supabase CLI:**
```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

Or run the seed via JS:
```bash
npm run seed
```

### 4) Configure Supabase Auth

In **Authentication → URL Configuration** add:
- Site URL: `http://localhost:3000` (and your production URL)
- Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/reset-password`

For development you can disable email confirmation under **Authentication → Sign In / Up → Email**.

### 5) Run

```bash
npm run dev
```

Open <http://localhost:3000>, sign up — **the first account is automatically admin**.

### 6) Push real GPS pings (optional)

Each vehicle has its own ingest token, visible only to admins on the vehicle detail page (with copy + rotate buttons). Point a physical tracker at:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer <INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"lat": 24.7136, "lng": 46.6753, "speed_kmh": 45, "heading": 90}'
```

Batch form (up to 200 points, oldest first):

```json
{
  "points": [
    {"lat": 24.71, "lng": 46.67, "speed_kmh": 30, "created_at": "2026-05-17T10:00:00Z"},
    {"lat": 24.72, "lng": 46.68, "speed_kmh": 40, "created_at": "2026-05-17T10:00:10Z"}
  ]
}
```

### 7) Start the GPS simulator (optional)

In a second terminal:
```bash
npm run simulate          # default 5s interval
npm run simulate -- 2000  # 2s interval
```

Or trigger a single tick from the dashboard ("Simulate ping" button — admin only).

In production, schedule the cron from Vercel cron / Supabase scheduled functions:
```
POST https://YOUR-DOMAIN/api/simulate
Authorization: Bearer ${SIMULATE_CRON_SECRET}
```

---

## Project layout

```
app/
  (auth)/                 login, signup, forgot-password, reset-password
  (app)/                  authenticated app shell — sidebar + main content
    dashboard/            live map + status counters
    vehicles/             list + detail (+ AI summary)
    notifications/        full history
    admin/                users · content · analytics
  api/
    ai/summarize/         OpenRouter call (auth-gated)
    auth/                 callback + signout
    admin/                user, vehicle, report mutations (service role + audit)
    export/[type]/        CSV export
    simulate/             GPS ping simulator + anomaly detector
  layout.tsx              Tailwind + shadcn + Toaster + GA
components/
  ui/                     shadcn primitives
  realtime-map.tsx        Leaflet + supabase realtime
  notification-bell.tsx   realtime unread badge
  charts/                 Recharts wrappers
lib/
  supabase/{client,server,admin,middleware}.ts
  ai/openrouter.ts
  audit.ts · csv.ts · auth.ts · types.ts
supabase/migrations/      001_init.sql · 002_seed.sql
scripts/                  seed.ts · simulate.ts
middleware.ts             session refresh + role gating
```

---

## Wiring real GPS / OBD-II devices

Any tracker that can POST JSON over HTTPS works. The endpoint is:

```
POST /api/ingest
Authorization: Bearer <vehicle-ingest-token>
Content-Type: application/json
```

Find the token on each **Vehicle → detail page** (admin only) → **GPS ingest credentials** card. Rotate it any time from the same card.

### Single ping with sensors

```json
{
  "lat": 24.7136,
  "lng": 46.6753,
  "speed_kmh": 45,
  "heading": 90,
  "sensors": {
    "fuel_percent": 67,
    "temp_celsius": 88,
    "voltage_v": 13.6,
    "engine_rpm": 2400,
    "odometer_km": 142573.8,
    "extras": { "door_open": false, "ignition": true }
  }
}
```

### Batch (up to 200 points, oldest first)

```json
{
  "points": [
    {"lat": 24.71, "lng": 46.67, "speed_kmh": 30,
     "created_at": "2026-05-19T10:00:00Z",
     "sensors": { "fuel_percent": 90 }},
    {"lat": 24.72, "lng": 46.68, "speed_kmh": 40,
     "created_at": "2026-05-19T10:00:10Z",
     "sensors": { "fuel_percent": 89 }}
  ]
}
```

### Traccar setup (community-edition trackers)

Traccar can forward positions via the **Forward** plugin to an external HTTP endpoint. In `traccar.xml` add:

```xml
<entry key='forward.enable'>true</entry>
<entry key='forward.url'>https://gpc-tracking-sys.vercel.app/api/ingest</entry>
<entry key='forward.header'>Authorization: Bearer YOUR_INGEST_TOKEN</entry>
<entry key='forward.json'>true</entry>
```

Then write a small Lua/script transformer (Traccar supports `forward.template`) that converts Traccar's body into our schema, mapping:
- `latitude` → `lat`
- `longitude` → `lng`
- `speed` → `speed_kmh` (Traccar uses knots — multiply by 1.852)
- `attributes.batteryLevel` → `sensors.voltage_v` × 12 (if % battery)
- `attributes.fuel` → `sensors.fuel_percent`
- `attributes.engineHours` / `odometer` → `sensors.odometer_km`

### OBD-II dongle setup (e.g. Bluetooth ELM327 + Raspberry Pi)

A small Python script polls the OBD-II port and POSTs each reading:

```python
import obd, requests, time
INGEST_URL = "https://gpc-tracking-sys.vercel.app/api/ingest"
TOKEN = "your-ingest-token-here"
conn = obd.OBD()

while True:
    rpm = conn.query(obd.commands.RPM).value
    temp = conn.query(obd.commands.COOLANT_TEMP).value
    fuel = conn.query(obd.commands.FUEL_LEVEL).value
    voltage = conn.query(obd.commands.CONTROL_MODULE_VOLTAGE).value
    speed = conn.query(obd.commands.SPEED).value
    # ... get GPS from external module (USB GPS, phone, etc.)
    body = {
        "lat": gps_lat, "lng": gps_lng, "speed_kmh": float(speed.to("km/h").magnitude),
        "sensors": {
            "engine_rpm": int(rpm.magnitude),
            "temp_celsius": float(temp.to("celsius").magnitude),
            "fuel_percent": float(fuel.magnitude),
            "voltage_v": float(voltage.magnitude),
        },
    }
    requests.post(INGEST_URL, json=body,
                  headers={"Authorization": f"Bearer {TOKEN}"})
    time.sleep(30)
```

Once data starts flowing, the dashboard map, Sensors card, sparklines, and reports all populate automatically.

## What's intentionally deferred

- **Payments (MyFatoorah / Tap)** — no payment user story in Phase 1. Add when a billing model is defined.
- **Email templates** — Supabase Auth defaults are used; customize in Authentication → Email Templates.
