// Analytical thresholds used throughout this project. These are chosen,
// documented benchmarks (common in transit-planning literature), NOT an
// official TransJakarta service standard - the GTFS feed itself doesn't
// publish one, so we say so explicitly wherever these are surfaced.
export const FREQUENT_SERVICE_HEADWAY_SECS = 15 * 60; // 15 min - a widely
// used industry threshold for "frequent service" (e.g. many US MPOs' transit
// scoring, TCRP Report 100 frequency tiers use 15 min as the top frequent-
// service band).

export const WALKABLE_DISTANCE_METERS = 500; // ~ a 6-8 minute walk, the
// standard "walkshed" radius used in most transit-coverage studies.
