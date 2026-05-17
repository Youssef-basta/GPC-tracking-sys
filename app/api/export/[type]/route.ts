import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, timestampedFilename, toCSV } from "@/lib/csv";

type Exportable = "users" | "vehicles" | "audit" | "locations" | "reports";
const ALLOWED: Exportable[] = ["users", "vehicles", "audit", "locations", "reports"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!ALLOWED.includes(type as Exportable)) {
    return new NextResponse("Unknown export type", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const role = searchParams.get("role");

  if (type === "users") {
    let query = supabase
      .from("profiles")
      .select("id, full_name, email, role, disabled, created_at")
      .order("created_at", { ascending: false });
    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    if (role && role !== "all") query = query.eq("role", role);
    const { data, error } = await query;
    if (error) return new NextResponse(error.message, { status: 500 });
    const csv = toCSV(data || [], [
      { key: "id", header: "ID" },
      { key: "full_name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "role", header: "Role" },
      { key: "disabled", header: "Disabled" },
      { key: "created_at", header: "Created at" },
    ]);
    return csvResponse(csv, timestampedFilename("users"));
  }

  if (type === "vehicles") {
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, plate, label, model, status, last_lat, last_lng, last_seen_at, deleted_at, created_at")
      .order("created_at", { ascending: false });
    if (error) return new NextResponse(error.message, { status: 500 });
    const csv = toCSV(data || [], [
      { key: "id", header: "ID" },
      { key: "plate", header: "Plate" },
      { key: "label", header: "Label" },
      { key: "model", header: "Model" },
      { key: "status", header: "Status" },
      { key: "last_lat", header: "Last lat" },
      { key: "last_lng", header: "Last lng" },
      { key: "last_seen_at", header: "Last seen" },
      { key: "deleted_at", header: "Deleted at" },
      { key: "created_at", header: "Created at" },
    ]);
    return csvResponse(csv, timestampedFilename("vehicles"));
  }

  if (type === "audit") {
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, actor_id, action, target_type, target_id, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) return new NextResponse(error.message, { status: 500 });
    const rows = (data || []).map((r) => ({
      ...r,
      meta: r.meta ? JSON.stringify(r.meta) : "",
    }));
    const csv = toCSV(rows, [
      { key: "id", header: "ID" },
      { key: "created_at", header: "When" },
      { key: "actor_id", header: "Actor" },
      { key: "action", header: "Action" },
      { key: "target_type", header: "Target type" },
      { key: "target_id", header: "Target ID" },
      { key: "meta", header: "Meta" },
    ]);
    return csvResponse(csv, timestampedFilename("audit"));
  }

  if (type === "locations") {
    const vehicleId = searchParams.get("vehicle_id");
    let query = supabase
      .from("locations")
      .select("id, vehicle_id, lat, lng, speed_kmh, heading, idle_seconds, anomaly, anomaly_kind, created_at")
      .order("created_at", { ascending: false })
      .limit(10000);
    if (vehicleId) query = query.eq("vehicle_id", vehicleId);
    const { data, error } = await query;
    if (error) return new NextResponse(error.message, { status: 500 });
    const csv = toCSV(data || [], [
      { key: "id", header: "ID" },
      { key: "vehicle_id", header: "Vehicle" },
      { key: "created_at", header: "When" },
      { key: "lat", header: "Lat" },
      { key: "lng", header: "Lng" },
      { key: "speed_kmh", header: "Speed (km/h)" },
      { key: "heading", header: "Heading" },
      { key: "idle_seconds", header: "Idle (s)" },
      { key: "anomaly", header: "Anomaly" },
      { key: "anomaly_kind", header: "Anomaly kind" },
    ]);
    return csvResponse(csv, timestampedFilename("locations"));
  }

  if (type === "reports") {
    const { data, error } = await supabase
      .from("content_reports")
      .select("id, vehicle_id, reporter_id, reason, status, created_at")
      .order("created_at", { ascending: false });
    if (error) return new NextResponse(error.message, { status: 500 });
    const csv = toCSV(data || [], [
      { key: "id", header: "ID" },
      { key: "created_at", header: "When" },
      { key: "vehicle_id", header: "Vehicle" },
      { key: "reporter_id", header: "Reporter" },
      { key: "reason", header: "Reason" },
      { key: "status", header: "Status" },
    ]);
    return csvResponse(csv, timestampedFilename("reports"));
  }

  return new NextResponse("Unknown type", { status: 404 });
}
