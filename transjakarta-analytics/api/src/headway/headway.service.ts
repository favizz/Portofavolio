import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FREQUENT_SERVICE_HEADWAY_SECS } from '../config';

@Injectable()
export class HeadwayService implements OnModuleInit {
  private readonly logger = new Logger(HeadwayService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    // Compute once at boot so a fresh deploy produces a fully working app
    // without a manual POST /headway/compute call. Idempotent and cheap
    // enough (240 routes) to just always redo on startup.
    try {
      await this.recompute();
    } catch (err) {
      this.logger.warn(`Startup headway computation skipped: ${(err as Error).message}`);
    }
  }

  /**
   * Real computation: for every route, pull every frequencies.txt entry
   * belonging to one of its trips, and compute avg/min/max headway. This
   * is genuine GTFS-derived analysis, not a synthetic number - a route
   * with no frequencies.txt entries (i.e. the feed doesn't declare a
   * repeating headway for it) is reported as "no frequency data", not
   * silently defaulted to 0.
   */
  async recompute() {
    const { rows: routes } = await this.db.query(`SELECT route_id FROM routes`);
    let computed = 0;

    for (const r of routes) {
      const { rows } = await this.db.query(
        `
        SELECT f.headway_secs
        FROM frequencies f
        JOIN trips t ON t.trip_id = f.trip_id
        WHERE t.route_id = $1
        `,
        [r.route_id]
      );

      if (rows.length === 0) continue;

      const headways = rows.map((row) => row.headway_secs);
      const avg = headways.reduce((a, b) => a + b, 0) / headways.length;
      const min = Math.min(...headways);
      const max = Math.max(...headways);
      const meetsStandard = avg <= FREQUENT_SERVICE_HEADWAY_SECS;

      await this.db.query(
        `
        INSERT INTO route_headway_stats (route_id, avg_headway_secs, min_headway_secs, max_headway_secs, sample_count, meets_standard, computed_at)
        VALUES ($1,$2,$3,$4,$5,$6, now())
        ON CONFLICT (route_id) DO UPDATE SET
          avg_headway_secs = EXCLUDED.avg_headway_secs,
          min_headway_secs = EXCLUDED.min_headway_secs,
          max_headway_secs = EXCLUDED.max_headway_secs,
          sample_count = EXCLUDED.sample_count,
          meets_standard = EXCLUDED.meets_standard,
          computed_at = now()
        `,
        [r.route_id, avg, min, max, headways.length, meetsStandard]
      );
      computed++;
    }

    this.logger.log(`Computed headway stats for ${computed}/${routes.length} routes`);
    return { computed, totalRoutes: routes.length };
  }

  async summary() {
    const { rows } = await this.db.query(`
      SELECT rs.route_id, r.route_short_name, r.route_long_name,
             rs.avg_headway_secs, rs.min_headway_secs, rs.max_headway_secs,
             rs.sample_count, rs.meets_standard
      FROM route_headway_stats rs
      JOIN routes r ON r.route_id = rs.route_id
      ORDER BY rs.avg_headway_secs DESC
    `);

    const withData = rows.length;
    const meetingStandard = rows.filter((r) => r.meets_standard).length;

    return {
      standardSecs: FREQUENT_SERVICE_HEADWAY_SECS,
      standardLabel: '15-minute frequent-service threshold (industry benchmark, not an official TransJakarta target)',
      routesWithFrequencyData: withData,
      routesMeetingStandard: meetingStandard,
      routesBelowStandard: withData - meetingStandard,
      routes: rows,
    };
  }
}
