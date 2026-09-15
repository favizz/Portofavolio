// A static snapshot of MPB-OMS's own known bus fleet - copied faithfully
// from that project's real seed data (apps/api/src/routes/occupancy.ts /
// occupancy-firestore.ts, github.com/favizz/MPB-OMS), not fabricated for
// this page. Occupancy values here are the *base* numbers from that
// source (before MPB-OMS's live YOLO webcam signal is added on top) -
// MPB-OMS has no live deployed endpoint to pull real-time numbers from
// right now, so this is a fixed reference point, not a live feed.
//
// This only covers MPB-OMS's 5 monitored buses across 3 routes - it is
// NOT network-wide occupancy data. See CapacityPriorityExplainer for the
// full honest framing shown to users.
export interface MpbOmsBus {
  busId: string;
  routeShortName: string;
  direction: string;
  capacity: number;
  baseOccupancy: number;
}

export const MPB_OMS_SNAPSHOT: MpbOmsBus[] = [
  { busId: 'DMR-727', routeShortName: '2', direction: 'Pulo Gadung', capacity: 40, baseOccupancy: 32 },
  { busId: 'DMR-710', routeShortName: '2', direction: 'Pulo Gadung', capacity: 40, baseOccupancy: 30 },
  { busId: 'MYS-19222', routeShortName: '7F', direction: 'Jakarta Kota', capacity: 40, baseOccupancy: 25 },
  { busId: 'MYS-17168', routeShortName: '7F', direction: 'Jakarta Kota', capacity: 40, baseOccupancy: 2 },
  { busId: 'DMR-240133', routeShortName: '2A', direction: 'Senayan', capacity: 40, baseOccupancy: 15 },
];

export const MPB_OMS_SNAPSHOT_CAPTURED_AT = '2026-09-15';
export const MPB_OMS_SOURCE_URL = 'https://github.com/favizz/MPB-OMS/blob/main/apps/api/src/routes/occupancy.ts';

export function routeOccupancyFromSnapshot() {
  const byRoute = new Map<string, { totalOccupancy: number; totalCapacity: number; buses: MpbOmsBus[] }>();
  for (const bus of MPB_OMS_SNAPSHOT) {
    const entry = byRoute.get(bus.routeShortName) || { totalOccupancy: 0, totalCapacity: 0, buses: [] };
    entry.totalOccupancy += bus.baseOccupancy;
    entry.totalCapacity += bus.capacity;
    entry.buses.push(bus);
    byRoute.set(bus.routeShortName, entry);
  }
  return [...byRoute.entries()].map(([routeShortName, v]) => ({
    routeShortName,
    occupancyPct: Math.round((v.totalOccupancy / v.totalCapacity) * 1000) / 10,
    busCount: v.buses.length,
    buses: v.buses,
  }));
}
