import type { FleetDirection } from "./api";
import { DEMO_ROUTE_IDS, getSnapshotFleet } from "./fleetData";
import { DEMO_LOCATION } from "./locate";
import { adviseRide, type HourAdvice, type Level } from "./rideAdvisor";

// Google-Maps-style "where to?" over the 13 bundled routes. Direct rides
// only: the bundled data has no transfer graph, so a destination no single
// bundled route reaches is reported as such rather than guessed at.

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const norm = (s: string) => s.trim().toLowerCase();

export interface Destination {
  name: string;
  routeIds: string[];
}

let destinationsCache: Destination[] | null = null;

/** Every distinct stop name across the bundled routes, with the routes that serve it. */
export function allDestinations(): Destination[] {
  if (destinationsCache) return destinationsCache;
  const byName = new Map<string, Destination>();
  for (const routeId of DEMO_ROUTE_IDS) {
    const fleet = getSnapshotFleet(routeId);
    if (!fleet) continue;
    for (const d of fleet.directions) {
      for (const s of d.stops) {
        const key = norm(s.stopName);
        const entry = byName.get(key) ?? { name: s.stopName, routeIds: [] };
        if (!entry.routeIds.includes(routeId)) entry.routeIds.push(routeId);
        byName.set(key, entry);
      }
    }
  }
  destinationsCache = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return destinationsCache;
}

/** Stop names matching the query: names that start with it first, then names containing it. */
export function searchDestinations(query: string, limit = 8): Destination[] {
  const q = norm(query);
  if (!q) return [];
  const all = allDestinations();
  const starts = all.filter((d) => norm(d.name).startsWith(q));
  const contains = all.filter((d) => !norm(d.name).startsWith(q) && norm(d.name).includes(q));
  return [...starts, ...contains].slice(0, limit);
}

export interface TripPlan {
  routeId: string;
  directionIndex: number;
  headsign: string | null;
  board: { name: string; position: [number, number]; index: number };
  alight: { name: string; position: [number, number]; index: number };
  walkMeters: number;
  rideStops: number;
  rideSecs: number | null;
  segment: [number, number][];
}

