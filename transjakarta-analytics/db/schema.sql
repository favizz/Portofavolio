-- Schema for the subset of TransJakarta's real, official GTFS feed
-- (https://gtfs.transjakarta.co.id/files/file_gtfs.zip) this project
-- actually analyzes. Column names/types follow the GTFS static spec
-- directly where practical.

CREATE TABLE agency (
    agency_id   TEXT PRIMARY KEY,
    agency_name TEXT NOT NULL,
    agency_url  TEXT,
    agency_tz   TEXT
);

CREATE TABLE routes (
    route_id         TEXT PRIMARY KEY,
    agency_id        TEXT REFERENCES agency(agency_id),
    route_short_name TEXT,
    route_long_name  TEXT,
    route_desc       TEXT,
    route_type       INT,
    route_color      TEXT
);

CREATE TABLE stops (
    stop_id      TEXT PRIMARY KEY,
    stop_code    TEXT,
    stop_name    TEXT NOT NULL,
    stop_lat     DOUBLE PRECISION NOT NULL,
    stop_lon     DOUBLE PRECISION NOT NULL,
    location_type INT DEFAULT 0,
    wheelchair_boarding INT
);
CREATE INDEX idx_stops_lat_lon ON stops (stop_lat, stop_lon);

CREATE TABLE calendar (
    service_id TEXT PRIMARY KEY,
    monday     BOOLEAN,
    tuesday    BOOLEAN,
    wednesday  BOOLEAN,
    thursday   BOOLEAN,
    friday     BOOLEAN,
    saturday   BOOLEAN,
    sunday     BOOLEAN,
    start_date DATE,
    end_date   DATE
);

CREATE TABLE trips (
    trip_id       TEXT PRIMARY KEY,
    route_id      TEXT REFERENCES routes(route_id),
    service_id    TEXT REFERENCES calendar(service_id),
    trip_headsign TEXT,
    direction_id  INT
);
CREATE INDEX idx_trips_route ON trips (route_id);

CREATE TABLE stop_times (
    trip_id        TEXT REFERENCES trips(trip_id),
    stop_sequence  INT NOT NULL,
    stop_id        TEXT REFERENCES stops(stop_id),
    arrival_time   TEXT,   -- kept as text: GTFS allows values past 24:00:00
    departure_time TEXT,
    PRIMARY KEY (trip_id, stop_sequence)
);
CREATE INDEX idx_stop_times_stop ON stop_times (stop_id);
CREATE INDEX idx_stop_times_trip ON stop_times (trip_id);

CREATE TABLE frequencies (
    trip_id      TEXT REFERENCES trips(trip_id),
    start_time   TEXT NOT NULL,
    end_time     TEXT NOT NULL,
    headway_secs INT NOT NULL,
    PRIMARY KEY (trip_id, start_time)
);
CREATE INDEX idx_frequencies_trip ON frequencies (trip_id);

-- =========================================================
-- Derived/materialized analysis tables - populated by the API, not the
-- raw ingestion step, since they're computed results, not GTFS source data.
-- =========================================================

-- One row per route: average headway during the feed's own defined
-- service windows, and whether it meets a chosen service standard.
CREATE TABLE route_headway_stats (
    route_id           TEXT PRIMARY KEY REFERENCES routes(route_id),
    avg_headway_secs   NUMERIC,
    min_headway_secs   INT,
    max_headway_secs   INT,
    sample_count       INT,
    meets_standard     BOOLEAN, -- avg_headway_secs <= service standard (see api config)
    computed_at        TIMESTAMPTZ DEFAULT now()
);

-- One row per coverage-grid cell, produced by the Go coverage service.
CREATE TABLE coverage_cells (
    id               SERIAL PRIMARY KEY,
    cell_lat         DOUBLE PRECISION NOT NULL,
    cell_lon         DOUBLE PRECISION NOT NULL,
    nearest_stop_id  TEXT REFERENCES stops(stop_id),
    distance_meters  DOUBLE PRECISION NOT NULL,
    within_standard  BOOLEAN NOT NULL, -- distance_meters <= walking-distance standard
    computed_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_coverage_cells_lat_lon ON coverage_cells (cell_lat, cell_lon);
