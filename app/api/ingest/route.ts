import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectAnomaly } from "@/lib/anomaly";

/**
 * GPS ingest endpoint for real devices / trackers.
 *
 * Auth: per-vehicle bearer token, found on the vehicle detail page (admin view).
 *
 *   POST /api/ingest
 *   Authorization: Bearer <ingest_token>
 *   Content-Type: application/json
 *
 * Body — single ping:
 *   { "lat": 24.71, "lng": 46.67, "speed_kmh": 45, "heading": 90 }
 *
 * Body — batch (up to 200 points, oldest first):
 *   { "points": [
 *       { "lat": 24.71, "lng": 46.67, "speed_kmh": 45, "heading": 90, "created_at": "2026-05-17T..." },
 *       ...
 *     ] }
 *
 * Anomalies (long_idle, route_jump) are flagged and admins receive notifications.
 */

const pingSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  speed_kmh: z.number().gte(0).lte(500).optional(),
  heading: z.number().gte(0).lt(360).optional(),
  idle_seconds: z.number().int().gte(0).optional(),
  created_at: z.string().datetime().optional(),
});

const bodySchema = z.union([
  pingSchema,
  z.object({ points: z.array(pingSchema).min(1).max(200) }),
]);

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+([0-9a-fA-F-]{36})$/);
  if (!match) {
    return new NextResponse("Missing or malformed bearer token", { status: 401 });
  }
  const token = match[1];

  const admin = createAdminClient();
  const { data: vehicle, error: vErr } = await admin
    .from("vehicles")
    .select("id, last_lat, last_lng, last_seen_at, deleted_at")
    .eq("ingest_token", token)
    .single();
  if (vErr || !vehicle) {
    return new NextResponse("Unknown token", { status: 401 });
  }
  if (vehicle.deleted_at) {
    return new NextResponse("Vehicle deleted", { status: 410 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const points = "points" in parsed.data ? parsed.data.points : [parsed.data];

  // Walk forward through the batch, anomaly-checking each against the running prev.
  let prev: { lat: number | null; lng: number | null } = {
    lat: vehicle.last_lat,
    lng: vehicle.last_lng,
  };
  let lastSeen = vehicle.last_seen_at ? new Date(vehicle.last_seen_at) : null;

  const inserts = points.map((p) => {
    const ts = p.created_at ? new Date(p.created_at) : new Date();
    const idle =
      p.idle_seconds ??
      (lastSeen ? Math.max(0, Math.floor((ts.getTime() - lastSeen.getTime()) / 1000)) : 0);
    const { anomaly, anomaly_kind } = detectAnomaly({
      prev,
      next: { lat: p.lat, lng: p.lng },
      idle_seconds: idle,
    });
    prev = { lat: p.lat, lng: p.lng };
    lastSeen = ts;
    return {
      vehicle_id: vehicle.id,
      lat: p.lat,
      lng: p.lng,
      speed_kmh: p.speed_kmh ?? 0,
      heading: p.heading ?? null,
      idle_seconds: idle,
      anomaly,
      anomaly_kind,
      created_at: ts.toISOString(),
    };
  });

  const { error: insErr } = await admin.from("locations").insert(inserts);
  if (insErr) {
    return new NextResponse(insErr.message, { status: 500 });
  }

  const anomalies = inserts.filter((r) => r.anomaly);
  if (anomalies.length > 0) {
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("disabled", false);
    const notes = (admins || []).flatMap((a) =>
      anomalies.map((p) => ({
        user_id: a.id,
        message: `Anomaly (${p.anomaly_kind}) on vehicle ${vehicle.id.slice(0, 8)}…`,
        link: `/vehicles/${vehicle.id}`,
      })),
    );
    if (notes.length > 0) await admin.from("notifications").insert(notes);
  }

  return NextResponse.json({
    ok: true,
    accepted: inserts.length,
    anomalies: anomalies.length,
  });
}
