import type { FleetRoute } from "./api";
import { DEMO_ROUTE_IDS, getSnapshotFleet } from "./fleetData";

// There's no real geolocation here (no live GPS feed, same reason the
// fleet itself is simulated rather than tracked). A single fixed point
// near Monumen Nasional stands in for "your current location", clearly
// labeled as a demo wherever it's shown, the same way every other
// simulated piece of this app is labeled. It's real, publicly known
// coordinates, just not actually read from the visitor's device.
export const DEMO_LOCATION = {
  lat: -6.179,
  lon: 106.8245,
  label: "Jl. MH Thamrin (demo location)",
};

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface NearestStation {
  stopId: string;
  stopName: string;
  distanceMeters: number;
  routeId: string;
  routeShortName: string;
  directionIndex: number;
}

/** The closest real stop, across every direction of the 13 bundled routes, to the fixed demo location. `routeShortName` comes from the live route list so it matches what's shown everywhere else. */
export function nearestStation(routes: { route_id: string; route_short_name: string }[]): NearestStation | null {
  let best: NearestStation | null = null;
  for (const routeId of DEMO_ROUTE_IDS) {
    const fleet: FleetRoute | null = getSnapshotFleet(routeId);
    if (!fleet) continue;
    const routeShortName = routes.find((r) => r.route_id === routeId)?.route_short_name ?? fleet.routeShortName;
    fleet.directions.forEach((direction, directionIndex) => {
      direction.stops.forEach((stop) => {
        if (typeof stop.lat !== "number" || typeof stop.lon !== "number") return;
        const distanceMeters = haversineMeters([DEMO_LOCATION.lat, DEMO_LOCATION.lon], [stop.lat, stop.lon]);
        if (!best || distanceMeters < best.distanceMeters) {
          best = { stopId: stop.stopId, stopName: stop.stopName, distanceMeters, routeId, routeShortName, directionIndex };
        }
      });
    });
  }
  return best;
}
