import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SummarySection } from "@/components/summary-section";
import { IngestCredentials } from "@/components/ingest-credentials";
import { EditVehicleDialog } from "@/components/vehicle-dialog";
import type { Vehicle, VehicleLocation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, supabase } = await requireProfile();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single<Vehicle>();
  if (!vehicle) notFound();

  let ingestToken: string | null = null;
  if (profile.role === "admin") {
    const admin = createAdminClient();
    const { data: secret } = await admin
      .from("vehicles")
      .select("ingest_token")
      .eq("id", id)
      .single<{ ingest_token: string }>();
    ingestToken = secret?.ingest_token ?? null;
  }

  const { data: locs } = await supabase
    .from("locations")
    .select("*")
    .eq("vehicle_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const locations = (locs ?? []) as VehicleLocation[];

  const activityLog = locations
    .slice(0, 30)
    .map(
      (l) =>
        `${new Date(l.created_at).toISOString()} | speed ${l.speed_kmh.toFixed(
          1,
        )} km/h | idle ${l.idle_seconds}s | (${l.lat.toFixed(
          5,
        )}, ${l.lng.toFixed(5)})${l.anomaly ? ` | ANOMALY: ${l.anomaly_kind || "flagged"}` : ""}`,
    )
    .join("\n");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to vehicles
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="bg-gradient-to-r from-sky-600 via-fuchsia-600 to-emerald-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-sky-400 dark:via-fuchsia-400 dark:to-emerald-400">
            {vehicle.label}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {vehicle.plate}
            {vehicle.model && <> · {vehicle.model}</>}
          </p>
          {vehicle.driver_name && (
            <p className="mt-1 text-sm">
              <span className="text-muted-foreground">Driver:</span>{" "}
              <span className="font-medium">{vehicle.driver_name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="capitalize">{vehicle.status}</Badge>
          {profile.role === "admin" && <EditVehicleDialog vehicle={vehicle} />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Last position</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              Lat:{" "}
              <span className="font-mono">
                {vehicle.last_lat?.toFixed(5) || "—"}
              </span>
            </div>
            <div>
              Lng:{" "}
              <span className="font-mono">
                {vehicle.last_lng?.toFixed(5) || "—"}
              </span>
            </div>
            <div className="text-muted-foreground">
              {vehicle.last_seen_at
                ? `Last ping ${formatDistanceToNow(new Date(vehicle.last_seen_at), { addSuffix: true })}`
                : "No pings yet"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Description</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {vehicle.description || "No description."}
          </CardContent>
        </Card>
      </div>

      <SummarySection
        content={activityLog || "No activity yet."}
        title="AI activity summary"
        description="Condense the last 30 GPS pings into a 3–5 sentence digest."
      />

      {profile.role === "admin" && ingestToken && (
        <IngestCredentials vehicleId={vehicle.id} initialToken={ingestToken} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recent activity ({locations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Idle</TableHead>
                <TableHead>Lat / Lng</TableHead>
                <TableHead>Anomaly</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    No activity recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                locations.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{l.speed_kmh.toFixed(1)} km/h</TableCell>
                    <TableCell>{l.idle_seconds}s</TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.lat.toFixed(4)}, {l.lng.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      {l.anomaly ? (
                        <Badge variant="destructive">
                          {l.anomaly_kind || "anomaly"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
