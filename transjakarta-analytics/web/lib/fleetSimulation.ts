import type { FleetDirection, FleetHeadwayWindow } from "./api";

// This project has no live vehicle-position feed - TransJakarta's real GTFS
// feed is static only. Everything below turns real schedule data (a real
// trip's scheduled duration, and frequencies.txt's real headway-by-time-
// window) into simulated bus positions along the route's real, published
// shape polyline. It is a deterministic function of wall-clock time, not a
// live GPS read, and is always labeled as such wherever it's shown.

function toSecondsOfDay(hhmmss: string): number {
  const [h, m, s] = hhmmss.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

const JAKARTA_UTC_OFFSET_SECS = 7 * 3600; // WIB, fixed year-round, no DST

// GTFS times are local to the agency (Asia/Jakarta), so "now" must be
// converted to Jakarta wall-clock time regardless of the visitor's own
// timezone, not read from the browser's local Date getters.
function jakartaSecondsOfDay(now: Date): number {
  const utcSecondsOfDay = Math.floor(now.getTime() / 1000) % 86400;
  return (utcSecondsOfDay + JAKARTA_UTC_OFFSET_SECS) % 86400;
}

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

interface PolylineIndex {
  cumulative: number[]; // meters from the start, one per coordinate
  total: number;
}

export function indexPolyline(coordinates: [number, number][]): PolylineIndex {
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMeters(coordinates[i - 1], coordinates[i]));
  }
  return { cumulative, total: cumulative[cumulative.length - 1] || 0 };
}

/** Position at `fraction` (0-1) of the way along the polyline's real path. */
export function pointAtFraction(
  coordinates: [number, number][],
  index: PolylineIndex,
  fraction: number
): [number, number] {
  const targetDist = Math.max(0, Math.min(1, fraction)) * index.total;
  let i = 1;
  while (i < index.cumulative.length && index.cumulative[i] < targetDist) i++;
  if (i >= coordinates.length) return coordinates[coordinates.length - 1];
  const segStart = index.cumulative[i - 1];
  const segEnd = index.cumulative[i];
  const segFraction = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
  const [lat1, lon1] = coordinates[i - 1];
  const [lat2, lon2] = coordinates[i];
  return [lat1 + (lat2 - lat1) * segFraction, lon1 + (lon2 - lon1) * segFraction];
}

/** Compass bearing (0 = north, 90 = east) from point `a` to point `b`, for pointing a bus icon in its direction of travel. */
function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lat1, lon1] = [toRad(a[0]), toRad(a[1])];
  const [lat2, lon2] = [toRad(b[0]), toRad(b[1])];
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Position and direction of travel at `fraction` along the polyline's real path. */
function pointAndHeadingAtFraction(
  coordinates: [number, number][],
  index: PolylineIndex,
  fraction: number
): { position: [number, number]; heading: number } {
  const targetDist = Math.max(0, Math.min(1, fraction)) * index.total;
  let i = 1;
  while (i < index.cumulative.length && index.cumulative[i] < targetDist) i++;
  if (i >= coordinates.length) i = coordinates.length - 1;
  const segStart = index.cumulative[i - 1];
  const segEnd = index.cumulative[i];
  const segFraction = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
  const [lat1, lon1] = coordinates[i - 1];
  const [lat2, lon2] = coordinates[i];
  return {
    position: [lat1 + (lat2 - lat1) * segFraction, lon1 + (lon2 - lon1) * segFraction],
    heading: bearing(coordinates[i - 1], coordinates[i]),
  };
}

function activeWindow(windows: FleetHeadwayWindow[], nowSecondsOfDay: number): FleetHeadwayWindow | null {
  for (const w of windows) {
    const start = toSecondsOfDay(w.startTime);
    const end = toSecondsOfDay(w.endTime);
    if (nowSecondsOfDay >= start && nowSecondsOfDay < end) return w;
  }
  return null;
}

export interface SimulatedBus {
  index: number;
  position: [number, number];
}

const MAX_SIMULATED_BUSES = 20;
const DAY_SECS = 86400;

interface Timing {
  headway: number;
}

