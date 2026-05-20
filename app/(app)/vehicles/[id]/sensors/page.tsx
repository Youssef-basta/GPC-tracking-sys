import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageTitle } from "@/components/page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SensorHistoryCharts } from "./sensor-history-charts";
import type { Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

const PRESETS = [
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

export default async function VehicleSensorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hours?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireProfile();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single<Vehicle>();
  if (!vehicle) notFound();

  const hours = Math.max(
    1,
    Math.min(24 * 365, Number(sp.hours) || 24),
  );
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const to = new Date();

  // Server-side fetch — supplies initial points. The client component also
  // subscribes to realtime INSERT so new readings extend the charts live.
  const { data: rows } = await supabase
    .from("sensor_readings")
    .select(
      "created_at, fuel_percent, temp_celsius, voltage_v, engine_rpm, odometer_km",
    )
    .eq("vehicle_id", id)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(5000);

  return (
    <div className="space-y-6">
      <Link
        href={`/vehicles/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Back to vehicle
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle>{vehicle.label} — Sensor history</PageTitle>
          <p className="font-mono text-sm text-muted-foreground">
            {vehicle.plate}
            {vehicle.driver_name ? ` · ${vehicle.driver_name}` : ""}
          </p>
        </div>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <Link
              key={p.hours}
              href={`/vehicles/${id}/sensors?hours=${p.hours}`}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                hours === p.hours
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent/60"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="font-normal">
          {from.toLocaleString()} → {to.toLocaleString()}
        </Badge>
        <span className="text-muted-foreground">
          {rows?.length ?? 0} reading{rows?.length === 1 ? "" : "s"}
        </span>
      </div>

      <SensorHistoryCharts
        vehicleId={id}
        initial={rows ?? []}
        fromIso={from.toISOString()}
      />

      {vehicle.fuel_tank_litres == null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tip</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Set the <strong>fuel tank size</strong> on this vehicle (Edit
            dialog) to unlock fuel-consumption + L/100km efficiency in the
            Sensors report.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
