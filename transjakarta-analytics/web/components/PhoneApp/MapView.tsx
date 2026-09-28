"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface MapLine {
  positions: [number, number][];
  color: string;
}
export interface MapBus {
  key: string;
  label: string;
  position: [number, number];
  color: string;
  tooltip: string;
}

function Fit({ lines }: { lines: MapLine[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = lines.flatMap((l) => l.positions);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
  }, [lines, map]);
  return null;
}

function busIcon(label: string, color: string) {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:700 10px system-ui">${label}</div>`,
  });
}

export default function MapView({
  lines,
  stops = [],
  buses,
  fit,
}: {
  lines: MapLine[];
  stops?: [number, number][];
  buses: MapBus[];
  fit: boolean;
}) {
  return (
    <MapContainer
      center={[-6.2, 106.85]}
      zoom={12}
      zoomControl={false}
      style={{ height: "100%", width: "100%", background: "#eee" }}
    >
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {fit && <Fit lines={lines} />}
      {lines.map((l, i) => (
        <Polyline key={i} positions={l.positions} pathOptions={{ color: l.color, weight: 4, opacity: 0.85 }} />
      ))}
      {stops.map((p, i) => (
        <CircleMarker
          key={i}
          center={p}
          radius={4}
          pathOptions={{ color: "#1A4BA0", weight: 2, fillColor: "#fff", fillOpacity: 1 }}
        />
      ))}
      {buses.map((b) => (
        <Marker key={b.key} position={b.position} icon={busIcon(b.label, b.color)}>
          <Tooltip direction="top" offset={[0, -12]}>
            {b.tooltip}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
