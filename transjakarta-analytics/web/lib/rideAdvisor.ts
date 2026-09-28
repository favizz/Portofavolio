import type { FleetDirection } from "./api";

// ESTIMATE, not measured. Two inputs:
//  1. REAL: the route's published headway for each hour (GTFS frequencies.txt).
//  2. ASSUMED: a typical Jakarta commuter demand shape (weekday peaks around
//     06:00-09:00 and 16:00-20:00, flatter weekends). This shape is a modeling
//     assumption, the feed publishes no ridership.
// crowding index = demand x headway: fewer buses per hour means the same
// demand packs into fewer buses. Shown relative to the route's busiest hour.
const WEEKDAY_DEMAND = [
  0.05, 0.05, 0.05, 0.05, 0.05, 0.35, 0.75, 1, 0.95, 0.65, 0.45, 0.45, 0.55, 0.5, 0.45, 0.6, 0.8, 1, 1, 0.8, 0.55, 0.35,
  0.2, 0.1,
];
const WEEKEND_DEMAND = [
  0.05, 0.05, 0.05, 0.05, 0.05, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.75, 0.75, 0.75, 0.75, 0.8, 0.8, 0.75, 0.65, 0.5,
  0.35, 0.2, 0.1,
];
const REF_HEADWAY_SECS = 600;
const PEAK_DEMAND = 0.75;
const FIRST_RIDE_HOUR = 6;
const LAST_RIDE_HOUR = 21;

export type Level = "comfortable" | "moderate" | "crowded";
export interface HourAdvice {
  hour: number;
  headwaySecs: number | null;
  index: number | null;
  level: Level | null;
  peak: boolean;
}
export interface HourRange {
  from: number;
  to: number; // exclusive
}
export interface Advice {
  weekend: boolean;
  nowHour: number;
  hours: HourAdvice[];
  best: HourRange[];
  bestHeadwayMin: number | null;
  avoid: HourRange[];
  peaks: HourRange[];
  routeWide: boolean;
  hasData: boolean;
}

function jakartaNow(now: Date) {
  const d = new Date(now.getTime() + 7 * 3600 * 1000);
  return { day: d.getUTCDay(), hour: d.getUTCHours() };
}

function toSecs(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function hourlyFor(direction: FleetDirection): (number | null)[] {
  if (direction.hourlyHeadwaySecs) return direction.hourlyHeadwaySecs;
  return Array.from({ length: 24 }, (_, h) => {
    const w = direction.headwayProfile.find((p) => toSecs(p.startTime) < (h + 1) * 3600 && toSecs(p.endTime) > h * 3600);
    return w ? w.headwaySecs : null;
  });
}

function mergeHours(hours: number[]): HourRange[] {
  const sorted = [...hours].sort((a, b) => a - b);
  const out: HourRange[] = [];
  for (const h of sorted) {
    const last = out[out.length - 1];
    if (last && last.to === h) last.to = h + 1;
    else out.push({ from: h, to: h + 1 });
  }
  return out;
}

export function fmtRange(r: HourRange): string {
  const p = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  return `${p(r.from)}-${p(r.to)}`;
}

export function adviseRide(directions: FleetDirection[], directionIndex: number, now: Date): Advice {
  const { day, hour: nowHour } = jakartaNow(now);
  const weekend = day === 0 || day === 6;
  const demand = weekend ? WEEKEND_DEMAND : WEEKDAY_DEMAND;

  let hourly = hourlyFor(directions[directionIndex]);
  let routeWide = false;
  if (hourly.filter((x) => x !== null).length < 6 && directions.length > 1) {
    const all = directions.map(hourlyFor);
    hourly = Array.from({ length: 24 }, (_, h) => {
      const vals = all.map((a) => a[h]).filter((v): v is number => v !== null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    });
    routeWide = true;
  }

  const raw = hourly.map((headwaySecs, hour) => (headwaySecs === null ? null : demand[hour] * (headwaySecs / REF_HEADWAY_SECS)));
  const rideRaw = raw.filter((v, h): v is number => v !== null && h >= FIRST_RIDE_HOUR && h <= LAST_RIDE_HOUR);
  const maxRaw = rideRaw.length ? Math.max(...rideRaw) : 1;

  // Levels are relative to this route's own busiest hour, so peaks stand out on every route.
  const hours: HourAdvice[] = hourly.map((headwaySecs, hour) => {
    const peak = demand[hour] >= PEAK_DEMAND;
    if (raw[hour] === null) return { hour, headwaySecs, index: null, level: null, peak };
    const index = Math.min(1, raw[hour]! / maxRaw);
    const level: Level = index < 0.45 ? "comfortable" : index < 0.75 ? "moderate" : "crowded";
    return { hour, headwaySecs, index, level, peak };
  });

  const candidates = hours.filter((h) => h.index !== null && h.hour >= FIRST_RIDE_HOUR && h.hour <= LAST_RIDE_HOUR);
  const bestHours = [...candidates]
    .sort((a, b) => a.index! - b.index! || a.headwaySecs! - b.headwaySecs!)
    .slice(0, 3)
    .map((h) => h.hour);
  const bestHeadways = candidates.filter((h) => bestHours.includes(h.hour)).map((h) => h.headwaySecs!);

  return {
    weekend,
    nowHour,
    hours,
    best: mergeHours(bestHours),
    bestHeadwayMin: bestHeadways.length ? Math.round(bestHeadways.reduce((a, b) => a + b, 0) / bestHeadways.length / 60) : null,
    avoid: mergeHours(candidates.filter((h) => h.level === "crowded").map((h) => h.hour)),
    peaks: mergeHours(hours.filter((h) => h.peak && h.hour >= FIRST_RIDE_HOUR && h.hour <= 21).map((h) => h.hour)),
    routeWide,
    hasData: candidates.length > 0,
  };
}
