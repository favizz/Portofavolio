"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Real routes in this demo never leave greater Jakarta, so the map is locked to it, not the whole world.
const JAKARTA_BOUNDS: L.LatLngBoundsExpression = [
  [-6.45, 106.55],
  [-5.95, 107.05],
];

export interface MapLine {
  positions: [number, number][];
  color: string;
  dashArray?: string;
}
export interface MapStop {
  id: string;
  name: string;
  position: [number, number];
}
export interface MapBus {
  key: string;
  position: [number, number];
  heading: number;
  color: string;
  badge?: string;
  badgeBg?: string;
  selected?: boolean;
}
export interface MyLocation {
  position: [number, number];
  label: string;
}

function Fit({ lines, fitKey }: { lines: MapLine[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    const pts = lines.flatMap((l) => l.positions);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

const iconCache = new Map<string, L.DivIcon>();

/** A bus dot with a small arrowhead pointing its real direction of travel, and its seat count underneath. Simple, but a heading is hard to miss. */
function busIcon(color: string, heading: number, badge?: string, badgeBg = "#15803d", selected = false) {
  const key = `${color}|${Math.round(heading / 5)}|${badge}|${badgeBg}|${selected}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const badgeHtml = badge
    ? `<div style="position:absolute;left:50%;transform:translateX(-50%);top:32px;background:${badgeBg};color:#fff;font:700 10px system-ui;border-radius:8px;padding:1px 6px;white-space:nowrap;border:1px solid #fff">${badge}</div>`
    : "";
  const ring = selected ? "box-shadow:0 0 0 4px rgba(26,75,160,.55),0 1px 5px rgba(0,0,0,.45);" : "box-shadow:0 1px 5px rgba(0,0,0,.45);";
  // A dark-outlined chevron, offset clear of the circle. Buses sit right on the route's own white-cased line, so a white arrow (tried first) vanished against it; a near-black outline reads against the white casing, the route color, and the base map alike.
  const arrow = `<div style="position:absolute;left:50%;top:50%;width:0;height:0;transform:rotate(${heading}deg) translate(0,-27px)">
      <div style="position:absolute;left:-8px;top:-2px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:13px solid #111827"></div>
      <div style="position:absolute;left:-5px;top:1px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid ${color}"></div>
    </div>`;
  const icon = L.divIcon({
    className: "",
    iconSize: [40, 54],
    iconAnchor: [20, 20],
    html: `<div style="position:relative;width:40px;height:54px">${arrow}<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:${color};border:2px solid #fff;${ring}display:flex;align-items:center;justify-content:center;font-size:16px">&#128652;</div>${badgeHtml}</div>`,
  });
  iconCache.set(key, icon);
  return icon;
}

let myLocationIconCache: L.DivIcon | null = null;
/** A Google-Maps-style "you are here" dot: a soft pulsing halo (Tailwind's animate-ping, already generated since that class literally appears elsewhere in this app) around a solid blue center. Static, since this demo has no real GPS to move it. */
function myLocationIcon(): L.DivIcon {
  if (myLocationIconCache) return myLocationIconCache;
  myLocationIconCache = L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="position:relative;width:24px;height:24px">
      <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:rgba(26,75,160,.45)"></span>
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#1A4BA0;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>
    </div>`,
  });
  return myLocationIconCache;
}

export default function MapView({
  lines,
  stops = [],
  ends,
  buses,
  fit,
  fitKey = "",
  center = [-6.2, 106.85],
  zoom = 12,
  myLocation,
}: {
  lines: MapLine[];
  stops?: MapStop[];
  ends?: { start: [number, number]; end: [number, number] };
  buses: MapBus[];
  fit: boolean;
  fitKey?: string;
  center?: [number, number];
  zoom?: number;
  myLocation?: MyLocation;
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={11}
      maxZoom={18}
      maxBounds={JAKARTA_BOUNDS}
      maxBoundsViscosity={1.0}
      zoomControl={false}
      attributionControl={false}
      style={{ height: "100%", width: "100%", background: "#eee" }}
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {fit && <Fit lines={lines} fitKey={fitKey} />}
      {lines.map((l, i) => (
        <Polyline key={`c${i}`} positions={l.positions} pathOptions={{ color: "#fff", weight: 9, opacity: l.dashArray ? 0 : 0.95 }} />
      ))}
      {lines.map((l, i) => (
        <Polyline key={i} positions={l.positions} pathOptions={{ color: l.color, weight: l.dashArray ? 6 : 5, opacity: 1, dashArray: l.dashArray, lineCap: l.dashArray ? "round" : undefined }} />
      ))}
      {stops.map((s, i) => (
        // A handful of real routes revisit the same physical stop twice within one direction
        // (a loop-shaped corridor), so stopId alone isn't always unique within this list.
        <CircleMarker key={`${s.id}-${i}`} center={s.position} radius={5} pathOptions={{ color: "#1A4BA0", weight: 2, fillColor: "#fff", fillOpacity: 1 }}>
          <Popup>
            <div className="text-sm font-semibold">{s.name}</div>
            <div className="text-xs text-neutral-500">{s.id}</div>
          </Popup>
        </CircleMarker>
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
        <Marker key={b.key} position={b.position} zIndexOffset={b.selected ? 1000 : 0} icon={busIcon(b.color, b.heading, b.badge, b.badgeBg, b.selected)} />
      ))}
      {myLocation && (
        <Marker position={myLocation.position} icon={myLocationIcon()} zIndexOffset={900}>
          <Tooltip direction="right" offset={[10, 0]} permanent opacity={0.95}>
            {myLocation.label}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
