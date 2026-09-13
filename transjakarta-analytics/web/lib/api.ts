const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export interface RouteSummary {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_color: string;
  trip_count: number;
}

export interface HeadwaySummary {
  standardSecs: number;
  standardLabel: string;
  routesWithFrequencyData: number;
  routesMeetingStandard: number;
  routesBelowStandard: number;
  routes: {
    route_id: string;
    route_short_name: string;
    route_long_name: string;
    avg_headway_secs: string;
    min_headway_secs: number;
    max_headway_secs: number;
    sample_count: number;
    meets_standard: boolean;
  }[];
}

export interface CoverageSummary {
  computed: boolean;
  message?: string;
  standardMeters: number;
  standardLabel?: string;
  totalCells?: number;
  coveredCells?: number;
  coveragePct?: number;
  avgDistanceToStopMeters?: number;
  maxDistanceToStopMeters?: number;
}

export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  wheelchair_boarding: number | null;
}

export interface CoverageCell {
  cell_lat: number;
  cell_lon: number;
  distance_meters: number;
  within_standard: boolean;
}

export interface NetworkGraph {
  minSharedStops: number;
  topN: number;
  totalRoutesConsidered: number;
  nodes: { id: string; label: string; longName: string; connections: number }[];
  edges: { route_a: string; route_b: string; shared_stops: number }[];
}

export const api = {
  routes: () => get<RouteSummary[]>('/routes'),
  headwaySummary: () => get<HeadwaySummary>('/headway/summary'),
  coverageSummary: () => get<CoverageSummary>('/coverage/summary'),
  coverageCells: () => get<CoverageCell[]>('/coverage/cells'),
  stops: () => get<Stop[]>('/stops'),
  networkGraph: (minSharedStops = 3, topN = 30) =>
    get<NetworkGraph>(`/network/graph?minSharedStops=${minSharedStops}&topN=${topN}`),
};
