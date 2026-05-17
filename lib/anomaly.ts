// Lightweight anomaly detector shared by the simulator and the live ingest endpoint.
// Flags two kinds:
//   - long_idle: idle_seconds > IDLE_THRESHOLD_SEC
//   - route_jump: distance from previous fix > JUMP_THRESHOLD_KM

export const IDLE_THRESHOLD_SEC = 600;
export const JUMP_THRESHOLD_KM = 25;

export function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
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

export function detectAnomaly(input: {
  prev: { lat: number | null; lng: number | null } | null;
  next: { lat: number; lng: number };
  idle_seconds: number;
}): { anomaly: boolean; anomaly_kind: string | null } {
  if (input.idle_seconds > IDLE_THRESHOLD_SEC) {
    return { anomaly: true, anomaly_kind: "long_idle" };
  }
  if (
    input.prev &&
    input.prev.lat != null &&
    input.prev.lng != null
  ) {
    const km = haversineKm(
      [input.prev.lat, input.prev.lng],
      [input.next.lat, input.next.lng],
    );
    if (km > JUMP_THRESHOLD_KM) {
      return { anomaly: true, anomaly_kind: "route_jump" };
    }
  }
  return { anomaly: false, anomaly_kind: null };
}
