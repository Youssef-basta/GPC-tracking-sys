import { requireAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignupsChart } from "@/components/charts/signups-chart";
import { PageTitle } from "@/components/page-title";
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
          <PageTitle>Analytics</PageTitle>
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
        <Metric label="Total users" value={m.total_users} accent="sky" />
        <Metric label="New signups (7d)" value={m.new_signups_7d} accent="emerald" />
        <Metric label="Active users (30d)" value={m.active_users_30d} accent="cyan" />
        <Metric label="Total vehicles" value={m.total_vehicles} accent="violet" />
        <Metric label="Active vehicles" value={m.active_vehicles} accent="emerald" />
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

type Accent = "sky" | "emerald" | "cyan" | "violet" | "amber" | "red";

const ACCENT: Record<Accent, { text: string; ring: string; tint: string }> = {
  sky: {
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/30",
    tint: "from-sky-500/15 to-sky-500/0",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
    tint: "from-emerald-500/15 to-emerald-500/0",
  },
  cyan: {
    text: "text-cyan-600 dark:text-cyan-400",
    ring: "ring-cyan-500/30",
    tint: "from-cyan-500/15 to-cyan-500/0",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/30",
    tint: "from-violet-500/15 to-violet-500/0",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
    tint: "from-amber-500/20 to-amber-500/0",
  },
  red: {
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/30",
    tint: "from-red-500/20 to-red-500/0",
  },
};

function Metric({
  label,
  value,
  accent = "sky",
}: {
  label: string;
  value: number;
  accent?: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <Card className={`relative overflow-hidden p-4 ring-1 ${a.ring} transition-all hover:-translate-y-0.5`}>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.tint}`}
      />
      <div className="relative">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={`mt-1 text-3xl font-bold tabular-nums ${a.text}`}>
          {value}
        </div>
      </div>
    </Card>
  );
}
