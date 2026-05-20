// Custom monitors — evaluation engine.
//
// A monitor fires when ALL conditions evaluate true for a given ping.
// Conditions are discriminated by `type`:
//   speed_above   { kmh: number }
//   speed_below   { kmh: number }
//   idle_above    { seconds: number }
//   in_zone       { zone_ids: string[] }    // currently in ANY of the listed zones
//   out_of_zone   { zone_ids: string[] }    // currently in NONE of the listed zones

import { containsPoint, type ZoneKind, type ZoneShape } from "@/lib/geofencing";

export type MonitorCondition =
  | { type: "speed_above"; kmh: number }
  | { type: "speed_below"; kmh: number }
  | { type: "idle_above"; seconds: number }
  | { type: "in_zone"; zone_ids: string[] }
  | { type: "out_of_zone"; zone_ids: string[] };

export type MonitorAction = { type: "notify_admins" };

export interface MonitorRecord {
  id: string;
  name: string;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  vehicle_ids: string[] | null;
  conditions: MonitorCondition[];
  actions: MonitorAction[];
}

export interface ZoneLite {
  id: string;
  kind: ZoneKind;
  shape: ZoneShape;
}

export interface PingContext {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  idle_seconds: number;
  ts: Date;
}

/** Returns true when the given vehicle is currently inside the zone. */
function inZone(point: [number, number], zone: ZoneLite): boolean {
  return containsPoint(point, zone.kind, zone.shape);
}

/** Evaluate a single condition against a ping + the current zone catalog. */
function evalCondition(
  cond: MonitorCondition,
  ping: PingContext,
  zonesById: Map<string, ZoneLite>,
): boolean {
  switch (cond.type) {
    case "speed_above":
      return ping.speed_kmh > cond.kmh;
    case "speed_below":
      return ping.speed_kmh < cond.kmh;
    case "idle_above":
      return ping.idle_seconds > cond.seconds;
    case "in_zone": {
      const point: [number, number] = [ping.lat, ping.lng];
      return cond.zone_ids.some((zid) => {
        const z = zonesById.get(zid);
        return z ? inZone(point, z) : false;
      });
    }
    case "out_of_zone": {
      const point: [number, number] = [ping.lat, ping.lng];
      // True if the point is NOT in any of the listed zones.
      return !cond.zone_ids.some((zid) => {
        const z = zonesById.get(zid);
        return z ? inZone(point, z) : false;
      });
    }
    default:
      return false;
  }
}

function monitorAppliesToVehicle(m: MonitorRecord, vehicleId: string): boolean {
  if (!m.vehicle_ids || m.vehicle_ids.length === 0) return true;
  return m.vehicle_ids.includes(vehicleId);
}

function monitorWithinValidity(m: MonitorRecord, now: Date): boolean {
  if (m.valid_from && new Date(m.valid_from).getTime() > now.getTime())
    return false;
  if (m.valid_until && new Date(m.valid_until).getTime() < now.getTime())
    return false;
  return true;
}

/**
 * Given a ping, return all monitors that fire on it. Caller is responsible
 * for applying cooldown logic and writing audit/notification rows.
 */
export function matchMonitors(
  ping: PingContext,
  monitors: MonitorRecord[],
  zones: ZoneLite[],
): MonitorRecord[] {
  const zonesById = new Map(zones.map((z) => [z.id, z]));
  const out: MonitorRecord[] = [];
  for (const m of monitors) {
    if (!m.is_active) continue;
    if (!monitorWithinValidity(m, ping.ts)) continue;
    if (!monitorAppliesToVehicle(m, ping.vehicle_id)) continue;
    if (m.conditions.length === 0) continue; // empty rule never fires
    const allTrue = m.conditions.every((c) =>
      evalCondition(c, ping, zonesById),
    );
    if (allTrue) out.push(m);
  }
  return out;
}

/** Human-readable summary for a condition (used in UI + notifications). */
export function describeCondition(c: MonitorCondition): string {
  switch (c.type) {
    case "speed_above":
      return `speed > ${c.kmh} km/h`;
    case "speed_below":
      return `speed < ${c.kmh} km/h`;
    case "idle_above":
      return `idle > ${c.seconds}s`;
    case "in_zone":
      return `inside ${c.zone_ids.length} zone${c.zone_ids.length === 1 ? "" : "s"}`;
    case "out_of_zone":
      return `outside ${c.zone_ids.length} zone${c.zone_ids.length === 1 ? "" : "s"}`;
  }
}
