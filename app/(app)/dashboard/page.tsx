import { requireProfile } from "@/lib/auth";
import { RealtimeMapLoader } from "@/components/realtime-map-loader";
import { RealtimeStatus } from "@/components/realtime-status";
import { StatusCounts } from "@/components/status-counts";
import { SimulateButton } from "@/components/simulate-button";
import { PageTitle } from "@/components/page-title";
import type { Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, supabase } = await requireProfile();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .is("deleted_at", null)
    .order("label");

  const list = (vehicles ?? []) as Vehicle[];

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

      <RealtimeMapLoader initialVehicles={list} />
    </div>
  );
}
