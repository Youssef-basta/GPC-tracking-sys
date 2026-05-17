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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { VehicleActions } from "./vehicle-actions";
import { ReportActions } from "./report-actions";
import type { ContentReport, Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const { supabase } = await requireAdmin();

  const [{ data: allVehicles }, { data: reports }] = await Promise.all([
    supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
    supabase
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const vehicles = (allVehicles ?? []) as Vehicle[];
  const reportRows = (reports ?? []) as ContentReport[];
  const openReports = reportRows.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Content moderation</h1>
          <p className="text-sm text-muted-foreground">
            {openReports} open report{openReports === 1 ? "" : "s"} · {vehicles.length} vehicles total
          </p>
        </div>
      </div>

      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="reports">
            Reports
            {openReports > 0 && (
              <Badge variant="destructive" className="ml-2">
                {openReports}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plate</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No vehicles.
                    </TableCell>
                  </TableRow>
                ) : (
                  vehicles.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/vehicles/${v.id}`} className="hover:underline">
                          {v.plate}
                        </Link>
                      </TableCell>
                      <TableCell>{v.label}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {v.deleted_at ? (
                          <Badge variant="destructive">Deleted</Badge>
                        ) : (
                          <Badge variant="outline">Live</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <VehicleActions vehicle={v} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No reports.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.vehicle_id ? (
                            <Link href={`/vehicles/${r.vehicle_id}`} className="hover:underline">
                              {r.vehicle_id.slice(0, 8)}…
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-md truncate">{r.reason}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === "open"
                                ? "destructive"
                                : r.status === "resolved"
                                  ? "default"
                                  : "secondary"
                            }
                            className="capitalize"
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <ReportActions report={r} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
