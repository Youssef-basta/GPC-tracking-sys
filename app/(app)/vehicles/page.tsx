import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  idle: "secondary",
  offline: "outline",
  maintenance: "secondary",
};

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase } = await requireProfile();
  const { q } = await searchParams;

  let query = supabase
    .from("vehicles")
    .select("*")
    .is("deleted_at", null)
    .order("label");
  if (q) {
    query = query.or(
      `plate.ilike.%${q}%,label.ilike.%${q}%,model.ilike.%${q}%`,
    );
  }
  const { data } = await query;
  const vehicles = (data ?? []) as Vehicle[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <form className="flex gap-2">
        <Input
          name="q"
          defaultValue={q || ""}
          placeholder="Search by plate, label, or model"
          className="max-w-sm"
        />
      </form>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plate</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No vehicles yet. Run the seed migration to add demo data.
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
                  <TableCell className="text-muted-foreground">
                    {v.model || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[v.status] || "outline"} className="capitalize">
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.last_seen_at
                      ? new Date(v.last_seen_at).toLocaleString()
                      : "—"}
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
