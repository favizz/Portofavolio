import { demandAt } from "./rideAdvisor";

export const BUS_CAPACITY = 40;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** DEMO ONLY: a simulated passenger count. Follows the assumed demand curve for the hour, plus a per-bus, per-stop variation so the number changes each time a bus reaches a new stop. Not measured. */
export function simulatedOccupancy(routeKey: string, busIndex: number, stopIndex: number | null, now: Date): number {
  const jitter = hash(`${routeKey}|${busIndex}|${stopIndex ?? -1}`) - 0.5;
  const fill = Math.min(1, Math.max(0.05, demandAt(now) * 0.85 + jitter * 0.45));
  return Math.round(fill * BUS_CAPACITY);
}
