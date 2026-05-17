"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Vehicle, VehicleStatus } from "@/lib/types";

const labels: Record<VehicleStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "text-emerald-600" },
  idle: { label: "Idle", color: "text-amber-600" },
  offline: { label: "Offline", color: "text-muted-foreground" },
  maintenance: { label: "Maintenance", color: "text-blue-600" },
};

export function StatusCounts({ vehicles }: { vehicles: Vehicle[] }) {
  const [list, setList] = useState<Vehicle[]>(vehicles);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("status-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        (payload) => {
          setList((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as Vehicle];
            if (payload.eventType === "UPDATE") {
              const next = payload.new as Vehicle;
              if (next.deleted_at) return prev.filter((v) => v.id !== next.id);
              return prev.map((v) => (v.id === next.id ? next : v));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((v) => v.id !== (payload.old as Vehicle).id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const counts = list.reduce(
    (acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    },
    {} as Record<VehicleStatus, number>,
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(Object.keys(labels) as VehicleStatus[]).map((status) => (
        <Card key={status} className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {labels[status].label}
          </div>
          <div className={cn("mt-1 text-2xl font-semibold", labels[status].color)}>
            {counts[status] || 0}
          </div>
        </Card>
      ))}
    </div>
  );
}
