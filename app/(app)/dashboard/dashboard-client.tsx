"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { VehiclesSidebar } from "@/components/vehicles-sidebar";
import { RealtimeMapLoader } from "@/components/realtime-map-loader";
import type { Vehicle, Zone, Poi } from "@/lib/types";

/**
 * Dashboard client wrapper — holds shared state between the vehicles
 * sidebar and the map (which vehicle is focused), and subscribes to
 * vehicle realtime updates so the sidebar stays in sync.
 */
export function DashboardClient({
  initialVehicles,
  initialZones,
  initialPois,
  trailPoints,
}: {
  initialVehicles: Vehicle[];
  initialZones: Zone[];
  initialPois: Poi[];
  trailPoints: number;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Mirror the map's realtime subscription so the sidebar updates too
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("vehicles-sidebar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        (payload) => {
          setVehicles((prev) => {
            if (payload.eventType === "INSERT")
              return [...prev, payload.new as Vehicle];
            if (payload.eventType === "UPDATE") {
              const next = payload.new as Vehicle;
              if (next.deleted_at) return prev.filter((v) => v.id !== next.id);
              return prev.map((v) => (v.id === next.id ? next : v));
            }
            if (payload.eventType === "DELETE")
              return prev.filter((v) => v.id !== (payload.old as Vehicle).id);
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <VehiclesSidebar
        vehicles={vehicles}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <div className="min-w-0 flex-1">
        <RealtimeMapLoader
          initialVehicles={vehicles}
          initialZones={initialZones}
          initialPois={initialPois}
          trailPoints={trailPoints}
          focusVehicleId={selectedId}
        />
      </div>
    </div>
  );
}
