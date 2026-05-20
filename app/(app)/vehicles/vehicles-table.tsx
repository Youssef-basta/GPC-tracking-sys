"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckSquare, Square, Loader2, X, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditVehicleDialog } from "@/components/vehicle-dialog";
import type { Vehicle, VehicleStatus } from "@/lib/types";

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  idle: "secondary",
  offline: "outline",
  maintenance: "secondary",
};

export function VehiclesTable({
  vehicles,
  canBulkEdit,
}: {
  vehicles: Vehicle[];
  canBulkEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<VehicleStatus | "">("");
  const [bulkDriver, setBulkDriver] = useState("");
  const [pending, setPending] = useState(false);

  const allSelected =
    vehicles.length > 0 && selected.size === vehicles.length;
  const partial = selected.size > 0 && !allSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(vehicles.map((v) => v.id)));
  }
  function clearSelection() {
    setSelected(new Set());
    setBulkStatus("");
    setBulkDriver("");
  }

  async function applyBulkUpdate() {
    if (selected.size === 0) return;
    if (!bulkStatus && !bulkDriver) {
      toast.error("Choose a status or driver name to apply");
      return;
    }
    setPending(true);
    const payload: Record<string, unknown> = {};
    if (bulkStatus) payload.status = bulkStatus;
    if (bulkDriver) payload.driver_name = bulkDriver;
    const res = await fetch("/api/admin/vehicles/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [...selected],
        action: "update",
        payload,
      }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    const json = (await res.json()) as { affected: number };
    toast.success(`Updated ${json.affected} vehicle${json.affected === 1 ? "" : "s"}`);
    clearSelection();
    router.refresh();
  }

  async function bulkDelete() {
    if (
      !confirm(
        `Soft-delete ${selected.size} vehicle${selected.size === 1 ? "" : "s"}?`,
      )
    )
      return;
    setPending(true);
    const res = await fetch("/api/admin/vehicles/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action: "delete" }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    const json = (await res.json()) as { affected: number };
    toast.success(`Deleted ${json.affected} vehicle${json.affected === 1 ? "" : "s"}`);
    clearSelection();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Bulk action toolbar */}
      {canBulkEdit && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-400/40 bg-gradient-to-r from-sky-500/10 via-fuchsia-500/5 to-emerald-500/10 p-3 shadow-sm">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="ml-2 flex flex-wrap items-center gap-2">
            <Select
              value={bulkStatus || undefined}
              onValueChange={(v) =>
                v && setBulkStatus(v as VehicleStatus)
              }
            >
              <SelectTrigger className="h-8 w-36 text-sm">
                <SelectValue placeholder="Set status…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-8 w-44 text-sm"
              placeholder="Set driver name…"
              value={bulkDriver}
              onChange={(e) => setBulkDriver(e.target.value)}
            />
            <Button
              size="sm"
              onClick={applyBulkUpdate}
              disabled={pending || (!bulkStatus && !bulkDriver)}
            >
              {pending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Apply
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={bulkDelete}
              disabled={pending}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              disabled={pending}
            >
              <X className="mr-1 size-3.5" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {canBulkEdit && (
                <TableHead className="w-10">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="grid size-5 place-items-center"
                    title={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : partial ? (
                      <Square className="size-4 text-primary opacity-60" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
              )}
              <TableHead>Plate</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last seen</TableHead>
              {canBulkEdit && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canBulkEdit ? 8 : 6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No vehicles yet.
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((v) => {
                const isSelected = selected.has(v.id);
                return (
                  <TableRow
                    key={v.id}
                    className={isSelected ? "bg-primary/5" : undefined}
                  >
                    {canBulkEdit && (
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggle(v.id)}
                          className="grid size-5 place-items-center"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/vehicles/${v.id}`}
                        className="hover:underline"
                      >
                        {v.plate}
                      </Link>
                    </TableCell>
                    <TableCell>{v.label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.driver_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.model || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[v.status] || "outline"}
                        className="capitalize"
                      >
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.last_seen_at
                        ? new Date(v.last_seen_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    {canBulkEdit && (
                      <TableCell className="text-right">
                        <EditVehicleDialog vehicle={v} />
                      </TableCell>
                    )}
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
