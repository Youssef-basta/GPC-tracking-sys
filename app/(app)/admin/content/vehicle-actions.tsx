"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Vehicle } from "@/lib/types";

export function VehicleActions({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function softDelete() {
    if (!confirm(`Soft-delete ${vehicle.label} (${vehicle.plate})?`)) return;
    setPending(true);
    const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
      method: "DELETE",
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Vehicle soft-deleted");
    router.refresh();
  }

  async function restore() {
    setPending(true);
    const res = await fetch(`/api/admin/vehicles/${vehicle.id}/restore`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to restore");
      return;
    }
    toast.success("Vehicle restored");
    router.refresh();
  }

  if (vehicle.deleted_at) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={restore}>
        Restore
      </Button>
    );
  }

  return (
    <Button size="sm" variant="destructive" disabled={pending} onClick={softDelete}>
      Delete
    </Button>
  );
}
