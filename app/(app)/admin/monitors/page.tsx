import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageTitle } from "@/components/page-title";
import { MonitorActions } from "./monitor-actions";
import { describeCondition, type MonitorCondition } from "@/lib/monitors";
import { Plus } from "lucide-react";
import type { Monitor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MonitorsPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("monitors")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const monitors = (data ?? []) as Monitor[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle>Monitors</PageTitle>
          <p className="text-sm text-muted-foreground">
            {monitors.length} monitor{monitors.length === 1 ? "" : "s"}.
            Custom rules — all conditions must match for a monitor to fire.
          </p>
        </div>
        <Link href="/admin/monitors/new">
          <Button
            size="sm"
            className="bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 text-white shadow-md shadow-fuchsia-500/30 hover:opacity-90"
          >
            <Plus className="mr-1 size-4" />
            New monitor
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead>Targets</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monitors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No monitors yet.{" "}
                  <Link
                    href="/admin/monitors/new"
                    className="text-primary hover:underline"
                  >
                    Create your first
                  </Link>
                  .
                </TableCell>
              </TableRow>
            ) : (
              monitors.map((m) => {
                const conds = (m.conditions as MonitorCondition[]) || [];
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        href={`/admin/monitors/${m.id}`}
                        className="font-medium hover:underline"
                      >
                        {m.name}
                      </Link>
                      {m.description && (
                        <div className="text-xs text-muted-foreground">
                          {m.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {conds.length === 0
                        ? "—"
                        : conds.map((c, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="mr-1 mb-1 font-mono"
                            >
                              {describeCondition(c)}
                            </Badge>
                          ))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {!m.vehicle_ids || m.vehicle_ids.length === 0
                        ? "All vehicles"
                        : `${m.vehicle_ids.length} vehicle${m.vehicle_ids.length === 1 ? "" : "s"}`}
                    </TableCell>
                    <TableCell>
                      {m.is_active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <MonitorActions monitor={m} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
