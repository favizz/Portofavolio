// Downloads TransJakarta's real, official GTFS static feed and loads the
// subset of it this project analyzes into Postgres. Idempotent: truncates
// and reloads every run, so it's safe to re-run whenever the upstream feed
// changes.
//
// Every table load is batched (multi-row INSERT, BATCH rows per round
// trip) rather than one INSERT per row - against a remote database (Neon,
// Render's own Postgres, anything not on localhost) round-trip latency
// dominates: this feed has ~9,800 total rows across agency/routes/stops/
// calendar/trips/stop_times/frequencies, and one-row-at-a-time inserts
// turn into ~9,800 sequential round trips (tens of minutes over a real
// network). Batched, it's under 100 round trips.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import unzipper from 'unzipper';
import { parse } from 'csv-parse/sync';

const GTFS_URL = 'https://gtfs.transjakarta.co.id/files/file_gtfs.zip';
const DATA_DIR = path.resolve(import.meta.dirname, '../data');
const ZIP_PATH = path.join(DATA_DIR, 'file_gtfs.zip');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/transjakarta';
const BATCH = 500;

async function downloadFeed() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Downloading ${GTFS_URL} ...`);
  const res = await fetch(GTFS_URL);
  if (!res.ok) throw new Error(`GTFS download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(ZIP_PATH, buf);
  console.log(`Saved ${buf.length} bytes to ${ZIP_PATH}`);
  return buf;
}

async function readFeedFiles(zipBuffer) {
  const directory = await unzipper.Open.buffer(zipBuffer);
  const files = {};
  for (const entry of directory.files) {
    const content = await entry.buffer();
    files[entry.path] = content.toString('utf-8');
  }
  return files;
}

function parseCsv(text) {
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function toBool(v) {
  return v === '1';
}

function toDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * Batched multi-row INSERT. `rowToParams` maps one source row to an array
 * of column values (or `null` to skip that row - used for rows referencing
 * an id that didn't survive an earlier table's own filtering).
 */
async function batchInsert(client, label, table, columns, sourceRows, rowToParams, conflictClause = '') {
  console.log(`Loading ${sourceRows.length} ${label}...`);
  const colList = columns.join(', ');
  let loaded = 0;

  for (let i = 0; i < sourceRows.length; i += BATCH) {
    const chunk = sourceRows.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let paramIdx = 0;

    for (const row of chunk) {
      const rowParams = rowToParams(row);
      if (rowParams === null) continue;
      const placeholders = rowParams.map(() => `$${++paramIdx}`);
      values.push(`(${placeholders.join(',')})`);
      params.push(...rowParams);
    }

    if (values.length === 0) continue;

    await client.query(
      `INSERT INTO ${table} (${colList}) VALUES ${values.join(',')} ${conflictClause}`,
      params
    );
    loaded += values.length;
    process.stdout.write(`\r  ${Math.min(i + BATCH, sourceRows.length)}/${sourceRows.length}`);
  }
  console.log(loaded === sourceRows.length ? '' : ` (${loaded} inserted, ${sourceRows.length - loaded} skipped)`);
}

async function main() {
  let zipBuffer;
  if (process.argv.includes('--use-cached') && fs.existsSync(ZIP_PATH)) {
    console.log(`Using cached feed at ${ZIP_PATH}`);
    zipBuffer = fs.readFileSync(ZIP_PATH);
  } else {
    zipBuffer = await downloadFeed();
  }

  const files = await readFeedFiles(zipBuffer);
  console.log('Feed files:', Object.keys(files).join(', '));

  const agency = parseCsv(files['agency.txt']);
  const routes = parseCsv(files['routes.txt']);
  const stops = parseCsv(files['stops.txt']);
  const calendar = parseCsv(files['calendar.txt']);
  const trips = parseCsv(files['trips.txt']);
  const stopTimes = parseCsv(files['stop_times.txt']);
  const frequencies = parseCsv(files['frequencies.txt']);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Truncating existing data...');
    await client.query(`
      TRUNCATE coverage_cells, route_headway_stats, frequencies, stop_times,
               trips, calendar, stops, routes, agency RESTART IDENTITY CASCADE
    `);

    await batchInsert(client, 'agencies', 'agency', ['agency_id', 'agency_name', 'agency_url', 'agency_tz'], agency, (a) => [
      a.agency_id,
      a.agency_name,
      a.agency_url,
      a.agency_timezone,
    ]);

    await batchInsert(
      client,
      'routes',
      'routes',
      ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_desc', 'route_type', 'route_color'],
      routes,
      (r) => [
        r.route_id,
        r.agency_id || null,
        r.route_short_name,
        r.route_long_name,
        r.route_desc,
        r.route_type ? parseInt(r.route_type, 10) : null,
        r.route_color,
      ]
    );

    await batchInsert(
      client,
      'stops',
      'stops',
      ['stop_id', 'stop_code', 'stop_name', 'stop_lat', 'stop_lon', 'location_type', 'wheelchair_boarding'],
      stops,
      (s) => {
        const lat = parseFloat(s.stop_lat);
        const lon = parseFloat(s.stop_lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
        return [
          s.stop_id,
          s.stop_code || null,
          s.stop_name,
          lat,
          lon,
          s.location_type ? parseInt(s.location_type, 10) : 0,
          s.wheelchair_boarding ? parseInt(s.wheelchair_boarding, 10) : null,
        ];
      },
      'ON CONFLICT (stop_id) DO NOTHING'
    );

    await batchInsert(
      client,
      'calendar entries',
      'calendar',
      ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
      calendar,
      (c) => [
        c.service_id,
        toBool(c.monday),
        toBool(c.tuesday),
        toBool(c.wednesday),
        toBool(c.thursday),
        toBool(c.friday),
        toBool(c.saturday),
        toBool(c.sunday),
        toDate(c.start_date),
        toDate(c.end_date),
      ]
    );

    const knownServiceIds = new Set(calendar.map((c) => c.service_id));
    await batchInsert(
      client,
      'trips',
      'trips',
      ['trip_id', 'route_id', 'service_id', 'trip_headsign', 'direction_id'],
      trips,
      (t) => [
        t.trip_id,
        t.route_id,
        knownServiceIds.has(t.service_id) ? t.service_id : null,
        t.trip_headsign,
        t.direction_id ? parseInt(t.direction_id, 10) : null,
      ],
      'ON CONFLICT (trip_id) DO NOTHING'
    );

    const knownStopIds = new Set(stops.map((s) => s.stop_id));
    const knownTripIds = new Set(trips.map((t) => t.trip_id));
    await batchInsert(
      client,
      'stop_times',
      'stop_times',
      ['trip_id', 'stop_sequence', 'stop_id', 'arrival_time', 'departure_time'],
      stopTimes,
      (st) => {
        if (!knownTripIds.has(st.trip_id) || !knownStopIds.has(st.stop_id)) return null;
        return [st.trip_id, parseInt(st.stop_sequence, 10), st.stop_id, st.arrival_time, st.departure_time];
      },
      'ON CONFLICT DO NOTHING'
    );

    await batchInsert(
      client,
      'frequency entries',
      'frequencies',
      ['trip_id', 'start_time', 'end_time', 'headway_secs'],
      frequencies,
      (f) => {
        if (!knownTripIds.has(f.trip_id)) return null;
        return [f.trip_id, f.start_time, f.end_time, parseInt(f.headway_secs, 10)];
      },
      'ON CONFLICT DO NOTHING'
    );

    await client.query('COMMIT');
    console.log('Ingestion complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
