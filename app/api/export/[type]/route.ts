import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, timestampedFilename, toCSV } from "@/lib/csv";
import {
  buildPdfReport,
  pdfResponse,
  timestampedPdfFilename,
} from "@/lib/pdf";

// Each report tab has the same column set in both CSV and PDF. We use a single
// table of column definitions and dispatch the renderer by the `?format=`
// query param (`csv` default, or `pdf`).
type Col<K extends string = string> = {
  key: K;
  header: string;
  align?: "left" | "right" | "center";
};

function renderTabular(
  format: "csv" | "pdf",
  rows: Record<string, unknown>[],
  cols: Col[],
  filename: string,
  pdfOpts: { title: string; subtitle?: string; meta?: { label: string; value: string }[] },
) {
  if (format === "pdf") {
    const bytes = buildPdfReport({
      title: pdfOpts.title,
      subtitle: pdfOpts.subtitle,
      meta: pdfOpts.meta,
      columns: cols.map((c) => ({
        header: c.header,
        dataKey: c.key,
        align: c.align,
      })),
      rows,
    });
    return pdfResponse(bytes, timestampedPdfFilename(filename));
  }
  const csv = toCSV(rows, cols);
  return csvResponse(csv, timestampedFilename(filename));
}

type Exportable =
  | "users"
  | "vehicles"
  | "audit"
  | "locations"
  | "reports"
  | "report-activity"
  | "report-speed"
  | "report-idle"
  | "report-anomalies"
  | "report-sensors"
  | "report-audit";
