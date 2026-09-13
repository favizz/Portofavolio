import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NetworkService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Real transfer-connectivity graph: two routes are connected if they
   * share at least one real stop (a rider could transfer there). Edge
   * weight = number of shared stops. `minSharedStops` and `topN` let the
   * caller keep the graph readable - with 240 real routes the full graph
   * is too dense to render usefully, so the frontend asks for the most
   * connected subset rather than this service silently truncating.
   */
  async graph(minSharedStops = 2, topN = 40) {
    const { rows: edges } = await this.db.query(
      `
      WITH route_stops AS (
        SELECT DISTINCT t.route_id, st.stop_id
        FROM trips t
        JOIN stop_times st ON st.trip_id = t.trip_id
      )
      SELECT a.route_id AS route_a, b.route_id AS route_b, count(*)::int AS shared_stops
      FROM route_stops a
      JOIN route_stops b ON a.stop_id = b.stop_id AND a.route_id < b.route_id
      GROUP BY a.route_id, b.route_id
      HAVING count(*) >= $1
      ORDER BY shared_stops DESC
      `,
      [minSharedStops]
    );

    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.route_a, (degree.get(e.route_a) || 0) + 1);
      degree.set(e.route_b, (degree.get(e.route_b) || 0) + 1);
    }

    const topRouteIds = [...degree.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([id]) => id);
    const topSet = new Set(topRouteIds);

    const filteredEdges = edges.filter((e) => topSet.has(e.route_a) && topSet.has(e.route_b));

    if (topRouteIds.length === 0) {
      return { nodes: [], edges: [], minSharedStops, topN };
    }

    const { rows: routeInfo } = await this.db.query(
      `SELECT route_id, route_short_name, route_long_name FROM routes WHERE route_id = ANY($1)`,
      [topRouteIds]
    );
    const infoById = new Map(routeInfo.map((r) => [r.route_id, r]));

    const nodes = topRouteIds.map((id) => ({
      id,
      label: infoById.get(id)?.route_short_name || id,
      longName: infoById.get(id)?.route_long_name,
      connections: degree.get(id) || 0,
    }));

    return {
      minSharedStops,
      topN,
      totalRoutesConsidered: degree.size,
      nodes,
      edges: filteredEdges,
    };
  }
}
