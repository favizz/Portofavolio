"use client";

import { useEffect, useMemo, useState } from "react";
import type { FleetRoute } from "@/lib/api";
import { namedBusStatus } from "@/lib/fleetSimulation";
import { assignBusesToDirections } from "@/lib/liveFleetAssignment";

const ROUTE_COLORS: Record<string, string> = {
  "2": "#38bdf8",
  "2A": "#c084fc",
  "7F": "#fb923c",
};

function formatEta(secs: number | null): string {
  if (secs === null) return "unknown";
  const min = Math.round(secs / 60);
  return min <= 0 ? "arriving" : `${min} min`;
}

export default function LiveFleetBoard({ routes }: { routes: FleetRoute[] }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    return routes.flatMap((route) => {
      const assignments = assignBusesToDirections(route);
      return assignments.map(({ bus, directionIndex, busIndexWithinDirection }) => {
        const direction = route.directions[directionIndex];
        const status = direction ? namedBusStatus(direction, busIndexWithinDirection, now) : null;
        return { route, bus, direction, status };
      });
    });
  }, [routes, now]);

  return (
    <div className="space-y-3">
      {rows.map(({ route, bus, direction, status }) => {
        const color = ROUTE_COLORS[route.routeShortName] || "#94a3b8";
        const occupancyPct = Math.round((bus.baseOccupancy / bus.capacity) * 100);
        return (
          <div key={bus.busId} className="rounded-xl border border-neutral-800 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ background: `${color}22`, color }}
                >
                  Route {route.routeShortName}
                </span>
                <span className="text-sm font-mono text-neutral-300">{bus.busId}</span>
                {direction?.headsign && (
                  <span className="text-xs text-neutral-500">towards {direction.headsign}</span>
                )}
              </div>
              <span className="text-xs text-neutral-500">{occupancyPct}% full (CrowdEase snapshot)</span>
            </div>

            {status ? (
              <div className="text-sm text-neutral-300">
                Now near <span className="text-neutral-100">{status.currentStopName ?? "the route's start"}</span>
                {status.nextStopName && (
                  <>
                    {" "}
                    &middot; next <span className="text-neutral-100">{status.nextStopName}</span> in{" "}
                    <span className="text-neutral-100">{formatEta(status.etaToNextStopSecs)}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm text-neutral-500">Outside this route's published service hours right now.</div>
            )}

            <div className="mt-2 h-1.5 rounded-full bg-neutral-900 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${occupancyPct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
