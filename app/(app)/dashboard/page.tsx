import { requireProfile } from "@/lib/auth";
import { RealtimeMapLoader } from "@/components/realtime-map-loader";
import { RealtimeStatus } from "@/components/realtime-status";
import { StatusCounts } from "@/components/status-counts";
import { SimulateButton } from "@/components/simulate-button";
import { PageTitle } from "@/components/page-title";
import type { Vehicle, Zone, Poi } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, supabase } = await requireProfile();

  const [{ data: vehicles }, { data: zones }, { data: pois }, { data: settings }] =
    await Promise.all([
      supabase.from("vehicles").select("*").is("deleted_at", null).order("label"),
      supabase.from("zones").select("*").is("deleted_at", null).order("name"),
      supabase.from("pois").select("*").is("deleted_at", null).order("name"),
      supabase
        .from("user_settings")
        .select("trail_points")
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);

  const list = (vehicles ?? []) as Vehicle[];
  const zoneList = (zones ?? []) as Zone[];
  const poiList = (pois ?? []) as Poi[];
  const trailPoints = (settings?.trail_points as number | undefined) ?? 30;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle>Live fleet</PageTitle>
          <p className="text-sm text-muted-foreground">
            Realtime positions stream in as vehicles report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RealtimeStatus />
          {profile.role === "admin" && <SimulateButton />}
        </div>
      </div>

      <StatusCounts vehicles={list} />

      <RealtimeMapLoader
        initialVehicles={list}
        initialZones={zoneList}
        initialPois={poiList}
        trailPoints={trailPoints}
      />
    </div>
  );
}
