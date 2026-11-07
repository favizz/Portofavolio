import { demandAt } from "./rideAdvisor";

export const BUS_CAPACITY = 40;

// DEMO ONLY: no real per-stop ridership exists for this. Simulated as a
// bus that starts near a time-of-day-appropriate level, then at each stop
// a random number of passengers net board or alight, within a fixed range,
// clamped to the bus's real capacity. Not a fresh independent number per
// stop (that looked like noise, e.g. 2 then 35 then 3), an actual running
// count that only ever changes by a bounded, plausible amount stop to stop.
const STEP_RANGE = 5; // max net passengers added or removed at one stop
const MIN_OCCUPANCY = 1;
const TAPER_STOPS = 3; // the last N stops ease the count down to 0, instead of a full bus arriving at the terminus and instantly emptying

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** A random net change in [-STEP_RANGE, STEP_RANGE], stable for the same key so the same bus at the same stop always shows the same step. */
function stepDelta(key: string): number {
  return Math.round((hash(key) - 0.5) * 2 * STEP_RANGE);
}

/** 1 away from the terminus, easing down to 0 AT the terminus (everyone has to get off there), null when `totalStops` isn't known. */
function endTaper(stopIndex: number | null, totalStops?: number): number {
  if (stopIndex === null || !totalStops) return 1;
  const stopsFromEnd = totalStops - 1 - stopIndex;
  if (stopsFromEnd <= 0) return 0;
  if (stopsFromEnd >= TAPER_STOPS) return 1;
  return stopsFromEnd / TAPER_STOPS;
}

/** Simulated passenger count for one bus at one stop (or its starting count, if `stopIndex` is null). Follows the assumed time-of-day demand for its starting level, a bounded random walk of boarding/alighting per stop after that, then eases down to a real 0 at the route's own last stop (`totalStops`, the direction's real stop count) rather than a full bus instantly vanishing at the terminus. */
export function simulatedOccupancy(routeKey: string, busIndex: number, stopIndex: number | null, now: Date, totalStops?: number): number {
  const start = Math.round(Math.max(0.15, demandAt(now)) * BUS_CAPACITY * 0.5);
  let count = Math.min(BUS_CAPACITY, Math.max(MIN_OCCUPANCY, start));
  for (let s = 0; s <= (stopIndex ?? -1); s++) {
    count = Math.min(BUS_CAPACITY, Math.max(MIN_OCCUPANCY, count + stepDelta(`${routeKey}|${busIndex}|${s}`)));
  }
  const taper = endTaper(stopIndex, totalStops);
  return taper >= 1 ? count : Math.round(count * taper);
}

/** Same estimate as `simulatedOccupancy`, widened to a plausible range (± the per-stop step bound, narrowing along with the end taper so the terminus itself doesn't show a range around 0). Used when recommending a future arrival rather than reading a bus's count right now, so it's shown as a range rather than a single exact number. */
export function occupancyRangeAt(routeKey: string, busIndex: number, stopIndex: number | null, now: Date, totalStops?: number): [number, number] {
  const exact = simulatedOccupancy(routeKey, busIndex, stopIndex, now, totalStops);
  const spread = Math.round(STEP_RANGE * endTaper(stopIndex, totalStops));
  return [Math.max(0, exact - spread), Math.min(BUS_CAPACITY, exact + spread)];
}
