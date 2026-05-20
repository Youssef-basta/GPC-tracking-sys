"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";

const pinHtml = (color: string) =>
  `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);transform:rotate(-45deg);"><div style="transform:rotate(45deg);font-size:11px;color:white;font-weight:600;line-height:1;">📍</div></div>`;

function pickerIcon(color: string) {
  return L.divIcon({
    html: pinHtml(color),
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function PanToOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

export function MiniMapPicker({
  lat,
  lng,
  color = "#0ea5e9",
  height = 260,
  zoom = 12,
  onChange,
}: {
  lat: number;
  lng: number;
  color?: string;
  height?: number;
  zoom?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-md border"
      style={{ height }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OSM'
        />
        <ClickHandler onPick={onChange} />
        <PanToOnChange lat={lat} lng={lng} />
        <Marker
          position={[lat, lng]}
          icon={pickerIcon(color)}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const p = m.getLatLng();
              onChange(p.lat, p.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