/** Real published headway if there is one for `secs` (Jakarta seconds-of-day), else (demo only, 05:00-22:00) a fallback so every route shows a running fleet. */
function resolveTimingAtSecs(direction: FleetDirection, secs: number, fallbackHeadwaySecs?: number): Timing | null {
  const window = activeWindow(direction.headwayProfile, secs);
  if (window) return { headway: window.headwaySecs };
  const hourly = direction.hourlyHeadwaySecs?.[Math.floor(secs / 3600)];
  if (hourly) return { headway: hourly };
  const hour = Math.floor(secs / 3600);
  if (fallbackHeadwaySecs && hour >= 5 && hour < 22) return { headway: fallbackHeadwaySecs };
  return null;
}

function resolveTiming(direction: FleetDirection, now: Date, fallbackHeadwaySecs?: number): Timing | null {
  return resolveTimingAtSecs(direction, jakartaSecondsOfDay(now), fallbackHeadwaySecs);
}

/**
 * Seconds into the representative trip's cycle for the `busIndex`-th bus,
 * spaced `spacingSecs` apart (typically the current headway), or `null`
 * when nothing is running. Always measured from a single fixed epoch
 * (Jakarta midnight), never from the active headway window's own start
 * time: an earlier version re-anchored to each window's start, so a bus
 * jumped to an unrelated point on the route (sometimes behind where it
 * just was) every time the active window changed, tens of times over a
 * simulated day. Anchoring to one fixed epoch means a bus's phase is a
 * smooth, monotonic function of time that simply wraps 0-duration-0, a
 * clean loop back to the route's start, never a backward jump. Still used
 * by `simulateBuses`/`namedBusStatus` below; `simulatedFleet` has its own,
 * stronger anchor, see `departureSchedule`.
 */
function phaseForIndex(direction: FleetDirection, busIndex: number, now: Date, spacingSecs: number): number | null {
  if (!direction.tripDurationSecs || direction.coordinates.length < 2) return null;
  const duration = direction.tripDurationSecs;
  const nowSecs = jakartaSecondsOfDay(now);
  return ((nowSecs + busIndex * spacingSecs) % duration + duration) % duration;
}

/**
 * Every bus's real departure time (Jakarta seconds-of-day) for a full
 * service day, found by walking the route's own published headway across
 * the day: the next departure is always whatever headway is active at
 * that moment, seconds after the previous one.
 *
 * This replaces indexing buses as `busIndex * spacingSecs` measured from
 * "now" (what `phaseForIndex` above still does for the other two
 * simulators): that scheme re-derives every bus's position from whatever
 * headway is CURRENTLY active, so the instant the active headway source
 * changes (a published window ending, falling back to the hourly or
 * demo-average headway), every bus's phase except index 0 jumps by
 * `index * (new spacing - old spacing)`, a real, reported bug: buses
 * appear to teleport mid-route, or the whole fleet seems to get swapped
 * for an unrelated one. Once a bus's departure time is generated here it
 * never changes, so its phase (`now - departureTime`) is a continuous
 * function of time for that bus's entire trip, independent of what the
 * headway does later; only the spacing of the NEXT departure (not yet
 * generated) responds to a new headway, same as a real dispatch board: a
 * bus already on the road keeps running its own trip, a new one simply
 * starts at the route's beginning when its own scheduled moment arrives.
 */
function departureSchedule(direction: FleetDirection, fallbackHeadwaySecs?: number): number[] {
  const departures: number[] = [];
  let t = 0;
  let guard = 0;
  while (t < DAY_SECS && guard++ < 2000) {
    const timing = resolveTimingAtSecs(direction, Math.floor(t), fallbackHeadwaySecs);
    if (!timing || timing.headway <= 0) {
      t += 60;
      continue;
    }
    departures.push(t);
    t += timing.headway;
  }
  return departures;
}

export interface FleetBus {
  index: number;
  phase: number; // seconds into the trip cycle
  position: [number, number];
  heading: number; // compass degrees, direction of travel
  currentStopIndex: number | null;
}

