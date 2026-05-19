// Geofencing — point-in-shape utilities for zones.
//
// We support three zone shapes:
//   - circle:    { lat, lng, radius_m }
//   - rectangle: { north, south, east, west }
//   - polygon:   { points: [[lat,lng], [lat,lng], ...] }  (closed implicitly)
//
// All functions take lat/lng as numbers in WGS84 degrees and return booleans.
// `containsPoint` dispatches by zone kind and is the only function callers
// need.

export type CircleShape = { lat: number; lng: number; radius_m: number };
export type RectangleShape = {
  north: number;
  south: number;
  east: number;
  west: number;
};
export type PolygonShape = { points: [number, number][] };
export type ZoneShape = CircleShape | RectangleShape | PolygonShape;
export type ZoneKind = "circle" | "rectangle" | "polygon";

/** Great-circle distance between two lat/lng points in meters. */
export function haversineMeters(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371000;
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

export function pointInCircle(
  point: [number, number],
  circle: CircleShape,
): boolean {
  return haversineMeters(point, [circle.lat, circle.lng]) <= circle.radius_m;
}

export function pointInRectangle(
  point: [number, number],
  rect: RectangleShape,
): boolean {
  const [lat, lng] = point;
  return (
    lat <= rect.north &&
    lat >= rect.south &&
    lng <= rect.east &&
    lng >= rect.west
  );
}

/**
 * Ray-casting algorithm. Polygon is treated as closed; the last vertex is
 * implicitly connected to the first.
 * Works in degree space — accurate enough for the polygon sizes a fleet uses
 * (city blocks, depots, customer sites). For very large polygons spanning
 * many degrees you'd want a great-circle-aware algorithm; we don't need that.
 */
export function pointInPolygon(
  point: [number, number],
  polygon: PolygonShape,
): boolean {
  const pts = polygon.points;
  if (pts.length < 3) return false;
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [latI, lngI] = pts[i];
    const [latJ, lngJ] = pts[j];
    const intersect =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function containsPoint(
  point: [number, number],
  kind: ZoneKind,
  shape: ZoneShape,
): boolean {
  if (kind === "circle") return pointInCircle(point, shape as CircleShape);
  if (kind === "rectangle")
    return pointInRectangle(point, shape as RectangleShape);
  if (kind === "polygon") return pointInPolygon(point, shape as PolygonShape);
  return false;
}

/**
 * Given a previous and next ping, plus all active zones, compute zone
 * crossings: entered (in next but not prev) and exited (in prev but not next).
 */
export function detectZoneCrossings<T extends { id: string; kind: ZoneKind; shape: ZoneShape }>(
  prev: [number, number] | null,
  next: [number, number],
  zones: T[],
): { entered: T[]; exited: T[]; inside: T[] } {
  const prevInside = new Set<string>();
  const nextInside = new Set<string>();
  for (const z of zones) {
    if (prev && containsPoint(prev, z.kind, z.shape)) prevInside.add(z.id);
    if (containsPoint(next, z.kind, z.shape)) nextInside.add(z.id);
  }
  const entered = zones.filter(
    (z) => nextInside.has(z.id) && !prevInside.has(z.id),
  );
  const exited = zones.filter(
    (z) => prevInside.has(z.id) && !nextInside.has(z.id),
  );
  const inside = zones.filter((z) => nextInside.has(z.id));
  return { entered, exited, inside };
}
