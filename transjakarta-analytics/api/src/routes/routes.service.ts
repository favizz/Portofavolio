import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RoutesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const { rows } = await this.db.query(`
      SELECT r.route_id, r.route_short_name, r.route_long_name, r.route_color,
             count(DISTINCT t.trip_id)::int AS trip_count
      FROM routes r
      LEFT JOIN trips t ON t.route_id = r.route_id
      GROUP BY r.route_id
      ORDER BY r.route_short_name
    `);
    return rows;
  }

  async findStopsForRoute(routeId: string) {
    const { rows } = await this.db.query(
      `
      SELECT DISTINCT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
      FROM stop_times st
      JOIN trips t ON t.trip_id = st.trip_id
      JOIN stops s ON s.stop_id = st.stop_id
      WHERE t.route_id = $1
      `,
      [routeId]
    );
    return rows;
  }
}
