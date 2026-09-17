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

/** The real phase (seconds into the representative trip's cycle) for the
 * `busIndex`-th bus spaced `headwaySecs` apart, or `null` if `now` falls
 * outside every real headway window this direction's representative trip
 * actually publishes (i.e. there's no real basis to place anything). */
function phaseForIndex(direction: FleetDirection, busIndex: number, now: Date): number | null {
  if (!direction.tripDurationSecs || direction.coordinates.length < 2) return null;
  const nowSecondsOfDay = jakartaSecondsOfDay(now);
  const window = activeWindow(direction.headwayProfile, nowSecondsOfDay);
  if (!window) return null;

  const windowStart = toSecondsOfDay(window.startTime);
  const duration = direction.tripDurationSecs;
  const headway = window.headwaySecs;
  return ((nowSecondsOfDay - windowStart + busIndex * headway) % duration + duration) % duration;
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
  const index = indexPolyline(direction.coordinates);
  const buses: SimulatedBus[] = [];
  for (let i = 0; i < busCount; i++) {
    const phase = phaseForIndex(direction, i, now)!;
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
  const phase = phaseForIndex(direction, busIndex, now);
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
