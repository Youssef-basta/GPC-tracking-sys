"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const MiniMapPicker = dynamic(
  () => import("./mini-map-picker").then((m) => m.MiniMapPicker),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] w-full rounded-md" />,
  },
);

export function MiniMapPickerLoader(props: {
  lat: number;
  lng: number;
  color?: string;
  height?: number;
  zoom?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  return <MiniMapPicker {...props} />;
}
