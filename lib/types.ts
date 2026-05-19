export type UserRole = "user" | "admin";
export type VehicleStatus = "active" | "idle" | "offline" | "maintenance";
export type ReportStatus = "open" | "resolved" | "dismissed";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  disabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  label: string;
  model: string | null;
  status: VehicleStatus;
  description: string | null;
  driver_name: string | null;
  owner_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: string | null;
  ingest_token?: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleLocation {
  id: number;
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number | null;
  idle_seconds: number;
  anomaly: boolean;
  anomaly_kind: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface ContentReport {
  id: string;
  vehicle_id: string | null;
  reporter_id: string | null;
  reason: string;
  status: ReportStatus;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface FleetMetrics {
  total_users: number;
  new_signups_7d: number;
  active_users_30d: number;
  total_vehicles: number;
  active_vehicles: number;
  anomalies_24h: number;
  open_reports: number;
}