const ALLOWED: Exportable[] = [
  "users",
  "vehicles",
  "audit",
  "locations",
  "reports",
  "report-activity",
  "report-speed",
  "report-idle",
  "report-anomalies",
  "report-sensors",
  "report-audit",
];

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
  const format: "csv" | "pdf" =
    searchParams.get("format") === "pdf" ? "pdf" : "csv";

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
      .select("id, plate, label, model, driver_name, status, last_lat, last_lng, last_seen_at, deleted_at, created_at")
      .order("created_at", { ascending: false });
    if (error) return new NextResponse(error.message, { status: 500 });
    const csv = toCSV(data || [], [
      { key: "id", header: "ID" },
      { key: "plate", header: "Plate" },
      { key: "label", header: "Label" },
      { key: "driver_name", header: "Driver" },
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

  // Date-bounded report exports
  if (type.startsWith("report-")) {
    const days = Math.max(1, Math.min(365, Number(searchParams.get("days")) || 7));
    const threshold = Math.max(
      20,
      Math.min(300, Number(searchParams.get("threshold")) || 80),
    );
    const minIdle = Math.max(
      60,
      Math.min(7200, Number(searchParams.get("min_idle")) || 300),
    );

    // Custom from/to take precedence over the `days` preset
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    let from: Date;
    let to: Date;
    if (fromParam || toParam) {
      to = toParam ? new Date(toParam) : new Date();
      from = fromParam
        ? new Date(fromParam)
        : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return new NextResponse("Invalid from/to", { status: 400 });
      }
    } else {
      to = new Date();
      from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    }
    const range = { date_from: from.toISOString(), date_to: to.toISOString() };
    // Filename-friendly slug for the range
    const rangeSlug = fromParam || toParam
      ? `${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}`
      : `${days}d`;

    const rangeMeta = [
      {
        label: "Range",
        value: `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
      },
    ];

    if (type === "report-activity") {
      const { data, error } = await supabase.rpc("report_vehicle_activity", range);
      if (error) return new NextResponse(error.message, { status: 500 });
      return renderTabular(
        format,
        (data || []) as Record<string, unknown>[],
        [
          { key: "plate", header: "Plate" },
          { key: "label", header: "Label" },
          { key: "driver_name", header: "Driver" },
          { key: "ping_count", header: "Pings", align: "right" },
          { key: "distance_km", header: "Distance (km)", align: "right" },
          { key: "max_speed_kmh", header: "Max speed (km/h)", align: "right" },
          { key: "avg_moving_kmh", header: "Avg moving (km/h)", align: "right" },
          { key: "total_idle_seconds", header: "Total idle (s)", align: "right" },
          { key: "anomaly_count", header: "Anomalies", align: "right" },
          { key: "last_seen", header: "Last seen" },
        ],
        `activity-${rangeSlug}`,
        { title: "Activity summary", subtitle: "Per-vehicle activity report", meta: rangeMeta },
      );
    }

    if (type === "report-speed") {
      const { data, error } = await supabase.rpc("report_speed_violations", {
        ...range,
        threshold_kmh: threshold,
        max_rows: 5000,
      });
      if (error) return new NextResponse(error.message, { status: 500 });
      return renderTabular(
        format,
        (data || []) as Record<string, unknown>[],
        [
          { key: "created_at", header: "When" },
          { key: "plate", header: "Plate" },
          { key: "label", header: "Label" },
          { key: "driver_name", header: "Driver" },
          { key: "speed_kmh", header: "Speed (km/h)", align: "right" },
          { key: "lat", header: "Lat", align: "right" },
          { key: "lng", header: "Lng", align: "right" },
        ],
        `speed-violations-${threshold}kmh-${rangeSlug}`,
        {
          title: "Speed violations",
          subtitle: `Pings above ${threshold} km/h`,
          meta: rangeMeta,
        },
      );
    }

    if (type === "report-idle") {
      const { data, error } = await supabase.rpc("report_idle_events", {
        ...range,
        min_idle_seconds: minIdle,
        max_rows: 5000,
      });
      if (error) return new NextResponse(error.message, { status: 500 });
      return renderTabular(
        format,
        (data || []) as Record<string, unknown>[],
        [
          { key: "created_at", header: "When" },
          { key: "plate", header: "Plate" },
          { key: "label", header: "Label" },
          { key: "driver_name", header: "Driver" },
          { key: "idle_seconds", header: "Idle (s)", align: "right" },
          { key: "lat", header: "Lat", align: "right" },
          { key: "lng", header: "Lng", align: "right" },
        ],
        `idle-events-${minIdle}s-${rangeSlug}`,
        {
          title: "Idle events",
          subtitle: `Pings idle ≥ ${minIdle}s`,
          meta: rangeMeta,
        },
      );
    }

    if (type === "report-sensors") {
      const { data, error } = await supabase.rpc("report_vehicle_sensors", range);
      if (error) return new NextResponse(error.message, { status: 500 });
      return renderTabular(
        format,
        (data || []) as Record<string, unknown>[],
        [
          { key: "plate", header: "Plate" },
          { key: "label", header: "Label" },
          { key: "driver_name", header: "Driver" },
          { key: "tank_litres", header: "Tank (L)", align: "right" },
          { key: "reading_count", header: "Readings", align: "right" },
          { key: "fuel_avg", header: "Fuel avg %", align: "right" },
          { key: "fuel_min", header: "Fuel min %", align: "right" },
          { key: "fuel_max", header: "Fuel max %", align: "right" },
          { key: "fuel_consumed_percent", header: "Fuel consumed %", align: "right" },
          { key: "fuel_consumed_litres", header: "Fuel consumed (L)", align: "right" },
          { key: "temp_avg", header: "Temp avg °C", align: "right" },
          { key: "temp_max", header: "Temp max °C", align: "right" },
          { key: "voltage_avg", header: "Voltage avg V", align: "right" },
          { key: "voltage_min", header: "Voltage min V", align: "right" },
          { key: "rpm_avg", header: "RPM avg", align: "right" },
          { key: "odometer_start", header: "Odo start (km)", align: "right" },
          { key: "odometer_end", header: "Odo end (km)", align: "right" },
          { key: "distance_km", header: "Distance (km)", align: "right" },
          { key: "efficiency_l_per_100km", header: "L/100km", align: "right" },
          { key: "last_reading_at", header: "Last reading" },
        ],
        `sensors-${rangeSlug}`,
        {
          title: "Sensor summary",
          subtitle: "Per-vehicle fuel + efficiency + temp + voltage + RPM aggregates",
          meta: rangeMeta,
        },
      );
    }

    if (type === "report-anomalies") {
      const { data, error } = await supabase.rpc("report_anomalies", range);
      if (error) return new NextResponse(error.message, { status: 500 });
      return renderTabular(
        format,
        (data || []) as Record<string, unknown>[],
        [
          { key: "plate", header: "Plate" },
          { key: "label", header: "Label" },
          { key: "driver_name", header: "Driver" },
          { key: "anomaly_kind", header: "Kind" },
          { key: "occurrences", header: "Occurrences", align: "right" },
          { key: "last_occurrence", header: "Last occurrence" },
        ],
        `anomalies-${rangeSlug}`,
        {
          title: "Anomalies",
          subtitle: "Long-idle + route-jump events grouped by vehicle",
          meta: rangeMeta,
        },
      );
    }

    if (type === "report-audit") {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, actor_id, action, target_type, target_id, meta, created_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) return new NextResponse(error.message, { status: 500 });
      const rows = (data || []).map((r) => ({
        ...r,
        meta: r.meta ? JSON.stringify(r.meta) : "",
      }));
      return renderTabular(
        format,
        rows as Record<string, unknown>[],
        [
          { key: "created_at", header: "When" },
          { key: "actor_id", header: "Actor" },
          { key: "action", header: "Action" },
          { key: "target_type", header: "Target type" },
          { key: "target_id", header: "Target ID" },
          { key: "meta", header: "Meta" },
        ],
        `audit-${rangeSlug}`,
        { title: "Audit trail", subtitle: "Admin mutations", meta: rangeMeta },
      );
    }
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
