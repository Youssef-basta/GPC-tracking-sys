import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GPS simulator + lightweight AI-style anomaly detector.
 *
 * Each invocation:
 *   - reads all live vehicles
 *   - for each, generates a new ping near the last position
 *   - flags pings as anomalous when idle > 10 min OR a sudden large jump
 *   - notifies admins about each anomaly
 *
 * Invocation:
 *   - From the dashboard (admins) → POST /api/simulate?manual=1
 *   - From a cron (Vercel cron, Supabase scheduled function, etc.):
 *       GET /api/simulate with header `Authorization: Bearer ${SIMULATE_CRON_SECRET}`
 */

const STEP_DEG = 0.0015; // ~150 m
const JUMP_THRESHOLD_KM = 25;

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function authorize(request: NextRequest) {
  const url = new URL(request.url);
  const manual = url.searchParams.get("manual");
  if (manual) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return profile?.role === "admin";
  }
  const auth = request.headers.get("authorization");
  return (
    !!process.env.SIMULATE_CRON_SECRET &&
    auth === `Bearer ${process.env.SIMULATE_CRON_SECRET}`
  );
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  if (!(await authorize(request))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const admin = createAdminClient();
  const { data: vehicles, error } = await admin
    .from("vehicles")
    .select("id, last_lat, last_lng, last_seen_at, status")
    .is("deleted_at", null);
  if (error) return new NextResponse(error.message, { status: 500 });

  const now = new Date();
  const inserts: Array<{
    vehicle_id: string;
    lat: number;
    lng: number;
    speed_kmh: number;
    heading: number;
    idle_seconds: number;
    anomaly: boolean;
    anomaly_kind: string | null;
  }> = [];
  const anomalyNotices: { vehicle_id: string; kind: string }[] = [];

  for (const v of vehicles || []) {
    const baseLat = v.last_lat ?? 24.7136;
    const baseLng = v.last_lng ?? 46.6753;
    const idleSeconds = v.last_seen_at
      ? Math.floor((now.getTime() - new Date(v.last_seen_at).getTime()) / 1000)
      : 0;

    const willIdle = Math.random() < 0.1; // 10% chance to stay still
    const lat = willIdle ? baseLat : baseLat + (Math.random() - 0.5) * STEP_DEG * 2;
    const lng = willIdle ? baseLng : baseLng + (Math.random() - 0.5) * STEP_DEG * 2;
    const dKm = haversineKm([baseLat, baseLng], [lat, lng]);
    const speed_kmh = willIdle ? 0 : Math.min(120, Math.max(0, dKm * 3600 / 60));
    const heading = Math.random() * 360;
    const nextIdle = willIdle ? idleSeconds + 60 : 0;

    let anomaly = false;
    let anomaly_kind: string | null = null;
    if (nextIdle > 600) {
      anomaly = true;
      anomaly_kind = "long_idle";
    } else if (dKm > JUMP_THRESHOLD_KM) {
      anomaly = true;
      anomaly_kind = "route_jump";
    }

    inserts.push({
      vehicle_id: v.id,
      lat,
      lng,
      speed_kmh,
      heading,
      idle_seconds: nextIdle,
      anomaly,
      anomaly_kind,
    });

    if (anomaly) anomalyNotices.push({ vehicle_id: v.id, kind: anomaly_kind! });
  }

  if (inserts.length > 0) {
    await admin.from("locations").insert(inserts);
  }

  if (anomalyNotices.length > 0) {
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("disabled", false);

    const notes = (admins || []).flatMap((a) =>
      anomalyNotices.map((n) => ({
        user_id: a.id,
        message: `Anomaly: ${n.kind.replace("_", " ")} on vehicle ${n.vehicle_id.slice(0, 8)}…`,
        link: `/vehicles/${n.vehicle_id}`,
      })),
    );
    if (notes.length > 0) {
      await admin.from("notifications").insert(notes);
    }
  }

  return NextResponse.json({
    pings: inserts.length,
    anomalies: anomalyNotices.length,
  });
}
