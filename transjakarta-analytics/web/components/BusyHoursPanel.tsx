import type { FleetRoute } from "@/lib/api";

function formatMinutes(secs: number): string {
  const min = secs / 60;
  return Number.isInteger(min) ? `${min} min` : `${min.toFixed(1)} min`;
}

export default function BusyHoursPanel({ routes }: { routes: FleetRoute[] }) {
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <div className="bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-300">
        Real published service windows
      </div>
      <div className="divide-y divide-neutral-900">
        {routes.map((route) => (
          <div key={route.routeId} className="px-4 py-3">
            <div className="text-sm font-mono mb-2">{route.routeShortName}</div>
            <div className="space-y-1">
              {route.directions.map((d) =>
                d.headwayProfile.length === 0 ? (
                  <div key={d.shapeId} className="text-xs text-neutral-500">
                    Direction {d.directionId}: no published frequency window
                  </div>
                ) : (
                  d.headwayProfile.map((w, i) => (
                    <div key={`${d.shapeId}-${i}`} className="text-xs text-neutral-400 flex justify-between max-w-sm">
                      <span>
                        Direction {d.directionId}: {w.startTime.slice(0, 5)}&ndash;{w.endTime.slice(0, 5)}
                      </span>
                      <span className="text-neutral-300">every {formatMinutes(w.headwaySecs)}</span>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 text-xs text-neutral-500 border-t border-neutral-900">
        Shorter interval = more frequent service = less waiting. Windows and headways are exactly what
        TransJakarta&apos;s own feed publishes for a representative trip on each route/direction, not an estimate.
      </div>
    </div>
  );
}