/** The running fleet for one direction at `now`: one bus per real departure still in progress (see `departureSchedule`). Positions come from the real schedule, so they are simulated, not GPS. */
export function simulatedFleet(direction: FleetDirection, now: Date, opts: { fallbackHeadwaySecs?: number; max?: number } = {}): FleetBus[] {
  if (!direction.tripDurationSecs || direction.coordinates.length < 2) return [];
  const duration = direction.tripDurationSecs;
  const nowSecs = jakartaSecondsOfDay(now);
  const departures = departureSchedule(direction, opts.fallbackHeadwaySecs);
  const index = indexPolyline(direction.coordinates);

  const running = departures
    .map((dep) => ({ phase: ((nowSecs - dep) % DAY_SECS + DAY_SECS) % DAY_SECS }))
    .filter((b) => b.phase < duration)
    .sort((a, b) => a.phase - b.phase); // smallest phase = just departed, closest to the route's start

  const max = opts.max ?? 10;
  const sampled =
    running.length <= max ? running : Array.from({ length: max }, (_, i) => running[Math.floor((i * running.length) / max)]);

  return sampled.map((b, i) => {
    let currentStopIndex: number | null = null;
    direction.stops.forEach((st, k) => {
      if (st.elapsedSecs !== null && st.elapsedSecs <= b.phase) currentStopIndex = k;
    });
    const { position, heading } = pointAndHeadingAtFraction(direction.coordinates, index, b.phase / duration);
    return { index: i, phase: b.phase, position, heading, currentStopIndex };
  });
}

/**
 * Simulated bus positions for one direction at the given moment, or `null`
 * if `now` falls outside every real headway window this direction's
 * representative trip actually publishes (i.e. we have no real basis to
 * simulate anything for that time).
 */
export function simulateBuses(direction: FleetDirection, now: Date): SimulatedBus[] | null {
  if (!direction.tripDurationSecs || direction.coordinates.length < 2) return null;
  const nowSecondsOfDay = jakartaSecondsOfDay(now);
  const window = activeWindow(direction.headwayProfile, nowSecondsOfDay);
  if (!window) return null;

  const busCount = Math.min(MAX_SIMULATED_BUSES, Math.max(1, Math.round(direction.tripDurationSecs / window.headwaySecs)));
  const spacingSecs = direction.tripDurationSecs / busCount;
  const index = indexPolyline(direction.coordinates);
  const buses: SimulatedBus[] = [];
  for (let i = 0; i < busCount; i++) {
    const phase = phaseForIndex(direction, i, now, spacingSecs)!;
    buses.push({ index: i, position: pointAtFraction(direction.coordinates, index, phase / direction.tripDurationSecs) });
  }
  return buses;
}

export interface NamedBusStatus {
  position: [number, number];
  currentStopName: string | null;
  nextStopName: string | null;
  etaToNextStopSecs: number | null;
}

/**
 * Real position + real current/next-stop context for one specific,
 * named bus (not an abstract swarm member), assigned to `busIndex` within
 * this direction. currentStopName/nextStopName come from the real stop
 * sequence of the representative trip (real stop_times order), matched
 * against the same real elapsed-schedule-time used for the position -
 * this is the one part of Fleet View that is not itself a simulation, it's
 * a real lookup once a phase is known. Returns `null` outside any real
 * published headway window, same as simulateBuses.
 */
export function namedBusStatus(direction: FleetDirection, busIndex: number, now: Date): NamedBusStatus | null {
  const timing = resolveTiming(direction, now);
  const phase = timing ? phaseForIndex(direction, busIndex, now, timing.headway) : null;
  if (phase === null || !direction.tripDurationSecs) return null;

  const index = indexPolyline(direction.coordinates);
  const position = pointAtFraction(direction.coordinates, index, phase / direction.tripDurationSecs);

  const stops = direction.stops.filter((s) => s.elapsedSecs !== null) as { stopId: string; stopName: string; elapsedSecs: number }[];
  let current: (typeof stops)[number] | null = null;
  let next: (typeof stops)[number] | null = null;
  for (const stop of stops) {
    if (stop.elapsedSecs <= phase) current = stop;
    else if (!next) next = stop;
  }

  return {
    position,
    currentStopName: current?.stopName ?? null,
    nextStopName: next?.stopName ?? null,
    etaToNextStopSecs: next ? next.elapsedSecs - phase : null,
  };
}

/** Minutes-level view of how often a bus comes right now, or null when nothing runs. */
export function currentHeadwaySecs(direction: FleetDirection, now: Date, fallbackHeadwaySecs?: number): number | null {
  return resolveTiming(direction, now, fallbackHeadwaySecs)?.headway ?? null;
}
