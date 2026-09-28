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
  badge?: string;
  badgeBg?: string;
}

function Fit({ lines }: { lines: MapLine[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = lines.flatMap((l) => l.positions);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
  }, [lines, map]);
  return null;
}

function busIcon(color: string, badge?: string, badgeBg = "#15803d") {
  const badgeHtml = badge
    ? `<div style="position:absolute;left:50%;transform:translateX(-50%);top:26px;background:${badgeBg};color:#fff;font:700 10px system-ui;border-radius:8px;padding:1px 6px;white-space:nowrap;border:1px solid #fff">${badge}</div>`
    : "";
  return L.divIcon({
    className: "",
    iconSize: [30, 44],
    iconAnchor: [15, 15],
    html: `<div style="position:relative;width:30px;height:44px"><div style="width:30px;height:30px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:15px">&#128652;</div>${badgeHtml}</div>`,
  });
}

export default function MapView({
  lines,
  stops = [],
  ends,
  buses,
  fit,
}: {
  lines: MapLine[];
  stops?: [number, number][];
  ends?: { start: [number, number]; end: [number, number] };
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
        <Polyline key={`c${i}`} positions={l.positions} pathOptions={{ color: "#fff", weight: 9, opacity: 0.95 }} />
      ))}
      {lines.map((l, i) => (
        <Polyline key={i} positions={l.positions} pathOptions={{ color: l.color, weight: 5, opacity: 1 }} />
      ))}
      {stops.map((p, i) => (
        <CircleMarker
          key={i}
          center={p}
          radius={4}
          pathOptions={{ color: "#1A4BA0", weight: 2, fillColor: "#fff", fillOpacity: 1 }}
        />
      ))}
      {ends && (
        <>
          <CircleMarker center={ends.start} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#16a34a", fillOpacity: 1 }}>
            <Tooltip direction="top">Start</Tooltip>
          </CircleMarker>
          <CircleMarker center={ends.end} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#dc2626", fillOpacity: 1 }}>
            <Tooltip direction="top">End</Tooltip>
          </CircleMarker>
        </>
      )}
      {buses.map((b) => (
        <Marker key={b.key} position={b.position} icon={busIcon(b.color, b.badge, b.badgeBg)}>
          <Tooltip direction="top" offset={[0, -12]}>
            {b.tooltip}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
