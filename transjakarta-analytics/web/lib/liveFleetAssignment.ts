import type { FleetRoute } from "./api";
import { CROWDEASE_SNAPSHOT, type CrowdEaseBus } from "./crowdEaseSnapshot";

export interface AssignedBus {
  bus: CrowdEaseBus;
  directionIndex: number; // index into route.directions
  busIndexWithinDirection: number;
}

/**
 * Assigns each of CrowdEase's real, named buses for a route to one of that
 * route's real GTFS directions, round-robin. CrowdEase's own `direction`
 * field (e.g. "Senayan", "Jakarta Kota") is informal labeling from its
 * dummy seed data and doesn't reliably match either of the route's real
 * GTFS headsigns, so this doesn't attempt a semantic match - it just
 * spreads the route's real buses evenly across its real directions so
 * each bus gets a real, published stop sequence and schedule to run
 * against. The direction actually used is always shown via its real
 * headsign in the UI, never CrowdEase's own label, so nothing false is
 * implied about which way a given bus runs.
 */
export function assignBusesToDirections(route: FleetRoute): AssignedBus[] {
  const busesForRoute = CROWDEASE_SNAPSHOT.filter((b) => b.routeShortName === route.routeShortName);
  const directionCount = route.directions.length;
  if (directionCount === 0) return [];

  return busesForRoute.map((bus, i) => ({
    bus,
    directionIndex: i % directionCount,
    busIndexWithinDirection: Math.floor(i / directionCount),
  }));
}
