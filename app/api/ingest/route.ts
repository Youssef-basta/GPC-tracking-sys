import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectAnomaly } from "@/lib/anomaly";
import {
  detectZoneCrossings,
  type ZoneKind,
  type ZoneShape,
} from "@/lib/geofencing";

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

  // Geofence crossings — compare the first and last ping of this batch
  // against the previous known position.
  const { data: zonesData } = await admin
    .from("zones")
    .select("id, name, kind, shape, is_prohibited, alert_on")
    .is("deleted_at", null);
  const zones = (zonesData ?? []) as Array<{
    id: string;
    name: string;
    kind: ZoneKind;
    shape: ZoneShape;
    is_prohibited: boolean;
    alert_on: "enter" | "exit" | "both";
  }>;

  const zoneEventInserts: Array<{
    zone_id: string;
    vehicle_id: string;
    kind: "enter" | "exit";
    lat: number;
    lng: number;
  }> = [];
  const zoneNotices: { zone_name: string; kind: "enter" | "exit"; is_prohibited: boolean }[] = [];

  if (zones.length > 0) {
    const prevPos: [number, number] | null =
      vehicle.last_lat != null && vehicle.last_lng != null
        ? [vehicle.last_lat, vehicle.last_lng]
        : null;
    const lastPing = inserts[inserts.length - 1];
    const newPos: [number, number] = [lastPing.lat, lastPing.lng];
    const { entered, exited } = detectZoneCrossings(prevPos, newPos, zones);
    for (const z of entered) {
      zoneEventInserts.push({
        zone_id: z.id,
        vehicle_id: vehicle.id,
        kind: "enter",
        lat: newPos[0],
        lng: newPos[1],
      });
      if (z.alert_on === "enter" || z.alert_on === "both") {
        zoneNotices.push({
          zone_name: z.name,
          kind: "enter",
          is_prohibited: z.is_prohibited,
        });
      }
    }
    for (const z of exited) {
      zoneEventInserts.push({
        zone_id: z.id,
        vehicle_id: vehicle.id,
        kind: "exit",
        lat: newPos[0],
        lng: newPos[1],
      });
      if (z.alert_on === "exit" || z.alert_on === "both") {
        zoneNotices.push({
          zone_name: z.name,
          kind: "exit",
          is_prohibited: z.is_prohibited,
        });
      }
    }
    if (zoneEventInserts.length > 0) {
      await admin.from("zone_events").insert(zoneEventInserts);
    }
  }

  const anomalies = inserts.filter((r) => r.anomaly);
  if (anomalies.length > 0 || zoneNotices.length > 0) {
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("disabled", false);
    const adminIds = (admins ?? []).map((a) => a.id as string);
    const notes: Array<{ user_id: string; message: string; link: string }> = [];
    for (const a of adminIds) {
      for (const p of anomalies) {
        notes.push({
          user_id: a,
          message: `Anomaly (${p.anomaly_kind}) on vehicle ${vehicle.id.slice(0, 8)}…`,
          link: `/vehicles/${vehicle.id}`,
        });
      }
      for (const z of zoneNotices) {
        const prefix =
          z.is_prohibited && z.kind === "enter" ? "⚠ Prohibited" : "Geofence";
        notes.push({
          user_id: a,
          message: `${prefix}: vehicle ${vehicle.id.slice(0, 8)}… ${z.kind === "enter" ? "entered" : "exited"} "${z.zone_name}"`,
          link: `/vehicles/${vehicle.id}`,
        });
      }
    }
    if (notes.length > 0) await admin.from("notifications").insert(notes);
  }

  return NextResponse.json({
    ok: true,
    accepted: inserts.length,
    anomalies: anomalies.length,
    zone_events: zoneEventInserts.length,
  });
}
