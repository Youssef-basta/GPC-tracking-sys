import { requireAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignupsChart } from "@/components/charts/signups-chart";
import { RefreshCw } from "lucide-react";
import type { FleetMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes

export default async function AdminAnalyticsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: metrics }, { data: signups }] = await Promise.all([
    supabase.rpc("fleet_metrics").single<FleetMetrics>(),
    supabase.rpc("signups_by_day", { days: 7 }),
  ]);

  const m = metrics || {
    total_users: 0,
    new_signups_7d: 0,
    active_users_30d: 0,
    total_vehicles: 0,
    active_vehicles: 0,
    anomalies_24h: 0,
    open_reports: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Data refreshes every 5 minutes. Click refresh to force-update.
          </p>
        </div>
        <form>
          <Button type="submit" variant="outline" size="sm">
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total users" value={m.total_users} />
        <Metric label="New signups (7d)" value={m.new_signups_7d} />
        <Metric label="Active users (30d)" value={m.active_users_30d} />
        <Metric label="Total vehicles" value={m.total_vehicles} />
        <Metric label="Active vehicles" value={m.active_vehicles} />
        <Metric label="Anomalies (24h)" value={m.anomalies_24h} accent="amber" />
        <Metric label="Open reports" value={m.open_reports} accent="red" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Signups — last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          <SignupsChart data={(signups as { day: string; count: number }[]) || []} />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber" | "red";
}) {
  const cls =
    accent === "amber"
      ? "text-amber-600"
      : accent === "red"
        ? "text-red-600"
        : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>{value}</div>
    </Card>
  );
}
