"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L, { LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
  Circle,
  Polygon,
  Polyline,
  Rectangle,
  CircleMarker,
} from "react-leaflet";
import {
  Ruler,
  Hexagon,
  Crosshair,
  X,
  Eye,
  EyeOff,
  Layers,
  Route,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haversineMeters } from "@/lib/geofencing";
import { categoryMeta } from "@/lib/poi";
import { formatDistanceToNow } from "date-fns";
import type { Vehicle, Zone, Poi } from "@/lib/types";

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

function buildPoiIcon(color: string, emoji: string) {
  const html = `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);transform:rotate(-45deg);"><span style="transform:rotate(45deg);font-size:14px;line-height:1;">${emoji}</span></div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
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
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(points, { padding: [40, 40] });
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

// =============================================================================
// Map tools
// =============================================================================

type MapTool = "none" | "distance" | "area" | "closest";

function totalDistanceKm(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]) / 1000;
  }
  return total;
}

// Shoelace area in km² using equirectangular approx (good enough for fleet zones)
function polygonAreaKm2(points: [number, number][]): number {
  if (points.length < 3) return 0;
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  // project to equirectangular tangent at first point
  const refLat = toRad(points[0][0]);
  const proj = points.map(([lat, lng]) => [
    R * toRad(lng) * Math.cos(refLat),
    R * toRad(lat),
  ]);
  let area = 0;
  for (let i = 0; i < proj.length; i++) {
    const [x1, y1] = proj[i];
    const [x2, y2] = proj[(i + 1) % proj.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function MapClickHandler({
  tool,
  onClick,
  onDoubleClick,
}: {
  tool: MapTool;
  onClick: (e: LeafletMouseEvent) => void;
  onDoubleClick: () => void;
}) {
  useMapEvents({
    click: (e) => {
      if (tool === "none") return;
      onClick(e);
    },
    dblclick: (e) => {
      if (tool === "none") return;
      e.originalEvent.preventDefault();
      onDoubleClick();
    },
  });
  return null;
}

// =============================================================================
// Main map component
// =============================================================================

export function RealtimeMap({
  initialVehicles,
  initialZones = [],
  initialPois = [],
  trailPoints = 30,
  height = 520,
}: {
  initialVehicles: Vehicle[];
  initialZones?: Zone[];
  initialPois?: Poi[];
  trailPoints?: number;
  height?: number;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [pois, setPois] = useState<Poi[]>(initialPois);

  // Layer visibility
  const [layers, setLayers] = useState({
    vehicles: true,
    zones: true,
    pois: true,
    trails: true,
  });
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);

  // Trail state: which vehicle IDs have trails on, and their fetched points
  const [trailedIds, setTrailedIds] = useState<Set<string>>(new Set());
  const [trailPaths, setTrailPaths] = useState<
    Record<string, [number, number][]>
  >({});

  // Persist trail toggles to localStorage so they survive refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gpc:trails");
      if (raw) setTrailedIds(new Set(JSON.parse(raw)));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("gpc:trails", JSON.stringify([...trailedIds]));
    } catch {}
  }, [trailedIds]);

  // Fetch trails whenever the trailed set changes — pull last N locations per vehicle
  useEffect(() => {
    if (trailedIds.size === 0) {
      setTrailPaths({});
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const ids = [...trailedIds];
      const results: Record<string, [number, number][]> = {};
      // One query per vehicle to leverage the (vehicle_id, created_at desc) index
      await Promise.all(
        ids.map(async (id) => {
          const { data } = await supabase
            .from("locations")
            .select("lat, lng, created_at")
            .eq("vehicle_id", id)
            .order("created_at", { ascending: false })
            .limit(trailPoints);
          if (data && data.length > 0) {
            // reverse so polyline is drawn oldest → newest
            results[id] = data
              .slice()
              .reverse()
              .map((r) => [r.lat as number, r.lng as number]);
          }
        }),
      );
      if (!cancelled) setTrailPaths(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [trailedIds, trailPoints]);

  // Realtime: extend the trail when a new ping arrives for a trailed vehicle
  useEffect(() => {
    if (trailedIds.size === 0) return;
    const supabase = createClient();
    const channel = supabase
      .channel("locations-trails")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "locations" },
        (payload) => {
          const row = payload.new as {
            vehicle_id: string;
            lat: number;
            lng: number;
          };
          if (!trailedIds.has(row.vehicle_id)) return;
          setTrailPaths((prev) => {
            const existing = prev[row.vehicle_id] || [];
            const next = [...existing, [row.lat, row.lng] as [number, number]];
            // cap to trailPoints
            const trimmed =
              next.length > trailPoints ? next.slice(-trailPoints) : next;
            return { ...prev, [row.vehicle_id]: trimmed };
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [trailedIds, trailPoints]);

  function toggleTrail(vehicleId: string) {
    setTrailedIds((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  }
  function clearAllTrails() {
    setTrailedIds(new Set());
  }

  // Map tools
  const [tool, setTool] = useState<MapTool>("none");
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [closestPoint, setClosestPoint] = useState<[number, number] | null>(null);

  function resetTool() {
    setTool("none");
    setMeasurePoints([]);
    setClosestPoint(null);
  }

  function handleMapClick(e: LeafletMouseEvent) {
    const p: [number, number] = [e.latlng.lat, e.latlng.lng];
    if (tool === "distance" || tool === "area") {
      setMeasurePoints((prev) => [...prev, p]);
    } else if (tool === "closest") {
      setClosestPoint(p);
    }
  }

  function handleDoubleClick() {
    // double-click ends measurement but keeps results visible
    if (tool === "distance" || tool === "area") {
      // keep measurement on screen — user can clear via X button
    }
  }

  // Compute closest 5 vehicles to clicked point
  const closestResults = useMemo(() => {
    if (!closestPoint) return [];
    const withPos = vehicles.filter(
      (v) => v.last_lat != null && v.last_lng != null && !v.deleted_at,
    );
    return withPos
      .map((v) => ({
        vehicle: v,
        km:
          haversineMeters(closestPoint, [v.last_lat!, v.last_lng!]) / 1000,
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
  }, [closestPoint, vehicles]);

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("vehicles-realtime")
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

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pois-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pois" },
        async () => {
          const { data } = await supabase
            .from("pois")
            .select("*")
            .is("deleted_at", null);
          if (data) setPois(data as Poi[]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ESC to cancel tool
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetTool();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const center = useMemo<[number, number]>(() => {
    const withCoords = vehicles.find(
      (v) => v.last_lat != null && v.last_lng != null,
    );
    return withCoords
      ? [withCoords.last_lat!, withCoords.last_lng!]
      : [24.7136, 46.6753];
  }, [vehicles]);

  const cursorClass =
    tool !== "none" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing";

  return (
    <div className="relative">
      {/* Floating toolbar */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setLayerPanelOpen((v) => !v)}
          className={`grid size-9 place-items-center rounded-md border bg-white shadow-md hover:bg-slate-50 ${
            layerPanelOpen ? "ring-2 ring-sky-400" : ""
          }`}
          title="Toggle layers"
        >
          <Layers className="size-4 text-slate-700" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMeasurePoints([]);
            setTool(tool === "distance" ? "none" : "distance");
          }}
          className={`grid size-9 place-items-center rounded-md border bg-white shadow-md hover:bg-slate-50 ${
            tool === "distance" ? "ring-2 ring-sky-400" : ""
          }`}
          title="Measure distance"
        >
          <Ruler className="size-4 text-slate-700" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMeasurePoints([]);
            setTool(tool === "area" ? "none" : "area");
          }}
          className={`grid size-9 place-items-center rounded-md border bg-white shadow-md hover:bg-slate-50 ${
            tool === "area" ? "ring-2 ring-sky-400" : ""
          }`}
          title="Measure area"
        >
          <Hexagon className="size-4 text-slate-700" />
        </button>
        <button
          type="button"
          onClick={() => {
            setClosestPoint(null);
            setTool(tool === "closest" ? "none" : "closest");
          }}
          className={`grid size-9 place-items-center rounded-md border bg-white shadow-md hover:bg-slate-50 ${
            tool === "closest" ? "ring-2 ring-sky-400" : ""
          }`}
          title="Find closest units to a point"
        >
          <Crosshair className="size-4 text-slate-700" />
        </button>
        {trailedIds.size > 0 && (
          <button
            type="button"
            onClick={clearAllTrails}
            className="grid size-9 place-items-center rounded-md border bg-white shadow-md hover:bg-slate-50"
            title={`Clear ${trailedIds.size} active trail${trailedIds.size === 1 ? "" : "s"}`}
          >
            <span className="relative">
              <Route className="size-4 text-emerald-600" />
              <span className="absolute -right-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                {trailedIds.size > 9 ? "9+" : trailedIds.size}
              </span>
            </span>
          </button>
        )}
      </div>

      {/* Layer panel */}
      {layerPanelOpen && (
        <div className="absolute right-14 top-3 z-[1000] w-48 rounded-md border bg-white p-2 shadow-md">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
            Layers
          </div>
          <LayerToggle
            label="Vehicles"
            checked={layers.vehicles}
            onChange={(v) => setLayers({ ...layers, vehicles: v })}
          />
          <LayerToggle
            label="Zones"
            checked={layers.zones}
            onChange={(v) => setLayers({ ...layers, zones: v })}
          />
          <LayerToggle
            label="Places (POIs)"
            checked={layers.pois}
            onChange={(v) => setLayers({ ...layers, pois: v })}
          />
          <LayerToggle
            label="Trails"
            checked={layers.trails}
            onChange={(v) => setLayers({ ...layers, trails: v })}
          />
        </div>
      )}

      {/* Tool instructions / results */}
      {tool !== "none" && (
        <div className="absolute left-3 top-3 z-[1000] w-72 rounded-md border bg-white p-3 shadow-md">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {tool === "distance" && "Distance"}
              {tool === "area" && "Area"}
              {tool === "closest" && "Closest units"}
            </span>
            <button
              type="button"
              onClick={resetTool}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Close (Esc)"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {tool === "distance" && (
            <>
              <p className="text-xs text-slate-500">
                Click on the map to add points. Double-click or press Esc to
                finish.
              </p>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-800">
                {totalDistanceKm(measurePoints).toFixed(2)} km
              </div>
              <div className="text-xs text-slate-500">
                {measurePoints.length} point{measurePoints.length === 1 ? "" : "s"}
              </div>
            </>
          )}

          {tool === "area" && (
            <>
              <p className="text-xs text-slate-500">
                Click 3 or more points to outline an area. Double-click or Esc
                to finish.
              </p>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-800">
                {polygonAreaKm2(measurePoints).toFixed(3)} km²
              </div>
              <div className="text-xs text-slate-500">
                {measurePoints.length} vert{measurePoints.length === 1 ? "ex" : "ices"}
              </div>
            </>
          )}

          {tool === "closest" && (
            <>
              <p className="text-xs text-slate-500">
                {closestPoint
                  ? "Top 5 nearest vehicles to your click."
                  : "Click anywhere on the map."}
              </p>
              {closestPoint && closestResults.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  No vehicles with known positions.
                </p>
              )}
              {closestResults.length > 0 && (
                <ul className="mt-2 divide-y text-sm">
                  {closestResults.map((r) => (
                    <li
                      key={r.vehicle.id}
                      className="flex items-center justify-between py-1.5"
                    >
                      <a
                        className="truncate text-slate-700 hover:underline"
                        href={`/vehicles/${r.vehicle.id}`}
                      >
                        {r.vehicle.label}{" "}
                        <span className="text-xs text-slate-400">
                          {r.vehicle.plate}
                        </span>
                      </a>
                      <span className="ml-2 shrink-0 font-mono text-xs text-slate-600">
                        {r.km.toFixed(2)} km
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div
        className={`overflow-hidden rounded-lg border ${cursorClass}`}
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={11}
          scrollWheelZoom
          doubleClickZoom={tool === "none"}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <FitBoundsOnce vehicles={vehicles} />
          <MapClickHandler
            tool={tool}
            onClick={handleMapClick}
            onDoubleClick={handleDoubleClick}
          />

          {/* Zones */}
          {layers.zones &&
            zones.map((z) => {
              const s = z.shape as Record<string, unknown>;
              const color = z.is_prohibited ? "#dc2626" : "#0ea5e9";
              const opts = {
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: z.is_prohibited ? 0.18 : 0.1,
              };
              if (z.kind === "circle")
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
              if (z.kind === "rectangle")
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
              if (z.kind === "polygon") {
                const positions = (s.points as [number, number][]) || [];
                return (
                  <Polygon
                    key={z.id}
                    positions={positions}
                    pathOptions={opts}
                  >
                    <Popup>
                      <ZonePopup zone={z} />
                    </Popup>
                  </Polygon>
                );
              }
              return null;
            })}

          {/* POIs */}
          {layers.pois &&
            pois.map((p) => {
              const meta = categoryMeta(p.category);
              return (
                <Marker
                  key={`poi-${p.id}`}
                  position={[p.lat, p.lng]}
                  icon={buildPoiIcon(p.icon_color, meta.emoji)}
                >
                  <Popup>
                    <div className="space-y-0.5 text-sm">
                      <div className="font-semibold">
                        {meta.emoji} {p.name}
                      </div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {meta.label}
                        {!p.is_public && " · private"}
                      </div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Vehicles */}
          {layers.vehicles &&
            vehicles
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
                        <span className="text-muted-foreground">
                          ({v.plate})
                        </span>
                      </div>
                      {v.driver_name && (
                        <div className="text-xs">
                          Driver:{" "}
                          <span className="font-medium">{v.driver_name}</span>
                        </div>
                      )}
                      <div className="text-xs capitalize">
                        Status: {v.status}
                      </div>
                      {v.last_seen_at && (
                        <div className="text-xs text-muted-foreground">
                          Last ping{" "}
                          {formatDistanceToNow(new Date(v.last_seen_at), {
                            addSuffix: true,
                          })}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <a
                          className="text-blue-600 hover:underline"
                          href={`/vehicles/${v.id}`}
                        >
                          Open vehicle
                        </a>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => toggleTrail(v.id)}
                          className="text-emerald-700 hover:underline"
                        >
                          {trailedIds.has(v.id) ? "Hide trail" : "Show trail"}
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

          {/* Vehicle trails */}
          {layers.trails &&
            Object.entries(trailPaths).map(([vehicleId, path]) => {
              if (path.length < 2) return null;
              const v = vehicles.find((x) => x.id === vehicleId);
              const color = statusColor[v?.status ?? "offline"] || "#6b7280";
              return (
                <Polyline
                  key={`trail-${vehicleId}`}
                  positions={path}
                  pathOptions={{
                    color,
                    weight: 3,
                    opacity: 0.7,
                  }}
                />
              );
            })}

          {/* Measurement preview */}
          {tool === "distance" && measurePoints.length >= 2 && (
            <Polyline
              positions={measurePoints}
              pathOptions={{
                color: "#0ea5e9",
                weight: 3,
                dashArray: "6 6",
              }}
            />
          )}
          {tool === "area" && measurePoints.length >= 3 && (
            <Polygon
              positions={measurePoints}
              pathOptions={{
                color: "#a855f7",
                fillColor: "#a855f7",
                fillOpacity: 0.15,
                weight: 2,
              }}
            />
          )}
          {(tool === "distance" || tool === "area") &&
            measurePoints.map((p, i) => (
              <CircleMarker
                key={`mp-${i}`}
                center={p}
                radius={4}
                pathOptions={{
                  color: tool === "distance" ? "#0ea5e9" : "#a855f7",
                  fillColor: "white",
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            ))}

          {/* Closest-point marker */}
          {tool === "closest" && closestPoint && (
            <CircleMarker
              center={closestPoint}
              radius={6}
              pathOptions={{
                color: "#16a34a",
                fillColor: "#16a34a",
                fillOpacity: 0.5,
                weight: 2,
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

function LayerToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
    >
      {checked ? (
        <Eye className="size-3.5 text-slate-700" />
      ) : (
        <EyeOff className="size-3.5 text-slate-400" />
      )}
      <span className={checked ? "text-slate-800" : "text-slate-400"}>
        {label}
      </span>
    </button>
  );
}
