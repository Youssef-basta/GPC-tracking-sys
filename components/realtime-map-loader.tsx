"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { Vehicle, Zone, Poi } from "@/lib/types";

const RealtimeMap = dynamic(
  () => import("./realtime-map").then((m) => m.RealtimeMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[520px] w-full rounded-lg" />,
  },
);

export function RealtimeMapLoader({
  initialVehicles,
  initialZones,
  initialPois,
  trailPoints,
  height,
}: {
  initialVehicles: Vehicle[];
  initialZones?: Zone[];
  initialPois?: Poi[];
  trailPoints?: number;
  height?: number;
}) {
  return (
    <RealtimeMap
      initialVehicles={initialVehicles}
      initialZones={initialZones}
      initialPois={initialPois}
      trailPoints={trailPoints}
      height={height}
    />
  );
}
