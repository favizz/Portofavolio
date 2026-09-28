import { api } from "@/lib/api";
import FleetMapClient from "./FleetMapClient";
import LiveFleetBoard from "@/components/LiveFleetBoard";
import BusyHoursPanel from "@/components/BusyHoursPanel";

export const dynamic = "force-dynamic";

const MONITORED_ROUTE_IDS = ["2", "2A", "7F"];

export default async function FleetPage() {
  const routes = await Promise.all(MONITORED_ROUTE_IDS.map((id) => api.fleet(id)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fleet View</h1>
        <p className="text-neutral-400 mt-2 text-sm max-w-2xl">
          MPB-OMS&apos;s 5 real, named buses across the 3 routes it monitors, drawn on their real published route
          paths. TransJakarta&apos;s feed has no live vehicle-position API, so this isn&apos;t live GPS &mdash;
          each bus&apos;s position, current stop, and next stop are computed from the feed&apos;s own real
          scheduled trip duration, real stop sequence, and real headway windows, deterministic for the current
          time in Jakarta. Occupancy is MPB-OMS&apos;s real per-bus snapshot, not live. Each bus is spread across
          one of its route&apos;s two real directions, since MPB-OMS&apos;s own bus data doesn&apos;t specify
          which GTFS direction it runs &mdash; the direction shown next to each bus is always that direction&apos;s
          real headsign, never MPB-OMS&apos;s own label.
        </p>
      </div>

      <LiveFleetBoard routes={routes} />

      <FleetMapClient routes={routes} />

      <BusyHoursPanel routes={routes} />
    </div>
  );
}
