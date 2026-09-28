import type { FleetRoute } from "./api";
import snapshot from "./fleet.snapshot.json";

// Real GTFS data (shape, stops, headways) for the busiest lines, the main BRT corridors 1 to 13, bundled so the demo needs no server.
const data = snapshot as unknown as Record<string, FleetRoute>;

export const DEMO_ROUTE_IDS = Object.keys(data);

export function getSnapshotFleet(routeId: string): FleetRoute | null {
  return data[routeId] ?? null;
}
