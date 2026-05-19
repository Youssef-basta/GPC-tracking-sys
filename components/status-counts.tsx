"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, Power, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Vehicle, VehicleStatus } from "@/lib/types";

const labels: Record<
  VehicleStatus,
  {
    label: string;
    text: string;
    tint: string;
    ring: string;
    icon: React.ReactNode;
  }
> = {
  active: {
    label: "Active",
    text: "text-emerald-600 dark:text-emerald-400",
    tint: "from-emerald-500/15 to-emerald-500/0",
    ring: "ring-emerald-500/30",
    icon: <Activity className="size-4" />,
  },
  idle: {
    label: "Idle",
    text: "text-amber-600 dark:text-amber-400",
    tint: "from-amber-500/15 to-amber-500/0",
    ring: "ring-amber-500/30",
    icon: <Clock className="size-4" />,
  },
  offline: {
    label: "Offline",
    text: "text-slate-500 dark:text-slate-400",
    tint: "from-slate-500/15 to-slate-500/0",
    ring: "ring-slate-500/20",
    icon: <Power className="size-4" />,
  },
  maintenance: {
    label: "Maintenance",
    text: "text-sky-600 dark:text-sky-400",
    tint: "from-sky-500/15 to-sky-500/0",
    ring: "ring-sky-500/30",
    icon: <Wrench className="size-4" />,
  },
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
      {(Object.keys(labels) as VehicleStatus[]).map((status) => {
        const meta = labels[status];
        const count = counts[status] || 0;
        return (
          <Card
            key={status}
            className={cn(
              "relative overflow-hidden p-4 ring-1 transition-all hover:-translate-y-0.5",
              meta.ring,
            )}
          >
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 bg-gradient-to-br",
                meta.tint,
              )}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </div>
                <div className={cn("mt-1 text-3xl font-bold tabular-nums", meta.text)}>
                  {count}
                </div>
              </div>
              <div className={cn("rounded-md bg-background/60 p-1.5", meta.text)}>
                {meta.icon}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
