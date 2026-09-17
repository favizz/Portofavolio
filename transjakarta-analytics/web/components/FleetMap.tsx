"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FleetRoute } from "@/lib/api";
import { namedBusStatus } from "@/lib/fleetSimulation";
import { assignBusesToDirections } from "@/lib/liveFleetAssignment";

const JAKARTA_CENTER: [number, number] = [-6.2, 106.85];

const ROUTE_COLORS: Record<string, string> = {
  "2": "#38bdf8",
  "2A": "#c084fc",
  "7F": "#fb923c",
};

export default function FleetMap({ routes }: { routes: FleetRoute[] }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  const busMarkers = useMemo(() => {
    return routes.flatMap((route) => {
      const color = ROUTE_COLORS[route.routeShortName] || "#94a3b8";
      return assignBusesToDirections(route).flatMap(({ bus, directionIndex, busIndexWithinDirection }) => {
        const direction = route.directions[directionIndex];
        if (!direction) return [];
        const status = namedBusStatus(direction, busIndexWithinDirection, now);
        if (!status) return [];
        const occupancyPct = Math.round((bus.baseOccupancy / bus.capacity) * 100);
        return [{ route, bus, color, status, occupancyPct }];
      });
    });
  }, [routes, now]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400">
        {routes.map((r) => (
          <span key={r.routeId} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: ROUTE_COLORS[r.routeShortName] || "#94a3b8" }}
            />
            Route {r.routeShortName}
          </span>
        ))}
        <span className="text-neutral-600">
          Jakarta time now: {new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(11, 19)} WIB
        </span>
      </div>

      {busMarkers.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-xs text-neutral-400">
          None of MPB-OMS's monitored buses have a real published service window covering the current time, so
          nothing is shown right now.
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-neutral-800" style={{ height: 560 }}>
        <MapContainer center={JAKARTA_CENTER} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {routes.map((route) => {
            const color = ROUTE_COLORS[route.routeShortName] || "#94a3b8";
            return (
              <Fragment key={route.routeId}>
                {route.directions.map((direction) => (
                  <Polyline
                    key={direction.shapeId}
                    positions={direction.coordinates}
                    pathOptions={{ color, weight: 3, opacity: 0.55 }}
                  />
                ))}
              </Fragment>
            );
          })}
          {busMarkers.map(({ route, bus, color, status, occupancyPct }) => (
            <CircleMarker
              key={bus.busId}
              center={status.position}
              radius={5 + occupancyPct / 15}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 1 }}
            >
              <Tooltip>
                <div className="text-xs">
                  <div className="font-medium">
                    Route {route.routeShortName} &middot; {bus.busId}
                  </div>
                  <div>Now near {status.currentStopName ?? "the route's start"}</div>
                  {status.nextStopName && <div>Next: {status.nextStopName}</div>}
                  <div>~{occupancyPct}% occupancy (MPB-OMS snapshot)</div>
                  <div className="text-neutral-500">Simulated from real schedule, not live GPS</div>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
