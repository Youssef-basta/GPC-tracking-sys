"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Clock,
  Power,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Truck,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { Vehicle, VehicleStatus } from "@/lib/types";

const STATUS_META: Record<
  VehicleStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; dot: string }
> = {
  active: { label: "Active", icon: Activity, dot: "bg-emerald-500" },
  idle: { label: "Idle", icon: Clock, dot: "bg-amber-500" },
  offline: { label: "Offline", icon: Power, dot: "bg-slate-400" },
  maintenance: { label: "Maintenance", icon: Wrench, dot: "bg-sky-500" },
};

const ORDER: VehicleStatus[] = ["active", "idle", "maintenance", "offline"];

export function VehiclesSidebar({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<VehicleStatus, boolean>>({
    active: true,
    idle: true,
    offline: false,
    maintenance: true,
  });

  // Group + filter
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = vehicles.filter((v) => {
      if (!q) return true;
      return (
        v.label.toLowerCase().includes(q) ||
        v.plate.toLowerCase().includes(q) ||
        (v.driver_name?.toLowerCase().includes(q) ?? false)
      );
    });
    const out: Record<VehicleStatus, Vehicle[]> = {
      active: [],
      idle: [],
      offline: [],
      maintenance: [],
    };
    for (const v of filtered) out[v.status].push(v);
    for (const s of ORDER) out[s].sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [vehicles, query]);

  if (collapsed) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-2 rounded-lg border bg-card p-2">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="grid size-8 place-items-center rounded-md hover:bg-accent/60"
          title="Show vehicles list"
        >
          <ChevronRight className="size-4" />
        </button>
        <Truck className="size-4 text-muted-foreground" />
        <div className="text-xs font-medium tabular-nums">
          {vehicles.length}
        </div>
      </div>
    );
  }

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-lg border bg-card md:w-72">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-primary" />
          <span className="text-sm font-medium">Vehicles</span>
          <span className="text-xs text-muted-foreground">
            {vehicles.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="grid size-7 place-items-center rounded-md hover:bg-accent/60"
          title="Collapse"
        >
          <ChevronLeft className="size-3.5" />
        </button>
      </div>

      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search label / plate / driver"
          className="h-8 pl-8 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent/60"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="max-h-[600px] flex-1 space-y-1 overflow-y-auto p-2 md:max-h-none">
        {ORDER.map((status) => {
          const list = groups[status];
          if (list.length === 0 && query) return null; // hide empty groups while searching
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          const open = openGroups[status];
          return (
            <div key={status} className="space-y-0.5">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [status]: !prev[status] }))
                }
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground hover:bg-accent/40"
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="size-3.5" />
                  {meta.label}
                </span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                  {list.length}
                </span>
              </button>
              {open && (
                <ul className="space-y-0.5">
                  {list.length === 0 ? (
                    <li className="px-3 py-1.5 text-xs text-muted-foreground">
                      None
                    </li>
                  ) : (
                    list.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onSelect(selectedId === v.id ? null : v.id)
                          }
                          className={cn(
                            "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            selectedId === v.id
                              ? "bg-gradient-to-r from-sky-500/15 via-fuchsia-500/10 to-emerald-500/15 ring-1 ring-primary/30"
                              : "hover:bg-accent/60",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-1.5 size-2 shrink-0 rounded-full",
                              meta.dot,
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {v.label}
                            </span>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">
                              {v.plate}
                              {v.driver_name && ` · ${v.driver_name}`}
                            </span>
                            {v.last_seen_at && (
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(v.last_seen_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          );
        })}
        {vehicles.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No vehicles. Use{" "}
            <a href="/vehicles" className="text-primary hover:underline">
              Vehicles
            </a>{" "}
            to add some.
          </div>
        )}
      </div>
    </aside>
  );
}
