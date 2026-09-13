import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { WALKABLE_DISTANCE_METERS } from '../config';

@Injectable()
export class CoverageService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Reads the coverage grid computed offline by the Go coverage-service
   * (see /coverage-service) - this API never computes it itself, it just
   * serves what's already in coverage_cells.
   */
  async summary() {
    const { rows } = await this.db.query(`
      SELECT
        count(*)::int AS total_cells,
        count(*) FILTER (WHERE within_standard)::int AS covered_cells,
        round(avg(distance_meters)::numeric, 1) AS avg_distance_to_stop_meters,
        max(distance_meters) AS max_distance_to_stop_meters
      FROM coverage_cells
    `);

    if (!rows[0] || rows[0].total_cells === 0) {
      return {
        computed: false,
        message: 'No coverage data yet - run the Go coverage-service against this database first.',
        standardMeters: WALKABLE_DISTANCE_METERS,
      };
    }

    const s = rows[0];
    return {
      computed: true,
      standardMeters: WALKABLE_DISTANCE_METERS,
      standardLabel: `${WALKABLE_DISTANCE_METERS}m walkshed (~6-8 minute walk), a standard transit-coverage benchmark`,
      totalCells: s.total_cells,
      coveredCells: s.covered_cells,
      coveragePct: Math.round((s.covered_cells / s.total_cells) * 1000) / 10,
      avgDistanceToStopMeters: parseFloat(s.avg_distance_to_stop_meters),
      maxDistanceToStopMeters: s.max_distance_to_stop_meters,
    };
  }

  async cells() {
    const { rows } = await this.db.query(`
      SELECT cell_lat, cell_lon, distance_meters, within_standard
      FROM coverage_cells
    `);
    return rows;
  }
}