function nearestCoordIndex(coords: [number, number][], p: [number, number], from = 0): number {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < coords.length; i++) {
    const d = haversineMeters(coords[i], p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Direct rides from the demo location to the named stop, best (shortest walk, then fewest stops) first. */
export function planTrips(destinationName: string): TripPlan[] {
  const target = norm(destinationName);
  const here: [number, number] = [DEMO_LOCATION.lat, DEMO_LOCATION.lon];
  const plans: TripPlan[] = [];

  for (const routeId of DEMO_ROUTE_IDS) {
    const fleet = getSnapshotFleet(routeId);
    if (!fleet) continue;
    fleet.directions.forEach((d: FleetDirection, directionIndex) => {
      const stops = d.stops;
      let best: TripPlan | null = null;
      stops.forEach((alightStop, j) => {
        if (norm(alightStop.stopName) !== target) return;
        for (let i = 0; i < j; i++) {
          const b = stops[i];
          if (norm(b.stopName) === target) continue;
          const walkMeters = haversineMeters(here, [b.lat, b.lon]);
          const rideStops = j - i;
          if (best && (walkMeters > best.walkMeters + 1 || (Math.abs(walkMeters - best.walkMeters) <= 1 && rideStops >= best.rideStops))) continue;
          const startIdx = nearestCoordIndex(d.coordinates, [b.lat, b.lon]);
          const endIdx = nearestCoordIndex(d.coordinates, [alightStop.lat, alightStop.lon], startIdx);
          best = {
            routeId,
            directionIndex,
            headsign: d.headsign,
            board: { name: b.stopName, position: [b.lat, b.lon], index: i },
            alight: { name: alightStop.stopName, position: [alightStop.lat, alightStop.lon], index: j },
            walkMeters,
            rideStops,
            rideSecs: b.elapsedSecs !== null && alightStop.elapsedSecs !== null ? alightStop.elapsedSecs - b.elapsedSecs : null,
            segment: d.coordinates.slice(startIdx, Math.max(startIdx + 2, endIdx + 1)),
          };
        }
      });
      if (best) plans.push(best);
    });
  }
  plans.sort((a, b) => a.walkMeters - b.walkMeters || a.rideStops - b.rideStops);
  // One option per route: the best of its directions.
  return plans.filter((p, i) => plans.findIndex((q) => q.routeId === p.routeId) === i);
}

// The crowding index is relative to the route's own busiest hour (an
// estimate: real headways x an assumed demand curve). An hour counts as
// quiet when it sits in the comfortable band AND the estimate around it
// agrees: smoothed with its neighbours it stays comfortable, and at least
// one neighbour is quiet too. That rejects a lone dip boxed in by rush
// hours, which is more likely a schedule artefact than a real lull.
const QUIET = 0.45;
const NEAR_EMPTY = 0.25;
const FIRST_RIDE_HOUR = 5;
const LAST_RIDE_HOUR = 22;

export interface Departure {
  hour: number;
  dayOffset: 0 | 1;
  level: Level;
  nearEmpty: boolean;
  quiet: boolean;
  isNow: boolean;
}

function smoothed(hours: HourAdvice[], h: number): number | null {
  const at = (k: number) => hours[k]?.index ?? null;
  const c = at(h);
  if (c === null) return null;
  let sum = c * 2;
  let w = 2;
  for (const n of [at(h - 1), at(h + 1)]) {
    if (n !== null) {
      sum += n;
      w += 1;
    }
  }
  return sum / w;
}

function isQuiet(hours: HourAdvice[], h: number): boolean {
  const own = hours[h]?.index ?? null;
  const s = smoothed(hours, h);
  if (own === null || s === null || own > QUIET || s > QUIET) return false;
  const neighbours = [hours[h - 1]?.index ?? null, hours[h + 1]?.index ?? null].filter((v): v is number => v !== null);
  return neighbours.length === 0 || neighbours.some((v) => v <= QUIET);
}

function pick(hours: HourAdvice[], fromHour: number) {
  for (let h = Math.max(fromHour, FIRST_RIDE_HOUR); h <= LAST_RIDE_HOUR; h++) if (isQuiet(hours, h)) return h;
  return null;
}

/** The earliest quiet hour from `fromMinutes` on (see `isQuiet`), else tomorrow's first, else the least crowded hour left today. */
export function bestDeparture(directions: FleetDirection[], directionIndex: number, now: Date, fromMinutes: number): Departure | null {
  const fromHour = Math.floor(fromMinutes / 60);
  const make = (hours: HourAdvice[], h: number, dayOffset: 0 | 1, quiet: boolean): Departure => ({
    hour: h,
    dayOffset,
    level: hours[h].level ?? "comfortable",
    nearEmpty: quiet && (hours[h].index ?? 1) <= NEAR_EMPTY,
    quiet,
    isNow: dayOffset === 0 && h === fromHour,
  });

  const today = adviseRide(directions, directionIndex, now);
  const h0 = pick(today.hours, fromHour);
  if (h0 !== null) return make(today.hours, h0, 0, true);

  const tomorrow = adviseRide(directions, directionIndex, new Date(now.getTime() + 86400000));
  const h1 = pick(tomorrow.hours, 0);
  if (h1 !== null) return make(tomorrow.hours, h1, 1, true);

  const rest = today.hours.filter((h) => h.hour >= fromHour && h.index !== null);
  if (!rest.length) return null;
  const least = rest.reduce((a, b) => ((smoothed(today.hours, b.hour) ?? 1) < (smoothed(today.hours, a.hour) ?? 1) ? b : a));
  return make(today.hours, least.hour, 0, false);
}
