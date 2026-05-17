"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

// Fix default marker icons in webpack/turbopack builds
const iconHtml = (color: string) =>
  `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.25)"></div>`;

const statusColor: Record<string, string> = {
  active: "#16a34a",
  idle: "#f59e0b",
  offline: "#6b7280",
  maintenance: "#3b82f6",
};

function buildIcon(status: string) {
  return L.divIcon({
    html: iconHtml(statusColor[status] || "#6b7280"),
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function FitBoundsOnce({ vehicles }: { vehicles: Vehicle[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const points = vehicles
      .filter((v) => v.last_lat != null && v.last_lng != null)
      .map((v) => [v.last_lat!, v.last_lng!] as [number, number]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
    fitted.current = true;
  }, [vehicles, map]);
  return null;
}

export function RealtimeMap({
  initialVehicles,
  height = 520,
}: {
  initialVehicles: Vehicle[];
  height?: number;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("vehicles-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        (payload) => {
          setVehicles((prev) => {
            if (payload.eventType === "INSERT") {
              return [...prev, payload.new as Vehicle];
            }
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
      supabase.removeChannel(channel);
    };
  }, []);

  const center = useMemo<[number, number]>(() => {
    const withCoords = vehicles.find(
      (v) => v.last_lat != null && v.last_lng != null,
    );
    return withCoords
      ? [withCoords.last_lat!, withCoords.last_lng!]
      : [24.7136, 46.6753]; // Riyadh default
  }, [vehicles]);

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBoundsOnce vehicles={vehicles} />
        {vehicles
          .filter((v) => v.last_lat != null && v.last_lng != null)
          .map((v) => (
            <Marker
              key={v.id}
              position={[v.last_lat!, v.last_lng!]}
              icon={buildIcon(v.status)}
            >
              <Popup>
                <div className="space-y-0.5 text-sm">
                  <div className="font-semibold">
                    {v.label}{" "}
                    <span className="text-muted-foreground">({v.plate})</span>
                  </div>
                  <div className="text-xs capitalize">Status: {v.status}</div>
                  {v.last_seen_at && (
                    <div className="text-xs text-muted-foreground">
                      Last ping{" "}
                      {formatDistanceToNow(new Date(v.last_seen_at), {
                        addSuffix: true,
                      })}
                    </div>
                  )}
                  <a
                    className="text-xs text-blue-600 hover:underline"
                    href={`/vehicles/${v.id}`}
                  >
                    Open vehicle
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
