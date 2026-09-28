import type { FleetRoute } from "./api";
import snapshot from "./fleet.snapshot.json";

// Real GTFS data for the three routes CrowdEase counts occupancy on, bundled so the demo works instantly while the free-tier API sleeps.
export const SNAPSHOT_ROUTE_IDS = ["2", "2A", "7F"];

export function getSnapshotFleet(routeId: string): FleetRoute | null {
  return (snapshot as unknown as Record<string, FleetRoute>)[routeId] ?? null;
}
