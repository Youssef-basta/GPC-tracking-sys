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
import { ZoneActions } from "./zone-actions";
import { Plus } from "lucide-react";
import type { Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("zones")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const zones = (data ?? []) as Zone[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle>Geofence zones</PageTitle>
          <p className="text-sm text-muted-foreground">
            {zones.length} active zone{zones.length === 1 ? "" : "s"}. Vehicles
            entering or exiting will fire notifications.
          </p>
        </div>
        <Link href="/admin/zones/new">
          <Button
            size="sm"
            className="bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 text-white shadow-md shadow-fuchsia-500/30 hover:opacity-90"
          >
            <Plus className="mr-1 size-4" />
            New zone
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Alert on</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No zones yet.{" "}
                  <Link
                    href="/admin/zones/new"
                    className="text-primary hover:underline"
                  >
                    Create your first zone
                  </Link>
                  .
                </TableCell>
              </TableRow>
            ) : (
              zones.map((z) => (
                <TableRow key={z.id}>
                  <TableCell>
                    <Link
                      href={`/admin/zones/${z.id}`}
                      className="font-medium hover:underline"
                    >
                      {z.name}
                    </Link>
                    {z.description && (
                      <div className="text-xs text-muted-foreground">
                        {z.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {z.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{z.alert_on}</TableCell>
                  <TableCell>
                    {z.is_prohibited ? (
                      <Badge variant="destructive">Prohibited</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(z.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <ZoneActions zone={z} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
