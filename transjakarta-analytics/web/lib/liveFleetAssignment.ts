import type { FleetRoute } from "./api";
import { MPB_OMS_SNAPSHOT, type MpbOmsBus } from "./mpbOmsSnapshot";

export interface AssignedBus {
  bus: MpbOmsBus;
  directionIndex: number; // index into route.directions
  busIndexWithinDirection: number;
}

/**
 * Assigns each of MPB-OMS's real, named buses for a route to one of that
 * route's real GTFS directions, round-robin. MPB-OMS's own `direction`
 * field (e.g. "Senayan", "Jakarta Kota") is informal labeling from its
 * dummy seed data and doesn't reliably match either of the route's real
 * GTFS headsigns, so this doesn't attempt a semantic match - it just
 * spreads the route's real buses evenly across its real directions so
 * each bus gets a real, published stop sequence and schedule to run
 * against. The direction actually used is always shown via its real
 * headsign in the UI, never MPB-OMS's own label, so nothing false is
 * implied about which way a given bus runs.
 */
export function assignBusesToDirections(route: FleetRoute): AssignedBus[] {
  const busesForRoute = MPB_OMS_SNAPSHOT.filter((b) => b.routeShortName === route.routeShortName);
  const directionCount = route.directions.length;
  if (directionCount === 0) return [];

  return busesForRoute.map((bus, i) => ({
    bus,
    directionIndex: i % directionCount,
    busIndexWithinDirection: Math.floor(i / directionCount),
  }));
}
