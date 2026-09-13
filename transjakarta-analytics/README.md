# TransJakarta Network Analytics

A real operations-analytics tool built on TransJakarta's own official,
public GTFS feed (`gtfs.transjakarta.co.id`) — not synthetic or
illustrative data. It answers a real transit-planning question: **where
is the network well-served, and where are the frequency and coverage
gaps?**

- **240 real routes**, **8,091 real stops**, **700 scheduled trips**,
  **753 real frequency entries** — the current feed, ingested as-is.
- **Service-frequency analysis**: real headway computed per route from
  `frequencies.txt`, flagged against a documented 15-minute
  frequent-service industry benchmark. Result on the current feed:
  **107 of 240 routes with defined frequency data fall below it.**
- **Coverage analysis**: a real geospatial grid (Go, spatial-hash indexed
  for speed — 16,042 cells computed in ~85ms) measuring how much of the
  network's own footprint sits within a 500m walkshed of a stop. Result:
  **16%** — see the caveat in `coverage-service/README.md` on how to read
  that number honestly.
- **Transfer-network analysis**: which routes share real stops (genuine
  transfer points), visualized as a graph, hub routes identified by real
  connection count.

## Architecture

```
gtfs.transjakarta.co.id (real feed)
        │
        ▼
  ingestion/  (Node, one-off) ──► Neon Postgres (db/schema.sql)
                                        │
                                        ▼
                          coverage-service/ (Go, one-off batch job)
                                        │
                                        ▼
                                   api/ (NestJS, Render) ──► web/ (Next.js, Render)
```

Each piece is genuinely justified by what it does, not chosen to "use the
tech": Node for straightforward CSV→SQL ETL, Go for a spatial computation
where the naive approach would be ~130M distance calculations (the
spatial-hash index brings this down to milliseconds), NestJS/Postgres for
the API layer, Next.js/React Flow/Leaflet/Recharts for the dashboard.
`api/` and `web/` are the only two things that run continuously —
`ingestion/` and `coverage-service/` are one-off jobs you run whenever the
upstream feed changes, not deployed services.

## Deploy: Render + Neon

### 1. Database — Neon (free tier is enough)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (Neon gives you both a pooled and an
   unpooled one — use the **pooled** one for the deployed API, the
   **unpooled** one for the one-off scripts below, since a long-running
   batch job holding one connection is exactly what the direct/unpooled
   endpoint is for).
3. Apply the schema:
   ```sh
   psql "<your-neon-unpooled-connection-string>" -f db/schema.sql
   ```

### 2. Load the real data (one-off, from your own machine)

```sh
cd ingestion
npm install
DATABASE_URL="<neon-unpooled-connection-string>" node ingest.js

cd ../api
npm install
DATABASE_URL="<neon-unpooled-connection-string>" npm run dev
# ^ boots the API once locally just to trigger its startup headway
#   computation against Neon, then Ctrl-C - or just let the deployed
#   Render service do this itself on its first boot, since HeadwayService
#   computes on startup automatically (see api/src/headway/headway.service.ts)

cd ../coverage-service
go build -o coverage-service main.go
DATABASE_URL="<neon-unpooled-connection-string>" ./coverage-service
```

### 3. Deploy api/ and web/ to Render

This repo includes `render.yaml` (a [Render Blueprint](https://render.com/docs/blueprint-spec)) defining both services:

1. In the Render dashboard: **New > Blueprint**, point it at this repo.
2. Render will create `transjakarta-api` and `transjakarta-web` from
   `render.yaml`. Before the first deploy finishes, set:
   - `transjakarta-api` → `DATABASE_URL` = your Neon **pooled** connection string
3. Once both are live, Render assigns each a URL
   (`https://transjakarta-api.onrender.com`, etc.). Set:
   - `transjakarta-api` → `CORS_ORIGIN` = `https://transjakarta-web.onrender.com`
   - `transjakarta-web` → `NEXT_PUBLIC_API_URL` = `https://transjakarta-api.onrender.com`
4. Redeploy `transjakarta-web` (it needs a rebuild, not just a restart —
   `NEXT_PUBLIC_*` vars are baked into the client bundle at build time).

Re-run step 2's ingestion/coverage scripts whenever the upstream GTFS feed
changes — there's no scheduled job here, it's a manual/CI step you
control (Render's dashboard also lets you run either script as a one-off
**Job** using the same repo, if you'd rather not run them from your own
machine).

## Local development

```sh
docker compose up --build
```

Opens the whole stack: Postgres (schema auto-applied), ingestion,
coverage-service, api on `:3001`, web on `:3000`. Or run each piece
natively — see each folder's own README.

## Data source and disclaimer

Feed: `https://gtfs.transjakarta.co.id/files/file_gtfs.zip`, TransJakarta's
own published GTFS static feed, no API key required. This project is an
independent analysis and is **not affiliated with or endorsed by
TransJakarta**. Analytical thresholds (15-minute frequent-service
standard, 500m walkshed) are documented, common transit-planning
benchmarks — not official TransJakarta service targets, since the feed
itself doesn't publish one.
