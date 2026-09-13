"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Rectangle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api, type Stop, type CoverageCell } from "@/lib/api";

const JAKARTA_CENTER: [number, number] = [-6.2, 106.85];

export default function StopsMap() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [cells, setCells] = useState<CoverageCell[]>([]);
  const [showCoverage, setShowCoverage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stops().then((s) => {
      setStops(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (showCoverage && cells.length === 0) {
      api.coverageCells().then(setCells);
    }
  }, [showCoverage, cells.length]);

  const cellSizeDeg = 0.0045; // ~500m at this latitude, matches the grid resolution

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-400">
          {loading ? "Loading real stop data…" : `${stops.length.toLocaleString()} real stops`}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCoverage}
            onChange={(e) => setShowCoverage(e.target.checked)}
            className="accent-teal-500"
          />
          Show coverage grid ({cells.length ? cells.length.toLocaleString() : "…"} cells)
        </label>
      </div>

      <div className="rounded-xl overflow-hidden border border-neutral-800" style={{ height: 600 }}>
        <MapContainer center={JAKARTA_CENTER} zoom={11} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {showCoverage &&
            cells.map((c, i) => (
              <Rectangle
                key={i}
                bounds={[
                  [c.cell_lat - cellSizeDeg / 2, c.cell_lon - cellSizeDeg / 2],
                  [c.cell_lat + cellSizeDeg / 2, c.cell_lon + cellSizeDeg / 2],
                ]}
                pathOptions={{
                  color: c.within_standard ? "#2dd4bf" : "#f87171",
                  weight: 0,
                  fillOpacity: 0.25,
                }}
              />
            ))}
          {stops.map((s) => (
            <CircleMarker
              key={s.stop_id}
              center={[s.stop_lat, s.stop_lon]}
              radius={2}
              pathOptions={{ color: "#38bdf8", fillOpacity: 0.8, weight: 0 }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-medium">{s.stop_name}</div>
                  <div className="text-neutral-500">{s.stop_id}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
