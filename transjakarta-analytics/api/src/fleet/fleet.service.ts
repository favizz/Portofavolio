import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

function toSeconds(hhmmss: string | null): number | null {
  if (!hhmmss) return null;
  const [h, m, s] = hhmmss.split(':').map(Number);
  if ([h, m, s].some((n) => Number.isNaN(n))) return null;
  return h * 3600 + m * 60 + s;
}

@Injectable()
export class FleetService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Real, schedule-derived data for one route: for each real direction the
   * feed defines, the actual shape.txt polyline TransJakarta publishes for
   * that direction (the most-used shape among that direction's trips),
   * the real scheduled trip duration (from stop_times' own first/last
   * arrival-departure), and the real frequencies.txt headway windows. No
   * live GPS exists in the feed - this is the raw material the frontend
   * uses to *simulate* bus positions along a real path on a real schedule,
   * not a claim of live tracking.
   */
  async forRoute(routeId: string) {
    const { rows: routeRows } = await this.db.query(
      `SELECT route_id, route_short_name, route_long_name FROM routes WHERE route_id = $1`,
      [routeId]
    );
    if (routeRows.length === 0) throw new NotFoundException(`Unknown route_id: ${routeId}`);
    const route = routeRows[0];

    const { rows: shapeCounts } = await this.db.query(
      `
      SELECT direction_id, shape_id, COUNT(*) AS trip_count
      FROM trips
      WHERE route_id = $1 AND shape_id IS NOT NULL
      GROUP BY direction_id, shape_id
      ORDER BY direction_id, trip_count DESC
      `,
      [routeId]
    );

    const bestShapePerDirection = new Map<number, string>();
    for (const row of shapeCounts) {
      if (!bestShapePerDirection.has(row.direction_id)) {
        bestShapePerDirection.set(row.direction_id, row.shape_id);
      }
    }

    const directions = [];
    for (const [directionId, shapeId] of bestShapePerDirection) {
      const { rows: coordRows } = await this.db.query(
        `SELECT shape_pt_lat, shape_pt_lon FROM shapes WHERE shape_id = $1 ORDER BY shape_pt_sequence`,
        [shapeId]
      );
      if (coordRows.length === 0) continue;

      const { rows: tripRows } = await this.db.query(
        `
        SELECT t.trip_id, t.trip_headsign
        FROM trips t
        WHERE t.route_id = $1 AND t.shape_id = $2
        ORDER BY (SELECT COUNT(*) FROM frequencies f WHERE f.trip_id = t.trip_id) DESC
        LIMIT 1
        `,
        [routeId, shapeId]
      );
      const tripId = tripRows[0]?.trip_id;
      if (!tripId) continue;
      const headsign = tripRows[0]?.trip_headsign ?? null;

      const { rows: stopTimeRows } = await this.db.query(
        `
        SELECT st.arrival_time, st.departure_time, s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
        FROM stop_times st
        JOIN stops s ON s.stop_id = st.stop_id
        WHERE st.trip_id = $1
        ORDER BY st.stop_sequence
        `,
        [tripId]
      );
      const firstSecs = toSeconds(stopTimeRows[0]?.arrival_time ?? stopTimeRows[0]?.departure_time ?? null);
      const lastRow = stopTimeRows[stopTimeRows.length - 1];
      const lastSecs = toSeconds(lastRow?.departure_time ?? lastRow?.arrival_time ?? null);
      const tripDurationSecs = firstSecs !== null && lastSecs !== null ? lastSecs - firstSecs : null;

      const stops =
        firstSecs === null
          ? []
          : stopTimeRows.map((r) => {
              const secs = toSeconds(r.arrival_time ?? r.departure_time);
              return {
                stopId: r.stop_id,
                stopName: r.stop_name,
                lat: r.stop_lat,
                lon: r.stop_lon,
                elapsedSecs: secs !== null ? secs - firstSecs : null,
              };
            });

      const { rows: freqRows } = await this.db.query(
        `SELECT start_time, end_time, headway_secs FROM frequencies WHERE trip_id = $1 ORDER BY start_time`,
        [tripId]
      );

      directions.push({
        directionId,
        shapeId,
        representativeTripId: tripId,
        headsign,
        coordinates: coordRows.map((r) => [r.shape_pt_lat, r.shape_pt_lon]),
        tripDurationSecs,
        stops,
        headwayProfile: freqRows.map((r) => ({
          startTime: r.start_time,
          endTime: r.end_time,
          headwaySecs: r.headway_secs,
        })),
      });
    }

    return {
      routeId: route.route_id,
      routeShortName: route.route_short_name,
      routeLongName: route.route_long_name,
      note: 'coordinates and headwayProfile are real, published GTFS data. This feed has no live vehicle-position API, so bus positions are not live GPS - they must be simulated client-side from this real schedule.',
      directions,
    };
  }
}
