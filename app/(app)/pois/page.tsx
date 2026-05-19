import { requireProfile } from "@/lib/auth";
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
import { PoiDialog } from "@/components/poi-dialog";
import { PoiActions } from "@/components/poi-actions";
import { categoryMeta } from "@/lib/poi";
import type { Poi } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PoisPage() {
  const { profile, supabase } = await requireProfile();

  const { data } = await supabase
    .from("pois")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const pois = (data ?? []) as Poi[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle>Points of Interest</PageTitle>
          <p className="text-sm text-muted-foreground">
            {pois.length} POI{pois.length === 1 ? "" : "s"}. Mark depots,
            customer sites, fuel stations, and other locations on the map.
          </p>
        </div>
        <PoiDialog mode="create" />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Coordinates</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pois.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No points of interest yet. Click <strong>Add POI</strong> to
                  create your first.
                </TableCell>
              </TableRow>
            ) : (
              pois.map((p) => {
                const meta = categoryMeta(p.category);
                const isOwner = p.created_by === profile.id;
                const canEdit = isOwner || profile.role === "admin";
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full ring-2 ring-white shadow-sm"
                          style={{ background: p.icon_color }}
                        />
                        <span>
                          {meta.emoji} <strong>{p.name}</strong>
                        </span>
                      </div>
                      {p.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.is_public ? (
                        <Badge variant="outline">Public</Badge>
                      ) : (
                        <Badge variant="secondary">Private</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit ? (
                        <div className="flex justify-end gap-2">
                          <PoiDialog mode="edit" poi={p} />
                          <PoiActions poi={p} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
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
