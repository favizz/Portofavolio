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

/** Simulated passenger count for one bus at one stop (or its starting count, if `stopIndex` is null). Follows the assumed time-of-day demand for its starting level, then a bounded random walk of boarding/alighting per stop after that. */
export function simulatedOccupancy(routeKey: string, busIndex: number, stopIndex: number | null, now: Date): number {
  const start = Math.round(Math.max(0.15, demandAt(now)) * BUS_CAPACITY * 0.5);
  let count = Math.min(BUS_CAPACITY, Math.max(MIN_OCCUPANCY, start));
  for (let s = 0; s <= (stopIndex ?? -1); s++) {
    count = Math.min(BUS_CAPACITY, Math.max(MIN_OCCUPANCY, count + stepDelta(`${routeKey}|${busIndex}|${s}`)));
  }
  return count;
}

/** Same estimate as `simulatedOccupancy`, widened to a plausible range (± the per-stop step bound). Used when recommending a future arrival rather than reading a bus's count right now, so it's shown as a range rather than a single exact number. */
export function occupancyRangeAt(routeKey: string, busIndex: number, stopIndex: number | null, now: Date): [number, number] {
  const exact = simulatedOccupancy(routeKey, busIndex, stopIndex, now);
  return [Math.max(MIN_OCCUPANCY, exact - STEP_RANGE), Math.min(BUS_CAPACITY, exact + STEP_RANGE)];
}
