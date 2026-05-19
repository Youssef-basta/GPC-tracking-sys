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
  Circle,
  Polygon,
  Rectangle,
} from "react-leaflet";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle, Zone } from "@/lib/types";
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

function ZonePopup({ zone }: { zone: Zone }) {
  return (
    <div className="space-y-0.5 text-sm">
      <div className="font-semibold">
        {zone.name}
        {zone.is_prohibited && (
          <span className="ml-1 rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-700">
            Prohibited
          </span>
        )}
      </div>
      <div className="text-xs capitalize text-muted-foreground">
        {zone.kind} · alerts on {zone.alert_on}
      </div>
      {zone.description && (
        <div className="text-xs text-muted-foreground">{zone.description}</div>
      )}
    </div>
  );
}

export function RealtimeMap({
  initialVehicles,
  initialZones = [],
  height = 520,
}: {
  initialVehicles: Vehicle[];
  initialZones?: Zone[];
  height?: number;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [zones, setZones] = useState<Zone[]>(initialZones);

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

  // Realtime updates for zones — small in number, refetch on any change
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("zones-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zones" },
        async () => {
          const { data } = await supabase
            .from("zones")
            .select("*")
            .is("deleted_at", null);
          if (data) setZones(data as Zone[]);
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
    <div className="overflow-hidden rounded-lg border" style={{ height }}>
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

        {/* Zone overlays — render UNDER markers */}
        {zones.map((z) => {
          const s = z.shape as Record<string, unknown>;
          const color = z.is_prohibited ? "#dc2626" : "#0ea5e9";
          const opts = {
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: z.is_prohibited ? 0.18 : 0.1,
          };
          if (z.kind === "circle") {
            return (
              <Circle
                key={z.id}
                center={[s.lat as number, s.lng as number]}
                radius={s.radius_m as number}
                pathOptions={opts}
              >
                <Popup>
                  <ZonePopup zone={z} />
                </Popup>
              </Circle>
            );
          }
          if (z.kind === "rectangle") {
            return (
              <Rectangle
                key={z.id}
                bounds={[
                  [s.south as number, s.west as number],
                  [s.north as number, s.east as number],
                ]}
                pathOptions={opts}
              >
                <Popup>
                  <ZonePopup zone={z} />
                </Popup>
              </Rectangle>
            );
          }
          if (z.kind === "polygon") {
            const positions = (s.points as [number, number][]) || [];
            return (
              <Polygon key={z.id} positions={positions} pathOptions={opts}>
                <Popup>
                  <ZonePopup zone={z} />
                </Popup>
              </Polygon>
            );
          }
          return null;
        })}

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
                  {v.driver_name && (
                    <div className="text-xs">
                      Driver: <span className="font-medium">{v.driver_name}</span>
                    </div>
                  )}
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
