import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
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
import { PageTitle } from "@/components/page-title";
import { Download, FileBarChart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ReportType = "activity" | "speed" | "idle" | "anomalies" | "audit";
const VALID: ReportType[] = ["activity", "speed", "idle", "anomalies", "audit"];

const REPORTS: { id: ReportType; label: string; desc: string }[] = [
  {
    id: "activity",
    label: "Activity summary",
    desc: "Per-vehicle distance, idle, speed, anomaly count in the period.",
  },
  {
    id: "speed",
    label: "Speed violations",
    desc: "Every ping that exceeded the speed threshold.",
  },
  {
    id: "idle",
    label: "Idle events",
    desc: "Pings where the vehicle sat idle longer than the threshold.",
  },
  {
    id: "anomalies",
    label: "Anomalies",
    desc: "Long-idle and route-jump events, grouped by vehicle.",
  },
  {
    id: "audit",
    label: "Audit trail",
    desc: "Every admin mutation: who, what, when.",
  },
];

const PRESETS = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    days?: string;
    threshold?: string;
    min_idle?: string;
  }>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  const type = (
    VALID.includes(sp.type as ReportType) ? sp.type : "activity"
  ) as ReportType;
  const days = Math.max(1, Math.min(365, Number(sp.days) || 7));
  const threshold = Math.max(20, Math.min(300, Number(sp.threshold) || 80));
  const minIdle = Math.max(60, Math.min(7200, Number(sp.min_idle) || 300));

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const buildHref = (
    overrides: Partial<{
      type: ReportType;
      days: number;
      threshold: number;
      min_idle: number;
    }>,
  ) => {
    const next = new URLSearchParams({
      type: overrides.type ?? type,
      days: String(overrides.days ?? days),
      ...(type === "speed" || overrides.type === "speed"
        ? { threshold: String(overrides.threshold ?? threshold) }
        : {}),
      ...(type === "idle" || overrides.type === "idle"
        ? { min_idle: String(overrides.min_idle ?? minIdle) }
        : {}),
    });
    return `/admin/reports?${next.toString()}`;
  };

  const exportHref = `/api/export/report-${type}?days=${days}&threshold=${threshold}&min_idle=${minIdle}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle>Reports</PageTitle>
          <p className="text-sm text-muted-foreground">
            Fleet operations reports — based on the last {days} day
            {days === 1 ? "" : "s"} of pings.
          </p>
        </div>
        <a href={exportHref}>
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 size-3.5" />
            Export CSV
          </Button>
        </a>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {REPORTS.map((r) => (
          <Link
            key={r.id}
            href={buildHref({ type: r.id })}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              type === r.id
                ? "border-transparent bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 text-white shadow-sm"
                : "border-border bg-card hover:bg-accent/60",
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Range
            </span>
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <Link
                  key={p.days}
                  href={buildHref({ days: p.days })}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs",
                    days === p.days
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent/60",
                  )}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>

          {type === "speed" && (
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Speed &gt;
              </span>
              <div className="flex gap-1">
                {[60, 80, 100, 120].map((t) => (
                  <Link
                    key={t}
                    href={buildHref({ threshold: t })}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs",
                      threshold === t
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "border-border hover:bg-accent/60",
                    )}
                  >
                    {t} km/h
                  </Link>
                ))}
              </div>
            </div>
          )}

          {type === "idle" && (
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Idle ≥
              </span>
              <div className="flex gap-1">
                {[300, 600, 1800, 3600].map((t) => (
                  <Link
                    key={t}
                    href={buildHref({ min_idle: t })}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs",
                      minIdle === t
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "border-border hover:bg-accent/60",
                    )}
                  >
                    {formatSeconds(t)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {from.toLocaleDateString()} → {to.toLocaleDateString()}
          </div>
        </CardContent>
      </Card>

      {/* Report body */}
      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileBarChart className="size-4 text-primary" />
            {REPORTS.find((r) => r.id === type)?.label}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {REPORTS.find((r) => r.id === type)?.desc}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {type === "activity" && (
            <ActivityReport supabase={supabase} from={from} to={to} />
          )}
          {type === "speed" && (
            <SpeedReport
              supabase={supabase}
              from={from}
              to={to}
              threshold={threshold}
            />
          )}
          {type === "idle" && (
            <IdleReport
              supabase={supabase}
              from={from}
              to={to}
              minIdle={minIdle}
            />
          )}
          {type === "anomalies" && (
            <AnomaliesReport supabase={supabase} from={from} to={to} />
          )}
          {type === "audit" && (
            <AuditReport supabase={supabase} from={from} to={to} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Individual report components (server-rendered)
// =============================================================================

type SupabaseClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

interface ActivityRow {
  vehicle_id: string;
  plate: string;
  label: string;
  ping_count: number;
  distance_km: number;
  max_speed_kmh: number;
  avg_moving_kmh: number;
  total_idle_seconds: number;
  anomaly_count: number;
  last_seen: string | null;
}

async function ActivityReport({
  supabase,
  from,
  to,
}: {
  supabase: SupabaseClient;
  from: Date;
  to: Date;
}) {
  const { data, error } = await supabase.rpc("report_vehicle_activity", {
    date_from: from.toISOString(),
    date_to: to.toISOString(),
  });
  if (error) return <ErrorState message={error.message} />;
  const rows = (data ?? []) as ActivityRow[];
  if (rows.length === 0) return <EmptyState label="No vehicles in range." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vehicle</TableHead>
          <TableHead className="text-right">Pings</TableHead>
          <TableHead className="text-right">Distance</TableHead>
          <TableHead className="text-right">Max speed</TableHead>
          <TableHead className="text-right">Avg moving</TableHead>
          <TableHead className="text-right">Idle</TableHead>
          <TableHead className="text-right">Anomalies</TableHead>
          <TableHead>Last seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.vehicle_id}>
            <TableCell>
              <Link
                href={`/vehicles/${r.vehicle_id}`}
                className="font-medium hover:underline"
              >
                {r.label}
              </Link>
              <div className="font-mono text-xs text-muted-foreground">
                {r.plate}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.ping_count}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {Number(r.distance_km).toFixed(1)} km
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {Number(r.max_speed_kmh).toFixed(0)} km/h
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {Number(r.avg_moving_kmh).toFixed(0)} km/h
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatSeconds(r.total_idle_seconds)}
            </TableCell>
            <TableCell className="text-right">
              {r.anomaly_count > 0 ? (
                <Badge variant="destructive">{r.anomaly_count}</Badge>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {r.last_seen
                ? formatDistanceToNow(new Date(r.last_seen), { addSuffix: true })
                : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface SpeedRow {
  vehicle_id: string;
  plate: string;
  label: string;
  speed_kmh: number;
  lat: number;
  lng: number;
  created_at: string;
}

async function SpeedReport({
  supabase,
  from,
  to,
  threshold,
}: {
  supabase: SupabaseClient;
  from: Date;
  to: Date;
  threshold: number;
}) {
  const { data, error } = await supabase.rpc("report_speed_violations", {
    date_from: from.toISOString(),
    date_to: to.toISOString(),
    threshold_kmh: threshold,
    max_rows: 500,
  });
  if (error) return <ErrorState message={error.message} />;
  const rows = (data ?? []) as SpeedRow[];
  if (rows.length === 0) {
    return <EmptyState label={`No speed events over ${threshold} km/h.`} />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Vehicle</TableHead>
          <TableHead className="text-right">Speed</TableHead>
          <TableHead>Location</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </TableCell>
            <TableCell>
              <Link
                href={`/vehicles/${r.vehicle_id}`}
                className="font-medium hover:underline"
              >
                {r.label}
              </Link>{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {r.plate}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant="destructive" className="tabular-nums">
                {Number(r.speed_kmh).toFixed(0)} km/h
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface IdleRow {
  vehicle_id: string;
  plate: string;
  label: string;
  idle_seconds: number;
  lat: number;
  lng: number;
  created_at: string;
}

async function IdleReport({
  supabase,
  from,
  to,
  minIdle,
}: {
  supabase: SupabaseClient;
  from: Date;
  to: Date;
  minIdle: number;
}) {
  const { data, error } = await supabase.rpc("report_idle_events", {
    date_from: from.toISOString(),
    date_to: to.toISOString(),
    min_idle_seconds: minIdle,
    max_rows: 500,
  });
  if (error) return <ErrorState message={error.message} />;
  const rows = (data ?? []) as IdleRow[];
  if (rows.length === 0) {
    return (
      <EmptyState label={`No idle events ≥ ${formatSeconds(minIdle)}.`} />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Vehicle</TableHead>
          <TableHead className="text-right">Idle</TableHead>
          <TableHead>Location</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </TableCell>
            <TableCell>
              <Link
                href={`/vehicles/${r.vehicle_id}`}
                className="font-medium hover:underline"
              >
                {r.label}
              </Link>{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {r.plate}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <Badge
                variant="secondary"
                className="bg-amber-500/15 text-amber-700 tabular-nums dark:text-amber-400"
              >
                {formatSeconds(r.idle_seconds)}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface AnomalyRow {
  vehicle_id: string;
  plate: string;
  label: string;
  anomaly_kind: string;
  occurrences: number;
  last_occurrence: string;
}

async function AnomaliesReport({
  supabase,
  from,
  to,
}: {
  supabase: SupabaseClient;
  from: Date;
  to: Date;
}) {
  const { data, error } = await supabase.rpc("report_anomalies", {
    date_from: from.toISOString(),
    date_to: to.toISOString(),
  });
  if (error) return <ErrorState message={error.message} />;
  const rows = (data ?? []) as AnomalyRow[];
  if (rows.length === 0)
    return <EmptyState label="No anomalies in this window." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vehicle</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead className="text-right">Occurrences</TableHead>
          <TableHead>Last</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>
              <Link
                href={`/vehicles/${r.vehicle_id}`}
                className="font-medium hover:underline"
              >
                {r.label}
              </Link>{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {r.plate}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="destructive" className="capitalize">
                {r.anomaly_kind.replace("_", " ")}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.occurrences}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(r.last_occurrence), {
                addSuffix: true,
              })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

async function AuditReport({
  supabase,
  from,
  to,
}: {
  supabase: SupabaseClient;
  from: Date;
  to: Date;
}) {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, target_type, target_id, meta, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return <ErrorState message={error.message} />;
  const rows = (data ?? []) as AuditRow[];
  if (rows.length === 0) return <EmptyState label="No audit entries." />;

  // Pull actor names in one batch
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]),
  );
  const { data: profiles } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", actorIds)
    : { data: [] };
  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p.full_name as string | null) || (p.email as string),
    ]),
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </TableCell>
            <TableCell className="text-sm">
              {r.actor_id ? byId.get(r.actor_id) || "—" : "—"}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="font-mono text-xs">
                {r.action}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {r.target_type ? `${r.target_type}:` : ""}
              {r.target_id ? r.target_id.slice(0, 8) + "…" : ""}
            </TableCell>
            <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
              {Object.keys(r.meta || {}).length
                ? JSON.stringify(r.meta)
                : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="text-sm text-destructive">Report failed to load.</div>
      <div className="mt-1 font-mono text-xs text-muted-foreground">
        {message}
      </div>
    </div>
  );
}
