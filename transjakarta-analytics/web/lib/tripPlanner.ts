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
// estimate: real headways x an assumed demand curve). Levels: green below
// 0.45, orange 0.45-0.75, red above. An hour is "good enough" when it sits
// at or below the middle of the orange band (0.60) AND at least one
// neighbouring hour does too: a single quiet hour boxed in by busy hours on
// both sides is more likely a schedule artefact than a real lull, so it is
// skipped.
const GOOD = 0.6;
const SEATS = 0.45;
const NEAR_EMPTY = 0.25;
const FIRST_RIDE_HOUR = 5;
const LAST_RIDE_HOUR = 22;
const DAY = 1440;

export interface DepartureQuery {
  /** Earliest the rider can leave, minutes after Jakarta midnight. */
  leaveMin: number;
  /** Latest acceptable arrival, minutes after Jakarta midnight (same day), or null for no limit. */
  arriveByMin: number | null;
  walkMin: number;
  rideMin: number;
}

export type DepartureStatus = "good" | "fallback" | "late" | "tomorrow";

export interface Departure {
  status: DepartureStatus;
  /** Minutes after midnight of the day given by dayOffset. */
  leaveAt: number;
  boardAt: number;
  arriveAt: number;
  dayOffset: 0 | 1;
  level: Level;
  index: number;
  /** "Near empty" / "Seats likely" / "Fairly quiet" / level text. */
  label: string;
}

function at(hours: HourAdvice[], h: number): number | null {
  return hours[h]?.index ?? null;
}

function smoothed(hours: HourAdvice[], h: number): number | null {
  const c = at(hours, h);
  if (c === null) return null;
  let sum = c * 2;
  let w = 2;
  for (const n of [at(hours, h - 1), at(hours, h + 1)]) {
    if (n !== null) {
      sum += n;
      w += 1;
    }
  }
  return sum / w;
}

function isGood(hours: HourAdvice[], h: number): boolean {
  const own = at(hours, h);
  if (own === null || own > GOOD || h < FIRST_RIDE_HOUR || h > LAST_RIDE_HOUR) return false;
  const neighbours = [at(hours, h - 1), at(hours, h + 1)].filter((v): v is number => v !== null);
  return neighbours.length === 0 || neighbours.some((v) => v <= GOOD);
}

function label(index: number, level: Level): string {
  if (index <= NEAR_EMPTY) return "Near empty";
  if (index <= SEATS) return "Seats likely";
  if (index <= GOOD) return "Fairly quiet";
  return level === "crowded" ? "Crowded" : "Busy";
}

const waitMin = (hours: HourAdvice[], h: number) => Math.round((hours[h]?.headwaySecs ?? 600) / 120);

/**
 * When to leave. Walks forward from the moment the rider could first board
 * (leave time + walk) through each later hour, and returns the earliest
 * boarding time whose hour is good enough (see `isGood`) and still arrives by
 * `arriveByMin`. If none is good enough it returns the least crowded option
 * that still arrives in time ("fallback"), or "late" when even leaving now
 * misses the arrive-by time. With no arrive-by limit and nothing good left
 * today, it suggests tomorrow's first good hour.
 */
export function planDeparture(directions: FleetDirection[], directionIndex: number, now: Date, q: DepartureQuery): Departure | null {
  const today = adviseRide(directions, directionIndex, now).hours;
  const firstBoard = q.leaveMin + q.walkMin;

  const candidates: { boardAt: number; hour: number }[] = [];
  if (firstBoard < DAY) {
    const h0 = Math.floor(firstBoard / 60);
    if (h0 >= FIRST_RIDE_HOUR) candidates.push({ boardAt: firstBoard, hour: h0 });
    for (let h = Math.max(h0 + 1, FIRST_RIDE_HOUR); h <= LAST_RIDE_HOUR; h++) candidates.push({ boardAt: h * 60, hour: h });
  }
  const served = candidates.filter((c) => at(today, c.hour) !== null);
  const make = (hours: HourAdvice[], c: { boardAt: number; hour: number }, status: DepartureStatus, dayOffset: 0 | 1): Departure => {
    const index = at(hours, c.hour)!;
    const level = hours[c.hour].level ?? "comfortable";
    return {
      status,
      leaveAt: c.boardAt - q.walkMin,
      boardAt: c.boardAt,
      arriveAt: c.boardAt + waitMin(hours, c.hour) + q.rideMin,
      dayOffset,
      level,
      index,
      label: label(index, level),
    };
  };
  const arrival = (c: { boardAt: number; hour: number }) => c.boardAt + waitMin(today, c.hour) + q.rideMin;
  const inTime = served.filter((c) => q.arriveByMin === null || arrival(c) <= q.arriveByMin);

  const good = inTime.find((c) => isGood(today, c.hour));
  if (good) return make(today, good, "good", 0);

  if (q.arriveByMin !== null) {
    if (!inTime.length) return served.length ? make(today, served[0], "late", 0) : null;
    const least = inTime.reduce((a, b) => (at(today, b.hour)! < at(today, a.hour)! ? b : a));
    return make(today, least, "fallback", 0);
  }

  const tomorrow = adviseRide(directions, directionIndex, new Date(now.getTime() + 86400000)).hours;
  for (let h = FIRST_RIDE_HOUR; h <= LAST_RIDE_HOUR; h++) {
    if (isGood(tomorrow, h)) return make(tomorrow, { boardAt: h * 60, hour: h }, "tomorrow", 1);
  }
  if (!served.length) return null;
  const least = served.reduce((a, b) => ((smoothed(today, b.hour) ?? 1) < (smoothed(today, a.hour) ?? 1) ? b : a));
  return make(today, least, "fallback", 0);
}
