# Ingestion

Downloads TransJakarta's real, official GTFS feed
(`gtfs.transjakarta.co.id/files/file_gtfs.zip`) and loads the subset this
project analyzes (agency, routes, stops, calendar, trips, stop_times,
frequencies) into Postgres. Idempotent — truncates and reloads every run.

## Run

```sh
npm install
DATABASE_URL="postgres://localhost/transjakarta" node ingest.js
```

Against your deployed Neon database:

```sh
DATABASE_URL="postgres://user:pass@ep-xxx.neon.tech/transjakarta?sslmode=require" node ingest.js
```

Pass `--use-cached` to reuse `../data/file_gtfs.zip` instead of
re-downloading:

```sh
node ingest.js --use-cached
```

This is a one-off/manual job, not a deployed service — run it once after
setting up your database, and again whenever the upstream feed changes.
On Render, this can run as a **Job** (one-off) rather than a Web Service.

Real numbers from the current feed: 1 agency, 240 routes, 8,091 stops,
7 calendar entries, 700 trips, 26,427 stop_times, 753 frequency entries.
